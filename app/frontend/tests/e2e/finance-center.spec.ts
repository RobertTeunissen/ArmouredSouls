import { expect, test } from '@playwright/test';
import { navigateToProtectedPage } from './helpers/navigate';
import {
  HISTORY_RESPONSE,
  OVERVIEW_RESPONSE,
  ROBOT_DETAIL_RESPONSE,
  ROBOT_SUMMARY_RESPONSE,
} from '../../src/components/finance/__tests__/fixtures';

async function stubFinanceCenter(page: import('@playwright/test').Page): Promise<string[]> {
  const requests: string[] = [];
  const overview = {
    ...OVERVIEW_RESPONSE,
    period: { ...OVERVIEW_RESPONSE.period, activeCycle: 12, fromCycle: 12, toCycle: 12 },
  };

  await page.route('**/api/user/profile', async (route) => {
    await route.fulfill({
      json: {
        id: 1,
        username: 'test_user_001',
        email: null,
        role: 'user',
        currency: 134000,
        prestige: 1200,
        stableName: 'Finance Test Stable',
      },
    });
  });

  await page.route('**/api/finances/**', async (route) => {
    const url = route.request().url();
    requests.push(url);
    if (/\/robots\/\d+\/events/.test(url)) {
      await route.fulfill({ json: ROBOT_DETAIL_RESPONSE });
    } else if (/\/api\/finances\/robots(?:\?|$)/.test(url)) {
      await route.fulfill({ json: ROBOT_SUMMARY_RESPONSE });
    } else if (/\/api\/finances\/history(?:\?|$)/.test(url)) {
      await route.fulfill({ json: HISTORY_RESPONSE });
    } else if (/\/api\/finances\/report(?:\?|$)/.test(url)) {
      await route.fulfill({ json: overview });
    } else {
      await route.continue();
    }
  });
  return requests;
}

test.describe('Finance Center', () => {
  test('redirects legacy routes and translates a valid lastNCycles range', async ({ page }) => {
    await stubFinanceCenter(page);
    await navigateToProtectedPage(page, '/finances?tab=robots');
    await expect(page).toHaveURL(/\/income\?tab=robots/);

    await navigateToProtectedPage(page, '/cycle-summary?lastNCycles=10');
    await expect(page).toHaveURL(/\/income\?tab=history&scope=custom&fromCycle=2&toCycle=11/);
  });

  test('loads overview first, then lazy panels, with keyboard tabs', async ({ page }) => {
    const requests = await stubFinanceCenter(page);
    await navigateToProtectedPage(page, '/income');
    await expect(page.getByRole('heading', { name: 'Finance Center' })).toBeVisible();
    await expect(page.getByText(/Preparation · Provisional/)).toBeVisible();
    expect(requests.filter((url) => url.includes('/api/finances/report')).length).toBe(1);
    expect(requests.some((url) => url.includes('/api/finances/history'))).toBe(false);
    expect(requests.some((url) => /\/api\/finances\/robots/.test(url))).toBe(false);

    const overviewTab = page.getByRole('tab', { name: 'Overview' });
    await overviewTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Net cash movement by cycle' })).toBeVisible();
    expect(requests.some((url) => url.includes('/api/finances/history'))).toBe(true);

    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Robot deployment' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Atlas' })).toBeVisible();
  });

  test('shows page/full-period separation and lazy robot detail', async ({ page }) => {
    const requests = await stubFinanceCenter(page);
    await navigateToProtectedPage(page, '/income?tab=robots');
    await expect(page.getByRole('heading', { name: 'Atlas' })).toBeVisible();
    expect(requests.some((url) => /\/robots\/7\/events/.test(url))).toBe(false);
    await page.getByRole('button', { name: 'View details' }).click();
    await expect(page.getByText(/transport slice/)).toBeVisible();
    await expect(page.getByText(/Page 1 of 2/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage subscriptions' })).toBeVisible();
    expect(requests.some((url) => /\/robots\/7\/events/.test(url))).toBe(true);
  });

  test('includes the provisional active point for season to date history', async ({ page }) => {
    await stubFinanceCenter(page);
    await navigateToProtectedPage(page, '/income?tab=history&scope=season_to_date');
    await expect(page.getByRole('heading', { name: 'Net cash movement by cycle' })).toBeVisible();
    const historyPanel = page.getByRole('tabpanel', { name: 'History' });
    await expect(historyPanel.getByRole('button', { name: /partial and provisional/ })).toBeVisible();
    await expect(historyPanel.getByText(/Provisional and asymmetric/)).toBeVisible();
  });

  test('has no page overflow and keeps all finance controls readable from 320px to desktop', async ({ page }) => {
    await stubFinanceCenter(page);
    for (const width of [320, 375, 768, 1023, 1024, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await navigateToProtectedPage(page, '/income');
      await expect(page.getByRole('heading', { name: 'Finance Center' })).toBeVisible();
      const overviewOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overviewOverflow).toBeLessThanOrEqual(0);
      const tabBox = await page.getByRole('tab', { name: 'Overview' }).boundingBox();
      expect(tabBox?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(tabBox?.width ?? 0).toBeGreaterThanOrEqual(44);
      await expect(page.getByText('Investment purchases', { exact: true }).first()).toBeVisible();

      await page.getByRole('tab', { name: 'Robot deployment' }).click();
      const robotPanel = page.getByRole('tabpanel', { name: 'Robot deployment' });
      await expect(robotPanel.getByRole('heading', { name: 'Atlas' })).toBeVisible();
      for (const label of ['Fought matches', 'Battle/bye income', 'Streaming revenue', 'Actual repair spend', 'Direct net']) {
        await expect(robotPanel.getByText(label, { exact: true })).toBeVisible();
      }
      await robotPanel.getByRole('button', { name: 'View details' }).click();
      await expect(robotPanel.getByText(/Page 1 of 2/)).toBeVisible();
      await expect(robotPanel.getByText(/transport slice/)).toBeVisible();
      const nextBox = await robotPanel.getByRole('button', { name: 'Next' }).boundingBox();
      expect(nextBox?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(nextBox?.width ?? 0).toBeGreaterThanOrEqual(44);
      const detailOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(detailOverflow).toBeLessThanOrEqual(0);
    }
  });
});
