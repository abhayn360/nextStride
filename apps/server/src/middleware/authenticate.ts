import type { NextFunction, Request, Response } from 'express';

import { userRepository } from '../repositories/user.repository';
import { Errors } from '../utils/errors';
import { verifyAccessToken } from '../utils/jwt';

/**
 * Requires `Authorization: Bearer <access token>`.
 * The user's tokenVersion is checked on every request so a password reset
 * immediately invalidates access tokens that haven't expired yet.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.get('authorization');
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  if (!match?.[1]) throw Errors.unauthenticated();

  const claims = verifyAccessToken(match[1]);
  const user = await userRepository.findAuthState(claims.sub);
  if (!user || user.tokenVersion !== claims.ver) throw Errors.invalidToken('Session is no longer valid');

  req.auth = { userId: user.id };
  next();
}

/** Narrowing helper for controllers mounted behind `authenticate`. */
export function requireUserId(req: Request): string {
  if (!req.auth) throw Errors.unauthenticated();
  return req.auth.userId;
}
