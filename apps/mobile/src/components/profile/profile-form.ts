import type { CurrentUser, UpdateProfileInput } from '@next-stride/shared';

import { parseDecimal } from '@/lib/format';

import type { ProfileFormValues } from './ProfileFields';

export const EMPTY_PROFILE_FORM: ProfileFormValues = {
  dateOfBirth: '',
  heightCm: '',
  weightKg: '',
  gender: null,
  runningExperience: null,
  preferredDistance: null,
  fitnessGoals: [],
  bio: '',
};

/** Accepts null so screens can render safely during the sign-out transition. */
export function profileFormFromUser(user: CurrentUser | null): ProfileFormValues {
  if (!user) return EMPTY_PROFILE_FORM;
  const { profile } = user;
  return {
    dateOfBirth: profile.dateOfBirth ?? '',
    heightCm: profile.heightCm?.toString() ?? '',
    weightKg: profile.weightKg?.toString() ?? '',
    gender: profile.gender,
    runningExperience: profile.runningExperience,
    preferredDistance: profile.preferredDistance,
    fitnessGoals: profile.fitnessGoals,
    bio: profile.bio ?? '',
  };
}

/**
 * Converts form strings into the API shape. Invalid numbers become NaN so the
 * shared Zod schema reports them against the right field.
 */
export function profileFormToInput(values: ProfileFormValues): UpdateProfileInput {
  return {
    dateOfBirth: values.dateOfBirth.trim() === '' ? null : values.dateOfBirth.trim(),
    heightCm: parseDecimal(values.heightCm),
    weightKg: parseDecimal(values.weightKg),
    gender: values.gender,
    runningExperience: values.runningExperience,
    preferredDistance: values.preferredDistance,
    fitnessGoals: values.fitnessGoals,
    bio: values.bio.trim() === '' ? null : values.bio.trim(),
  };
}
