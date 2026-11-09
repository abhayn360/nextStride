import os from 'node:os';
import path from 'node:path';

import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'vitest/config';

loadDotenv({ quiet: true });

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/next_stride_test';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup.ts'],
    // Every file shares one database, so run files one at a time.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      TEST_DATABASE_URL: testDatabaseUrl,
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'test-secret-that-is-at-least-thirty-two-characters',
      AUTH_RATE_LIMIT_MAX: '1000',
      CORS_ORIGINS: 'http://localhost:8081',
      PUBLIC_BASE_URL: 'http://api.test',
      PASSWORD_RESET_URL: 'nextstride://reset-password',
      UPLOAD_DIR: path.join(os.tmpdir(), 'next-stride-test-uploads'),
      LOG_LEVEL: 'silent',
    },
  },
});
