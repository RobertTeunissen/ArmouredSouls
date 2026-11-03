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
 * Admin Content redesign against the real backend: Meta (`/admin/meta`) with
 * the Tuning, Refinement and Subscriptions sections merged in (the old pages
 * redirect, their endpoints are gone) and the season-scoped Achievements page
 * (`/admin/achievements`) with its stable-type toggle and sortable table. Both
 * pages fit 390 px with touch-sized controls. Set `E2E_SCREENSHOT_DIR` to also
 * save screenshots.
 *
 * Runs in the `admin` project (local targets only, like the other admin specs).
 */
const META = '[data-testid="meta-page"]';
const ACHIEVEMENTS = '[data-testid="achievement-analytics-page"]';
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

test.describe('Admin Content', () => {
  test.beforeEach(() => {
    test.skip(!isLocalTarget(), LOCAL_ONLY_REASON);
  });

  test('serves the new endpoints and removes the merged ones', async ({ request }) => {
    const headers = { Authorization: `Bearer ${await adminToken(request)}` };
    for (const path of ['/api/admin/meta/choices?stables=all', '/api/admin/meta/builds?stables=all', '/api/admin/achievements/analytics?stables=generated']) {
      expect((await request.get(`${API_URL}${path}`, { headers })).status(), path).toBe(200);
    }
    for (const path of ['/api/admin/stats', '/api/admin/tuning/adoption', '/api/admin/refinement/adoption', '/api/subscriptions/admin/analytics']) {
      expect((await request.get(`${API_URL}${path}`, { headers })).status(), path).toBe(404);
    }
    const builds = await (await request.get(`${API_URL}/api/admin/meta/builds?stables=all`, { headers })).json();
    expect(builds.tuning.attributes).toHaveLength(23);
    expect(builds.eventEntry.perEvent).toHaveLength(9);
    expect(builds.refinements.perKind.map((kind: { kind: string }) => kind.kind)).toEqual(['hone', 'augment', 'sharpen', 'forge']);
  });

  for (const old of ['/admin/tuning', '/admin/refinement', '/admin/subscriptions']) {
    test(`${old} redirects to Meta`, async ({ page }) => {
      await gotoAuthed(page, old);
      await expect(page).toHaveURL(/\/admin\/meta$/);
      await expect(page.locator(META)).toBeVisible();
    });
  }

  test('Meta: three groups with the build sections, on the shared filter', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAuthed(page, '/admin/meta?stables=all');
    await expect(page.locator(META)).toBeVisible();
    for (const group of ['Combat settings', 'Robot builds', 'Stable investments']) {
      await expect(page.getByRole('region', { name: group })).toBeVisible();
    }
    const tuning = page.getByRole('region', { name: 'Tuning' });
    await expect(tuning.getByText('robots tuned')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Weapons and refinements' }).getByText('owned', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Event entry' }).getByRole('list', { name: 'Robots entered per event' }).getByRole('listitem')).toHaveCount(9);

    const showAll = tuning.getByRole('button', { name: /Show all \d+ tuned attributes/ });
    if (await showAll.count()) {
      await showAll.click();
      await expect(tuning.getByRole('button', { name: 'Show top 10' })).toHaveAttribute('aria-expanded', 'true');
    }
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-meta-desktop.png`, fullPage: true });

    const reloaded = page.waitForResponse((r) => r.url().includes('/api/admin/meta/builds?stables=generated') && r.status() === 200);
    await page.getByRole('button', { name: 'Generated', exact: true }).click();
    await reloaded;
    await expect(page).toHaveURL(/stables=generated/);
  });

  test('Achievements: season scope, stable-type toggle and a sortable table', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAuthed(page, '/admin/achievements');
    await expect(page.locator(ACHIEVEMENTS)).toBeVisible();
    await expect(page.getByTestId('achievement-scope')).toContainText('This season');
    await expect(page.getByRole('region', { name: 'Unlock rate per achievement, by tier' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Easier than its tier says' })).toBeVisible();

    const table = page.getByRole('region', { name: 'All achievements' }).getByRole('table');
    await table.getByRole('button', { name: /Median day/ }).click();
    await expect(table.getByRole('columnheader', { name: /Median day/ })).toHaveAttribute('aria-sort', 'descending');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-achievements-desktop.png`, fullPage: true });

    const reloaded = page.waitForResponse((r) => r.url().includes('/api/admin/achievements/analytics?stables=generated') && r.status() === 200);
    await page.getByRole('button', { name: 'Generated' }).click();
    await reloaded;
    await expect(page).toHaveURL(/stables=generated/);
    await expect(page.getByTestId('achievement-scope')).toContainText('generated stables');
  });

  for (const [path, selector, name] of [['/admin/meta', META, 'meta'], ['/admin/achievements', ACHIEVEMENTS, 'achievements']] as const) {
    test(`${name} fits 390 px with touch-sized controls`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 900 });
      await gotoAuthed(page, path);
      await expect(page.locator(selector)).toBeVisible();
      await expect(page.locator(`${selector} section h2, ${selector} section h3`).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalOverflow(page, selector);
      await expectTouchTargets(page, selector);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-${name}-mobile.png`, fullPage: true });
    });
  }
});
