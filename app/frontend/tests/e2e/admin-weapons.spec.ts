import { test, expect } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTouchTargets, gotoAuthed } from './helpers/automaton';
import { readyWeapons } from '../../src/components/admin/weapons/__tests__/weaponsFixture';

/**
 * Admin Weapons (`/admin/weapons`).
 *
 * 1. Against the real backend: the page answers (on a fresh database that is
 *    the "collecting" state, since the analysis needs seven days of records).
 * 2. With a mocked ready analysis: every control changes the URL and, where it
 *    should, the request, on desktop and at 390 px.
 *
 * Runs in the `admin` project.
 */
const PAGE = '[data-testid="weapons-page"]';
const ANALYSIS = '**/api/admin/analysis/weapons**';

test.describe('Admin Weapons', () => {
  test('answers from the real backend', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = page.waitForResponse((r) => r.url().includes('/api/admin/analysis/weapons'));
    await gotoAuthed(page, '/admin/weapons');
    expect((await response).status()).toBe(200);
    await expect(page.locator(PAGE)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Collecting battle-time builds|Archetypes/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Weapons' }).first()).toBeVisible();
  });

  test('every control drives the URL and the request (mocked analysis)', async ({ page }) => {
    const requests: URL[] = [];
    await page.route(ANALYSIS, async (route) => {
      requests.push(new URL(route.request().url()));
      await route.fulfill({ json: readyWeapons() });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAuthed(page, '/admin/weapons');
    await expect(page.getByRole('heading', { name: 'Archetypes: range × loadout · All modes' })).toBeVisible();
    expect(requests.at(-1)?.searchParams.get('range')).toBe('7d');
    expect(requests.at(-1)?.searchParams.get('strength')).toBe('all');

    await page.getByRole('combobox', { name: 'Battles from' }).selectOption('30d');
    await expect(page).toHaveURL(/range=30d/);
    await expect.poll(() => requests.at(-1)?.searchParams.get('range')).toBe('30d');

    await page.getByRole('button', { name: 'Top 10%', exact: true }).click();
    await expect(page).toHaveURL(/strength=top10/);
    await expect.poll(() => requests.at(-1)?.searchParams.get('strength')).toBe('top10');

    const count = requests.length;
    await page.getByRole('button', { name: '1v1', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Matchups · 1v1' })).toBeVisible();
    expect(requests.length).toBe(count);

    await page.getByRole('button', { name: 'Loadouts', exact: true }).click();
    await expect(page).toHaveURL(/matchups=loadouts/);
    await expect(page.getByRole('rowheader', { name: 'Weapon + shield', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Show all 14 weapons' }).click();
    await expect(page.getByRole('rowheader', { name: 'Ion Beam', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Show the 2 weapons no player owns' }).click();
    await expect(page.getByText('Railgun', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page).toHaveURL(/\/admin\/weapons$/);
    await expect.poll(() => requests.at(-1)?.searchParams.get('strength')).toBe('all');

    const before = requests.length;
    await page.getByRole('button', { name: /Refresh/ }).click();
    await expect.poll(() => requests.length).toBeGreaterThan(before);
  });

  test('works at 390 px: grids fit, weapon cards, no overflow', async ({ page }) => {
    await page.route(ANALYSIS, (route) => route.fulfill({ json: readyWeapons() }));
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAuthed(page, '/admin/weapons?column=duel');
    await expect(page.getByRole('heading', { name: 'Archetypes: range × loadout · 1v1' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Weapon effects' })).toBeVisible();
    // Screen-reader tables are clipped to 1 px, so they cannot overflow visually.
    await expectNoHorizontalOverflow(page, PAGE, { exclude: '.sr-only' });
    await expectTouchTargets(page, PAGE);
  });
});
