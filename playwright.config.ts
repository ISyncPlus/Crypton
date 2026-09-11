import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a running stack:
 *   API  on http://localhost:5080 (Development, simulated blockchain and payments, demo data)
 *   Web  on http://localhost:4200 (npm start)
 *   Mailpit on http://localhost:8025 for confirmation emails
 * Use a freshly reset development database for repeatable results.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
    locale: 'en-NG',
    timezoneId: 'Africa/Lagos',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, channel: process.env['E2E_CHANNEL'] || undefined },
    },
  ],
});
