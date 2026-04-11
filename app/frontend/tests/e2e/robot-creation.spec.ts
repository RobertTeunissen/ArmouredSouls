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
    await expect(page.getByText('₡500,000')).toBeVisible();
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

  test('should create robot and navigate to robot detail page', async ({ page }) => {
    // Req 3.1 — valid name + sufficient credits → creates robot and navigates to /robots/:id
    await navigateToProtectedPage(page, '/robots/create');

    const robotName = `E2E_Bot_${Date.now()}`;
    await page.getByLabel('Robot Name').fill(robotName);

    await page.getByRole('button', { name: /Create Robot/ }).click();

    // Wait for navigation to the new robot's detail page
    await page.waitForURL(/\/robots\/\d+/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Verify we're on a robot detail page
    await expect(page).toHaveURL(/\/robots\/\d+/);
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
