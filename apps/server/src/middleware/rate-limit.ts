import { type ApiErrorBody, ERROR_CODES } from '@next-stride/shared';
import { rateLimit } from 'express-rate-limit';

export interface RateLimitOptions {
  /** Requests allowed per window, per client IP. */
  max: number;
  windowMinutes: number;
}

function limiter({ max, windowMinutes }: RateLimitOptions, message: string) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res, _next, options) => {
      const body: ApiErrorBody = { error: { code: ERROR_CODES.RATE_LIMITED, message } };
      res.status(options.statusCode).json(body);
    },
  });
}

/** Brute-force protection for credential endpoints (login, register, password reset). */
export function createAuthRateLimiter(options: RateLimitOptions) {
  return limiter(options, 'Too many attempts. Please wait a few minutes and try again.');
}

/** Refresh is called routinely by clients, so it gets a looser budget. */
export function createRefreshRateLimiter(options: RateLimitOptions) {
  return limiter({ ...options, max: options.max * 6 }, 'Too many session refreshes. Please try again shortly.');
}
