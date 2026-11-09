import { z } from 'zod';

import { FITNESS_GOALS, GENDERS, PREFERRED_DISTANCES, RUNNING_EXPERIENCES } from './enums';

// ---------------------------------------------------------------------------
// Field rules
// ---------------------------------------------------------------------------

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const BIO_MAX_LENGTH = 280;
export const FULL_NAME_MAX_LENGTH = 80;
export const MIN_USER_AGE = 13;

/** Usernames that would collide with routes or impersonate the platform. */
export const RESERVED_USERNAMES = new Set([
  'me',
  'admin',
  'administrator',
  'root',
  'support',
  'help',
  'settings',
  'api',
  'auth',
  'login',
  'logout',
  'register',
  'nextstride',
  'next_stride',
  'official',
  'system',
]);

export const emailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .pipe(z.email('Enter a valid email address'));

export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const usernameSchema = z
  .string({ error: 'Username is required' })
  .trim()
  .toLowerCase()
  .min(USERNAME_MIN_LENGTH, `Username must be at least ${USERNAME_MIN_LENGTH} characters`)
  .max(USERNAME_MAX_LENGTH, `Username must be at most ${USERNAME_MAX_LENGTH} characters`)
  .regex(/^[a-z][a-z0-9_]*$/, 'Use letters, numbers and underscores, starting with a letter')
  .refine((value) => !RESERVED_USERNAMES.has(value), 'This username is reserved');

export const fullNameSchema = z
  .string({ error: 'Full name is required' })
  .trim()
  .min(1, 'Full name is required')
  .max(FULL_NAME_MAX_LENGTH, `Full name must be at most ${FULL_NAME_MAX_LENGTH} characters`);

/** Calendar date as YYYY-MM-DD, at least MIN_USER_AGE years ago and not absurdly old. */
export const dateOfBirthSchema = z.iso
  .date({ error: (issue) => (issue.input ? 'Use the format YYYY-MM-DD' : 'Enter your date of birth') })
  .refine((value) => {
    const age = ageFromDateOfBirth(value);
    return age >= MIN_USER_AGE && age <= 120;
  }, `You must be at least ${MIN_USER_AGE} years old`);

export const heightCmSchema = z.number({ error: 'Enter a number' }).min(50, 'Height looks too low').max(272, 'Height looks too high');
export const weightKgSchema = z.number({ error: 'Enter a number' }).min(20, 'Weight looks too low').max(400, 'Weight looks too high');

export function ageFromDateOfBirth(isoDate: string, now: Date = new Date()): number {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  let age = now.getUTCFullYear() - year;
  const beforeBirthday =
    now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

// ---------------------------------------------------------------------------
// Auth requests
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  // Never apply strength rules on login: just require something bounded.
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(PASSWORD_MAX_LENGTH),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string({ error: 'Refresh token is required' }).min(1).max(512),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const logoutSchema = refreshSchema;
export type LogoutInput = z.infer<typeof logoutSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string({ error: 'Reset token is required' }).min(1).max(512),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const privacySettingsSchema = z.object({
  showAge: z.boolean(),
  showBodyMetrics: z.boolean(),
  showGender: z.boolean(),
});

/**
 * PUT /api/users/me — every field is optional; only provided fields change.
 * Optional personal fields accept `null` to clear them.
 * Changing email requires the current password.
 */
export const updateProfileSchema = z
  .object({
    fullName: fullNameSchema,
    username: usernameSchema,
    email: emailSchema,
    currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    dateOfBirth: dateOfBirthSchema.nullable(),
    heightCm: heightCmSchema.nullable(),
    weightKg: weightKgSchema.nullable(),
    gender: z.enum(GENDERS).nullable(),
    runningExperience: z.enum(RUNNING_EXPERIENCES).nullable(),
    preferredDistance: z.enum(PREFERRED_DISTANCES).nullable(),
    fitnessGoals: z
      .array(z.enum(FITNESS_GOALS))
      .max(FITNESS_GOALS.length)
      .refine((goals) => new Set(goals).size === goals.length, 'Goals must be unique'),
    bio: z.string().trim().max(BIO_MAX_LENGTH, `Bio must be at most ${BIO_MAX_LENGTH} characters`).nullable(),
    privacy: privacySettingsSchema.partial(),
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).some((key) => key !== 'currentPassword'), {
    error: 'Provide at least one field to update',
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** Fields required before the profile is considered complete (profile setup step). */
export const profileSetupSchema = z.object({
  dateOfBirth: dateOfBirthSchema,
  runningExperience: z.enum(RUNNING_EXPERIENCES, { error: 'Choose your running experience' }),
  preferredDistance: z.enum(PREFERRED_DISTANCES, { error: 'Choose a preferred distance' }),
  fitnessGoals: z.array(z.enum(FITNESS_GOALS)).min(1, 'Choose at least one goal'),
  heightCm: heightCmSchema.nullable().optional(),
  weightKg: weightKgSchema.nullable().optional(),
  gender: z.enum(GENDERS).nullable().optional(),
  bio: z.string().trim().max(BIO_MAX_LENGTH).nullable().optional(),
});
export type ProfileSetupInput = z.infer<typeof profileSetupSchema>;

/** Lookup param: lenient (no reserved-word check) so unknown names 404 rather than 400. */
export const usernameParamSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(USERNAME_MAX_LENGTH),
});
