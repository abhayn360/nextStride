import { describe, expect, it } from 'vitest';

import { computeProgress, levelFromXp, MAX_LEVEL, type ProgressRunInput, xpToAdvance } from './gamification';

let counter = 0;

function run(localDate: string, km = 5, overrides: Partial<ProgressRunInput> = {}): ProgressRunInput {
  counter += 1;
  const pace = overrides.averagePaceSecondsPerKm === undefined ? 360 : overrides.averagePaceSecondsPerKm;
  const seconds = Math.round(km * (pace ?? 360));
  return {
    id: `run-${counter}`,
    startedAt: `${localDate}T10:00:${String(counter % 60).padStart(2, '0')}.000Z`,
    localDate,
    localHour: 10,
    distanceMeters: km * 1000,
    durationSeconds: seconds,
    movingTimeSeconds: seconds,
    averagePaceSecondsPerKm: pace,
    ...overrides,
  };
}

const progress = (runs: ProgressRunInput[], today = '2026-11-11') => computeProgress(runs, { today, timeZone: 'UTC' });
const badge = (result: ReturnType<typeof progress>, id: string) => result.badges.find((item) => item.id === id)!;
const rewardFor = (result: ReturnType<typeof progress>, runInput: ProgressRunInput) => result.recentRewards.find((item) => item.runId === runInput.id)!;

describe('levelFromXp', () => {
  it('starts at level 1 and requires more XP per level', () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, title: 'Rookie', xpIntoLevel: 0, xpForNextLevel: 100 });
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toMatchObject({ level: 2, xpIntoLevel: 0, xpForNextLevel: 150 });
    expect(xpToAdvance(3)).toBeGreaterThan(xpToAdvance(2));
  });

  it('awards titles and stops at the maximum level', () => {
    expect(levelFromXp(2700)).toMatchObject({ level: 10, title: 'Pacer' });
    expect(levelFromXp(100_000_000)).toMatchObject({ level: MAX_LEVEL, xpForNextLevel: null });
  });
});

describe('XP', () => {
  it('starts everyone at zero', () => {
    const result = progress([]);
    expect(result).toMatchObject({ totalXp: 0, level: 1 });
    expect(result.streaks.day.current).toBe(0);
    expect(result.quests.items).toHaveLength(3);
    expect(result.badges.every((item) => item.earned === null)).toBe(true);
  });

  it('itemises every source of XP and totals them', () => {
    const first = run('2026-11-02', 5);
    const reward = rewardFor(progress([first]), first);
    const labels = Object.fromEntries(reward.breakdown.map((line) => [line.label, line.xp]));
    expect(labels).toMatchObject({ Distance: 50, 'Time on feet': 30, 'First run of the day': 10, 'Badge: First Stride': 25, 'Badge: 5K Finisher': 25 });
    expect(reward.xp).toBe(reward.breakdown.reduce((sum, line) => sum + line.xp, 0));
    expect(progress([first]).totalXp).toBe(reward.xp);
  });

  it('pays the first-run bonus once a day, so splitting a run gains nothing extra', () => {
    const morning = run('2026-11-02', 3);
    const evening = run('2026-11-02', 3);
    const labels = rewardFor(progress([morning, evening]), evening).breakdown.map((line) => line.label);
    expect(labels).not.toContain('First run of the day');
  });

  it('rewards records but not on the first ever run', () => {
    const first = run('2026-11-02', 3, { averagePaceSecondsPerKm: 400 });
    const second = run('2026-11-03', 4, { averagePaceSecondsPerKm: 350 });
    const result = progress([first, second]);
    const firstLabels = rewardFor(result, first).breakdown.map((line) => line.label);
    const secondLabels = rewardFor(result, second).breakdown.map((line) => line.label);
    expect(firstLabels).not.toContain('Longest run yet');
    expect(secondLabels).toEqual(expect.arrayContaining(['Longest run yet', 'Fastest pace yet']));
  });

  it('ignores tiny recordings and vehicle-speed runs', () => {
    const result = progress([run('2026-11-02', 0.2), run('2026-11-03', 20, { averagePaceSecondsPerKm: 100 }), run('2026-11-04', 5, { averagePaceSecondsPerKm: null })]);
    expect(result.totalXp).toBe(0);
    expect(result.streaks.day.longest).toBe(0);
  });

  it('reports level-ups on the run that caused them', () => {
    const first = run('2026-11-02', 10);
    expect(rewardFor(progress([first]), first)).toMatchObject({ levelBefore: 1 });
    expect(rewardFor(progress([first]), first).levelAfter).toBeGreaterThan(1);
  });

  it('is independent of input order and corrects itself when a run is deleted', () => {
    const a = run('2026-11-02');
    const b = run('2026-11-03');
    const c = run('2026-11-04');
    expect(progress([c, a, b]).totalXp).toBe(progress([a, b, c]).totalXp);
    expect(progress([a, c]).totalXp).toBeLessThan(progress([a, b, c]).totalXp);
  });

  it('caps recent rewards at 30, newest first', () => {
    const runs = Array.from({ length: 35 }, (_, i) => run(`2026-09-${String((i % 28) + 1).padStart(2, '0')}`));
    const result = progress(runs);
    expect(result.recentRewards).toHaveLength(30);
    expect(result.recentRewards[0]!.runId).toBe([...runs].sort((x, y) => (x.startedAt < y.startedAt ? 1 : -1))[0]!.id);
  });
});

