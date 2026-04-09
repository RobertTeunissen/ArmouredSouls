import { test, expect } from '@playwright/test';
import { navigateToProtectedPage } from './helpers/navigate';

/**
 * E2E tests for Weapon Shop Page
 * Tests filtering, sorting, view modes, comparison, and purchase flow
 *
 * Auth state is pre-loaded via the setup project (see auth.setup.ts),
 * so we don't need to login in each test.
 */

test.describe('Weapon Shop Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProtectedPage(page, '/weapon-shop');
  });

  test.describe('Page Load and Initial State', () => {
    test('should display weapon shop page correctly', async ({ page }) => {
      // Check page title and description
      await expect(page.getByRole('heading', { name: 'Weapon Shop' })).toBeVisible();
      await expect(page.getByText('Purchase weapons to equip your robots')).toBeVisible();

      // Check storage capacity section
      await expect(page.getByText('Storage Capacity')).toBeVisible();

      // Check filters section
      await expect(page.getByRole('heading', { name: 'Filters', exact: true })).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/weapon-shop-initial.png',
        fullPage: true,
      });
    });

    test('should display weapons in card view by default', async ({ page }) => {
      // Wait for weapon cards to load (bg-gray-800 p-6 rounded-lg)
      await page.waitForSelector('.bg-gray-800.p-6.rounded-lg', { timeout: 10000 });

      // Check that weapon cards are visible
      const weaponCards = page.locator('.bg-gray-800.p-6.rounded-lg');
      const count = await weaponCards.count();
      expect(count).toBeGreaterThan(0);

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/weapon-shop-card-view.png',
        fullPage: true,
      });
    });

    test('should show storage capacity with progress bar', async ({ page }) => {
      // Check storage capacity display (e.g. "3 / 10")
      const storageText = page.locator('text=/\\d+ \\/ \\d+/');
      await expect(storageText.first()).toBeVisible();

      // Check progress bar container exists
      const progressBar = page.locator('.bg-gray-700.rounded-full.h-4');
      await expect(progressBar).toBeVisible();
    });
  });

  test.describe('Filtering System', () => {
    test('should expand and collapse filter panel', async ({ page }) => {
      const loadoutTypeHeading = page.getByText('Loadout Type', { exact: true });

      // Click the filters heading to expand (h2 "Filters" inside clickable div)
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();
      await expect(loadoutTypeHeading).toBeVisible();

      // Take screenshot of expanded filters
      await page.screenshot({
        path: 'test-results/screenshots/weapon-shop-filters-expanded.png',
        fullPage: true,
      });

      // Click the same heading to collapse
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();
      await expect(loadoutTypeHeading).not.toBeVisible();
    });

    test('should filter weapons by loadout type', async ({ page }) => {
      // Expand filters
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();

      // Get initial weapon count text
      const initialCount = await page.locator('text=/Showing \\d+ of \\d+ weapons/').textContent();

      // Click "Two-Handed" filter button
      await page.getByRole('button', { name: 'Two-Handed' }).click();

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Check that weapon count changed
      const filteredCount = await page.locator('text=/Showing \\d+ of \\d+ weapons/').textContent();
      expect(filteredCount).not.toBe(initialCount);

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/weapon-shop-filter-two-handed.png',
        fullPage: true,
      });
    });

    test('should filter weapons by weapon type', async ({ page }) => {
      // Expand filters
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();

      // Click "Melee" filter button (direct button with that text in the filter panel)
      await page.getByRole('button', { name: 'Melee', exact: true }).click();

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Check that active filter chip is displayed (purple chip for weapon type)
      const filterChip = page.locator('.bg-purple-900').filter({ hasText: 'Melee' });
      await expect(filterChip).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/weapon-shop-filter-melee.png',
        fullPage: true,
      });
    });

    test('should filter weapons by price range', async ({ page }) => {
      // Expand filters
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();

      // Click "Budget (<₡100K)" filter
      await page.getByRole('button', { name: /Budget.*100K/ }).click();

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/weapon-shop-filter-budget.png',
        fullPage: true,
      });
    });

    test('should apply multiple filters simultaneously', async ({ page }) => {
      // Expand filters
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();

      // Apply loadout type filter
      await page.getByRole('button', { name: 'Single', exact: true }).click();
      // Apply weapon type filter
      await page.getByRole('button', { name: 'Melee', exact: true }).click();

      // Wait for filters to apply
      await page.waitForTimeout(500);

      // Check that both filter chips are displayed
      const singleChip = page.locator('.bg-blue-900').filter({ hasText: 'Single' });
      const meleeChip = page.locator('.bg-purple-900').filter({ hasText: 'Melee' });
      await expect(singleChip).toBeVisible();
      await expect(meleeChip).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/weapon-shop-multiple-filters.png',
        fullPage: true,
      });
    });

    test('should clear all filters', async ({ page }) => {
      // Expand filters
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();

      // Apply a filter
      await page.getByRole('button', { name: 'Melee', exact: true }).click();
      await page.waitForTimeout(500);

      // Click "Clear All" button
      await page.getByRole('button', { name: 'Clear All' }).click();

      // Wait for filters to clear
      await page.waitForTimeout(500);

      // Check that filter chip is removed
      const meleeChip = page.locator('.bg-purple-900').filter({ hasText: 'Melee' });
      const isVisible = await meleeChip.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    });

    test('should remove individual filter chips', async ({ page }) => {
      // Expand filters
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();

      // Apply a filter
      await page.getByRole('button', { name: 'Melee', exact: true }).click();
      await page.waitForTimeout(500);

      // Find and click the remove button on the filter chip (aria-label based)
      await page.getByRole('button', { name: 'Remove Melee filter' }).click();

      // Wait for filter to be removed
      await page.waitForTimeout(500);

      // Check that filter chip is removed
      const meleeChip = page.locator('.bg-purple-900').filter({ hasText: 'Melee' });
      const isVisible = await meleeChip.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    });
  });

  test.describe('View Mode Toggle', () => {
    test('should switch to table view', async ({ page }) => {
      // Find the view toggle buttons container and click the last button (table view)
      const viewToggle = page.locator('.flex.gap-2').filter({ has: page.locator('button') });
      await viewToggle.locator('button').last().click();

      // Wait for view to change
      await page.waitForTimeout(500);

      // Check that table is visible
      const table = page.locator('table');
      await expect(table).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/weapon-shop-table-view.png',
        fullPage: true,
      });
    });

    test('should persist view mode preference', async ({ page }) => {
      // Switch to table view
      const viewToggle = page.locator('.flex.gap-2').filter({ has: page.locator('button') });
      await viewToggle.locator('button').last().click();
      await page.waitForTimeout(500);

      // Reload page (re-navigate to handle auth race)
      await navigateToProtectedPage(page, '/weapon-shop');

      // Check that table view is still active
      const table = page.locator('table');
      await expect(table).toBeVisible();
    });
  });

  test.describe('Weapon Comparison', () => {
    test('should select weapons for comparison', async ({ page }) => {
      // Wait for weapons to load
      await page.waitForSelector('.bg-gray-800.p-6.rounded-lg', { timeout: 10000 });

      // Select first two weapons for comparison via checkboxes
      const compareCheckboxes = page.locator('input[type="checkbox"]');
      await compareCheckboxes.nth(0).check();
      await compareCheckboxes.nth(1).check();

      // Wait for comparison bar to appear
      await page.waitForTimeout(500);

      // Check that comparison bar is visible (text: "2 weapons selected")
      await expect(page.getByText(/2 weapons selected/i)).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/weapon-shop-comparison-selected.png',
        fullPage: true,
      });
    });

    test('should open comparison modal', async ({ page }) => {
      // Wait for weapons to load
      await page.waitForSelector('.bg-gray-800.p-6.rounded-lg', { timeout: 10000 });

      // Select two weapons
      const compareCheckboxes = page.locator('input[type="checkbox"]');
      await compareCheckboxes.nth(0).check();
      await compareCheckboxes.nth(1).check();
      await page.waitForTimeout(500);

      // Click "Compare →" button
      await page.getByRole('button', { name: /Compare/ }).click();

      // Wait for modal to open
      await page.waitForTimeout(500);

      // Check that comparison modal is visible (heading: "Compare Weapons")
      await expect(page.getByRole('heading', { name: 'Compare Weapons' })).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/weapon-shop-comparison-modal.png',
        fullPage: true,
      });
    });

    test('should limit comparison to 3 weapons', async ({ page }) => {
      // Wait for weapons to load
      await page.waitForSelector('.bg-gray-800.p-6.rounded-lg', { timeout: 10000 });

      // Select 3 weapons
      const compareCheckboxes = page.locator('input[type="checkbox"]');
      await compareCheckboxes.nth(0).check();
      await compareCheckboxes.nth(1).check();
      await compareCheckboxes.nth(2).check();

      // Check that 4th checkbox is disabled
      const fourthCheckbox = compareCheckboxes.nth(3);
      await expect(fourthCheckbox).toBeDisabled();
    });

    test('should clear comparison selection', async ({ page }) => {
      // Wait for weapons to load
      await page.waitForSelector('.bg-gray-800.p-6.rounded-lg', { timeout: 10000 });

      // Select two weapons
      const compareCheckboxes = page.locator('input[type="checkbox"]');
      await compareCheckboxes.nth(0).check();
      await compareCheckboxes.nth(1).check();
      await page.waitForTimeout(500);

      // Click "Clear" button in the comparison bar
      await page.getByRole('button', { name: /Clear/i }).click();

      // Wait for selection to clear
      await page.waitForTimeout(500);

      // Check that comparison bar is hidden
      const comparisonBar = page.getByText(/weapons selected/i);
      const isVisible = await comparisonBar.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    });
  });

  test.describe('Weapon Detail Modal', () => {
    test('should open weapon detail modal when clicking weapon name', async ({ page }) => {
      // Wait for weapons to load
      await page.waitForSelector('.bg-gray-800.p-6.rounded-lg', { timeout: 10000 });

      // Click on first weapon name (h3 with cursor-pointer class)
      const weaponName = page.locator('.text-xl.font-semibold.cursor-pointer').first();
      await weaponName.click();

      // Wait for modal to open
      await page.waitForTimeout(500);

      // Check that modal overlay is visible
      const modal = page.locator('.fixed.inset-0');
      await expect(modal.first()).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/weapon-shop-detail-modal.png',
        fullPage: true,
      });
    });

    test('should close weapon detail modal', async ({ page }) => {
      // Wait for weapons to load
      await page.waitForSelector('.bg-gray-800.p-6.rounded-lg', { timeout: 10000 });

      // Open modal
      const weaponName = page.locator('.text-xl.font-semibold.cursor-pointer').first();
      await weaponName.click();
      await page.waitForTimeout(500);

      // Close modal by clicking close button
      await page.getByRole('button', { name: /close/i }).click();

      // Wait for modal to close
      await page.waitForTimeout(500);

      // Check that modal overlay is hidden
      const modal = page.locator('.fixed.inset-0');
      const isVisible = await modal.first().isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    });
  });

  test.describe('Purchase Flow', () => {
    test('should show purchase confirmation modal', async ({ page }) => {
      // Wait for weapons to load
      await page.waitForSelector('.bg-gray-800.p-6.rounded-lg', { timeout: 10000 });

      // Find a weapon with "Purchase" button (not disabled)
      const purchaseButton = page.locator('button').filter({ hasText: 'Purchase' }).first();

      // Check if button exists and is enabled
      const isEnabled = await purchaseButton.isEnabled().catch(() => false);

      if (isEnabled) {
        await purchaseButton.click();

        // Wait for confirmation modal
        await page.waitForTimeout(500);

        // Check that confirmation modal is visible
        await expect(page.getByText('Confirm Purchase')).toBeVisible();

        // Take screenshot
        await page.screenshot({
          path: 'test-results/screenshots/weapon-shop-purchase-confirmation.png',
          fullPage: true,
        });

        // Cancel purchase
        await page.getByRole('button', { name: 'Cancel' }).click();
      }
    });

    test('should disable purchase button for insufficient credits', async ({ page }) => {
      // Wait for weapons to load
      await page.waitForSelector('.bg-gray-800.p-6.rounded-lg', { timeout: 10000 });

      // Find a weapon with "Insufficient Credits" button
      const insufficientButton = page.locator('button').filter({ hasText: 'Insufficient Credits' }).first();

      // Check if such a button exists
      const count = await insufficientButton.count();

      if (count > 0) {
        // Check that button is disabled
        await expect(insufficientButton).toBeDisabled();

        // Take screenshot
        await page.screenshot({
          path: 'test-results/screenshots/weapon-shop-insufficient-credits.png',
          fullPage: true,
        });
      }
    });

    test('should show storage full warning when storage is full', async ({ page }) => {
      // Check storage capacity
      const storageText = await page.locator('text=/\\d+ \\/ \\d+/').first().textContent();

      if (storageText) {
        const [current, max] = storageText.split('/').map(s => parseInt(s.trim()));

        if (current === max) {
          // Storage is full
          await expect(page.getByText(/Storage full/i)).toBeVisible();

          // Check that purchase buttons show "Storage Full"
          const storageFullButton = page.locator('button').filter({ hasText: 'Storage Full' }).first();
          await expect(storageFullButton).toBeVisible();
          await expect(storageFullButton).toBeDisabled();

          // Take screenshot
          await page.screenshot({
            path: 'test-results/screenshots/weapon-shop-storage-full.png',
            fullPage: true,
          });
        }
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Re-navigate to handle auth race after viewport change
      await navigateToProtectedPage(page, '/weapon-shop');

      // Check that page is still functional
      await expect(page.getByRole('heading', { name: 'Weapon Shop' })).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/weapon-shop-mobile.png',
        fullPage: true,
      });
    });

    test('should display correctly on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      // Re-navigate to handle auth race after viewport change
      await navigateToProtectedPage(page, '/weapon-shop');

      // Check that page is still functional
      await expect(page.getByRole('heading', { name: 'Weapon Shop' })).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/weapon-shop-tablet.png',
        fullPage: true,
      });
    });
  });

  test.describe('Performance', () => {
    test('should load weapons within acceptable time', async ({ page }) => {
      const startTime = Date.now();

      // Navigate to weapon shop (handles auth race)
      await navigateToProtectedPage(page, '/weapon-shop');

      // Wait for weapons to load
      await page.waitForSelector('.bg-gray-800.p-6.rounded-lg', { timeout: 10000 });

      const loadTime = Date.now() - startTime;

      // Check that load time is under 5 seconds (generous for CI/local variance)
      expect(loadTime).toBeLessThan(5000);
    });

    test('should filter weapons quickly', async ({ page }) => {
      // Expand filters
      await page.getByRole('heading', { name: 'Filters', exact: true }).click();

      const startTime = Date.now();

      // Apply filter using direct button role
      await page.getByRole('button', { name: 'Melee', exact: true }).click();

      // Wait for filter to apply
      await page.waitForTimeout(100);

      const filterTime = Date.now() - startTime;

      // Check that filter time is under 1 second
      expect(filterTime).toBeLessThan(1000);
    });
  });
});
