import type { UpdateProfileInput } from '@next-stride/shared';

import type { Prisma } from '../generated/prisma/client';
import { isProfileComplete } from '../mappers/user.mapper';
import { type UserWithProfile, userRepository } from '../repositories/user.repository';
import { Errors } from '../utils/errors';
import { verifyPassword } from '../utils/password';
import { avatarStorage } from './avatar-storage.service';

async function getById(userId: string): Promise<UserWithProfile> {
  const user = await userRepository.findById(userId);
  if (!user) throw Errors.unauthenticated('Account no longer exists');
  return user;
}

async function getByUsername(username: string): Promise<UserWithProfile> {
  const user = await userRepository.findByUsername(username);
  if (!user) throw Errors.notFound('No runner with that username');
  return user;
}

function toDate(isoDate: string | null): Date | null {
  return isoDate === null ? null : new Date(`${isoDate}T00:00:00.000Z`);
}

async function updateProfile(userId: string, input: UpdateProfileInput): Promise<UserWithProfile> {
  const current = await getById(userId);

  const userData: Prisma.UserUpdateInput = {};

  if (input.email !== undefined && input.email !== current.email) {
    // Changing the sign-in email is sensitive: require the current password.
    if (!input.currentPassword) {
      throw Errors.validation({ currentPassword: ['Enter your current password to change your email'] });
    }
    if (!(await verifyPassword(current.passwordHash, input.currentPassword))) {
      throw Errors.validation({ currentPassword: ['Current password is incorrect'] });
    }
    if (await userRepository.emailExists(input.email, userId)) throw Errors.emailTaken();
    userData.email = input.email;
  }

  if (input.username !== undefined && input.username !== current.username) {
    if (await userRepository.usernameExists(input.username, userId)) throw Errors.usernameTaken();
    userData.username = input.username;
  }

  const profileData: Prisma.UserProfileUpdateWithoutUserInput = {};
  if (input.fullName !== undefined) profileData.fullName = input.fullName;
  if (input.dateOfBirth !== undefined) profileData.dateOfBirth = toDate(input.dateOfBirth);
  if (input.heightCm !== undefined) profileData.heightCm = input.heightCm;
  if (input.weightKg !== undefined) profileData.weightKg = input.weightKg;
  if (input.gender !== undefined) profileData.gender = input.gender;
  if (input.runningExperience !== undefined) profileData.runningExperience = input.runningExperience;
  if (input.preferredDistance !== undefined) profileData.preferredDistance = input.preferredDistance;
  if (input.fitnessGoals !== undefined) profileData.fitnessGoals = { set: input.fitnessGoals };
  if (input.bio !== undefined) profileData.bio = input.bio === '' ? null : input.bio;
  if (input.privacy?.showAge !== undefined) profileData.showAge = input.privacy.showAge;
  if (input.privacy?.showBodyMetrics !== undefined) profileData.showBodyMetrics = input.privacy.showBodyMetrics;
  if (input.privacy?.showGender !== undefined) profileData.showGender = input.privacy.showGender;

  let updated: UserWithProfile;
  try {
    updated = await userRepository.update(userId, { user: userData, profile: profileData });
  } catch (error) {
    // Lost a uniqueness race with another request.
    if ((error as { code?: string }).code === 'P2002') {
      const meta = JSON.stringify((error as { meta?: unknown }).meta ?? {});
      throw meta.includes('email') ? Errors.emailTaken() : Errors.usernameTaken();
    }
    throw error;
  }

  // Record the first time the profile-setup step is satisfied.
  if (updated.profile && !updated.profile.completedAt && isProfileComplete(updated.profile)) {
    updated = await userRepository.update(userId, { profile: { completedAt: new Date() } });
  }

  return updated;
}

async function setAvatar(userId: string, file: Buffer): Promise<UserWithProfile> {
  const current = await getById(userId);
  const publicPath = await avatarStorage.save(userId, file);
  const updated = await userRepository.update(userId, { profile: { avatarUrl: publicPath } });
  await avatarStorage.remove(current.profile?.avatarUrl);
  return updated;
}

async function removeAvatar(userId: string): Promise<UserWithProfile> {
  const current = await getById(userId);
  const updated = await userRepository.update(userId, { profile: { avatarUrl: null } });
  await avatarStorage.remove(current.profile?.avatarUrl);
  return updated;
}

export const userService = { getById, getByUsername, updateProfile, setAvatar, removeAvatar };
