import { test, expect } from '@playwright/test';
import {
  API_URL,
  LOCAL_ONLY_REASON,
  adminToken,
  expectNoHorizontalOverflow,
  expectTouchTargets,
  gotoAuthed,
  isLocalTarget,
} from './helpers/automaton';

/**
 * Admin Security (`/admin/security`) and Image Uploads (`/admin/image-uploads`)
 * against the real backend: the new endpoints answer and the removed ones are
 * gone, a failed login shows up as a stored signal, the window picker switches
 * buckets, the cleanup preview changes nothing, and both pages fit 390 px with
 * touch-sized controls. Set `E2E_SCREENSHOT_DIR` to also save screenshots.
 *
 * Runs in the `admin` project (local targets only, like the other admin specs).
 */
const SECURITY = '[data-testid="security-page"]';
const IMAGES = '[data-testid="image-uploads-page"]';
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

test.describe('Admin Security & Moderation', () => {
  test.beforeEach(() => {
    test.skip(!isLocalTarget(), LOCAL_ONLY_REASON);
  });

  test('serves the new endpoints and removes the old ones', async ({ request }) => {
    const headers = { Authorization: `Bearer ${await adminToken(request)}` };
    for (const path of ['/api/admin/security/overview?window=24h', '/api/admin/images/overview', '/api/admin/images', '/api/admin/images/cleanup']) {
      expect((await request.get(`${API_URL}${path}`, { headers })).status(), path).toBe(200);
    }
    for (const path of ['/api/admin/security/events', '/api/admin/security/summary', '/api/admin/uploads']) {
      expect((await request.get(`${API_URL}${path}`, { headers })).status(), path).toBe(404);
    }
  });

  test('Security: a failed login is a signal; the window picker switches buckets', async ({ page, request }) => {
    const failed = await request.post(`${API_URL}/api/auth/login`, { data: { username: 'admin', password: 'definitely-not-the-password-1' } });
    expect(failed.status()).toBe(401);

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAuthed(page, '/admin/security?window=24h');
    await expect(page.locator(SECURITY)).toBeVisible();
    await expect(page.getByTestId('security-status')).toContainText('failed logins');
    await expect(page.getByRole('region', { name: 'Signals per hour' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Without an account' })).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-security-desktop.png`, fullPage: true });

    const reloaded = page.waitForResponse((r) => r.url().includes('/api/admin/security/overview?window=30d') && r.status() === 200);
    await page.getByRole('button', { name: 'Last 30 days' }).click();
    await reloaded;
    await expect(page).toHaveURL(/window=30d/);
    await expect(page.getByRole('region', { name: 'Signals per day' })).toBeVisible();
  });

  test('Image Uploads: overview, grid and a cleanup preview that changes nothing', async ({ page }) => {
    let cleanupPosts = 0;
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/api/admin/images/cleanup')) cleanupPosts++; });

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAuthed(page, '/admin/image-uploads');
    await expect(page.locator(IMAGES)).toBeVisible();
    await expect(page.getByTestId('image-card-in-use')).toBeVisible();
    await expect(page.getByRole('region', { name: /Moderation, last 30 days/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Images in use' })).toBeVisible();

    const storage = page.getByRole('region', { name: 'Storage' });
    await storage.getByRole('button', { name: 'Preview cleanup' }).click();
    await expect(storage.getByTestId('cleanup-preview')).toBeVisible();
    expect(cleanupPosts).toBe(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-images-desktop.png`, fullPage: true });
  });

  for (const [path, selector, name] of [['/admin/security', SECURITY, 'security'], ['/admin/image-uploads', IMAGES, 'images']] as const) {
    test(`${name} fits 390 px with touch-sized controls`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 900 });
      await gotoAuthed(page, path);
      await expect(page.locator(selector)).toBeVisible();
      await expect(page.locator(`${selector} h2`).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalOverflow(page, selector);
      await expectTouchTargets(page, selector);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-${name}-mobile.png`, fullPage: true });
    });
  }
});
