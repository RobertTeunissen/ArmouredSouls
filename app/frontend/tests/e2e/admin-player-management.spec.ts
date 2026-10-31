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
 * Admin Players (`/admin/players`) and Economy (`/admin/economy`) against the
 * real backend: the new endpoints answer and the removed ones are gone, the
 * segment cards filter the list, the stable search opens the detail panel,
 * the Economy toggles reload, and both pages fit 390 px with touch-sized
 * controls. Set `E2E_SCREENSHOT_DIR` to also save full-page screenshots.
 *
 * Runs in the `admin` project (local targets only, like the other admin specs).
 */
const PLAYERS = '[data-testid="players-page"]';
const ECONOMY = '[data-testid="economy-overview-page"]';
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

test.describe('Admin Player Management', () => {
  test.beforeEach(() => {
    test.skip(!isLocalTarget(), LOCAL_ONLY_REASON);
  });

  test('serves the new endpoints and removes the old ones', async ({ request }) => {
    const headers = { Authorization: `Bearer ${await adminToken(request)}` };
    const players = await request.get(`${API_URL}/api/admin/players`, { headers });
    expect(players.status()).toBe(200);
    const body = (await players.json()) as { counts: { all: number; active: number; inactive: number; dormant: number }; players: unknown[] };
    expect(body.counts.active + body.counts.inactive + body.counts.dormant).toBe(body.counts.all);
    expect(body.players).toHaveLength(body.counts.all);
    expect((await request.get(`${API_URL}/api/admin/economy?stables=all&window=season`, { headers })).status()).toBe(200);
    for (const path of ['/api/admin/economy/overview', '/api/admin/engagement/players']) {
      expect((await request.get(`${API_URL}${path}`, { headers })).status(), path).toBe(404);
    }
    // /users/recent and /users/at-risk now fall through to /users/:id, which rejects a non-numeric id.
    for (const path of ['/api/admin/users/recent', '/api/admin/users/at-risk']) {
      expect((await request.get(`${API_URL}${path}`, { headers })).status(), path).toBe(400);
    }
  });

  test('Players: segment cards filter, the search opens the detail panel', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAuthed(page, '/admin/players');
    await expect(page.locator(PLAYERS)).toBeVisible();
    const active = page.getByRole('button', { name: /^Active/ });
    await expect(active).toBeVisible();
    await active.click();
    await expect(active).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/segment=active/);
    await active.click();
    await expect(page).not.toHaveURL(/segment=/);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-players-desktop.png`, fullPage: true });

    await page.getByRole('searchbox', { name: 'Find any stable' }).fill('admin');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const result = page.getByRole('list', { name: 'Search results' }).getByRole('button').first();
    await expect(result).toBeVisible();
    await result.click();
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Balance, last 10 cycles')).toBeVisible();
    // After the slide-in the whole panel is on screen.
    await expect(panel).toBeInViewport({ ratio: 0.99 });
    await page.waitForTimeout(400);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-players-panel.png`, fullPage: true });
    await panel.getByRole('button', { name: 'Close panel' }).click();
    await expect(panel).toBeHidden();
  });

  test('Economy: toggles reload the flows and stay in the URL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAuthed(page, '/admin/economy');
    await expect(page.locator(ECONOMY)).toBeVisible();
    await expect(page.getByText(/^Scope: human stables/)).toBeVisible();
    const reloaded = page.waitForResponse((r) => r.url().includes('/api/admin/economy?') && r.url().includes('stables=all') && r.status() === 200);
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await reloaded;
    await expect(page).toHaveURL(/stables=all/);
    await expect(page.getByText(/^Scope: all stables/)).toBeVisible();
    await page.getByRole('button', { name: 'Season', exact: true }).click();
    await expect(page).toHaveURL(/window=season/);
    await expect(page.getByRole('region', { name: 'Where credits come from' })).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-economy-desktop.png`, fullPage: true });
  });

  for (const [path, selector, name] of [['/admin/players', PLAYERS, 'players'], ['/admin/economy', ECONOMY, 'economy']] as const) {
    test(`${name} fits 390 px with touch-sized controls`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 900 });
      await gotoAuthed(page, path);
      await expect(page.locator(selector)).toBeVisible();
      await expect(page.locator(`${selector} h2`).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalOverflow(page, selector);
      await expectTouchTargets(page, selector);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-${name}-mobile.png`, fullPage: true });
    });
  }
});
