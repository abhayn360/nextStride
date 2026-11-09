/**
 * Running calculations shared by the app (live stats) and the API
 * (authoritative values when a run is completed), so both always agree.
 *
 * MEASURED values come from GPS + clocks: distance, elapsed/moving time, pace, speed.
 * ESTIMATED values are model-based approximations: calories.
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  /** Horizontal accuracy radius in metres (68% confidence), as reported by the OS. */
  accuracy?: number | null;
  /** Epoch milliseconds. */
  recordedAt: number;
  /** Increments on every resume. Distance is never measured across a pause. */
  segment: number;
}

export const GPS_FILTER = {
  /** Fixes less precise than this are ignored (urban canyons, cold starts). */
  maxAccuracyMeters: 50,
  /** ~43 km/h — faster than any human runner; anything above is a GPS jump. */
  maxSpeedMps: 12,
  /** Movement below this between fixes is treated as standing-still jitter… */
  minMovementMeters: 3,
  /** …or below this multiple of the reported accuracy, whichever is larger (tuned on noisy tracks: <3% error). */
  jitterAccuracyFactor: 2,
  /** Below this speed the runner is considered stopped (moving time excludes it). */
  movingSpeedThresholdMps: 0.5,
  /** Gaps longer than this (signal loss) don't count towards moving time. */
  maxMovingGapMs: 5 * 60 * 1000,
  /** After this many consecutive "impossible jumps" the anchor itself was probably wrong. */
  maxConsecutiveJumps: 5,
  /** Window for "current" pace and speed. */
  currentWindowMs: 20_000,
} as const;

export type RejectReason = 'invalid' | 'inaccurate' | 'duplicate' | 'out_of_order' | 'impossible_jump' | 'stationary';

const EARTH_RADIUS_METERS = 6_371_008.8; // IUGG mean Earth radius

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance between two coordinates using the Haversine formula. */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidCoordinate(point: Pick<GeoPoint, 'latitude' | 'longitude' | 'recordedAt'>): boolean {
  const { latitude, longitude, recordedAt } = point;
  if (![latitude, longitude, recordedAt].every(Number.isFinite)) return false;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  // "Null Island" (0,0) is the classic uninitialised-fix value.
  if (latitude === 0 && longitude === 0) return false;
  return true;
}

export interface AddResult {
  accepted: boolean;
  reason?: RejectReason;
  /** Metres added to the total by this point. */
  distanceDelta: number;
}

/**
 * Incremental, filtered run metrics. Feed points in the order they were
 * recorded; each call is O(1) so it is cheap enough for live tracking.
 */
export class RunMetricsAccumulator {
  distanceMeters = 0;
  movingTimeMs = 0;
  acceptedCount = 0;
  readonly rejected: Record<RejectReason, number> = {
    invalid: 0,
    inaccurate: 0,
    duplicate: 0,
    out_of_order: 0,
    impossible_jump: 0,
    stationary: 0,
  };
  /** Accepted points grouped by segment — the route to draw. */
  readonly segments: GeoPoint[][] = [];

  private last: GeoPoint | null = null;
  /** Latest valid fix that hasn't moved far enough from `last` yet. */
  private tail: GeoPoint | null = null;
  private consecutiveJumps = 0;
  private window: { start: number; end: number; distance: number }[] = [];

  add(point: GeoPoint): AddResult {
    const reject = (reason: RejectReason): AddResult => {
      this.rejected[reason] += 1;
      return { accepted: false, reason, distanceDelta: 0 };
    };

    if (!isValidCoordinate(point)) return reject('invalid');
    if (point.accuracy != null && (point.accuracy < 0 || point.accuracy > GPS_FILTER.maxAccuracyMeters)) {
      return reject('inaccurate');
    }

    const last = this.last;
    const latest = this.tail ?? last;
    if (latest) {
      if (point.recordedAt === latest.recordedAt) return reject('duplicate');
      if (point.recordedAt < latest.recordedAt) return reject('out_of_order');
    }

    // First point, or first point after a resume: start a new line, measure nothing.
    if (!last || point.segment !== last.segment) {
      this.commitTail();
      this.anchor(point, true);
      return { accepted: true, distanceDelta: 0 };
    }

    const distance = haversineMeters(last, point);
    const elapsedMs = point.recordedAt - last.recordedAt;
    const speed = distance / (elapsedMs / 1000);

    if (speed > GPS_FILTER.maxSpeedMps) {
      this.consecutiveJumps += 1;
      if (this.consecutiveJumps >= GPS_FILTER.maxConsecutiveJumps) {
        // The previous anchor was the outlier; re-anchor without adding distance.
        this.anchor(point, true);
        return { accepted: true, distanceDelta: 0 };
      }
      return reject('impossible_jump');
    }
    this.consecutiveJumps = 0;

    // Jitter scales with fix quality: require movement beyond the uncertainty of the better fix.
    const jitterThreshold = Math.max(
      GPS_FILTER.minMovementMeters,
      GPS_FILTER.jitterAccuracyFactor * Math.min(last.accuracy ?? 0, point.accuracy ?? 0),
    );
    if (distance < jitterThreshold) {
      this.tail = point;
      return reject('stationary');
    }

    this.measureLeg(last, point, distance);
    this.anchor(point, false);
    return { accepted: true, distanceDelta: distance };
  }

