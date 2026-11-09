import type { AppendRunPointsInput, CompleteRunInput, RunSummary } from '@next-stride/shared';

import { ApiError } from '@/services/api/client';

import { type LocalRun, newLocalRun } from '../local-store';
import { createMemoryRunStore } from '../memory-store';
import { backoffMs, createRunSync } from '../run-sync';

const T0 = Date.UTC(2026, 10, 6, 7, 0, 0);
const offline = () => new ApiError(0, 'NETWORK_ERROR', "Can't reach NEXT STRIDE");

/** A fake API backed by an in-memory "server" with the real API's semantics. */
function fakeServer() {
  const runs = new Map<string, { id: string; clientId: string; status: 'IN_PROGRESS' | 'COMPLETED'; points: Map<string, unknown> }>();
  let ids = 0;
  const summary = (id: string): RunSummary => ({
    id,
    clientId: runs.get(id)!.clientId,
    status: runs.get(id)!.status,
    startedAt: new Date(T0).toISOString(),
    completedAt: new Date(T0).toISOString(),
    distanceMeters: 1234.5,
    durationSeconds: 600,
    movingTimeSeconds: 590,
    averagePaceSecondsPerKm: 478,
    averageSpeed: 2.09,
    caloriesEstimate: 90,
    pointCount: runs.get(id)!.points.size,
    routePreview: [],
  });
  const api = {
    create: jest.fn(async ({ clientId }: { clientId: string }) => {
      const existing = [...runs.values()].find((run) => run.clientId === clientId);
      if (existing) return summary(existing.id);
      const id = `server-${++ids}`;
      runs.set(id, { id, clientId, status: 'IN_PROGRESS', points: new Map() });
      return summary(id);
    }),
    appendPoints: jest.fn(async (id: string, input: AppendRunPointsInput) => {
      const run = runs.get(id);
      if (!run) throw new ApiError(404, 'NOT_FOUND', 'Run not found');
      if (run.status === 'COMPLETED') throw new ApiError(409, 'RUN_ALREADY_COMPLETED', 'done');
      for (const point of input.points) run.points.set(point.recordedAt, point);
      return { received: input.points.length, stored: 0, duplicates: 0, totalPoints: run.points.size };
    }),
    complete: jest.fn(async (id: string, input: CompleteRunInput) => {
      const run = runs.get(id)!;
      if (run.status === 'COMPLETED') return summary(id);
      if (run.points.size < input.pointCount) {
        throw new ApiError(409, 'RUN_POINTS_MISSING', 'missing', undefined);
      }
      run.status = 'COMPLETED';
      return summary(id);
    }),
  };
  return { api, runs };
}

async function seedFinishedRun(store: ReturnType<typeof createMemoryRunStore>, points = 1200, overrides: Partial<LocalRun> = {}) {
  const run: LocalRun = {
    ...newLocalRun({ localId: '0b9f6a3e-0000-4000-8000-0000000000aa', userId: 'user-1', now: T0 }),
    status: 'finished',
    completedAt: T0 + 600_000,
    durationSeconds: 600,
    ...overrides,
  };
  await store.createRun(run);
  await store.insertPoints(
    run.localId,
    Array.from({ length: points }, (_, i) => ({ latitude: 51.5 + i * 1e-5, longitude: -0.12, accuracy: 5, recordedAt: T0 + i * 500, segment: 0 })),
  );
  return run;
}

function setup() {
  let clock = T0 + 3_600_000;
  const store = createMemoryRunStore();
  const server = fakeServer();
  const onSynced = jest.fn();
  const sync = createRunSync({ store, api: server.api, getUserId: () => 'user-1', now: () => clock, onSynced });
  return { store, server, sync, onSynced, advance: (ms: number) => (clock += ms) };
}

