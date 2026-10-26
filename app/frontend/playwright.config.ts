import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const isRemote = !!process.env.PLAYWRIGHT_BASE_URL;

/**
 * Specs that run only in the `admin` project (admin login). The `chromium`
 * project ignores the same list, so a full run never runs them as the
 * seeded player (who is redirected away from /admin).
 */
const ADMIN_SPECS = /(admin-automatons|automaton-badge|admin-cycle-controls|admin-season-control|admin-practice-arena|admin-battles)\.spec\.ts/;

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
    // Issue #174: tab title prefix and favicon per hostname. No auth or backend needed.
    {
      name: 'env-branding',
      testMatch: /env-branding\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: 'chromium',
      testIgnore: [/login\.spec\.ts/, ADMIN_SPECS, /env-branding\.spec\.ts/],
      use: {
        ...devices['Desktop Chrome'],
        screenshot: 'on',
        // Reuse auth state from setup project (skips login per test)
        storageState: '.auth/test_user_001.json',
      },
      dependencies: ['setup'],
    },
    // Spec #55: the admin projects stay after `chromium`. With one worker,
    // projects of the same dependency level run in this order, and the admin
    // specs run bulk cycles that change every seeded stable (credits, battles),
    // which the `chromium` specs assume untouched (seed state of test_user_001).
    // Admin setup logs in as the seeded `admin` and saves its state.
    {
      name: 'admin-setup',
      testMatch: /admin\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
      // Decision 43: after both admin specs, delete their e2e Automaton stables.
      teardown: 'admin-teardown',
    },
    {
      name: 'admin-teardown',
      testMatch: /admin\.teardown\.ts/,
    },
    // The admin Automatons page, the Automaton badge, Season Control, Practice Arena and Cycle Controls (which
    // runs a real Grand Melee slot) run as admin
    {
      name: 'admin',
      testMatch: ADMIN_SPECS,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/admin.json',
      },
      dependencies: ['admin-setup'],
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
