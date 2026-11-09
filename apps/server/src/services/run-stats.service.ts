import type { PeriodTotals, RunStats } from '@next-stride/shared';

import { prisma } from '../lib/prisma';

interface BucketRow {
  bucket: Date;
  runs: number;
  distance: number | null;
  duration: number | null;
}

interface NowRow {
  today: Date;
  week_start: Date;
  month_start: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
const addMonths = (date: Date, months: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));

const empty = (): PeriodTotals => ({ runs: 0, distanceMeters: 0, durationSeconds: 0 });

function toTotals(row: BucketRow | undefined): PeriodTotals {
  if (!row) return empty();
  return {
    runs: Number(row.runs),
    distanceMeters: Math.round(Number(row.distance ?? 0) * 10) / 10,
    durationSeconds: Number(row.duration ?? 0),
  };
}

/**
 * Buckets runs by day / ISO week (Monday) / month in the user's time zone.
 * `started_at` is stored as UTC, so it is converted UTC → tz before truncating.
 * The tz value is passed as a bound parameter (validated as an IANA zone upstream).
 */
async function buckets(userId: string, tz: string, unit: 'day' | 'week' | 'month', since: Date): Promise<BucketRow[]> {
  return prisma.$queryRaw<BucketRow[]>`
    SELECT date_trunc(${unit}, (started_at AT TIME ZONE 'UTC') AT TIME ZONE ${tz}) AS bucket,
           count(*)::int AS runs,
           sum(distance_meters)::float AS distance,
           sum(duration_seconds)::int AS duration
      FROM runs
     WHERE user_id = ${userId}::uuid
       AND status = 'COMPLETED'
       AND (started_at AT TIME ZONE 'UTC') AT TIME ZONE ${tz} >= (${since}::timestamptz AT TIME ZONE 'UTC')
     GROUP BY bucket
     ORDER BY bucket`;
}

export async function getRunStats(userId: string, tz: string): Promise<RunStats> {
  // "Now" in the user's zone, as naive local timestamps (read back as UTC dates).
  const [now] = await prisma.$queryRaw<NowRow[]>`
    SELECT date_trunc('day', now() AT TIME ZONE ${tz}) AS today,
           date_trunc('week', now() AT TIME ZONE ${tz}) AS week_start,
           date_trunc('month', now() AT TIME ZONE ${tz}) AS month_start`;
  const weekStart = now!.week_start;
  const monthStart = now!.month_start;
  const firstWeek = addDays(weekStart, -7 * 7);
  const firstMonth = addMonths(monthStart, -5);

  const completed = { userId, status: 'COMPLETED' as const };
  const [totals, daily, weekly, monthly, longestDistance, longestDuration, fastestPace] = await Promise.all([
    prisma.run.aggregate({
      where: completed,
      _count: { _all: true },
      _sum: { distanceMeters: true, durationSeconds: true, movingTimeSeconds: true },
    }),
    buckets(userId, tz, 'day', weekStart),
    buckets(userId, tz, 'week', firstWeek),
    buckets(userId, tz, 'month', firstMonth),
    prisma.run.findFirst({ where: completed, orderBy: { distanceMeters: 'desc' } }),
    prisma.run.findFirst({ where: completed, orderBy: { durationSeconds: 'desc' } }),
    prisma.run.findFirst({
      where: { ...completed, distanceMeters: { gte: 1000 }, averagePaceSecondsPerKm: { not: null } },
      orderBy: { averagePaceSecondsPerKm: 'asc' },
    }),
  ]);

  const byKey = (rows: BucketRow[]) => new Map(rows.map((row) => [isoDate(row.bucket), row]));
  const dailyMap = byKey(daily);
  const weeklyMap = byKey(weekly);
  const monthlyMap = byKey(monthly);

  const runCount = totals._count._all;
  const distance = totals._sum.distanceMeters ?? 0;
  const moving = totals._sum.movingTimeSeconds ?? 0;

  return {
    timeZone: tz,
    totals: {
      runs: runCount,
      distanceMeters: Math.round(distance * 10) / 10,
      durationSeconds: totals._sum.durationSeconds ?? 0,
      movingTimeSeconds: moving,
    },
    thisWeek: toTotals(weeklyMap.get(isoDate(weekStart))),
    thisMonth: toTotals(monthlyMap.get(isoDate(monthStart))),
    daily: Array.from({ length: 7 }, (_, i) => {
      const date = isoDate(addDays(weekStart, i));
      return { date, ...toTotals(dailyMap.get(date)) };
    }),
    weekly: Array.from({ length: 8 }, (_, i) => {
      const weekStartDate = isoDate(addDays(firstWeek, i * 7));
      return { weekStart: weekStartDate, ...toTotals(weeklyMap.get(weekStartDate)) };
    }),
    monthly: Array.from({ length: 6 }, (_, i) => {
      const month = addMonths(firstMonth, i);
      return { month: isoDate(month).slice(0, 7), ...toTotals(monthlyMap.get(isoDate(month))) };
    }),
    personalBests: {
      longestDistance: longestDistance
        ? { runId: longestDistance.id, distanceMeters: longestDistance.distanceMeters, startedAt: longestDistance.startedAt.toISOString() }
        : null,
      longestDuration: longestDuration
        ? { runId: longestDuration.id, durationSeconds: longestDuration.durationSeconds, startedAt: longestDuration.startedAt.toISOString() }
        : null,
      fastestPace:
        fastestPace?.averagePaceSecondsPerKm != null
          ? { runId: fastestPace.id, paceSecondsPerKm: fastestPace.averagePaceSecondsPerKm, startedAt: fastestPace.startedAt.toISOString() }
          : null,
    },
    averages: {
      distancePerRunMeters: runCount > 0 ? Math.round(distance / runCount) : null,
      paceSecondsPerKm: distance >= 10 && moving > 0 ? Math.round(moving / (distance / 1000)) : null,
    },
  };
}