describe('run synchronisation', () => {
  it('uploads a finished run: create (idempotent key), batched points, complete', async () => {
    const { store, server, sync, onSynced } = setup();
    const run = await seedFinishedRun(store);

    const report = await sync.syncAll();
    expect(report.synced).toEqual([run.localId]);
    expect(server.api.create).toHaveBeenCalledWith({ clientId: run.localId, startedAt: new Date(T0).toISOString() });
    expect(server.api.appendPoints).toHaveBeenCalledTimes(3); // 500 + 500 + 200
    expect(server.api.complete.mock.calls[0]![1]).toMatchObject({ durationSeconds: 600, pointCount: 1200 });

    const saved = await store.getRun(run.localId);
    expect(saved).toMatchObject({ status: 'synced', serverId: 'server-1', distanceMeters: 1234.5 });
    expect(onSynced).toHaveBeenCalledTimes(1);
  });

  it('never loses a run while offline, and backs off between attempts', async () => {
    const { store, server, sync, advance } = setup();
    const run = await seedFinishedRun(store);
    const realCreate = server.api.create.getMockImplementation()!;
    server.api.create.mockRejectedValue(offline());

    const report = await sync.syncAll();
    expect(report).toMatchObject({ offline: true, failed: [run.localId] });
    let saved = (await store.getRun(run.localId))!;
    expect(saved.status).toBe('finished');
    expect(await store.countPoints(run.localId)).toBe(1200);
    expect(saved.nextSyncAt).toBe(T0 + 3_600_000 + backoffMs(1));

    // Not retried before the backoff expires…
    await sync.syncAll();
    expect(server.api.create).toHaveBeenCalledTimes(1);

    // …and succeeds once the connection is back.
    server.api.create.mockImplementation(realCreate);
    advance(backoffMs(1));
    await sync.syncAll();
    saved = (await store.getRun(run.localId))!;
    expect(saved.status).toBe('synced');
  });

  it('resumes an interrupted upload without re-sending confirmed batches (duplicate prevention)', async () => {
    const { store, server, sync } = setup();
    const run = await seedFinishedRun(store);
    // Connection drops on the second batch.
    server.api.appendPoints.mockImplementationOnce(server.api.appendPoints.getMockImplementation()!).mockRejectedValueOnce(offline());

    await sync.syncAll();
    expect((await store.listUnsyncedPoints(run.localId, 5000)).length).toBe(700);

    await sync.syncAll({ force: true });
    const sent = server.api.appendPoints.mock.calls.reduce((sum, [, input]) => sum + input.points.length, 0);
    // 500 confirmed + 500 failed + 700 retried — the first batch was never re-sent.
    expect(sent).toBe(1700);
    expect(server.runs.get('server-1')!.points.size).toBe(1200);
    expect(server.api.create).toHaveBeenCalledTimes(1);
    expect((await store.getRun(run.localId))!.status).toBe('synced');
  });

  it('reconciles when the server is missing points', async () => {
    const { store, server, sync } = setup();
    const run = await seedFinishedRun(store, 100);
    await sync.syncAll();
    expect((await store.getRun(run.localId))!.status).toBe('synced');

    // Simulate a server that "lost" points: local copy says synced, server has fewer.
    const second = await seedFinishedRun(store, 100, { localId: '0b9f6a3e-0000-4000-8000-0000000000bb', startedAt: T0 + 1 });
    const pointsOfSecond = await store.listPoints(second.localId);
    await store.markPointsSynced(pointsOfSecond.slice(0, 60).map((p) => p.id)); // claims 60 already uploaded
    await sync.syncAll({ force: true });

    expect(server.api.complete).toHaveBeenCalledTimes(3); // first run, failed attempt, retry
    const serverRun = [...server.runs.values()].find((r) => r.clientId === second.localId)!;
    expect(serverRun.points.size).toBe(100);
    expect((await store.getRun(second.localId))!.status).toBe('synced');
  });

  it('treats a lost completion response as success on retry (idempotent complete)', async () => {
    const { store, server, sync } = setup();
    const run = await seedFinishedRun(store, 50);
    const realComplete = server.api.complete.getMockImplementation()!;
    server.api.complete.mockImplementationOnce(async (id, input) => {
      await realComplete(id, input); // completed on the server…
      throw offline(); // …but the response never arrived
    });

    await sync.syncAll();
    expect((await store.getRun(run.localId))!.status).toBe('finished');
    await sync.syncAll({ force: true });
    expect((await store.getRun(run.localId))!.status).toBe('synced');
    expect(server.runs.size).toBe(1);
  });

  it('streams points of a run that is still recording, without completing it', async () => {
    const { store, server, sync } = setup();
    const run = await seedFinishedRun(store, 30, { status: 'recording', completedAt: null });
    await sync.syncAll();
    expect(server.runs.get('server-1')!.points.size).toBe(30);
    expect(server.api.complete).not.toHaveBeenCalled();
    expect((await store.getRun(run.localId))!.status).toBe('recording');
  });

  it("only uploads the signed-in user's runs", async () => {
    const { store, server, sync } = setup();
    await seedFinishedRun(store, 10, { userId: 'someone-else' });
    await sync.syncAll();
    expect(server.api.create).not.toHaveBeenCalled();
  });

  it('runs one pass at a time for concurrent triggers', async () => {
    const { store, server, sync } = setup();
    await seedFinishedRun(store, 10);
    await Promise.all([sync.syncAll(), sync.syncAll(), sync.syncAll()]);
    expect(server.api.create).toHaveBeenCalledTimes(1);
  });

  it('caps the backoff', () => {
    expect(backoffMs(1)).toBe(5000);
    expect(backoffMs(3)).toBe(20000);
    expect(backoffMs(50)).toBe(600000);
  });
});
