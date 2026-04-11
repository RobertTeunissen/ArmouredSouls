import { Page } from '@playwright/test';

/**
 * Options for registering a new user. All fields are auto-generated
 * with unique values if omitted.
 */
export interface RegisterOptions {
  username?: string;
  email?: string;
  password?: string;
  stableName?: string;
}

/**
 * The credentials used (or generated) during registration.
 */
export interface RegisterResult {
  username: string;
  email: string;
  password: string;
  stableName: string;
}

/**
 * Generates a short unique identifier for test data.
 * Format: `t{8-char hex}` (9 chars total, fits within 20-char username limit).
 * Uses timestamp base-36 + random suffix for uniqueness across runs.
 */
export function generateUniqueId(): string {
  const ts = Date.now().toString(36).slice(-6);
  const rand = Math.random().toString(36).slice(2, 4);
  return `t${ts}${rand}`;
}

/**
 * Registers a new user via the Registration_Form UI on `/login`.
 *
 * Navigates to `/login`, switches to the Register tab, fills in all
 * required fields (username, stable name, email, password, confirm password),
 * submits the form, and waits for redirect to `/onboarding` or `/dashboard`.
 *
 * Returns the credentials used so tests can reference them for assertions.
 */
export async function registerNewUser(
  page: Page,
  options?: RegisterOptions,
): Promise<RegisterResult> {
  const uniqueId = generateUniqueId();

  // Username max 20 chars, stable name max 30 chars
  const username = options?.username ?? uniqueId;
  const email = options?.email ?? `${uniqueId}@test.armouredsouls.com`;
  const password = options?.password ?? 'TestPass123!';
  const stableName = options?.stableName ?? `E2E ${uniqueId}`;

  // Navigate to the login page
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // If we got redirected to dashboard (auth state leaked), clear it and retry
  if (page.url().includes('/dashboard') || page.url().includes('/onboarding')) {
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  }

  // Switch to the Register tab
  await page.getByRole('tab', { name: 'Register' }).click();

  // Fill in the registration form fields
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Stable Name').fill(stableName);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm Password').fill(password);

  // Submit the form
  await page.getByRole('button', { name: 'Create Account' }).click();

  // Wait for redirect to /onboarding or /dashboard
  // If registration fails, the page stays on /login with an error message
  await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 30000 });

  return { username, email, password, stableName };
}
