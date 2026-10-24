import { test, expect } from '@playwright/test';
import {
  API_URL,
  LOCAL_ONLY_REASON,
  adminToken,
  expectNoHorizontalOverflow,
  expectTouchTargets,
  gotoAuthed,
  isLocalTarget,
} from './helpers/automaton';

/**
 * Admin Practice Arena (`/admin/practice-arena`) against the real backend: a
 * practice battle run through the real API is recorded (persisted per
 * request) and shows up on the page today, by UTC day.
 *
 * Runs in the `admin` project (local targets only, like the other admin specs).
 */

const PAGE = '[data-testid="practice-arena-page"]';
const SPARRING = {
  type: 'sparring',
  config: { botTier: 'AverageBot', loadoutType: 'single', rangeBand: 'melee', stance: 'balanced', yieldThreshold: 10 },
};

test.describe('Admin Practice Arena', () => {
  test.beforeEach(() => {
    test.skip(!isLocalTarget(), LOCAL_ONLY_REASON);
  });

  test('records a practice battle and shows it today', async ({ page, request }) => {
    const token = await adminToken(request);
    const battle = await request.post(`${API_URL}/api/practice-arena/battle`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { robot1: SPARRING, robot2: { ...SPARRING, config: { ...SPARRING.config, botTier: 'ExpertBot' } }, count: 2 },
    });
    expect(battle.status()).toBe(200);

    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoAuthed(page, '/admin/practice-arena');
    await expect(page.locator(PAGE)).toBeVisible();

    const table = page.getByRole('table', { name: /usage per UTC day/ });
    const today = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Today (so far)' }) });
    // Battles column: at least the two just run.
    await expect(today.getByRole('cell').first()).toHaveText(/^\d[\d,]*$/);
    expect(Number((await today.getByRole('cell').first().innerText()).replace(/,/g, ''))).toBeGreaterThanOrEqual(2);
    await expect(page.getByText('Sparring vs sparring')).toBeVisible();
  });

  test('stays within the viewport with touch-sized controls on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await gotoAuthed(page, '/admin/practice-arena');
    await expect(page.locator(PAGE)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Practice Arena status' })).toBeVisible();

    await expectNoHorizontalOverflow(page, PAGE);
    await expectTouchTargets(page, PAGE);
  });
});
