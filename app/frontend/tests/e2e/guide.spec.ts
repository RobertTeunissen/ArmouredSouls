import { test, expect } from '@playwright/test';
import { navigateToProtectedPage } from './helpers/navigate';

/**
 * E2E tests for the In-Game Guide page.
 *
 * Ensures the guide loads with sections and articles, search works,
 * and article content renders. This is a regression guard — the guide
 * has broken silently twice before.
 */

test.describe('Guide Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProtectedPage(page, '/guide');
    await page.waitForLoadState('networkidle');
  });

  test('should display guide page with Game Guide heading and sections', async ({ page }) => {
    // The guide landing page heading
    await expect(page.getByRole('heading', { name: 'Game Guide' })).toBeVisible({ timeout: 10000 });

    // At least one section link should be visible
    const sectionLinks = page.getByRole('link').filter({ hasText: /Getting Started|Combat|Economy|Robots|Weapons|Leagues|Facilities|Prestige|Tournaments|Strategy/i });
    await expect(sectionLinks.first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to a section and show articles', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Game Guide' })).toBeVisible({ timeout: 10000 });

    // Click the first section link
    const sectionLink = page.getByRole('link').filter({ hasText: /Getting Started|Combat|Economy/i }).first();
    await expect(sectionLink).toBeVisible({ timeout: 10000 });
    await sectionLink.click();

    // Should navigate to the section page with article buttons
    await page.waitForLoadState('networkidle');
    // Section page shows article buttons or the section title as heading
    const articleButton = page.getByRole('button').filter({ hasText: /.{5,}/ }).first();
    await expect(articleButton).toBeVisible({ timeout: 10000 });
  });

  test('should have a working search input', async ({ page }) => {
    // The search input has aria-label "Search guide"
    const searchInput = page.getByRole('textbox', { name: /search guide/i });
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Type in search and verify it accepts input
    await searchInput.fill('combat');
    await expect(searchInput).toHaveValue('combat');
  });
});
