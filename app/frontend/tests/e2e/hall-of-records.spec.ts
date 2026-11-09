import { test, expect, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTouchTargets, gotoAuthed } from './helpers/automaton';
import { mockRecords, signedInStable } from './helpers/hallOfRecords';

/**
 * Hall of Records (PRD_HALL_OF_RECORDS v2.0).
 *
 * The first block runs against the real backend and the seeded database, so
 * it holds whatever records the seed produces (possibly none). The rest answer
 * `/api/records` with an ACC-like fixture, so layout and navigation are checked
 * with every record, long names, an Automaton and a generated stable present.
 */

const ROOT = '[data-testid="hall-of-records"]';

async function openBoard(page: Page, path = '/hall-of-records'): Promise<void> {
  await gotoAuthed(page, path);
  await expect(page.getByRole('heading', { name: 'Hall of Records', level: 1 })).toBeVisible({ timeout: 15000 });
}

test.describe('Hall of Records — real backend', () => {
  test('loads the records and shows the board or the empty state', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const records = page.waitForResponse((response) => response.url().endsWith('/api/records'));

    await openBoard(page);

    const response = await records;
    expect(response.status()).toBe(200);
    const board = page.getByTestId('record-group-robots');
    const empty = page.getByTestId('records-empty');
    await expect(board.or(empty).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: /Past seasons: Season Archive/ })).toHaveAttribute('href', '/seasons');
    expect(errors).toEqual([]);
  });

  test('is reachable from the Social menu', async ({ page }) => {
    await gotoAuthed(page, '/dashboard');
    await page.getByRole('button', { name: /^Social/ }).hover();
    await page.getByRole('link', { name: 'Hall of Records' }).click();
    await expect(page).toHaveURL(/\/hall-of-records$/);
    await expect(page.getByRole('heading', { name: 'Hall of Records', level: 1 })).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Hall of Records — board (fixture)', () => {
  test.beforeEach(async ({ page, request }) => {
    await gotoAuthed(page, '/dashboard');
    await mockRecords(page, await signedInStable(page, request));
  });

  test('shows every group, the viewer\'s places, and badges for Automaton and bot stables', async ({ page }) => {
    await openBoard(page);

    for (const group of ['robots', 'battles', 'streaks', 'koth-melee', 'stables']) {
      await expect(page.getByTestId(`record-group-${group}`)).toBeVisible();
    }
    const strip = page.getByTestId('your-places');
    await expect(strip).toContainText('1 record held');
    await expect(strip).toContainText('Longest league win streak (1v1 League) · GoreAap · 33');
    await expect(page.getByTestId('record-tile-mostBattles').getByTestId('record-my-place')).toHaveText('You: #2 · GekkeAap');

    await expect(page.getByTestId('record-tile-biggestTeamUpset').getByTestId('automaton-badge')).toBeVisible();
    await expect(page.getByTestId('record-tile-kothZoneTime').getByTestId('record-bot-stable')).toContainText('bot');
    await expect(page.getByTestId('record-tile-tournamentChampions').getByRole('link', { name: /Last 10 per type/ })).toBeVisible();
  });

  // Runs on the fixture: the seeded database has no battles, so the real board
  // holds no record with a top 10 and this check would always be skipped.
  test('opens a record\'s top 10 from the board and comes back', async ({ page }) => {
    await openBoard(page);
    const topTen = page.getByRole('link', { name: /: Top 10( per mode)?$/ }).first();
    await expect(topTen).toBeVisible();

    await topTen.click();
    await expect(page).toHaveURL(/record=/);
    await expect(page.getByTestId('record-detail')).toBeVisible();
    await expect(page.getByTestId('record-detail-row').first()).toBeVisible();

    await page.getByRole('link', { name: '← All records' }).click();
    await expect(page).toHaveURL(/\/hall-of-records$/);
    await expect(page.getByTestId('record-detail')).toHaveCount(0);
  });

  test('filters by group and by the viewer\'s places through the URL', async ({ page }) => {
    await openBoard(page);

    await page.getByRole('button', { name: 'Streaks', exact: true }).click();
    await expect(page).toHaveURL(/group=streaks/);
    await expect(page.getByTestId('record-group-streaks')).toBeVisible();
    await expect(page.getByTestId('record-group-robots')).toHaveCount(0);

    await page.getByRole('button', { name: 'All records' }).click();
    await page.getByRole('button', { name: 'Show only my places' }).click();
    await expect(page).toHaveURL(/mine=1/);
    await expect(page.getByTestId('record-tile-mostBattles')).toBeVisible();
    await expect(page.getByTestId('record-tile-highestElo')).toHaveCount(0);
  });

  test('deep-links a record mode, switches mode and goes back to the group', async ({ page }) => {
    await openBoard(page, '/hall-of-records?group=battles&record=mostDamageInBattle&mode=grand_melee');

    const detail = page.getByTestId('record-detail');
    await expect(detail.getByRole('heading', { name: 'Most damage in one battle' })).toBeVisible();
    await expect(detail.getByTestId('record-detail-row').first()).toContainText('Feigenbaum');

    await detail.getByRole('link', { name: '1v1 League', exact: true }).click();
    await expect(page).toHaveURL(/mode=league_1v1/);
    await expect(detail.getByTestId('record-detail-row').first()).toContainText('Bolt');

    await page.getByRole('link', { name: '← All records' }).click();
    await expect(page).toHaveURL(/\/hall-of-records\?group=battles$/);
  });

  test('highlights the viewer\'s row in a top 10', async ({ page }) => {
    await openBoard(page, '/hall-of-records?record=mostBattles');
    const mine = page.locator('[data-testid="record-detail-row"][data-mine="true"]');
    await expect(mine).toHaveCount(1);
    await expect(mine).toContainText('GekkeAap');
    await expect(mine).toContainText('You');
  });

  test('sends leaderboard-backed records to the Destructions Leaderboard', async ({ page }) => {
    await openBoard(page);
    await page.getByTestId('record-tile-mostKills').getByRole('link', { name: /Full leaderboard/ }).click();
    await expect(page).toHaveURL(/\/leaderboards\/losses$/);
    await expect(page.getByRole('heading', { name: 'Destructions Leaderboard' })).toBeVisible({ timeout: 15000 });
  });

  test('robot and stable names link to their pages', async ({ page }) => {
    await openBoard(page);
    const tile = page.getByTestId('record-tile-highestElo');
    await expect(tile.getByRole('link', { name: 'HitHard' })).toHaveAttribute('href', '/robots/12');
    await expect(tile.getByRole('link', { name: 'Hit Machine' })).toHaveAttribute('href', '/stables/900001');
  });
});

