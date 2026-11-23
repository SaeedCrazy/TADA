import { execSync } from 'node:child_process';

/** A dedicated database for tests. Each test file truncates its tables (see helpers.resetDb). */
export const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgresql://tada:tada@localhost:5432/tada_test?schema=public';

export default function setup() {
  if (!/tada_test/.test(TEST_DB)) throw new Error('Refusing to run tests against a database not named tada_test');
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: TEST_DB, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
  });
}
