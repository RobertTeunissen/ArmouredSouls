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
 * Generates a unique identifier with format: `e2e_{timestamp}_{randomSuffix}`
 * where randomSuffix is a 4-character hex string.
 * Used for usernames, emails, and stable names to prevent collisions.
 */
export function generateUniqueId(): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(16).slice(2, 6);
  return `e2e_${timestamp}_${randomSuffix}`;
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

  const username = options?.username ?? uniqueId;
  const email = options?.email ?? `${uniqueId}@test.armouredsouls.com`;
  const password = options?.password ?? 'TestPass123!';
  const stableName = options?.stableName ?? `E2E Stable ${uniqueId}`;

  // Navigate to the login page
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

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
