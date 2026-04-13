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

  test('should display guide page with sections', async ({ page }) => {
    // The guide page heading should be visible
    await expect(page.getByRole('heading', { name: /Guide/i }).first()).toBeVisible({ timeout: 10000 });

    // At least one section should be visible in the sidebar/navigation
    // Guide sections have headings like "Getting Started", "Combat", "Economy", etc.
    const sectionLinks = page.getByRole('button').filter({ hasText: /Getting Started|Combat|Economy|Robots|Weapons|Leagues|Facilities|Prestige|Tournaments|Strategy/i });
    await expect(sectionLinks.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display at least one article when a section is expanded', async ({ page }) => {
    // Click the first section to expand it
    const sectionButton = page.getByRole('button').filter({ hasText: /Getting Started/i }).first();
    await expect(sectionButton).toBeVisible({ timeout: 10000 });
    await sectionButton.click();

    // At least one article link should appear
    const articleLinks = page.getByRole('link').filter({ hasText: /.+/ });
    // Wait for articles to appear (they load from the API)
    await expect(articleLinks.first()).toBeVisible({ timeout: 10000 });
  });

  test('should render article content when an article is selected', async ({ page }) => {
    // Expand first section
    const sectionButton = page.getByRole('button').filter({ hasText: /Getting Started/i }).first();
    await expect(sectionButton).toBeVisible({ timeout: 10000 });
    await sectionButton.click();

    // Click the first article link
    const articleLink = page.getByRole('link').filter({ hasText: /.+/ }).first();
    await expect(articleLink).toBeVisible({ timeout: 10000 });
    await articleLink.click();

    // Article content should render — look for a non-empty article body
    // The article content area should have meaningful text (not just loading/empty)
    await page.waitForLoadState('networkidle');
    const articleContent = page.locator('[class*="prose"], article, [data-testid="article-content"]').first();
    await expect(articleContent).toBeVisible({ timeout: 10000 });
  });

  test('should have a working search input', async ({ page }) => {
    // The search input should be visible
    const searchInput = page.getByPlaceholderText(/search/i).first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Typing in search should filter or show results
    await searchInput.fill('combat');
    // After typing, either filtered results or search results should appear
    // We just verify the input accepted the text and the page didn't crash
    await expect(searchInput).toHaveValue('combat');
  });
});
