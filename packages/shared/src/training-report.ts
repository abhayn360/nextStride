/**
 * Weekly training report: easy vs hard balance (the 80/20 guideline) and how
 * fast training load is rising. Both are guides based on pace zones, not
 * medical advice or a prediction of injury.
 */

import { isRewardedRun } from './gamification';

/** Seconds in Z1…Z5. */
export type ZoneSeconds = [number, number, number, number, number];

export interface ReportRunInput {
  localDate: string;
  distanceMeters: number;
  durationSeconds: number;
  averagePaceSecondsPerKm: number | null;
  zoneSeconds: ZoneSeconds;
}

export const TRAINING_REPORT = {
  /** Z1–Z2 share at or above this counts as balanced; 80% is the goal, with some tolerance. */
  balancedEasyPercent: 75,
  /** Below this much zone time a percentage would mean very little. */
  minBalanceSeconds: 30 * 60,
  acuteDays: 7,
  chronicDays: 28,
  /** Runs needed in the baseline before the ratio means anything. */
  minChronicRuns: 3,
  elevatedRatio: 1.3,
  highRatio: 1.5,
  lowRatio: 0.8,
  chartWeeks: 8,
} as const;

/** How many days of history a report needs. */
export const REPORT_LOOKBACK_DAYS = Math.max(TRAINING_REPORT.acuteDays + TRAINING_REPORT.chronicDays, TRAINING_REPORT.chartWeeks * 7 + 6);

export type BalanceStatus = 'balanced' | 'too-hard' | 'not-enough-data';
export type LoadStatus = 'building' | 'low' | 'steady' | 'elevated' | 'high';

export interface ReportPeriod {
  runs: number;
  distanceMeters: number;
  durationSeconds: number;
  load: number;
}

export interface WeekReport extends ReportPeriod {
  /** Monday (YYYY-MM-DD). */
  weekStart: string;
  easySeconds: number;
  hardSeconds: number;
}

export interface TrainingReport {
  timeZone: string;
  last7Days: ReportPeriod & {
    zoneSeconds: ZoneSeconds;
    easySeconds: number;
    hardSeconds: number;
    /** Null with no zone time. */
    easyPercent: number | null;
    balance: BalanceStatus;
  };
  previous7Days: ReportPeriod;
  loadTrend: {
    /** Load over the last 7 days. */
    acute: number;
    /** Average weekly load over the 28 days before that. */
    chronic: number;
    /** Null until there's a baseline. */
    ratio: number | null;
    status: LoadStatus;
  };
  /** Oldest first, ending with the current week. */
  weeks: WeekReport[];
}

const DAY_MS = 86_400_000;
const dayNumber = (isoDate: string) => Math.round(Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS);
const dayToIso = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
const weekStartOf = (day: number) => day - (((day + 3) % 7) + 7) % 7;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const easyOf = (zones: ZoneSeconds) => zones[0] + zones[1];
const hardOf = (zones: ZoneSeconds) => zones[2] + zones[3] + zones[4];
/** Same scoring as a single run's training load: zone minutes × zone number. */
const loadOf = (zones: ZoneSeconds) => zones.reduce((total, seconds, index) => total + (seconds / 60) * (index + 1), 0);

function period(runs: ReportRunInput[]): ReportPeriod {
  return {
    runs: runs.length,
    distanceMeters: Math.round(sum(runs.map((run) => run.distanceMeters))),
    durationSeconds: sum(runs.map((run) => run.durationSeconds)),
    load: Math.round(sum(runs.map((run) => loadOf(run.zoneSeconds)))),
  };
}

function loadStatus(ratio: number | null): LoadStatus {
  if (ratio === null) return 'building';
  if (ratio > TRAINING_REPORT.highRatio) return 'high';
  if (ratio > TRAINING_REPORT.elevatedRatio) return 'elevated';
  if (ratio < TRAINING_REPORT.lowRatio) return 'low';
  return 'steady';
}

export function computeTrainingReport(input: ReportRunInput[], options: { today: string; timeZone: string }): TrainingReport {
  const today = dayNumber(options.today);
  const runs = input.filter(isRewardedRun).map((run) => ({ run, day: dayNumber(run.localDate) }));
  const between = (fromDaysAgo: number, toDaysAgo: number) =>
    runs.filter(({ day }) => day <= today - toDaysAgo && day > today - fromDaysAgo).map(({ run }) => run);

  const recent = between(TRAINING_REPORT.acuteDays, 0);
  const baseline = between(TRAINING_REPORT.acuteDays + TRAINING_REPORT.chronicDays, TRAINING_REPORT.acuteDays);

  const zoneSeconds = [0, 1, 2, 3, 4].map((index) => sum(recent.map((run) => run.zoneSeconds[index]!))) as ZoneSeconds;
  const easySeconds = easyOf(zoneSeconds);
  const hardSeconds = hardOf(zoneSeconds);
  const total = easySeconds + hardSeconds;
  const easyPercent = total > 0 ? Math.round((easySeconds / total) * 100) : null;
  const balance: BalanceStatus =
    easyPercent === null || total < TRAINING_REPORT.minBalanceSeconds
      ? 'not-enough-data'
      : easyPercent >= TRAINING_REPORT.balancedEasyPercent
        ? 'balanced'
        : 'too-hard';

  const recentPeriod = period(recent);
  const chronic = Math.round(sum(baseline.map((run) => loadOf(run.zoneSeconds))) / (TRAINING_REPORT.chronicDays / 7));
  const ratio = baseline.length >= TRAINING_REPORT.minChronicRuns && chronic > 0 ? Math.round((recentPeriod.load / chronic) * 100) / 100 : null;

  const thisWeek = weekStartOf(today);
  const weeks = Array.from({ length: TRAINING_REPORT.chartWeeks }, (_, index): WeekReport => {
    const weekStart = thisWeek - (TRAINING_REPORT.chartWeeks - 1 - index) * 7;
    const inWeek = runs.filter(({ day }) => weekStartOf(day) === weekStart).map(({ run }) => run);
    return {
      weekStart: dayToIso(weekStart),
      ...period(inWeek),
      easySeconds: sum(inWeek.map((run) => easyOf(run.zoneSeconds))),
      hardSeconds: sum(inWeek.map((run) => hardOf(run.zoneSeconds))),
    };
  });

  return {
    timeZone: options.timeZone,
    last7Days: { ...recentPeriod, zoneSeconds, easySeconds, hardSeconds, easyPercent, balance },
    previous7Days: period(between(TRAINING_REPORT.acuteDays * 2, TRAINING_REPORT.acuteDays)),
    loadTrend: { acute: recentPeriod.load, chronic, ratio, status: loadStatus(ratio) },
    weeks,
  };
}
