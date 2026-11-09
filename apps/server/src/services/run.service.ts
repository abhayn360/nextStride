import {
  type AppendPointsResponse,
  type AppendRunPointsInput,
  type CompleteRunInput,
  computeRunMetrics,
  computeSplits,
  type CreateRunInput,
  type GeoPoint,
  type RunDetail,
  type RunPage,
  routePreview,
} from '@next-stride/shared';

import { Prisma, type Run } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';
import { decodeCursor, encodeCursor, toRunDetail, toRunSummary } from '../mappers/run.mapper';
import { runRepository } from '../repositories/run.repository';
import { Errors } from '../utils/errors';

/** Tolerances for device clocks that drift from the server's. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const POINT_BEFORE_START_MS = 60 * 1000;

async function requireOwned(userId: string, runId: string): Promise<Run> {
  const run = await runRepository.findOwned(userId, runId);
  if (!run) throw Errors.notFound('Run not found');
  return run;
}

/**
 * Idempotent: the device's `clientId` identifies the run, so a retried request
 * (e.g. the response was lost offline) returns the existing run instead of a duplicate.
 */
async function create(userId: string, input: CreateRunInput): Promise<{ run: Run; created: boolean }> {
  const existing = await runRepository.findByClientId(userId, input.clientId);
  if (existing) return { run: existing, created: false };

  const startedAt = new Date(input.startedAt);
  if (startedAt.getTime() > Date.now() + CLOCK_SKEW_MS) {
    throw Errors.validation({ startedAt: ['startedAt is in the future'] });
  }
  try {
    return { run: await runRepository.create({ userId, clientId: input.clientId, startedAt }), created: true };
  } catch (error) {
    // Two identical requests raced; the other one created it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await runRepository.findByClientId(userId, input.clientId);
      if (raced) return { run: raced, created: false };
    }
    throw error;
  }
}

/** Duplicate points (same timestamp) are skipped, so re-sending a batch after a failure is safe. */
async function appendPoints(userId: string, runId: string, input: AppendRunPointsInput): Promise<AppendPointsResponse> {
  const run = await requireOwned(userId, runId);
  if (run.status !== 'IN_PROGRESS') throw Errors.runAlreadyCompleted();

  const earliest = run.startedAt.getTime() - POINT_BEFORE_START_MS;
  const latest = Date.now() + CLOCK_SKEW_MS;
  const fields: Record<string, string[]> = {};
  const rows = input.points.map((point, index) => {
    const recordedAt = new Date(point.recordedAt);
    if (recordedAt.getTime() < earliest || recordedAt.getTime() > latest) {
      fields[`points.${index}.recordedAt`] = ['Point is outside the run time window'];
    }
    return {
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: point.altitude ?? null,
      accuracy: point.accuracy ?? null,
      segment: point.segment,
      recordedAt,
    };
  });
  if (Object.keys(fields).length > 0) throw Errors.validation(fields, 'Some points are invalid');

  const { stored, total } = await prisma.$transaction(async (tx) => {
    const inserted = await runRepository.insertPoints(run.id, rows, tx);
    const count = await runRepository.countPoints(run.id, tx);
    await runRepository.setPointCount(run.id, count, tx);
    return { stored: inserted, total: count };
  });

  return { received: rows.length, stored, duplicates: rows.length - stored, totalPoints: total };
}

/**
 * Finalises a run and computes its metrics from the stored points.
 *  - Idempotent: completing an already-completed run returns it unchanged.
 *  - Reconciliation: refuses (409 RUN_POINTS_MISSING) until the server holds every
 *    point the device recorded, so an interrupted upload can't silently truncate a run.
 */
async function complete(userId: string, runId: string, input: CompleteRunInput, weightKg: number | null) {
  const run = await requireOwned(userId, runId);
  if (run.status === 'COMPLETED') return run;

  const completedAt = new Date(input.completedAt);
  const wallSeconds = (completedAt.getTime() - run.startedAt.getTime()) / 1000;
  if (wallSeconds < 0) throw Errors.validation({ completedAt: ['completedAt is before the run started'] });
  if (completedAt.getTime() > Date.now() + CLOCK_SKEW_MS) {
    throw Errors.validation({ completedAt: ['completedAt is in the future'] });
  }

  const storedPoints = await runRepository.countPoints(run.id);
  if (storedPoints < input.pointCount) throw Errors.runPointsMissing(storedPoints, input.pointCount);

  const rows = await runRepository.listPoints(run.id);
  const points: GeoPoint[] = rows.map((row) => ({ ...row, recordedAt: row.recordedAt.getTime() }));
  // Active time can't exceed the wall-clock span of the run.
  const durationSeconds = Math.min(input.durationSeconds, Math.ceil(wallSeconds));
  const metrics = computeRunMetrics(points, { durationSeconds, weightKg });

  await runRepository.markCompleted(run.id, {
    completedAt,
    durationSeconds: metrics.durationSeconds,
    movingTimeSeconds: metrics.movingTimeSeconds,
    distanceMeters: metrics.distanceMeters,
    averagePaceSecondsPerKm: metrics.averagePaceSecondsPerKm,
    averageSpeed: metrics.averageSpeed,
    caloriesEstimate: metrics.caloriesEstimate,
    pointCount: storedPoints,
    routePreview: routePreview(metrics.accumulator.segments),
  });
  // Whether we or a concurrent request completed it, return the stored result.
  return requireOwned(userId, runId);
}

async function list(userId: string, limit: number, cursorParam: string | undefined): Promise<RunPage> {
  const cursor = cursorParam ? decodeCursor(cursorParam) : null;
  if (cursorParam && !cursor) throw Errors.validation({ cursor: ['Invalid cursor'] });

  const rows = await runRepository.listCompleted(userId, limit, cursor);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map(toRunSummary),
    nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
  };
}

async function detail(userId: string, runId: string): Promise<RunDetail> {
  const run = await requireOwned(userId, runId);
  const rows = await runRepository.listPoints(run.id);
  const points: GeoPoint[] = rows.map((row) => ({ ...row, recordedAt: row.recordedAt.getTime() }));
  const metrics = computeRunMetrics(points, { durationSeconds: run.durationSeconds });
  return toRunDetail(run, rows, computeSplits(metrics.accumulator.segments));
}

async function remove(userId: string, runId: string): Promise<void> {
  if (!(await runRepository.deleteOwned(userId, runId))) throw Errors.notFound('Run not found');
}

export const runService = { create, appendPoints, complete, list, detail, remove };
