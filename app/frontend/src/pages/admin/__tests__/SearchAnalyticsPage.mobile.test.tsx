/**
 * Search Analytics responsive contract (UNIVERSAL_SEARCH_CONTRACT §10):
 * sections stack below 1024px, controls keep 44px touch targets, and nothing
 * forces horizontal overflow at 320/375/768/1023/1024/1920px.
 *
 * jsdom does not lay out CSS, so class assertions carry the responsive
 * contract; real dimensions are checked whenever the environment provides them.
 * Real-browser screenshots are part of the manual verification.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import SearchAnalyticsPage from '../SearchAnalyticsPage';
import { ApiError } from '../../../utils/ApiError';
import { makePhrases, makeReport } from './searchAnalyticsFixtures';

const mockGetReport = vi.hoisted(() => vi.fn());
const mockGetPhrases = vi.hoisted(() => vi.fn());

vi.mock('../../../utils/adminSearchAnalyticsApi', () => ({
  getAdminSearchAnalyticsReport: mockGetReport,
  getAdminSearchAnalyticsPhrases: mockGetPhrases,
  downloadAdminSearchAnalyticsPhrasesCsv: vi.fn(),
}));

vi.mock('recharts', () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Empty = () => null;
  return {
    ResponsiveContainer: Box, ComposedChart: Box, Bar: Empty, Line: Empty, XAxis: Empty, YAxis: Empty,
    CartesianGrid: Empty, Tooltip: Empty, Legend: Empty,
  };
});

const REQUIRED_VIEWPORTS = [320, 375, 768, 1023, 1024, 1920] as const;
const MOBILE_VIEWPORTS = REQUIRED_VIEWPORTS.filter((width) => width < 1024);
const MIN_TOUCH_TARGET = 44;

function setViewport(width: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/search-analytics']}>
      <SearchAnalyticsPage />
    </MemoryRouter>,
  );
}

function expectNoHorizontalOverflow(container: HTMLElement, viewport: number): void {
  expect(screen.getByTestId('search-analytics-page')).toHaveClass('min-w-0', 'max-w-full', 'overflow-x-hidden');

  for (const element of container.querySelectorAll<HTMLElement>('*')) {
    const fixedWidth = element.className && typeof element.className === 'string'
      ? element.className.match(/(?:^|\s)w-\[(\d+)px\](?:\s|$)/)
      : null;
    if (fixedWidth) expect(Number(fixedWidth[1])).toBeLessThanOrEqual(viewport);

    const { clientWidth, scrollWidth } = element;
    if (clientWidth > 0 || scrollWidth > 0) expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  }
}

function expectTouchTarget(element: HTMLElement): void {
  expect(element).toHaveClass('min-h-11');
  const bounds = element.getBoundingClientRect();
  if (bounds.height > 0) expect(bounds.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
}

describe('SearchAnalyticsPage responsive layout', () => {
  beforeEach(() => {
    mockGetReport.mockReset();
    mockGetPhrases.mockReset();
    mockGetReport.mockResolvedValue(makeReport({
      playerAnalysis: { entries: makeReport().playerAnalysis.entries, page: 1, limit: 25, total: 60 },
    }));
    mockGetPhrases.mockResolvedValue(makePhrases({ total: 60 }));
  });

  afterEach(() => {
    cleanup();
  });

  it.each(MOBILE_VIEWPORTS)('stacks sections below 1024px and switches phrase columns at %spx', async (width) => {
    setViewport(width);
    const { container } = renderPage();
    await screen.findByRole('table', { name: 'Searched phrases' });

    expect(screen.getByRole('region', { name: 'Search totals' }).firstElementChild).toHaveClass('grid-cols-2', 'xl:grid-cols-4');
    const chartRegion = screen.getByRole('region', { name: 'Searches per cycle' });
    expect(chartRegion.parentElement).toHaveClass('grid', 'xl:grid-cols-[minmax(0,8fr)_minmax(0,5fr)]');
    // Quality columns are hidden below md until the toggle switches to them.
    expect(screen.getByRole('columnheader', { name: 'No-result' })).toHaveClass('hidden', 'md:table-cell');
    expect(screen.getByRole('columnheader', { name: 'Searches' })).toHaveClass('table-cell');
    expectNoHorizontalOverflow(container, width);
  });

  it.each(REQUIRED_VIEWPORTS)('does not introduce forced horizontal overflow at %spx', async (width) => {
    setViewport(width);
    const { container } = renderPage();

    await screen.findByRole('table', { name: 'Searched phrases' });
    expectNoHorizontalOverflow(container, width);
  });

  it('keeps every page control at least 44px high', async () => {
    setViewport(375);
    renderPage();
    await screen.findByRole('table', { name: 'Searched phrases' });

    for (const name of ['This cycle', 'Last 7 cycles', 'Whole season', 'Custom…', 'Settled', 'All requests', 'All phrases', 'No results', 'Export CSV', 'Volume', 'Quality', 'View as table']) {
      expectTouchTarget(screen.getByRole('button', { name }));
    }
    expectTouchTarget(screen.getByRole('button', { name: /Refresh/ }));
    expectTouchTarget(screen.getByLabelText('Filter phrases'));
    const pagination = screen.getByRole('navigation', { name: 'Phrase table pagination' });
    expectTouchTarget(within(pagination).getByRole('button', { name: 'Next page of phrases' }));
  });

  it.each(MOBILE_VIEWPORTS)('keeps the retry control touch-friendly at %spx', async (width) => {
    setViewport(width);
    mockGetReport.mockReset();
    mockGetReport.mockRejectedValue(new ApiError('backend detail', 'SEARCH_ANALYTICS_ERROR', 500));
    renderPage();

    const retry = await screen.findByRole('button', { name: 'Retry' });
    expectTouchTarget(retry);
    expect(screen.getByTestId('search-analytics-page')).toHaveClass('overflow-x-hidden');
  });
});