  private measureLeg(from: GeoPoint, to: GeoPoint, distance: number) {
    const elapsedMs = to.recordedAt - from.recordedAt;
    this.distanceMeters += distance;
    if (distance / (elapsedMs / 1000) >= GPS_FILTER.movingSpeedThresholdMps && elapsedMs <= GPS_FILTER.maxMovingGapMs) {
      this.movingTimeMs += elapsedMs;
    }
    this.window.push({ start: from.recordedAt, end: to.recordedAt, distance });
  }

  /**
   * Counts the final stretch shorter than the jitter threshold. Called when a
   * segment ends (pause) and when the run is finalised.
   */
  private commitTail() {
    const { last, tail } = this;
    if (!last || !tail || tail.segment !== last.segment) {
      this.tail = null;
      return;
    }
    this.measureLeg(last, tail, haversineMeters(last, tail));
    this.anchor(tail, false);
  }

  /** Call once after the last point; makes totals include the final short stretch. */
  finalize(): void {
    this.commitTail();
  }

  /** Live distance including the not-yet-confirmed final stretch. */
  get displayDistanceMeters(): number {
    const { last, tail } = this;
    if (!last || !tail || tail.segment !== last.segment) return this.distanceMeters;
    return this.distanceMeters + haversineMeters(last, tail);
  }

  private anchor(point: GeoPoint, newSegment: boolean) {
    this.last = point;
    this.tail = null;
    this.consecutiveJumps = 0;
    this.acceptedCount += 1;
    if (newSegment) {
      this.segments.push([point]);
      this.window = [];
    } else {
      this.segments[this.segments.length - 1]?.push(point);
    }
  }

  get lastPoint(): GeoPoint | null {
    return this.last;
  }

  /** Speed over the recent window (m/s), or null if not enough recent movement. */
  currentSpeedMps(now: number = this.last?.recordedAt ?? 0): number | null {
    if (!this.last) return null;
    const from = now - GPS_FILTER.currentWindowMs;
    this.window = this.window.filter((entry) => entry.start >= from);
    const distance = this.window.reduce((sum, entry) => sum + entry.distance, 0);
    const first = this.window[0];
    if (!first || distance < 5) return null;
    // Measured up to `now`, so after a stop the speed decays to "no pace".
    const seconds = Math.max(1, (now - Math.max(from, first.start)) / 1000);
    const speed = distance / seconds;
    return speed >= GPS_FILTER.movingSpeedThresholdMps ? speed : null;
  }
}

export function paceSecondsPerKm(distanceMeters: number, seconds: number): number | null {
  if (distanceMeters < 10 || seconds <= 0) return null;
  return seconds / (distanceMeters / 1000);
}

export function speedMps(distanceMeters: number, seconds: number): number | null {
  if (seconds <= 0) return null;
  return distanceMeters / seconds;
}

export function speedToPace(speed: number | null): number | null {
  return speed && speed > 0 ? 1000 / speed : null;
}

/** Used when the profile has no weight. Shown to users as an estimate. */
export const DEFAULT_WEIGHT_KG = 70;

/**
 * ESTIMATE. Net energy cost of running is roughly 1 kcal per kg per km and
 * largely independent of pace (ACSM). This ignores terrain, wind and individual
 * economy, so it must always be presented as an estimate.
 */
export function estimateCalories(distanceMeters: number, weightKg: number | null | undefined): number {
  const weight = weightKg && weightKg > 0 ? weightKg : DEFAULT_WEIGHT_KG;
  return Math.round(weight * (distanceMeters / 1000) * 1.036);
}

export interface RunMetrics {
  distanceMeters: number;
  /** Active time: start to finish, excluding manual pauses. Measured by the device clock. */
  durationSeconds: number;
  /** Time actually moving (excludes stops at lights etc.). Derived from GPS. */
  movingTimeSeconds: number;
  /** Based on moving time, like most running platforms. */
  averagePaceSecondsPerKm: number | null;
  /** m/s, based on moving time. */
  averageSpeed: number | null;
  /** ESTIMATE — see estimateCalories. */
  caloriesEstimate: number;
  acceptedPoints: number;
  rejectedPoints: number;
}

