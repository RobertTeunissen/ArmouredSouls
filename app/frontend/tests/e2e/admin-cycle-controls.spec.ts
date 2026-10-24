import { test, expect } from '@playwright/test';
import {
  LOCAL_ONLY_REASON,
  expectNoHorizontalOverflow,
  expectTouchTargets,
  gotoAuthed,
  isLocalTarget,
} from './helpers/automaton';

/**
 * Cycle Controls (`/admin/cycles`) against the real backend, with the
 * scheduler disabled as in CI: a Run button starts the job in the background
 * through the real API, the page shows it, and the persistent run history
 * records it with a duration. The ten buttons are each covered against the
 * real database by the backend Heavy suite `schedulerManualRuns.test.ts`;
 * this spec proves the browser path end to end.
 *
 * Runs in the `admin` project (local targets only, like the other admin specs):
 * it runs a real Grand Melee slot, which changes seeded state.
 */

const PAGE = '[data-testid="cycle-controls-page"]';
const JOB_LABELS = [
  'Settlement', 'League 1v1', 'League 2v2', 'Tournament 1v1', 'Tag Team',
  'King of the Hill', 'League 3v3', 'Tournament 2v2', 'Grand Melee', 'Tournament 3v3',
];

test.describe('Cycle Controls', () => {
  test.beforeEach(() => {
    test.skip(!isLocalTarget(), LOCAL_ONLY_REASON);
  });

  test('offers a Run button per job and runs Grand Melee from the browser', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoAuthed(page, '/admin/cycles');
    await expect(page.locator(PAGE)).toBeVisible();

    const schedule = page.getByRole('table', { name: 'Scheduler slots with their last run' });
    await expect(schedule).toBeVisible();
    for (const label of JOB_LABELS) {
      await expect(schedule.getByRole('button', { name: `Run ${label} now`, exact: true })).toBeVisible();
    }

    await schedule.getByRole('button', { name: 'Run Grand Melee now', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Run Grand Melee now?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Run now' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Grand Melee started.' })).toBeVisible();

    // The persistent history records the finished run with its duration.
    const history = page.getByRole('table', { name: 'Scheduler runs, restarts and missed runs, newest first' });
    const row = history.getByRole('row').filter({ hasText: 'Grand Melee' }).filter({ hasText: /Manual · / }).first();
    await expect(row).toContainText('Success', { timeout: 60_000 });
    await expect(row).toContainText(/\d+s/);

    // And the schedule row shows it as the slot's last run.
    const slotRow = schedule.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Grand Melee' }) });
    await expect(slotRow).toContainText('Manual · ');
    await expect(slotRow).toContainText('Success');
  });

  test('stays within the viewport with touch-sized controls on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await gotoAuthed(page, '/admin/cycles');
    await expect(page.locator(PAGE)).toBeVisible();
    await expect(page.getByRole('list', { name: 'Scheduler slots with their last run' })).toBeVisible();

    await expectNoHorizontalOverflow(page, PAGE);
    await expectTouchTargets(page, PAGE);
  });
});
