/**
 * Unit tests for the admin SearchAnalyticsPage: periods and counting mode in
 * the URL, cards and trends, categories, the phrase table (tabs, filter,
 * export), searchers, per-section errors and stale responses.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import SearchAnalyticsPage from '../SearchAnalyticsPage';
import { ApiError } from '../../../utils/ApiError';
import type { AdminSearchAnalyticsReport } from '../../../utils/adminSearchAnalyticsApi';
import { makePhrases, makeReport } from './searchAnalyticsFixtures';

const mockGetReport = vi.hoisted(() => vi.fn());
const mockGetPhrases = vi.hoisted(() => vi.fn());
const mockDownload = vi.hoisted(() => vi.fn());

vi.mock('../../../utils/adminSearchAnalyticsApi', () => ({
  getAdminSearchAnalyticsReport: mockGetReport,
  getAdminSearchAnalyticsPhrases: mockGetPhrases,
  downloadAdminSearchAnalyticsPhrasesCsv: mockDownload,
}));

vi.mock('recharts', () => {
  const Box = ({ children }: { children?: ReactNode }) => <div data-testid="chart">{children}</div>;
  const Empty = () => null;
  return {
    ResponsiveContainer: Box, ComposedChart: Box, Bar: Empty, Line: Empty, XAxis: Empty, YAxis: Empty,
    CartesianGrid: Empty, Tooltip: Empty, Legend: Empty,
  };
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/admin/search-analytics${search}`]}>
      <Routes>
        <Route path="/admin/search-analytics" element={<><SearchAnalyticsPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const lastReportQuery = () => mockGetReport.mock.calls.at(-1)?.[0];
const lastPhraseQuery = () => mockGetPhrases.mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetReport.mockResolvedValue(makeReport());
  mockGetPhrases.mockResolvedValue(makePhrases());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SearchAnalyticsPage', () => {
  it('loads the last 7 cycles of settled searches by default', async () => {
    renderPage();

    expect(await screen.findByText('412')).toBeInTheDocument();
    expect(lastReportQuery()).toEqual({ lastCycles: 7, mode: 'settled', page: 1, limit: 25 });
    expect(lastPhraseQuery()).toEqual({ lastCycles: 7, mode: 'settled', tab: 'all', q: '', page: 1, limit: 20 });
    expect(screen.getByText('Season 2 · cycles 32–38')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last 7 cycles' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('explains settled counting and how many requests were typing in progress', async () => {
    renderPage();

    const banner = await screen.findByRole('region', { name: 'How searches are counted' });
    await waitFor(() => expect(banner).toHaveTextContent('412 of 1,284 requests'));
    expect(banner).toHaveTextContent('The other 872 were typing in progress');
  });

  it('shows the cards with trends; a falling no-result rate is green', async () => {
    renderPage();

    await screen.findByText('412');
    expect(screen.getByLabelText('Trend: up 38')).toHaveClass('text-success');
    expect(screen.getByLabelText('Trend: down 3.1 pts')).toHaveClass('text-success');
    expect(screen.getByText('18.4%')).toBeInTheDocument();
    expect(screen.getByText('Includes 1 admin account')).toBeInTheDocument();
    expect(screen.getByText('60.8%')).toBeInTheDocument();
    expect(screen.getByText('Tracked since cycle 36')).toBeInTheDocument();
    expect(screen.getAllByText('vs cycles 25–31')).toHaveLength(2);
  });

  it('says "Not tracked yet" before selection tracking has data', async () => {
    mockGetReport.mockResolvedValue(makeReport({
      overview: { ...makeReport().overview, selection: { trackedSearches: 0, ledToResult: 0, rate: null, trackedSinceCycle: null } },
    }));
    renderPage();

    expect(await screen.findByText('Not tracked yet')).toBeInTheDocument();
    expect(screen.getByText('Starts counting with new searches')).toBeInTheDocument();
  });

  it('switches presets and keeps the period in the URL', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('412');

    await user.click(screen.getByRole('button', { name: 'This cycle' }));
    await waitFor(() => expect(lastReportQuery()).toMatchObject({ lastCycles: 1 }));
    expect(screen.getByTestId('location')).toHaveTextContent('?period=this');

    await user.click(screen.getByRole('button', { name: 'Whole season' }));
    await waitFor(() => expect(lastReportQuery()).not.toHaveProperty('lastCycles'));
    expect(screen.getByTestId('location')).toHaveTextContent('?period=season');
  });

  it('validates a custom range before requesting it', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('412');

    await user.click(screen.getByRole('button', { name: 'Custom…' }));
    const form = screen.getByRole('form', { name: 'Custom cycle range' });
    await user.type(within(form).getByLabelText('From cycle'), '30');
    await user.type(within(form).getByLabelText('To cycle'), '20');
    const callsBefore = mockGetReport.mock.calls.length;
    await user.click(within(form).getByRole('button', { name: 'Apply' }));

    expect(within(form).getByRole('alert')).toHaveTextContent('The starting cycle cannot be after the ending cycle.');
    expect(mockGetReport.mock.calls.length).toBe(callsBefore);

    await user.clear(within(form).getByLabelText('To cycle'));
    await user.type(within(form).getByLabelText('To cycle'), '35');
    await user.click(within(form).getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(lastReportQuery()).toMatchObject({ cycleFrom: 30, cycleTo: 35 }));
    expect(screen.getByTestId('location')).toHaveTextContent('?period=custom&from=30&to=35');
  });

  it('switches to all requests', async () => {
    const user = userEvent.setup();
    mockGetReport.mockImplementation(async (query: { mode: string }) => makeReport({
      period: { ...makeReport().period, mode: query.mode as 'settled' | 'all' },
    }));
    renderPage();
    await screen.findByText('412');

    await user.click(screen.getByRole('button', { name: 'All requests' }));

    await waitFor(() => expect(lastReportQuery()).toMatchObject({ mode: 'all' }));
    expect(lastPhraseQuery()).toMatchObject({ mode: 'all' });
    expect(screen.getByTestId('location')).toHaveTextContent('?count=all');
    expect(await screen.findByText('Search requests')).toBeInTheDocument();
  });

  it('renders phrase rows with returned categories and the mostly chosen category', async () => {
    renderPage();

    const table = await screen.findByRole('table', { name: 'Searched phrases' });
    const cannon = within(table).getByRole('row', { name: /laser cannon/ });
    expect(cannon).toHaveTextContent('Robots, Guide articles');
    expect(cannon).toHaveTextContent('Robot · 71.4%');
    const misspelt = within(table).getByRole('row', { name: /plasma sheild/ });
    expect(within(misspelt).getByText('100%')).toHaveClass('text-error');
    expect(misspelt).toHaveTextContent('No results');
    expect(misspelt).toHaveTextContent('Not tracked');
  });

  it('switches to the no-result tab and filters phrases after a pause', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('table', { name: 'Searched phrases' });

    await user.click(screen.getByRole('button', { name: 'No results' }));
    await waitFor(() => expect(lastPhraseQuery()).toMatchObject({ tab: 'noResult', page: 1 }));
    expect(screen.getByTestId('location')).toHaveTextContent('tab=noResult');

    await user.type(screen.getByLabelText('Filter phrases'), 'plasma');
    await waitFor(() => expect(lastPhraseQuery()).toMatchObject({ q: 'plasma', tab: 'noResult' }), { timeout: 2000 });
    expect(screen.getByTestId('location')).toHaveTextContent('q=plasma');
  });

  it('exports the current phrase selection as CSV', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:csv');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    mockDownload.mockResolvedValue(new Blob(['"Phrase"']));
    renderPage('?tab=noResult&q=plasma');
    await screen.findByText('412');

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith({ lastCycles: 7, mode: 'settled', tab: 'noResult', q: 'plasma' }));
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('shows the category results with what was opened', async () => {
    renderPage();

    const table = await screen.findByRole('table', { name: /per category/ });
    expect(within(table).getByRole('row', { name: /Robots/ })).toHaveTextContent('74.0%38.0%');
    expect(screen.getByText(/39.0% opened nothing/)).toBeInTheDocument();
  });

  it('shows the trend as a table on request', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('412');

    await user.click(screen.getByRole('button', { name: 'View as table' }));

    const table = screen.getByRole('table', { name: 'Settled searches and no-result rate per cycle' });
    expect(within(table).getByRole('row', { name: /38/ })).toHaveTextContent('14.7%');
  });

  it('keeps searchers collapsed and links each to the player detail', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('412');

    const toggle = screen.getByRole('button', { name: /Searchers \(9\)/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);

    expect(screen.getByRole('link', { name: 'Iron House' })).toHaveAttribute('href', '/admin/players?user=9');
  });

  it('shows a report error with Retry and keeps the phrases', async () => {
    const user = userEvent.setup();
    mockGetReport.mockRejectedValueOnce(new ApiError('internal detail', 'INTERNAL', 500));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to load search analytics. Try again.');
    expect(alert).not.toHaveTextContent('internal detail');
    expect(await screen.findByRole('table', { name: 'Searched phrases' })).toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('412')).toBeInTheDocument();
  });

  it('maps authorization failures to a safe message', async () => {
    mockGetReport.mockRejectedValue(new ApiError('Admin access required', 'FORBIDDEN', 403));
    renderPage();

    expect(await screen.findByText('You are not authorized to view search analytics.')).toBeInTheDocument();
  });

  it('shows reporting limitations', async () => {
    mockGetReport.mockResolvedValue(makeReport({
      limitations: [{ code: 'analyticsDataIncomplete', message: 'Search analytics data may be incomplete because persistence failed.' }],
    }));
    renderPage();

    expect(await screen.findByRole('status', { name: 'Reporting limitations' })).toHaveTextContent('may be incomplete');
  });

  it('never lets a slow report for an older period replace the current one', async () => {
    const user = userEvent.setup();
    let resolveSlow: (report: AdminSearchAnalyticsReport) => void = () => undefined;
    mockGetReport.mockImplementation((query: { lastCycles?: number }) => (
      query.lastCycles === 7
        ? new Promise((resolve) => { resolveSlow = resolve; })
        : Promise.resolve(makeReport({ overview: { ...makeReport().overview, totalSearches: 11 } }))
    ));
    renderPage();

    await user.click(screen.getByRole('button', { name: 'This cycle' }));
    expect(await screen.findByText('11')).toBeInTheDocument();

    await act(async () => {
      resolveSlow(makeReport({ overview: { ...makeReport().overview, totalSearches: 999 } }));
      await Promise.resolve();
    });
    expect(screen.queryByText('999')).not.toBeInTheDocument();
  });
});
