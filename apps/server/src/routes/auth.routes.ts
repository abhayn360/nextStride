import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from '@next-stride/shared';
import { Router } from 'express';

import { authController } from '../controllers/auth.controller';
import { createAuthRateLimiter, createRefreshRateLimiter, type RateLimitOptions } from '../middleware/rate-limit';
import { validate } from '../middleware/validate';

export function authRoutes(rateLimit: RateLimitOptions): Router {
  const router = Router();
  const credentialLimiter = createAuthRateLimiter(rateLimit);
  const refreshLimiter = createRefreshRateLimiter(rateLimit);

  router.post('/register', credentialLimiter, validate({ body: registerSchema }), authController.register);
  router.post('/login', credentialLimiter, validate({ body: loginSchema }), authController.login);
  router.post('/refresh', refreshLimiter, validate({ body: refreshSchema }), authController.refresh);
  router.post('/logout', refreshLimiter, validate({ body: logoutSchema }), authController.logout);
  router.post(
    '/forgot-password',
    credentialLimiter,
    validate({ body: forgotPasswordSchema }),
    authController.forgotPassword,
  );
  router.post(
    '/reset-password',
    credentialLimiter,
    validate({ body: resetPasswordSchema }),
    authController.resetPassword,
  );

  return router;
}
