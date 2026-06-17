import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000, // 2 min per test
  expect: { timeout: 15000 },
  fullyParallel: false, // Tests share game state, run serially
  workers: 1,
  retries: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:8081',
    actionTimeout: 15000,
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
    },
  ],
});
