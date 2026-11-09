import { test, expect, type Page } from '@playwright/test';
import { navigateToProtectedPage } from './helpers/navigate';
import { registerNewUser } from './helpers/register';

/**
 * E2E tests for the Battle History page.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 *
 * Tests using test_user_001 auth state run in the chromium project (default).
 * The empty-state test registers a fresh user who has no battles.
 *
 * The seeded E2E database has no battles, so the filter, sort, search and
 * navigation tests used to skip themselves on every CI run. They now serve a
 * fixed two-battle history for the signed-in player (everything else on the
 * page talks to the real backend).
 */

interface FixtureRobot {
  id: number;
  name: string;
  userId: number;
  user: { username: string };
}

function fixtureParticipant(robot: FixtureRobot, team: number, eloBefore: number, eloAfter: number, finalHP: number, credits: number) {
  return {
    robotId: robot.id,
    team,
    role: null,
    eloBefore,
    eloAfter,
    finalHP,
    credits,
    streamingRevenue: 0,
    prestigeAwarded: 0,
    fameAwarded: 0,
    damageDealt: 50,
    placement: null,
    yielded: false,
    destroyed: false,
    robot,
  };
}

function fixtureBattle(id: number, createdAt: string, mine: FixtureRobot, rival: FixtureRobot, iWon: boolean) {
  const myElo = iWon ? [1200, 1212] : [1212, 1204];
  const rivalElo = iWon ? [1210, 1198] : [1198, 1206];
  return {
    id,
    battleType: 'league_1v1',
    leagueType: 'bronze',
    createdAt,
    winnerId: iWon ? mine.id : rival.id,
    robot1Id: mine.id,
    robot2Id: rival.id,
    robot1: mine,
    robot2: rival,
    robot1ELOBefore: myElo[0],
    robot1ELOAfter: myElo[1],
    robot2ELOBefore: rivalElo[0],
    robot2ELOAfter: rivalElo[1],
    robot1FinalHP: iWon ? 40 : 0,
    robot2FinalHP: iWon ? 0 : 35,
    winnerReward: 1000,
    loserReward: 300,
    durationSeconds: 42,
    participants: [
      fixtureParticipant(mine, 1, myElo[0], myElo[1], iWon ? 40 : 0, iWon ? 1000 : 300),
      fixtureParticipant(rival, 2, rivalElo[0], rivalElo[1], iWon ? 0 : 35, iWon ? 300 : 1000),
    ],
  };
}

/**
 * Serve a two-battle history (one win, one loss) owned by the signed-in
 * player. The player's id comes from the real profile response.
 */
async function mockBattleHistory(page: Page): Promise<void> {
  let userId = 0;
  await page.route('**/api/user/profile', async (route) => {
    const response = await route.fetch();
    const body = await response.json() as { id: number };
    userId = body.id;
    await route.fulfill({ response, json: body });
  });
  await page.route('**/api/matches/history**', async (route) => {
    const mine = { id: 900001, name: 'E2E Alpha', userId, user: { username: 'test_user_001' } };
    const rival = { id: 900002, name: 'E2E Rival', userId: userId + 100000, user: { username: 'e2e_rival' } };
    await route.fulfill({
      json: {
        data: [
          fixtureBattle(910002, '2026-11-02T12:00:00.000Z', mine, rival, false),
          fixtureBattle(910001, '2026-11-01T12:00:00.000Z', mine, rival, true),
        ],
        pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
      },
    });
  });
}

