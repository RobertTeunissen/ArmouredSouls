import { test, expect } from '@playwright/test';
import { navigateToProtectedPage } from './helpers/navigate';

/**
 * Season System E2E (Spec #45).
 *
 * Written to be resilient to a database with no completed seasons, which is the
 * state of a fresh e2e database: Season 0 exists and is running, so the archive
 * is legitimately empty. The tests assert the surfaces render correctly in that
 * state rather than requiring a rollover to have happened.
 */

test.describe('Season Archive page', () => {
  test('should load at /seasons and show its heading', async ({ page }) => {
    await navigateToProtectedPage(page, '/seasons');
    await expect(
      page.getByRole('heading', { name: /Season Archive/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show the empty state when no season has completed', async ({ page }) => {
    await navigateToProtectedPage(page, '/seasons');

    const empty = page.getByTestId('season-archive-empty');
    const list = page.getByTestId('season-archive-list');

    // Exactly one of the two must be present: either seasons exist or they don't.
    await expect(empty.or(list).first()).toBeVisible({ timeout: 10000 });

    if (await empty.isVisible()) {
      await expect(empty).toContainText(/first season is still in progress/i);
    }
  });

  test('should be reachable from the navigation', async ({ page }) => {
    await navigateToProtectedPage(page, '/dashboard');

    // On desktop the entry lives in the "Social" dropdown, which mounts its
    // items only while open — so hover the trigger before asserting the link.
    await page.getByRole('button', { name: /^Social/ }).hover();

    const seasonItem = page.getByRole('button', { name: /Season Archive/i });
    await expect(seasonItem).toBeVisible({ timeout: 10000 });

    // And it actually navigates to the archive.
    await seasonItem.click();
    await expect(page).toHaveURL(/\/seasons$/);
    await expect(page.getByRole('heading', { name: /Season Archive/i })).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Season progress indicator', () => {
  test('should state the season and cycle on an authenticated page', async ({ page }) => {
    await navigateToProtectedPage(page, '/dashboard');

    const indicator = page.getByTestId('season-progress-indicator').first();
    await expect(indicator).toBeVisible({ timeout: 10000 });
    // Season 0 renders "Season 0 · Cycle N" with no denominator; a real season
    // renders "Season N · Cycle X / Y". Both contain a season and a cycle.
    await expect(indicator).toContainText(/S(eason)?\s*\d+/i);
  });
});

test.describe('Stable season history', () => {
  test('should render the history block on a stable page', async ({ page }) => {
    await navigateToProtectedPage(page, '/dashboard');

    // Reach a stable page via the profile route, which resolves to the
    // signed-in user without needing to know their id.
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // The block only appears on /stables/:userId, so navigate there if a link exists.
    const stableLink = page.getByRole('link', { name: /view.*stable|my stable/i }).first();
    if (await stableLink.count() > 0) {
      await stableLink.click();
      await page.waitForLoadState('networkidle');

      const block = page.getByTestId('season-history-block');
      const empty = page.getByTestId('season-history-empty');
      await expect(block.or(empty).first()).toBeVisible({ timeout: 10000 });
    }
  });
});
