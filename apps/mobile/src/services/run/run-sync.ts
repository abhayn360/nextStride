import { ERROR_CODES, MAX_POINTS_PER_BATCH, type RunSummary } from '@next-stride/shared';

import { isApiError } from '@/services/api/client';
import type { RunsApi } from '@/services/api/runs.api';

import type { LocalRun, RunLocalStore } from './local-store';

const BATCH_SIZE = Math.min(500, MAX_POINTS_PER_BATCH);
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 10 * 60 * 1000;

export interface RunSyncDeps {
  store: RunLocalStore;
  api: Pick<RunsApi, 'create' | 'appendPoints' | 'complete'>;
  getUserId: () => string | null;
  now: () => number;
  /** A finished run reached the server. */
  onSynced?: (run: LocalRun, summary: RunSummary) => void;
}

export interface SyncReport {
  synced: string[];
  failed: string[];
  offline: boolean;
}

export function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
}

/**
 * Uploads locally recorded runs. Every step is idempotent, so it can be
 * interrupted at any point (no signal, app killed) and simply run again:
 *  1. create on the server with the run's localId as `clientId` (dedupes retries);
 *  2. upload points in batches, marking each batch only after the server confirms
 *     (the server also skips duplicate timestamps);
 *  3. complete with the device's point count — if the server is missing points
 *     (409 RUN_POINTS_MISSING), re-send everything and try again.
 * Runs still being recorded are streamed too, so less data is ever at risk.
 */
export function createRunSync(deps: RunSyncDeps) {
  let inflight: Promise<SyncReport> | null = null;

  async function uploadPoints(run: LocalRun, serverId: string) {
    for (;;) {
      const batch = await deps.store.listUnsyncedPoints(run.localId, BATCH_SIZE);
      if (batch.length === 0) return;
      try {
        await deps.api.appendPoints(serverId, {
          points: batch.map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude,
            altitude: point.altitude ?? null,
            accuracy: point.accuracy ?? null,
            recordedAt: new Date(point.recordedAt).toISOString(),
            segment: point.segment,
          })),
        });
      } catch (error) {
        // Already completed on the server (an earlier complete succeeded but we never heard back).
        if (isApiError(error) && error.code === ERROR_CODES.RUN_ALREADY_COMPLETED) {
          await deps.store.markPointsSynced(batch.map((point) => point.id));
          continue;
        }
        throw error;
      }
      await deps.store.markPointsSynced(batch.map((point) => point.id));
    }
  }

  async function complete(run: LocalRun, serverId: string): Promise<RunSummary> {
    const input = {
      completedAt: new Date(run.completedAt ?? deps.now()).toISOString(),
      durationSeconds: run.durationSeconds,
      pointCount: await deps.store.countPoints(run.localId),
    };
    try {
      return await deps.api.complete(serverId, input);
    } catch (error) {
      if (isApiError(error) && error.code === ERROR_CODES.RUN_POINTS_MISSING) {
        // Reconcile: the server lost or never received some points. Re-send all (duplicates are skipped).
        await deps.store.markAllPointsUnsynced(run.localId);
        await uploadPoints(run, serverId);
        return deps.api.complete(serverId, input);
      }
      throw error;
    }
  }

  async function syncRun(run: LocalRun): Promise<boolean> {
    let serverId = run.serverId;
    if (!serverId) {
      const created = await deps.api.create({ clientId: run.localId, startedAt: new Date(run.startedAt).toISOString() });
      serverId = created.id;
      await deps.store.updateRun(run.localId, { serverId });
    }

    try {
      await uploadPoints(run, serverId);
      if (run.status !== 'finished') {
        if (run.syncAttempts > 0) await deps.store.updateRun(run.localId, { syncAttempts: 0, nextSyncAt: 0, lastSyncError: null });
        return false;
      }
      const summary = await complete(run, serverId);
      await deps.store.updateRun(run.localId, {
        status: 'synced',
        distanceMeters: summary.distanceMeters,
        movingSeconds: summary.movingTimeSeconds,
        durationSeconds: summary.durationSeconds,
        syncAttempts: 0,
        nextSyncAt: 0,
        lastSyncError: null,
      });
      deps.onSynced?.({ ...run, serverId, status: 'synced' }, summary);
      return true;
    } catch (error) {
      // The server run was deleted (e.g. from another device): start over with a fresh one.
      if (isApiError(error) && error.status === 404) {
        await deps.store.updateRun(run.localId, { serverId: null });
        await deps.store.markAllPointsUnsynced(run.localId);
      }
      throw error;
    }
  }

  async function syncAll(options: { force?: boolean } = {}): Promise<SyncReport> {
    const report: SyncReport = { synced: [], failed: [], offline: false };
    const userId = deps.getUserId();
    if (!userId) return report;

    const runs = await deps.store.listRunsNeedingSync(userId);
    for (const run of runs) {
      if (!options.force && run.nextSyncAt > deps.now()) continue;
      try {
        if (await syncRun(run)) report.synced.push(run.localId);
      } catch (error) {
        const attempts = run.syncAttempts + 1;
        await deps.store.updateRun(run.localId, {
          syncAttempts: attempts,
          nextSyncAt: deps.now() + backoffMs(attempts),
          lastSyncError: isApiError(error) ? error.message : 'Upload failed',
        });
        report.failed.push(run.localId);
        if (isApiError(error) && (error.isConnectivityError || error.status === 401)) {
          // No point trying the rest right now.
          report.offline = error.isConnectivityError;
          break;
        }
      }
    }
    return report;
  }

  return {
    /** Single-flight: concurrent triggers share one pass. */
    syncAll(options: { force?: boolean } = {}): Promise<SyncReport> {
      inflight ??= syncAll(options).finally(() => {
        inflight = null;
      });
      return inflight;
    },
  };
}

export type RunSync = ReturnType<typeof createRunSync>;
