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
 * Admin League Health (`/admin/league-health`) against the real backend: the
 * overview endpoint serves all six tiered modes, the page shows the same
 * numbers, and every control works (grid cell, mode tab, tier toggle, instance
 * standings link, Refresh). The seed's WimpBots are subscribed to League 1v1,
 * KotH and Grand Melee, so those Bronze tiers have rows.
 *
 * Runs in the `admin` project (local targets only, like the other admin specs).
 */

const PAGE = '[data-testid="league-health-page"]';

interface OverviewTier { tier: string; total: number; active: number; instances: { id: string }[] }
interface Overview { modes: { mode: string; tiers: OverviewTier[] }[] }

test.describe('Admin League Health', () => {
  test.beforeEach(() => {
    test.skip(!isLocalTarget(), LOCAL_ONLY_REASON);
  });

  test('shows every tiered league and each control works', async ({ page, request }) => {
    const token = await adminToken(request);
    const response = await request.get(`${API_URL}/api/admin/league-health`, { headers: { Authorization: `Bearer ${token}` } });
    expect(response.status()).toBe(200);
    const overview = (await response.json()) as Overview;
    expect(overview.modes.map((mode) => mode.mode)).toEqual(['league_1v1', 'league_2v2', 'league_3v3', 'tag_team', 'koth', 'grand_melee']);
    for (const mode of overview.modes) expect(mode.tiers).toHaveLength(6);
    const bronze = overview.modes[0].tiers[0];
    expect(bronze.total).toBeGreaterThan(0);

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAuthed(page, '/admin/league-health');
    await expect(page.locator(PAGE)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();

    // Grid cell: the count matches the API, and the cell opens the tier.
    const cell = page.getByRole('button', { name: new RegExp(`^1v1 League Bronze: ${bronze.active.toLocaleString('en-US')}`) });
    await expect(cell).toBeVisible();
    await cell.click();
    await expect(page).toHaveURL(/\/admin\/league-health\?tier=bronze$/);
    const table = page.getByTestId('league-health-tier-table');
    const instances = table.getByTestId('league-health-instances-bronze');
    await expect(instances).toBeVisible();

    // Tier toggle collapses and expands.
    const toggle = table.getByRole('button', { name: /^Bronze.*hide instances$/ });
    await toggle.click();
    await expect(page).toHaveURL(/\/admin\/league-health$/);
    await expect(table.getByTestId('league-health-instances-bronze')).toHaveCount(0);
    await table.getByRole('button', { name: /^Bronze.*show instances$/ }).click();
    await expect(instances).toBeVisible();

    // Mode tab.
    await page.getByRole('button', { name: 'King of the Hill', exact: true }).click();
    await expect(page).toHaveURL(/\?mode=koth$/);
    await expect(table.getByRole('columnheader', { name: 'Avg ELO', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '1v1 League', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/league-health$/);

    // Refresh requests the overview again.
    const refreshed = page.waitForResponse((r) => r.url().includes('/api/admin/league-health') && r.status() === 200);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await refreshed;
    await expect(page.getByText(/^Last updated \d\d:\d\d:\d\d UTC$/)).toBeVisible();

    // Instance link opens the player standings of that instance.
    await cell.click();
    const firstInstance = bronze.instances[0].id;
    await table.getByTestId('league-health-instances-bronze').getByRole('link', { name: `Standings of ${firstInstance}` }).first().click();
    await expect(page).toHaveURL(new RegExp(`/league-standings\\?mode=1v1&tier=bronze&instance=${firstInstance}$`));
  });

  test('stays within the viewport with touch-sized controls on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await gotoAuthed(page, '/admin/league-health?tier=bronze');
    await expect(page.locator(PAGE)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Tag Team\./ })).toBeVisible();
    await expect(page.getByTestId('league-health-card-bronze').getByTestId('league-health-instances-bronze')).toBeVisible();
    await expectNoHorizontalOverflow(page, PAGE);
    await expectTouchTargets(page, PAGE);
  });
});
