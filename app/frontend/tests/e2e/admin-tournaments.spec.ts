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
 * Admin Tournaments (`/admin/tournaments`) against the real backend: the
 * overview endpoint serves the three types, the removed management endpoints
 * are gone, the page shows a "Now" card and a season panel per type, and
 * Refresh reloads. A freshly seeded database may have no tournament yet, so a
 * card shows either a running tournament or "No … tournament running".
 *
 * Runs in the `admin` project (local targets only, like the other admin specs).
 */

const PAGE = '[data-testid="admin-tournaments-page"]';
const TYPES = ['robot', 'team_2v2', 'team_3v3'] as const;

test.describe('Admin Tournaments', () => {
  test.beforeEach(() => {
    test.skip(!isLocalTarget(), LOCAL_ONLY_REASON);
  });

  test('serves the overview and shows every type', async ({ page, request }) => {
    const token = await adminToken(request);
    const headers = { Authorization: `Bearer ${token}` };
    const response = await request.get(`${API_URL}/api/admin/tournaments/overview`, { headers });
    expect(response.status()).toBe(200);
    const overview = (await response.json()) as { types: { type: string; current: { name: string } | null }[] };
    expect(overview.types.map((t) => t.type)).toEqual([...TYPES]);
    for (const path of ['/api/admin/tournaments', '/api/admin/tournaments/history', '/api/admin/tournaments/eligible-robots']) {
      expect((await request.get(`${API_URL}${path}`, { headers })).status()).toBe(404);
    }
    expect((await request.post(`${API_URL}/api/admin/tournaments/create`, { headers, data: {} })).status()).toBe(404);

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAuthed(page, '/admin/tournaments');
    await expect(page.locator(PAGE)).toBeVisible();
    for (const entry of overview.types) {
      const card = page.getByTestId(`tournament-now-${entry.type}`);
      await expect(card).toBeVisible();
      if (entry.current) await expect(card).toContainText(entry.current.name);
      else await expect(card).toContainText('tournament running');
      await expect(page.getByTestId(`tournament-season-${entry.type}`)).toBeVisible();
    }

    const refreshed = page.waitForResponse((r) => r.url().includes('/api/admin/tournaments/overview') && r.status() === 200);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await refreshed;
    await expect(page.getByText(/^Last updated \d\d:\d\d:\d\d UTC$/)).toBeVisible();
  });

  test('stays within the viewport with touch-sized controls on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await gotoAuthed(page, '/admin/tournaments');
    await expect(page.locator(PAGE)).toBeVisible();
    await expect(page.getByTestId('tournament-now-robot')).toBeVisible();
    await expectNoHorizontalOverflow(page, PAGE);
    await expectTouchTargets(page, PAGE);
  });
});
