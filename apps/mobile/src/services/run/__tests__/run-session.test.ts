import type { LocationTracker, PermissionResult, RawLocation } from '@/services/location/location-tracker';
import { useRunStore } from '@/store/run.store';

import { createMemoryRunStore } from '../memory-store';
import { createRunSession } from '../run-session';

const M = 1 / 111_195;
const T0 = Date.UTC(2026, 10, 6, 7, 0, 0);

function fakeTracker(permission: PermissionResult = { granted: true, precise: true }) {
  let tracking = false;
  return {
    ensurePermission: jest.fn(async () => permission),
    start: jest.fn(async () => {
      tracking = true;
      return 'background' as const;
    }),
    stop: jest.fn(async () => {
      tracking = false;
    }),
    isTracking: jest.fn(async () => tracking),
    /** Simulates the OS killing the app (tracking stops, memory is lost). */
    kill() {
      tracking = false;
    },
  } satisfies LocationTracker & { kill(): void };
}

/** One fix per second heading north at `speed` m/s. */
function fixes(fromSecond: number, toSecond: number, speed = 3, startLat = 51.5, accuracy = 5): RawLocation[] {
  return Array.from({ length: toSecond - fromSecond + 1 }, (_, i) => {
    const second = fromSecond + i;
    return {
      coords: { latitude: startLat + second * speed * M, longitude: -0.12, altitude: 10, accuracy },
      timestamp: T0 + second * 1000,
    };
  });
}

function setup(permission?: PermissionResult) {
  let clock = T0;
  const store = createMemoryRunStore();
  const tracker = fakeTracker(permission);
  const onFinished = jest.fn();
  const deps = {
    store,
    tracker,
    now: () => clock,
    uuid: () => '6f1c2b3a-0000-4000-8000-000000000001',
    getUserId: () => 'user-1',
    ui: useRunStore.getState(),
    onFinished,
  };
  const session = createRunSession(deps);
  return {
    session,
    store,
    tracker,
    onFinished,
    deps,
    at: (seconds: number) => {
      clock = T0 + seconds * 1000;
    },
  };
}

beforeEach(() => useRunStore.getState().reset());

describe('location permission handling', () => {
  it.each([
    [{ granted: false, reason: 'denied' } as const, 'denied'],
    [{ granted: false, reason: 'blocked' } as const, 'blocked'],
    [{ granted: false, reason: 'services-disabled' } as const, 'services-disabled'],
    [{ granted: true, precise: false } as const, 'imprecise'],
  ])('does not start a run when permission is %o', async (permission, reason) => {
    const { session, store, tracker } = setup(permission);
    await expect(session.start()).resolves.toEqual({ ok: false, reason });
    expect(tracker.start).not.toHaveBeenCalled();
    expect(store.runs.size).toBe(0);
  });

  it('removes the run if location updates cannot start', async () => {
    const { session, store, tracker } = setup();
    tracker.start.mockRejectedValueOnce(new Error('unavailable'));
    await expect(session.start()).resolves.toEqual({ ok: false, reason: 'unavailable' });
    expect(store.runs.size).toBe(0);
  });
});

describe('GPS recording', () => {
  it('persists timestamped points and updates live distance', async () => {
    const { session, store } = setup();
    await session.start();
    await session.ingest(fixes(0, 60));

    const points = await store.listPoints('6f1c2b3a-0000-4000-8000-000000000001');
    expect(points).toHaveLength(61);
    expect(points[0]).toMatchObject({ recordedAt: T0, segment: 0, accuracy: 5, altitude: 10 });
    const state = useRunStore.getState();
    expect(state.phase).toBe('recording');
    expect(state.distanceMeters).toBeCloseTo(180, -1);
    expect(state.route[0]!.length).toBeGreaterThan(10);
    expect(state.gps).toBe('good');
  });

  it('drops cached fixes from before the run started and duplicate deliveries', async () => {
    const { session, store } = setup();
    await session.start();
    await session.ingest([...fixes(-30, -10), ...fixes(0, 5)]);
    await session.ingest(fixes(0, 5)); // delivered twice
    expect(await store.countPoints('6f1c2b3a-0000-4000-8000-000000000001')).toBe(6);
  });

  it('keeps distance out of poor or impossible fixes', async () => {
    const { session } = setup();
    await session.start();
    await session.ingest(fixes(0, 30));
    // A 2 km jump and a 300 m-accuracy fix.
    await session.ingest([
      { coords: { latitude: 51.52, longitude: -0.12, altitude: null, accuracy: 5 }, timestamp: T0 + 31_000 },
      { coords: { latitude: 51.5, longitude: -0.1, altitude: null, accuracy: 300 }, timestamp: T0 + 32_000 },
    ]);
    expect(useRunStore.getState().distanceMeters).toBeLessThan(100);
  });
});

