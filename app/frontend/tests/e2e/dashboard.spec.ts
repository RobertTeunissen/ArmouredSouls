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
    await page.waitForLoadState('networkidle');
  });

  test('should display dashboard with user profile', async ({ page }) => {
    // Check main dashboard heading
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
    // Check stable name is displayed (format: "{stableName}'s Stable")
    await expect(page.getByText(/Stable$/)).toBeVisible();
  });

  test('should display credits balance', async ({ page }) => {
    // Check Financial Overview section heading exists
    await expect(page.getByRole('heading', { name: 'Financial Overview' })).toBeVisible();

    // Check that a credits amount is visible (₡ symbol followed by digits)
    await expect(page.getByText('Current Balance')).toBeVisible();
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

    // Verify main elements are still visible
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Financial Overview' })).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    // Verify main heading is still visible
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
  });
});
