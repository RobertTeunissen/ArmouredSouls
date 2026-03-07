import { Page } from '@playwright/test';

/**
 * Navigates to a protected page, handling the auth race condition where
 * ProtectedRoute may redirect to /login before AuthProvider finishes
 * restoring the session from storageState.
 *
 * Strategy: navigate, and if we end up on /login, wait for auth to
 * initialize and retry up to 3 times.
 */
export async function navigateToProtectedPage(page: Page, path: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    if (!page.url().includes('/login')) {
      return; // Successfully on the protected page
    }

    // Auth context hasn't initialized yet — wait and retry
    await page.waitForTimeout(1500);
  }

  // Final attempt: if still on login, the token may be missing from
  // localStorage. Inject it via the API directly.
  const { loginAndGoToDashboard } = await import('./login');
  await loginAndGoToDashboard(page, 'player1', 'password123');
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}
