import { test, expect } from '@playwright/test';
import { navigateToProtectedPage } from './helpers/navigate';

/**
 * E2E tests for the Practice Arena (Combat Simulation Lab).
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 *
 * All tests use test_user_001 auth state (chromium project default).
 * test_user_001 has at least one battle-ready robot with a weapon equipped.
 */

/** Helper: select the first robot in slot 1 and wait for it to be selected */
async function selectFirstRobot(page: import('@playwright/test').Page) {
  // Robot images are rendered as buttons with title={robotName} inside a grid
  // The first slot defaults to "owned" mode showing the robot image grid
  const robotImageButtons = page.locator('button').filter({ has: page.locator('img') });
  const firstRobot = robotImageButtons.first();
  await expect(firstRobot).toBeVisible({ timeout: 5000 });
  await firstRobot.click();
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
    await selectFirstRobot(page);

    // Click Run Simulation (includes emoji: ⚡ Run Simulation)
    const runButton = page.getByRole('button', { name: /Run Simulation/i });
    await expect(runButton).toBeEnabled({ timeout: 5000 });
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
    await selectFirstRobot(page);

    // Set batch count to 3 via the simulation runs select
    const batchSelect = page.getByRole('combobox').filter({ has: page.locator('option[value="1"]') });
    await batchSelect.selectOption('3');

    // Click Run Simulation
    const runButton = page.getByRole('button', { name: /Run Simulation/i });
    await expect(runButton).toBeEnabled({ timeout: 5000 });
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
    await selectFirstRobot(page);

    // Run a single simulation
    const runButton = page.getByRole('button', { name: /Run Simulation/i });
    await expect(runButton).toBeEnabled({ timeout: 5000 });
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
