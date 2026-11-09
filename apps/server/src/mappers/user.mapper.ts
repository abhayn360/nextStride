import { ageFromDateOfBirth, type CurrentUser, type PublicProfile } from '@next-stride/shared';

import type { UserWithProfile } from '../repositories/user.repository';

type Profile = NonNullable<UserWithProfile['profile']>;

function toIsoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function toNumber(value: Profile['heightCm']): number | null {
  return value === null ? null : Number(value);
}

/** Absolute URL for a stored avatar path; external URLs pass through unchanged. */
function resolveAvatarUrl(path: string | null, baseUrl: string): string | null {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${baseUrl}${path}`;
}

export function isProfileComplete(profile: Profile): boolean {
  return (
    profile.dateOfBirth !== null &&
    profile.runningExperience !== null &&
    profile.preferredDistance !== null &&
    profile.fitnessGoals.length > 0
  );
}

function requireProfile(user: UserWithProfile): Profile {
  // Every user is created with a profile in the same write; a missing one is a data bug.
  if (!user.profile) throw new Error(`User ${user.id} has no profile`);
  return user.profile;
}

/** The owner's full view. Never includes passwordHash or tokenVersion. */
export function toCurrentUser(user: UserWithProfile, baseUrl: string): CurrentUser {
  const profile = requireProfile(user);
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    createdAt: user.createdAt.toISOString(),
    profile: {
      fullName: profile.fullName,
      avatarUrl: resolveAvatarUrl(profile.avatarUrl, baseUrl),
      dateOfBirth: toIsoDate(profile.dateOfBirth),
      heightCm: toNumber(profile.heightCm),
      weightKg: toNumber(profile.weightKg),
      gender: profile.gender,
      runningExperience: profile.runningExperience,
      preferredDistance: profile.preferredDistance,
      fitnessGoals: profile.fitnessGoals,
      bio: profile.bio,
      privacy: {
        showAge: profile.showAge,
        showBodyMetrics: profile.showBodyMetrics,
        showGender: profile.showGender,
      },
      isComplete: isProfileComplete(profile),
      updatedAt: profile.updatedAt.toISOString(),
    },
  };
}

/** What other users see. Personal fields appear only when the owner opted in. */
export function toPublicProfile(user: UserWithProfile, baseUrl: string): PublicProfile {
  const profile = requireProfile(user);
  const result: PublicProfile = {
    username: user.username,
    fullName: profile.fullName,
    avatarUrl: resolveAvatarUrl(profile.avatarUrl, baseUrl),
    bio: profile.bio,
    runningExperience: profile.runningExperience,
    preferredDistance: profile.preferredDistance,
    fitnessGoals: profile.fitnessGoals,
    memberSince: user.createdAt.toISOString(),
  };
  if (profile.showAge && profile.dateOfBirth) {
    result.age = ageFromDateOfBirth(profile.dateOfBirth.toISOString());
  }
  if (profile.showBodyMetrics) {
    result.heightCm = toNumber(profile.heightCm);
    result.weightKg = toNumber(profile.weightKg);
  }
  if (profile.showGender) {
    result.gender = profile.gender;
  }
  return result;
}
