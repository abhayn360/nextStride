/**
 * XP, levels, streaks, weekly quests and badges.
 *
 * Progress is never stored: it is replayed from the runner's completed runs on
 * every read. Deleting a run therefore corrects everything automatically, retried
 * uploads can't award anything twice, and rule changes apply to past runs.
 */

import { MIN_PLAUSIBLE_PACE } from './run-analysis';

export interface ProgressRunInput {
  id: string;
  startedAt: string;
  /** Calendar date (YYYY-MM-DD) in the runner's time zone. */
  localDate: string;
  /** 0–23 in the runner's time zone. */
  localHour: number;
  distanceMeters: number;
  durationSeconds: number;
  movingTimeSeconds: number;
  averagePaceSecondsPerKm: number | null;
}

export const MIN_REWARDED_METERS = 500;

/** Very short recordings and vehicle-speed "runs" earn nothing and can't extend a streak. */
export function isRewardedRun(run: Pick<ProgressRunInput, 'distanceMeters' | 'averagePaceSecondsPerKm'>): boolean {
  return (
    run.distanceMeters >= MIN_REWARDED_METERS &&
    run.averagePaceSecondsPerKm !== null &&
    run.averagePaceSecondsPerKm >= MIN_PLAUSIBLE_PACE
  );
}

// ---------------------------------------------------------------------------
// XP and levels
// ---------------------------------------------------------------------------

export const XP_RULES = {
  perKilometer: 10,
  perMinute: 1,
  firstRunOfDay: 10,
  streakPerDay: 5,
  streakMaxDays: 10,
  distanceRecord: 25,
  paceRecord: 25,
  quest: 40,
  allQuestsBonus: 60,
} as const;

/** Rewards both distance and time on feet, so slower runners level up fairly. */
export function baseRunXp(distanceMeters: number, movingSeconds: number): { distance: number; time: number } {
  return {
    distance: Math.floor((distanceMeters / 1000) * XP_RULES.perKilometer),
    time: Math.floor(movingSeconds / 60) * XP_RULES.perMinute,
  };
}

export const MAX_LEVEL = 99;

export const xpToAdvance = (level: number) => 100 + 50 * (level - 1);

const LEVEL_TITLES: readonly [number, string][] = [
  [50, 'Legend'],
  [40, 'Elite Strider'],
  [30, 'Endurance Athlete'],
  [20, 'Distance Runner'],
  [15, 'Strider'],
  [10, 'Pacer'],
  [5, 'Jogger'],
  [1, 'Rookie'],
];

export const levelTitle = (level: number) => LEVEL_TITLES.find(([from]) => level >= from)![1];

export interface LevelInfo {
  level: number;
  title: string;
  xpIntoLevel: number;
  /** Null at the maximum level. */
  xpForNextLevel: number | null;
}

export function levelFromXp(totalXp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (level < MAX_LEVEL && remaining >= xpToAdvance(level)) {
    remaining -= xpToAdvance(level);
    level += 1;
  }
  return { level, title: levelTitle(level), xpIntoLevel: remaining, xpForNextLevel: level < MAX_LEVEL ? xpToAdvance(level) : null };
}

// ---------------------------------------------------------------------------
// Dates: whole days since the epoch, so no daylight-saving arithmetic can go wrong
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const dayNumber = (isoDate: string) => Math.round(Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS);
const dayToIso = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
/** Day 0 was a Thursday, so (day + 3) % 7 is 0 on Mondays. */
const weekdayIndex = (day: number) => (((day + 3) % 7) + 7) % 7;
const weekStartOf = (day: number) => day - weekdayIndex(day);

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export type BadgeCategory = 'milestones' | 'volume' | 'consistency' | 'speed' | 'lifestyle';
export type BadgeTier = 'bronze' | 'silver' | 'gold';
export type ProgressUnit = 'km' | 'runs' | 'days' | 'weeks' | 'min' | 'goal';

export const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  milestones: 'Milestones',
  volume: 'Volume',
  consistency: 'Consistency',
  speed: 'Speed',
  lifestyle: 'Lifestyle',
};

const TIER_XP: Record<BadgeTier, number> = { bronze: 25, silver: 50, gold: 100 };

