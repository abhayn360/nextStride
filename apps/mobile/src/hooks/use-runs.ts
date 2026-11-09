import {
  computeRunMetrics,
  computeSplits,
  type GeoPoint,
  resolveThresholdPace,
  type RunDetail,
  type RunSummary,
  type Split,
} from '@next-stride/shared';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { Route } from '@/components/map/route-geometry';
import type { RunCardData } from '@/components/run/RunCard';
import { deviceTimeZone } from '@/lib/format';
import { queryClient } from '@/lib/query-client';
import { isApiError, runsApi } from '@/services';
import { type LocalRun, runStore, runSync } from '@/services/run';
import { useAuthStore } from '@/store/auth.store';
import { useRunStore } from '@/store/run.store';

export const runKeys = {
  all: ['runs'] as const,
  stats: (tz: string) => ['runs', 'stats', tz] as const,
  progress: (tz: string) => ['runs', 'progress', tz] as const,
  list: ['runs', 'list'] as const,
  pending: (userId: string | null, version: number) => ['runs', 'pending', userId, version] as const,
  detail: (id: string) => ['runs', 'detail', id] as const,
};

const toRoute = (segments: GeoPoint[][]): Route =>
  segments.map((segment) => segment.map((p) => [p.longitude, p.latitude] as [number, number]));

export function useRunStats() {
  const tz = deviceTimeZone();
  return useQuery({ queryKey: runKeys.stats(tz), queryFn: () => runsApi.stats(tz) });
}

export function useRunProgress() {
  const tz = deviceTimeZone();
  return useQuery({ queryKey: runKeys.progress(tz), queryFn: () => runsApi.progress(tz) });
}

/** The runner's threshold pace: their own history once there is enough, otherwise their stated experience. */
export function useThresholdPace() {
  const experience = useAuthStore((state) => state.user?.profile.runningExperience ?? null);
  const stats = useRunStats();
  return {
    threshold: resolveThresholdPace({ historyPaceSecondsPerKm: stats.data?.zoneReferencePaceSecondsPerKm, experience }),
    isLoading: stats.isLoading,
  };
}

