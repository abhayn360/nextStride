import { describe, expect, it } from 'vitest';

import {
  computeRunMetrics,
  computeSplits,
  estimateCalories,
  type GeoPoint,
  gpsSignalStatus,
  haversineMeters,
  isValidCoordinate,
  paceSecondsPerKm,
  routePreview,
  RunMetricsAccumulator,
  speedToPace,
} from './run-metrics';

/** ~1 m of latitude in degrees. */
const M = 1 / 111_195;
const T0 = Date.UTC(2026, 10, 6, 7, 0, 0);

/** A straight run heading north at `speed` m/s, one fix per second. */
function straightRun(seconds: number, speed = 3, opts: Partial<GeoPoint> = {}, startLat = 51.5, startAt = T0): GeoPoint[] {
  return Array.from({ length: seconds + 1 }, (_, i) => ({
    latitude: startLat + i * speed * M,
    longitude: -0.12,
    accuracy: 5,
    recordedAt: startAt + i * 1000,
    segment: 0,
    ...opts,
  }));
}

describe('haversineMeters', () => {
  it('matches known distances', () => {
    // London → Paris ≈ 343.5 km
    const london = { latitude: 51.5074, longitude: -0.1278 };
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    expect(haversineMeters(london, paris) / 1000).toBeCloseTo(343.5, 0);
    // One degree of latitude ≈ 111.195 km
    expect(haversineMeters({ latitude: 0, longitude: 10 }, { latitude: 1, longitude: 10 })).toBeCloseTo(111_195, -1);
    expect(haversineMeters(london, london)).toBe(0);
  });

  it('handles the antimeridian', () => {
    const d = haversineMeters({ latitude: 0, longitude: 179.9999 }, { latitude: 0, longitude: -179.9999 });
    expect(d).toBeCloseTo(22.2, 0);
  });
});

describe('GPS filtering', () => {
  it('rejects invalid coordinates and null island', () => {
    expect(isValidCoordinate({ latitude: 91, longitude: 0, recordedAt: T0 })).toBe(false);
    expect(isValidCoordinate({ latitude: Number.NaN, longitude: 0, recordedAt: T0 })).toBe(false);
    expect(isValidCoordinate({ latitude: 0, longitude: 0, recordedAt: T0 })).toBe(false);
    expect(isValidCoordinate({ latitude: 51.5, longitude: -0.12, recordedAt: T0 })).toBe(true);
  });

  it('ignores fixes with poor accuracy', () => {
    const acc = new RunMetricsAccumulator();
    expect(acc.add({ latitude: 51.5, longitude: -0.12, accuracy: 120, recordedAt: T0, segment: 0 })).toMatchObject({
      accepted: false,
      reason: 'inaccurate',
    });
  });

  it('drops duplicate and out-of-order points', () => {
    const acc = new RunMetricsAccumulator();
    const [a, b] = straightRun(1, 4);
    acc.add(a!);
    acc.add(b!);
    expect(acc.add(b!).reason).toBe('duplicate');
    expect(acc.add({ ...a!, recordedAt: T0 - 1000 }).reason).toBe('out_of_order');
    expect(acc.displayDistanceMeters).toBeCloseTo(4, 1);
  });

  it('rejects impossible jumps but keeps measuring afterwards', () => {
    const points = straightRun(10);
    // A 400 m spike at t=5s, then back on track.
    points.splice(5, 0, { ...points[5]!, latitude: points[5]!.latitude + 400 * M, recordedAt: points[5]!.recordedAt - 500 });
    const metrics = computeRunMetrics(points, { durationSeconds: 10 });
    expect(metrics.accumulator.rejected.impossible_jump).toBe(1);
    expect(metrics.distanceMeters).toBeCloseTo(30, 0);
  });

  it('recovers when the first anchor was the bad fix', () => {
    const bad: GeoPoint = { latitude: 51.6, longitude: -0.12, accuracy: 10, recordedAt: T0 - 1000, segment: 0 };
    const metrics = computeRunMetrics([bad, ...straightRun(20)], { durationSeconds: 21 });
    // After a few rejected jumps it re-anchors and measures the real track.
    expect(metrics.distanceMeters).toBeGreaterThan(40);
    expect(metrics.distanceMeters).toBeLessThan(61);
  });

  it('does not accumulate distance from standing-still jitter', () => {
    const jitter: GeoPoint[] = Array.from({ length: 120 }, (_, i) => ({
      latitude: 51.5 + (i % 2 ? 1.5 : -1.5) * M,
      longitude: -0.12,
      accuracy: 8,
      recordedAt: T0 + i * 1000,
      segment: 0,
    }));
    const metrics = computeRunMetrics(jitter, { durationSeconds: 120 });
    // Without filtering this would add ~357 m. At most one sub-threshold stretch may remain.
    expect(metrics.distanceMeters).toBeLessThan(2 * 8);
    expect(metrics.movingTimeSeconds).toBe(0);
  });
});

