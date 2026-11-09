import {
  computeRunMetrics,
  type GeoPoint,
  gpsSignalStatus,
  isValidCoordinate,
  RunMetricsAccumulator,
} from '@next-stride/shared';

import type { LocationTracker, PermissionResult, RawLocation } from '@/services/location/location-tracker';
import type { RunState } from '@/store/run.store';

import { type LocalRun, newLocalRun, type RunLocalStore } from './local-store';

/** Fixes cached by the OS from before the run started/resumed are ignored. */
const STALE_FIX_TOLERANCE_MS = 3000;

export type StartResult = { ok: true } | { ok: false; reason: Exclude<PermissionResult, { granted: true }>['reason'] | 'imprecise' | 'unavailable' };

/** Hears about a run's progress while it records, including with the screen locked. */
export interface RunCoach {
  start(): void;
  /** Continuing a run restored after the app closed. */
  resume(distanceMeters: number): void;
  update(progress: { now: number; distanceMeters: number; movingSeconds: number; currentSpeed: number | null }): void;
  stop(): void;
}

export interface RunSessionDeps {
  store: RunLocalStore;
  tracker: LocationTracker;
  now: () => number;
  uuid: () => string;
  getUserId: () => string | null;
  ui: { set: (patch: Partial<RunState>) => void; reset: () => void };
  /** Called after a run is finished and saved locally (e.g. trigger an upload). */
  onFinished?: (localId: string) => void;
  /** Called when the background task receives fixes (e.g. throttled upload). */
  onPointsRecorded?: () => void;
  coach?: RunCoach;
}

/**
 * Records runs. The local store is the source of truth: every fix is written
 * before anything else, so a run survives the app being killed, the phone
 * restarting, or having no connection.
 *
 * The in-memory accumulator only drives the live UI; it is rebuilt from the
 * store whenever the app (re)attaches to a run.
 */
