import { test, expect } from '@playwright/test';

/**
 * E2E tests for Dashboard Page
 * These tests verify the dashboard displays correctly after login
 *
 * Auth state is pre-loaded via the setup project (see auth.setup.ts).
 */

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    // Auth state already loaded — go straight to dashboard
    await page.goto('/dashboard');
    // Wait for main content to render instead of networkidle
    await page.getByRole('heading', { name: 'Command Center' }).waitFor({ state: 'visible', timeout: 15000 });
  });

  test('should display dashboard with user profile', async ({ page }) => {
    // Check main dashboard heading
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
    // Check stable name is displayed (format: "{stableName}'s Stable")
    await expect(page.getByText(/Stable$/)).toBeVisible();
  });

  test('should display the Overview_Row with all three tiles', async ({ page }) => {
    // Spec #48 replaced the "Stable Overview" and "Financial Overview" cards with three
    // tiles. Tile count and order never depend on data availability, so all three must be
    // present whatever the cycle read returned.
    await expect(page.getByRole('heading', { name: 'Prestige' })).toBeVisible();
    await expect(page.getByRole('heading', { name: "Today's Battles" })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Credits' })).toBeVisible();
  });

  test('should display credits balance', async ({ page }) => {
    // The balance lives on the Credits tile and survives a failed cycle-progress read
    // (Requirement 6 criterion 10), so it is safe to assert unconditionally.
    await expect(page.getByRole('heading', { name: 'Credits' })).toBeVisible();
    await expect(page.getByText('Current balance')).toBeVisible();

    // Check that a credits amount is visible (₡ symbol followed by digits)
    const creditsElement = page.getByText(/₡[\d,]+/);
    await expect(creditsElement.first()).toBeVisible();
  });

  test('should display navigation menu', async ({ page }) => {
    // Check the Dashboard nav button is present
    await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible();

    // Check dropdown menu buttons exist (rendered as "{label} ▾")
    await expect(page.getByRole('button', { name: 'Robots ▾' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Battle ▾' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stable ▾' })).toBeVisible();
  });

  test('should display robots section with robot cards', async ({ page }) => {
    // The seeded test_user_001 has robots — assert "My Robots" heading is visible
    await expect(page.getByRole('heading', { name: 'My Robots' })).toBeVisible();

    // Robot cards have role="button" and contain ELO info
    const robotCards = page.getByRole('button').filter({ hasText: 'ELO:' });
    await expect(robotCards.first()).toBeVisible();

    // Verify robot card contains expected information fields
    await expect(page.getByText('ELO:').first()).toBeVisible();
    await expect(page.getByText('League:').first()).toBeVisible();
  });

  test('should be responsive on tablet', async ({ page }) => {
    // Set viewport to tablet size
    await page.setViewportSize({ width: 768, height: 1024 });

    // Verify main elements are still visible. Below 1024px the Overview_Row stacks to a
    // single column, so all three tiles remain present — the layout changes, not the
    // content (Requirement 13).
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Credits' })).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    // Verify main heading is still visible
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
  });
});
