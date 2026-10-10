import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const isRemote = !!process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run tests serially to avoid interference
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to prevent parallel execution issues
  timeout: 60000, // 60s per test (override with test.setTimeout for long journeys)
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    // Setup project: logs in once and saves auth state
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Login tests need a fresh (unauthenticated) browser context
    {
      name: 'login-tests',
      testMatch: /login\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        screenshot: 'on',
        storageState: { cookies: [], origins: [] },
      },
    },
    // Spec #55: admin setup logs in as the seeded `admin` and saves its state
    {
      name: 'admin-setup',
      testMatch: /admin\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Spec #55: the admin Automatons page and the Automaton badge run as admin
    {
      name: 'admin',
      testMatch: /(admin-automatons|automaton-badge)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/admin.json',
      },
      dependencies: ['admin-setup'],
    },
    {
      name: 'chromium',
      testIgnore: [/login\.spec\.ts/, /admin-automatons\.spec\.ts/, /automaton-badge\.spec\.ts/],
      use: {
        ...devices['Desktop Chrome'],
        screenshot: 'on',
        // Reuse auth state from setup project (skips login per test)
        storageState: '.auth/test_user_001.json',
      },
      dependencies: ['setup'],
    },
  ],
  // Only start local dev server when not testing against a remote environment
  ...(isRemote ? {} : {
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  }),
});