for (const width of [320, 390]) {
  test.describe(`Hall of Records — phone ${width} px (fixture)`, () => {
    test.use({ viewport: { width, height: 800 } });

    test.beforeEach(async ({ page, request }) => {
      await gotoAuthed(page, '/dashboard');
      await mockRecords(page, await signedInStable(page, request));
    });

    test('fits the screen, collapses groups and keeps touch targets', async ({ page }) => {
      await openBoard(page);
      await expect(page.getByTestId('record-group-robots')).toBeVisible();

      await expectNoHorizontalOverflow(page, ROOT);
      await expectTouchTargets(page, ROOT);

      // Two tiles per group until "Show all".
      await expect(page.getByTestId('record-tile-highestElo')).toBeHidden();
      const toggle = page.getByTestId('record-group-toggle-robots');
      await expect(toggle).toHaveText('Show all 6 records');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByTestId('record-tile-highestElo')).toBeVisible();

      // The group tabs scroll sideways with a fade on the side that has more.
      await expect(page.getByRole('group', { name: 'Record groups' }).locator('..').getByTestId('scroll-fade-end')).toBeVisible();
    });

    test('shows the top 10 right below one row of chips', async ({ page }) => {
      await openBoard(page, '/hall-of-records?record=meleeKills');
      const detail = page.getByTestId('record-detail');
      await expect(detail.getByTestId('record-detail-row').first()).toBeVisible();

      // The selected record chip is scrolled into view.
      await expect(detail.getByRole('link', { name: 'Grand Melee destructions' })).toBeInViewport();
      await expectNoHorizontalOverflow(page, ROOT);
      await expectTouchTargets(page, ROOT);
    });
  });
}

test.describe('Season Archive records (fixture)', () => {
  test('show the completed season\'s records as Hall of Records tiles and open a top 10', async ({ page, request }) => {
    await gotoAuthed(page, '/dashboard');
    const viewer = await signedInStable(page, request);
    const season = { seasonNumber: 3, isLegacy: false, competitiveCycles: 100, startedAt: '2026-08-01T00:00:00Z', endedAt: '2026-11-10T00:00:00Z', humanStableCount: 90, generatedStableCount: 200 };
    const accolade = (category: string, rank: number, subjectName: string, stableName: string, value: number, extra: object = {}) => ({
      category, rank, subjectName, stableName, value, valueLabel: 'x', mode: null, isGeneratedSubject: false, subjectStableType: 'human', ...extra,
    });
    await page.route('**/api/seasons', (route) => route.fulfill({ json: [season] }));
    await page.route('**/api/seasons/3', (route) => route.fulfill({
      json: {
        ...season,
        standingsByMode: {},
        accolades: [
          accolade('mostKills', 1, 'HitHard', 'Hit Machine', 756),
          accolade('mostKills', 2, 'StommeAap', viewer.username, 536),
          accolade('mostDamageInBattle', 1, 'Bolt', 'LortGob Industries', 2736, { mode: 'league_1v1' }),
          accolade('mostDamageInBattle', 1, 'Feigenbaum', 'Fractals', 4102, { mode: 'grand_melee' }),
          accolade('richestStable', 1, 'Sexy Stables', 'Sexy Stables', 103999060),
        ],
      },
    }));

    await gotoAuthed(page, '/seasons?season=3');
    const records = page.getByTestId('season-archive-records');
    await expect(records).toBeVisible({ timeout: 15000 });
    const kills = records.getByTestId('record-tile-mostKills');
    await expect(kills).toContainText('Most destructions');
    await expect(kills.getByTestId('record-my-place')).toHaveText('You: #2 · StommeAap');
    await expect(records.getByTestId('record-tile-mostDamageInBattle').getByRole('listitem')).toHaveCount(2);

    await kills.getByRole('link', { name: /Most destructions: Top 10/ }).click();
    await expect(page).toHaveURL(/season=3&record=mostKills/);
    await expect(page.locator('[data-testid="record-detail-row"][data-mine="true"]')).toContainText('StommeAap');

    await page.getByRole('link', { name: '← All records' }).click();
    await expect(page).toHaveURL(/\/seasons\?season=3$/);
    await expect(records.getByTestId('record-tile-richestStable')).toBeVisible();
    await expectNoHorizontalOverflow(page, 'body');
  });
});
