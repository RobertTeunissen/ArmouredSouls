import { test, expect } from '@playwright/test';
import { registerNewUser } from './helpers/register';

/**
 * E2E tests for the Onboarding Tutorial flow.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 *
 * The onboarding flow has 5 display steps (mapped from 9 backend steps):
 *   Display 1: Welcome + Strategy + Robot Creation (backend 1-2)
 *   Display 2: Facility Investment (backend 3-5)
 *   Display 3: Battle-Ready Setup (backend 6-7)
 *   Display 4: Attribute Upgrades (backend 8)
 *   Display 5: Completion (backend 9)
 *
 * Each test registers a fresh user via registerNewUser, which redirects to /onboarding.
 */

// Fresh browser context — registration needs a clean session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Onboarding Tutorial Flow', () => {
  test('newly registered user sees progress indicator at step 1 of 5', async ({ page }) => {
    // Req 2.1 — progress indicator shows step 1 of 5 after registration
    await registerNewUser(page);

    // Verify we're on the onboarding page
    await expect(page).toHaveURL(/\/onboarding/);

    // The ProgressIndicator displays "Step 1 of 5" text
    await expect(page.getByText('Step 1 of 5')).toBeVisible();

    // The progressbar element should be present
    await expect(page.getByRole('progressbar')).toBeVisible();
  });

  test('completing each step advances the progress indicator', async ({ page }) => {
    // Req 2.2 — advancing through steps updates the progress indicator
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/onboarding/);

    // --- Display Step 1: Welcome + Strategy + Robot Creation ---
    await expect(page.getByText('Step 1 of 5')).toBeVisible();

    // Select the "1 Mighty Robot" strategy (card uses role="button" with aria-pressed)
    await page.getByRole('button', { name: /Select 1 Mighty Robot strategy/i }).click();

    // Click "Create My Robot" button
    await page.getByRole('button', { name: /Create My Robot/i }).click();

    // Robot naming modal appears — fill in a name and submit
    await expect(page.getByRole('dialog', { name: /Name your robot/i })).toBeVisible();
    await page.getByLabel(/Robot.*Name/i).fill('E2E TestBot');
    await page.getByRole('button', { name: /Create Robot$/i }).click();

    // Wait for step 2 to appear
    await expect(page.getByText('Step 2 of 5')).toBeVisible({ timeout: 15000 });

    // --- Display Step 2: Facility Investment ---
    // Click "Do Not Invest" to skip facility investment
    await page.getByRole('button', { name: /Do Not Invest/i }).click();

    // Wait for step 3 to appear
    await expect(page.getByText('Step 3 of 5')).toBeVisible({ timeout: 15000 });
  });

  test('clicking "Skip Tutorial" and confirming redirects to /dashboard', async ({ page }) => {
    // Req 2.3 — skip tutorial flow
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/onboarding/);

    // Click the "Skip Tutorial" button
    await page.getByRole('button', { name: 'Skip Tutorial' }).click();

    // Confirmation modal appears with "Skip Anyway" button
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Skip Tutorial?')).toBeVisible();

    // Confirm the skip
    await page.getByRole('button', { name: 'Skip Anyway' }).click();

    // Should redirect to /dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('completing all 5 display steps redirects to /dashboard', async ({ page }) => {
    // Req 2.4 — full onboarding completion
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/onboarding/);

    // --- Display Step 1: Welcome + Strategy + Robot Creation ---
    await expect(page.getByText('Step 1 of 5')).toBeVisible();
    await page.getByRole('button', { name: /Select 1 Mighty Robot strategy/i }).click();
    await page.getByRole('button', { name: /Create My Robot/i }).click();
    await expect(page.getByRole('dialog', { name: /Name your robot/i })).toBeVisible();
    await page.getByLabel(/Robot.*Name/i).fill('E2E FullBot');
    await page.getByRole('button', { name: /Create Robot$/i }).click();
    await expect(page.getByText('Step 2 of 5')).toBeVisible({ timeout: 15000 });

    // --- Display Step 2: Facility Investment ---
    await page.getByRole('button', { name: /Do Not Invest/i }).click();
    await expect(page.getByText('Step 3 of 5')).toBeVisible({ timeout: 15000 });

    // --- Display Step 3: Battle-Ready Setup ---
    // This step has sub-phases: loadout → stance → range → weapon → portrait → done.
    // Wait for the step heading to appear
    await expect(page.getByRole('heading', { name: /Battle.Ready/i })).toBeVisible({ timeout: 15000 });

    // Sub-phase: Loadout type — select "Single Weapon" and click Next
    await expect(page.getByText('Single Weapon')).toBeVisible({ timeout: 10000 });
    await page.getByText('Single Weapon').click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Sub-phase: Stance — select "Balanced" and click Next
    await expect(page.getByText('Balanced')).toBeVisible({ timeout: 10000 });
    await page.getByText('Balanced').click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Sub-phase: Range — select "Melee" and click Next
    await expect(page.getByText('Melee')).toBeVisible({ timeout: 10000 });
    await page.getByText('Melee').click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Sub-phase: Weapon — pick the first weapon card (button with price text)
    await expect(page.getByText('Choose Your Weapon')).toBeVisible({ timeout: 10000 });
    const weaponCards = page.getByRole('button').filter({ hasText: /₡/ });
    await expect(weaponCards.first()).toBeVisible({ timeout: 10000 });
    await weaponCards.first().click();

    // Sub-phase: Portrait — select a portrait image and apply it
    await expect(page.getByText('Customize Robot Appearance')).toBeVisible({ timeout: 10000 });
    // Click the first available portrait image button, then apply
    const portraitGrid = page.getByRole('button').filter({ has: page.getByRole('img') });
    await expect(portraitGrid.first()).toBeVisible({ timeout: 5000 });
    await portraitGrid.first().click();
    await page.getByRole('button', { name: 'Apply Image' }).click();

    // Wait for the "Continue" button that appears when all robots are battle-ready
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeVisible({ timeout: 30000 });
    await continueButton.click();

    // --- Display Step 4: Attribute Upgrades ---
    await expect(page.getByText('Step 4 of 5')).toBeVisible({ timeout: 15000 });

    // Skip upgrades to proceed
    const skipUpgradesButton = page.getByRole('button', { name: /Skip/i }).first();
    await expect(skipUpgradesButton).toBeVisible({ timeout: 10000 });
    await skipUpgradesButton.click();

    // --- Display Step 5: Completion ---
    await expect(page.getByText('Step 5 of 5')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /Congratulations/i })).toBeVisible();

    // Click "Complete Tutorial & Start Playing"
    await page.getByRole('button', { name: /Complete Tutorial/i }).click();

    // Should redirect to /guide or /dashboard after completion
    await expect(page).toHaveURL(/\/(guide|dashboard)/, { timeout: 15000 });
  });

  test('budget tracker component is visible on non-mobile viewports during onboarding', async ({
    page,
  }) => {
    // Req 2.5 — budget tracker visible on desktop viewports
    // The default viewport in Desktop Chrome is 1280x720 (non-mobile)
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/onboarding/);

    // The BudgetTracker has role="region" with aria-label="Budget Tracker"
    // It's hidden on mobile (hidden sm:block) but visible on desktop
    await expect(page.getByRole('region', { name: 'Budget Tracker' })).toBeVisible();
  });
});
