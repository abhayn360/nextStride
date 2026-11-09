import jwt from 'jsonwebtoken';

import { env } from '../config/env';
import { Errors } from './errors';

const ISSUER = 'next-stride-api';
const AUDIENCE = 'next-stride-app';

export interface AccessTokenClaims {
  sub: string;
  /** User.tokenVersion at issue time; bumping it invalidates outstanding access tokens. */
  ver: number;
  typ: 'access';
}

export function signAccessToken(userId: string, tokenVersion: number): string {
  const claims: Omit<AccessTokenClaims, 'sub'> = { ver: tokenVersion, typ: 'access' };
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (
      typeof payload !== 'object' ||
      payload.typ !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.ver !== 'number'
    ) {
      throw Errors.invalidToken();
    }
    return { sub: payload.sub, ver: payload.ver, typ: 'access' };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw Errors.tokenExpired('Access token expired');
    throw Errors.invalidToken('Invalid access token');
  }
}
