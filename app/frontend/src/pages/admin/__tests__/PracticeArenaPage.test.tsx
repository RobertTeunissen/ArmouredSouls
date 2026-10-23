/**
 * Admin Practice Arena page: status strip, per-day table (unrecorded days as
 * "—", Show all), top practitioners linking to Players, usage shares, and the
 * load error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminPracticeArenaPage from '../PracticeArenaPage';
import { ApiError } from '../../../utils/ApiError';
import type { PracticeArenaOverview, PracticeDayStats } from '../../../utils/adminPracticeArenaApi';

const mockGetOverview = vi.fn();
vi.mock('../../../utils/adminPracticeArenaApi', () => ({
  getPracticeArenaOverview: () => mockGetOverview(),
}));

const day = (date: string, partial: Partial<PracticeDayStats> = {}): PracticeDayStats => ({
  date, battles: 0, requests: 0, players: 0, rateLimited: 0, cycleBusy: 0, unavailableMs: null, recorded: true, ...partial,
});

function overview(partial: Partial<PracticeArenaOverview> = {}): PracticeArenaOverview {
  const days = [
    day('2026-10-24', { battles: 14, requests: 6, players: 3, rateLimited: 2, cycleBusy: 5, unavailableMs: 48 * 60_000 }),
    day('2026-10-23', { battles: 31, requests: 9, players: 5, cycleBusy: 4, unavailableMs: 104 * 60_000 }),
    day('2026-10-22', { battles: 12, requests: 4, players: 2, unavailableMs: 195 * 60_000 }),
    ...Array.from({ length: 27 }, (_, index) => day(`2026-09-${String(30 - index).padStart(2, '0')}`, { recorded: false })),
  ];
  return {
    timestamp: '2026-10-24T14:02:11.000Z',
    windowDays: 30,
    recordingSince: '2026-10-23T08:40:00.000Z',
    season: { number: 1, battles: 798, players: 20 },
    days,
    topPractitioners: [
      { userId: 11, username: 'Sexy', stableName: 'S', battles: 82, lastPracticeAt: null },
      { userId: 12, username: 'SmashHit', stableName: 'SH', battles: 60, lastPracticeAt: '2026-10-24T09:12:00.000Z' },
    ],
    usage: {
      battles: 57,
      requests: 19,
      matchups: { owned_vs_sparring: 41, owned_vs_owned: 16, sparring_vs_sparring: 0 },
      botTiers: { WimpBot: 5, AverageBot: 16, ExpertBot: 12, UltimateBot: 8 },
      batchSizes: { single: 4, small: 3, large: 12 },
      overridesRequests: 3,
    },
    ...partial,
  };
}

const renderPage = (): void => {
  render(<MemoryRouter><AdminPracticeArenaPage /></MemoryRouter>);
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOverview.mockResolvedValue(overview());
});

describe('AdminPracticeArenaPage', () => {
  it('shows today, the season and refusals in the status strip', async () => {
    renderPage();
    const strip = await screen.findByRole('region', { name: 'Practice Arena status' });
    expect(within(strip).getByText('Battles today').nextElementSibling).toHaveTextContent('14');
    expect(within(strip).getByText('6 requests · yesterday 31')).toBeInTheDocument();
    expect(within(strip).getByText('798 battles')).toBeInTheDocument();
    expect(within(strip).getByText('20 players · Season 1')).toBeInTheDocument();
    expect(within(strip).getByText('2 rate limit · 5 during a job')).toBeInTheDocument();
    expect(within(strip).getByText('1h 44m')).toBeInTheDocument();
    expect(screen.getByText(/Recording since 23 Oct/)).toBeInTheDocument();
  });

  it('lists three days, then all 30 with unrecorded days as —', async () => {
    const user = userEvent.setup();
    renderPage();
    const table = await screen.findByRole('table', { name: /usage per UTC day/ });
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getByRole('rowheader', { name: 'Today (so far)' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Yesterday' })).toBeInTheDocument();
    expect(within(table).getByText('3h 15m')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show all 30 days' }));
    expect(within(table).getAllByRole('row')).toHaveLength(31);
    const old = within(table).getByRole('rowheader', { name: '30 Sep' }).closest('tr')!;
    expect(within(old).getAllByText('—')).toHaveLength(6);
  });

  it('links top practitioners to Players and dates their last recorded practice', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: /most practice battles/ });
    expect(within(table).getByRole('link', { name: 'SmashHit' })).toHaveAttribute('href', '/admin/players?user=12');
    expect(within(table).getByText('Today 09:12')).toBeInTheDocument();
    expect(within(table).getByText('before 23 Oct')).toBeInTheDocument();
  });

  it('shows usage shares, and an empty state without battles', async () => {
    const { unmount } = render(<MemoryRouter><AdminPracticeArenaPage /></MemoryRouter>);
    expect(await screen.findByText('Own vs sparring')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('6–10 battles').closest('li')).toHaveTextContent('63%');
    expect(screen.getByText(/What-if overrides/)).toHaveTextContent('16% of requests');
    unmount();

    mockGetOverview.mockResolvedValue(overview({
      usage: { battles: 0, requests: 0, matchups: { owned_vs_sparring: 0, owned_vs_owned: 0, sparring_vs_sparring: 0 }, botTiers: {}, batchSizes: { single: 0, small: 0, large: 0 }, overridesRequests: 0 },
      topPractitioners: [],
    }));
    renderPage();
    expect(await screen.findByText('No practice battles recorded in the last 30 days.')).toBeInTheDocument();
    expect(screen.getByText('Nobody has practised this season yet.')).toBeInTheDocument();
  });

  it('reports a failed load', async () => {
    mockGetOverview.mockRejectedValue(new ApiError('Access denied', 'FORBIDDEN', 403));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('You are not authorized to view Practice Arena usage.');
  });
});
