import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import {
  LOCAL_ONLY_REASON,
  adminToken,
  createStrategyDraft,
  deleteStrategyDraft,
  ensureE2eAutomaton,
  expectNoHorizontalOverflow,
  expectTouchTargets,
  expectVisibleFocus,
  gotoAuthed,
  isLocalTarget,
  type E2eAutomaton,
} from './helpers/automaton';

/**
 * Admin Automatons page (Spec #55 task 10.6, R6.10, R11.9, R11.10, R14.5).
 *
 * Setup (as the seeded `admin`): create and activate a Draft_Automaton through
 * `/api/admin/automatons` and run one admin bulk cycle so it owns robots, plus
 * a Strategy_Draft for the Strategy_Builder (deleted afterwards).
 *
 * At 320, 768 and 1024 px: status bar, Stables with Needs attention,
 * Strategies (Strategy_Library and Strategy_Builder), Editor and Catalogue;
 * no horizontal overflow, touch targets ≥ 44 × 44 px, visible focus, logical
 * keyboard order, moving a Goal and an Event_Order event with the keyboard.
 *
 * One page load per width: below 1024 px every section is on the page, and at
 * 1024 px the tabs switch sections in place. This keeps the run inside the
 * admin rate limit (120 admin requests per minute per admin).
 */

const PAGE = '[data-testid="automatons-page"]';
const WIDTHS = [320, 768, 1024] as const;
type SectionLabel = 'Stables' | 'Strategies' | 'Editor' | 'Catalogue';

let api: APIRequestContext;
let token: string;
let automaton: E2eAutomaton;
let draftId: number | null = null;
let draftCreated = false;

async function checkLayout(page: Page): Promise<void> {
  await expectNoHorizontalOverflow(page, PAGE);
  await expectTouchTargets(page, PAGE);
}

