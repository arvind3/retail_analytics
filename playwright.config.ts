import { defineConfig } from '@playwright/test';

const liveBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = liveBaseUrl
  ? liveBaseUrl.endsWith('/')
    ? liveBaseUrl
    : `${liveBaseUrl}/`
  : 'http://localhost:4173';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    headless: true
  },
  ...(liveBaseUrl
    ? {}
    : {
        webServer: {
          command: 'npm run preview -- --host',
          url: 'http://localhost:4173',
          reuseExistingServer: !process.env.CI,
          timeout: 120000
        }
      })
});
