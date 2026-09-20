import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SearchAnalyticsPage from '../SearchAnalyticsPage';
import type { AdminSearchAnalyticsReport } from '../../../utils/adminSearchAnalyticsApi';
import { ApiError } from '../../../utils/ApiError';

const mockGetReport = vi.hoisted(() => vi.fn());

vi.mock('../../../utils/adminSearchAnalyticsApi', () => ({
  getAdminSearchAnalyticsReport: mockGetReport,
}));

const REPORT: AdminSearchAnalyticsReport = {
  period: { seasonNumber: 8, cycleNumber: 24, cycleFrom: null, cycleTo: null },
  overview: { totalSearches: 120, uniqueSearchers: 18, noResultSearches: 9 },
  trends: [
    { cycleNumber: 23, totalSearches: 80, uniqueSearchers: 14, noResultSearches: 4 },
    { cycleNumber: 24, totalSearches: 120, uniqueSearchers: 18, noResultSearches: 9 },
  ],
  topPhrases: [
    { phrase: 'atlas', count: 40 },
    { phrase: 'north star', count: 21 },
  ],
  noResultPhrases: [
    { phrase: 'missing guide', count: 9 },
    { phrase: 'unknown robot', count: 3 },
  ],
  categoryUsage: { robots: 60, stables: 35, guide: 16 },
  playerAnalysis: {
    entries: [
      { userId: 42, stableName: 'North Star', searchCount: 12, noResultCount: 2 },
      { userId: 7, stableName: null, searchCount: 4, noResultCount: 1 },
    ],
    page: 1,
    limit: 50,
    total: 101,
  },
  limitations: [{ code: 'analyticsDataIncomplete', message: 'Some telemetry may be missing.' }],
};

const REPORT_PAGE_2: AdminSearchAnalyticsReport = {
  ...REPORT,
  playerAnalysis: {
    ...REPORT.playerAnalysis,
    entries: [{ userId: 63, stableName: 'East Wind', searchCount: 8, noResultCount: 0 }],
    page: 2,
  },
};

const REPORT_WITH_UNSAFE_EXTRA_DATA = {
  ...REPORT,
  rawEvents: [{ eventId: 'event-raw-1', payload: { normalizedPhrase: 'secret phrase' } }],
  playerSearchResponse: {
    robots: [{ id: 99, name: 'Private Robot', targetRoute: '/robots/99' }],
    stables: [],
    guide: [],
  },
} as unknown as AdminSearchAnalyticsReport;

