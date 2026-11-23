import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3100', locale: 'fa-IR', timezoneId: 'Asia/Tehran', trace: 'off' },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /04-admin/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } }, testMatch: /04-admin/ },
  ],
  webServer: [
    { command: 'bash e2e/start-api.sh', url: 'http://localhost:4100/api/health', timeout: 120_000, reuseExistingServer: false, stdout: 'pipe' },
    {
      command: 'npx next build && npx next start -p 3100',
      url: 'http://localhost:3100/shop',
      timeout: 300_000,
      reuseExistingServer: false,
      env: { API_INTERNAL_URL: 'http://localhost:4100', NEXT_PUBLIC_SITE_URL: 'http://localhost:3100' },
    },
  ],
});
