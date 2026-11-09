import { z } from 'zod';

import type { Split } from './run-metrics';

export const RUN_STATUSES = ['IN_PROGRESS', 'COMPLETED'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** Max points per upload request. Clients batch larger runs. */
export const MAX_POINTS_PER_BATCH = 1000;
/** Upper bound for a single run's active duration (sanity limit). */
export const MAX_RUN_DURATION_SECONDS = 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/**
 * POST /api/runs — `clientId` is generated on the device when the run starts and
 * doubles as the idempotency key: retrying the same request returns the same run.
 */
export const createRunSchema = z.object({
  clientId: z.uuid('clientId must be a UUID'),
  startedAt: z.iso.datetime({ offset: true, error: 'startedAt must be an ISO-8601 date-time' }),
});
export type CreateRunInput = z.infer<typeof createRunSchema>;

export const runPointInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().min(-1000).max(10000).nullable().optional(),
  accuracy: z.number().min(0).max(10000).nullable().optional(),
  recordedAt: z.iso.datetime({ offset: true }),
  /** Increments each time the run is resumed after a pause. */
  segment: z.int().min(0).max(10000),
});
export type RunPointInput = z.infer<typeof runPointInputSchema>;

/** POST /api/runs/:id/points — duplicates (same recordedAt) are ignored, so retries are safe. */
export const appendRunPointsSchema = z.object({
  points: z.array(runPointInputSchema).min(1).max(MAX_POINTS_PER_BATCH),
});
export type AppendRunPointsInput = z.infer<typeof appendRunPointsSchema>;

/**
 * POST /api/runs/:id/complete — `pointCount` is how many points the device recorded;
 * the server refuses to finalise until it has them all (reconciliation).
 */
export const completeRunSchema = z.object({
  completedAt: z.iso.datetime({ offset: true }),
  /** Active time measured by the device clock, excluding pauses. */
  durationSeconds: z.int().min(0).max(MAX_RUN_DURATION_SECONDS),
  pointCount: z.int().min(0),
});
export type CompleteRunInput = z.infer<typeof completeRunSchema>;

export const listRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});
export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>;

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** GET /api/runs/stats — weeks and months are computed in the caller's time zone. */
export const runStatsQuerySchema = z.object({
  tz: z.string().max(64).refine(isValidTimeZone, 'Unknown time zone').default('UTC'),
});
export type RunStatsQuery = z.infer<typeof runStatsQuerySchema>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export interface RunSummary {
  id: string;
  clientId: string;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  /** MEASURED from filtered GPS. */
  distanceMeters: number;
  /** MEASURED active time, excluding pauses. */
  durationSeconds: number;
  /** MEASURED time in motion. */
  movingTimeSeconds: number;
  averagePaceSecondsPerKm: number | null;
  /** m/s */
  averageSpeed: number | null;
  /** ESTIMATE. */
  caloriesEstimate: number | null;
  pointCount: number;
  /** Downsampled [lng, lat] lines per segment for list thumbnails. */
  routePreview: [number, number][][];
}

export interface RunPointDto {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  recordedAt: string;
  segment: number;
}

export interface RunDetail extends RunSummary {
  points: RunPointDto[];
  splits: Split[];
}

export interface RunPage {
  items: RunSummary[];
  nextCursor: string | null;
}

export interface AppendPointsResponse {
  received: number;
  stored: number;
  duplicates: number;
  totalPoints: number;
}

export interface PeriodTotals {
  runs: number;
  distanceMeters: number;
  durationSeconds: number;
}

export interface RunStats {
  timeZone: string;
  totals: PeriodTotals & { movingTimeSeconds: number };
  thisWeek: PeriodTotals;
  thisMonth: PeriodTotals;
  /** Monday → Sunday of the current week. */
  daily: (PeriodTotals & { date: string })[];
  /** Last 8 weeks, oldest first; `weekStart` is a Monday (YYYY-MM-DD). */
  weekly: (PeriodTotals & { weekStart: string })[];
  /** Last 6 months, oldest first (YYYY-MM). */
  monthly: (PeriodTotals & { month: string })[];
  personalBests: {
    longestDistance: { runId: string; distanceMeters: number; startedAt: string } | null;
    longestDuration: { runId: string; durationSeconds: number; startedAt: string } | null;
    /** Among runs of at least 1 km. */
    fastestPace: { runId: string; paceSecondsPerKm: number; startedAt: string } | null;
  };
  averages: {
    distancePerRunMeters: number | null;
    paceSecondsPerKm: number | null;
  };
  /** Threshold pace derived from recent runs; null until there are enough of them. */
  zoneReferencePaceSecondsPerKm: number | null;
}
