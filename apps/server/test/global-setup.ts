import { execSync } from 'node:child_process';

/** Applies migrations to the disposable test database once per run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set');
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error(`Refusing to run tests against "${url}": the database name must contain "test".`);
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  });
}
