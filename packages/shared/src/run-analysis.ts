/**
 * Per-run training analysis derived from the filtered GPS track.
 *
 * Zones are PACE zones. A phone can't measure heart rate, so effort is inferred
 * from pace relative to the runner's threshold pace. Everything here is shown to
 * users as pace-based or estimated, never as physiological measurement.
 */

import type { RunningExperience } from './enums';
import { GPS_FILTER, type GeoPoint, haversineMeters, type Split } from './run-metrics';

export type PaceZoneNumber = 1 | 2 | 3 | 4 | 5;

export interface PaceZoneDefinition {
  zone: PaceZoneNumber;
  name: string;
  description: string;
  /** Multiples of threshold pace (seconds per km). Higher = slower; null = open-ended. */
  slowestMultiplier: number | null;
  fastestMultiplier: number | null;
}

/** Boundaries follow Joe Friel's run pace zones, as multiples of threshold pace. */
export const PACE_ZONES: readonly PaceZoneDefinition[] = [
  { zone: 1, name: 'Recovery', description: 'Very easy. Warm-ups, cool-downs and recovery days.', slowestMultiplier: null, fastestMultiplier: 1.29 },
  { zone: 2, name: 'Easy', description: 'Comfortable and conversational. Builds your aerobic base.', slowestMultiplier: 1.29, fastestMultiplier: 1.14 },
  { zone: 3, name: 'Tempo', description: 'Steady and purposeful. Short sentences only.', slowestMultiplier: 1.14, fastestMultiplier: 1.06 },
  { zone: 4, name: 'Threshold', description: 'Comfortably hard. The pace you could hold for about an hour.', slowestMultiplier: 1.06, fastestMultiplier: 0.99 },
  { zone: 5, name: 'Speed', description: 'Hard intervals and fast finishes.', slowestMultiplier: 0.99, fastestMultiplier: null },
];

export function paceZone(paceSecondsPerKm: number, thresholdPaceSecondsPerKm: number): PaceZoneNumber {
  const ratio = paceSecondsPerKm / thresholdPaceSecondsPerKm;
  if (ratio > 1.29) return 1;
  if (ratio > 1.14) return 2;
  if (ratio > 1.06) return 3;
  if (ratio > 0.99) return 4;
  return 5;
}

// ---------------------------------------------------------------------------
// Threshold pace
// ---------------------------------------------------------------------------

/** Used until the runner has enough history of their own. Seconds per km. */
export const THRESHOLD_PACE_BY_EXPERIENCE: Record<RunningExperience, number> = {
  BEGINNER: 390,
  INTERMEDIATE: 315,
  ADVANCED: 265,
  ELITE: 215,
};
export const DEFAULT_THRESHOLD_PACE = 360;

/** Which runs can inform threshold pace. */
export const ZONE_REFERENCE = {
  minDistanceMeters: 3000,
  lookbackDays: 180,
  /** The Nth-fastest run is used, so one GPS glitch or bike ride can't skew every zone. */
  rank: 3,
  /** A hard 3–10 km run is a little faster than true one-hour threshold pace. */
  thresholdFactor: 1.03,
} as const;

/** Faster than any sustained human run: treated as a vehicle or bad GPS. Seconds per km. */
export const MIN_PLAUSIBLE_PACE = 150;

export interface ThresholdPace {
  paceSecondsPerKm: number;
  source: 'history' | 'experience' | 'default';
}

export function resolveThresholdPace(input: {
  historyPaceSecondsPerKm?: number | null;
  experience?: RunningExperience | null;
}): ThresholdPace {
  if (input.historyPaceSecondsPerKm) return { paceSecondsPerKm: input.historyPaceSecondsPerKm, source: 'history' };
  if (input.experience) return { paceSecondsPerKm: THRESHOLD_PACE_BY_EXPERIENCE[input.experience], source: 'experience' };
  return { paceSecondsPerKm: DEFAULT_THRESHOLD_PACE, source: 'default' };
}

/** Pace range of a zone for a given threshold. Null means open-ended. */
export function paceZoneRange(zone: PaceZoneDefinition, thresholdPace: number): { slowest: number | null; fastest: number | null } {
  return {
    slowest: zone.slowestMultiplier === null ? null : Math.round(zone.slowestMultiplier * thresholdPace),
    fastest: zone.fastestMultiplier === null ? null : Math.round(zone.fastestMultiplier * thresholdPace),
  };
}

