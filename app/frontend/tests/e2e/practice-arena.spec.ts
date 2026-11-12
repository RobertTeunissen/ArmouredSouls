import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { navigateToProtectedPage } from './helpers/navigate';
import { registerNewUser } from './helpers/register';
import { API_URL } from './helpers/automaton';

/**
 * E2E tests for the Practice Arena (Combat Simulation Lab).
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 *
 * All tests use test_user_001 auth state (chromium project default).
 * test_user_001 has at least one battle-ready robot with a weapon equipped.
 */

/** Helper: select the first robot in slot 1 and wait for it to be selected */
async function selectFirstRobot(page: import('@playwright/test').Page): Promise<boolean> {
  // Robot images are rendered as buttons with title={robotName} inside a grid
  const robotImageButtons = page.locator('button').filter({ has: page.locator('img') });
  const firstRobot = robotImageButtons.first();
  const isVisible = await firstRobot.isVisible().catch(() => false);
  if (!isVisible) {
    return false; // No robots available in the grid
  }
  await firstRobot.click();
  return true;
}

test.describe('Practice Arena', () => {
  test('displays battle slot panels and run controls', async ({ page }) => {
    // Req 6.1 — practice arena shows battle slots and run controls
    await navigateToProtectedPage(page, '/practice-arena');

    // Verify the page heading
    await expect(page.getByRole('heading', { name: /Combat Simulation Lab/i })).toBeVisible();

    // Verify slot panels are visible
    await expect(page.getByText('🤖 Your Robot')).toBeVisible();
    await expect(page.getByText('🎯 Opponent')).toBeVisible();

    // Verify the Run Simulation button is present
    await expect(page.getByRole('button', { name: /Run Simulation/i })).toBeVisible();

    // Verify the simulation runs selector is present
    await expect(page.getByText('Simulation runs:')).toBeVisible();
  });

  test('selecting robot and sparring partner then running simulation shows battle result', async ({ page }) => {
    // Req 6.2 — select robot in slot 1, sparring partner in slot 2, run simulation
    await navigateToProtectedPage(page, '/practice-arena');
    await expect(page.getByRole('heading', { name: /Combat Simulation Lab/i })).toBeVisible();
    await expect(page.getByText('Loading simulation lab...')).toBeHidden({ timeout: 15000 });

    // Select the first robot in slot 1
    const robotSelected = await selectFirstRobot(page);
    expect(robotSelected, 'No robots visible in the grid — robot data may not have loaded').toBe(true);

    // Click Run Simulation (includes emoji: ⚡ Run Simulation)
    // canRun requires: robot selected + robot has weapon equipped + not running + cycle not offline
    const runButton = page.getByRole('button', { name: /Run Simulation/i });

    // Wait briefly for UI to update after robot selection before checking enabled state
    await page.waitForTimeout(1000);
    await expect(runButton, 'Run Simulation button is disabled — robot may not have a weapon equipped').toBeEnabled();
    await runButton.click();

    // Wait for simulation to complete
    await expect(page.getByText('⏳ Simulating...')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('⏳ Simulating...')).toBeHidden({ timeout: 30000 });

    // Verify a battle result is displayed
    const resultBanner = page.getByText(/WINS|DRAW/).first();
    await expect(resultBanner).toBeVisible({ timeout: 5000 });
  });

  test('running batch simulation displays batch summary with win/loss/draw counts', async ({ page }) => {
    // Req 6.3 — batch simulation (count > 1) shows batch summary
    await navigateToProtectedPage(page, '/practice-arena');
    await expect(page.getByRole('heading', { name: /Combat Simulation Lab/i })).toBeVisible();
    await expect(page.getByText('Loading simulation lab...')).toBeHidden({ timeout: 15000 });

    // Select the first robot in slot 1
    const robotSelected = await selectFirstRobot(page);
    expect(robotSelected, 'No robots visible in the grid').toBe(true);

    // Check if Run Simulation is enabled before proceeding
    const runButton = page.getByRole('button', { name: /Run Simulation/i });
    await page.waitForTimeout(1000);
    await expect(runButton, 'Run Simulation button is disabled — robot may not have a weapon equipped').toBeEnabled();

    // Set batch count to 3 via the simulation runs select
    const batchSelect = page.getByRole('combobox').filter({ has: page.locator('option[value="1"]') });
    await batchSelect.selectOption('3');

    // Click Run Simulation
    await runButton.click();

    // Wait for simulation to complete
    await expect(page.getByText('⏳ Simulating...')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('⏳ Simulating...')).toBeHidden({ timeout: 60000 });

    // Verify batch summary is displayed
    await expect(page.getByText(/Batch Results/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Wins')).toBeVisible();
    await expect(page.getByText('Losses')).toBeVisible();
    await expect(page.getByText('Draws')).toBeVisible();
  });

  test('completed practice battle result appears in history panel', async ({ page }) => {
    // Req 6.4 — completed battle appears in history
    await navigateToProtectedPage(page, '/practice-arena');
    await expect(page.getByRole('heading', { name: /Combat Simulation Lab/i })).toBeVisible();
    await expect(page.getByText('Loading simulation lab...')).toBeHidden({ timeout: 15000 });

    // Select the first robot in slot 1
    const robotSelected = await selectFirstRobot(page);
    expect(robotSelected, 'No robots visible in the grid').toBe(true);

    // Run a single simulation
    const runButton = page.getByRole('button', { name: /Run Simulation/i });
    await page.waitForTimeout(1000);
    await expect(runButton, 'Run Simulation button is disabled — robot may not have a weapon equipped').toBeEnabled();
    await runButton.click();

    // Wait for simulation to complete
    await expect(page.getByText('⏳ Simulating...')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('⏳ Simulating...')).toBeHidden({ timeout: 30000 });

    // Verify the history panel shows entries
    await expect(page.getByText('Recent Simulations')).toBeVisible();
    await expect(page.getByText(/^vs /).first()).toBeVisible();
  });

  test('"Run Simulation" button is disabled when no robot is selected in a battle slot', async ({ page }) => {
    // Req 6.5 — Run Simulation disabled when no robot selected
    await navigateToProtectedPage(page, '/practice-arena');
    await expect(page.getByRole('heading', { name: /Combat Simulation Lab/i })).toBeVisible();
    await expect(page.getByText('Loading simulation lab...')).toBeHidden({ timeout: 15000 });

    // Without selecting any robot, the Run Simulation button should be disabled
    const runButton = page.getByRole('button', { name: /Run Simulation/i });
    await expect(runButton).toBeDisabled();
  });
});

/** Authenticated API call as the logged-in player (economic writes need an Idempotency-Key). */
async function playerApi<T>(page: Page, method: 'get' | 'post' | 'put', path: string, data?: unknown): Promise<T> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const response = await page.request[method](`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': randomUUID() },
    data,
  });
  expect(response.ok(), `${method.toUpperCase()} ${path} → ${response.status()}`).toBe(true);
  return (await response.json()) as T;
}

test.describe('Practice Arena achievement toast', () => {
  // A fresh player, so the practice counter and the per-user rate limit
  // (30 battles per 15 minutes) start at zero.
  test.use({ storageState: { cookies: [], origins: [] } });

  // #608: a batch returned its unlocks nested in the last result, where the
  // toast subscriber (top-level `achievementUnlocks`) never saw them; the
  // toast only appeared after a reload, from the recap of recent unlocks.
  test('a batch that reaches 25 practice battles shows the Wax On, Wax Off toast', async ({ page }) => {
    test.setTimeout(120_000);
    await registerNewUser(page);
    if (page.url().includes('/onboarding')) {
      await page.getByRole('button', { name: 'Skip Tutorial' }).click();
      await page.getByRole('button', { name: /Confirm skip tutorial/i }).click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    }

    // A battle-ready robot and 20 practice battles, through the API.
    const robotName = `Wax-${Date.now().toString(36)}`;
    const { robot } = await playerApi<{ robot: { id: number } }>(page, 'post', '/api/robots', { name: robotName });
    const weapons = await playerApi<Array<{ id: number; cost: number; handsRequired: string }>>(page, 'get', '/api/weapons');
    const cheapest = weapons.filter((w) => w.handsRequired === 'one').sort((a, b) => a.cost - b.cost)[0];
    const bought = await playerApi<{ weaponInventory: { id: number } }>(page, 'post', '/api/weapon-inventory/purchase', { weaponId: cheapest.id });
    await playerApi(page, 'put', `/api/robots/${robot.id}/equip-main-weapon`, { weaponInventoryId: bought.weaponInventory.id });
    const sparring = { type: 'sparring', config: { botTier: 'WimpBot', loadoutType: 'single', rangeBand: 'melee', stance: 'balanced', yieldThreshold: 20 } };
    for (let i = 0; i < 2; i++) {
      await playerApi(page, 'post', '/api/practice-arena/battle', { robot1: { type: 'owned', robotId: robot.id }, robot2: sparring, count: 10 });
    }

    // Battles 21–30 as one batch in the UI.
    await page.goto('/practice-arena');
    await expect(page.getByText('Loading simulation lab...')).toBeHidden({ timeout: 15000 });
    await page.getByText(robotName).first().click();
    await page.getByRole('combobox').filter({ has: page.locator('option[value="1"]') }).selectOption('10');
    const runButton = page.getByRole('button', { name: /Run Simulation/i });
    await expect(runButton).toBeEnabled();
    await runButton.click();
    await expect(page.getByText(/Batch Results/i)).toBeVisible({ timeout: 60000 });

    await expect(page.getByRole('alert').filter({ hasText: 'Wax On, Wax Off' })).toBeVisible({ timeout: 10000 });
  });
});
