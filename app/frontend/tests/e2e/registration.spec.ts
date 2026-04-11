import { test, expect } from '@playwright/test';
import { registerNewUser, generateUniqueId } from './helpers/register';

/**
 * E2E tests for the Registration flow.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 *
 * All tests use a fresh (unauthenticated) browser context so the /login page
 * renders the registration form instead of redirecting to /dashboard.
 */

// Override the chromium project's auth state — registration needs a clean session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Registration Flow', () => {
  test('valid registration redirects to /onboarding or /dashboard', async ({ page }) => {
    // Req 1.1, 1.6 — unique credentials, successful redirect
    const result = await registerNewUser(page);

    // The helper already waits for redirect; verify we landed correctly
    expect(page.url()).toMatch(/\/(onboarding|dashboard)/);

    // Verify the credentials were unique (helper generates them)
    expect(result.username).toMatch(/^t[a-z0-9]+$/);
    expect(result.email).toContain('@test.armouredsouls.com');
  });

  test('duplicate username shows error message', async ({ page }) => {
    // Req 1.2, 1.6 — register a user, then try the same username again
    const first = await registerNewUser(page);

    // Clear auth state so /login doesn't redirect to /dashboard
    await page.evaluate(() => localStorage.clear());

    // Navigate back to /login for a second registration attempt
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'Register' }).click();

    // Use the same username but a different email
    const uniqueId = generateUniqueId();
    await page.getByLabel('Username').fill(first.username);
    await page.getByLabel('Stable Name').fill(`Dup ${uniqueId}`);
    await page.getByLabel('Email').fill(`${uniqueId}@test.armouredsouls.com`);
    await page.getByLabel('Password', { exact: true }).fill('TestPass123!');
    await page.getByLabel('Confirm Password').fill('TestPass123!');

    await page.getByRole('button', { name: 'Create Account' }).click();

    // The form should display the duplicate username error inline
    await expect(page.getByText('Username is already taken')).toBeVisible({ timeout: 10000 });
  });

  test('duplicate email shows error message', async ({ page }) => {
    // Req 1.3, 1.6 — register a user, then try the same email again
    const first = await registerNewUser(page);

    // Clear auth state so /login doesn't redirect to /dashboard
    await page.evaluate(() => localStorage.clear());

    // Navigate back to /login for a second registration attempt
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'Register' }).click();

    // Use a different username but the same email
    const uniqueId = generateUniqueId();
    await page.getByLabel('Username').fill(uniqueId);
    await page.getByLabel('Stable Name').fill(`Dup ${uniqueId}`);
    await page.getByLabel('Email').fill(first.email);
    await page.getByLabel('Password', { exact: true }).fill('TestPass123!');
    await page.getByLabel('Confirm Password').fill('TestPass123!');

    await page.getByRole('button', { name: 'Create Account' }).click();

    // The form should display the duplicate email error inline
    await expect(page.getByText('Email is already registered')).toBeVisible({ timeout: 10000 });
  });

  test('password shorter than minimum length shows validation error', async ({ page }) => {
    // Req 1.4 — client-side validation catches short passwords
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'Register' }).click();

    const uniqueId = generateUniqueId();
    await page.getByLabel('Username').fill(uniqueId);
    await page.getByLabel('Stable Name').fill(`Short PW ${uniqueId}`);
    await page.getByLabel('Email').fill(`${uniqueId}@test.armouredsouls.com`);
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByLabel('Confirm Password').fill('short');

    await page.getByRole('button', { name: 'Create Account' }).click();

    // Client-side validation shows the password length error
    await expect(
      page.getByText('Password must be at least 8 characters long'),
    ).toBeVisible();
  });

  test('empty required field prevents submission and shows validation indicator', async ({
    page,
  }) => {
    // Req 1.5 — the form uses noValidate with custom client-side validation.
    // Leaving username empty triggers the "at least 3 characters" validation.
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'Register' }).click();

    // Fill everything except username (leave it empty)
    const uniqueId = generateUniqueId();
    await page.getByLabel('Stable Name').fill(`Empty Field ${uniqueId}`);
    await page.getByLabel('Email').fill(`${uniqueId}@test.armouredsouls.com`);
    await page.getByLabel('Password', { exact: true }).fill('TestPass123!');
    await page.getByLabel('Confirm Password').fill('TestPass123!');

    await page.getByRole('button', { name: 'Create Account' }).click();

    // Client-side validation prevents submission and shows an error for the empty field
    await expect(
      page.getByText('Username must be at least 3 characters long'),
    ).toBeVisible();

    // Verify we're still on the login page (form was not submitted)
    expect(page.url()).toContain('/login');
  });
});
