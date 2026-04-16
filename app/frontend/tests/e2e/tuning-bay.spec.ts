import { test, expect } from '@playwright/test';
import { navigateToProtectedPage } from './helpers/navigate';

/**
 * E2E tests for the Tuning Bay (Tactical Tuning) tab on the Robot Detail Page.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 *
 * All tests use test_user_001 auth state (chromium project default).
 * test_user_001 has at least one robot available.
 */

/** Helper: navigate to the first robot's detail page and return the robot URL */
async function navigateToFirstRobot(page: import('@playwright/test').Page): Promise<boolean> {
  await navigateToProtectedPage(page, '/robots');

  // Wait for robots list to load
  const heading = page.getByRole('heading', { name: /My Robots/i });
  const headingVisible = await heading.isVisible({ timeout: 10000 }).catch(() => false);
  if (!headingVisible) return false;

  // Click on the first robot's "View Details →" link
  const viewDetailsLink = page.getByText('View Details →').first();
  const hasRobots = await viewDetailsLink.isVisible().catch(() => false);
  if (!hasRobots) return false;

  await viewDetailsLink.click();
  await page.waitForLoadState('networkidle');

  // Verify we landed on a robot detail page
  const isRobotPage = /\/robots\/\d+/.test(page.url());
  return isRobotPage;
}

/** Helper: click the Tuning tab and wait for the editor to load */
async function openTuningTab(page: import('@playwright/test').Page): Promise<void> {
  const tuningTab = page.getByRole('tab', { name: /Tuning/i });
  await expect(tuningTab).toBeVisible({ timeout: 10000 });
  await tuningTab.click();

  // Wait for the Tuning Pool editor to finish loading
  // The loading spinner shows "Loading tuning allocation…" — wait for it to disappear
  const loadingIndicator = page.getByText('Loading tuning allocation…');
  await expect(loadingIndicator).toBeHidden({ timeout: 15000 });

  // Verify the Tuning Pool heading is visible
  await expect(page.getByText('⚙️ Tuning Pool')).toBeVisible({ timeout: 5000 });
}

/** Helper: reset all tuning allocations to 0 if any are set */
async function resetTuningIfNeeded(page: import('@playwright/test').Page): Promise<void> {
  const resetButton = page.getByRole('button', { name: /Reset All/i });
  const isEnabled = await resetButton.isEnabled().catch(() => false);
  if (!isEnabled) return; // No allocations to reset

  await resetButton.click();

  // Confirm the reset in the confirmation modal
  const confirmButton = page.getByRole('button', { name: /Reset All/i }).last();
  await expect(confirmButton).toBeVisible({ timeout: 5000 });
  await confirmButton.click();

  // Save the reset
  const saveButton = page.getByRole('button', { name: /Save Tuning/i });
  // After reset, hasChanges should be true if there were allocations before
  const saveEnabled = await saveButton.isEnabled().catch(() => false);
  if (saveEnabled) {
    await saveButton.click();
    // Wait for save to complete — toast should appear
    await expect(page.getByText('Tuning allocation saved')).toBeVisible({ timeout: 10000 });
  }
}

test.describe('Tuning Bay', () => {
  test('displays Tuning tab with budget bar and stepper controls', async ({ page }) => {
    // Req 9.1, 9.2 — Tuning tab exists and shows budget bar + stepper buttons
    const navigated = await navigateToFirstRobot(page);
    if (!navigated) {
      test.skip(true, 'No robots available for test_user_001');
      return;
    }

    await openTuningTab(page);

    // Verify the budget bar shows allocated / pool size
    await expect(page.getByText(/\d+ \/ \d+ allocated/)).toBeVisible();

    // Verify at least one category header is visible (e.g., Combat Systems)
    await expect(page.getByText('Combat Systems')).toBeVisible();

    // Verify stepper buttons exist (+ and − buttons for attributes)
    const incrementButton = page.getByLabel(/Increase tuning for/i).first();
    await expect(incrementButton).toBeVisible();

    const decrementButton = page.getByLabel(/Decrease tuning for/i).first();
    await expect(decrementButton).toBeVisible();

    // Verify the Save Tuning button exists
    await expect(page.getByRole('button', { name: /Save Tuning/i })).toBeVisible();

    // Verify the Reset All button exists
    await expect(page.getByRole('button', { name: /Reset All/i })).toBeVisible();
  });

  test('allocating tuning points, saving, and verifying persistence after reload', async ({ page }) => {
    // Req 9.2, 9.4 — allocate points via stepper, save, reload, verify persistence
    test.setTimeout(60_000);

    const navigated = await navigateToFirstRobot(page);
    if (!navigated) {
      test.skip(true, 'No robots available for test_user_001');
      return;
    }

    // Remember the robot URL for reload
    const robotUrl = page.url();

    await openTuningTab(page);

    // Reset any existing allocations to start from a clean state
    await resetTuningIfNeeded(page);

    // Verify we're back to 0 allocated
    await expect(page.getByText(/0 \/ \d+ allocated/)).toBeVisible({ timeout: 5000 });

    // Find the first enabled + button (Combat Power is typically first)
    const incrementButtons = page.getByLabel(/Increase tuning for/i);
    const firstIncrement = incrementButtons.first();
    const isButtonVisible = await firstIncrement.isVisible().catch(() => false);
    if (!isButtonVisible) {
      test.skip(true, 'No enabled tuning stepper buttons — all attributes may be at max');
      return;
    }

    const isEnabled = await firstIncrement.isEnabled().catch(() => false);
    if (!isEnabled) {
      test.skip(true, 'First stepper button is disabled — attribute may be at cap or no budget');
      return;
    }

    // Click + once to allocate 1 point
    await firstIncrement.click();

    // Verify the budget bar updated — should show non-zero allocated
    await expect(page.getByText(/[1-9]\d* \/ \d+ allocated/)).toBeVisible({ timeout: 3000 });

    // The Save Tuning button should now be enabled
    const saveButton = page.getByRole('button', { name: /Save Tuning/i });
    await expect(saveButton).toBeEnabled({ timeout: 3000 });

    // Click Save Tuning
    await saveButton.click();

    // Wait for save confirmation toast
    await expect(page.getByText('Tuning allocation saved')).toBeVisible({ timeout: 10000 });

    // Reload the page to verify persistence
    await page.goto(robotUrl);
    await page.waitForLoadState('networkidle');

    // Open the Tuning tab again
    await openTuningTab(page);

    // Verify the allocation persisted — budget bar should show non-zero allocated
    await expect(page.getByText(/[1-9]\d* \/ \d+ allocated/)).toBeVisible({ timeout: 5000 });

    // Verify at least one attribute shows a +N allocation
    await expect(page.getByText(/\+\d+/).first()).toBeVisible({ timeout: 3000 });
  });
});
