import { test, expect } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTouchTargets, gotoAuthed } from './helpers/automaton';
import { readyResponse } from '../../src/components/admin/attributes/__tests__/attributeFixtures';

/**
 * Admin Attributes (`/admin/attributes`, formerly Robot Stats).
 *
 * 1. Against the real backend: the page answers (on a fresh database that is
 *    the "collecting" state, since the analysis needs seven days of records),
 *    and the old /admin/robot-stats link redirects.
 * 2. With a mocked ready analysis: every control changes the URL and the
 *    request, on desktop and at 390 px.
 *
 * Runs in the `admin` project.
 */
const PAGE = '[data-testid="attributes-page"]';
const ANALYSIS = '**/api/admin/analysis/attributes**';

test.describe('Admin Attributes', () => {
  test('answers from the real backend and replaces Robot Stats', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = page.waitForResponse((r) => r.url().includes('/api/admin/analysis/attributes'));
    await gotoAuthed(page, '/admin/robot-stats');
    await expect(page).toHaveURL(/\/admin\/attributes$/);
    expect((await response).status()).toBe(200);
    await expect(page.locator(PAGE)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Collecting battle-time builds|Attribute effects/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Attributes' }).first()).toBeVisible();
  });

  test('every control drives the URL and the request (mocked analysis)', async ({ page }) => {
    const requests: URL[] = [];
    await page.route(ANALYSIS, async (route) => {
      requests.push(new URL(route.request().url()));
      await route.fulfill({ json: readyResponse() });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAuthed(page, '/admin/attributes');
    await expect(page.getByRole('heading', { name: 'Attribute effects' })).toBeVisible();
    expect(requests.at(-1)?.searchParams.get('range')).toBe('7d');
    expect(requests.at(-1)?.searchParams.get('stance')).toBe('true');

    await page.getByRole('combobox', { name: 'Battles from' }).selectOption('30d');
    await expect(page).toHaveURL(/range=30d/);
    await expect.poll(() => requests.at(-1)?.searchParams.get('range')).toBe('30d');

    // The toggle state lives in the URL; it flips when the router commits the change.
    const stance = page.getByRole('checkbox', { name: '+ Stance' });
    await stance.click();
    await expect(stance).not.toBeChecked();
    await expect(page).toHaveURL(/off=stance/);
    await expect.poll(() => requests.at(-1)?.searchParams.get('stance')).toBe('false');

    const count = requests.length;
    await page.getByRole('button', { name: 'Team', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Biggest effects · Team' })).toBeVisible();
    expect(requests.length).toBe(count);

    await page.getByRole('button', { name: 'By group' }).click();
    await expect(page.getByRole('table', { name: /Effect of each attribute/ }).getByRole('rowheader').first()).toHaveText('Combat Power');

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page).toHaveURL(/\/admin\/attributes$/);
    await expect.poll(() => requests.at(-1)?.searchParams.get('stance')).toBe('true');

    await page.getByRole('button', { name: /Refresh/ }).click();
    await expect.poll(() => requests.length).toBeGreaterThan(count + 1);
  });

  test('works at 390 px: cards, layer drawer, no overflow', async ({ page }) => {
    await page.route(ANALYSIS, (route) => route.fulfill({ json: readyResponse() }));
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAuthed(page, '/admin/attributes?column=duel');
    await expect(page.getByRole('list', { name: 'Attribute effects, 1v1' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: '+ Tuning' })).toBeHidden();
    await page.getByRole('button', { name: /Layers \(5\/5 on\)/ }).click();
    await expect(page.getByRole('checkbox', { name: '+ Tuning' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Build profiles' })).toBeVisible();
    await expectNoHorizontalOverflow(page, PAGE);
    await expectTouchTargets(page, PAGE);
  });
});
