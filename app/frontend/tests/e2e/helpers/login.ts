import { Page } from '@playwright/test';

/**
 * Logs in as the given user and ensures we end up on the dashboard.
 * Handles the onboarding redirect: if the app sends us to /onboarding
 * instead of /dashboard, we skip the tutorial first.
 */
export async function loginAndGoToDashboard(
  page: Page,
  username = 'test_user_001',
  password = 'testpass123',
) {
  await page.goto('/login');
  await page.getByLabel('Username or Email').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();

  // Wait for either /dashboard or /onboarding
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20000 });

  // If redirected to onboarding, skip the tutorial to reach the dashboard
  if (page.url().includes('/onboarding')) {
    // Click the "Skip Tutorial" button (aria-label="Skip Tutorial")
    await page.getByRole('button', { name: /Skip Tutorial/i }).click();

    // Confirmation modal — button has aria-label="Confirm skip tutorial", text "Skip Anyway" or "Yes, Skip"
    const skipConfirm = page.getByRole('button', { name: /Confirm skip tutorial/i });
    await skipConfirm.click({ timeout: 10000 });

    await page.waitForURL('**/dashboard', { timeout: 10000 });
  }

  await page.waitForLoadState('networkidle');
}
