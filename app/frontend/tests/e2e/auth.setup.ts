import { test as setup } from '@playwright/test';
import { loginAndGoToDashboard } from './helpers/login';

const authFile = '.auth/test_user_001.json';

/**
 * Playwright auth setup: logs in once as test_user_001 and saves the browser
 * storage state (cookies + localStorage) so all subsequent tests can
 * skip the login step entirely.
 */
setup('authenticate as test_user_001', async ({ page }) => {
  await loginAndGoToDashboard(page, 'test_user_001', 'testpass123');

  // Save signed-in state to file
  await page.context().storageState({ path: authFile });
});
