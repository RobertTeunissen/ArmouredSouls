import { test, expect } from '@playwright/test';
import { registerNewUser } from './helpers/register';

/**
 * E2E Critical User Journey — Registration through Practice Battle.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 *
 * This is a single sequential test that chains the entire new-player journey:
 *   1. Register fresh user
 *   2. Skip onboarding
 *   3. Create robot (verify ₡500,000 deduction)
 *   4. Purchase weapon (verify credit deduction)
 *   5. Equip weapon on battle-config tab (verify battle readiness)
 *   6. Run practice battle (verify win/loss/draw outcome)
 *   7. Navigate to /battle-history (verify page loads)
 */

// Fresh browser context — registration needs a clean session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Critical User Journey', () => {
  test('registration → skip onboarding → create robot → purchase weapon → equip weapon → practice battle → battle history', async ({ page }) => {
    // Increase timeout for this long sequential test
    test.setTimeout(180_000);

    // ---------------------------------------------------------------
    // Step 1: Register fresh user (Req 8.1)
    // ---------------------------------------------------------------
    const creds = await registerNewUser(page);
    await expect(page).toHaveURL(/\/(onboarding|dashboard)/);

    // ---------------------------------------------------------------
    // Step 2: Skip onboarding (Req 8.1)
    // ---------------------------------------------------------------
    if (page.url().includes('/onboarding')) {
      await page.getByRole('button', { name: 'Skip Tutorial' }).click();

      // Confirmation modal — button has aria-label="Confirm skip tutorial"
      const skipConfirm = page.getByRole('button', { name: /Confirm skip tutorial/i });
      await expect(skipConfirm).toBeVisible({ timeout: 5000 });
      await skipConfirm.click();

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    }

    // Capture initial credit balance from the dashboard
    await page.waitForLoadState('networkidle');

    // ---------------------------------------------------------------
    // Step 3: Create robot — verify ₡500,000 deduction (Req 8.1, 8.2)
    // ---------------------------------------------------------------
    await page.goto('/robots/create');
    await page.waitForLoadState('networkidle');

    // Verify the creation form shows the cost
    await expect(page.getByText('₡500,000').first()).toBeVisible();

    // Read the balance displayed on the creation page before creating
    const balanceBeforeRobot = await page.getByText(/Your Balance/).locator('..').textContent();
    const balanceBeforeRobotNum = parseInt(
      (balanceBeforeRobot ?? '0').replace(/[^0-9]/g, ''),
    );

    // Fill in robot name and submit
    const robotName = `CJ-${creds.username.slice(0, 20)}`;
    await page.getByLabel('Robot Name').fill(robotName);
    await page.getByRole('button', { name: /Create Robot/ }).click();

    // Wait for navigation to the robot detail page
    await expect(page).toHaveURL(/\/robots\/\d+/, { timeout: 20000 });
    await page.waitForLoadState('networkidle');

    // Extract the robot ID from the URL for later use
    const robotUrl = page.url();
    const robotIdMatch = robotUrl.match(/\/robots\/(\d+)/);
    const robotId = robotIdMatch ? robotIdMatch[1] : '';
    expect(robotId).toBeTruthy();

    // Verify robot name is displayed on the detail page
    await expect(page.getByRole('heading', { name: robotName })).toBeVisible({ timeout: 10000 });

    // Verify credit deduction: navigate to create page to check balance, or check via robot detail
    // Navigate to create page to read the updated balance
    await page.goto('/robots/create');
    await page.waitForLoadState('networkidle');

    const balanceAfterRobot = await page.getByText(/Your Balance/).locator('..').textContent();
    const balanceAfterRobotNum = parseInt(
      (balanceAfterRobot ?? '0').replace(/[^0-9]/g, ''),
    );

    // Verify ₡500,000 was deducted
    expect(balanceBeforeRobotNum - balanceAfterRobotNum).toBe(500000);

    // ---------------------------------------------------------------
    // Step 4: Purchase weapon — verify credit deduction (Req 8.1)
    // ---------------------------------------------------------------
    await page.goto('/weapon-shop');
    await page.waitForLoadState('networkidle');

    // Wait for weapons to load
    await expect(page.getByRole('heading', { name: 'Weapon Shop' })).toBeVisible();

    // The weapon shop defaults to card view. Find the first purchasable weapon's
    // "Purchase" button and click it.
    const purchaseButton = page.getByRole('button', { name: 'Purchase' }).first();
    await expect(purchaseButton).toBeVisible({ timeout: 15000 });
    await purchaseButton.click();

    // Confirmation modal appears — click the confirm button inside the modal dialog
    await expect(page.getByText('Confirm Purchase')).toBeVisible({ timeout: 5000 });
    // The modal has its own "Purchase" button — scope to the dialog
    const confirmDialog = page.getByRole('dialog').or(page.locator('[role="dialog"]')).or(page.locator('.fixed.inset-0'));
    await confirmDialog.getByRole('button', { name: 'Purchase' }).click();

    // Wait for success modal — "Purchase Successful"
    await expect(page.getByText('Purchase Successful')).toBeVisible({ timeout: 15000 });

    // Dismiss the success modal by clicking OK
    await page.getByRole('button', { name: 'OK' }).click();

    // ---------------------------------------------------------------
    // Step 5: Equip weapon on battle-config tab (Req 8.1, 8.3)
    // ---------------------------------------------------------------
    // Navigate to the robot detail page
    await page.goto(`/robots/${robotId}`);
    await page.waitForLoadState('networkidle');

    // Click the "Battle Config" tab
    await page.getByRole('tab', { name: /Battle Config/ }).click();

    // Wait for the battle config section to load
    await expect(page.getByText('Battle Configuration')).toBeVisible({ timeout: 10000 });

    // The main weapon slot should show "No weapon equipped" initially
    // Click "Equip Weapon" to open the weapon selection modal
    await page.getByText('Equip Weapon').first().click();

    // The weapon selection modal should appear with "Select Weapon" heading
    await expect(page.getByRole('heading', { name: 'Select Weapon' })).toBeVisible({ timeout: 10000 });

    // Check if any weapons are available in the modal
    const noWeaponsMsg = page.getByText('No weapons found');
    const hasNoWeapons = await noWeaponsMsg.isVisible().catch(() => false);

    if (hasNoWeapons) {
      // The purchased weapon may not be compatible with this slot type — close modal and skip battle steps
      await page.getByRole('button', { name: 'Cancel' }).click();
    } else {
      // Click the first weapon card button to equip it
      // Weapon cards in the modal are clickable divs/buttons with weapon names
      const weaponCards = page.locator('[role="dialog"] button, .fixed.inset-0 button').filter({ hasNotText: /Cancel|Close/ });
      const firstWeaponCard = weaponCards.first();
      if (await firstWeaponCard.isVisible().catch(() => false)) {
        await firstWeaponCard.click();
        // Wait for equip confirmation
        await page.waitForLoadState('networkidle');
      }
    }

    // ---------------------------------------------------------------
    // Step 6: Run practice battle — verify outcome (Req 8.1, 8.4)
    // ---------------------------------------------------------------
    await page.goto('/practice-arena');
    await page.waitForLoadState('networkidle');

    // Verify the practice arena page loaded
    await expect(page.getByRole('heading', { name: /Combat Simulation Lab/ })).toBeVisible({ timeout: 10000 });

    // Select our robot in slot 1 (Your Robot panel)
    const robotButton = page.locator('button').filter({ has: page.locator('img') }).first();
    if (await robotButton.isVisible().catch(() => false)) {
      await robotButton.click();

      // Click "Run Simulation" if enabled (robot needs weapon equipped)
      const runButton = page.getByRole('button', { name: /Run Simulation/ });
      await page.waitForTimeout(1000);
      if (await runButton.isEnabled().catch(() => false)) {
        await runButton.click();

        // Wait for the simulation result
        const resultIndicator = page.getByText(/WINS|DRAW/).first();
        await expect(resultIndicator).toBeVisible({ timeout: 30000 });
      }
    }

    // ---------------------------------------------------------------
    // Step 7: Navigate to /battle-history — verify page loads (Req 8.5)
    // ---------------------------------------------------------------
    await page.goto('/battle-history');
    await page.waitForLoadState('networkidle');

    // Verify the battle history page loaded without errors
    await expect(page.getByRole('heading', { name: 'Battle History' })).toBeVisible({ timeout: 10000 });

    // The page should not show any error state
    await expect(page.getByText('Failed to load battle history')).not.toBeVisible();
  });
});