interface ReplayState {
  runs: number;
  totalMeters: number;
  longestMeters: number;
  longestSeconds: number;
  /** Fastest average pace among runs of at least 1 km. */
  fastestPace: number | null;
  /** Fastest average pace among runs of at least 5 km. */
  fastest5kPace: number | null;
  earlyRuns: number;
  lateRuns: number;
  fullWeekends: number;
  dayStreak: number;
  longestDayStreak: number;
  weekStreak: number;
  longestWeekStreak: number;
}

interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  category: BadgeCategory;
  tier: BadgeTier;
  unit: ProgressUnit;
  target: number;
  value: (state: ReplayState) => number;
}

const longestKm = (s: ReplayState) => s.longestMeters / 1000;
const totalKm = (s: ReplayState) => s.totalMeters / 1000;
const longestMinutes = (s: ReplayState) => s.longestSeconds / 60;
const under5k = (pace: number) => (s: ReplayState) => (s.fastest5kPace !== null && s.fastest5kPace < pace ? 1 : 0);

const BADGES: readonly BadgeDefinition[] = [
  { id: 'first-stride', title: 'First Stride', description: 'Complete your first run.', category: 'milestones', tier: 'bronze', unit: 'runs', target: 1, value: (s) => s.runs },
  { id: 'distance-5k', title: '5K Finisher', description: 'Run 5 km in one go.', category: 'milestones', tier: 'bronze', unit: 'km', target: 5, value: longestKm },
  { id: 'distance-10k', title: '10K Finisher', description: 'Run 10 km in one go.', category: 'milestones', tier: 'silver', unit: 'km', target: 10, value: longestKm },
  { id: 'distance-half', title: 'Half Marathoner', description: 'Run 21.1 km in one go.', category: 'milestones', tier: 'gold', unit: 'km', target: 21.097, value: longestKm },
  { id: 'distance-marathon', title: 'Marathoner', description: 'Run 42.2 km in one go.', category: 'milestones', tier: 'gold', unit: 'km', target: 42.195, value: longestKm },
  { id: 'duration-60', title: 'The Hour', description: 'Keep running for 60 minutes.', category: 'milestones', tier: 'silver', unit: 'min', target: 60, value: longestMinutes },
  { id: 'duration-120', title: 'Two Hour Club', description: 'Keep running for 2 hours.', category: 'milestones', tier: 'gold', unit: 'min', target: 120, value: longestMinutes },

  { id: 'total-25', title: 'Getting Going', description: 'Run 25 km in total.', category: 'volume', tier: 'bronze', unit: 'km', target: 25, value: totalKm },
  { id: 'total-100', title: 'Century', description: 'Run 100 km in total.', category: 'volume', tier: 'bronze', unit: 'km', target: 100, value: totalKm },
  { id: 'total-250', title: 'Road Regular', description: 'Run 250 km in total.', category: 'volume', tier: 'silver', unit: 'km', target: 250, value: totalKm },
  { id: 'total-500', title: 'Five Hundred', description: 'Run 500 km in total.', category: 'volume', tier: 'silver', unit: 'km', target: 500, value: totalKm },
  { id: 'total-1000', title: 'Thousand K Club', description: 'Run 1,000 km in total.', category: 'volume', tier: 'gold', unit: 'km', target: 1000, value: totalKm },
  { id: 'runs-10', title: 'Into the Habit', description: 'Complete 10 runs.', category: 'volume', tier: 'bronze', unit: 'runs', target: 10, value: (s) => s.runs },
  { id: 'runs-50', title: 'Fifty Runs', description: 'Complete 50 runs.', category: 'volume', tier: 'silver', unit: 'runs', target: 50, value: (s) => s.runs },
  { id: 'runs-100', title: 'Hundred Runs', description: 'Complete 100 runs.', category: 'volume', tier: 'gold', unit: 'runs', target: 100, value: (s) => s.runs },

  { id: 'days-3', title: 'Three in a Row', description: 'Run 3 days in a row.', category: 'consistency', tier: 'bronze', unit: 'days', target: 3, value: (s) => s.longestDayStreak },
  { id: 'days-7', title: 'Full Week', description: 'Run 7 days in a row.', category: 'consistency', tier: 'silver', unit: 'days', target: 7, value: (s) => s.longestDayStreak },
  { id: 'days-30', title: 'Unstoppable', description: 'Run 30 days in a row.', category: 'consistency', tier: 'gold', unit: 'days', target: 30, value: (s) => s.longestDayStreak },
  { id: 'weeks-4', title: 'Steady Month', description: 'Run at least once a week for 4 weeks.', category: 'consistency', tier: 'bronze', unit: 'weeks', target: 4, value: (s) => s.longestWeekStreak },
  { id: 'weeks-12', title: 'Quarter Strong', description: 'Run at least once a week for 12 weeks.', category: 'consistency', tier: 'silver', unit: 'weeks', target: 12, value: (s) => s.longestWeekStreak },
  { id: 'weeks-26', title: 'Half a Year', description: 'Run at least once a week for 26 weeks.', category: 'consistency', tier: 'gold', unit: 'weeks', target: 26, value: (s) => s.longestWeekStreak },

  { id: 'pace-sub6', title: 'Sub-6 Runner', description: 'Average under 6:00 /km over 5 km or more.', category: 'speed', tier: 'bronze', unit: 'goal', target: 1, value: under5k(360) },
  { id: 'pace-sub5', title: 'Sub-5 Runner', description: 'Average under 5:00 /km over 5 km or more.', category: 'speed', tier: 'silver', unit: 'goal', target: 1, value: under5k(300) },
  { id: 'pace-sub4', title: 'Sub-4 Runner', description: 'Average under 4:00 /km over 5 km or more.', category: 'speed', tier: 'gold', unit: 'goal', target: 1, value: under5k(240) },

  { id: 'early-bird', title: 'Early Bird', description: 'Finish 5 runs started before 7 am.', category: 'lifestyle', tier: 'bronze', unit: 'runs', target: 5, value: (s) => s.earlyRuns },
  { id: 'night-owl', title: 'Night Owl', description: 'Finish 5 runs started after 8 pm.', category: 'lifestyle', tier: 'bronze', unit: 'runs', target: 5, value: (s) => s.lateRuns },
  { id: 'weekend-warrior', title: 'Weekend Warrior', description: 'Run on both Saturday and Sunday, 4 times.', category: 'lifestyle', tier: 'silver', unit: 'runs', target: 4, value: (s) => s.fullWeekends },
];