// ---------------------------------------------------------------------------
// Track helpers
// ---------------------------------------------------------------------------

interface Leg {
  meters: number;
  ms: number;
}

/** Unbroken legs. A pause or long signal gap ends a stretch, so nothing is measured across one. */
function movingStretches(segments: GeoPoint[][]): Leg[][] {
  const stretches: Leg[][] = [];
  for (const segment of segments) {
    let current: Leg[] = [];
    for (let i = 1; i < segment.length; i += 1) {
      const a = segment[i - 1]!;
      const b = segment[i]!;
      const ms = b.recordedAt - a.recordedAt;
      if (ms <= 0) continue;
      if (ms > GPS_FILTER.maxMovingGapMs) {
        if (current.length > 0) stretches.push(current);
        current = [];
        continue;
      }
      current.push({ meters: haversineMeters(a, b), ms });
    }
    if (current.length > 0) stretches.push(current);
  }
  return stretches;
}

const isMoving = (leg: Leg) => leg.meters / (leg.ms / 1000) >= GPS_FILTER.movingSpeedThresholdMps;

/** Smooths per-fix GPS noise: single legs are far too jumpy to classify. */
const ROLLING_WINDOW_MS = 30_000;

function withRollingSpeed(stretch: Leg[]): { leg: Leg; speed: number; fullWindow: boolean }[] {
  let start = 0;
  let windowMeters = 0;
  let windowMs = 0;
  return stretch.map((leg, index) => {
    windowMeters += leg.meters;
    windowMs += leg.ms;
    while (start < index && windowMs - stretch[start]!.ms >= ROLLING_WINDOW_MS) {
      windowMeters -= stretch[start]!.meters;
      windowMs -= stretch[start]!.ms;
      start += 1;
    }
    return { leg, speed: windowMeters / (windowMs / 1000), fullWindow: windowMs >= ROLLING_WINDOW_MS };
  });
}

// ---------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------

export interface ZoneTime {
  zone: PaceZoneNumber;
  seconds: number;
  distanceMeters: number;
  /** Share of time in zones, 0–1. */
  fraction: number;
}

export interface ZoneBreakdown {
  zones: ZoneTime[];
  totalSeconds: number;
  /** The zone with the most time, or null if the run had no moving time. */
  dominantZone: PaceZoneNumber | null;
}

/** Time and distance per pace zone. Only moving time counts, so stops don't inflate Zone 1. */
export function computePaceZones(segments: GeoPoint[][], thresholdPaceSecondsPerKm: number): ZoneBreakdown {
  const ms = [0, 0, 0, 0, 0];
  const meters = [0, 0, 0, 0, 0];

  for (const stretch of movingStretches(segments)) {
    for (const { leg, speed } of withRollingSpeed(stretch)) {
      if (!isMoving(leg) || speed < GPS_FILTER.movingSpeedThresholdMps) continue;
      const index = paceZone(1000 / speed, thresholdPaceSecondsPerKm) - 1;
      ms[index]! += leg.ms;
      meters[index]! += leg.meters;
    }
  }

  const totalMs = ms.reduce((sum, value) => sum + value, 0);
  const zones = PACE_ZONES.map((definition, index): ZoneTime => ({
    zone: definition.zone,
    seconds: Math.round(ms[index]! / 1000),
    distanceMeters: Math.round(meters[index]!),
    fraction: totalMs > 0 ? ms[index]! / totalMs : 0,
  }));
  const dominant = zones.reduce((best, zone) => (zone.seconds > best.seconds ? zone : best), zones[0]!);
  return {
    zones,
    totalSeconds: Math.round(totalMs / 1000),
    dominantZone: dominant.seconds > 0 ? dominant.zone : null,
  };
}

export type TrainingFocusKey = 'recovery' | 'base' | 'tempo' | 'threshold' | 'speed';

const TRAINING_FOCUS: Record<TrainingFocusKey, { label: string; summary: string }> = {
  recovery: { label: 'Recovery run', summary: 'Gentle effort that lets your body absorb harder training.' },
  base: { label: 'Aerobic base run', summary: 'Mostly easy running, the foundation of endurance.' },
  tempo: { label: 'Tempo run', summary: 'Sustained, steady effort that makes faster paces feel easier.' },
  threshold: { label: 'Threshold run', summary: 'Comfortably hard running that raises the pace you can hold.' },
  speed: { label: 'Speed session', summary: 'Fast running that develops top-end speed.' },
};

