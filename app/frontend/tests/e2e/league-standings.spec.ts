import { test, expect, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTouchTargets, gotoAuthed } from './helpers/automaton';
import { signedInStable } from './helpers/hallOfRecords';
import { mockLeagueStandings } from './helpers/leagueStandings';

/**
 * League Standings (PRD_LEAGUE_STANDINGS v2.0).
 *
 * The first block runs against the real backend and the seeded database: the
 * page opens on the signed-in player's best instance and every league loads.
 * The rest answer the league endpoints with an ACC-like fixture (67-robot
 * Diamond 1), so zone bands, status chips, own rows and phone layout are
 * checked with long names, a bot stable and an Automaton present.
 */

const ROOT = '[data-testid="league-standings"]';

async function openStandings(page: Page, path = '/league-standings'): Promise<void> {
  await gotoAuthed(page, path);
  await expect(page.getByRole('heading', { name: 'League Standings', level: 1 })).toBeVisible({ timeout: 15000 });
}

test.describe('League Standings — real backend', () => {
  test('opens on the player\'s league and lists it', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const mine = page.waitForResponse((response) => response.url().endsWith('/api/leagues/my-standings'));

    await openStandings(page);

    expect((await mine).status()).toBe(200);
    await expect(page).toHaveURL(/tier=[a-z]+/, { timeout: 15000 });
    const table = page.getByTestId('standings-table');
    const empty = page.getByTestId('standings-empty');
    await expect(table.or(empty).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('league-cards')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('loads every league from its card', async ({ page }) => {
    // Which standings request belongs to which league card.
    const isStandingsOf = (mode: string) => (url: URL): boolean => {
      if (mode === '2v2' || mode === '3v3') return new RegExp(`/api/team-battles/leagues/${mode[0]}/[a-z]+/standings$`).test(url.pathname);
      if (mode === 'tag_team') return url.pathname.endsWith('/tag-team-standings');
      const apiMode = mode === '1v1' ? 'league_1v1' : mode;
      return /^\/api\/leagues\/[a-z]+\/standings$/.test(url.pathname) && url.searchParams.get('mode') === apiMode;
    };

    await openStandings(page, '/league-standings?tier=bronze');
    for (const mode of ['2v2', '3v3', 'tag_team', 'koth', 'grand_melee', '1v1']) {
      const response = page.waitForResponse((res) => isStandingsOf(mode)(new URL(res.url())));
      await page.getByTestId(`league-card-${mode}`).click();
      expect((await response).status(), `${mode} standings`).toBe(200);
      // The opening view replaces the card's `?mode=` link with that league's tier (1v1 drops `mode`).
      await expect(page).toHaveURL(mode === '1v1' ? /\/league-standings\?tier=[a-z]+/ : new RegExp(`mode=${mode}&tier=[a-z]+`));
      // Loaded, not the previous league's rows still on screen.
      await expect(page.locator('section[aria-labelledby="standings-heading"][aria-busy="false"]')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('standings-table').or(page.getByTestId('standings-empty')).first()).toBeVisible();
      // Only the page's own error: other alerts (achievement toasts from earlier specs) may be on screen.
      await expect(page.getByText('Failed to load the standings.')).toHaveCount(0);
    }
  });

  test('is reachable from the Battle menu', async ({ page }) => {
    await gotoAuthed(page, '/dashboard');
    await page.getByRole('button', { name: /^Battle/ }).hover();
    await page.getByRole('link', { name: 'League Standings' }).click();
    await expect(page).toHaveURL(/\/league-standings/);
    await expect(page.getByRole('heading', { name: 'League Standings', level: 1 })).toBeVisible({ timeout: 15000 });
  });
});

test.describe('League Standings — instance (fixture)', () => {
  test.beforeEach(async ({ page, request }) => {
    await gotoAuthed(page, '/dashboard');
    await mockLeagueStandings(page, await signedInStable(page, request));
  });

  test('opens on the viewer\'s best instance with zone bands and status chips', async ({ page }) => {
    await openStandings(page);
    await expect(page).toHaveURL(/\/league-standings\?tier=diamond&instance=diamond_1$/);
    await expect(page.getByRole('heading', { name: 'Diamond 1', level: 2 })).toBeVisible();
    await expect(page.getByTestId('zone-summary')).toContainText('67 robots · top 6 go up to Champion, bottom 6 down to Platinum');

    const table = page.getByTestId('standings-table');
    await expect(table.getByTestId('zone-band-up')).toHaveText(/Promotion places · top 6/i);
    await expect(table.getByTestId('zone-band-down')).toHaveText(/Demotion places · bottom 6/i);
    await expect(table.getByTestId('standings-row')).toHaveCount(67);
    await expect(table.getByTestId('standings-row').first().getByTestId('standing-status').filter({ visible: true })).toHaveText(/Needs 125 LP/);

    const mine = table.locator('[data-testid="standings-row"][data-mine="true"]');
    await expect(mine).toHaveCount(3);
    await expect(mine.first().getByRole('link', { name: 'StommeAap' })).toHaveAttribute('href', '/robots/5003/prepare');
    await expect(mine.nth(1)).toContainText('New in Diamond · 0 of 5 cycles');
    await expect(table.getByTestId('record-bot-stable').first()).toContainText('bot');
    await expect(table.getByTestId('automaton-badge').first()).toBeVisible();
  });

  test('shows the viewer\'s leagues and moves between leagues, tiers and instances', async ({ page }) => {
    await openStandings(page, '/league-standings?tier=diamond&instance=diamond_1');
    await expect(page.getByTestId('league-card-1v1')).toContainText('3 robots in 1 tier');
    await expect(page.getByTestId('league-card-1v1')).toContainText('1 held below the LP minimum');
    await expect(page.getByTestId('league-card-koth')).toContainText('1 in a promotion place');
    await expect(page.getByTestId('tier-chip-diamond')).toContainText('3');

    await page.getByTestId('instance-chip-all').click();
    await expect(page).toHaveURL(/\/league-standings\?tier=diamond$/);
    await expect(page.getByRole('heading', { name: 'All of Diamond' })).toBeVisible();
    await expect(page.getByTestId('zone-band-up')).toHaveCount(0);
    await page.getByTestId('standings-pager').getByRole('link', { name: 'Next' }).click();
    await expect(page).toHaveURL(/tier=diamond&page=2/);
    await expect(page.getByTestId('standings-row').first()).toContainText('51');

    await page.getByTestId('league-card-koth').click();
    await expect(page).toHaveURL(/mode=koth&tier=platinum&instance=platinum_4/);
    await expect(page.getByRole('columnheader', { name: 'Wins / matches' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'ELO' })).toHaveCount(0);
  });
});

for (const width of [320, 390]) {
  test.describe(`League Standings — phone ${width} px (fixture)`, () => {
    test.use({ viewport: { width, height: 800 } });

    test.beforeEach(async ({ page, request }) => {
      await gotoAuthed(page, '/dashboard');
      await mockLeagueStandings(page, await signedInStable(page, request));
    });

    test('fits the screen, keeps touch targets and scrolls the chip rows', async ({ page }) => {
      await openStandings(page, '/league-standings?tier=diamond&instance=diamond_1');
      await expect(page.getByTestId('standings-row').first()).toBeVisible();

      await expectNoHorizontalOverflow(page, ROOT);
      await expectTouchTargets(page, ROOT);

      // Phones: record under the name, ELO and the status column hidden, chip under the name.
      await expect(page.getByRole('columnheader', { name: 'ELO' })).toBeHidden();
      const first = page.getByTestId('standings-row').first();
      await expect(first.getByTestId('standing-status').filter({ visible: true })).toHaveCount(1);
      // The selected tier chip is scrolled into view; the league cards fade where there are more.
      await expect(page.getByTestId('tier-chip-diamond')).toBeInViewport();
      await expect(page.getByRole('navigation', { name: 'Leagues' }).locator('..').getByTestId('scroll-fade-end')).toBeVisible();
    });
  });
}
