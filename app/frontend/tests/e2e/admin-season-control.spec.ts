import { test, expect } from '@playwright/test';
import {
  LOCAL_ONLY_REASON,
  expectNoHorizontalOverflow,
  expectTouchTargets,
  gotoAuthed,
  isLocalTarget,
} from './helpers/automaton';

/**
 * Season Control (`/admin/seasons`) against the real backend: the timeline
 * and history load, the preview counts the real database by stable type, and
 * the rollover dialog only enables its confirm button once the phrase is
 * typed. It never confirms: a rollover deletes every generated stable and
 * resets the seeded ones, which later specs rely on. The rollover itself (as a
 * background run with its stages) is covered against the real database by the
 * backend Heavy suite `seasonRollover.test.ts`.
 *
 * Runs in the `admin` project (local targets only, like the other admin specs).
 */

const PAGE = '[data-testid="season-control-page"]';

test.describe('Season Control', () => {
  test.beforeEach(() => {
    test.skip(!isLocalTarget(), LOCAL_ONLY_REASON);
  });

  test('previews the rollover and guards it behind the typed phrase', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoAuthed(page, '/admin/seasons');
    await expect(page.locator(PAGE)).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Season \d+/ }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rollover history' })).toBeVisible();

    await page.getByRole('button', { name: 'Preview rollover' }).click();
    await expect(page.getByText('Human players')).toBeVisible();
    await expect(page.getByText('Generated stables', { exact: true })).toBeVisible();
    await expect(page.getByText('Battles and summaries')).toBeVisible();

    await page.getByRole('button', { name: /^Roll over Season \d+…$/ }).click();
    const dialog = page.getByRole('dialog', { name: /^Roll over Season \d+\?$/ });
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole('button', { name: /^Roll over Season \d+$/ });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/to confirm/).fill('CONFIRM_ROLLOVE');
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/to confirm/).fill('CONFIRM_ROLLOVER');
    await expect(confirm).toBeEnabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });

  test('stays within the viewport with touch-sized controls on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await gotoAuthed(page, '/admin/seasons');
    await expect(page.locator(PAGE)).toBeVisible();
    await page.getByRole('button', { name: 'Preview rollover' }).click();
    await expect(page.getByText('Human players')).toBeVisible();
    await page.getByRole('button', { name: /Testing tools/ }).click();

    await expectNoHorizontalOverflow(page, PAGE);
    await expectTouchTargets(page, PAGE);
  });
});
