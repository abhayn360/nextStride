import type { GeoPoint } from '@next-stride/shared';
import * as SQLite from 'expo-sqlite';

import type { LocalPoint, LocalRun, RunLocalStore } from './local-store';

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS runs (
  local_id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  server_id TEXT,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  active_ms INTEGER NOT NULL DEFAULT 0,
  segment INTEGER NOT NULL DEFAULT 0,
  segment_started_at INTEGER,
  last_point_at INTEGER,
  distance_meters REAL NOT NULL DEFAULT 0,
  moving_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  sync_attempts INTEGER NOT NULL DEFAULT 0,
  next_sync_at INTEGER NOT NULL DEFAULT 0,
  last_sync_error TEXT
);
CREATE INDEX IF NOT EXISTS runs_user_status ON runs (user_id, status);
CREATE INDEX IF NOT EXISTS runs_server_id ON runs (server_id);
CREATE TABLE IF NOT EXISTS run_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_local_id TEXT NOT NULL REFERENCES runs(local_id) ON DELETE CASCADE,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  altitude REAL,
  accuracy REAL,
  recorded_at INTEGER NOT NULL,
  segment INTEGER NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0,
  UNIQUE (run_local_id, recorded_at)
);
CREATE INDEX IF NOT EXISTS run_points_unsynced ON run_points (run_local_id, synced, id);
`;

interface RunRow {
  local_id: string;
  user_id: string;
  server_id: string | null;
  status: LocalRun['status'];
  started_at: number;
  completed_at: number | null;
  active_ms: number;
  segment: number;
  segment_started_at: number | null;
  last_point_at: number | null;
  distance_meters: number;
  moving_seconds: number;
  duration_seconds: number;
  sync_attempts: number;
  next_sync_at: number;
  last_sync_error: string | null;
}

interface PointRow {
  id: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  recorded_at: number;
  segment: number;
  synced: number;
}

const COLUMNS: Record<keyof Omit<LocalRun, 'localId'>, keyof RunRow> = {
  userId: 'user_id',
  serverId: 'server_id',
  status: 'status',
  startedAt: 'started_at',
  completedAt: 'completed_at',
  activeMs: 'active_ms',
  segment: 'segment',
  segmentStartedAt: 'segment_started_at',
  lastPointAt: 'last_point_at',
  distanceMeters: 'distance_meters',
  movingSeconds: 'moving_seconds',
  durationSeconds: 'duration_seconds',
  syncAttempts: 'sync_attempts',
  nextSyncAt: 'next_sync_at',
  lastSyncError: 'last_sync_error',
};

const toRun = (row: RunRow): LocalRun => ({
  localId: row.local_id,
  userId: row.user_id,
  serverId: row.server_id,
  status: row.status,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  activeMs: row.active_ms,
  segment: row.segment,
  segmentStartedAt: row.segment_started_at,
  lastPointAt: row.last_point_at,
  distanceMeters: row.distance_meters,
  movingSeconds: row.moving_seconds,
  durationSeconds: row.duration_seconds,
  syncAttempts: row.sync_attempts,
  nextSyncAt: row.next_sync_at,
  lastSyncError: row.last_sync_error,
});

const toPoint = (row: PointRow): LocalPoint => ({
  id: row.id,
  latitude: row.latitude,
  longitude: row.longitude,
  altitude: row.altitude,
  accuracy: row.accuracy,
  recordedAt: row.recorded_at,
  segment: row.segment,
  synced: row.synced === 1,
});

let database: Promise<SQLite.SQLiteDatabase> | null = null;

/** Opened lazily so it also works inside the headless background location task. */
function db(): Promise<SQLite.SQLiteDatabase> {
  database ??= (async () => {
    const instance = await SQLite.openDatabaseAsync('next-stride-runs.db');
    await instance.execAsync('PRAGMA foreign_keys = ON;');
    await instance.execAsync(SCHEMA);
    return instance;
  })();
  return database;
}

export const sqliteRunStore: RunLocalStore = {
  async getActiveRun() {
    const row = await (await db()).getFirstAsync<RunRow>(
      "SELECT * FROM runs WHERE status IN ('recording', 'paused') ORDER BY started_at DESC LIMIT 1",
    );
    return row ? toRun(row) : null;
  },

  async getRun(localId) {
    const row = await (await db()).getFirstAsync<RunRow>('SELECT * FROM runs WHERE local_id = ?', localId);
    return row ? toRun(row) : null;
  },

  async getRunByServerId(serverId) {
    const row = await (await db()).getFirstAsync<RunRow>('SELECT * FROM runs WHERE server_id = ?', serverId);
    return row ? toRun(row) : null;
  },

  async createRun(run) {
    const keys = Object.keys(COLUMNS) as (keyof typeof COLUMNS)[];
    const columns = ['local_id', ...keys.map((key) => COLUMNS[key])];
    await (await db()).runAsync(
      `INSERT INTO runs (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      [run.localId, ...keys.map((key) => run[key])],
    );
  },

  async updateRun(localId, patch) {
    const keys = (Object.keys(patch) as (keyof typeof COLUMNS)[]).filter((key) => key in COLUMNS);
    if (keys.length === 0) return;
    await (await db()).runAsync(
      `UPDATE runs SET ${keys.map((key) => `${COLUMNS[key]} = ?`).join(', ')} WHERE local_id = ?`,
      [...keys.map((key) => patch[key] ?? null), localId],
    );
  },

  async deleteRun(localId) {
    const database = await db();
    await database.withTransactionAsync(async () => {
      await database.runAsync('DELETE FROM run_points WHERE run_local_id = ?', localId);
      await database.runAsync('DELETE FROM runs WHERE local_id = ?', localId);
    });
  },

  async insertPoints(localId, points: GeoPoint[]) {
    if (points.length === 0) return 0;
    const database = await db();
    let inserted = 0;
    await database.withTransactionAsync(async () => {
      for (const point of points) {
        const result = await database.runAsync(
          `INSERT OR IGNORE INTO run_points (run_local_id, latitude, longitude, altitude, accuracy, recorded_at, segment)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [localId, point.latitude, point.longitude, point.altitude ?? null, point.accuracy ?? null, point.recordedAt, point.segment],
        );
        inserted += result.changes;
      }
    });
    return inserted;
  },

  async listPoints(localId) {
    const rows = await (await db()).getAllAsync<PointRow>(
      'SELECT * FROM run_points WHERE run_local_id = ? ORDER BY recorded_at',
      localId,
    );
    return rows.map(toPoint);
  },

  async countPoints(localId) {
    const row = await (await db()).getFirstAsync<{ count: number }>(
      'SELECT count(*) AS count FROM run_points WHERE run_local_id = ?',
      localId,
    );
    return row?.count ?? 0;
  },

  async listUnsyncedPoints(localId, limit) {
    const rows = await (await db()).getAllAsync<PointRow>(
      'SELECT * FROM run_points WHERE run_local_id = ? AND synced = 0 ORDER BY id LIMIT ?',
      [localId, limit],
    );
    return rows.map(toPoint);
  },

  async markPointsSynced(ids) {
    if (ids.length === 0) return;
    await (await db()).runAsync(`UPDATE run_points SET synced = 1 WHERE id IN (${ids.map(() => '?').join(', ')})`, ids);
  },

  async markAllPointsUnsynced(localId) {
    await (await db()).runAsync('UPDATE run_points SET synced = 0 WHERE run_local_id = ?', localId);
  },

  async listRunsNeedingSync(userId) {
    const rows = await (await db()).getAllAsync<RunRow>(
      "SELECT * FROM runs WHERE user_id = ? AND status != 'synced' ORDER BY started_at",
      userId,
    );
    return rows.map(toRun);
  },

  async listPendingRuns(userId) {
    const rows = await (await db()).getAllAsync<RunRow>(
      "SELECT * FROM runs WHERE user_id = ? AND status = 'finished' ORDER BY started_at DESC",
      userId,
    );
    return rows.map(toRun);
  },

  async pruneSynced(before) {
    await (await db()).runAsync(
      `DELETE FROM run_points WHERE run_local_id IN
         (SELECT local_id FROM runs WHERE status = 'synced' AND completed_at < ?)`,
      before,
    );
  },
};
