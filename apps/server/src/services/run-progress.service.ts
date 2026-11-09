import { computeProgress, type RunProgress } from '@next-stride/shared';

import { prisma } from '../lib/prisma';

interface ProgressRow {
  id: string;
  started_at: Date;
  local_date: string;
  local_hour: number;
  distance_meters: number;
  duration_seconds: number;
  moving_time_seconds: number;
  average_pace_seconds_per_km: number | null;
}

/**
 * Progress is replayed from completed runs on every read rather than stored, so
 * it can never disagree with the runner's history.
 * The tz value is passed as a bound parameter (validated as an IANA zone upstream).
 */
export async function getRunProgress(userId: string, tz: string): Promise<RunProgress> {
  const [rows, [now]] = await Promise.all([
    prisma.$queryRaw<ProgressRow[]>`
      SELECT id,
             started_at,
             to_char((started_at AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS local_date,
             extract(hour FROM (started_at AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::int AS local_hour,
             distance_meters,
             duration_seconds,
             moving_time_seconds,
             average_pace_seconds_per_km
        FROM runs
       WHERE user_id = ${userId}::uuid
         AND status = 'COMPLETED'
       ORDER BY started_at, id`,
    prisma.$queryRaw<{ today: string }[]>`SELECT to_char(now() AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS today`,
  ]);

  return computeProgress(
    rows.map((row) => ({
      id: row.id,
      startedAt: row.started_at.toISOString(),
      localDate: row.local_date,
      localHour: Number(row.local_hour),
      distanceMeters: row.distance_meters,
      durationSeconds: row.duration_seconds,
      movingTimeSeconds: row.moving_time_seconds,
      averagePaceSecondsPerKm: row.average_pace_seconds_per_km,
    })),
    { today: now!.today, timeZone: tz },
  );
}