export function trainingFocus(breakdown: ZoneBreakdown): { key: TrainingFocusKey; label: string; summary: string } | null {
  if (breakdown.totalSeconds === 0) return null;
  const share = (zone: PaceZoneNumber) => breakdown.zones[zone - 1]!.fraction;
  let key: TrainingFocusKey = 'base';
  if (share(5) >= 0.2) key = 'speed';
  else if (share(4) + share(5) >= 0.3) key = 'threshold';
  else if (share(3) + share(4) + share(5) >= 0.4) key = 'tempo';
  else if (share(1) >= 0.6) key = 'recovery';
  return { key, ...TRAINING_FOCUS[key] };
}

export type TrainingLoadLevel = 'Light' | 'Moderate' | 'High' | 'Very high';

/** ESTIMATE. Edwards-style score: minutes in each zone multiplied by the zone number. */
export function trainingLoad(breakdown: ZoneBreakdown): { score: number; level: TrainingLoadLevel } {
  const score = Math.round(breakdown.zones.reduce((sum, zone) => sum + (zone.seconds / 60) * zone.zone, 0));
  const level: TrainingLoadLevel = score < 40 ? 'Light' : score < 140 ? 'Moderate' : score < 250 ? 'High' : 'Very high';
  return { score, level };
}

// ---------------------------------------------------------------------------
// Elevation
// ---------------------------------------------------------------------------

const ELEVATION_SMOOTHING_POINTS = 7;
const ELEVATION_HYSTERESIS_METERS = 3;

/**
 * ESTIMATE. GPS altitude is noisy, so readings are smoothed and a change only
 * counts once it passes a small threshold. Null when the track has no altitude.
 */
export function computeElevation(segments: GeoPoint[][]): { gainMeters: number; lossMeters: number } | null {
  let gain = 0;
  let loss = 0;
  let sawAltitude = false;

  for (const segment of segments) {
    const altitudes = segment.map((point) => point.altitude).filter((value): value is number => value != null);
    if (altitudes.length < 2) continue;
    sawAltitude = true;

    const radius = Math.floor(ELEVATION_SMOOTHING_POINTS / 2);
    const smoothed = altitudes.map((_, index) => {
      const window = altitudes.slice(Math.max(0, index - radius), index + radius + 1);
      return window.reduce((sum, value) => sum + value, 0) / window.length;
    });

    let reference = smoothed[0]!;
    for (const altitude of smoothed) {
      const delta = altitude - reference;
      if (Math.abs(delta) < ELEVATION_HYSTERESIS_METERS) continue;
      if (delta > 0) gain += delta;
      else loss -= delta;
      reference = altitude;
    }
  }
  return sawAltitude ? { gainMeters: Math.round(gain), lossMeters: Math.round(loss) } : null;
}

// ---------------------------------------------------------------------------
// Best efforts and pacing
// ---------------------------------------------------------------------------

export const BEST_EFFORT_DISTANCES = [
  { meters: 400, label: '400 m' },
  { meters: 1000, label: '1 km' },
  { meters: 5000, label: '5 km' },
  { meters: 10000, label: '10 km' },
  { meters: 21097, label: 'Half marathon' },
] as const;

export interface BestEffort {
  meters: number;
  label: string;
  seconds: number;
  paceSecondsPerKm: number;
}

function fastestOver(stretch: Leg[], target: number): number | null {
  const distance = [0];
  const time = [0];
  for (const leg of stretch) {
    distance.push(distance.at(-1)! + leg.meters);
    time.push(time.at(-1)! + leg.ms);
  }
  let best: number | null = null;
  let start = 0;
  for (let end = 1; end < distance.length; end += 1) {
    if (distance[end]! < target) continue;
    const startAt = distance[end]! - target;
    while (distance[start + 1]! <= startAt) start += 1;
    const span = distance[start + 1]! - distance[start]!;
    const fraction = span > 0 ? (startAt - distance[start]!) / span : 0;
    const elapsed = time[end]! - (time[start]! + fraction * (time[start + 1]! - time[start]!));
    if (best === null || elapsed < best) best = elapsed;
  }
  return best;
}

