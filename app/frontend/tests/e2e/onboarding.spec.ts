import { test, expect } from '@playwright/test';
import { registerNewUser } from './helpers/register';

/**
 * E2E tests for the Onboarding Tutorial flow.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 *
 * Each test registers a fresh user via registerNewUser, which redirects to /onboarding.
 */

// Fresh browser context — registration needs a clean session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Onboarding Tutorial Flow', () => {
  test('newly registered user sees progress indicator at step 1 of 5', async ({ page }) => {
    // Req 2.1
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/onboarding/);

    // The ProgressIndicator displays "Step 1 of 5" in the progress label
    await expect(page.getByText('Step 1 of 5', { exact: true })).toBeVisible();
    await expect(page.getByRole('progressbar').first()).toBeVisible();
  });

  test('completing each step advances the progress indicator', async ({ page }) => {
    // Req 2.2
    test.setTimeout(120_000);
    const creds = await registerNewUser(page);
    await expect(page).toHaveURL(/\/onboarding/);

    await expect(page.getByText('Step 1 of 5', { exact: true })).toBeVisible({ timeout: 15000 });

    // Step 1: Select strategy and create robot
    await page.getByRole('button', { name: /Select 1 Mighty Robot strategy/i }).click();
    await page.getByRole('button', { name: /Create My Robot/i }).click();
    await page.getByLabel(/Robot.*Name/i).fill(`Bot-${creds.username}`);
    await page.getByRole('button', { name: /Create Robot$/i }).click();

    // Wait for the robot creation API call to complete before checking step 2
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Step 2 of 5', { exact: true })).toBeVisible({ timeout: 30000 });

    // Step 2: Skip facility investment
    await page.getByRole('button', { name: /Do Not Invest/i }).click();
    await expect(page.getByText('Step 3 of 5', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('clicking "Skip Tutorial" and confirming redirects to /dashboard', async ({ page }) => {
    // Req 2.3
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/onboarding/);

    // Wait for the Skip Tutorial button to be visible
    const skipButton = page.getByRole('button', { name: /Skip Tutorial/i });
    await expect(skipButton).toBeVisible({ timeout: 10000 });
    await skipButton.click();

    // Confirmation modal — "Skip Anyway" button (aria-label="Confirm skip tutorial")
    const skipConfirm = page.getByRole('button', { name: /Confirm skip tutorial|Skip Anyway|Yes, Skip/i });
    await expect(skipConfirm).toBeVisible({ timeout: 10000 });
    await skipConfirm.click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('completing all 5 display steps redirects to /dashboard', async ({ page }) => {
    // Req 2.4
    test.setTimeout(180_000);
    const creds = await registerNewUser(page);
    await expect(page).toHaveURL(/\/onboarding/);

    // --- Step 1: Strategy + Robot Creation ---
    await expect(page.getByText('Step 1 of 5', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Select 1 Mighty Robot strategy/i }).click();
    await page.getByRole('button', { name: /Create My Robot/i }).click();
    await page.getByLabel(/Robot.*Name/i).fill(`Bot-${creds.username}`);
    await page.getByRole('button', { name: /Create Robot$/i }).click();
    await expect(page.getByText('Step 2 of 5', { exact: true })).toBeVisible({ timeout: 15000 });

    // --- Step 2: Facility Investment ---
    await page.getByRole('button', { name: /Do Not Invest/i }).click();
    await expect(page.getByText('Step 3 of 5', { exact: true })).toBeVisible({ timeout: 15000 });

    // --- Step 3: Battle-Ready Setup (sub-phases) ---
    // Loadout type
    await expect(page.getByText('Single Weapon')).toBeVisible({ timeout: 10000 });
    await page.getByText('Single Weapon').click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Stance
    await expect(page.getByText('Balanced')).toBeVisible({ timeout: 10000 });
    await page.getByText('Balanced').click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Range
    await expect(page.getByText('Melee')).toBeVisible({ timeout: 10000 });
    await page.getByText('Melee').click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Weapon
    await expect(page.getByText('Choose Your Weapon')).toBeVisible({ timeout: 10000 });
    const weaponCards = page.getByRole('button').filter({ hasText: /₡/ });
    await expect(weaponCards.first()).toBeVisible({ timeout: 10000 });
    await weaponCards.first().click();

    // Portrait
    await expect(page.getByText('Customize Robot Appearance')).toBeVisible({ timeout: 10000 });
    const portraitButtons = page.getByRole('button').filter({ has: page.getByRole('img') });
    await expect(portraitButtons.first()).toBeVisible({ timeout: 5000 });
    await portraitButtons.first().click();
    await page.getByRole('button', { name: 'Apply Image' }).click();

    // Continue when battle-ready
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeVisible({ timeout: 30000 });
    await continueButton.click();

    // --- Step 4: Attribute Upgrades ---
    await expect(page.getByText('Step 4 of 5', { exact: true })).toBeVisible({ timeout: 15000 });
    // Click "Skip — I'll upgrade later" to proceed (not the "Skip Tutorial" header button)
    const skipUpgradesButton = page.getByRole('button', { name: /I'll upgrade later/i });
    await skipUpgradesButton.waitFor({ state: 'visible', timeout: 15000 });
    await skipUpgradesButton.click();

    // --- Step 5: Completion (subscription picker → congratulations) ---
    await expect(page.getByText('Step 5 of 5', { exact: true })).toBeVisible({ timeout: 20000 });

    // Step 5 phase 1: Subscription picker — select at least one event and confirm
    const subscriptionHeading = page.getByText('Choose Your Battle Events');
    const isSubscriptionPhase = await subscriptionHeading.isVisible({ timeout: 10000 }).catch(() => false);

    if (isSubscriptionPhase) {
      // Click the first available event checkbox/button to select a subscription
      const eventButtons = page.getByRole('button').filter({ hasText: /1v1|KotH|Melee/i });
      const firstEvent = eventButtons.first();
      await firstEvent.waitFor({ state: 'visible', timeout: 10000 });
      await firstEvent.click();

      // Click the confirm button (text: "Confirm X Subscription(s)")
      const confirmSubs = page.getByRole('button', { name: /Confirm.*Subscription/i });
      await confirmSubs.waitFor({ state: 'visible', timeout: 10000 });
      await confirmSubs.click();
    }

    // Step 5 phase 2: Congratulations — Complete Tutorial button
    const completeTutorialButton = page.getByRole('button', { name: /Complete Tutorial/i });
    await completeTutorialButton.waitFor({ state: 'visible', timeout: 20000 });
    await completeTutorialButton.click();

    await expect(page).toHaveURL(/\/(guide|dashboard)/, { timeout: 15000 });
  });

  test('budget tracker component is visible on non-mobile viewports during onboarding', async ({ page }) => {
    // Req 2.5
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByRole('region', { name: 'Budget Tracker' })).toBeVisible();
  });
});
