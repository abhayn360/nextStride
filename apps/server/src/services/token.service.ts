import type { TokenPair } from '@next-stride/shared';

import { env } from '../config/env';
import { type DbClient, prisma } from '../lib/prisma';
import { refreshTokenRepository } from '../repositories/refresh-token.repository';
import { generateOpaqueToken, hashToken, randomUUID } from '../utils/crypto';
import { Errors } from '../utils/errors';
import { signAccessToken } from '../utils/jwt';

export interface ClientMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS);
}

/** Issues an access token plus a new refresh token. Pass `familyId` when rotating. */
async function issueTokenPair(
  user: { id: string; tokenVersion: number },
  meta: ClientMeta,
  familyId: string = randomUUID(),
  db: DbClient = prisma,
): Promise<{ tokens: TokenPair; refreshTokenId: string }> {
  const refreshToken = generateOpaqueToken();
  const record = await refreshTokenRepository.create(
    {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt: refreshExpiry(),
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ipAddress: meta.ipAddress?.slice(0, 45) ?? null,
    },
    db,
  );
  return {
    tokens: {
      accessToken: signAccessToken(user.id, user.tokenVersion),
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
    },
    refreshTokenId: record.id,
  };
}

/**
 * Refresh token rotation with reuse detection:
 *  - every refresh revokes the presented token and issues a new one in the same family;
 *  - presenting a token that was already rotated means it leaked (or a client bug),
 *    so the entire family (that login session) is revoked.
 */
async function rotateRefreshToken(
  presentedToken: string,
  meta: ClientMeta,
): Promise<{ userId: string; tokens: TokenPair }> {
  const existing = await refreshTokenRepository.findByHash(hashToken(presentedToken));
  if (!existing) throw Errors.invalidToken('Invalid refresh token');

  if (existing.revokedAt) {
    if (existing.replacedById) {
      await refreshTokenRepository.revokeFamily(existing.familyId);
      throw Errors.refreshTokenReused();
    }
    // Revoked without a successor: the session was logged out or reset.
    throw Errors.invalidToken('This session has ended. Please sign in again.');
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    await refreshTokenRepository.revokeIfActive(existing.id);
    throw Errors.tokenExpired('Your session has expired. Please sign in again.');
  }

  const outcome = await prisma.$transaction(async (tx) => {
    const won = await refreshTokenRepository.revokeIfActive(existing.id, tx);
    if (!won) return null; // A concurrent request already rotated this token.
    const issued = await issueTokenPair(existing.user, meta, existing.familyId, tx);
    await refreshTokenRepository.linkReplacement(existing.id, issued.refreshTokenId, tx);
    return issued.tokens;
  });

  if (!outcome) {
    await refreshTokenRepository.revokeFamily(existing.familyId);
    throw Errors.refreshTokenReused();
  }

  return { userId: existing.userId, tokens: outcome };
}

/** Ends the session that owns this refresh token. Unknown tokens are ignored (idempotent logout). */
async function revokeSession(presentedToken: string): Promise<void> {
  const existing = await refreshTokenRepository.findByHash(hashToken(presentedToken));
  if (existing) await refreshTokenRepository.revokeFamily(existing.familyId);
}

export const tokenService = { issueTokenPair, rotateRefreshToken, revokeSession };
