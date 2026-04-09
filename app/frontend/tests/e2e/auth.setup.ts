import { test as setup } from '@playwright/test';
import { loginAndGoToDashboard } from './helpers/login';

const authFile = '.auth/player1.json';

/**
 * Playwright auth setup: logs in once as player1 and saves the browser
 * storage state (cookies + localStorage) so all subsequent tests can
 * skip the login step entirely.
 */
setup('authenticate as player1', async ({ page }) => {
  await loginAndGoToDashboard(page, 'player1', 'password123');

  // Save signed-in state to file
  await page.context().storageState({ path: authFile });
});
