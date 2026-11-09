import type { RunDetail, RunPointDto, RunSummary } from '@next-stride/shared';

import type { Run } from '../generated/prisma/client';

function isRoutePreview(value: unknown): value is [number, number][][] {
  return Array.isArray(value) && value.every((line) => Array.isArray(line));
}

export function toRunSummary(run: Run): RunSummary {
  return {
    id: run.id,
    clientId: run.clientId,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    distanceMeters: run.distanceMeters,
    durationSeconds: run.durationSeconds,
    movingTimeSeconds: run.movingTimeSeconds,
    averagePaceSecondsPerKm: run.averagePaceSecondsPerKm,
    averageSpeed: run.averageSpeed,
    caloriesEstimate: run.caloriesEstimate,
    pointCount: run.pointCount,
    routePreview: isRoutePreview(run.routePreview) ? run.routePreview : [],
  };
}

export function toRunDetail(
  run: Run,
  points: { latitude: number; longitude: number; altitude: number | null; accuracy: number | null; recordedAt: Date; segment: number }[],
  splits: RunDetail['splits'],
): RunDetail {
  const dtos: RunPointDto[] = points.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
    altitude: point.altitude,
    accuracy: point.accuracy,
    recordedAt: point.recordedAt.toISOString(),
    segment: point.segment,
  }));
  return { ...toRunSummary(run), points: dtos, splits };
}

export function encodeCursor(run: { startedAt: Date; id: string }): string {
  return Buffer.from(`${run.startedAt.toISOString()}|${run.id}`).toString('base64url');
}

export function decodeCursor(cursor: string): { startedAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    const startedAt = new Date(iso ?? '');
    if (!id || Number.isNaN(startedAt.getTime())) return null;
    return { startedAt, id };
  } catch {
    return null;
  }
}