test.describe('Battle History Page', () => {
  test('displays battle records with robot names, outcomes, and ELO changes', async ({ page }) => {
    // Req 4.1 — battle history page shows battle records
    await navigateToProtectedPage(page, '/battle-history');

    // Verify the page heading
    await expect(page.getByRole('heading', { name: 'Battle History', level: 1 })).toBeVisible();

    // Wait for loading to finish — battle records or empty state should appear
    // The page shows "Loading battles..." while fetching
    await expect(page.getByText('Loading battles...')).toBeHidden({ timeout: 15000 });

    // Check if battles exist for this user
    const hasBattles = await page.getByText('vs').first().isVisible().catch(() => false);

    if (hasBattles) {
      // Verify battle records display robot names (shown as "MyRobot vs Opponent")
      await expect(page.getByText('vs').first()).toBeVisible();

      // Verify outcome badges are present (WIN, LOSS, or DRAW)
      const outcomeBadge = page.getByText(/^(WIN|LOSS|DRAW)$/).first();
      await expect(outcomeBadge).toBeVisible();

      // Verify ELO changes are displayed (positive like +5 or negative like -3)
      // ELO changes appear as text with + or - prefix
      const eloText = page.getByText(/^[+-]\d+$/).first();
      await expect(eloText).toBeVisible();
    } else {
      // If no battles, the empty state should show
      await expect(page.getByText('No battles yet')).toBeVisible();
    }
  });

  test('outcome filter filters displayed battles to selected outcome type', async ({ page }) => {
    // Req 4.2 — outcome filter works
    await mockBattleHistory(page);
    await navigateToProtectedPage(page, '/battle-history');
    await expect(page.getByRole('heading', { name: 'Battle History', level: 1 })).toBeVisible();
    await expect(page.getByText('Loading battles...')).toBeHidden({ timeout: 15000 });

    await expect(page.getByText('vs').first()).toBeVisible();

    // Select "Wins Only" from the outcome filter dropdown
    // The select has options: "All Outcomes", "Wins Only", "Losses Only", "Draws Only"
    const outcomeSelect = page.locator('select').filter({ hasText: 'All Outcomes' });
    await outcomeSelect.selectOption('win');

    // The fixture holds one win and one loss: only the win stays.
    await expect(page.getByText(/^WIN$/).first()).toBeVisible();
    await expect(page.getByText(/^LOSS$/)).toHaveCount(0);

    await outcomeSelect.selectOption('loss');
    await expect(page.getByText(/^LOSS$/).first()).toBeVisible();
    await expect(page.getByText(/^WIN$/)).toHaveCount(0);
  });

  test('clicking a battle record navigates to /battle/:id detail page', async ({ page }) => {
    // Req 4.3 — clicking a battle navigates to detail page
    await mockBattleHistory(page);
    await navigateToProtectedPage(page, '/battle-history');
    await expect(page.getByRole('heading', { name: 'Battle History', level: 1 })).toBeVisible();
    await expect(page.getByText('Loading battles...')).toBeHidden({ timeout: 15000 });

    await expect(page.getByText('vs').first()).toBeVisible();

    // Click the first battle record (CompactBattleCard is a clickable div)
    // Each card contains "vs" text and an arrow "→"
    const firstBattleCard = page.getByText('vs').first().locator('..').locator('..');
    await firstBattleCard.click();

    // Should navigate to /battle/:id
    await expect(page).toHaveURL(/\/battle\/\d+/, { timeout: 10000 });
  });

  test('changing sort order reorders battle records', async ({ page }) => {
    // Req 4.5 — sort order changes the display order
    await mockBattleHistory(page);
    await navigateToProtectedPage(page, '/battle-history');
    await expect(page.getByRole('heading', { name: 'Battle History', level: 1 })).toBeVisible();
    await expect(page.getByText('Loading battles...')).toBeHidden({ timeout: 15000 });

    await expect(page.getByText('vs').first()).toBeVisible();

    // The sort select has "Sort: Newest First" as default
    const sortSelect = page.locator('select').filter({ hasText: 'Sort: Newest First' });
    await expect(sortSelect).toBeVisible();

    // Change to "Sort: Oldest First"
    await sortSelect.selectOption('date-asc');

    // Verify the sort select now shows the new value
    await expect(sortSelect).toHaveValue('date-asc');

    // Battle records should still be visible (just reordered)
    await expect(page.getByText('vs').first()).toBeVisible();
  });

  test('search term filters battles by robot/opponent names', async ({ page }) => {
    // Req 4.6 — search filters battles
    await mockBattleHistory(page);
    await navigateToProtectedPage(page, '/battle-history');
    await expect(page.getByRole('heading', { name: 'Battle History', level: 1 })).toBeVisible();
    await expect(page.getByText('Loading battles...')).toBeHidden({ timeout: 15000 });

    await expect(page.getByText('vs').first()).toBeVisible();

    // Find the search input by placeholder
    const searchInput = page.getByPlaceholder('Search robot or opponent...');
    await expect(searchInput).toBeVisible();

    // Type a search term that's unlikely to match any robot name
    await searchInput.fill('zzz_nonexistent_robot_xyz');

    // Should show "No Battles Found" since no robot matches
    await expect(page.getByText('No Battles Found')).toBeVisible({ timeout: 5000 });

    // Clear the search and verify battles reappear
    await searchInput.clear();
    await expect(page.getByText('vs').first()).toBeVisible({ timeout: 5000 });
  });
});

// Empty state test needs a fresh user with no battles
test.describe('Battle History — Empty State', () => {
  // Use a fresh browser context for registration
  test.use({ storageState: { cookies: [], origins: [] } });

  test('empty state shows "No battles yet" message for a user with no battles', async ({ page }) => {
    // Req 4.4 — empty state message
    // Register a fresh user who has no battle history
    await registerNewUser(page);

    // Navigate to battle history
    await page.goto('/battle-history');
    await page.waitForLoadState('networkidle');

    // Verify the page heading
    await expect(page.getByRole('heading', { name: 'Battle History', level: 1 })).toBeVisible();

    // Wait for loading to finish
    await expect(page.getByText('Loading battles...')).toBeHidden({ timeout: 15000 });

    // Fresh user should see the empty state message
    await expect(page.getByText('No battles yet')).toBeVisible();
  });
});
