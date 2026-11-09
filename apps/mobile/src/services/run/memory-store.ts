import type { GeoPoint } from '@next-stride/shared';

import type { LocalPoint, LocalRun, RunLocalStore } from './local-store';

/** In-memory RunLocalStore with the same semantics as the SQLite one. Used by tests. */
export function createMemoryRunStore(): RunLocalStore & { runs: Map<string, LocalRun>; points: LocalPoint[] } {
  type Stored = LocalPoint & { runLocalId: string };
  const runs = new Map<string, LocalRun>();
  let points: Stored[] = [];
  let nextId = 1;
  const byRun = (localId: string) => points.filter((p) => p.runLocalId === localId).sort((a, b) => a.recordedAt - b.recordedAt);

  const store = {
    runs,
    get points() {
      return points;
    },
    async getActiveRun() {
      return [...runs.values()].find((r) => r.status === 'recording' || r.status === 'paused') ?? null;
    },
    async getRun(localId: string) {
      const run = runs.get(localId);
      return run ? { ...run } : null;
    },
    async getRunByServerId(serverId: string) {
      return [...runs.values()].find((r) => r.serverId === serverId) ?? null;
    },
    async createRun(run: LocalRun) {
      runs.set(run.localId, { ...run });
    },
    async updateRun(localId: string, patch: Partial<LocalRun>) {
      const run = runs.get(localId);
      if (run) runs.set(localId, { ...run, ...patch });
    },
    async deleteRun(localId: string) {
      runs.delete(localId);
      points = points.filter((p) => p.runLocalId !== localId);
    },
    async insertPoints(localId: string, incoming: GeoPoint[]) {
      let inserted = 0;
      for (const point of incoming) {
        if (points.some((p) => p.runLocalId === localId && p.recordedAt === point.recordedAt)) continue;
        points.push({ ...point, id: nextId++, synced: false, runLocalId: localId });
        inserted += 1;
      }
      return inserted;
    },
    async listPoints(localId: string) {
      return byRun(localId).map((p) => ({ ...p }));
    },
    async countPoints(localId: string) {
      return byRun(localId).length;
    },
    async listUnsyncedPoints(localId: string, limit: number) {
      return byRun(localId)
        .filter((p) => !p.synced)
        .sort((a, b) => a.id - b.id)
        .slice(0, limit)
        .map((p) => ({ ...p }));
    },
    async markPointsSynced(ids: number[]) {
      const set = new Set(ids);
      points = points.map((p) => (set.has(p.id) ? { ...p, synced: true } : p));
    },
    async markAllPointsUnsynced(localId: string) {
      points = points.map((p) => (p.runLocalId === localId ? { ...p, synced: false } : p));
    },
    async listRunsNeedingSync(userId: string) {
      return [...runs.values()].filter((r) => r.userId === userId && r.status !== 'synced').sort((a, b) => a.startedAt - b.startedAt);
    },
    async listPendingRuns(userId: string) {
      return [...runs.values()].filter((r) => r.userId === userId && r.status === 'finished').sort((a, b) => b.startedAt - a.startedAt);
    },
    async pruneSynced(before: number) {
      const stale = new Set([...runs.values()].filter((r) => r.status === 'synced' && (r.completedAt ?? 0) < before).map((r) => r.localId));
      points = points.filter((p) => !stale.has(p.runLocalId));
    },
  };
  return store as RunLocalStore & { runs: Map<string, LocalRun>; points: LocalPoint[] };
}