describe('pause and resume', () => {
  it('excludes paused time and never connects the route across a pause', async () => {
    const { session, at } = setup();
    await session.start();
    await session.ingest(fixes(0, 60));
    at(60);
    await session.pause();
    expect(useRunStore.getState().phase).toBe('paused');

    // Fixes while paused are ignored.
    await session.ingest(fixes(61, 120, 3, 51.5 + 500 * M));
    at(180);
    await session.resume();
    // Resumed 500 m away from where we paused.
    await session.ingest(fixes(180, 240, 3, 51.5 + 500 * M - 180 * 3 * M));
    at(240);

    const state = useRunStore.getState();
    expect(state.route).toHaveLength(2);
    expect(state.distanceMeters).toBeGreaterThan(330);
    expect(state.distanceMeters).toBeLessThan(380);

    const id = await session.finish();
    expect(id).toBeTruthy();
  });

  it('records active duration without paused time on finish', async () => {
    const { session, store, at, onFinished, tracker } = setup();
    await session.start();
    await session.ingest(fixes(0, 100));
    at(100);
    await session.pause();
    at(400); // 5 minutes paused
    await session.resume();
    await session.ingest(fixes(400, 500, 3, 51.6));
    at(500);
    const localId = await session.finish();

    const run = await store.getRun(localId!);
    expect(run).toMatchObject({ status: 'finished', durationSeconds: 200, completedAt: T0 + 500_000 });
    expect(run!.distanceMeters).toBeGreaterThan(560);
    expect(run!.distanceMeters).toBeLessThan(620);
    expect(tracker.stop).toHaveBeenCalled();
    expect(onFinished).toHaveBeenCalledWith(localId);
    expect(useRunStore.getState().phase).toBe('idle');
  });
});

describe('interrupted run recovery', () => {
  it('restores a run after the app was killed mid-run, paused at the last fix', async () => {
    const first = setup();
    await first.session.start();
    await first.session.ingest(fixes(0, 120));
    first.tracker.kill();

    // App relaunched 20 minutes later: fresh session, same on-device storage.
    const relaunched = createRunSession({ ...first.deps, now: () => T0 + 20 * 60 * 1000 });
    useRunStore.getState().reset();
    const run = await relaunched.attach();

    expect(run).toMatchObject({ status: 'paused', activeMs: 120_000 });
    const state = useRunStore.getState();
    expect(state).toMatchObject({ phase: 'paused', recovered: true });
    expect(state.distanceMeters).toBeCloseTo(360, -1);

    await relaunched.resume();
    expect(first.tracker.start).toHaveBeenCalledTimes(2);
    expect(useRunStore.getState()).toMatchObject({ phase: 'recording', recovered: false });
  });

  it('reattaches without pausing when tracking survived in the background', async () => {
    const first = setup();
    await first.session.start();
    await first.session.ingest(fixes(0, 30));

    const reloaded = createRunSession(first.deps);
    const run = await reloaded.attach();
    expect(run?.status).toBe('recording');
    expect(useRunStore.getState().recovered).toBe(false);
  });

  it("ignores another account's unfinished run", async () => {
    const first = setup();
    await first.session.start();
    const other = createRunSession({ ...first.deps, getUserId: () => 'user-2' });
    await expect(other.attach()).resolves.toBeNull();
    expect(useRunStore.getState().phase).toBe('idle');
  });

  it('records fixes delivered by the headless background task', async () => {
    const first = setup();
    await first.session.start();
    // The OS wakes the app without UI: a fresh session with no in-memory run.
    const headless = createRunSession(first.deps);
    await headless.ingest(fixes(0, 10));
    expect(await first.store.countPoints('6f1c2b3a-0000-4000-8000-000000000001')).toBe(11);
  });
});

describe('discard', () => {
  it('deletes the run and its points', async () => {
    const { session, store } = setup();
    await session.start();
    await session.ingest(fixes(0, 10));
    await session.discard();
    expect(store.runs.size).toBe(0);
    expect(store.points).toHaveLength(0);
  });
});