/** Fastest continuous stretch per distance. Efforts never span a pause, which would hide rest. */
export function computeBestEfforts(segments: GeoPoint[][]): BestEffort[] {
  const stretches = movingStretches(segments);
  const efforts: BestEffort[] = [];
  for (const { meters, label } of BEST_EFFORT_DISTANCES) {
    let bestMs: number | null = null;
    for (const stretch of stretches) {
      const ms = fastestOver(stretch, meters);
      if (ms !== null && (bestMs === null || ms < bestMs)) bestMs = ms;
    }
    if (bestMs !== null) {
      const seconds = Math.round(bestMs / 1000);
      efforts.push({ meters, label, seconds, paceSecondsPerKm: Math.round(seconds / (meters / 1000)) });
    }
  }
  return efforts;
}

/** Fastest smoothed pace held for at least 30 seconds, or null for very short tracks. */
export function computePeakPace(segments: GeoPoint[][]): number | null {
  let peak = 0;
  for (const stretch of movingStretches(segments)) {
    for (const { speed, fullWindow } of withRollingSpeed(stretch)) {
      if (fullWindow && speed > peak) peak = speed;
    }
  }
  return peak > 0 ? Math.round(1000 / peak) : null;
}

export type PacingKind = 'negative' | 'even' | 'positive';

export interface PacingAnalysis {
  firstHalfPaceSecondsPerKm: number;
  secondHalfPaceSecondsPerKm: number;
  /** Positive when the second half was slower. */
  deltaPercent: number;
  kind: PacingKind;
  /** Standard deviation of full-kilometre paces; null with fewer than three. */
  splitVariationSeconds: number | null;
}

const EVEN_PACING_PERCENT = 2;
const MIN_PACING_METERS = 1000;

export function computePacing(segments: GeoPoint[][], splits: Split[]): PacingAnalysis | null {
  const legs = movingStretches(segments).flat().filter(isMoving);
  const total = legs.reduce((sum, leg) => sum + leg.meters, 0);
  if (total < MIN_PACING_METERS) return null;

  const half = total / 2;
  let covered = 0;
  let firstMs = 0;
  let secondMs = 0;
  for (const leg of legs) {
    if (covered >= half) {
      secondMs += leg.ms;
    } else if (covered + leg.meters <= half) {
      firstMs += leg.ms;
    } else {
      const fraction = (half - covered) / leg.meters;
      firstMs += leg.ms * fraction;
      secondMs += leg.ms * (1 - fraction);
    }
    covered += leg.meters;
  }

  const halfKm = half / 1000;
  const first = firstMs / 1000 / halfKm;
  const second = secondMs / 1000 / halfKm;
  const deltaPercent = Math.round(((second - first) / first) * 1000) / 10;
  const kind: PacingKind = deltaPercent <= -EVEN_PACING_PERCENT ? 'negative' : deltaPercent >= EVEN_PACING_PERCENT ? 'positive' : 'even';

  const paces = splits
    .filter((split) => split.distanceMeters >= 1000 && split.paceSecondsPerKm)
    .map((split) => split.paceSecondsPerKm!);
  let splitVariationSeconds: number | null = null;
  if (paces.length >= 3) {
    const mean = paces.reduce((sum, pace) => sum + pace, 0) / paces.length;
    splitVariationSeconds = Math.round(Math.sqrt(paces.reduce((sum, pace) => sum + (pace - mean) ** 2, 0) / paces.length));
  }

  return {
    firstHalfPaceSecondsPerKm: Math.round(first),
    secondHalfPaceSecondsPerKm: Math.round(second),
    deltaPercent,
    kind,
    splitVariationSeconds,
  };
}

// ---------------------------------------------------------------------------
// Everything for one run
// ---------------------------------------------------------------------------

export interface RunAnalysis {
  thresholdPaceSecondsPerKm: number;
  zones: ZoneBreakdown;
  focus: ReturnType<typeof trainingFocus>;
  load: ReturnType<typeof trainingLoad>;
  elevation: ReturnType<typeof computeElevation>;
  bestEfforts: BestEffort[];
  peakPaceSecondsPerKm: number | null;
  pacing: PacingAnalysis | null;
}

export function analyzeRun(segments: GeoPoint[][], splits: Split[], thresholdPaceSecondsPerKm: number): RunAnalysis {
  const zones = computePaceZones(segments, thresholdPaceSecondsPerKm);
  return {
    thresholdPaceSecondsPerKm,
    zones,
    focus: trainingFocus(zones),
    load: trainingLoad(zones),
    elevation: computeElevation(segments),
    bestEfforts: computeBestEfforts(segments),
    peakPaceSecondsPerKm: computePeakPace(segments),
    pacing: computePacing(segments, splits),
  };
}
