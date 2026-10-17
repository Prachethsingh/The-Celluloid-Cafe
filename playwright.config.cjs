const { defineConfig, devices } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const apiPort = Number(process.env.E2E_API_PORT || 8000);
const webPort = Number(process.env.E2E_WEB_PORT || 5173);
process.env.E2E_SERVER_TOKEN ||= randomUUID();
process.env.E2E_ADMIN_EMAIL = 'test-admin@example.test';
process.env.E2E_ADMIN_PASSWORD ||= randomUUID();
const apiEnvironment = { PORT: String(apiPort), ALLOWED_ORIGINS: `http://127.0.0.1:${webPort}`, VEGA_OFFLINE: 'true', E2E_SERVER_TOKEN: process.env.E2E_SERVER_TOKEN, ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL, ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD, MEDIA_DIRECTORY: path.join(__dirname, '.build/e2e') };

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: process.env.E2E_ADAPTIVE === '1' ? '**/adaptive.spec.js' : '**/*.spec.js',
  testIgnore: process.env.E2E_ADAPTIVE === '1' ? [] : ['**/adaptive.spec.js'],
  globalSetup: './e2e/global-setup.cjs',
  globalTeardown: './e2e/global-teardown.cjs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 30000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list'], ['json', { outputFile: process.env.E2E_ADAPTIVE === '1' ? '.build/e2e/adaptive-results.json' : '.build/e2e/results.json' }]],
  use: { baseURL: `http://127.0.0.1:${webPort}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    ...(process.env.E2E_ALL_BROWSERS === '1' ? [
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
      { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ] : []),
  ],
  webServer: process.platform === 'win32' ? [] : [
    { command: 'node scripts/service.cjs api', url: `http://127.0.0.1:${apiPort}/health`, reuseExistingServer: !process.env.CI, timeout: 60000, env: apiEnvironment },
    { command: 'node scripts/service.cjs web', url: `http://127.0.0.1:${webPort}`, reuseExistingServer: !process.env.CI, timeout: 60000, env: { E2E_SERVER_TOKEN: process.env.E2E_SERVER_TOKEN, API_PROXY_TARGET: `http://127.0.0.1:${apiPort}` } },
  ],
});
