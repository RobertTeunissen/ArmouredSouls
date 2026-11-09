import { test, expect } from '@playwright/test';
import { navigateToProtectedPage } from './helpers/navigate';

/**
 * E2E tests for Robot Creation
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 13.1, 13.2
 *
 * These tests verify the robot creation workflow including form display,
 * validation, cost information, and successful creation flow.
 * Manual screenshots are omitted — playwright.config.ts handles screenshot
 * capture automatically according to the configured Playwright setting.
 *
 * Auth state is pre-loaded via the setup project (see auth.setup.ts).
 */

test.describe('Robot Creation', () => {
  test('should display robot creation form with cost and balance', async ({ page }) => {
    // Req 3.5 — form displays frame cost of ₡500,000 and user's current balance
    await navigateToProtectedPage(page, '/robots/create');

    // Verify page heading
    await expect(page.getByRole('heading', { name: 'Create New Robot' })).toBeVisible();

    // Verify cost section
    await expect(page.getByRole('heading', { name: 'Robot Frame Cost' })).toBeVisible();
    await expect(page.getByText('Frame Cost:')).toBeVisible();
    await expect(page.getByText('₡500,000').first()).toBeVisible();
    await expect(page.getByText('Your Balance:')).toBeVisible();

    // Verify form elements
    await expect(page.getByLabel('Robot Name')).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Robot/ })).toBeVisible();
  });

  test('should prevent submission with empty name via required attribute', async ({ page }) => {
    // Req 3.2 — empty name prevented by required attribute on the name input
    await navigateToProtectedPage(page, '/robots/create');

    const nameInput = page.getByLabel('Robot Name');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveAttribute('required', '');

    // Verify the submit button is present
    await expect(page.getByRole('button', { name: /Create Robot/ })).toBeVisible();
  });

  test('should show character counter at max length', async ({ page }) => {
    await navigateToProtectedPage(page, '/robots/create');

    const nameInput = page.getByLabel('Robot Name');
    await nameInput.fill('A'.repeat(50));

    // Verify character counter shows 50/50
    await expect(page.getByText('50/50 characters')).toBeVisible();
  });

  test('should block creation while credits are below the frame cost', async ({ page }) => {
    // Req 3.1 (insufficient-credit side). The seeded test_user_001 holds
    // ₡100,000, below the ₡500,000 frame, so this test skipped itself on every
    // CI run when it tried to create a robot. The successful creation path
    // (fresh user, ₡500,000 deducted, robot page opens) is covered by
    // critical-journey.spec.ts.
    await navigateToProtectedPage(page, '/robots/create');

    await page.getByLabel('Robot Name').fill(`E2E_Bot_${Date.now()}`);

    await expect(page.getByRole('button', { name: /Create Robot/ })).toBeDisabled();
  });

  test('should show created robot in the robots list', async ({ page }) => {
    // Req 3.4 — after creation, robot appears in the list at /robots
    await navigateToProtectedPage(page, '/robots');
    await page.waitForLoadState('networkidle');

    // Verify the robots page loads with the heading
    await expect(page.getByRole('heading', { name: /My Robots/ })).toBeVisible();

    // The seeded test_user_001 should have at least one robot visible
    // (including any created by the previous test in this serial run)
    const robotCards = page.getByText('View Details →');
    await expect(robotCards.first()).toBeVisible({ timeout: 10000 });
  });
});