export function useRunHistory() {
  return useInfiniteQuery({
    queryKey: runKeys.list,
    queryFn: ({ pageParam }) => runsApi.list({ limit: 20, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function summaryToCard(run: RunSummary): RunCardData {
  return {
    startedAt: run.startedAt,
    distanceMeters: run.distanceMeters,
    durationSeconds: run.durationSeconds,
    averagePaceSecondsPerKm: run.averagePaceSecondsPerKm,
    route: run.routePreview,
  };
}

export interface PendingRun extends RunCardData {
  localId: string;
  lastSyncError: string | null;
}

/** Finished runs saved on this device that haven't reached the server yet. */
export function usePendingRuns() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const version = useRunStore((state) => state.syncVersion);
  return useQuery({
    queryKey: runKeys.pending(userId, version),
    enabled: userId !== null,
    queryFn: async (): Promise<PendingRun[]> => {
      const runs = await runStore.listPendingRuns(userId!);
      return Promise.all(
        runs.map(async (run) => {
          const metrics = computeRunMetrics(await runStore.listPoints(run.localId), { durationSeconds: run.durationSeconds });
          return {
            localId: run.localId,
            lastSyncError: run.lastSyncError,
            pending: true,
            startedAt: run.startedAt,
            distanceMeters: run.distanceMeters,
            durationSeconds: run.durationSeconds,
            averagePaceSecondsPerKm: metrics.averagePaceSecondsPerKm,
            route: toRoute(metrics.accumulator.segments),
          };
        }),
      );
    },
  });
}

/** One shape for a run whether it comes from the server or from this device. */
export interface ActivityView {
  serverId: string | null;
  localId: string | null;
  source: 'server' | 'device';
  synced: boolean;
  startedAt: number;
  completedAt: number | null;
  distanceMeters: number;
  durationSeconds: number;
  movingTimeSeconds: number;
  averagePaceSecondsPerKm: number | null;
  averageSpeed: number | null;
  caloriesEstimate: number | null;
  pointCount: number;
  route: Route;
  segments: GeoPoint[][];
  splits: Split[];
}

function fromServer(detail: RunDetail, localId: string | null): ActivityView {
  const points: GeoPoint[] = detail.points.map((p) => ({ ...p, recordedAt: Date.parse(p.recordedAt) }));
  const metrics = computeRunMetrics(points, { durationSeconds: detail.durationSeconds });
  return {
    serverId: detail.id,
    localId,
    source: 'server',
    synced: true,
    startedAt: Date.parse(detail.startedAt),
    completedAt: detail.completedAt ? Date.parse(detail.completedAt) : null,
    distanceMeters: detail.distanceMeters,
    durationSeconds: detail.durationSeconds,
    movingTimeSeconds: detail.movingTimeSeconds,
    averagePaceSecondsPerKm: detail.averagePaceSecondsPerKm,
    averageSpeed: detail.averageSpeed,
    caloriesEstimate: detail.caloriesEstimate,
    pointCount: detail.pointCount,
    route: toRoute(metrics.accumulator.segments),
    segments: metrics.accumulator.segments,
    splits: detail.splits,
  };
}

async function fromDevice(run: LocalRun, weightKg: number | null): Promise<ActivityView | null> {
  const points = await runStore.listPoints(run.localId);
  if (points.length === 0 && run.status === 'synced') return null; // pruned: server copy only
  const metrics = computeRunMetrics(points, { durationSeconds: run.durationSeconds, weightKg });
  return {
    serverId: run.serverId,
    localId: run.localId,
    source: 'device',
    synced: run.status === 'synced',
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    distanceMeters: metrics.distanceMeters,
    durationSeconds: run.durationSeconds,
    movingTimeSeconds: metrics.movingTimeSeconds,
    averagePaceSecondsPerKm: metrics.averagePaceSecondsPerKm,
    averageSpeed: metrics.averageSpeed,
    caloriesEstimate: metrics.caloriesEstimate,
    pointCount: points.length,
    route: toRoute(metrics.accumulator.segments),
    segments: metrics.accumulator.segments,
    splits: computeSplits(metrics.accumulator.segments),
  };
}

/**
 * `id` may be a device id (run just finished / not uploaded) or a server id.
 * Unsynced runs are read from the device; synced ones from the server, falling
 * back to the device copy when offline.
 */
export function useActivity(id: string) {
  const weightKg = useAuthStore((state) => state.user?.profile.weightKg ?? null);
  return useQuery({
    queryKey: runKeys.detail(id),
    queryFn: async (): Promise<ActivityView> => {
      const local = (await runStore.getRun(id)) ?? (await runStore.getRunByServerId(id));
      if (local && local.status !== 'synced') {
        const view = await fromDevice(local, weightKg);
        if (view) return view;
      }
      const serverId = local?.serverId ?? id;
      try {
        return fromServer(await runsApi.get(serverId), local?.localId ?? null);
      } catch (error) {
        if (local && isApiError(error) && error.isConnectivityError) {
          const view = await fromDevice(local, weightKg);
          if (view) return view;
        }
        throw error;
      }
    },
  });
}

export function useDeleteActivity() {
  return useMutation({
    mutationFn: async (activity: Pick<ActivityView, 'serverId' | 'localId' | 'synced'>) => {
      if (activity.serverId) await runsApi.remove(activity.serverId).catch((error: unknown) => {
        // Already gone on the server is fine.
        if (!(isApiError(error) && error.status === 404)) throw error;
      });
      if (activity.localId) await runStore.deleteRun(activity.localId);
    },
    onSuccess: () => {
      useRunStore.setState((state) => ({ syncVersion: state.syncVersion + 1 }));
      void queryClient.invalidateQueries({ queryKey: runKeys.all });
    },
  });
}

const PRUNE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Keeps uploads moving: on launch, when the app returns to the foreground,
 * when connectivity comes back, and every 30 s while open.
 */
export function useRunSyncTriggers() {
  useEffect(() => {
    const sync = (force = false) => void runSync.syncAll({ force }).catch(() => undefined);
    sync(true);
    void runStore.pruneSynced(Date.now() - PRUNE_AFTER_MS).catch(() => undefined);

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    const network = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) sync(true);
    });
    const interval = setInterval(() => sync(), 30_000);
    return () => {
      appState.remove();
      network.remove();
      clearInterval(interval);
    };
  }, []);
}
