import { randomUUID } from 'node:crypto';

import type { RunPointInput } from '@next-stride/shared';
import { describe, expect, it } from 'vitest';

import { prisma } from '../src/lib/prisma';
import { api, registerUser } from './helpers';

const M = 1 / 111_195; // ~1 m of latitude

/** A straight run north at `speed` m/s, one fix per second, starting `startOffsetMs` before now. */
function track(seconds: number, opts: { speed?: number; segment?: number; startMs?: number; startLat?: number } = {}) {
  const { speed = 10 / 3, segment = 0, startMs = Date.now() - 60 * 60 * 1000, startLat = 51.5 } = opts;
  return Array.from({ length: seconds + 1 }, (_, i): RunPointInput => ({
    latitude: startLat + i * speed * M,
    longitude: -0.12,
    altitude: 12,
    accuracy: 5,
    recordedAt: new Date(startMs + i * 1000).toISOString(),
    segment,
  }));
}

async function startRun(auth: Record<string, string>, startedAt = new Date(Date.now() - 60 * 60 * 1000)) {
  const clientId = randomUUID();
  const res = await api.post('/api/runs').set(auth).send({ clientId, startedAt: startedAt.toISOString() }).expect(201);
  return { run: res.body, clientId, startedAt };
}

/** Records and completes a run of `seconds` seconds at 3:00/km-ish pace starting at `startedAt`. */
async function recordRun(auth: Record<string, string>, startedAt: Date, seconds = 300, speed = 10 / 3) {
  const { run } = await startRun(auth, startedAt);
  const points = track(seconds, { speed, startMs: startedAt.getTime() });
  await api.post(`/api/runs/${run.id}/points`).set(auth).send({ points }).expect(200);
  const completedAt = new Date(startedAt.getTime() + seconds * 1000).toISOString();
  const res = await api
    .post(`/api/runs/${run.id}/complete`)
    .set(auth)
    .send({ completedAt, durationSeconds: seconds, pointCount: points.length })
    .expect(200);
  return res.body;
}

