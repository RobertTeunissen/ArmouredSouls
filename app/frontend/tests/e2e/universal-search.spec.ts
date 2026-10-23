import { expect, test, type Page } from '@playwright/test';
import { loginAndGoToDashboard } from './helpers/login';
import { navigateToProtectedPage } from './helpers/navigate';

/**
 * Browser coverage for the Universal_Search_System.
 *
 * The player search endpoint is mocked in these tests so the browser contract
 * is deterministic while destination pages and authentication continue to use
 * the real application routes. Admin report responses are also mocked to keep
 * the report assertions independent of the current database contents.
 *
 * Validates: Requirements 5.1–5.20, 6.1–6.14, 7.1–7.17, 8.1–8.8,
 * 9.4, 9.8, 11.1–11.6, 12.14–12.21
 */

const VIEWPORTS = [
  { name: '320px mobile', width: 320, height: 800 },
  { name: '375px mobile', width: 375, height: 800 },
  { name: '768px tablet', width: 768, height: 900 },
  { name: '1023px tablet', width: 1023, height: 900 },
  { name: '1024px desktop', width: 1024, height: 900 },
  { name: '1920px desktop', width: 1920, height: 1080 },
] as const;

const EMPTY_RESPONSE = { robots: [], stables: [], guide: [] } as const;

const SEARCH_RESPONSE = {
  robots: [
    { category: 'robots', id: 42, label: 'Atlas' },
    { category: 'robots', id: 43, label: 'Atlas Prime' },
  ],
  stables: [
    { category: 'stables', userId: 7, label: 'North Star' },
  ],
  guide: [
    {
      category: 'guide',
      title: 'Combat Basics',
      sectionTitle: 'Combat',
      sectionSlug: 'combat',
      articleSlug: 'basics',
    },
  ],
};

const STABLE_NOT_FOUND_RESPONSE = {
  robots: [],
  stables: [{ category: 'stables', userId: 999999, label: 'Missing Stable' }],
  guide: [],
};

const ROBOT_ACCESS_RESPONSE = {
  robots: [{ category: 'robots', id: 999998, label: 'Restricted Robot' }],
  stables: [],
  guide: [],
};

// Shape of `GET /api/admin/search-analytics/report` (settled counting, see
// docs/implementation_notes/UNIVERSAL_SEARCH_CONTRACT.md §8.5 and §10).
const ADMIN_REPORT = {
  period: { seasonNumber: 8, cycleNumber: 24, cycleFrom: 18, cycleTo: 24, mode: 'settled' },
  overview: {
    totalSearches: 120,
    uniqueSearchers: 18,
    noResultSearches: 9,
    rawRequests: 300,
    adminSearchers: 1,
    noResultRate: 7.5,
    selection: { trackedSearches: 60, ledToResult: 40, rate: 66.7, trackedSinceCycle: 22 },
  },
  comparison: { cycleFrom: 11, cycleTo: 17, totalSearches: 100, noResultRate: 9 },
  trends: [
    { cycleNumber: 23, totalSearches: 80, uniqueSearchers: 14, noResultSearches: 4, noResultRate: 5 },
    { cycleNumber: 24, totalSearches: 120, uniqueSearchers: 18, noResultSearches: 9, noResultRate: 7.5 },
  ],
  topPhrases: [
    { phrase: 'admin-only phrase', count: 40 },
    { phrase: 'north star', count: 21 },
  ],
  noResultPhrases: [{ phrase: 'missing guide', count: 9 }],
  categoryUsage: { robots: 60, stables: 35, guide: 16 },
  categoryResults: {
    robots: { returnedShare: 70, chosenShare: 40 },
    stables: { returnedShare: 30, chosenShare: 15 },
    guide: { returnedShare: 20, chosenShare: 10 },
    openedNothingShare: 35,
  },
  playerAnalysis: {
    entries: [
      { userId: 42, stableName: 'North Star', searchCount: 12, noResultCount: 2 },
      { userId: 7, stableName: null, searchCount: 4, noResultCount: 1 },
    ],
    page: 1,
    limit: 25,
    total: 101,
  },
  limitations: [{ code: 'analyticsDataIncomplete', message: 'Some telemetry may be missing.' }],
};

