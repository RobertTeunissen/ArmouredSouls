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
 * Admin Maintenance retirement against the real backend: the Repair Log is a
 * Repairs block on Economy (`/admin/repair-log` redirects there), the Audit
 * Log is Admin actions under Security & Moderation (`/admin/audit-log`
 * redirects to `/admin/actions`), changelog edits are recorded, and the
 * forgeable POST and the unused maintenance endpoints are gone. Both pages
 * fit 390 px with touch-sized controls. Set `E2E_SCREENSHOT_DIR` to also save
 * screenshots.
 *
 * Runs in the `admin` project (local targets only, like the other admin specs).
 */

const ECONOMY = '[data-testid="economy-overview-page"]';
const ACTIONS = '[data-testid="admin-actions-page"]';
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

test.describe('Admin Maintenance', () => {
  test.beforeEach(() => {
    test.skip(!isLocalTarget(), LOCAL_ONLY_REASON);
  });

  test('serves Admin actions and the repairs figures; the removed endpoints are gone', async ({ request }) => {
    const headers = { Authorization: `Bearer ${await adminToken(request)}` };
    const actions = await request.get(`${API_URL}/api/admin/actions?result=failure&pageSize=5`, { headers });
    expect(actions.status()).toBe(200);
    const body = await actions.json();
    expect(Object.keys(body.counts.byArea)).toEqual(['cycles', 'season', 'automatons', 'moderation', 'players', 'changelog', 'other']);
    expect(body.entries.every((entry: { result: string }) => entry.result === 'failure')).toBe(true);

    const economy = await (await request.get(`${API_URL}/api/admin/economy?stables=all&window=season`, { headers })).json();
    expect(Object.keys(economy.repairs)).toEqual(['automatic', 'manual', 'total', 'playerStables', 'byStableType']);

    const gone: [string, string][] = [
      ['get', '/api/admin/audit-log'],
      ['get', '/api/admin/audit-log/repairs'],
      ['post', '/api/admin/audit-log'],
      ['post', '/api/admin/repair/all'],
      ['post', '/api/admin/recalculate-hp'],
      ['post', '/api/admin/daily-finances/process'],
      ['post', '/api/admin/snapshots/backfill'],
      ['post', '/api/admin/scheduler/trigger/league'],
    ];
    for (const [method, path] of gone) {
      const response = method === 'get' ? await request.get(`${API_URL}${path}`, { headers }) : await request.post(`${API_URL}${path}`, { headers, data: {} });
      expect(response.status(), `${method.toUpperCase()} ${path}`).toBe(404);
    }
  });

  test('records changelog edits as admin actions', async ({ request }) => {
    const headers = { Authorization: `Bearer ${await adminToken(request)}` };
    const title = `E2E admin-actions ${Date.now()}`;
    const created = await request.post(`${API_URL}/api/changelog/admin`, { headers, data: { title, body: 'Recorded by the admin-maintenance spec.', category: 'feature' } });
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    expect((await request.delete(`${API_URL}/api/changelog/admin/${id}`, { headers })).ok()).toBe(true);

    const recent = await (await request.get(`${API_URL}/api/admin/actions?area=changelog&pageSize=10`, { headers })).json();
    const mine = recent.entries.filter((entry: { summary: { entryId?: number } }) => entry.summary?.entryId === id);
    expect(mine.map((entry: { operationType: string }) => entry.operationType)).toEqual(['changelog_delete', 'changelog_create']);
    expect(mine[1].title).toBe('Created a changelog entry');
    expect(mine[1].details).toBe(title);
    expect(JSON.stringify(mine)).not.toContain('Recorded by the admin-maintenance spec.');
  });

  test('/admin/repair-log redirects to Economy, which shows the Repairs block', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAuthed(page, '/admin/repair-log');
    await expect(page).toHaveURL(/\/admin\/economy$/);
    const repairs = page.getByRole('region', { name: 'Repairs' });
    await expect(repairs).toBeVisible();
    await expect(repairs.getByRole('table', { name: /discounts and what was paid/ }).getByRole('row', { name: /^Total/ })).toBeVisible();
    await expect(repairs.getByRole('table', { name: /Repairs of each stable type/ }).getByRole('row')).toHaveCount(4);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-economy-repairs-desktop.png`, fullPage: true });
  });

  test('/admin/audit-log redirects to Admin actions, under Security & Moderation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAuthed(page, '/admin/audit-log');
    await expect(page).toHaveURL(/\/admin\/actions$/);
    await expect(page.locator(ACTIONS)).toBeVisible();
    const sidebar = page.getByRole('complementary', { name: /admin sidebar navigation/i });
    await expect(sidebar.getByRole('link', { name: /Admin actions/ })).toHaveAttribute('aria-current', 'page');
    await expect(sidebar.getByText('Maintenance', { exact: true })).toHaveCount(0);

    const reloaded = page.waitForResponse((r) => r.url().includes('/api/admin/actions') && r.url().includes('area=changelog') && r.status() === 200);
    await page.getByRole('group', { name: 'Area' }).getByRole('button', { name: /^Changelog/ }).click();
    await reloaded;
    await expect(page).toHaveURL(/area=changelog/);
    const failures = page.waitForResponse((r) => r.url().includes('result=failure') && r.status() === 200);
    await page.getByRole('button', { name: /^Failures/ }).click();
    await failures;
    await expect(page).toHaveURL(/result=failure/);
    const allResults = page.waitForResponse((r) => r.url().includes('/api/admin/actions') && !r.url().includes('result=failure') && r.status() === 200);
    await page.getByRole('button', { name: /^All results/ }).click();
    await allResults;
    await expect(page).not.toHaveURL(/result=failure/);
    await expect(page.getByRole('button', { name: /^All results/ })).toHaveAttribute('aria-pressed', 'true');

    // The changelog test above leaves two changelog actions; run alone, the list can be empty.
    const list = page.getByRole('list', { name: 'Admin actions, newest first' });
    const first = list.getByRole('button').first();
    if (await list.count()) {
      await first.click();
      await expect(first).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByText('Recorded as').first()).toBeVisible();
    }
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-admin-actions-desktop.png`, fullPage: true });
  });

  for (const [path, selector, name] of [['/admin/economy', ECONOMY, 'economy'], ['/admin/actions', ACTIONS, 'admin-actions']] as const) {
    test(`${name} fits 390 px with touch-sized controls`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 900 });
      await gotoAuthed(page, path);
      await expect(page.locator(selector)).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalOverflow(page, selector);
      await expectTouchTargets(page, selector);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-${name}-mobile.png`, fullPage: true });
    });
  }
});
