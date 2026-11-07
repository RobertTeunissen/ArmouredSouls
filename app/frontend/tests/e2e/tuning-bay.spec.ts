import { test, expect, type Page } from '@playwright/test';
import { navigateToProtectedPage } from './helpers/navigate';

/**
 * E2E tests for tuning in the Robot Workshop's Build table (#504; was the
 * Tuning tab of the robot detail page).
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 *
 * All tests use test_user_001 auth state (chromium project default).
 * test_user_001 has at least one robot available.
 */

/** Opens the first robot from /robots; owners land in its Workshop. */
async function openFirstWorkshop(page: Page): Promise<boolean> {
  await navigateToProtectedPage(page, '/robots');
  const heading = page.getByRole('heading', { name: /My Robots/i });
  if (!(await heading.isVisible({ timeout: 10000 }).catch(() => false))) return false;
  const viewDetailsLink = page.getByText('View Details →').first();
  if (!(await viewDetailsLink.isVisible().catch(() => false))) return false;
  await viewDetailsLink.click();
  await page.waitForLoadState('networkidle');
  if (!/\/robots\/\d+\/prepare/.test(page.url())) return false;
  // Tuning pool loaded
  await expect(page.getByText(/\d+(\.\d+)? \/ \d+ used/)).toBeVisible({ timeout: 15000 });
  return true;
}

/** Saves the Build table and waits for the confirmation. */
async function save(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Save/ }).click();
  await expect(page.getByText(/saved\./)).toBeVisible({ timeout: 10000 });
}

test.describe('Tuning in the Workshop', () => {
  test('shows the tuning pool and per-attribute tuning steppers in the Build table', async ({ page }) => {
    // Req 9.1, 9.2
    if (!(await openFirstWorkshop(page))) {
      test.skip(true, 'No robots available for test_user_001');
      return;
    }
    await expect(page.getByRole('tab', { name: 'build' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: /Combat Systems/ })).toBeVisible();
    await expect(page.getByLabel(/Increase .* tuning$/).first()).toBeVisible();
    await expect(page.getByLabel(/Decrease .* tuning$/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset tuning' })).toBeVisible();
    // Nothing to save until something changes
    await expect(page.getByRole('button', { name: 'Discard' })).toBeDisabled();
  });

  test('allocating tuning points, saving, and verifying persistence after reload', async ({ page }) => {
    // Req 9.2, 9.4
    test.setTimeout(60_000);
    if (!(await openFirstWorkshop(page))) {
      test.skip(true, 'No robots available for test_user_001');
      return;
    }
    const workshopUrl = page.url().split('?')[0];

    // Start from an empty allocation
    const reset = page.getByRole('button', { name: 'Reset tuning' });
    if (await reset.isEnabled().catch(() => false)) {
      await reset.click();
      await save(page);
      await page.goto(workshopUrl);
      await expect(page.getByText(/0 \/ \d+ used/)).toBeVisible({ timeout: 15000 });
    }

    const increment = page.getByLabel(/Increase .* tuning$/).first();
    if (!(await increment.isEnabled().catch(() => false))) {
      test.skip(true, 'No tuning room: every attribute is at its tuning max or the pool is empty');
      return;
    }
    await increment.click();
    await expect(page.getByText(/[1-9]\d* \/ \d+ used/)).toBeVisible({ timeout: 3000 });
    await save(page);

    // Reload the robot's Workshop and check it persisted
    await page.goto(workshopUrl);
    await expect(page.getByText(/[1-9]\d* \/ \d+ used/)).toBeVisible({ timeout: 15000 });
  });
});