// Shape of `GET /api/admin/search-analytics/phrases`.
const ADMIN_PHRASES = {
  rows: [
    {
      phrase: 'admin-only phrase',
      searches: 40,
      share: 33.3,
      noResultRate: 0,
      returned: { robots: true, stables: false, guide: true },
      mostChosen: { category: 'robots', share: 62.5 },
    },
    {
      phrase: 'missing guide',
      searches: 9,
      share: 7.5,
      noResultRate: 100,
      returned: { robots: false, stables: false, guide: false },
      mostChosen: null,
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
};

const ADMIN_REPORT_PAGE_2 = {
  ...ADMIN_REPORT,
  playerAnalysis: {
    ...ADMIN_REPORT.playerAnalysis,
    entries: [{ userId: 63, stableName: 'East Wind', searchCount: 8, noResultCount: 0 }],
    page: 2,
  },
};

type SearchResponse = typeof SEARCH_RESPONSE;

test.beforeEach(async ({ page }) => {
  // Keep the auth token from storageState but isolate browser-local search history.
  await page.addInitScript(() => {
    window.localStorage.removeItem('armoured-souls:recent-searches');
  });
});

function visibleSearchTrigger(page: Page) {
  return page.locator('button[aria-label="Open search"]:visible').first();
}

function searchDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Search' });
}

async function openPlayerPage(page: Page, path = '/dashboard'): Promise<void> {
  await navigateToProtectedPage(page, path);
  await expect(visibleSearchTrigger(page)).toBeVisible({ timeout: 15000 });
}

async function openSearch(page: Page): Promise<void> {
  await visibleSearchTrigger(page).click();
  await expect(searchDialog(page)).toBeVisible();
  await expect(searchDialog(page).getByText('Search robots, stables, or guide articles', { exact: true }).first()).toBeVisible();
}

async function fulfillJson(route: Parameters<Parameters<Page['route']>[1]>[0], payload: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

async function mockSearch(page: Page, response: SearchResponse = SEARCH_RESPONSE): Promise<string[]> {
  const requestUrls: string[] = [];
  await page.route('**/api/search**', async (route) => {
    requestUrls.push(route.request().url());
    await fulfillJson(route, response);
  });
  return requestUrls;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function expectMinimumTarget(locator: ReturnType<Page['locator']>): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
}

async function expectPaletteResult(page: Page, label = 'Robot: Atlas'): Promise<void> {
  await expect(searchDialog(page).getByRole('button', { name: label, exact: true })).toBeVisible({ timeout: 5000 });
}

/** Mocks the report and the phrase table; returns the report and phrase request URLs. */
async function mockAdminReport(page: Page): Promise<{ report: string[]; phrases: string[] }> {
  const report: string[] = [];
  const phrases: string[] = [];
  await page.route('**/api/admin/search-analytics/report**', async (route) => {
    report.push(route.request().url());
    const requestedPage = new URL(route.request().url()).searchParams.get('page');
    await fulfillJson(route, requestedPage === '2' ? ADMIN_REPORT_PAGE_2 : ADMIN_REPORT);
  });
  await page.route('**/api/admin/search-analytics/phrases**', async (route) => {
    phrases.push(route.request().url());
    await fulfillJson(route, ADMIN_PHRASES);
  });
  return { report, phrases };
}

/** Opens the collapsed Searchers panel. */
async function openSearchers(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: /^Searchers \(101\)/ });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

test.describe('Universal search — authenticated responsive discovery', () => {
  for (const viewport of VIEWPORTS) {
    test(`renders the Global_Header Search_Control at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openPlayerPage(page);

      const trigger = visibleSearchTrigger(page);
      await expect(trigger).toHaveCount(1);
      await expectMinimumTarget(trigger);

      if (viewport.width >= 1024) {
        await expect(trigger).toContainText('Search');
        // The visible accelerator follows the browser platform: macOS uses
        // Command while Linux/Windows uses Control.
        await expect(trigger.locator('kbd')).toHaveText(/^(⌘ K|Ctrl K)$/);
        expect(await trigger.evaluate((element) => element.closest('nav')?.className ?? '')).not.toContain('bottom-0');
      } else {
        await expect(trigger).toHaveAttribute('title', 'Search');
        expect(await trigger.evaluate((element) => element.closest('header') !== null)).toBe(true);
        expect(await trigger.evaluate((element) => element.closest('nav')?.className ?? '')).not.toContain('bottom-0');
        expect(await page.locator('nav').filter({ has: page.locator('button[aria-label="Open search"]') }).count()).toBeLessThanOrEqual(1);
      }

      await expectNoHorizontalOverflow(page);
    });
  }

  test('opens by pointer and Ctrl/Cmd+K, states its scope, and restores focus', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await openPlayerPage(page);

    const trigger = visibleSearchTrigger(page);
    await trigger.click();
    const dialog = searchDialog(page);
    const input = dialog.getByRole('searchbox');
    await expect(input).toBeFocused();
    await expectMinimumTarget(input);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();

    // Linux/Windows uses Ctrl+K; Meta+K is accepted as the macOS equivalent.
    await page.keyboard.press('Control+k');
    if (!(await dialog.isVisible())) {
      await page.keyboard.press('Meta+k');
    }
    await expect(dialog).toBeVisible();
    await expect(input).toBeFocused();

    const focusable = dialog.locator('button:not([disabled]), input:not([disabled])');
    const focusableCount = await focusable.count();
    for (let index = 0; index < focusableCount + 1; index += 1) {
      await page.keyboard.press('Tab');
      await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  });

  test('opens from the mobile fixed-header control and supports touch-sized interaction', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await openPlayerPage(page);

    const trigger = visibleSearchTrigger(page);
    await trigger.click();
    const dialog = searchDialog(page);
    await expect(dialog).toBeVisible();
    await expectMinimumTarget(dialog.getByRole('button', { name: 'Close search' }).first());
    await expectMinimumTarget(dialog.getByRole('searchbox'));
    await expectNoHorizontalOverflow(page);

    await dialog.getByRole('searchbox').fill('a');
    await expect(dialog.getByRole('status')).toHaveText('Type at least 2 characters to search.');
    await dialog.getByRole('searchbox').fill('at');
    await expect(dialog.getByRole('searchbox')).toHaveValue('at');
  });
});

test.describe('Universal search — states, keyboard results, history, and routing', () => {
  test.beforeEach(async ({ page }) => {
    await mockSearch(page);
    await openPlayerPage(page);
    await openSearch(page);
  });

  test('renders loading, results, too-short, empty, error, and retry states', async ({ page }) => {
    await page.unroute('**/api/search**');
    await page.route('**/api/search**', async (route) => {
      const query = new URL(route.request().url()).searchParams.get('q');
      await fulfillJson(route, query === 'zzzz' ? EMPTY_RESPONSE : SEARCH_RESPONSE);
    });
    const dialog = searchDialog(page);
    const input = dialog.getByRole('searchbox');

    await input.fill('a');
    await expect(dialog.getByRole('status')).toHaveText('Type at least 2 characters to search.');

    await input.fill('zzzz');
    await expect(dialog.getByRole('status')).toHaveText('No matches found in robots, stables, or guide articles.');

    await input.fill('Atlas');
    await expect(dialog.getByRole('status')).toHaveText('Searching robots, stables, and guide articles…');
    await expectPaletteResult(page);

    // A second route is installed only for the retry portion of this test.
    await dialog.getByRole('button', { name: 'Close search' }).click();
    await page.unroute('**/api/search**');
    let attempts = 0;
    await page.route('**/api/search**', async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await fulfillJson(route, { error: 'database details must not reach players', code: 'SEARCH_FAILED' }, 503);
      } else {
        await fulfillJson(route, SEARCH_RESPONSE);
      }
    });
    await openSearch(page);
    await dialog.getByRole('searchbox').fill('retry');
    await expect(dialog.getByRole('alert')).toContainText('Search is unavailable. Please try again.');
    await dialog.getByRole('button', { name: 'Retry search' }).click();
    await expectPaletteResult(page);
    expect(attempts).toBe(2);
  });

  test('stores, presents, selects, and clears browser-local recent history', async ({ page }) => {
    const dialog = searchDialog(page);
    const input = dialog.getByRole('searchbox');

    await input.fill('  Atlas  ');
    await input.press('Enter');
    await expect(page.evaluate(() => JSON.parse(window.localStorage.getItem('armoured-souls:recent-searches') ?? '[]'))).resolves.toEqual(['Atlas']);

    await input.fill('');
    await dialog.getByRole('button', { name: 'Close search' }).click();
    await openSearch(page);
    await expect(dialog.getByRole('heading', { name: 'Recent searches' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Use recent search Atlas' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Use recent search Atlas' }).click();
    await expect(input).toHaveValue('Atlas');
    await dialog.getByRole('button', { name: 'Clear recent searches' }).click();
    await expect(dialog.getByText('No recent searches yet.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Clear recent searches' })).not.toBeVisible();
    await expect(page.evaluate(() => window.localStorage.getItem('armoured-souls:recent-searches'))).resolves.toBeNull();
  });

  test('supports Arrow navigation, Enter activation, pointer result selection, and safe target routes', async ({ page }) => {
    const dialog = searchDialog(page);
    const input = dialog.getByRole('searchbox');
    await input.fill('Atlas');
    await expectPaletteResult(page);

    const resultButtons = dialog.getByRole('listbox').getByRole('button');
    await expect(resultButtons).toHaveCount(4);
    await expectMinimumTarget(resultButtons.first());
    await resultButtons.first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(dialog.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/robots\/43$/);
    expect(page.url()).not.toContain('Atlas');

    await openSearch(page);
    await page.getByRole('searchbox').fill('Atlas');
    await expectPaletteResult(page);
    await dialog.getByRole('button', { name: 'Guide article: Combat Basics, section Combat' }).click();
    await expect(page).toHaveURL(/\/guide\/combat\/basics$/);
  });

  test('preserves destination not-found/access behavior after selecting a result', async ({ page }) => {
    await page.unroute('**/api/search**');
    await page.route('**/api/search**', async (route) => {
      const query = new URL(route.request().url()).searchParams.get('q');
      await fulfillJson(route, query === 'missing' ? STABLE_NOT_FOUND_RESPONSE : ROBOT_ACCESS_RESPONSE);
    });
    await page.route('**/api/stables/999999', async (route) => {
      await fulfillJson(route, { error: 'stable internals', code: 'NOT_FOUND' }, 404);
    });
    await page.route('**/api/robots/999998', async (route) => {
      await fulfillJson(route, { error: 'private robot details', code: 'NOT_FOUND' }, 404);
    });

    const dialog = searchDialog(page);
    await dialog.getByRole('searchbox').fill('missing');
    const missingStable = dialog.getByRole('button', { name: 'Stable: Missing Stable' });
    await expect(missingStable).toBeVisible();
    await missingStable.click();
    await expect(page).toHaveURL(/\/stables\/999999$/);
    await expect(page.getByRole('heading', { name: 'Stable not found' })).toBeVisible();
    expect(page.url()).not.toContain('missing');

    await openSearch(page);
    await page.getByRole('searchbox').fill('restricted');
    const restrictedRobot = searchDialog(page).getByRole('button', { name: 'Robot: Restricted Robot' });
    await expect(restrictedRobot).toBeVisible();
    await restrictedRobot.click();
    await expect(page).toHaveURL(/\/robots\/999998$/);
    await expect(page.getByText('Robot not found')).toBeVisible();
  });
});

test.describe('Universal search — Player_Shell lifecycle and route boundaries', () => {
  test('keeps one player shell search control through loading, error, and not-found content', async ({ page }) => {
    await openPlayerPage(page);

    await page.route('**/api/stables/888888', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await fulfillJson(route, { error: 'stable dependency details', code: 'DEPENDENCY_FAILED' }, 500);
    });
    await page.goto('/stables/888888', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Loading stable...')).toBeVisible();
    await expect(visibleSearchTrigger(page)).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Stable not found' })).not.toBeVisible();
    await expect(page.getByText('Failed to load stable. Please try again.')).toBeVisible();
    await expect(visibleSearchTrigger(page)).toHaveCount(1);

    await page.goto('/definitely-not-a-player-route', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(visibleSearchTrigger(page)).toHaveCount(1);
    await expect(searchDialog(page)).not.toBeVisible();
  });

  test('excludes onboarding, auth/front-page, and player surfaces from admin analytics', async ({ page }) => {
    const browser = page.context().browser();
    expect(browser).not.toBeNull();
    const publicContext = await browser!.newContext({ storageState: { cookies: [], origins: [] } });
    const publicPage = await publicContext.newPage();
    await publicPage.addInitScript(() => {
      window.localStorage.removeItem('armoured-souls:recent-searches');
    });
    try {
      for (const path of ['/', '/login', '/register']) {
        await publicPage.goto(path, { waitUntil: 'domcontentloaded' });
        await publicPage.waitForTimeout(250);
        await expect(publicPage.locator('button[aria-label="Open search"]:visible')).toHaveCount(0);
        await expect(publicPage.getByRole('dialog', { name: 'Search' })).not.toBeVisible();
      }
    } finally {
      await publicContext.close();
    }

    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    await expect(page.locator('button[aria-label="Open search"]:visible')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Search' })).not.toBeVisible();

    const adminRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/admin/search-analytics/report')) adminRequests.push(request.url());
    });
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(visibleSearchTrigger(page)).toBeVisible();
    await expect(page.getByText('Search Analytics')).not.toBeVisible();
    expect(adminRequests).toHaveLength(0);
  });

  test('non-admin players cannot enter the Search Analytics admin route', async ({ page }) => {
    await page.goto('/admin/search-analytics', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Search Analytics' })).not.toBeVisible();
    await expect(visibleSearchTrigger(page)).toBeVisible();
  });
});

test.describe('Universal search — request isolation', () => {
  test('uses one player search request, isolates response and telemetry, and keeps query out of routes/logs', async ({ page }) => {
    const rawQuery = '  private phrase  ';
    const normalizedQuery = rawQuery.trim();
    const searchRequests: Array<{ url: string; postData: string | null }> = [];
    const selectionRequests: Array<{ url: string; method: string; postData: string | null }> = [];
    const guideSearchRequests: string[] = [];
    const adminRequests: string[] = [];
    const requestUrls: string[] = [];
    const consoleMessages: string[] = [];
    const navigatedUrls: string[] = [];
    const playerResponseBodies: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      const pathname = new URL(url).pathname;
      requestUrls.push(url);
      if (pathname === '/api/search') {
        searchRequests.push({ url, postData: request.postData() });
      }
      if (pathname === '/api/search/selection') {
        selectionRequests.push({ url, method: request.method(), postData: request.postData() });
      }
      if (pathname.startsWith('/api/guide')) guideSearchRequests.push(url);
      if (pathname === '/api/admin/search-analytics/report') adminRequests.push(url);
    });
    page.on('response', (response) => {
      if (new URL(response.url()).pathname !== '/api/search') return;
      void response.text().then((body) => playerResponseBodies.push(body)).catch(() => undefined);
    });
    page.on('console', (message) => consoleMessages.push(message.text()));
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigatedUrls.push(frame.url());
    });

    await mockSearch(page);
    await openPlayerPage(page);
    await openSearch(page);

    const dialog = searchDialog(page);
    await dialog.getByRole('searchbox').fill(rawQuery);
    await expectPaletteResult(page);
    await expect(dialog.getByRole('listbox').getByRole('button')).toHaveCount(4);

    expect(searchRequests).toHaveLength(1);
    const playerSearchRequest = searchRequests[0];
    expect(playerSearchRequest).toBeDefined();
    if (!playerSearchRequest) return;

    const searchUrl = new URL(playerSearchRequest.url);
    expect(playerSearchRequest.postData).toBeNull();
    expect(searchUrl.pathname).toBe('/api/search');
    expect([...searchUrl.searchParams.keys()]).toEqual(['q']);
    expect(searchUrl.searchParams.get('q')).toBe(normalizedQuery);
    expect(guideSearchRequests).toHaveLength(0);
    expect(adminRequests).toHaveLength(0);

    // Search history, keystrokes and typing are client-only and never create
    // another request. Opening a result sends exactly one category-only
    // selection request (contract §8.4), asserted after the click below.
    expect(selectionRequests).toHaveLength(0);
    const forbiddenSearchEventRequests = requestUrls.filter((url) => {
      const pathname = new URL(url).pathname;
      if (pathname === '/api/search' || pathname === '/api/admin/search-analytics/report') return false;
      return /\/api\/(?:search|analytics|telemetry)(?:[/_-])/i.test(pathname)
        && /(?:history|selection|category|keystroke|analytics|event|track)/i.test(pathname);
    });
    expect(forbiddenSearchEventRequests).toEqual([]);

    await expect.poll(() => playerResponseBodies.length).toBe(1);
    const playerResponse = JSON.parse(playerResponseBodies[0] ?? 'null') as SearchResponse;
    expect(playerResponse).toEqual(SEARCH_RESPONSE);
    expect(playerResponse).not.toHaveProperty('analytics');
    expect(playerResponse).not.toHaveProperty('normalizedQuery');
    expect(JSON.stringify(playerResponse)).not.toContain(normalizedQuery);

    const nonSearchRequestUrls = requestUrls.filter((url) => new URL(url).pathname !== '/api/search');
    for (const requestUrl of nonSearchRequestUrls) {
      expect(decodeURIComponent(requestUrl)).not.toContain(normalizedQuery);
    }
    expect(consoleMessages.join('\n')).not.toContain(rawQuery);
    expect(consoleMessages.join('\n')).not.toContain(normalizedQuery);

    const result = dialog.getByRole('button', { name: 'Robot: Atlas', exact: true });
    await result.click();
    await expect(page).toHaveURL(/\/robots\/42$/);
    expect(page.url()).not.toContain(rawQuery);
    expect(page.url()).not.toContain(normalizedQuery);
    expect(await page.locator('body').innerText()).not.toContain(normalizedQuery);
    expect(searchRequests).toHaveLength(1);
    expect(adminRequests).toHaveLength(0);

    // The selection carries the category and nothing else: no query, id,
    // label, position or route, in the body or the URL.
    await expect.poll(() => selectionRequests.length).toBe(1);
    const selection = selectionRequests[0];
    expect(selection?.method).toBe('POST');
    expect(JSON.parse(selection?.postData ?? 'null')).toEqual({ category: 'robots' });
    expect(new URL(selection?.url ?? 'http://x').search).toBe('');
    expect(decodeURIComponent(selection?.postData ?? '')).not.toContain(normalizedQuery);

    for (const navigatedUrl of navigatedUrls) {
      const decodedUrl = decodeURIComponent(navigatedUrl);
      expect(decodedUrl).not.toContain(rawQuery);
      expect(decodedUrl).not.toContain(normalizedQuery);
    }
  });
});

test.describe('Search Analytics admin portal', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAndGoToDashboard(page, 'admin', 'admin123');
  });

  test('authorizes admins, shows active-season report fields, and paginates safely', async ({ page }) => {
    const requests = await mockAdminReport(page);
    await page.goto('/admin/search-analytics', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('search-analytics-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Search Analytics' })).toBeVisible();
    await expect(page.getByText('Season 8 · cycles 18–24')).toBeVisible();

    // Default scope: last 7 cycles resolved on the server, settled counting.
    await expect.poll(() => requests.report.some((url) => url.includes('lastCycles=7') && url.includes('mode=settled'))).toBe(true);
    await expect(page.getByRole('region', { name: 'How searches are counted' })).toContainText('120 of 300 requests');
    const totals = page.getByRole('region', { name: 'Search totals' });
    await expect(totals).toContainText('120');
    await expect(totals).toContainText('Includes 1 admin account');

    const phrases = page.getByRole('region', { name: 'Phrases' });
    await expect(phrases.getByText('admin-only phrase')).toBeVisible();
    await expect(phrases.getByText('missing guide')).toBeVisible();
    const categories = page.getByRole('region', { name: 'Results by category' });
    await expect(categories.getByText('Robots', { exact: true })).toBeVisible();
    await expect(categories.getByText('Stables', { exact: true })).toBeVisible();
    await expect(categories.getByText('Guide articles', { exact: true })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Reporting limitations' })).toContainText('Some telemetry may be missing.');

    // A custom range replaces the preset in both requests.
    await page.getByRole('button', { name: /^Custom/ }).click();
    await page.getByLabel('From cycle').fill('5');
    await page.getByLabel('To cycle').fill('20');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    const customScope = (url: string): boolean => url.includes('cycleFrom=5') && url.includes('cycleTo=20') && !url.includes('lastCycles');
    await expect.poll(() => requests.report.some(customScope)).toBe(true);
    await expect.poll(() => requests.phrases.some(customScope)).toBe(true);

    await openSearchers(page);
    await expect(page.getByRole('link', { name: 'North Star' })).toBeVisible();
    await expect(page.getByText('1–25 of 101 players')).toBeVisible();
    await page.getByRole('button', { name: 'Next page of players' }).click();
    await expect(page.getByRole('link', { name: 'East Wind' })).toBeVisible();
    await expect(page.getByText('26–50 of 101 players')).toBeVisible();
    expect(requests.report.some((url) => url.includes('page=2'))).toBe(true);

    // Admin pages are a separate layout, never the player shell/palette.
    await expect(page.locator('button[aria-label="Open search"]:visible')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Search' })).not.toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('stacks filters and report sections below 1024px with touch-sized controls', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    const requests = await mockAdminReport(page);
    await page.goto('/admin/search-analytics', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('search-analytics-page')).toBeVisible();
    await expect(page.getByText('Season 8 · cycles 18–24')).toBeVisible();

    // Period presets, counting toggle and the custom range are touch-sized.
    for (const name of ['This cycle', 'Last 7 cycles', 'Whole season', 'Custom…']) {
      await expectMinimumTarget(page.getByRole('button', { name, exact: true }));
    }
    await expectMinimumTarget(page.getByRole('button', { name: 'Settled', exact: true }));
    await expectMinimumTarget(page.getByRole('button', { name: 'All requests', exact: true }));
    await page.getByRole('button', { name: 'Custom…', exact: true }).click();
    await expectMinimumTarget(page.getByLabel('From cycle'));
    await expectMinimumTarget(page.getByLabel('To cycle'));
    await expectMinimumTarget(page.getByRole('button', { name: 'Apply', exact: true }));

    // Report sections stack in one column.
    const chartBox = await page.getByRole('region', { name: 'Searches per cycle' }).boundingBox();
    const categoryBox = await page.getByRole('region', { name: 'Results by category' }).boundingBox();
    const phraseBox = await page.getByRole('region', { name: 'Phrases' }).boundingBox();
    expect(chartBox).not.toBeNull();
    expect(categoryBox).not.toBeNull();
    expect(phraseBox).not.toBeNull();
    expect(categoryBox?.y ?? 0).toBeGreaterThan((chartBox?.y ?? 0) + (chartBox?.height ?? 0) - 1);
    expect(phraseBox?.y ?? 0).toBeGreaterThan((categoryBox?.y ?? 0) + (categoryBox?.height ?? 0) - 1);
    expect(Math.abs((categoryBox?.x ?? 0) - (chartBox?.x ?? 0))).toBeLessThanOrEqual(1);

    // Below md the phrase table switches column sets instead of scrolling.
    const phrases = page.getByRole('region', { name: 'Phrases' });
    await expect(phrases.getByRole('columnheader', { name: 'No-result' })).not.toBeVisible();
    await expectMinimumTarget(phrases.getByRole('button', { name: 'Quality', exact: true }));
    await phrases.getByRole('button', { name: 'Quality', exact: true }).click();
    await expect(phrases.getByRole('columnheader', { name: 'No-result' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await openSearchers(page);
    const next = page.getByRole('button', { name: 'Next page of players' });
    await expectMinimumTarget(next);
    await next.click();
    await expect(page.getByRole('link', { name: 'East Wind' })).toBeVisible();
    expect(requests.report.some((url) => url.includes('page=2'))).toBe(true);
    await expectNoHorizontalOverflow(page);
  });

  test('does not expose admin phrases or category report data on player surfaces', async ({ page }) => {
    const playerRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/admin/search-analytics/report')) playerRequests.push(request.url());
    });

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(visibleSearchTrigger(page)).toBeVisible();
    await expect(page.getByText('Search Analytics')).not.toBeVisible();
    await expect(page.getByText('admin-only phrase')).not.toBeVisible();
    await expect(page.getByText('analyticsDataIncomplete:')).not.toBeVisible();
    expect(playerRequests).toHaveLength(0);
  });
});
