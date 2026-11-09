import type { GeoPoint } from '@next-stride/shared';

/**
 * Lifecycle of a run on the device:
 *   recording ⇄ paused → finished (waiting to upload) → synced
 * Points are written here first, so a run survives crashes, restarts and
 * having no connection at all.
 */
export type LocalRunStatus = 'recording' | 'paused' | 'finished' | 'synced';

export interface LocalRun {
  /** Device-generated UUID; also the server-side idempotency key (`clientId`). */
  localId: string;
  userId: string;
  serverId: string | null;
  status: LocalRunStatus;
  startedAt: number;
  completedAt: number | null;
  /** Active time accumulated over finished segments (excludes pauses). */
  activeMs: number;
  segment: number;
  /** Start of the current recording segment; null while paused or finished. */
  segmentStartedAt: number | null;
  lastPointAt: number | null;
  /** Locally computed values, replaced by the server's once synced. */
  distanceMeters: number;
  movingSeconds: number;
  durationSeconds: number;
  syncAttempts: number;
  nextSyncAt: number;
  lastSyncError: string | null;
}

export interface LocalPoint extends GeoPoint {
  id: number;
  synced: boolean;
}

export interface RunLocalStore {
  /** The run currently being recorded or paused, for any user. */
  getActiveRun(): Promise<LocalRun | null>;
  getRun(localId: string): Promise<LocalRun | null>;
  getRunByServerId(serverId: string): Promise<LocalRun | null>;
  createRun(run: LocalRun): Promise<void>;
  updateRun(localId: string, patch: Partial<Omit<LocalRun, 'localId'>>): Promise<void>;
  deleteRun(localId: string): Promise<void>;
  /** Inserts points, ignoring ones already stored for the same timestamp. Returns how many were new. */
  insertPoints(localId: string, points: GeoPoint[]): Promise<number>;
  listPoints(localId: string): Promise<LocalPoint[]>;
  countPoints(localId: string): Promise<number>;
  listUnsyncedPoints(localId: string, limit: number): Promise<LocalPoint[]>;
  markPointsSynced(ids: number[]): Promise<void>;
  markAllPointsUnsynced(localId: string): Promise<void>;
  /** Runs of this user that still have something to upload. */
  listRunsNeedingSync(userId: string): Promise<LocalRun[]>;
  /** Finished runs of this user that are not on the server yet (shown as "waiting to upload"). */
  listPendingRuns(userId: string): Promise<LocalRun[]>;
  /** Frees space: drops points of runs synced before `before` (the server keeps them). */
  pruneSynced(before: number): Promise<void>;
}

export function newLocalRun(input: { localId: string; userId: string; now: number }): LocalRun {
  return {
    localId: input.localId,
    userId: input.userId,
    serverId: null,
    status: 'recording',
    startedAt: input.now,
    completedAt: null,
    activeMs: 0,
    segment: 0,
    segmentStartedAt: input.now,
    lastPointAt: null,
    distanceMeters: 0,
    movingSeconds: 0,
    durationSeconds: 0,
    syncAttempts: 0,
    nextSyncAt: 0,
    lastSyncError: null,
  };
}
