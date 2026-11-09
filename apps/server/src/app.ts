import { randomUUID } from 'node:crypto';

import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { env } from './config/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import type { RateLimitOptions } from './middleware/rate-limit';
import { authRoutes } from './routes/auth.routes';
import { runRoutes } from './routes/run.routes';
import { userRoutes } from './routes/user.routes';
import { uploadsRoot } from './services/avatar-storage.service';

export interface AppOptions {
  rateLimit: RateLimitOptions;
  corsOrigins: string[];
}

export function createApp(overrides: Partial<AppOptions> = {}): Express {
  const options: AppOptions = {
    rateLimit: { max: env.AUTH_RATE_LIMIT_MAX, windowMinutes: env.AUTH_RATE_LIMIT_WINDOW_MINUTES },
    corsOrigins: env.CORS_ORIGINS,
    ...overrides,
  };

  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      // Native apps send no Origin header; browsers must be on the allowlist.
      origin: (origin, callback) => callback(null, !origin || options.corsOrigins.includes(origin)),
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
      maxAge: 600,
    }),
  );
  // Run uploads parse their own (larger) JSON bodies; everything else is capped at 20 KB.
  app.use('/api/runs', runRoutes());
  app.use(express.json({ limit: '20kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Uploaded avatars. File names are unguessable; no directory listing.
  app.use('/uploads', express.static(uploadsRoot(), { index: false, dotfiles: 'deny', maxAge: '7d' }));

  app.use('/api/auth', authRoutes(options.rateLimit));
  app.use('/api/users', userRoutes());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
