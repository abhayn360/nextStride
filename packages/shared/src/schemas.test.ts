import { describe, expect, it } from 'vitest';

import {
  ageFromDateOfBirth,
  loginSchema,
  profileSetupSchema,
  registerSchema,
  updateProfileSchema,
  usernameSchema,
} from './schemas';

describe('registerSchema', () => {
  const valid = { fullName: 'Ada Runner', username: 'Ada_Runs', email: ' ADA@Example.com ', password: 'stride123' };

  it('normalises email and username', () => {
    const parsed = registerSchema.parse(valid);
    expect(parsed.email).toBe('ada@example.com');
    expect(parsed.username).toBe('ada_runs');
  });

  it('rejects weak passwords', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'short1' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: 'onlyletters' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: '12345678' }).success).toBe(false);
  });

  it('rejects invalid emails', () => {
    expect(registerSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });
});

describe('usernameSchema', () => {
  it.each(['me', 'admin', '1runner', 'ab', 'has space', 'dash-name', 'a'.repeat(21)])('rejects %s', (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(false);
  });

  it.each(['runner', 'ada_99', 'Kip'])('accepts %s', (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(true);
  });
});

describe('loginSchema', () => {
  it('does not apply password strength rules', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });
});

describe('updateProfileSchema', () => {
  it('rejects an empty update', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
    expect(updateProfileSchema.safeParse({ currentPassword: 'x' }).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(updateProfileSchema.safeParse({ bio: 'hi', passwordHash: 'x' }).success).toBe(false);
  });

  it('allows clearing optional fields with null', () => {
    const parsed = updateProfileSchema.parse({ heightCm: null, gender: null, bio: null });
    expect(parsed).toEqual({ heightCm: null, gender: null, bio: null });
  });

  it('rejects duplicate goals', () => {
    expect(updateProfileSchema.safeParse({ fitnessGoals: ['GET_FASTER', 'GET_FASTER'] }).success).toBe(false);
  });
});

describe('profileSetupSchema', () => {
  it('requires the core running profile', () => {
    expect(profileSetupSchema.safeParse({ dateOfBirth: '1990-01-01' }).success).toBe(false);
    expect(
      profileSetupSchema.safeParse({
        dateOfBirth: '1990-01-01',
        runningExperience: 'BEGINNER',
        preferredDistance: 'FIVE_K',
        fitnessGoals: ['BUILD_HABIT'],
      }).success,
    ).toBe(true);
  });

  it('rejects users younger than 13', () => {
    const recent = new Date();
    recent.setUTCFullYear(recent.getUTCFullYear() - 5);
    const iso = recent.toISOString().slice(0, 10);
    expect(profileSetupSchema.shape.dateOfBirth.safeParse(iso).success).toBe(false);
  });
});

describe('ageFromDateOfBirth', () => {
  it('accounts for birthdays later in the year', () => {
    const now = new Date('2026-06-15T00:00:00Z');
    expect(ageFromDateOfBirth('2000-06-15', now)).toBe(26);
    expect(ageFromDateOfBirth('2000-06-16', now)).toBe(25);
  });
});
