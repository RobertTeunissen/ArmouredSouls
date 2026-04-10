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

test.describe('Practice Arena', () => {
  test('displays battle slot panels and run controls', async ({ page }) => {
    // Req 6.1 — practice arena shows battle slots and run controls
    await navigateToProtectedPage(page, '/practice-arena');

    // Verify the page heading
    await expect(page.getByRole('heading', { name: /Combat Simulation Lab/i })).toBeVisible();

    // Verify slot 1 (Your Robot) panel is visible
    await expect(page.getByText('🤖 Your Robot')).toBeVisible();

    // Verify slot 2 (Opponent) panel is visible
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

    // Wait for loading to finish
    await expect(page.getByText('Loading simulation lab...')).toBeHidden({ timeout: 15000 });

    // Select the first robot in slot 1 by clicking its button in the robot grid
    // Slot 1 is forceOwned, so it shows the robot image grid directly
    const slot1Panel = page.locator('div').filter({ hasText: '🤖 Your Robot' }).first();
    const robotButtons = slot1Panel.getByRole('button').filter({ hasNot: page.locator('text="Deploy Robot"') });
    const firstRobotButton = robotButtons.first();
    await firstRobotButton.click();

    // Slot 2 defaults to sparring mode with AverageBot selected — no action needed
    // Verify sparring partner panel is visible (opponent slot shows bot tier options)
    await expect(page.getByText('Simulate Opponent')).toBeVisible();

    // Click Run Simulation
    const runButton = page.getByRole('button', { name: /Run Simulation/i });
    await expect(runButton).toBeEnabled({ timeout: 5000 });
    await runButton.click();

    // Wait for simulation to complete — the button text changes to "Simulating..."
    // then back to "Run Simulation" when done
    await expect(page.getByText('⏳ Simulating...')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('⏳ Simulating...')).toBeHidden({ timeout: 30000 });

    // Verify a battle result is displayed — either a win banner or draw banner
    const resultBanner = page.getByText(/WINS|DRAW/).first();
    await expect(resultBanner).toBeVisible({ timeout: 5000 });
  });

  test('running batch simulation displays batch summary with win/loss/draw counts', async ({ page }) => {
    // Req 6.3 — batch simulation (count > 1) shows batch summary
    await navigateToProtectedPage(page, '/practice-arena');
    await expect(page.getByRole('heading', { name: /Combat Simulation Lab/i })).toBeVisible();
    await expect(page.getByText('Loading simulation lab...')).toBeHidden({ timeout: 15000 });

    // Select the first robot in slot 1
    const slot1Panel = page.locator('div').filter({ hasText: '🤖 Your Robot' }).first();
    const robotButtons = slot1Panel.getByRole('button').filter({ hasNot: page.locator('text="Deploy Robot"') });
    await robotButtons.first().click();

    // Set batch count to more than 1 via the simulation runs select
    const batchSelect = page.getByRole('combobox').filter({ has: page.locator('option[value="1"]') });
    await batchSelect.selectOption('3');

    // Click Run Simulation
    const runButton = page.getByRole('button', { name: /Run Simulation/i });
    await expect(runButton).toBeEnabled({ timeout: 5000 });
    await runButton.click();

    // Wait for simulation to complete
    await expect(page.getByText('⏳ Simulating...')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('⏳ Simulating...')).toBeHidden({ timeout: 60000 });

    // Verify batch summary is displayed with win/loss/draw counts
    await expect(page.getByText(/Batch Results.*3 simulations/i)).toBeVisible({ timeout: 5000 });

    // Verify the three stat categories are shown
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
    const slot1Panel = page.locator('div').filter({ hasText: '🤖 Your Robot' }).first();
    const robotButtons = slot1Panel.getByRole('button').filter({ hasNot: page.locator('text="Deploy Robot"') });
    await robotButtons.first().click();

    // Run a single simulation (batch count defaults to 1)
    const runButton = page.getByRole('button', { name: /Run Simulation/i });
    await expect(runButton).toBeEnabled({ timeout: 5000 });
    await runButton.click();

    // Wait for simulation to complete
    await expect(page.getByText('⏳ Simulating...')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('⏳ Simulating...')).toBeHidden({ timeout: 30000 });

    // Verify the history panel shows "Recent Simulations" heading with at least one entry
    await expect(page.getByText('Recent Simulations')).toBeVisible();

    // History entries show "vs <opponent>" text
    await expect(page.getByText(/^vs /).first()).toBeVisible();
  });

  test('"Run Simulation" button is disabled when no robot is selected in a battle slot', async ({ page }) => {
    // Req 6.5 — Run Simulation disabled when no robot selected
    await navigateToProtectedPage(page, '/practice-arena');
    await expect(page.getByRole('heading', { name: /Combat Simulation Lab/i })).toBeVisible();
    await expect(page.getByText('Loading simulation lab...')).toBeHidden({ timeout: 15000 });

    // Without selecting any robot in slot 1, the Run Simulation button should be disabled
    // Slot 1 defaults to owned mode with no robot selected (robotId: null)
    const runButton = page.getByRole('button', { name: /Run Simulation/i });
    await expect(runButton).toBeDisabled();
  });
});