describe('streaks', () => {
  it('counts consecutive days and is active when run today', () => {
    const { day } = progress([run('2026-11-09'), run('2026-11-10'), run('2026-11-11')]).streaks;
    expect(day).toEqual({ current: 3, longest: 3, active: true, atRisk: false });
  });

  it('is at risk the day after the last run', () => {
    const { day } = progress([run('2026-11-09'), run('2026-11-10')]).streaks;
    expect(day).toEqual({ current: 2, longest: 2, active: false, atRisk: true });
  });

  it('resets after a missed day but remembers the longest', () => {
    const { day } = progress([run('2026-11-01'), run('2026-11-02'), run('2026-11-03'), run('2026-11-08')]).streaks;
    expect(day).toEqual({ current: 0, longest: 3, active: false, atRisk: false });
  });

  it('does not double count two runs on one day', () => {
    expect(progress([run('2026-11-11'), run('2026-11-11')]).streaks.day.current).toBe(1);
  });

  it('counts weeks from Monday and survives rest days', () => {
    // Three Mondays in a row; the current week (of 9 Nov) has no run yet.
    const { week } = progress([run('2026-10-19'), run('2026-10-26'), run('2026-11-02')]).streaks;
    expect(week).toEqual({ current: 3, longest: 3, active: false, atRisk: true });
  });

  it('treats Sunday and the next Monday as different weeks', () => {
    const { week } = progress([run('2026-11-08'), run('2026-11-09')]).streaks;
    expect(week).toMatchObject({ current: 2, active: true });
  });

  it('ends a weekly streak after a full missed week', () => {
    expect(progress([run('2026-10-19')]).streaks.week.current).toBe(0);
  });
});

describe('weekly quests', () => {
  it('gives new runners gentle targets', () => {
    expect(progress([]).quests.items.map((quest) => [quest.id, quest.target])).toEqual([
      ['runs', 2],
      ['distance', 5],
      ['long-run', 2],
    ]);
  });

  it('adapts to the previous four weeks only', () => {
    const history = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-26', '2026-10-27', '2026-10-28', '2026-11-02', '2026-11-03', '2026-11-04'].map((date) => run(date, 10));
    const targets = Object.fromEntries(progress(history).quests.items.map((quest) => [quest.id, quest.target]));
    expect(targets).toEqual({ runs: 3, distance: 35, 'long-run': 9 });
  });

  it('eases off after a break', () => {
    const targets = Object.fromEntries(progress([run('2026-08-03', 20), run('2026-08-04', 20)]).quests.items.map((quest) => [quest.id, quest.target]));
    expect(targets).toEqual({ runs: 2, distance: 5, 'long-run': 2 });
  });

  it('tracks progress and pays once when completed, plus a bonus for all three', () => {
    const a = run('2026-11-09', 3);
    const b = run('2026-11-10', 3);
    const c = run('2026-11-11', 3);
    const result = progress([a, b, c]);
    expect(result.quests.allComplete).toBe(true);
    expect(result.quests.weekStart).toBe('2026-11-09');
    expect(result.quests.items.every((quest) => quest.completed)).toBe(true);

    const allLabels = result.recentRewards.flatMap((reward) => reward.breakdown.map((line) => line.label));
    expect(allLabels.filter((label) => label.startsWith('Quest:'))).toHaveLength(3);
    expect(allLabels.filter((label) => label === 'All weekly quests')).toHaveLength(1);
  });

  it('shows partial progress capped at the target', () => {
    const items = progress([run('2026-11-09', 1.5)]).quests.items;
    expect(items[0]).toMatchObject({ current: 1, target: 2, completed: false });
    expect(items[1]).toMatchObject({ current: 1.5, target: 5 });
  });
});

describe('badges', () => {
  it('records which run earned a badge, once only', () => {
    const first = run('2026-11-02', 5);
    const second = run('2026-11-03', 5);
    const result = progress([first, second]);
    expect(badge(result, 'distance-5k').earned).toEqual({ at: first.startedAt, runId: first.id });
    expect(rewardFor(result, second).badgeIds).not.toContain('distance-5k');
  });

  it('reports progress on locked badges', () => {
    expect(badge(progress([run('2026-11-02', 12.34)]), 'total-25')).toMatchObject({ current: 12.3, target: 25, earned: null });
  });

  it('awards pace badges only over 5 km or more', () => {
    expect(badge(progress([run('2026-11-02', 3, { averagePaceSecondsPerKm: 280 })]), 'pace-sub5').earned).toBeNull();
    expect(badge(progress([run('2026-11-02', 5, { averagePaceSecondsPerKm: 280 })]), 'pace-sub5').earned).not.toBeNull();
  });

  it('counts time-of-day runs in the local time zone', () => {
    const early = Array.from({ length: 5 }, (_, i) => run(`2026-11-0${i + 1}`, 2, { localHour: 6 }));
    const late = Array.from({ length: 5 }, (_, i) => run(`2026-11-0${i + 1}`, 2, { localHour: 21 }));
    expect(badge(progress(early), 'early-bird').earned).not.toBeNull();
    expect(badge(progress(late), 'night-owl').earned).not.toBeNull();
  });

  it('needs Saturday and Sunday of the same weekend', () => {
    const fourWeekends = ['2026-10-17', '2026-10-18', '2026-10-24', '2026-10-25', '2026-10-31', '2026-11-01', '2026-11-07', '2026-11-08'].map((date) => run(date, 2));
    expect(badge(progress(fourWeekends), 'weekend-warrior').earned).not.toBeNull();

    const mismatched = ['2026-10-18', '2026-10-24', '2026-11-01', '2026-11-07'].map((date) => run(date, 2));
    expect(badge(progress(mismatched), 'weekend-warrior').current).toBe(0);
  });

  it('awards streak badges from the longest streak, so they are kept', () => {
    const result = progress([run('2026-10-01'), run('2026-10-02'), run('2026-10-03')]);
    expect(result.streaks.day.current).toBe(0);
    expect(badge(result, 'days-3').earned).not.toBeNull();
  });

  it('has unique ids', () => {
    const ids = progress([]).badges.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
