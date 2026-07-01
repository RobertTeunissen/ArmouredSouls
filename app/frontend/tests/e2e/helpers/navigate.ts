import { Page } from '@playwright/test';

/**
 * Navigates to a protected page, handling the auth race condition where
 * ProtectedRoute may redirect to /login before AuthProvider finishes
 * restoring the session from storageState.
 *
 * Strategy: navigate and wait for the page to settle using domcontentloaded
 * (faster and more reliable than networkidle). If redirected to /login,
 * retry up to 3 times with short waits for auth initialization.
 */
export async function navigateToProtectedPage(page: Page, path: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });

    // Wait briefly for the auth context to evaluate and potentially redirect
    await page.waitForTimeout(500);

    if (!page.url().includes('/login')) {
      return; // Successfully on the protected page
    }

    // Auth context hasn't initialized yet — wait and retry
    await page.waitForTimeout(1000);
  }

  // Final attempt: if still on login, the token may be missing from
  // localStorage. Inject it via the API directly.
  const { loginAndGoToDashboard } = await import('./login');
  await loginAndGoToDashboard(page, 'test_user_001', 'testpass123');
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
}
