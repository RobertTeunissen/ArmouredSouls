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
 * Admin System page (`/admin/system`) against the real backend: the overview
 * endpoint answers admins only, the page shows the status cards, this
 * backend's start and the database's tables, it is reachable from the
 * sidebar (labels only), and it fits a phone.
 *
 * Runs in the `admin` project (local targets only, like the other admin specs).
 */

const PAGE = '[data-testid="system-page"]';

test.describe('Admin System', () => {
  test.beforeEach(() => {
    test.skip(!isLocalTarget(), LOCAL_ONLY_REASON);
  });

  test('serves the overview to admins only', async ({ request }) => {
    const token = await adminToken(request);
    const ok = await request.get(`${API_URL}/api/admin/system/overview`, { headers: { Authorization: `Bearer ${token}` } });
    expect(ok.status()).toBe(200);
    const body = await ok.json() as { requests: { windowDays: number }; jobs: { windowDays: number }; database: { tables: unknown[] } | null };
    expect(body.requests.windowDays).toBe(7);
    expect(body.jobs.windowDays).toBe(8);
    expect(body.database?.tables.length ?? 0).toBeGreaterThan(0);

    const anonymous = await request.get(`${API_URL}/api/admin/system/overview`);
    expect(anonymous.status()).toBe(401);
  });

  test('shows the status, starts and tables, reached from the sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await gotoAuthed(page, '/admin/dashboard');

    const sidebar = page.getByRole('complementary', { name: /admin sidebar navigation/i });
    await sidebar.getByRole('link', { name: 'System', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/system$/);
    await expect(page.locator(PAGE)).toBeVisible();

    const cards = page.getByRole('region', { name: 'System status' });
    for (const label of ['Disk', 'Database', 'Memory', 'Last backup', 'Backend', 'Failing requests']) {
      await expect(cards.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('list', { name: 'Largest tables' }).getByRole('listitem').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Backend starts' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Scheduler jobs' })).toBeVisible();
  });

  test('stays within the viewport with touch-sized controls on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await gotoAuthed(page, '/admin/system');
    await expect(page.locator(PAGE)).toBeVisible();
    await expect(page.getByRole('region', { name: 'System status' })).toBeVisible();

    await expectNoHorizontalOverflow(page, PAGE);
    await expectTouchTargets(page, PAGE);
  });
});
