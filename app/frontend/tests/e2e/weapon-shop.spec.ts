import { test, expect } from '@playwright/test';
import { navigateToProtectedPage } from './helpers/navigate';

/**
 * E2E tests for Weapon Shop Page
 * Tests filtering, sorting, view modes, comparison, and purchase flow.
 *
 * Auth state is pre-loaded via the setup project (see auth.setup.ts),
 * so we don't need to login in each test.
 *
 * Requirements: 5.1, 5.2, 5.5, 13.1, 13.2
 */

test.describe('Weapon Shop Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProtectedPage(page, '/weapon-shop');
  });

  test.describe('Page Load and Initial State', () => {
    test('should display weapon shop page with heading, description, storage, and filters', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Weapon Shop', level: 1 })).toBeVisible();
      await expect(page.getByText('Purchase weapons to equip your robots')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Storage Capacity' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Filters', exact: true })).toBeVisible();
    });

    test('should display weapons with names, costs, and damage types', async ({ page }) => {
      // Wait for weapon cards to render — each weapon has a heading (h3) inside a card
      const weaponHeadings = page.locator('h3').filter({ hasNotText: /Storage Capacity|Loadout Type|Weapon Type|Range Band|Price Range|Quick Filters/ });
      await expect(weaponHeadings.first()).toBeVisible();

      // Verify at least one weapon card shows cost (₡ symbol) and a weapon type label
      await expect(page.getByText(/₡[\d,]+/).first()).toBeVisible();

      // Verify weapon type labels are present (melee, ballistic, energy, or shield)
      await expect(page.getByText(/melee|ballistic|energy|shield/i).first()).toBeVisible();
    });

    test('should show storage capacity with current/max display', async ({ page }) => {
      // Storage capacity shows "X / Y" format
      await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible();
    });
  });

  test.describe('Filtering System', () => {
    test('should expand and collapse filter panel', async ({ page }) => {
      // Click the Filters heading to expand
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();
      await expect(page.getByText('Loadout Type')).toBeVisible();

      // Click again to collapse
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();
      await expect(page.getByText('Loadout Type')).not.toBeVisible();
    });

    test('should filter weapons by loadout type', async ({ page }) => {
      // Expand filters
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();
      await expect(page.getByText('Loadout Type')).toBeVisible();

      // Get initial weapon count
      const countText = page.getByText(/Showing \d+ of \d+ weapons/);
      const initialText = await countText.textContent();

      // Click "Two-Handed" filter button
      await page.getByRole('button', { name: 'Two-Handed' }).click();

      // Wait for the count text to change
      await expect(countText).not.toHaveText(initialText!);
    });

    test('should filter weapons by weapon type', async ({ page }) => {
      // Expand filters
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();
      await expect(page.getByText('Weapon Type')).toBeVisible();

      // Click "Melee" filter button
      await page.getByRole('button', { name: 'Melee', exact: true }).click();

      // Verify the active filter chip appears with a remove button
      await expect(page.getByRole('button', { name: 'Remove Melee filter' })).toBeVisible();
    });

    test('should filter weapons by price range', async ({ page }) => {
      // Expand filters
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();
      await expect(page.getByText('Price Range')).toBeVisible();

      // Click "Budget (<₡100K)" filter
      await page.getByRole('button', { name: /Budget.*100K/ }).click();

      // Verify the price range filter chip appears
      await expect(page.getByRole('button', { name: 'Remove price range filter' })).toBeVisible();
    });

    test('should apply multiple filters simultaneously', async ({ page }) => {
      // Expand filters
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();
      await expect(page.getByText('Loadout Type')).toBeVisible();

      // Apply loadout type filter
      await page.getByRole('button', { name: 'Single', exact: true }).click();
      // Apply weapon type filter
      await page.getByRole('button', { name: 'Melee', exact: true }).click();

      // Verify both filter chips are displayed via their remove buttons
      await expect(page.getByRole('button', { name: 'Remove Single filter' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Remove Melee filter' })).toBeVisible();
    });

    test('should clear all filters', async ({ page }) => {
      // Expand filters and apply a filter
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();
      await expect(page.getByText('Weapon Type')).toBeVisible();
      await page.getByRole('button', { name: 'Melee', exact: true }).click();

      // Verify chip is visible
      await expect(page.getByRole('button', { name: 'Remove Melee filter' })).toBeVisible();

      // Click "Clear All"
      await page.getByRole('button', { name: 'Clear All' }).click();

      // Verify chip is removed
      await expect(page.getByRole('button', { name: 'Remove Melee filter' })).not.toBeVisible();
    });

    test('should remove individual filter chips', async ({ page }) => {
      // Expand filters and apply a filter
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();
      await expect(page.getByText('Weapon Type')).toBeVisible();
      await page.getByRole('button', { name: 'Melee', exact: true }).click();

      // Verify chip is visible
      const removeButton = page.getByRole('button', { name: 'Remove Melee filter' });
      await expect(removeButton).toBeVisible();

      // Click the remove button on the chip
      await removeButton.click();

      // Verify chip is removed
      await expect(removeButton).not.toBeVisible();
    });
  });

  test.describe('View Mode Toggle', () => {
    test('should switch to table view', async ({ page }) => {
      // Click the Table View button (has aria-label)
      await page.getByRole('button', { name: 'Table View' }).click();

      // Verify table is visible
      await expect(page.locator('table')).toBeVisible();
    });

    test('should persist view mode preference', async ({ page }) => {
      // Switch to table view
      await page.getByRole('button', { name: 'Table View' }).click();
      await expect(page.locator('table')).toBeVisible();

      // Re-navigate
      await navigateToProtectedPage(page, '/weapon-shop');

      // Verify table view is still active
      await expect(page.locator('table')).toBeVisible();
    });
  });

  test.describe('Weapon Comparison', () => {
    test('should select weapons for comparison', async ({ page }) => {
      // Wait for weapon cards to load
      const firstCompareCheckbox = page.getByRole('checkbox', { name: 'Compare' }).first();
      await expect(firstCompareCheckbox).toBeVisible();

      // Select first two weapons
      await page.getByRole('checkbox', { name: 'Compare' }).nth(0).check();
      await page.getByRole('checkbox', { name: 'Compare' }).nth(1).check();

      // Verify comparison bar shows "2 weapons selected"
      await expect(page.getByText('2 weapons selected')).toBeVisible();
    });

    test('should open comparison modal', async ({ page }) => {
      // Select two weapons
      const checkboxes = page.getByRole('checkbox', { name: 'Compare' });
      await expect(checkboxes.first()).toBeVisible();
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();

      // Wait for comparison bar
      await expect(page.getByText('2 weapons selected')).toBeVisible();

      // Click "Compare →"
      await page.getByRole('button', { name: /Compare/ }).click();

      // Verify comparison modal heading
      await expect(page.getByRole('heading', { name: 'Compare Weapons' })).toBeVisible();
    });

    test('should limit comparison to 3 weapons', async ({ page }) => {
      // Select 3 weapons
      const checkboxes = page.getByRole('checkbox', { name: 'Compare' });
      await expect(checkboxes.first()).toBeVisible();
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      await checkboxes.nth(2).check();

      // Verify 4th checkbox is disabled
      await expect(checkboxes.nth(3)).toBeDisabled();
    });

    test('should clear comparison selection', async ({ page }) => {
      // Select two weapons
      const checkboxes = page.getByRole('checkbox', { name: 'Compare' });
      await expect(checkboxes.first()).toBeVisible();
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();

      // Wait for comparison bar
      await expect(page.getByText('2 weapons selected')).toBeVisible();

      // Click "Clear" in the comparison bar
      await page.getByRole('button', { name: /Clear/i }).click();

      // Verify comparison bar is hidden
      await expect(page.getByText(/weapons selected/i)).not.toBeVisible();
    });
  });

  test.describe('Weapon Detail Modal', () => {
    test('should open weapon detail modal when clicking weapon name', async ({ page }) => {
      // Wait for a weapon heading to be visible, then click it
      // Weapon names are h3 elements that are clickable
      const weaponName = page.locator('h3.cursor-pointer').first();
      await expect(weaponName).toBeVisible();
      const nameText = await weaponName.textContent();
      await weaponName.click();

      // Verify the detail modal opens with the weapon name as h2
      await expect(page.getByRole('heading', { name: nameText!, level: 2 })).toBeVisible();

      // Verify modal has Description and Combat Stats sections
      await expect(page.getByRole('heading', { name: 'Description' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Combat Stats' })).toBeVisible();
    });

    test('should close weapon detail modal', async ({ page }) => {
      // Open modal
      const weaponName = page.locator('h3.cursor-pointer').first();
      await expect(weaponName).toBeVisible();
      await weaponName.click();

      // Verify modal is open
      await expect(page.getByRole('heading', { name: 'Description' })).toBeVisible();

      // Close modal by clicking the Close button
      await page.getByRole('button', { name: 'Close' }).click();

      // Verify modal is closed
      await expect(page.getByRole('heading', { name: 'Description' })).not.toBeVisible();
    });
  });

  test.describe('Purchase Flow', () => {
    test('should show purchase confirmation modal', async ({ page }) => {
      // Find a weapon with an enabled "Purchase" button
      const purchaseButton = page.getByRole('button', { name: 'Purchase', exact: true }).first();
      await expect(purchaseButton).toBeVisible();

      if (await purchaseButton.isEnabled()) {
        await purchaseButton.click();

        // Verify confirmation modal appears with "Confirm Purchase" heading
        await expect(page.getByRole('heading', { name: 'Confirm Purchase' })).toBeVisible();

        // Cancel the purchase
        await page.getByRole('button', { name: 'Cancel' }).click();

        // Verify modal is closed
        await expect(page.getByRole('heading', { name: 'Confirm Purchase' })).not.toBeVisible();
      }
    });

    test('should indicate insufficient credits for expensive weapons', async ({ page }) => {
      // Check if any "Insufficient Credits" button exists (disabled)
      const insufficientButton = page.getByRole('button', { name: 'Insufficient Credits' }).first();
      const count = await insufficientButton.count();

      if (count > 0) {
        await expect(insufficientButton).toBeDisabled();
      }
    });

    test('should show storage full warning when storage is full', async ({ page }) => {
      // Check storage capacity text
      const storageText = await page.getByText(/\d+ \/ \d+/).textContent();

      if (storageText) {
        const [current, max] = storageText.split('/').map(s => parseInt(s.trim()));

        if (current === max) {
          // Verify storage full warning message
          await expect(page.getByText(/Storage full/i)).toBeVisible();

          // Verify "Storage Full" button exists and is disabled
          const storageFullButton = page.getByRole('button', { name: 'Storage Full' }).first();
          await expect(storageFullButton).toBeVisible();
          await expect(storageFullButton).toBeDisabled();
        }
      }
    });
  });
});
