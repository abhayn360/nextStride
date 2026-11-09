import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  TokenPair,
} from '@next-stride/shared';

import { env } from '../config/env';
import { Prisma } from '../generated/prisma/client';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { passwordResetTokenRepository } from '../repositories/password-reset-token.repository';
import { refreshTokenRepository } from '../repositories/refresh-token.repository';
import { type UserWithProfile, userRepository } from '../repositories/user.repository';
import { generateOpaqueToken, hashToken } from '../utils/crypto';
import { Errors } from '../utils/errors';
import { burnPasswordCheck, hashPassword, passwordNeedsRehash, verifyPassword } from '../utils/password';
import { mailService } from './mail.service';
import { type ClientMeta, tokenService } from './token.service';

export interface AuthResult {
  user: UserWithProfile;
  tokens: TokenPair;
}

/** Maps a unique-constraint race (two signups at once) onto the same friendly errors. */
function uniqueViolationTarget(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const meta = JSON.stringify(error.meta ?? {});
    if (meta.includes('email')) return 'email';
    if (meta.includes('username')) return 'username';
    return 'unknown';
  }
  return null;
}

async function register(input: RegisterInput, meta: ClientMeta): Promise<AuthResult> {
  const [emailTaken, usernameTaken] = await Promise.all([
    userRepository.emailExists(input.email),
    userRepository.usernameExists(input.username),
  ]);
  if (emailTaken) throw Errors.emailTaken();
  if (usernameTaken) throw Errors.usernameTaken();

  const passwordHash = await hashPassword(input.password);

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await userRepository.create({ ...input, passwordHash }, tx);
      const { tokens } = await tokenService.issueTokenPair(user, meta, undefined, tx);
      return { user, tokens };
    });
  } catch (error) {
    const target = uniqueViolationTarget(error);
    if (target === 'email') throw Errors.emailTaken();
    if (target === 'username') throw Errors.usernameTaken();
    throw error;
  }
}

async function login(input: LoginInput, meta: ClientMeta): Promise<AuthResult> {
  const user = await userRepository.findByEmail(input.email);
  if (!user) {
    await burnPasswordCheck(input.password);
    throw Errors.invalidCredentials();
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) throw Errors.invalidCredentials();

  // Transparently upgrade hashes when the Argon2 parameters are raised.
  const upgradedHash = passwordNeedsRehash(user.passwordHash) ? await hashPassword(input.password) : undefined;
  await userRepository.recordLogin(user.id, upgradedHash);

  const { tokens } = await tokenService.issueTokenPair(user, meta);
  return { user, tokens };
}

async function refresh(refreshToken: string, meta: ClientMeta): Promise<AuthResult> {
  const { userId, tokens } = await tokenService.rotateRefreshToken(refreshToken, meta);
  const user = await userRepository.findById(userId);
  if (!user) throw Errors.invalidToken();
  return { user, tokens };
}

function logout(refreshToken: string): Promise<void> {
  return tokenService.revokeSession(refreshToken);
}

/**
 * Always resolves the same way whether or not the email exists. The actual work
 * runs after the response is sent so response timing can't reveal registered emails.
 */
function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  const work = async () => {
    const user = await userRepository.findByEmail(input.email);
    if (!user?.profile) return;

    const token = generateOpaqueToken(32);
    await prisma.$transaction(async (tx) => {
      await passwordResetTokenRepository.invalidateOutstanding(user.id, tx);
      await passwordResetTokenRepository.create(
        {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
        },
        tx,
      );
    });

    const separator = env.PASSWORD_RESET_URL.includes('?') ? '&' : '?';
    const resetUrl = `${env.PASSWORD_RESET_URL}${separator}token=${encodeURIComponent(token)}`;
    await mailService.sendPasswordReset(user.email, user.profile.fullName, resetUrl, env.PASSWORD_RESET_TTL_MINUTES);
  };

  setImmediate(() => {
    work().catch((error) => logger.error({ err: error }, 'Password reset request failed'));
  });
  return Promise.resolve();
}

/** Single-use token; on success every session for the account is revoked. */
async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const record = await passwordResetTokenRepository.findByHash(hashToken(input.token));
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw Errors.invalidResetToken();
  }

  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction(async (tx) => {
    const consumed = await passwordResetTokenRepository.consume(record.id, tx);
    if (!consumed) throw Errors.invalidResetToken();
    await userRepository.setPassword(record.userId, passwordHash, tx);
    await refreshTokenRepository.revokeAllForUser(record.userId, tx);
  });
}

export const authService = { register, login, refresh, logout, requestPasswordReset, resetPassword };
