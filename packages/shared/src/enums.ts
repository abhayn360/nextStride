/**
 * Domain enums shared by the API and the mobile app.
 * Values mirror the Prisma enums in apps/server/prisma/schema.prisma — keep them in sync.
 */

export const GENDERS = ['FEMALE', 'MALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY'] as const;
export type Gender = (typeof GENDERS)[number];

export const RUNNING_EXPERIENCES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ELITE'] as const;
export type RunningExperience = (typeof RUNNING_EXPERIENCES)[number];

export const PREFERRED_DISTANCES = [
  'FIVE_K',
  'TEN_K',
  'HALF_MARATHON',
  'MARATHON',
  'ULTRA',
  'NO_PREFERENCE',
] as const;
export type PreferredDistance = (typeof PREFERRED_DISTANCES)[number];

export const FITNESS_GOALS = [
  'BUILD_HABIT',
  'LOSE_WEIGHT',
  'IMPROVE_ENDURANCE',
  'GET_FASTER',
  'TRAIN_FOR_RACE',
  'STAY_HEALTHY',
  'REDUCE_STRESS',
] as const;
export type FitnessGoal = (typeof FITNESS_GOALS)[number];

/** Human readable labels for UI. */
export const GENDER_LABELS: Record<Gender, string> = {
  FEMALE: 'Female',
  MALE: 'Male',
  NON_BINARY: 'Non-binary',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
};

export const RUNNING_EXPERIENCE_LABELS: Record<RunningExperience, { label: string; description: string }> = {
  BEGINNER: { label: 'Beginner', description: 'New to running or getting back into it' },
  INTERMEDIATE: { label: 'Intermediate', description: 'Running regularly for a few months' },
  ADVANCED: { label: 'Advanced', description: 'Consistent training, racing experience' },
  ELITE: { label: 'Elite', description: 'Competitive, structured high-volume training' },
};

export const PREFERRED_DISTANCE_LABELS: Record<PreferredDistance, string> = {
  FIVE_K: '5K',
  TEN_K: '10K',
  HALF_MARATHON: 'Half marathon',
  MARATHON: 'Marathon',
  ULTRA: 'Ultra',
  NO_PREFERENCE: 'No preference',
};

export const FITNESS_GOAL_LABELS: Record<FitnessGoal, string> = {
  BUILD_HABIT: 'Build a habit',
  LOSE_WEIGHT: 'Lose weight',
  IMPROVE_ENDURANCE: 'Improve endurance',
  GET_FASTER: 'Get faster',
  TRAIN_FOR_RACE: 'Train for a race',
  STAY_HEALTHY: 'Stay healthy',
  REDUCE_STRESS: 'Reduce stress',
};
