import { describe, expect, it } from 'vitest';

import { computeTrainingReport, type ReportRunInput, type ZoneSeconds } from './training-report';

const TODAY = '2026-11-11'; // Wednesday
const MIN = 60;

function isoDaysAgo(days: number): string {
  return new Date(Date.parse(`${TODAY}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

function run(daysAgo: number, zones: Partial<Record<1 | 2 | 3 | 4 | 5, number>>, overrides: Partial<ReportRunInput> = {}): ReportRunInput {
  const zoneSeconds = [1, 2, 3, 4, 5].map((zone) => (zones[zone as 1] ?? 0) * MIN) as ZoneSeconds;
  return { localDate: isoDaysAgo(daysAgo), distanceMeters: 5000, durationSeconds: 1800, averagePaceSecondsPerKm: 360, zoneSeconds, ...overrides };
}

const report = (runs: ReportRunInput[]) => computeTrainingReport(runs, { today: TODAY, timeZone: 'UTC' });

describe('easy vs hard balance', () => {
  it('counts Z1–Z2 as easy and Z3–Z5 as hard', () => {
    const { last7Days } = report([run(1, { 1: 10, 2: 30, 3: 5, 4: 3, 5: 2 })]);
    expect(last7Days.easySeconds).toBe(40 * MIN);
    expect(last7Days.hardSeconds).toBe(10 * MIN);
    expect(last7Days.easyPercent).toBe(80);
    expect(last7Days.balance).toBe('balanced');
  });

  it('flags too much hard running', () => {
    expect(report([run(1, { 2: 20, 4: 20 })]).last7Days).toMatchObject({ easyPercent: 50, balance: 'too-hard' });
  });

  it('tolerates being a little under 80%', () => {
    expect(report([run(1, { 2: 75, 3: 25 })]).last7Days.balance).toBe('balanced');
    expect(report([run(1, { 2: 74, 3: 26 })]).last7Days.balance).toBe('too-hard');
  });

  it('does not judge a tiny amount of running', () => {
    expect(report([run(1, { 4: 20 })]).last7Days.balance).toBe('not-enough-data');
    expect(report([]).last7Days).toMatchObject({ easyPercent: null, balance: 'not-enough-data' });
  });

  it('only includes the last 7 days', () => {
    expect(report([run(6, { 2: 40 }), run(7, { 5: 40 })]).last7Days.hardSeconds).toBe(0);
  });
});

describe('load trend', () => {
  // Each baseline run scores 60 (30 min in Z2).
  const baseline = [10, 14, 17, 21, 24, 28, 31].map((daysAgo) => run(daysAgo, { 2: 30 }));
  // 7 runs × 60 over 28 days = 105 per week.

  it('needs a baseline before judging', () => {
    expect(report([run(1, { 5: 60 })]).loadTrend).toMatchObject({ ratio: null, status: 'building' });
    expect(report([run(10, { 2: 30 }), run(14, { 2: 30 }), run(1, { 2: 30 })]).loadTrend.status).toBe('building');
  });

  it('compares the last 7 days with the weekly average of the 28 before', () => {
    const { loadTrend } = report([...baseline, run(1, { 2: 50 })]);
    expect(loadTrend).toMatchObject({ acute: 100, chronic: 105, ratio: 0.95, status: 'steady' });
  });

  it('warns as load jumps', () => {
    expect(report([...baseline, run(1, { 2: 70 })]).loadTrend.status).toBe('elevated');
    expect(report([...baseline, run(1, { 2: 90 })]).loadTrend.status).toBe('high');
  });

  it('notices a drop', () => {
    expect(report([...baseline, run(1, { 2: 20 })]).loadTrend.status).toBe('low');
  });

  it('treats the exact thresholds as the lower band', () => {
    const exact = (minutes: number) => report([run(10, { 1: 100 }), run(11, { 1: 100 }), run(12, { 1: 200 }), run(1, { 1: minutes })]).loadTrend;
    expect(exact(130)).toMatchObject({ ratio: 1.3, status: 'steady' });
    expect(exact(150)).toMatchObject({ ratio: 1.5, status: 'elevated' });
  });
});

describe('periods and weeks', () => {
  it('compares with the previous 7 days', () => {
    const { last7Days, previous7Days } = report([run(1, { 2: 30 }), run(8, { 2: 30 }), run(9, { 2: 30 }, { distanceMeters: 7000 })]);
    expect(last7Days).toMatchObject({ runs: 1, distanceMeters: 5000 });
    expect(previous7Days).toMatchObject({ runs: 2, distanceMeters: 12000, load: 120 });
  });

  it('returns 8 Monday weeks, oldest first, including empty ones', () => {
    const { weeks } = report([run(0, { 2: 30 })]);
    expect(weeks).toHaveLength(8);
    expect(weeks.at(-1)).toMatchObject({ weekStart: '2026-11-09', runs: 1, load: 60 });
    expect(weeks[0]).toMatchObject({ weekStart: '2026-09-21', runs: 0, load: 0 });
  });

  it('ignores tiny recordings and vehicle-speed runs', () => {
    const { last7Days } = report([run(1, { 2: 30 }, { distanceMeters: 100 }), run(1, { 2: 30 }, { averagePaceSecondsPerKm: 100 })]);
    expect(last7Days.runs).toBe(0);
  });
});
