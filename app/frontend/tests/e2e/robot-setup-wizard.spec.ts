import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { registerNewUser } from './helpers/register';
import { API_URL } from './helpers/automaton';

/**
 * Robot setup wizard against the real backend (Spec #47).
 *
 * Guards the contract the unit tests mock away: the Events step used to send
 * `{ subscriptions }` to `PUT /api/subscriptions/robot/:id`, which expects
 * `{ eventTypes }`, so no robot set up through the wizard was ever entered in
 * an event. A fresh player goes create robot → portrait (skipped) → buy and
 * equip a weapon → enter the default events → Workshop, battle-ready.
 */

test.use({ storageState: { cookies: [], origins: [] } });

async function registerAndSkipTutorial(page: Page): Promise<void> {
  await registerNewUser(page);
  if (page.url().includes('/onboarding')) {
    await page.getByRole('button', { name: 'Skip Tutorial' }).click();
    await page.getByRole('button', { name: /Confirm skip tutorial/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  }
}

/** Authenticated API call as the logged-in player (economic writes need an Idempotency-Key). */
async function playerApi<T>(page: Page, method: 'post' | 'put', path: string, data: unknown): Promise<T> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const response = await page.request[method](`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': randomUUID() },
    data,
  });
  expect(response.ok(), `${method.toUpperCase()} ${path} → ${response.status()}`).toBe(true);
  return (await response.json()) as T;
}

test.describe('Robot setup wizard', () => {
  test('a new robot is battle-ready after the wizard: weapon bought and equipped, events entered', async ({ page }) => {
    test.setTimeout(120_000);

    await registerAndSkipTutorial(page);

    // Create the robot; the wizard opens.
    await page.goto('/robots/create');
    const robotName = `Wiz-${Date.now().toString(36)}`;
    await page.getByLabel('Robot Name').fill(robotName);
    await page.getByRole('button', { name: /Create Robot/ }).click();
    await expect(page).toHaveURL(/\/robots\/\d+\/setup$/, { timeout: 20000 });
    await expect(page.getByRole('heading', { level: 1, name: `Set up ${robotName}` })).toBeVisible();
    await expect(page.getByText(/Step 1 of 3 · Portrait/)).toBeVisible();

    // Portrait: closing the picker skips the step.
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

    // Weapon: one click buys the cheapest compatible weapon and equips it.
    await expect(page.getByRole('heading', { name: 'Equip a weapon' })).toBeVisible();
    const purchase = page.waitForResponse((r) => r.url().includes('/api/weapon-inventory/purchase') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /^Buy and equip/ }).first().click();
    expect((await purchase).status()).toBe(201);

    // Events: the solo events are ticked; one click saves them and finishes.
    await expect(page.getByRole('heading', { name: 'Enter battle events' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /1v1 League/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /1v1 Tournament/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /King of the Hill/ })).toBeChecked();
    const save = page.waitForResponse((r) => /\/api\/subscriptions\/robot\/\d+$/.test(r.url()) && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Enter 3 events & finish' }).click();
    expect((await save).status()).toBe(200);

    // Workshop: no "Not ready for battle" warning; only the tuning tip remains.
    await expect(page).toHaveURL(/\/robots\/\d+\/prepare$/, { timeout: 15000 });
    await expect(page.getByText('Allocate your tuning points')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Not ready for battle')).toHaveCount(0);

    // Opening the wizard again for a battle-ready robot goes straight back to the Workshop.
    const workshopUrl = page.url();
    await page.goto(workshopUrl.replace(/\/prepare$/, '/setup'));
    await expect(page).toHaveURL(/\/robots\/\d+\/prepare$/, { timeout: 15000 });
  });

  // #606: the Weapon step read holder fields the inventory API doesn't return
  // (it returns `robotsMain`/`robotsOffhand`), so a second robot was offered
  // the first robot's weapon as "spare" and the equip was refused.
  test('a second robot is not offered the weapon the first robot holds', async ({ page }) => {
    test.setTimeout(120_000);
    await registerAndSkipTutorial(page);

    // First robot with an equipped weapon, set up through the API.
    await playerApi(page, 'post', '/api/facilities/upgrade', { facilityType: 'roster_expansion' });
    const { robot } = await playerApi<{ robot: { id: number } }>(page, 'post', '/api/robots', { name: `Held-${Date.now().toString(36)}` });
    const weapons = await (await page.request.get(`${API_URL}/api/weapons`, {
      headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('token'))}` },
    })).json() as Array<{ id: number; name: string; cost: number; handsRequired: string }>;
    const held = weapons.filter((w) => w.handsRequired === 'one').sort((a, b) => a.cost - b.cost)[0];
    const bought = await playerApi<{ weaponInventory: { id: number } }>(page, 'post', '/api/weapon-inventory/purchase', { weaponId: held.id });
    await playerApi(page, 'put', `/api/robots/${robot.id}/equip-main-weapon`, { weaponInventoryId: bought.weaponInventory.id });

    // Second robot through the wizard: the held weapon is not spare, so the step offers the shop.
    await page.goto('/robots/create');
    await page.getByLabel('Robot Name').fill(`Wiz2-${Date.now().toString(36)}`);
    await page.getByRole('button', { name: /Create Robot/ }).click();
    await expect(page).toHaveURL(/\/robots\/\d+\/setup$/, { timeout: 20000 });
    // Escape skips the portrait: the achievement toasts from the setup above
    // sit over the picker's Close button.
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('heading', { name: 'Equip a weapon' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Buy and equip/ }).first()).toBeVisible();
    await expect(page.getByText('Spare weapons in your storage:')).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Equip ${held.name}`, exact: true })).toHaveCount(0);
  });
});
