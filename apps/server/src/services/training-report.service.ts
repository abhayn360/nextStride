import {
  computePaceZones,
  computeRunMetrics,
  computeTrainingReport,
  type GeoPoint,
  isRewardedRun,
  REPORT_LOOKBACK_DAYS,
  resolveThresholdPace,
  type TrainingReport,
  type ZoneSeconds,
} from '@next-stride/shared';

import { prisma } from '../lib/prisma';
import { runRepository } from '../repositories/run.repository';
import { userRepository } from '../repositories/user.repository';
import { zoneReferencePace } from './run-stats.service';

interface ReportRow {
  id: string;
  local_date: string;
  distance_meters: number;
  duration_seconds: number;
  average_pace_seconds_per_km: number | null;
  zone_seconds: unknown;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY_ZONES: ZoneSeconds = [0, 0, 0, 0, 0];

function isZoneSeconds(value: unknown): value is ZoneSeconds {
  return Array.isArray(value) && value.length === 5 && value.every((item) => typeof item === 'number');
}

async function computeAndCacheZones(row: ReportRow, thresholdPace: number): Promise<ZoneSeconds> {
  const points = await runRepository.listPoints(row.id);
  const geoPoints: GeoPoint[] = points.map((point) => ({ ...point, recordedAt: point.recordedAt.getTime() }));
  const { accumulator } = computeRunMetrics(geoPoints, { durationSeconds: row.duration_seconds });
  const zoneSeconds = computePaceZones(accumulator.segments, thresholdPace).zones.map((zone) => zone.seconds) as ZoneSeconds;
  await prisma.run.update({ where: { id: row.id }, data: { zoneSeconds } });
  return zoneSeconds;
}

/**
 * Zones need every GPS point, too much to re-read on each request, so each run's
 * zone times are cached the first time a report needs them. That also keeps old
 * weeks stable as the runner's threshold pace improves.
 * The tz value is passed as a bound parameter (validated as an IANA zone upstream).
 */
export async function getTrainingReport(userId: string, tz: string): Promise<TrainingReport> {
  // One spare day so no time zone can cut off the oldest day in the report.
  const since = new Date(Date.now() - (REPORT_LOOKBACK_DAYS + 1) * DAY_MS);
  const [rows, [now]] = await Promise.all([
    prisma.$queryRaw<ReportRow[]>`
      SELECT id,
             to_char((started_at AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS local_date,
             distance_meters,
             duration_seconds,
             average_pace_seconds_per_km,
             zone_seconds
        FROM runs
       WHERE user_id = ${userId}::uuid
         AND status = 'COMPLETED'
         AND started_at >= (${since}::timestamptz AT TIME ZONE 'UTC')
       ORDER BY started_at, id`,
    prisma.$queryRaw<{ today: string }[]>`SELECT to_char(now() AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS today`,
  ]);

  const toInput = (row: ReportRow) => ({
    distanceMeters: row.distance_meters,
    averagePaceSecondsPerKm: row.average_pace_seconds_per_km,
  });
  const needsZones = rows.filter((row) => !isZoneSeconds(row.zone_seconds) && isRewardedRun(toInput(row)));
  const computed = new Map<string, ZoneSeconds>();
  if (needsZones.length > 0) {
    const [history, user] = await Promise.all([zoneReferencePace(userId), userRepository.findById(userId)]);
    const threshold = resolveThresholdPace({
      historyPaceSecondsPerKm: history,
      experience: user?.profile?.runningExperience ?? null,
    }).paceSecondsPerKm;
    for (const row of needsZones) computed.set(row.id, await computeAndCacheZones(row, threshold));
  }

  return computeTrainingReport(
    rows.map((row) => ({
      ...toInput(row),
      localDate: row.local_date,
      durationSeconds: row.duration_seconds,
      zoneSeconds: computed.get(row.id) ?? (isZoneSeconds(row.zone_seconds) ? row.zone_seconds : EMPTY_ZONES),
    })),
    { today: now!.today, timeZone: tz },
  );
}
