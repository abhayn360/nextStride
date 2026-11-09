import type { AuthResponse, RegisterInput } from '@next-stride/shared';
import request from 'supertest';

import { type AppOptions, createApp } from '../src/app';
import { MemoryTransport } from '../src/services/mail.service';

/** Captures outgoing email for assertions (installed in setup.ts). */
export const mailbox = new MemoryTransport();

export function makeApi(overrides: Partial<AppOptions> = {}) {
  return request(createApp(overrides));
}

export const api = makeApi();

let counter = 0;
export function userInput(overrides: Partial<RegisterInput> = {}): RegisterInput {
  counter += 1;
  return {
    fullName: 'Ada Runner',
    username: `runner_${counter}`,
    email: `runner${counter}@example.com`,
    password: 'stride123',
    ...overrides,
  };
}

export async function registerUser(overrides: Partial<RegisterInput> = {}) {
  const input = userInput(overrides);
  const res = await api.post('/api/auth/register').send(input).expect(201);
  const body = res.body as AuthResponse;
  return { input, ...body, auth: { Authorization: `Bearer ${body.tokens.accessToken}` } };
}

export const completeProfile = {
  dateOfBirth: '1994-05-12',
  runningExperience: 'INTERMEDIATE',
  preferredDistance: 'HALF_MARATHON',
  fitnessGoals: ['GET_FASTER', 'TRAIN_FOR_RACE'],
} as const;

/** Resolves once `predicate` is true (for work the API defers until after responding). */
export async function eventually<T>(read: () => T | undefined, timeoutMs = 3000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = read();
    if (value !== undefined) return value;
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
