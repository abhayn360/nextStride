import { describe, expect, it } from 'vitest';

import {
  analyzeRun,
  computeBestEfforts,
  computeElevation,
  computePaceZones,
  computePacing,
  computePeakPace,
  paceZone,
  resolveThresholdPace,
  trainingFocus,
  trainingLoad,
} from './run-analysis';
import type { GeoPoint } from './run-metrics';

const METER = 1 / 111_195;

/** Straight line north, one fix per `stepSeconds`. Stages are [seconds, metres per second]. */
function track(stages: [number, number][], options: { segment?: number; startMs?: number; stepSeconds?: number; altitude?: (i: number) => number | null } = {}): GeoPoint[] {
  const { segment = 0, startMs = 1_700_000_000_000, stepSeconds = 2, altitude = () => 10 } = options;
  const points: GeoPoint[] = [{ latitude: 51.5, longitude: -0.12, altitude: altitude(0), accuracy: 5, recordedAt: startMs, segment }];
  let meters = 0;
  let seconds = 0;
  for (const [duration, speed] of stages) {
    for (let elapsed = stepSeconds; elapsed <= duration; elapsed += stepSeconds) {
      meters += speed * stepSeconds;
      seconds += stepSeconds;
      points.push({ latitude: 51.5 + meters * METER, longitude: -0.12, altitude: altitude(points.length), accuracy: 5, recordedAt: startMs + seconds * 1000, segment });
    }
  }
  return points;
}

const THRESHOLD = 300; // 5:00 /km
const paceToSpeed = (pace: number) => 1000 / pace;

describe('paceZone', () => {
  it.each([
    [420, 1],
    [375, 2],
    [330, 3],
    [305, 4],
    [280, 5],
  ])('classifies %s s/km against a 5:00 threshold as zone %s', (pace, zone) => {
    expect(paceZone(pace, THRESHOLD)).toBe(zone);
  });

  it('treats boundaries as the slower zone upper limit consistently', () => {
    expect(paceZone(THRESHOLD * 1.29, THRESHOLD)).toBe(2);
    expect(paceZone(THRESHOLD * 0.99, THRESHOLD)).toBe(5);
  });
});

describe('resolveThresholdPace', () => {
  it('prefers the runner history, then experience, then a default', () => {
    expect(resolveThresholdPace({ historyPaceSecondsPerKm: 280, experience: 'BEGINNER' })).toEqual({ paceSecondsPerKm: 280, source: 'history' });
    expect(resolveThresholdPace({ historyPaceSecondsPerKm: null, experience: 'ELITE' })).toEqual({ paceSecondsPerKm: 215, source: 'experience' });
    expect(resolveThresholdPace({}).source).toBe('default');
  });
});

describe('computePaceZones', () => {
  it('puts a steady run entirely in the matching zone', () => {
    const result = computePaceZones([track([[600, paceToSpeed(375)]])], THRESHOLD);
    expect(result.dominantZone).toBe(2);
    expect(result.zones[1]!.seconds).toBe(600);
    expect(result.zones[1]!.fraction).toBe(1);
    expect(result.totalSeconds).toBe(600);
  });

  it('splits a run across zones, with the rolling window lagging only briefly', () => {
    const result = computePaceZones([track([[600, paceToSpeed(375)], [600, paceToSpeed(280)]])], THRESHOLD);
    expect(result.zones[1]!.seconds).toBeGreaterThan(590);
    expect(result.zones[4]!.seconds).toBeGreaterThan(570);
    expect(result.totalSeconds).toBe(1200);
  });

  it('does not count standing still as Zone 1', () => {
    const result = computePaceZones([track([[300, paceToSpeed(375)], [120, 0], [300, paceToSpeed(375)]])], THRESHOLD);
    expect(result.totalSeconds).toBeLessThanOrEqual(630);
  });

  it('never measures across a pause', () => {
    const first = track([[120, paceToSpeed(375)]], { segment: 0 });
    const second = track([[120, paceToSpeed(375)]], { segment: 1, startMs: first.at(-1)!.recordedAt + 3_600_000 });
    expect(computePaceZones([first, second], THRESHOLD).totalSeconds).toBe(240);
  });

  it('handles an empty track', () => {
    const result = computePaceZones([], THRESHOLD);
    expect(result.totalSeconds).toBe(0);
    expect(result.dominantZone).toBeNull();
    expect(trainingFocus(result)).toBeNull();
  });
});