describe('distance, time, pace and speed', () => {
  it('measures a steady 5:00/km run', () => {
    // 1000 m in 300 s = 3.333 m/s
    const metrics = computeRunMetrics(straightRun(300, 1000 / 300), { durationSeconds: 300 });
    expect(metrics.distanceMeters).toBeCloseTo(1000, -1);
    expect(metrics.movingTimeSeconds).toBe(300);
    expect(metrics.averagePaceSecondsPerKm).toBeCloseTo(300, -1);
    expect(metrics.averageSpeed).toBeCloseTo(3.333, 1);
  });

  it('stays within 3% on a realistic noisy track', () => {
    // Seeded noise: ±2 m per axis with 5 m reported accuracy, 3 m/s for 10 minutes = 1800 m.
    let seed = 42;
    const noise = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      return (seed / 2 ** 31 - 0.5) * 4;
    };
    const noisy = straightRun(600, 3).map((p) => ({
      ...p,
      latitude: p.latitude + noise() * M,
      longitude: p.longitude + (noise() * M) / Math.cos((51.5 * Math.PI) / 180),
    }));
    const metrics = computeRunMetrics(noisy, { durationSeconds: 600 });
    expect(Math.abs(metrics.distanceMeters - 1800) / 1800).toBeLessThan(0.03);
    expect(metrics.movingTimeSeconds).toBeGreaterThan(570);
  });

  it('never measures distance across a pause', () => {
    const first = straightRun(60);
    // Resume 500 m further north (e.g. walked back to the start with tracking paused).
    const second = straightRun(60, 3, { segment: 1 }, first.at(-1)!.latitude + 500 * M, T0 + 300_000);
    const metrics = computeRunMetrics([...first, ...second], { durationSeconds: 120 });
    expect(metrics.distanceMeters).toBeCloseTo(360, -1);
    expect(metrics.accumulator.segments).toHaveLength(2);
  });

  it('separates moving time from stops', () => {
    const run = straightRun(60);
    const last = run.at(-1)!;
    const stopped = Array.from({ length: 30 }, (_, i) => ({ ...last, recordedAt: last.recordedAt + (i + 1) * 1000 }));
    const moreRun = straightRun(60, 3, {}, last.latitude, last.recordedAt + 31_000).slice(1);
    const metrics = computeRunMetrics([...run, ...stopped, ...moreRun], { durationSeconds: 151 });
    expect(metrics.durationSeconds).toBe(151);
    // 120 s of running; resolution is one GPS leg (~4 s) either side of the stop.
    expect(metrics.movingTimeSeconds).toBeGreaterThanOrEqual(114);
    expect(metrics.movingTimeSeconds).toBeLessThanOrEqual(122);
  });

  it('reports current speed over the recent window and decays after stopping', () => {
    const acc = new RunMetricsAccumulator();
    for (const p of straightRun(30, 4)) acc.add(p);
    const end = T0 + 30_000;
    expect(acc.currentSpeedMps(end)).toBeCloseTo(4, 0);
    expect(speedToPace(acc.currentSpeedMps(end))).toBeCloseTo(250, -1);
    expect(acc.currentSpeedMps(end + 60_000)).toBeNull();
  });

  it('has no pace before meaningful distance', () => {
    expect(paceSecondsPerKm(5, 30)).toBeNull();
    expect(paceSecondsPerKm(1000, 300)).toBe(300);
  });
});

describe('calorie estimate', () => {
  it('scales with weight and distance and falls back to a default weight', () => {
    expect(estimateCalories(10_000, 60)).toBe(622);
    expect(estimateCalories(10_000, null)).toBe(725);
    expect(estimateCalories(0, 80)).toBe(0);
  });
});

describe('splits', () => {
  it('produces per-km splits with interpolated boundaries and a partial final split', () => {
    const metrics = computeRunMetrics(straightRun(750, 1000 / 300), { durationSeconds: 750 });
    const splits = computeSplits(metrics.accumulator.segments);
    expect(splits).toHaveLength(3);
    expect(splits[0]).toMatchObject({ index: 1, distanceMeters: 1000 });
    expect(splits[0]!.durationSeconds).toBeCloseTo(300, -1);
    expect(splits[2]!.distanceMeters).toBeCloseTo(500, -1);
  });
});

describe('gps signal', () => {
  it('classifies by accuracy and age', () => {
    expect(gpsSignalStatus(null, T0)).toBe('searching');
    expect(gpsSignalStatus({ accuracy: 5, recordedAt: T0 }, T0 + 1000)).toBe('good');
    expect(gpsSignalStatus({ accuracy: 25, recordedAt: T0 }, T0)).toBe('fair');
    expect(gpsSignalStatus({ accuracy: 45, recordedAt: T0 }, T0)).toBe('poor');
    expect(gpsSignalStatus({ accuracy: 5, recordedAt: T0 }, T0 + 10_000)).toBe('poor');
    expect(gpsSignalStatus({ accuracy: 5, recordedAt: T0 }, T0 + 30_000)).toBe('lost');
  });
});

describe('routePreview', () => {
  it('downsamples to lng/lat lines per segment', () => {
    const metrics = computeRunMetrics(straightRun(500), { durationSeconds: 500 });
    const preview = routePreview(metrics.accumulator.segments, 40);
    expect(preview).toHaveLength(1);
    expect(preview[0]!.length).toBeLessThanOrEqual(40);
    expect(preview[0]![0]).toEqual([-0.12, 51.5]);
  });
});
