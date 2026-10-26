import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  LOCAL_ONLY_REASON,
  adminToken,
  ensureBattle,
  ensureE2eAutomaton,
  expectNoHorizontalOverflow,
  expectTouchTargets,
  gotoAuthed,
  isLocalTarget,
} from './helpers/automaton';

/**
 * Admin Battles (`/admin/battles`) against the real backend: find a real
 * battle by id, open the admin check, and use every slide-over button (Copy
 * for analysis, Download JSON, Open player report), on desktop and at 390 px.
 *
 * Runs in the `admin` project (local targets only: it may run bulk cycles).
 */
const PAGE = '[data-testid="battles-page"]';

test.describe('Admin Battles', () => {
  test.describe.configure({ mode: 'serial' });
  let battleId = 0;

  /** A real battle (bulk cycles until the e2e Automaton has fought; slow on a fresh database). */
  async function realBattle(request: APIRequestContext): Promise<number> {
    if (battleId === 0) {
      const token = await adminToken(request);
      const automaton = await ensureE2eAutomaton(request, token);
      battleId = await ensureBattle(request, token, automaton.robots.map((r) => r.id));
    }
    return battleId;
  }

  test.beforeEach(() => {
    test.skip(!isLocalTarget(), LOCAL_ONLY_REASON);
    test.setTimeout(900_000);
  });

  test('finds a battle, checks it and exports it', async ({ page, context, request }) => {
    await realBattle(request);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAuthed(page, `/admin/battles?q=%23${battleId}`);
    await expect(page.locator(PAGE)).toBeVisible();
    await expect(page.getByText(/^1 battle$/)).toBeVisible();

    await page.getByRole('button', { name: `Open the admin check of battle #${battleId}` }).click();
    const panel = page.getByRole('dialog', { name: `Battle #${battleId}` });
    await expect(panel.getByRole('heading', { name: 'Participants' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Payout check' })).toBeVisible();
    await expect(panel.getByText(/All payouts match the ledger|Payout differs|Ledger entry missing|No ledger entries found/)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`battle=${battleId}`));

    await panel.getByRole('button', { name: 'Copy for analysis' }).click();
    await expect(panel.getByText(/Copied the whole battle for analysis/)).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.startsWith(`# Battle #${battleId} · `)).toBe(true);
    expect(copied).toContain('## Results');
    expect(copied).toContain('## Payouts vs ledger');

    const downloadPromise = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Download JSON' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`battle-${battleId}.json`);

    await panel.getByRole('link', { name: /Open player report/ }).click();
    await expect(page).toHaveURL(new RegExp(`/battle/${battleId}$`));
  });

  test('works at 390 px: cards, filters and the slide-over stay in the viewport', async ({ page, request }) => {
    await realBattle(request);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAuthed(page, '/admin/battles?range=season');
    await expect(page.locator(PAGE)).toBeVisible();
    await expect(page.getByRole('list', { name: 'Battles, newest first' })).toBeVisible();
    await expectNoHorizontalOverflow(page, PAGE);
    await expectTouchTargets(page, PAGE);

    await gotoAuthed(page, `/admin/battles?q=%23${battleId}&battle=${battleId}`);
    const panel = page.getByRole('dialog', { name: `Battle #${battleId}` });
    await expect(panel.getByRole('heading', { name: 'Payout check' })).toBeVisible();
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    await expectTouchTargets(page, '[data-testid="battle-slide-over"]');
    // The panel fills the screen: wide tables scroll inside it instead of pushing it off-screen.
    const box = await panel.boundingBox();
    expect(box?.x).toBe(0);
    expect(box?.width).toBe(390);
    await expectNoHorizontalOverflow(page, '[data-testid="battle-slide-over"]');
  });
});