describe('POST /api/runs', () => {
  it('creates an in-progress run', async () => {
    const { auth } = await registerUser();
    const { run, clientId } = await startRun(auth);
    expect(run).toMatchObject({ clientId, status: 'IN_PROGRESS', distanceMeters: 0, pointCount: 0 });
  });

  it('is idempotent on the device clientId (offline retries never duplicate a run)', async () => {
    const { auth } = await registerUser();
    const body = { clientId: randomUUID(), startedAt: new Date().toISOString() };
    const first = await api.post('/api/runs').set(auth).send(body).expect(201);
    const retry = await api.post('/api/runs').set(auth).send(body).expect(200);
    expect(retry.body.id).toBe(first.body.id);

    const [a, b] = await Promise.all([
      api.post('/api/runs').set(auth).send({ ...body, clientId: randomUUID() }),
      api.post('/api/runs').set(auth).send(body),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(await prisma.run.count()).toBe(2);
  });

  it('validates input', async () => {
    const { auth } = await registerUser();
    const res = await api.post('/api/runs').set(auth).send({ clientId: 'nope', startedAt: 'yesterday' }).expect(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['clientId', 'startedAt']);
  });

  it('requires authentication', async () => {
    await api.post('/api/runs').send({ clientId: randomUUID(), startedAt: new Date().toISOString() }).expect(401);
    await api.get('/api/runs').expect(401);
    await api.get('/api/runs/stats').expect(401);
  });
});

describe('POST /api/runs/:id/points', () => {
  it('stores points and skips duplicates, so re-sending a batch is safe', async () => {
    const { auth } = await registerUser();
    const { run, startedAt } = await startRun(auth);
    const points = track(9, { startMs: startedAt.getTime() });

    const first = await api.post(`/api/runs/${run.id}/points`).set(auth).send({ points }).expect(200);
    expect(first.body).toEqual({ received: 10, stored: 10, duplicates: 0, totalPoints: 10 });

    // The response was lost; the app retries the same batch plus new points.
    const more = track(14, { startMs: startedAt.getTime() });
    const retry = await api.post(`/api/runs/${run.id}/points`).set(auth).send({ points: more }).expect(200);
    expect(retry.body).toEqual({ received: 15, stored: 5, duplicates: 10, totalPoints: 15 });
    expect(await prisma.runPoint.count({ where: { runId: run.id } })).toBe(15);
  });

  it('rejects invalid coordinates and points outside the run window', async () => {
    const { auth } = await registerUser();
    const { run, startedAt } = await startRun(auth);
    const [good] = track(0, { startMs: startedAt.getTime() });
    await api
      .post(`/api/runs/${run.id}/points`)
      .set(auth)
      .send({ points: [{ ...good, latitude: 123 }] })
      .expect(400);
    const early = { ...good!, recordedAt: new Date(startedAt.getTime() - 10 * 60 * 1000).toISOString() };
    const res = await api.post(`/api/runs/${run.id}/points`).set(auth).send({ points: [early] }).expect(400);
    expect(res.body.error.fields['points.0.recordedAt']).toBeDefined();
  });

  it('caps batch size', async () => {
    const { auth } = await registerUser();
    const { run, startedAt } = await startRun(auth);
    await api
      .post(`/api/runs/${run.id}/points`)
      .set(auth)
      .send({ points: track(1000, { startMs: startedAt.getTime() }) })
      .expect(400);
  });

  it('refuses points for a completed run', async () => {
    const { auth } = await registerUser();
    const done = await recordRun(auth, new Date(Date.now() - 2 * 60 * 60 * 1000), 30);
    const res = await api
      .post(`/api/runs/${done.id}/points`)
      .set(auth)
      .send({ points: track(1, { startMs: Date.parse(done.startedAt) }) })
      .expect(409);
    expect(res.body.error.code).toBe('RUN_ALREADY_COMPLETED');
  });
});

describe('POST /api/runs/:id/complete', () => {
  it('computes metrics on the server from the stored points', async () => {
    const { auth } = await registerUser();
    await api.put('/api/users/me').set(auth).send({ weightKg: 60 }).expect(200);
    const run = await recordRun(auth, new Date(Date.now() - 2 * 60 * 60 * 1000), 600);

    expect(run.status).toBe('COMPLETED');
    expect(run.distanceMeters).toBeGreaterThan(1960);
    expect(run.distanceMeters).toBeLessThan(2040);
    expect(run.durationSeconds).toBe(600);
    expect(run.movingTimeSeconds).toBeGreaterThan(590);
    expect(run.averagePaceSecondsPerKm).toBeGreaterThan(295);
    expect(run.averagePaceSecondsPerKm).toBeLessThan(305);
    expect(run.averageSpeed).toBeCloseTo(3.33, 1);
    // Calories use the profile weight: 60 kg × 2 km × 1.036 ≈ 124
    expect(run.caloriesEstimate).toBeGreaterThan(118);
    expect(run.caloriesEstimate).toBeLessThan(130);
    expect(run.pointCount).toBe(601);
    expect(run.routePreview[0].length).toBeGreaterThan(10);
  });

  it('refuses to finalise until every recorded point has arrived (reconciliation)', async () => {
    const { auth } = await registerUser();
    const { run, startedAt } = await startRun(auth);
    const points = track(99, { startMs: startedAt.getTime() });
    await api.post(`/api/runs/${run.id}/points`).set(auth).send({ points: points.slice(0, 60) }).expect(200);

    const body = { completedAt: new Date(startedAt.getTime() + 99_000).toISOString(), durationSeconds: 99, pointCount: 100 };
    const missing = await api.post(`/api/runs/${run.id}/complete`).set(auth).send(body).expect(409);
    expect(missing.body.error).toMatchObject({
      code: 'RUN_POINTS_MISSING',
      details: { storedPoints: 60, expectedPoints: 100 },
    });

    await api.post(`/api/runs/${run.id}/points`).set(auth).send({ points }).expect(200);
    await api.post(`/api/runs/${run.id}/complete`).set(auth).send(body).expect(200);
  });

  it('is idempotent: completing twice returns the same result', async () => {
    const { auth } = await registerUser();
    const { run, startedAt } = await startRun(auth);
    const points = track(60, { startMs: startedAt.getTime() });
    await api.post(`/api/runs/${run.id}/points`).set(auth).send({ points }).expect(200);
    const body = { completedAt: new Date(startedAt.getTime() + 60_000).toISOString(), durationSeconds: 60, pointCount: 61 };

    const [a, b] = await Promise.all([
      api.post(`/api/runs/${run.id}/complete`).set(auth).send(body),
      api.post(`/api/runs/${run.id}/complete`).set(auth).send(body),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body).toEqual(b.body);

    // A late retry with different numbers cannot rewrite a completed run.
    const late = await api
      .post(`/api/runs/${run.id}/complete`)
      .set(auth)
      .send({ ...body, durationSeconds: 5 })
      .expect(200);
    expect(late.body.durationSeconds).toBe(60);
  });

  it('never measures distance across a pause', async () => {
    const { auth } = await registerUser();
    const { run, startedAt } = await startRun(auth);
    const t0 = startedAt.getTime();
    const first = track(60, { startMs: t0 });
    // Resumed 200 s later, 500 m further north.
    const second = track(60, { startMs: t0 + 260_000, segment: 1, startLat: 51.5 + 700 * M });
    const points = [...first, ...second];
    await api.post(`/api/runs/${run.id}/points`).set(auth).send({ points }).expect(200);
    const res = await api
      .post(`/api/runs/${run.id}/complete`)
      .set(auth)
      .send({ completedAt: new Date(t0 + 320_000).toISOString(), durationSeconds: 120, pointCount: points.length })
      .expect(200);
    expect(res.body.distanceMeters).toBeGreaterThan(390);
    expect(res.body.distanceMeters).toBeLessThan(410);
    expect(res.body.durationSeconds).toBe(120);
  });

  it('caps duration at the wall-clock span of the run', async () => {
    const { auth } = await registerUser();
    const { run, startedAt } = await startRun(auth);
    const res = await api
      .post(`/api/runs/${run.id}/complete`)
      .set(auth)
      .send({ completedAt: new Date(startedAt.getTime() + 100_000).toISOString(), durationSeconds: 5000, pointCount: 0 })
      .expect(200);
    expect(res.body.durationSeconds).toBe(100);
  });

  it('rejects a completion time before the start', async () => {
    const { auth } = await registerUser();
    const { run, startedAt } = await startRun(auth);
    await api
      .post(`/api/runs/${run.id}/complete`)
      .set(auth)
      .send({ completedAt: new Date(startedAt.getTime() - 1000).toISOString(), durationSeconds: 0, pointCount: 0 })
      .expect(400);
  });
});

describe('reading runs', () => {
  it('lists completed runs newest first with cursor pagination', async () => {
    const { auth } = await registerUser();
    const base = Date.now() - 10 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < 5; i += 1) await recordRun(auth, new Date(base + i * 60 * 60 * 1000), 20);
    await startRun(auth); // in progress: not listed

    const page1 = await api.get('/api/runs?limit=2').set(auth).expect(200);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.nextCursor).toEqual(expect.any(String));
    const page2 = await api.get(`/api/runs?limit=2&cursor=${page1.body.nextCursor}`).set(auth).expect(200);
    const page3 = await api.get(`/api/runs?limit=2&cursor=${page2.body.nextCursor}`).set(auth).expect(200);
    expect(page3.body.nextCursor).toBeNull();

    const all = [...page1.body.items, ...page2.body.items, ...page3.body.items];
    expect(all).toHaveLength(5);
    const starts = all.map((run: { startedAt: string }) => Date.parse(run.startedAt));
    expect(starts).toEqual([...starts].sort((a, b) => b - a));
    expect(all[0]).not.toHaveProperty('points');
  });

  it('rejects a malformed cursor and out-of-range limits', async () => {
    const { auth } = await registerUser();
    await api.get('/api/runs?cursor=garbage').set(auth).expect(400);
    await api.get('/api/runs?limit=500').set(auth).expect(400);
  });

  it('returns the full route and splits for a run', async () => {
    const { auth } = await registerUser();
    const run = await recordRun(auth, new Date(Date.now() - 3 * 60 * 60 * 1000), 400);
    const res = await api.get(`/api/runs/${run.id}`).set(auth).expect(200);
    expect(res.body.points).toHaveLength(401);
    expect(res.body.points[0]).toEqual({
      latitude: 51.5,
      longitude: -0.12,
      altitude: 12,
      accuracy: 5,
      recordedAt: expect.any(String),
      segment: 0,
    });
    expect(res.body.splits[0]).toMatchObject({ index: 1, distanceMeters: 1000 });
  });

  it("never exposes another user's runs", async () => {
    const owner = await registerUser();
    const intruder = await registerUser();
    const run = await recordRun(owner.auth, new Date(Date.now() - 60 * 60 * 1000), 20);

    await api.get(`/api/runs/${run.id}`).set(intruder.auth).expect(404);
    await api.delete(`/api/runs/${run.id}`).set(intruder.auth).expect(404);
    await api
      .post(`/api/runs/${run.id}/points`)
      .set(intruder.auth)
      .send({ points: track(1) })
      .expect(404);
    await api
      .post(`/api/runs/${run.id}/complete`)
      .set(intruder.auth)
      .send({ completedAt: new Date().toISOString(), durationSeconds: 1, pointCount: 0 })
      .expect(404);
    const list = await api.get('/api/runs').set(intruder.auth).expect(200);
    expect(list.body.items).toHaveLength(0);
    const stats = await api.get('/api/runs/stats').set(intruder.auth).expect(200);
    expect(stats.body.totals.runs).toBe(0);
  });

  it('404s for malformed or unknown ids', async () => {
    const { auth } = await registerUser();
    await api.get('/api/runs/not-a-uuid').set(auth).expect(404);
    await api.get(`/api/runs/${randomUUID()}`).set(auth).expect(404);
  });
});

describe('GET /api/runs/stats', () => {
  it('aggregates totals, this week, this month, summaries and personal bests', async () => {
    const { auth } = await registerUser();
    const now = Date.now();
    const short = await recordRun(auth, new Date(now - 60 * 60 * 1000), 300); // ~1 km
    const long = await recordRun(auth, new Date(now - 2 * 60 * 60 * 1000), 900, 3); // ~2.7 km, slower
    await recordRun(auth, new Date(now - 400 * 24 * 60 * 60 * 1000), 60); // over a year ago

    const res = await api.get('/api/runs/stats?tz=UTC').set(auth).expect(200);
    const stats = res.body;
    expect(stats.totals.runs).toBe(3);
    expect(stats.thisWeek.runs).toBeGreaterThanOrEqual(1); // both recent runs unless the week just rolled over
    expect(stats.thisMonth.runs).toBeGreaterThanOrEqual(1);
    expect(stats.daily).toHaveLength(7);
    expect(stats.weekly).toHaveLength(8);
    expect(stats.monthly).toHaveLength(6);
    expect(stats.weekly.at(-1).runs + stats.weekly.at(-2).runs).toBe(2);
    expect(stats.personalBests.longestDistance.runId).toBe(long.id);
    expect(stats.personalBests.longestDuration.runId).toBe(long.id);
    expect(stats.personalBests.fastestPace.runId).toBe(short.id);
    expect(stats.averages.distancePerRunMeters).toBeGreaterThan(1000);
  });

  it('buckets by the caller time zone', async () => {
    const { auth } = await registerUser();
    // 23:30 UTC on a Sunday is already Monday in Tokyo (UTC+9): a different week.
    const lastSunday = new Date();
    lastSunday.setUTCDate(lastSunday.getUTCDate() - ((lastSunday.getUTCDay() + 7) % 7) - 7);
    lastSunday.setUTCHours(23, 30, 0, 0);
    await recordRun(auth, lastSunday, 30);

    const utc = (await api.get('/api/runs/stats?tz=UTC').set(auth).expect(200)).body;
    const tokyo = (await api.get('/api/runs/stats?tz=Asia/Tokyo').set(auth).expect(200)).body;
    const weekOf = (stats: { weekly: { weekStart: string; runs: number }[] }) =>
      stats.weekly.find((week) => week.runs > 0)?.weekStart;
    expect(weekOf(utc)).not.toBe(weekOf(tokyo));
    expect(tokyo.timeZone).toBe('Asia/Tokyo');
  });

  it('rejects unknown time zones', async () => {
    const { auth } = await registerUser();
    await api.get('/api/runs/stats?tz=Mars/Olympus').set(auth).expect(400);
    await api.get("/api/runs/stats?tz=UTC';DROP TABLE runs;--").set(auth).expect(400);
  });

  it('works with no runs', async () => {
    const { auth } = await registerUser();
    const res = await api.get('/api/runs/stats').set(auth).expect(200);
    expect(res.body.totals).toEqual({ runs: 0, distanceMeters: 0, durationSeconds: 0, movingTimeSeconds: 0 });
    expect(res.body.personalBests).toEqual({ longestDistance: null, longestDuration: null, fastestPace: null });
  });
});

describe('zone reference pace', () => {
  it('stays null until there are three runs of at least 3 km, then uses the third fastest', async () => {
    const { auth } = await registerUser();
    const hour = 60 * 60 * 1000;
    const stats = async () => (await api.get('/api/runs/stats?tz=UTC').set(auth).expect(200)).body;

    await recordRun(auth, new Date(Date.now() - 2 * hour), 900, 4); // 250 s/km, 3.6 km
    await recordRun(auth, new Date(Date.now() - 26 * hour), 990, 10 / 3); // 300 s/km, 3.3 km
    await recordRun(auth, new Date(Date.now() - 50 * hour), 300, 5); // 1.5 km: too short to count
    expect((await stats()).zoneReferencePaceSecondsPerKm).toBeNull();

    await recordRun(auth, new Date(Date.now() - 74 * hour), 990, 3.2); // 312.5 s/km, 3.2 km
    expect((await stats()).zoneReferencePaceSecondsPerKm).toBeCloseTo(312.5 * 1.03, -1);
  });
});

describe('GET /api/runs/progress', () => {
  const day = 24 * 60 * 60 * 1000;

  it('requires authentication and a valid time zone', async () => {
    await api.get('/api/runs/progress').expect(401);
    const { auth } = await registerUser();
    await api.get('/api/runs/progress?tz=Mars/Olympus').set(auth).expect(400);
  });

  it('starts every new runner at level 1', async () => {
    const { auth } = await registerUser();
    const { body } = await api.get('/api/runs/progress').set(auth).expect(200);
    expect(body).toMatchObject({ totalXp: 0, level: 1, title: 'Rookie', timeZone: 'UTC' });
    expect(body.quests.items).toHaveLength(3);
    expect(body.recentRewards).toEqual([]);
  });

  it('awards XP and badges, and takes them back when the run is deleted', async () => {
    const { auth } = await registerUser();
    const run = await recordRun(auth, new Date(Date.now() - 2 * 60 * 60 * 1000), 300); // ~1 km

    const earned = (await api.get('/api/runs/progress?tz=UTC').set(auth).expect(200)).body;
    expect(earned.totalXp).toBeGreaterThan(0);
    expect(earned.recentRewards[0].runId).toBe(run.id);
    expect(earned.badges.find((badge: { id: string }) => badge.id === 'first-stride').earned.runId).toBe(run.id);

    await api.delete(`/api/runs/${run.id}`).set(auth).expect(204);
    const after = (await api.get('/api/runs/progress?tz=UTC').set(auth).expect(200)).body;
    expect(after.totalXp).toBe(0);
  });

  it('counts a day streak from runs on consecutive days', async () => {
    const { auth } = await registerUser();
    const now = Date.now();
    await recordRun(auth, new Date(now - 2 * day), 300);
    await recordRun(auth, new Date(now - day), 300);
    await recordRun(auth, new Date(now - 60 * 60 * 1000), 300);
    const { body } = await api.get('/api/runs/progress?tz=UTC').set(auth).expect(200);
    expect(body.streaks.day.longest).toBeGreaterThanOrEqual(2);
  });

  it('uses the caller time zone for calendar days', async () => {
    const { auth } = await registerUser();
    // 21:30 UTC is 06:30 the next morning in Tokyo: an early-bird run only there.
    const started = new Date(Date.now() - 3 * day);
    started.setUTCHours(21, 30, 0, 0);
    await recordRun(auth, started, 300);
    const earlyProgress = (tz: string) => api.get(`/api/runs/progress?tz=${tz}`).set(auth).expect(200);
    const badge = (res: { body: { badges: { id: string; current: number }[] } }) => res.body.badges.find((item) => item.id === 'early-bird')!.current;
    expect(badge(await earlyProgress('UTC'))).toBe(0);
    expect(badge(await earlyProgress('Asia/Tokyo'))).toBe(1);
  });

  it('never exposes another runner', async () => {
    const owner = await registerUser();
    const intruder = await registerUser();
    await recordRun(owner.auth, new Date(Date.now() - 60 * 60 * 1000), 300);
    const { body } = await api.get('/api/runs/progress').set(intruder.auth).expect(200);
    expect(body.totalXp).toBe(0);
  });
});

describe('DELETE /api/runs/:id', () => {
  it('deletes the run and its points', async () => {
    const { auth } = await registerUser();
    const run = await recordRun(auth, new Date(Date.now() - 60 * 60 * 1000), 30);
    await api.delete(`/api/runs/${run.id}`).set(auth).expect(204);
    await api.get(`/api/runs/${run.id}`).set(auth).expect(404);
    expect(await prisma.runPoint.count()).toBe(0);
    await api.delete(`/api/runs/${run.id}`).set(auth).expect(404);
  });
});
