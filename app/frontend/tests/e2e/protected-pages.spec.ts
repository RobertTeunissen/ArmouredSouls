import { test, expect } from '@playwright/test';
import { navigateToProtectedPage } from './helpers/navigate';

/**
 * E2E smoke tests for protected pages and auth security verification.
 *
 * Validates: Requirements 11.1, 11.2, 11.4, 12.1, 12.2, 12.3, 12.4
 */

test.describe('Protected Pages — Smoke Tests', () => {
  const protectedPages = [
    { path: '/dashboard', heading: 'Command Center' },
    { path: '/robots', heading: 'My Robots' },
    { path: '/weapon-shop', heading: 'Weapon Shop' },
    { path: '/battle-history', heading: 'Battle History' },
    { path: '/league-standings', heading: 'League Standings' },
    { path: '/facilities', heading: 'Stable Facilities' },
    { path: '/profile', heading: 'My Profile' },
    { path: '/guide', heading: /Game Guide/i },
    { path: '/changelog', heading: /What's New/i },
  ];

  for (const { path, heading } of protectedPages) {
    test(`${path} loads and displays its primary heading`, async ({ page }) => {
      await navigateToProtectedPage(page, path);
      await expect(
        page.getByRole('heading', { name: heading }),
      ).toBeVisible({ timeout: 10000 });
    });
  }

  test('/robots displays a list of robots or an empty state prompt', async ({ page }) => {
    await navigateToProtectedPage(page, '/robots');

    // Either the robot list has items or the empty state is shown
    const robotHeading = page.getByRole('heading', { name: 'My Robots' });
    await expect(robotHeading).toBeVisible({ timeout: 10000 });

    const emptyPrompt = page.getByText("You don't have any robots yet.");
    const createButton = page.getByRole('button', { name: 'Create Your First Robot' });
    const robotCard = page.locator('[class*="cursor-pointer"]').first();

    const hasEmpty = await emptyPrompt.isVisible().catch(() => false);
    if (hasEmpty) {
      await expect(createButton).toBeVisible();
    } else {
      // At least one robot card or table row should be visible
      await expect(robotCard).toBeVisible({ timeout: 5000 });
    }
  });

  test('/facilities displays facility upgrade options', async ({ page }) => {
    await navigateToProtectedPage(page, '/facilities');

    await expect(
      page.getByRole('heading', { name: 'Stable Facilities' }),
    ).toBeVisible({ timeout: 10000 });

    // The default tab is "Facilities & Upgrades"
    await expect(page.getByRole('button', { name: 'Facilities & Upgrades' })).toBeVisible();

    // At least one upgrade button should be present
    const upgradeButton = page.getByRole('button', { name: /Upgrade/i }).first();
    await expect(upgradeButton).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Auth Security — Unauthenticated Redirect', () => {
  // Use a fresh browser context with no auth state
  test.use({ storageState: { cookies: [], origins: [] } });

  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login', { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);

    // Protected page content should NOT be visible
    await expect(
      page.getByRole('heading', { name: 'Command Center' }),
    ).not.toBeVisible();
  });
});

test.describe('Auth Security — Invalid Credentials', () => {
  // Use a fresh browser context with no auth state
  test.use({ storageState: { cookies: [], origins: [] } });

  test('invalid login credentials show generic "Invalid credentials" error', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Username or Email').fill('nonexistent_user_xyz');
    await page.getByLabel('Password').fill('totally_wrong_password');
    await page.getByRole('button', { name: 'Login' }).click();

    // Error message should be generic — must not reveal which field was wrong
    await expect(page.getByText('Invalid credentials')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Auth Security — JWT Token Removal', () => {
  test('removing JWT token and navigating redirects to /login', async ({ page }) => {
    // First navigate to a protected page to confirm auth works
    await navigateToProtectedPage(page, '/dashboard');
    await expect(
      page.getByRole('heading', { name: 'Command Center' }),
    ).toBeVisible({ timeout: 10000 });

    // Remove the JWT token from localStorage
    await page.evaluate(() => localStorage.removeItem('token'));

    // Navigate to a protected route — should redirect to login
    await page.goto('/robots');
    await page.waitForURL('**/login', { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
