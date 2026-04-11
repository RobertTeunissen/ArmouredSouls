import { test, expect } from '@playwright/test';
import { generateUniqueId } from './helpers/register';

/**
 * E2E tests for Login Page
 *
 * Validates: Requirements 11.2, 11.3, 13.1, 13.2
 *
 * These tests verify login functionality and auth security boundaries.
 * Manual screenshots are omitted — playwright.config.ts handles screenshot
 * capture automatically according to the configured Playwright setting.
 */

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login page correctly', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'ARMOURED SOULS' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(page.getByLabel('Username or Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  test('should show generic error for invalid credentials', async ({ page }) => {
    // Req 11.2 — error must be generic, not revealing which field was wrong
    await page.getByLabel('Username or Email').fill('invalid_user');
    await page.getByLabel('Password').fill('wrong_password');

    await page.getByRole('button', { name: 'Login' }).click();

    // Must show "Invalid credentials" — not "username not found" or "wrong password"
    await expect(page.getByText('Invalid credentials')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Updated credentials: test_user_001 / testpass123 (player1 was removed)
    await page.getByLabel('Username or Email').fill('test_user_001');
    await page.getByLabel('Password').fill('testpass123');

    await page.getByRole('button', { name: 'Login' }).click();

    // Wait for navigation to dashboard or onboarding
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20000 });

    // If redirected to onboarding, skip the tutorial
    if (page.url().includes('/onboarding')) {
      // Wait for the onboarding page to fully render
      await page.waitForLoadState('networkidle');

      // The "Skip Tutorial" button has aria-label="Skip Tutorial"
      const skipButton = page.getByRole('button', { name: /Skip Tutorial/i });
      await expect(skipButton).toBeVisible({ timeout: 10000 });
      await skipButton.click();

      // Confirmation modal — button has aria-label="Confirm skip tutorial"
      const skipConfirm = page.getByRole('button', { name: /Confirm skip tutorial/i });
      await expect(skipConfirm).toBeVisible({ timeout: 10000 });
      await skipConfirm.click();

      await page.waitForURL('**/dashboard', { timeout: 15000 });
    }

    await page.waitForLoadState('networkidle');

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should have responsive design on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'ARMOURED SOULS' })).toBeVisible();
    await expect(page.getByLabel('Username or Email')).toBeVisible();
  });

  test('should reject registration with password shorter than 8 characters', async ({
    page,
  }) => {
    // Req 11.3 — security: registration form must reject passwords < 8 chars
    await page.getByRole('tab', { name: 'Register' }).click();

    const uniqueId = generateUniqueId();
    await page.getByLabel('Username').fill(uniqueId);
    await page.getByLabel('Stable Name').fill(`Short PW ${uniqueId}`);
    await page.getByLabel('Email').fill(`${uniqueId}@test.armouredsouls.com`);
    await page.getByLabel('Password', { exact: true }).fill('Ab1!xyz');
    await page.getByLabel('Confirm Password').fill('Ab1!xyz');

    await page.getByRole('button', { name: 'Create Account' }).click();

    // Validation error for password minimum length
    await expect(
      page.getByText('Password must be at least 8 characters long'),
    ).toBeVisible();

    // Verify we're still on the login page (form was not submitted)
    expect(page.url()).toContain('/login');
  });
});
