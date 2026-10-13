import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * E2E tests for environment branding (issue #174).
 *
 * ACC and production share one build artifact, so the tab title prefix and
 * favicon variant are chosen at runtime from `location.hostname`
 * (src/utils/environment-branding.ts). These tests run the real app under the
 * ACC and production hostnames by routing those origins to the local server,
 * then check the title, the icon hrefs, and that every icon is a real image
 * (not the SPA index.html fallback). No backend or auth is needed.
 */

const ICON_SELECTORS = {
  svg: 'link[rel~="icon"][type="image/svg+xml"]',
  ico: 'link[rel~="icon"][sizes="32x32"]',
  touch: 'link[rel="apple-touch-icon"]',
} as const;

const IMAGE_CONTENT_TYPES = ['image/svg+xml', 'image/png', 'image/x-icon', 'image/vnd.microsoft.icon'];

interface ExpectedBranding {
  title: string;
  svg: string;
  ico: string;
  touch: string;
}

/** Serves `origin` from the local server so the app sees the target hostname. */
async function serveAs(page: Page, origin: string, baseURL: string): Promise<void> {
  await page.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: new URL(url.pathname + url.search, baseURL).toString() });
    await route.fulfill({ response });
  });
}

async function expectBranding(
  page: Page,
  request: APIRequestContext,
  baseURL: string,
  expected: ExpectedBranding,
): Promise<void> {
  await expect(page).toHaveTitle(expected.title);
  await expect(page.locator(ICON_SELECTORS.svg)).toHaveAttribute('href', expected.svg);
  await expect(page.locator(ICON_SELECTORS.ico)).toHaveAttribute('href', expected.ico);
  await expect(page.locator(ICON_SELECTORS.touch)).toHaveAttribute('href', expected.touch);

  for (const href of [expected.svg, expected.ico, expected.touch]) {
    const response = await request.get(new URL(href, baseURL).toString());
    expect(response.status(), `${href} status`).toBe(200);
    const contentType = response.headers()['content-type'] ?? '';
    expect(
      IMAGE_CONTENT_TYPES.some((type) => contentType.startsWith(type)),
      `${href} content-type "${contentType}" should be an image`,
    ).toBe(true);
  }
}

test.describe('Environment branding', () => {
  test('local host shows TST branding', async ({ page, request, baseURL }) => {
    const base = baseURL ?? 'http://localhost:3000';
    await page.goto('/login');
    await expectBranding(page, request, base, {
      title: '[TST] Armoured Souls',
      svg: '/favicon-dev.svg',
      ico: '/favicon-dev.ico',
      touch: '/apple-touch-icon-dev.png',
    });
  });

  test('ACC hostname shows ACC branding', async ({ page, request, baseURL }) => {
    const base = baseURL ?? 'http://localhost:3000';
    await serveAs(page, 'https://acc.armouredsouls.com', base);
    await page.goto('https://acc.armouredsouls.com/login');
    await expectBranding(page, request, base, {
      title: '[ACC] Armoured Souls',
      svg: '/favicon-acc.svg',
      ico: '/favicon-acc.ico',
      touch: '/apple-touch-icon-acc.png',
    });
  });

  test('production hostname shows plain branding', async ({ page, request, baseURL }) => {
    const base = baseURL ?? 'http://localhost:3000';
    await serveAs(page, 'https://armouredsouls.com', base);
    await page.goto('https://armouredsouls.com/login');
    await expectBranding(page, request, base, {
      title: 'Armoured Souls',
      svg: '/favicon.svg',
      ico: '/favicon.ico',
      touch: '/apple-touch-icon.png',
    });
  });
});
