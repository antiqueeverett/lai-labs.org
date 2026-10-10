import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 2,
  timeout: 45_000,
  forbidOnly: !!process.env.CI,
  updateSnapshots: 'none',
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  expect: { toHaveScreenshot: { animations: 'disabled', maxDiffPixels: 0 } },
  use: {
    baseURL: process.env.SITE_URL || 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' } },
  ],
  webServer: process.env.SITE_URL ? undefined : {
    command: 'node scripts/serve.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
})