export interface BadgeStatus {
  id: string;
  title: string;
  description: string;
  category: BadgeCategory;
  tier: BadgeTier;
  xp: number;
  unit: ProgressUnit;
  current: number;
  target: number;
  earned: { at: string; runId: string } | null;
}

// ---------------------------------------------------------------------------
// Weekly quests
// ---------------------------------------------------------------------------

export type QuestKind = 'runs' | 'distance' | 'long-run';

export interface Quest {
  id: QuestKind;
  title: string;
  unit: 'runs' | 'km';
  current: number;
  target: number;
  xp: number;
  completed: boolean;
}

interface WeekTotals {
  runs: number;
  meters: number;
  longestMeters: number;
}

const QUEST_BASELINE_WEEKS = 4;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * Targets come from the previous four weeks (empty weeks included), so quests
 * stretch a regular runner slightly and get easier again after a break.
 */
function questTargets(weekStart: number, weeks: Map<number, WeekTotals>): Record<QuestKind, number> {
  let runs = 0;
  let meters = 0;
  let longest = 0;
  for (let i = 1; i <= QUEST_BASELINE_WEEKS; i += 1) {
    const week = weeks.get(weekStart - i * 7);
    if (!week) continue;
    runs += week.runs;
    meters += week.meters;
    longest = Math.max(longest, week.longestMeters);
  }
  const weeklyKm = meters / 1000 / QUEST_BASELINE_WEEKS;
  return {
    runs: clamp(Math.ceil(runs / QUEST_BASELINE_WEEKS), 2, 6),
    distance: clamp(Math.round((weeklyKm * 1.1) / 5) * 5, 5, 150),
    'long-run': clamp(Math.round(((longest / 1000) * 0.9) * 2) / 2, 2, 42),
  };
}

const questValue = (kind: QuestKind, week: WeekTotals) => {
  if (kind === 'runs') return week.runs;
  return (kind === 'distance' ? week.meters : week.longestMeters) / 1000;
};

const questTitle = (kind: QuestKind, target: number) => {
  if (kind === 'runs') return `Run ${target} times`;
  if (kind === 'distance') return `Cover ${target} km`;
  return `One run of ${target} km`;
};

