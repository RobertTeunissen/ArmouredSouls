import { test as setup } from '@playwright/test';
import { loginAndGoToDashboard } from './helpers/login';
import { ADMIN_PASSWORD, ADMIN_USERNAME, LOCAL_ONLY_REASON, isLocalTarget } from './helpers/automaton';

const authFile = '.auth/admin.json';

/**
 * Playwright admin setup (Spec #55, tasks 10.6 and 11.3): logs in once as the
 * seeded `admin` account from `app/backend/prisma/seed.ts` and saves the
 * storage state for the `admin` project (`admin-automatons.spec.ts`,
 * `automaton-badge.spec.ts`).
 */
setup('authenticate as admin', async ({ page }) => {
  setup.skip(!isLocalTarget(), LOCAL_ONLY_REASON);
  await loginAndGoToDashboard(page, ADMIN_USERNAME, ADMIN_PASSWORD);
  await page.context().storageState({ path: authFile });
});
