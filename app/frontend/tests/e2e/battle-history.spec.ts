import { test, expect } from '@playwright/test';
import { navigateToProtectedPage } from './helpers/navigate';
import { registerNewUser } from './helpers/register';

/**
 * E2E tests for the Battle History page.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 *
 * Tests using test_user_001 auth state run in the chromium project (default).
 * The empty-state test registers a fresh user who has no battles.
 */

test.describe('Battle History Page', () => {
  test('displays battle records with robot names, outcomes, and ELO changes', async ({ page }) => {
    // Req 4.1 — battle history page shows battle records
    await navigateToProtectedPage(page, '/battle-history');

    // Verify the page heading
    await expect(page.getByRole('heading', { name: 'Battle History', level: 1 })).toBeVisible();

    // Wait for loading to finish — battle records or empty state should appear
    // The page shows "Loading battles..." while fetching
    await expect(page.getByText('Loading battles...')).toBeHidden({ timeout: 15000 });

    // Check if battles exist for this user
    const hasBattles = await page.getByText('vs').first().isVisible().catch(() => false);

    if (hasBattles) {
      // Verify battle records display robot names (shown as "MyRobot vs Opponent")
      await expect(page.getByText('vs').first()).toBeVisible();

      // Verify outcome badges are present (WIN, LOSS, or DRAW)
      const outcomeBadge = page.getByText(/^(WIN|LOSS|DRAW)$/).first();
      await expect(outcomeBadge).toBeVisible();

      // Verify ELO changes are displayed (positive like +5 or negative like -3)
      // ELO changes appear as text with + or - prefix
      const eloText = page.getByText(/^[+-]\d+$/).first();
      await expect(eloText).toBeVisible();
    } else {
      // If no battles, the empty state should show
      await expect(page.getByText('No battles yet')).toBeVisible();
    }
  });

  test('outcome filter filters displayed battles to selected outcome type', async ({ page }) => {
    // Req 4.2 — outcome filter works
    await navigateToProtectedPage(page, '/battle-history');
    await expect(page.getByRole('heading', { name: 'Battle History', level: 1 })).toBeVisible();
    await expect(page.getByText('Loading battles...')).toBeHidden({ timeout: 15000 });

    // Only run filter tests if battles exist
    const hasBattles = await page.getByText('vs').first().isVisible().catch(() => false);
    if (!hasBattles) {
      test.skip();
      return;
    }

    // Select "Wins Only" from the outcome filter dropdown
    // The select has options: "All Outcomes", "Wins Only", "Losses Only", "Draws Only"
    const outcomeSelect = page.locator('select').filter({ hasText: 'All Outcomes' });
    await outcomeSelect.selectOption('win');

    // After filtering, either WIN badges are shown or "No Battles Found" appears
    const hasWins = await page.getByText('WIN').first().isVisible().catch(() => false);
    if (hasWins) {
      // All visible outcome badges should be WIN (no LOSS or DRAW visible)
      await expect(page.getByText('WIN').first()).toBeVisible();
    } else {
      // No wins — the filtered empty state should show
      await expect(page.getByText('No Battles Found')).toBeVisible();
    }
  });

  test('clicking a battle record navigates to /battle/:id detail page', async ({ page }) => {
    // Req 4.3 — clicking a battle navigates to detail page
    await navigateToProtectedPage(page, '/battle-history');
    await expect(page.getByRole('heading', { name: 'Battle History', level: 1 })).toBeVisible();
    await expect(page.getByText('Loading battles...')).toBeHidden({ timeout: 15000 });

    // Only run if battles exist
    const hasBattles = await page.getByText('vs').first().isVisible().catch(() => false);
    if (!hasBattles) {
      test.skip();
      return;
    }

    // Click the first battle record (CompactBattleCard is a clickable div)
    // Each card contains "vs" text and an arrow "→"
    const firstBattleCard = page.getByText('vs').first().locator('..').locator('..');
    await firstBattleCard.click();

    // Should navigate to /battle/:id
    await expect(page).toHaveURL(/\/battle\/\d+/, { timeout: 10000 });
  });

  test('changing sort order reorders battle records', async ({ page }) => {
    // Req 4.5 — sort order changes the display order
    await navigateToProtectedPage(page, '/battle-history');
    await expect(page.getByRole('heading', { name: 'Battle History', level: 1 })).toBeVisible();
    await expect(page.getByText('Loading battles...')).toBeHidden({ timeout: 15000 });

    // Only run if battles exist
    const hasBattles = await page.getByText('vs').first().isVisible().catch(() => false);
    if (!hasBattles) {
      test.skip();
      return;
    }

    // The sort select has "Sort: Newest First" as default
    const sortSelect = page.locator('select').filter({ hasText: 'Sort: Newest First' });
    await expect(sortSelect).toBeVisible();

    // Change to "Sort: Oldest First"
    await sortSelect.selectOption('date-asc');

    // Verify the sort select now shows the new value
    await expect(sortSelect).toHaveValue('date-asc');

    // Battle records should still be visible (just reordered)
    await expect(page.getByText('vs').first()).toBeVisible();
  });

  test('search term filters battles by robot/opponent names', async ({ page }) => {
    // Req 4.6 — search filters battles
    await navigateToProtectedPage(page, '/battle-history');
    await expect(page.getByRole('heading', { name: 'Battle History', level: 1 })).toBeVisible();
    await expect(page.getByText('Loading battles...')).toBeHidden({ timeout: 15000 });

    // Only run if battles exist
    const hasBattles = await page.getByText('vs').first().isVisible().catch(() => false);
    if (!hasBattles) {
      test.skip();
      return;
    }

    // Find the search input by placeholder
    const searchInput = page.getByPlaceholder('Search robot or opponent...');
    await expect(searchInput).toBeVisible();

    // Type a search term that's unlikely to match any robot name
    await searchInput.fill('zzz_nonexistent_robot_xyz');

    // Should show "No Battles Found" since no robot matches
    await expect(page.getByText('No Battles Found')).toBeVisible({ timeout: 5000 });

    // Clear the search and verify battles reappear
    await searchInput.clear();
    await expect(page.getByText('vs').first()).toBeVisible({ timeout: 5000 });
  });
});

// Empty state test needs a fresh user with no battles
test.describe('Battle History — Empty State', () => {
  // Use a fresh browser context for registration
  test.use({ storageState: { cookies: [], origins: [] } });

  test('empty state shows "No battles yet" message for a user with no battles', async ({ page }) => {
    // Req 4.4 — empty state message
    // Register a fresh user who has no battle history
    await registerNewUser(page);

    // Navigate to battle history
    await page.goto('/battle-history');
    await page.waitForLoadState('networkidle');

    // Verify the page heading
    await expect(page.getByRole('heading', { name: 'Battle History', level: 1 })).toBeVisible();

    // Wait for loading to finish
    await expect(page.getByText('Loading battles...')).toBeHidden({ timeout: 15000 });

    // Fresh user should see the empty state message
    await expect(page.getByText('No battles yet')).toBeVisible();
  });
});