/** Sorts by time (then segment) and runs the filter over the whole run. */
export function computeRunMetrics(
  points: GeoPoint[],
  options: { durationSeconds: number; weightKg?: number | null },
): RunMetrics & { accumulator: RunMetricsAccumulator } {
  const ordered = [...points].sort((a, b) => a.recordedAt - b.recordedAt || a.segment - b.segment);
  const accumulator = new RunMetricsAccumulator();
  for (const point of ordered) accumulator.add(point);
  accumulator.finalize();

  const distanceMeters = accumulator.distanceMeters;
  // Moving time can never exceed the active duration reported by the clock.
  const movingTimeSeconds = Math.min(Math.round(accumulator.movingTimeMs / 1000), Math.round(options.durationSeconds));
  const basis = movingTimeSeconds > 0 ? movingTimeSeconds : options.durationSeconds;
  const rejectedPoints = Object.values(accumulator.rejected).reduce((a, b) => a + b, 0);

  return {
    distanceMeters: Math.round(distanceMeters * 10) / 10,
    durationSeconds: Math.round(options.durationSeconds),
    movingTimeSeconds,
    averagePaceSecondsPerKm: roundOrNull(paceSecondsPerKm(distanceMeters, basis), 1),
    averageSpeed: distanceMeters >= 10 ? roundOrNull(speedMps(distanceMeters, basis), 3) : null,
    caloriesEstimate: estimateCalories(distanceMeters, options.weightKg),
    acceptedPoints: accumulator.acceptedCount,
    rejectedPoints,
    accumulator,
  };
}

function roundOrNull(value: number | null, digits: number): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export interface Split {
  /** 1-based kilometre index. */
  index: number;
  distanceMeters: number;
  /** Moving seconds spent on this split. */
  durationSeconds: number;
  paceSecondsPerKm: number | null;
}

/** Per-kilometre splits from filtered segments (final split may be partial). */
export function computeSplits(segments: GeoPoint[][], splitMeters = 1000): Split[] {
  const splits: Split[] = [];
  let splitDistance = 0;
  let splitMs = 0;

  const push = (distance: number, ms: number) => {
    splits.push({
      index: splits.length + 1,
      distanceMeters: Math.round(distance),
      durationSeconds: Math.round(ms / 1000),
      paceSecondsPerKm: roundOrNull(paceSecondsPerKm(distance, ms / 1000), 0),
    });
  };

  for (const segment of segments) {
    for (let i = 1; i < segment.length; i += 1) {
      const a = segment[i - 1]!;
      const b = segment[i]!;
      let distance = haversineMeters(a, b);
      const elapsed = b.recordedAt - a.recordedAt;
      let ms = elapsed <= GPS_FILTER.maxMovingGapMs ? elapsed : 0;
      // A single leg can cross a kilometre boundary — interpolate the split time.
      while (splitDistance + distance >= splitMeters) {
        const needed = splitMeters - splitDistance;
        const fraction = distance > 0 ? needed / distance : 0;
        push(splitMeters, splitMs + ms * fraction);
        distance -= needed;
        ms -= ms * fraction;
        splitDistance = 0;
        splitMs = 0;
      }
      splitDistance += distance;
      splitMs += ms;
    }
  }
  if (splitDistance >= 10) push(splitDistance, splitMs);
  return splits;
}

export type GpsSignal = 'searching' | 'good' | 'fair' | 'poor' | 'lost';

/** Classifies the latest fix for the live GPS indicator. */
export function gpsSignalStatus(
  lastFix: { accuracy?: number | null; recordedAt: number } | null,
  now: number,
): GpsSignal {
  if (!lastFix) return 'searching';
  const age = now - lastFix.recordedAt;
  if (age > 20_000) return 'lost';
  if (age > 8_000) return 'poor';
  const accuracy = lastFix.accuracy ?? Number.POSITIVE_INFINITY;
  if (accuracy <= 15) return 'good';
  if (accuracy <= 35) return 'fair';
  return 'poor';
}

/** Evenly samples a polyline down to at most `max` points, keeping both ends. */
export function downsample<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]!);
}

/** Route as [longitude, latitude] lines per segment, downsampled for previews. */
export function routePreview(segments: GeoPoint[][], maxPoints = 80): [number, number][][] {
  const total = segments.reduce((sum, s) => sum + s.length, 0);
  if (total === 0) return [];
  return segments
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const share = Math.max(2, Math.round((segment.length / total) * maxPoints));
      return downsample(segment, share).map((p) => [round6(p.longitude), round6(p.latitude)] as [number, number]);
    });
}

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
