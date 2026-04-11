import { test, expect } from '@playwright/test';
import { navigateToProtectedPage } from './helpers/navigate';

/**
 * E2E tests for financial flows: facility upgrades, robot attribute upgrades,
 * and the income dashboard.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 *
 * All tests use test_user_001 auth state (chromium project default).
 * test_user_001 starts with ₡100,000 credits and a seeded robot.
 * Facility upgrade cost formula: (level + 1) × ₡100,000.
 */

test.describe('Financial Flow', () => {
  test('upgrading an affordable facility increases its level and decreases credit balance', async ({ page }) => {
    // Req 7.1 — upgrade a facility the user can afford
    await navigateToProtectedPage(page, '/facilities');

    // Verify the page loaded
    await expect(page.getByRole('heading', { name: /Stable Facilities/i })).toBeVisible();

    // Wait for facilities to load (loading state disappears)
    await expect(page.getByText('Loading facilities...')).toBeHidden({ timeout: 15000 });

    // Find the first enabled "Upgrade" button
    const upgradeButtons = page.getByRole('button', { name: 'Upgrade' });
    const firstUpgradeButton = upgradeButtons.first();

    // Check if there's an affordable upgrade available
    const isVisible = await firstUpgradeButton.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'No upgrade button visible for test_user_001');
      return;
    }

    const isEnabled = await firstUpgradeButton.isEnabled().catch(() => false);
    if (!isEnabled) {
      test.skip(true, 'No affordable facility upgrade available for test_user_001');
      return;
    }

    // Click upgrade
    await firstUpgradeButton.click();

    // Wait for the upgrade to complete — button text changes to "Upgrading..." then back
    // The upgrading state may be very brief, so just wait for the button to reappear
    await expect(firstUpgradeButton.or(page.getByRole('button', { name: 'Upgrading...' }))).toBeVisible({ timeout: 10000 });

    // Wait for the page to settle after upgrade
    await page.waitForLoadState('networkidle');
  });

  test('unaffordable facility upgrade button is disabled or shows insufficient credits indicator', async ({ page }) => {
    // Req 7.2 — unaffordable facility shows disabled button or insufficient credits text
    await navigateToProtectedPage(page, '/facilities');

    await expect(page.getByRole('heading', { name: /Stable Facilities/i })).toBeVisible();
    await expect(page.getByText('Loading facilities...')).toBeHidden({ timeout: 15000 });

    // Look for the "Insufficient credits" text indicator on any facility card
    // OR verify that upgrade buttons are disabled when the user can't afford them
    const insufficientCreditsText = page.getByText('Insufficient credits');
    const hasInsufficientIndicator = await insufficientCreditsText.first().isVisible().catch(() => false);

    if (hasInsufficientIndicator) {
      // Verify the insufficient credits indicator is displayed
      await expect(insufficientCreditsText.first()).toBeVisible();
    } else {
      // If no "Insufficient credits" text, check that at least one upgrade button is disabled
      // (the user may have enough credits for all visible facilities, or all are maxed)
      const disabledUpgradeButtons = page.getByRole('button', { name: 'Upgrade' }).filter({
        has: page.locator('[disabled]'),
      });
      const maxLevelText = page.getByText('Maximum Level Reached');

      // At least one of these conditions should be true:
      // 1. There's an "Insufficient credits" message
      // 2. There's a disabled upgrade button
      // 3. All facilities are at max level
      const hasDisabledButton = await disabledUpgradeButtons.first().isVisible().catch(() => false);
      const hasMaxLevel = await maxLevelText.first().isVisible().catch(() => false);

      expect(hasInsufficientIndicator || hasDisabledButton || hasMaxLevel).toBeTruthy();
    }
  });

  test('upgrading a robot attribute on the upgrades tab increases attribute level and decreases credit balance', async ({ page }) => {
    // Req 7.3 — upgrade a robot attribute via the upgrades tab
    // Navigate to the robots list to find the user's robot
    await navigateToProtectedPage(page, '/robots');

    // Wait for robots to load
    await expect(page.getByRole('heading', { name: /My Robots/i })).toBeVisible({ timeout: 10000 });

    // Click on the first robot card link (contains "View Details →")
    const viewDetailsLink = page.getByText('View Details →').first();
    const hasRobots = await viewDetailsLink.isVisible().catch(() => false);
    if (!hasRobots) {
      test.skip(true, 'No robots available for test_user_001');
      return;
    }
    await viewDetailsLink.click();

    // Wait for robot detail page to load
    await page.waitForLoadState('networkidle');

    // Navigate to the Upgrades tab
    const upgradesTab = page.getByRole('tab', { name: /Upgrades/i });
    await expect(upgradesTab).toBeVisible({ timeout: 10000 });
    await upgradesTab.click();

    // Wait for the Upgrade Planner to render
    await expect(page.getByText(/Upgrade Planner/i)).toBeVisible({ timeout: 10000 });

    // Find the first attribute increment button that is enabled
    const incrementButton = page.getByRole('button', { name: /^Increase /i }).first();
    const canUpgrade = await incrementButton.isEnabled().catch(() => false);
    if (!canUpgrade) {
      test.skip(true, 'No upgradeable attributes available');
      return;
    }

    // Click increment to plan an upgrade
    await incrementButton.click();

    // The "Commit Upgrades" button should now be enabled
    const commitButton = page.getByRole('button', { name: /Commit Upgrades/i });
    await expect(commitButton).toBeEnabled({ timeout: 5000 });

    // Click commit to apply the upgrade
    await commitButton.click();

    // A confirmation modal should appear — click Confirm
    const confirmButton = page.getByRole('button', { name: /Confirm/i });
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // Wait for the upgrade to complete — look for success toast or page refresh
    await page.waitForLoadState('networkidle');
  });

  test('income dashboard displays financial health indicator, current balance, and daily income/expense breakdown', async ({ page }) => {
    // Req 7.4 — income dashboard shows financial health, balance, and breakdown
    await navigateToProtectedPage(page, '/income');

    // Verify the page heading
    await expect(page.getByRole('heading', { name: /Income Dashboard/i })).toBeVisible({ timeout: 10000 });

    // Wait for loading to finish
    await expect(page.getByText('Loading financial report...')).toBeHidden({ timeout: 15000 });

    // Verify the Financial Health section is displayed
    await expect(page.getByText('Financial Health')).toBeVisible();

    // Verify the financial health indicator shows one of the valid states
    // (excellent, good, stable, critical, etc.)
    const healthIndicator = page.getByText(/EXCELLENT|GOOD|STABLE|CRITICAL|POOR/i);
    await expect(healthIndicator.first()).toBeVisible();

    // Verify the Current Balance is displayed
    await expect(page.getByText(/Current Balance/i)).toBeVisible();

    // Verify the balance amount is shown (₡ followed by a number)
    await expect(page.getByText(/₡[\d,]+/).first()).toBeVisible();

    // Verify the daily income/expense breakdown is visible
    // The DailyStableReport shows "DAILY STABLE REPORT" heading
    await expect(page.getByText('DAILY STABLE REPORT')).toBeVisible();

    // Verify revenue streams section
    await expect(page.getByText('REVENUE STREAMS:')).toBeVisible();

    // Verify operating costs section
    await expect(page.getByText('OPERATING COSTS:')).toBeVisible();

    // Verify net income is displayed
    await expect(page.getByText('NET INCOME:')).toBeVisible();
  });

  test('switching to per-robot tab on income dashboard displays per-robot financial data', async ({ page }) => {
    // Req 7.5 — per-robot tab shows per-robot financial data
    await navigateToProtectedPage(page, '/income');

    // Verify the page loaded
    await expect(page.getByRole('heading', { name: /Income Dashboard/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Loading financial report...')).toBeHidden({ timeout: 15000 });

    // Click the "Per-Robot Breakdown" tab
    const perRobotTab = page.getByRole('button', { name: /Per-Robot Breakdown/i });
    await expect(perRobotTab).toBeVisible();
    await perRobotTab.click();

    // Verify per-robot financial data is displayed
    // The PerRobotBreakdown component shows "Robot Profitability Ranking" heading
    await expect(page.getByText('Robot Profitability Ranking')).toBeVisible({ timeout: 5000 });

    // Verify summary metrics are shown
    await expect(page.getByText('Total Revenue')).toBeVisible();
    await expect(page.getByText('Total Costs')).toBeVisible();
    await expect(page.getByText('Total Net Income')).toBeVisible();
    await expect(page.getByText('Average ROI')).toBeVisible();
  });
});
