import type { GpsSignal } from '@next-stride/shared';
import { create } from 'zustand';

import type { TrackingMode } from '@/services/location/location-tracker';

export type RunPhase = 'idle' | 'recording' | 'paused';

export interface LiveFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: number;
}

/** Live view of the run being recorded. Persistent state lives in the local store (SQLite). */
export interface RunState {
  phase: RunPhase;
  localId: string | null;
  startedAt: number | null;
  /** Active time over completed segments. */
  activeMs: number;
  /** Start of the current segment while recording. */
  segmentStartedAt: number | null;
  /** MEASURED, filtered. */
  distanceMeters: number;
  movingTimeMs: number;
  /** m/s over the last ~20 s; null when stopped or not enough data. */
  currentSpeed: number | null;
  /** Filtered route as [lng, lat] lines, one per segment. */
  route: [number, number][][];
  lastFix: LiveFix | null;
  gps: GpsSignal;
  trackingMode: TrackingMode | null;
  /** True when this run was restored after the app was closed or crashed mid-run. */
  recovered: boolean;
  /** Bumped whenever runs are finished or uploaded, so lists can refresh. */
  syncVersion: number;
  set: (patch: Partial<RunState>) => void;
  reset: () => void;
}

const initial = {
  phase: 'idle' as RunPhase,
  localId: null,
  startedAt: null,
  activeMs: 0,
  segmentStartedAt: null,
  distanceMeters: 0,
  movingTimeMs: 0,
  currentSpeed: null,
  route: [],
  lastFix: null,
  gps: 'searching' as GpsSignal,
  trackingMode: null,
  recovered: false,
};

export const useRunStore = create<RunState>()((set) => ({
  ...initial,
  syncVersion: 0,
  set: (patch) => set(patch),
  reset: () => set(initial),
}));

/** Active (non-paused) elapsed time in ms. */
export function elapsedMs(state: Pick<RunState, 'activeMs' | 'segmentStartedAt'>, now: number): number {
  return state.activeMs + (state.segmentStartedAt ? Math.max(0, now - state.segmentStartedAt) : 0);
}