describe('training focus and load', () => {
  const focusOf = (pace: number) => trainingFocus(computePaceZones([track([[1200, paceToSpeed(pace)]])], THRESHOLD))!.key;

  it('labels runs by where the time was spent', () => {
    expect(focusOf(420)).toBe('recovery');
    expect(focusOf(375)).toBe('base');
    expect(focusOf(330)).toBe('tempo');
    expect(focusOf(305)).toBe('threshold');
    expect(focusOf(280)).toBe('speed');
  });

  it('weights minutes by zone', () => {
    const load = trainingLoad(computePaceZones([track([[1800, paceToSpeed(375)]])], THRESHOLD));
    expect(load).toEqual({ score: 60, level: 'Moderate' });
  });
});

describe('computeElevation', () => {
  it('returns null without altitude data', () => {
    expect(computeElevation([track([[60, 3]], { altitude: () => null })])).toBeNull();
  });

  it('ignores GPS altitude noise on flat ground', () => {
    const flat = track([[1200, 3]], { altitude: (i) => 20 + (i % 2 === 0 ? 2 : -2) });
    expect(computeElevation([flat])).toEqual({ gainMeters: 0, lossMeters: 0 });
  });

  it('measures a climb and descent', () => {
    const hill = track([[600, 3]], { altitude: (i) => (i <= 150 ? i / 3 : (300 - i) / 3) });
    const result = computeElevation([hill])!;
    expect(result.gainMeters).toBeGreaterThan(40);
    expect(result.gainMeters).toBeLessThanOrEqual(50);
    expect(result.lossMeters).toBeGreaterThan(40);
  });
});

describe('computeBestEfforts', () => {
  it('finds the fastest stretch, not the average', () => {
    const efforts = computeBestEfforts([track([[600, 2.5], [250, 4], [600, 2.5]])]);
    const oneK = efforts.find((effort) => effort.meters === 1000)!;
    expect(oneK.seconds).toBe(250);
    expect(oneK.paceSecondsPerKm).toBe(250);
  });

  it('omits distances the run did not reach', () => {
    const meters = computeBestEfforts([track([[400, 3]])]).map((effort) => effort.meters);
    expect(meters).toEqual([400, 1000]);
  });

  it('does not let an effort span a pause', () => {
    const first = track([[150, 4]], { segment: 0 });
    const second = track([[150, 4]], { segment: 1, startMs: first.at(-1)!.recordedAt + 600_000 });
    expect(computeBestEfforts([first, second]).map((effort) => effort.meters)).toEqual([400]);
  });
});

describe('computePeakPace', () => {
  it('needs a sustained 30 seconds', () => {
    expect(computePeakPace([track([[20, 4]])])).toBeNull();
    expect(computePeakPace([track([[600, 2.5], [60, 5], [600, 2.5]])])).toBe(200);
  });
});

describe('computePacing', () => {
  it('detects a negative split', () => {
    const result = computePacing([track([[800, 3], [600, 4]])], [])!;
    expect(result.kind).toBe('negative');
    expect(result.deltaPercent).toBeLessThan(-2);
    expect(result.secondHalfPaceSecondsPerKm).toBeLessThan(result.firstHalfPaceSecondsPerKm);
  });

  it('detects a positive split and even pacing', () => {
    expect(computePacing([track([[600, 4], [800, 3]])], [])!.kind).toBe('positive');
    expect(computePacing([track([[800, 3]])], [])!.kind).toBe('even');
  });

  it('needs at least 1 km', () => {
    expect(computePacing([track([[100, 3]])], [])).toBeNull();
  });

  it('reports split variation only with three full kilometres', () => {
    const split = (index: number, paceSecondsPerKm: number) => ({ index, distanceMeters: 1000, durationSeconds: paceSecondsPerKm, paceSecondsPerKm });
    const segments = [track([[1200, 3]])];
    expect(computePacing(segments, [split(1, 300), split(2, 310)])!.splitVariationSeconds).toBeNull();
    expect(computePacing(segments, [split(1, 290), split(2, 300), split(3, 310)])!.splitVariationSeconds).toBe(8);
  });
});

describe('analyzeRun', () => {
  it('combines everything for one run', () => {
    const result = analyzeRun([track([[1200, paceToSpeed(375)]])], [], THRESHOLD);
    expect(result.thresholdPaceSecondsPerKm).toBe(THRESHOLD);
    expect(result.focus?.key).toBe('base');
    expect(result.elevation).toEqual({ gainMeters: 0, lossMeters: 0 });
    expect(result.bestEfforts.length).toBeGreaterThan(0);
    expect(result.peakPaceSecondsPerKm).toBe(375);
  });
});