describe('SearchAnalyticsPage', () => {
  beforeEach(() => {
    mockGetReport.mockReset();
    mockGetReport.mockResolvedValue(REPORT);
  });

  it('renders a loading state while the admin report request is pending', async () => {
    let resolveReport!: (report: AdminSearchAnalyticsReport) => void;
    const pendingReport = new Promise<AdminSearchAnalyticsReport>((resolve) => {
      resolveReport = resolve;
    });
    mockGetReport.mockReset();
    mockGetReport.mockReturnValueOnce(pendingReport);

    render(<SearchAnalyticsPage />);

    expect(screen.getByText('Loading search analytics…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();

    resolveReport(REPORT);
    await waitFor(() => expect(screen.getByText('atlas')).toBeInTheDocument());
  });

  it('renders active-season totals, trends, phrases, category usage, and typed limitations', async () => {
    render(<SearchAnalyticsPage />);

    await screen.findByText('Search Analytics');
    const stats = screen.getByTestId('search-analytics-stats');
    expect(within(stats).getByText('120')).toBeInTheDocument();
    expect(within(stats).getByText('18')).toBeInTheDocument();
    expect(within(stats).getByText('9')).toBeInTheDocument();
    expect(within(stats).getByText('24')).toBeInTheDocument();
    expect(screen.getByText('Season 8 · Current cycle 24')).toBeInTheDocument();

    const trends = screen.getByRole('heading', { name: 'Cycle trends' }).closest('section');
    expect(trends).not.toBeNull();
    expect(within(trends as HTMLElement).getByText('#23')).toBeInTheDocument();
    expect(within(trends as HTMLElement).getByText('#24')).toBeInTheDocument();
    expect(within(trends as HTMLElement).getByText('80')).toBeInTheDocument();
    expect(within(trends as HTMLElement).getByText('14')).toBeInTheDocument();

    const topPhrases = screen.getByRole('list', { name: 'Top phrases list' });
    const noResultPhrases = screen.getByRole('list', { name: 'No-result phrases list' });
    expect(within(topPhrases).getByText('atlas')).toBeInTheDocument();
    expect(within(topPhrases).getByText('north star')).toBeInTheDocument();
    expect(within(noResultPhrases).getByText('missing guide')).toBeInTheDocument();
    expect(within(noResultPhrases).getByText('unknown robot')).toBeInTheDocument();

    const categoryUsage = screen.getByTestId('search-analytics-category-usage');
    expect(within(categoryUsage).getByText('Robots')).toBeInTheDocument();
    expect(within(categoryUsage).getByText('60')).toBeInTheDocument();
    expect(within(categoryUsage).getByText('Stables')).toBeInTheDocument();
    expect(within(categoryUsage).getByText('35')).toBeInTheDocument();
    expect(within(categoryUsage).getByText('Guide articles')).toBeInTheDocument();
    expect(within(categoryUsage).getByText('16')).toBeInTheDocument();

    expect(screen.getByText('analyticsDataIncomplete:')).toBeInTheDocument();
    expect(screen.getByText('Some telemetry may be missing.')).toBeInTheDocument();
  });

  it('applies validated active-season cycle filters and resets pagination to page one', async () => {
    render(<SearchAnalyticsPage />);
    await waitFor(() => expect(mockGetReport).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Filter from cycle'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Filter to cycle'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => {
      expect(mockGetReport).toHaveBeenLastCalledWith(
        { cycleFrom: 5, cycleTo: 20, page: 1, limit: 50 },
        expect.any(AbortSignal),
      );
    });
  });

  it('rejects an invalid cycle range without making another report request', async () => {
    render(<SearchAnalyticsPage />);
    await waitFor(() => expect(mockGetReport).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Filter from cycle'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Filter to cycle'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(screen.getByRole('alert')).toHaveTextContent('starting cycle cannot be greater');
    expect(mockGetReport).toHaveBeenCalledTimes(1);
  });

  it('loads the bounded next player-analysis page with the existing limit', async () => {
    mockGetReport.mockReset();
    mockGetReport.mockResolvedValueOnce(REPORT).mockResolvedValueOnce(REPORT_PAGE_2);
    render(<SearchAnalyticsPage />);

    await screen.findByText('North Star');
    expect(screen.getByText('Page 1 of 3 (101 players)')).toBeInTheDocument();
    expect(screen.getByText('User #7')).toBeInTheDocument();
    expect(screen.getByText('Unnamed stable')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next player analysis page' }));

    await waitFor(() => {
      expect(mockGetReport).toHaveBeenLastCalledWith(
        { page: 2, limit: 50 },
        expect.any(AbortSignal),
      );
      expect(screen.getByText('East Wind')).toBeInTheDocument();
    });
    expect(screen.getByText('Page 2 of 3 (101 players)')).toBeInTheDocument();
  });

  it('retries a failed report with a player-safe message and preserves active filters', async () => {
    mockGetReport.mockReset();
    mockGetReport
      .mockResolvedValueOnce(REPORT)
      .mockRejectedValueOnce(new ApiError('backend detail', 'SEARCH_ANALYTICS_ERROR', 500))
      .mockResolvedValueOnce(REPORT);
    render(<SearchAnalyticsPage />);

    await screen.findByText('North Star');
    fireEvent.change(screen.getByLabelText('Filter from cycle'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Filter to cycle'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load search analytics. Try again.');
    expect(screen.queryByText('backend detail')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(mockGetReport).toHaveBeenLastCalledWith(
        { cycleFrom: 5, cycleTo: 20, page: 1, limit: 50 },
        expect.any(AbortSignal),
      );
      expect(screen.getByText('atlas')).toBeInTheDocument();
    });
  });

  it('renders only safe player/stable fields and does not render raw events or player Search_Response data', async () => {
    mockGetReport.mockReset();
    mockGetReport.mockResolvedValueOnce(REPORT_WITH_UNSAFE_EXTRA_DATA);
    render(<SearchAnalyticsPage />);

    await screen.findByText('North Star');
    expect(screen.getByText('User #42')).toBeInTheDocument();
    expect(screen.getByText('Unnamed stable')).toBeInTheDocument();
    const playerAnalysis = screen.getByRole('heading', { name: 'Player and stable analysis' }).closest('section');
    expect(playerAnalysis).not.toBeNull();
    expect(within(playerAnalysis as HTMLElement).getByRole('columnheader', { name: 'Player' })).toBeInTheDocument();
    expect(within(playerAnalysis as HTMLElement).getByRole('columnheader', { name: 'Stable' })).toBeInTheDocument();
    expect(within(playerAnalysis as HTMLElement).getByRole('columnheader', { name: 'Searches' })).toBeInTheDocument();
    expect(within(playerAnalysis as HTMLElement).getByRole('columnheader', { name: 'No results' })).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(2);

    expect(screen.queryByText('event-raw-1')).not.toBeInTheDocument();
    expect(screen.queryByText('secret phrase')).not.toBeInTheDocument();
    expect(screen.queryByText('Private Robot')).not.toBeInTheDocument();
    expect(screen.queryByText('/robots/99')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Search robots, stables, or guide articles')).not.toBeInTheDocument();
  });

  it('maps authorization failures to a safe admin-only error without exposing backend details', async () => {
    mockGetReport.mockReset();
    mockGetReport.mockRejectedValueOnce(new ApiError('database credentials', 'FORBIDDEN', 403));
    render(<SearchAnalyticsPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('You are not authorized to view search analytics.');
    expect(alert).not.toHaveTextContent('database credentials');
    expect(screen.queryByText('atlas')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