/** Moves the first item of `list` down and back up with the keyboard only; returns nothing, asserts the order. */
async function moveFirstWithKeyboard(page: Page, list: Locator, nameOf: (item: Locator) => Locator, focusStaysOnRow: boolean): Promise<void> {
  const first = (await nameOf(list.getByRole('listitem').first()).textContent())?.trim() ?? '';
  expect(first).not.toBe('');
  const moveDown = list.getByRole('button', { name: `Move down: 1 ${first}`, exact: true });
  const moveUp = list.getByRole('button', { name: `Move up: 1 ${first}`, exact: true });
  for (const button of [moveDown, moveUp]) {
    const box = await button.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await expect(moveUp).toBeDisabled();

  await moveDown.focus();
  await page.keyboard.press('Enter');
  await expect(nameOf(list.getByRole('listitem').nth(1))).toHaveText(first);
  const movedUp = list.getByRole('button', { name: `Move up: 2 ${first}`, exact: true });
  if (focusStaysOnRow) {
    // Event_Order: focus follows the moved row; Shift+Tab reaches its Move up.
    await expect(list.getByRole('button', { name: `Move down: 2 ${first}`, exact: true })).toBeFocused();
    await expectVisibleFocus(page);
    await page.keyboard.press('Shift+Tab');
    await expect(movedUp).toBeFocused();
  } else {
    await movedUp.focus();
  }
  await page.keyboard.press('Space');
  await expect(nameOf(list.getByRole('listitem').first())).toHaveText(first);
}

test.describe('Admin Automatons page', () => {
  test.skip(!isLocalTarget(), LOCAL_ONLY_REASON);

  test.beforeAll(async ({ playwright }) => {
    test.setTimeout(600_000);
    api = await playwright.request.newContext();
    token = await adminToken(api);
    automaton = await ensureE2eAutomaton(api, token);
    const draft = await createStrategyDraft(api, token, 'duo.v1');
    draftId = draft.id;
    draftCreated = draft.created;
  });

  test.afterAll(async () => {
    if (draftId !== null && draftCreated) await deleteStrategyDraft(api, token, draftId);
    await api.dispose();
  });

  for (const width of WIDTHS) {
    test.describe(`${width} px`, () => {
      test.use({ viewport: { width, height: 900 } });

      test('status bar, Stables, Strategies, Editor and Catalogue', async ({ page }) => {
        test.setTimeout(120_000);
        const desktop = width >= 1024;
        const root = page.locator(PAGE);
        const section = (label: SectionLabel): Locator => (desktop ? root.getByRole('tabpanel') : root.getByRole('region', { name: label, exact: true }));
        const showTab = async (label: SectionLabel): Promise<void> => {
          if (desktop) await root.getByRole('tab', { name: label, exact: true }).click();
        };

        await gotoAuthed(page, `/admin/automatons?view=library&draft=${draftId}&stable=${automaton.key}`);
        await expect(root.getByRole('heading', { name: 'Automaton Stables', exact: true })).toBeVisible({ timeout: 15_000 });

        // ── Status bar (above every section) ──
        const statusBar = root.getByTestId('automaton-status-bar');
        await expect(statusBar.getByRole('switch', { name: 'Automatons act each cycle' })).toBeVisible();
        await expect(statusBar.getByText('Needs attention', { exact: true })).toBeVisible();

        // ── TabLayout: tabs at ≥ 1024 px, stacked sections below ──
        if (desktop) {
          const stablesTab = root.getByRole('tab', { name: 'Stables', exact: true });
          await expect(stablesTab).toHaveAttribute('aria-selected', 'true');
          await stablesTab.focus();
          await page.keyboard.press('ArrowRight');
          await expect(root.getByRole('tab', { name: 'Strategies', exact: true })).toBeFocused();
          await expectVisibleFocus(page);
          await page.keyboard.press('Home');
          await expect(stablesTab).toHaveAttribute('aria-selected', 'true');
        } else {
          for (const label of ['Stables', 'Strategies', 'Editor', 'Catalogue']) {
            await expect(root.getByRole('heading', { level: 2, name: label, exact: true })).toBeVisible();
          }
          await expect(root.getByRole('tablist')).toHaveCount(0);
        }

        // ── Stables with Needs attention ──
        const stables = section('Stables');
        // The table (≥ 768 px) and the cards (below) are both in the DOM; one of them is shown.
        await expect(stables.getByText(automaton.stableName).filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
        const chips = stables.getByRole('group', { name: 'Filter stables' });
        await chips.getByRole('button', { name: /^Needs attention · \d+$/ }).click();
        await expect(page).toHaveURL(/filter=attention/);
        await expect(chips.getByRole('button', { name: /^Needs attention/ })).toHaveAttribute('aria-pressed', 'true');
        await chips.getByRole('button', { name: /^All · \d+$/ }).click();
        await checkLayout(page);

        // ── Strategies: Strategy_Builder (open draft), Library, Comparison ──
        await showTab('Strategies');
        const strategies = section('Strategies');
        const buildOrder = strategies.getByRole('list', { name: 'Build order' });
        await expect(buildOrder).toBeVisible({ timeout: 15_000 });
        await moveFirstWithKeyboard(page, buildOrder, (item) => item.locator('span.font-medium').first(), false);
        await checkLayout(page);
        await strategies.getByRole('button', { name: '← Strategy library' }).click();
        await expect(strategies.getByRole('heading', { name: 'Strategy library' })).toBeVisible();
        await expect(strategies.getByRole('button', { name: 'New strategy' })).toBeVisible();
        await checkLayout(page);
        await strategies.getByRole('group', { name: 'Strategies view' }).getByRole('button', { name: 'Comparison', exact: true }).click();
        await expect(page).not.toHaveURL(/view=library/);
        await checkLayout(page);

        // ── Editor: Event_Order with the keyboard, focus and keyboard order ──
        await showTab('Editor');
        const editor = section('Editor');
        const eventOrder = editor.getByRole('list', { name: 'Event order' });
        await expect(eventOrder).toBeVisible({ timeout: 15_000 });
        await moveFirstWithKeyboard(page, eventOrder, (item) => item.locator('span.truncate'), true);

        // Logical keyboard order: no positive tabindex, and Tab from the stable
        // picker visits elements in DOM order.
        expect(await page.locator(`${PAGE} [tabindex]:not([tabindex="0"]):not([tabindex="-1"])`).count()).toBe(0);
        await editor.getByLabel('Editing', { exact: true }).focus();
        for (let stop = 0; stop < 15; stop++) {
          await page.evaluate((n) => document.activeElement?.setAttribute('data-e2e-tab', String(n)), stop);
          await page.keyboard.press('Tab');
          await expectVisibleFocus(page);
        }
        const stopsInDomOrder = await page.evaluate(() =>
          Array.from(document.querySelectorAll('[data-e2e-tab]')).map((el) => Number(el.getAttribute('data-e2e-tab'))),
        );
        expect(stopsInDomOrder.length).toBeGreaterThan(5);
        expect(stopsInDomOrder).toEqual([...stopsInDomOrder].sort((a, b) => a - b));
        await checkLayout(page);

        // ── Catalogue ──
        await showTab('Catalogue');
        const catalogue = section('Catalogue');
        await expect(catalogue.getByText(/Last sync:/)).toBeVisible();
        await expect(catalogue.getByRole('button', { name: 'Export all' })).toBeVisible();
        await checkLayout(page);
      });
    });
  }
});
