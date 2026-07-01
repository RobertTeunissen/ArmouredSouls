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
    // Wait for onboarding page to fully render
    await page.waitForLoadState('load');

    // Click the "Skip Tutorial" button — try multiple selectors for resilience
    const skipButton = page.getByRole('button', { name: /Skip Tutorial/i })
      .or(page.getByRole('button', { name: /Skip/i }));
    await skipButton.waitFor({ state: 'visible', timeout: 15000 });
    await skipButton.click();

    // Confirmation modal — button has aria-label="Confirm skip tutorial"
    const skipConfirm = page.getByRole('button', { name: /Confirm skip tutorial/i })
      .or(page.getByRole('button', { name: /Skip Anyway/i }))
      .or(page.getByRole('button', { name: /Yes, Skip/i }));
    await skipConfirm.waitFor({ state: 'visible', timeout: 10000 });
    await skipConfirm.click();

    await page.waitForURL('**/dashboard', { timeout: 15000 });
  }

  // Wait for dashboard content to render — use a generous timeout for CI
  await page.waitForLoadState('load');
}