export function createRunSession(deps: RunSessionDeps) {
  let active: LocalRun | null = null;
  let accumulator: RunMetricsAccumulator | null = null;
  /** Latest valid fix, accepted or not — drives the GPS indicator and position marker. */
  let lastRaw: GeoPoint | null = null;
  let trackingMode: RunState['trackingMode'] = null;
  // Serialises writes so fixes, pauses and finish never interleave.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  };

  function publish(extra: Partial<RunState> = {}, withRoute = true) {
    if (!active) return;
    const now = deps.now();
    const lastFix = lastRaw;
    deps.ui.set({
      phase: active.status === 'paused' ? 'paused' : 'recording',
      localId: active.localId,
      startedAt: active.startedAt,
      activeMs: active.activeMs,
      segmentStartedAt: active.segmentStartedAt,
      distanceMeters: accumulator?.displayDistanceMeters ?? 0,
      movingTimeMs: accumulator?.movingTimeMs ?? 0,
      currentSpeed: active.status === 'recording' ? (accumulator?.currentSpeedMps(now) ?? null) : null,
      ...(withRoute
        ? { route: (accumulator?.segments ?? []).map((segment) => segment.map((p) => [p.longitude, p.latitude] as [number, number])) }
        : {}),
      lastFix: lastFix
        ? { latitude: lastFix.latitude, longitude: lastFix.longitude, accuracy: lastFix.accuracy ?? null, recordedAt: lastFix.recordedAt }
        : null,
      gps: active.status === 'recording' ? gpsSignalStatus(lastFix, now) : 'searching',
      trackingMode,
      ...extra,
    });
  }

  function toPoints(run: LocalRun, locations: RawLocation[]): GeoPoint[] {
    const from = (run.segmentStartedAt ?? run.startedAt) - STALE_FIX_TOLERANCE_MS;
    return locations
      .map((location) => ({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude ?? null,
        accuracy: location.coords.accuracy ?? null,
        recordedAt: Math.round(location.timestamp),
        segment: run.segment,
      }))
      .filter((point) => point.recordedAt >= from && isValidCoordinate(point))
      .sort((a, b) => a.recordedAt - b.recordedAt);
  }

  async function rebuildAccumulator(run: LocalRun) {
    accumulator = new RunMetricsAccumulator();
    const points = await deps.store.listPoints(run.localId);
    for (const point of points) accumulator.add(point);
    lastRaw = points.at(-1) ?? null;
  }

  return {
    /**
     * Reconnects to a run left in progress (app reopened, or JS reloaded).
     * If tracking stopped while the app was gone, the run is resumed as paused at
     * its last recorded fix, and `recovered` is flagged for the UI.
     */
    attach: () =>
      serial(async (): Promise<LocalRun | null> => {
        const userId = deps.getUserId();
        const run = await deps.store.getActiveRun();
        if (!run || run.userId !== userId) {
          active = null;
          accumulator = null;
          deps.ui.reset();
          return null;
        }
        active = run;
        await rebuildAccumulator(run);
        deps.coach?.resume(accumulator?.displayDistanceMeters ?? 0);

        if (run.status === 'recording' && !(await deps.tracker.isTracking())) {
          const stoppedAt = run.lastPointAt ?? run.segmentStartedAt ?? run.startedAt;
          const activeMs = run.activeMs + Math.max(0, stoppedAt - (run.segmentStartedAt ?? stoppedAt));
          active = { ...run, status: 'paused', activeMs, segmentStartedAt: null };
          await deps.store.updateRun(run.localId, { status: 'paused', activeMs, segmentStartedAt: null });
          publish({ recovered: true });
        } else {
          trackingMode = trackingMode ?? 'background';
          publish();
        }
        return active;
      }),

    start: () =>
      serial(async (): Promise<StartResult> => {
        if (active) return { ok: true };
        const userId = deps.getUserId();
        if (!userId) return { ok: false, reason: 'unavailable' };

        const permission = await deps.tracker.ensurePermission();
        if (!permission.granted) return { ok: false, reason: permission.reason };
        if (!permission.precise) return { ok: false, reason: 'imprecise' };

        const run = newLocalRun({ localId: deps.uuid(), userId, now: deps.now() });
        await deps.store.createRun(run);
        active = run;
        accumulator = new RunMetricsAccumulator();
        lastRaw = null;
        try {
          trackingMode = await deps.tracker.start();
        } catch {
          await deps.store.deleteRun(run.localId);
          active = null;
          accumulator = null;
          return { ok: false, reason: 'unavailable' };
        }
        deps.coach?.start();
        publish({ recovered: false });
        return { ok: true };
      }),

    /** Entry point for fixes from the background task or the foreground watcher. */
    ingest: (locations: RawLocation[]) =>
      serial(async (): Promise<number> => {
        // In a headless background context there is no in-memory run: read it from the store.
        const run = active ?? (await deps.store.getActiveRun());
        if (!run || run.status !== 'recording') return 0;
        const points = toPoints(run, locations);
        if (points.length === 0) return 0;

        const inserted = await deps.store.insertPoints(run.localId, points);
        const lastPointAt = points[points.length - 1]!.recordedAt;
        await deps.store.updateRun(run.localId, { lastPointAt });
        if (active) {
          active = { ...active, lastPointAt };
          for (const point of points) accumulator?.add(point);
          lastRaw = points[points.length - 1]!;
          publish();
          // Driven by GPS rather than the UI timer, so it keeps working with the screen locked.
          const now = deps.now();
          deps.coach?.update({
            now,
            distanceMeters: accumulator?.displayDistanceMeters ?? 0,
            movingSeconds: (accumulator?.movingTimeMs ?? 0) / 1000,
            currentSpeed: accumulator?.currentSpeedMps(now) ?? null,
          });
        }
        deps.onPointsRecorded?.();
        return inserted;
      }),

    pause: () =>
      serial(async () => {
        if (!active || active.status !== 'recording') return;
        const now = deps.now();
        const activeMs = active.activeMs + Math.max(0, now - (active.segmentStartedAt ?? now));
        active = { ...active, status: 'paused', activeMs, segmentStartedAt: null };
        await deps.store.updateRun(active.localId, { status: 'paused', activeMs, segmentStartedAt: null });
        publish();
      }),

    /** Each resume starts a new segment; distance is never measured across the gap. */
    resume: () =>
      serial(async () => {
        if (!active || active.status !== 'paused') return;
        if (!(await deps.tracker.isTracking())) {
          // Recovered run: tracking was stopped while the app was closed.
          trackingMode = await deps.tracker.start();
        }
        const patch = { status: 'recording' as const, segment: active.segment + 1, segmentStartedAt: deps.now() };
        active = { ...active, ...patch };
        await deps.store.updateRun(active.localId, patch);
        publish({ recovered: false });
      }),

    /** Saves the run locally as finished; uploading happens separately and can be retried forever. */
    finish: () =>
      serial(async (): Promise<string | null> => {
        if (!active) return null;
        const run = active;
        const now = deps.now();
        const activeMs = run.activeMs + (run.status === 'recording' ? Math.max(0, now - (run.segmentStartedAt ?? now)) : 0);
        await deps.tracker.stop().catch(() => undefined);
        deps.coach?.stop();

        const points = await deps.store.listPoints(run.localId);
        const durationSeconds = Math.round(activeMs / 1000);
        const metrics = computeRunMetrics(points, { durationSeconds });
        await deps.store.updateRun(run.localId, {
          status: 'finished',
          completedAt: now,
          activeMs,
          segmentStartedAt: null,
          durationSeconds,
          distanceMeters: metrics.distanceMeters,
          movingSeconds: metrics.movingTimeSeconds,
          nextSyncAt: 0,
        });
        active = null;
        accumulator = null;
        trackingMode = null;
        deps.ui.reset();
        deps.onFinished?.(run.localId);
        return run.localId;
      }),

    /** Throws the current run away (nothing is uploaded). */
    discard: () =>
      serial(async () => {
        if (!active) return;
        await deps.tracker.stop().catch(() => undefined);
        deps.coach?.stop();
        await deps.store.deleteRun(active.localId);
        active = null;
        accumulator = null;
        trackingMode = null;
        deps.ui.reset();
      }),

    /** Re-evaluates time-dependent values (current pace decay, GPS signal age). Call ~1/s from the UI. */
    tick() {
      publish({}, false);
    },

    get activeRun(): LocalRun | null {
      return active;
    },
  };
}

export type RunSession = ReturnType<typeof createRunSession>;
