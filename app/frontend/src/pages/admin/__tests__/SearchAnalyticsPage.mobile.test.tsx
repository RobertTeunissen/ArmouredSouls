import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import SearchAnalyticsPage from '../SearchAnalyticsPage';
import type { AdminSearchAnalyticsReport } from '../../../utils/adminSearchAnalyticsApi';
import { ApiError } from '../../../utils/ApiError';

const mockGetReport = vi.hoisted(() => vi.fn());

vi.mock('../../../utils/adminSearchAnalyticsApi', () => ({
  getAdminSearchAnalyticsReport: mockGetReport,
}));

const REQUIRED_VIEWPORTS = [320, 375, 768, 1023, 1024, 1920] as const;
const MOBILE_VIEWPORTS = REQUIRED_VIEWPORTS.filter((width) => width < 1024);
const MIN_TOUCH_TARGET = 44;

const REPORT: AdminSearchAnalyticsReport = {
  period: { seasonNumber: 8, cycleNumber: 24, cycleFrom: null, cycleTo: null },
  overview: { totalSearches: 120, uniqueSearchers: 18, noResultSearches: 9 },
  trends: [
    { cycleNumber: 24, totalSearches: 120, uniqueSearchers: 18, noResultSearches: 9 },
  ],
  topPhrases: [{ phrase: 'atlas', count: 40 }],
  noResultPhrases: [{ phrase: 'missing guide', count: 9 }],
  categoryUsage: { robots: 60, stables: 35, guide: 16 },
  playerAnalysis: {
    entries: Array.from({ length: 51 }, (_, index) => ({
      userId: index + 1,
      stableName: `Stable ${index + 1}`,
      searchCount: index + 1,
      noResultCount: 0,
    })),
    page: 1,
    limit: 50,
    total: 51,
  },
  limitations: [],
};

function setViewport(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

/**
 * jsdom does not calculate CSS layout, so class assertions carry the responsive
 * contract while real dimensions are checked whenever the environment provides them.
 */
function expectNoHorizontalOverflow(container: HTMLElement, viewport: number): void {
  const page = screen.getByTestId('search-analytics-page');
  expect(page).toHaveClass('min-w-0', 'max-w-full', 'overflow-x-hidden');

  for (const element of container.querySelectorAll<HTMLElement>('*')) {
    const fixedWidth = element.className.match(/(?:^|\s)w-\[(\d+)px\](?:\s|$)/);
    if (fixedWidth) {
      expect(Number(fixedWidth[1])).toBeLessThanOrEqual(viewport);
    }

    const { clientWidth, scrollWidth } = element;
    if (clientWidth > 0 || scrollWidth > 0) {
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    }
  }
}

function expectTouchTarget(element: HTMLElement, requireWidth = false): void {
  expect(element).toHaveClass('min-h-11');

  if (requireWidth) {
    expect(element).toHaveClass('min-w-11');
  }

  const bounds = element.getBoundingClientRect();
  if (bounds.height > 0) {
    expect(bounds.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  }
  if (bounds.width > 0) {
    expect(bounds.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  }
}

describe('SearchAnalyticsPage mobile layout', () => {
  beforeEach(() => {
    mockGetReport.mockReset();
    mockGetReport.mockResolvedValue(REPORT);
  });

  afterEach(() => {
    cleanup();
  });

  it.each(MOBILE_VIEWPORTS)('stacks report sections and controls below 1024px at %spx', async (width) => {
    setViewport(width);
    const { container } = render(<SearchAnalyticsPage />);
    const page = await screen.findByTestId('search-analytics-page');

    expect(page).toHaveClass('space-y-6');
    expect(screen.getByTestId('search-analytics-filters')).toHaveClass('flex-col', 'lg:flex-row');
    expect(screen.getByTestId('search-analytics-stats')).toHaveClass('grid-cols-1', 'lg:grid-cols-4');
    expect(screen.getByTestId('search-analytics-category-usage')).toHaveClass('grid-cols-1', 'lg:grid-cols-3');
    expect(screen.getByRole('navigation', { name: 'Player analysis pagination' })).toHaveClass('flex-col', 'lg:flex-row');

    const phraseGrid = screen.getByRole('heading', { name: 'Top phrases' }).closest('div.grid');
    expect(phraseGrid).not.toBeNull();
    expect(phraseGrid).toHaveClass('grid-cols-1', 'xl:grid-cols-2');

    expect(screen.getByRole('heading', { name: 'Cycle trends' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Player and stable analysis' })).toBeInTheDocument();
    expectNoHorizontalOverflow(container, width);
  });

  it.each(REQUIRED_VIEWPORTS)('does not introduce forced horizontal overflow at %spx', async (width) => {
    setViewport(width);
    const { container } = render(<SearchAnalyticsPage />);

    await screen.findByTestId('search-analytics-page');
    expectNoHorizontalOverflow(container, width);
  });

  it('keeps filter, refresh, pagination, and navigation controls at least 44px high', async () => {
    setViewport(375);
    render(<SearchAnalyticsPage />);

    await screen.findByTestId('search-analytics-page');
    expectTouchTarget(screen.getByLabelText('Filter from cycle'));
    expectTouchTarget(screen.getByLabelText('Filter to cycle'));
    expectTouchTarget(screen.getByRole('button', { name: 'Apply filters' }));
    expectTouchTarget(screen.getByRole('button', { name: '↻ Refresh' }));

    const pagination = screen.getByRole('navigation', { name: 'Player analysis pagination' });
    expect(pagination).toHaveClass('flex-col', 'lg:flex-row');
    expectTouchTarget(screen.getByRole('button', { name: 'Previous player analysis page' }), true);
    expectTouchTarget(screen.getByRole('button', { name: 'Next player analysis page' }), true);
  });

  it.each(MOBILE_VIEWPORTS)('keeps the retry control touch-friendly at %spx', async (width) => {
    setViewport(width);
    mockGetReport.mockReset();
    mockGetReport.mockRejectedValue(new ApiError('backend detail', 'SEARCH_ANALYTICS_ERROR', 500));
    render(<SearchAnalyticsPage />);

    const retry = await screen.findByRole('button', { name: 'Retry' });
    expectTouchTarget(retry);
    expect(screen.getByTestId('search-analytics-page')).toHaveClass('overflow-x-hidden');
  });
});
