import * as argon2 from 'argon2';

import { env } from '../config/env';

// OWASP recommended Argon2id parameters. Tests use cheaper settings to stay fast.
const options: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: env.NODE_ENV === 'test' ? 2 ** 12 : 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, options);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function passwordNeedsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, options);
}

let dummyHash: Promise<string> | undefined;

/**
 * Verify against a throwaway hash when the account doesn't exist, so login
 * takes the same time either way and doesn't reveal which emails are registered.
 */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('dummy-password-for-timing-safety-1');
  await verifyPassword(await dummyHash, password);
}