const QUEST_KINDS: readonly QuestKind[] = ['runs', 'distance', 'long-run'];

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

export interface XpLine {
  label: string;
  xp: number;
}

export interface RunReward {
  runId: string;
  xp: number;
  breakdown: XpLine[];
  badgeIds: string[];
  levelBefore: number;
  levelAfter: number;
}

export interface StreakStatus {
  current: number;
  longest: number;
  /** Already counted for this day or week. */
  active: boolean;
  /** Ends unless the runner runs by the end of this day or week. */
  atRisk: boolean;
}

export interface RunProgress extends LevelInfo {
  timeZone: string;
  totalXp: number;
  streaks: { day: StreakStatus; week: StreakStatus };
  quests: { weekStart: string; items: Quest[]; bonusXp: number; allComplete: boolean };
  badges: BadgeStatus[];
  /** Newest first, limited to the latest 30 rewarded runs. */
  recentRewards: RunReward[];
}

const RECENT_REWARDS = 30;
const round1 = (value: number) => Math.round(value * 10) / 10;

export function computeProgress(input: ProgressRunInput[], options: { today: string; timeZone: string }): RunProgress {
  const runs = input.filter(isRewardedRun).sort((a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0));

  const state: ReplayState = {
    runs: 0,
    totalMeters: 0,
    longestMeters: 0,
    longestSeconds: 0,
    fastestPace: null,
    fastest5kPace: null,
    earlyRuns: 0,
    lateRuns: 0,
    fullWeekends: 0,
    dayStreak: 0,
    longestDayStreak: 0,
    weekStreak: 0,
    longestWeekStreak: 0,
  };
  const earned = new Map<string, NonNullable<BadgeStatus['earned']>>();
  const weeks = new Map<number, WeekTotals>();
  const questState = new Map<number, { targets: Record<QuestKind, number>; done: Set<QuestKind> }>();
  const rewards: RunReward[] = [];
  let totalXp = 0;
  let lastDay: number | null = null;
  let lastWeek: number | null = null;
  let saturdayWeek: number | null = null;
  let countedWeekend: number | null = null;

  const questsFor = (weekStart: number) => {
    let quests = questState.get(weekStart);
    if (!quests) {
      quests = { targets: questTargets(weekStart, weeks), done: new Set() };
      questState.set(weekStart, quests);
    }
    return quests;
  };

  for (const run of runs) {
    const day = dayNumber(run.localDate);
    const week = weekStartOf(day);
    const breakdown: XpLine[] = [];
    const add = (label: string, xp: number) => {
      if (xp > 0) breakdown.push({ label, xp });
    };

    // Targets must be fixed before this run is added to the week's totals.
    const quests = questsFor(week);

    const firstOfDay = lastDay !== day;
    if (firstOfDay) {
      state.dayStreak = lastDay !== null && day === lastDay + 1 ? state.dayStreak + 1 : 1;
      state.longestDayStreak = Math.max(state.longestDayStreak, state.dayStreak);
    }
    if (lastWeek !== week) {
      state.weekStreak = lastWeek !== null && week === lastWeek + 7 ? state.weekStreak + 1 : 1;
      state.longestWeekStreak = Math.max(state.longestWeekStreak, state.weekStreak);
    }

    const moving = run.movingTimeSeconds > 0 ? run.movingTimeSeconds : run.durationSeconds;
    const base = baseRunXp(run.distanceMeters, moving);
    add('Distance', base.distance);
    add('Time on feet', base.time);
    if (firstOfDay) {
      add('First run of the day', XP_RULES.firstRunOfDay);
      if (state.dayStreak >= 2) add(`${state.dayStreak}-day streak`, XP_RULES.streakPerDay * Math.min(state.dayStreak, XP_RULES.streakMaxDays));
    }

    const pace = run.averagePaceSecondsPerKm!;
    if (state.runs > 0 && run.distanceMeters > state.longestMeters) add('Longest run yet', XP_RULES.distanceRecord);
    if (run.distanceMeters >= 1000) {
      if (state.fastestPace !== null && pace < state.fastestPace) add('Fastest pace yet', XP_RULES.paceRecord);
      state.fastestPace = state.fastestPace === null ? pace : Math.min(state.fastestPace, pace);
    }
    if (run.distanceMeters >= 5000) state.fastest5kPace = state.fastest5kPace === null ? pace : Math.min(state.fastest5kPace, pace);

    state.runs += 1;
    state.totalMeters += run.distanceMeters;
    state.longestMeters = Math.max(state.longestMeters, run.distanceMeters);
    state.longestSeconds = Math.max(state.longestSeconds, run.durationSeconds);
    if (run.localHour < 7) state.earlyRuns += 1;
    if (run.localHour >= 20) state.lateRuns += 1;

    const weekday = weekdayIndex(day);
    if (weekday === 5) saturdayWeek = week;
    if (weekday === 6 && saturdayWeek === week && countedWeekend !== week) {
      state.fullWeekends += 1;
      countedWeekend = week;
    }

    const totals = weeks.get(week) ?? { runs: 0, meters: 0, longestMeters: 0 };
    totals.runs += 1;
    totals.meters += run.distanceMeters;
    totals.longestMeters = Math.max(totals.longestMeters, run.distanceMeters);
    weeks.set(week, totals);

    for (const kind of QUEST_KINDS) {
      if (quests.done.has(kind) || questValue(kind, totals) < quests.targets[kind]) continue;
      quests.done.add(kind);
      add(`Quest: ${questTitle(kind, quests.targets[kind])}`, XP_RULES.quest);
      if (quests.done.size === QUEST_KINDS.length) add('All weekly quests', XP_RULES.allQuestsBonus);
    }

    const badgeIds: string[] = [];
    for (const badge of BADGES) {
      if (earned.has(badge.id) || badge.value(state) < badge.target) continue;
      earned.set(badge.id, { at: run.startedAt, runId: run.id });
      badgeIds.push(badge.id);
      add(`Badge: ${badge.title}`, TIER_XP[badge.tier]);
    }

    const levelBefore = levelFromXp(totalXp).level;
    const xp = breakdown.reduce((sum, line) => sum + line.xp, 0);
    totalXp += xp;
    rewards.push({ runId: run.id, xp, breakdown, badgeIds, levelBefore, levelAfter: levelFromXp(totalXp).level });

    lastDay = day;
    lastWeek = week;
  }

  const today = dayNumber(options.today);
  const thisWeek = weekStartOf(today);
  const currentQuests = questsFor(thisWeek);
  const weekTotals = weeks.get(thisWeek) ?? { runs: 0, meters: 0, longestMeters: 0 };

  const dayAlive = lastDay !== null && lastDay >= today - 1;
  const weekAlive = lastWeek !== null && lastWeek >= thisWeek - 7;

  return {
    timeZone: options.timeZone,
    totalXp,
    ...levelFromXp(totalXp),
    streaks: {
      day: {
        current: dayAlive ? state.dayStreak : 0,
        longest: state.longestDayStreak,
        active: lastDay !== null && lastDay >= today,
        atRisk: lastDay === today - 1,
      },
      week: {
        current: weekAlive ? state.weekStreak : 0,
        longest: state.longestWeekStreak,
        active: lastWeek !== null && lastWeek >= thisWeek,
        atRisk: lastWeek === thisWeek - 7,
      },
    },
    quests: {
      weekStart: dayToIso(thisWeek),
      items: QUEST_KINDS.map((kind): Quest => {
        const target = currentQuests.targets[kind];
        return {
          id: kind,
          title: questTitle(kind, target),
          unit: kind === 'runs' ? 'runs' : 'km',
          current: round1(Math.min(questValue(kind, weekTotals), target)),
          target,
          xp: XP_RULES.quest,
          completed: currentQuests.done.has(kind),
        };
      }),
      bonusXp: XP_RULES.allQuestsBonus,
      allComplete: currentQuests.done.size === QUEST_KINDS.length,
    },
    badges: BADGES.map((badge): BadgeStatus => ({
      id: badge.id,
      title: badge.title,
      description: badge.description,
      category: badge.category,
      tier: badge.tier,
      xp: TIER_XP[badge.tier],
      unit: badge.unit,
      current: round1(Math.min(badge.value(state), badge.target)),
      target: badge.target,
      earned: earned.get(badge.id) ?? null,
    })),
    recentRewards: rewards.slice(-RECENT_REWARDS).reverse(),
  };
}
