import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { passwordResetTokenRepository } from './repositories/password-reset-token.repository';
import { refreshTokenRepository } from './repositories/refresh-token.repository';

const HOUSEKEEPING_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function main() {
  await prisma.$connect();

  const app = createApp();
  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info(`NEXT STRIDE API listening on http://${env.HOST}:${env.PORT} (${env.NODE_ENV})`);
  });

  const housekeeping = setInterval(() => {
    Promise.all([refreshTokenRepository.deleteExpired(), passwordResetTokenRepository.deleteExpired()])
      .then(([refresh, reset]) => logger.debug({ refresh: refresh.count, reset: reset.count }, 'Purged expired tokens'))
      .catch((error) => logger.error({ err: error }, 'Token housekeeping failed'));
  }, HOUSEKEEPING_INTERVAL_MS);
  housekeeping.unref();

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    clearInterval(housekeeping);
    server.close(() => {
      prisma
        .$disconnect()
        .catch(() => undefined)
        .finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
