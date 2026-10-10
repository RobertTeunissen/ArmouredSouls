import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  LOCAL_ONLY_REASON,
  adminToken,
  ensureBattle,
  ensureE2eAutomaton,
  expectBadgesOnNameLine,
  expectNoHorizontalOverflow,
  gotoAuthed,
  isLocalTarget,
  robotLeague,
  type E2eAutomaton,
} from './helpers/automaton';

/**
 * Automaton_Badge on player pages (Spec #55 task 11.3, R12.1, R12.2, R14.5).
 *
 * Setup (as the seeded `admin`): create and activate a Draft_Automaton through
 * `/api/admin/automatons` and run one admin bulk cycle so the stable owns
 * robots. The battle report needs a fought battle, so up to three more bulk
 * cycles run until one of its robots has fought.
 *
 * At 320, 360, 768 and 1024 px the leaderboard, league standings, stable
 * profile, robot detail, battle report and season archive have no horizontal
 * overflow, the badge stays on the stable name's line, and rows, tables and
 * banners use the gear-only compact form below 640 px.
 */

const WIDTHS = [320, 360, 768, 1024] as const;

interface Surface {
  name: string;
  path: () => string;
  /** Text that shows the page has loaded its data. */
  ready: () => RegExp | string;
  /** Whether the e2e Automaton must appear (the season archive only has data after a rollover). */
  expectsBadge: boolean;
  /**
   * Where overflow is measured. Default: the whole page (minus the player
   * navigation) plus the page-scroll check. The battle report measures its
   * badge surfaces and checks page scroll from 360 px: below that, the battle
   * playback arena keeps its deliberate 300 px minimum (`ArenaCanvas`, outside
   * Spec #55) and the page scrolls by a few pixels at 320 px.
   */
  overflow?: (width: number) => { root: string; pageScroll: boolean };
}

let api: APIRequestContext;
let automaton: E2eAutomaton;
let battleId: number;
let league: { tier: string; instance: string };

const SURFACES: Surface[] = [
  { name: 'prestige leaderboard', path: () => '/leaderboards/prestige', ready: () => automaton.stableName, expectsBadge: true },
  { name: 'league standings', path: () => `/league-standings?tier=${league.tier}&instance=${league.instance}`, ready: () => automaton.stableName, expectsBadge: true },
  { name: 'stable profile', path: () => `/stables/${automaton.userId}`, ready: () => automaton.stableName, expectsBadge: true },
  { name: 'robot detail', path: () => `/robots/${automaton.robots[0].id}`, ready: () => automaton.stableName, expectsBadge: true },
  {
    name: 'battle report',
    path: () => `/battle/${battleId}`,
    ready: () => automaton.stableName,
    expectsBadge: true,
    overflow: (width) => ({ root: '[data-testid="battle-result-banner"], [data-testid="team-battle-metrics"]', pageScroll: width >= 360 }),
  },
  { name: 'season archive', path: () => '/seasons', ready: () => /Season Archive/i, expectsBadge: false },
];

test.describe('Automaton badge on player pages', () => {
  test.skip(!isLocalTarget(), LOCAL_ONLY_REASON);

  test.beforeAll(async ({ playwright }) => {
    test.setTimeout(900_000);
    api = await playwright.request.newContext();
    const token = await adminToken(api);
    automaton = await ensureE2eAutomaton(api, token);
    battleId = await ensureBattle(api, token, automaton.robots.map((r) => r.id));
    league = await robotLeague(api, token, automaton.robots[0].id);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  for (const width of WIDTHS) {
    test.describe(`${width} px`, () => {
      test.use({ viewport: { width, height: 900 } });

      for (const surface of SURFACES) {
        test(surface.name, async ({ page }) => {
          await gotoAuthed(page, surface.path());
          const ready = page.getByText(surface.ready()).filter({ visible: true }).first();
          if (surface.name === 'league standings') {
            // New robots start at 0 LP, so the stable may be on a later standings page.
            await expect(page.getByRole('button', { name: 'Next' }).filter({ visible: true }).first().or(ready)).toBeVisible({ timeout: 20_000 });
            for (let next = 0; next < 5 && !(await ready.isVisible()); next++) {
              await page.getByRole('button', { name: 'Next' }).filter({ visible: true }).first().click();
              await page.waitForLoadState('networkidle');
            }
          }
          await expect(ready).toBeVisible({ timeout: 20_000 });
          // Let late requests (achievements, standings pages) settle before measuring.
          await page.waitForLoadState('networkidle');

          const badges = await expectBadgesOnNameLine(page, width);
          if (surface.expectsBadge) expect(badges, `no Automaton badge on the ${surface.name}`).toBeGreaterThan(0);
          // The player navigation is not a badge surface; the page-scroll check still covers it.
          const scope = surface.overflow?.(width) ?? { root: 'body', pageScroll: true };
          await expectNoHorizontalOverflow(page, scope.root, { exclude: 'nav', pageScroll: scope.pageScroll });

          // The badge is a label, not a control: no tooltip and nothing to tab to.
          const badge = page.getByTestId('automaton-badge').first();
          if (badges > 0) {
            await expect(badge).not.toHaveAttribute('title');
            await expect(badge.getByTestId('automaton-badge-icon')).toHaveAttribute('aria-hidden', 'true');
            await expect(badge.getByTestId('automaton-badge-label')).toHaveText('Automaton');
          }
        });
      }
    });
  }
});
