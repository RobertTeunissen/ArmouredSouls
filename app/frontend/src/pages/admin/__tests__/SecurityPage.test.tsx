/**
 * SecurityPage: the window picker (URL state and request), the status line,
 * the six signal cards, the per-day chart, the stables and the sources tables,
 * the quiet state and the error/retry path.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import SecurityPage from '../SecurityPage';
import type { SecurityOverview, SignalCard } from '@shared/types';

const mockGet = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

const NOW = '2026-11-01T12:00:00.000Z';
const DAYS = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'].map((d) => `${d}T00:00:00.000Z`);
const CARDS: SignalCard[] = ['failed_login', 'rate_limit', 'ownership_violation', 'race_condition_burst', 'robot_creation_burst', 'nsfw_block'];

function overview(perSignal: Partial<Record<SignalCard, number[]>> = {}, overrides: Partial<SecurityOverview> = {}): SecurityOverview {
  return {
    window: '7d',
    generatedAt: NOW,
    bucket: 'day',
    buckets: DAYS,
    signals: CARDS.map((signal) => {
      const perBucket = perSignal[signal] ?? [0, 0, 0, 0, 0, 0, 0];
      return { signal, total: perBucket.reduce((a, b) => a + b, 0), perBucket, lastSeenAt: perBucket.some((n) => n > 0) ? '2026-11-01T09:00:00.000Z' : null };
    }),
    stables: [
      { userId: 11, stableName: 'Stable K', username: 'player_k', stableType: 'human', counts: { failed_login: 9 }, lastSeenAt: '2026-10-29T21:14:00.000Z' },
      { userId: 12, stableName: null, username: 'player_b', stableType: 'human', counts: { rate_limit: 5 }, lastSeenAt: '2026-10-28T18:02:00.000Z' },
    ],
    sources: [
      { sourceIp: '203.0.113.24', failedLogins: 9, accountsTried: 1, malformedRequests: 0, rateLimitHits: 0, endpoints: ['/api/auth/login'], lastSeenAt: '2026-10-29T21:14:00.000Z', burst: { count: 9, at: '2026-10-29T21:14:00.000Z' } },
      { sourceIp: '198.51.100.7', failedLogins: 0, accountsTried: 0, malformedRequests: 4, rateLimitHits: 0, endpoints: ['/api/auth/register'], lastSeenAt: '2026-10-31T02:51:00.000Z', burst: null },
    ],
    recordingSince: '2026-11-01T08:00:00.000Z',
    thresholds: { retentionDays: 90, burstCount: 5, burstWindowMinutes: 15 },
    ...overrides,
  };
}

let responses: Record<string, SecurityOverview>;

beforeEach(() => {
  mockGet.mockReset();
  responses = {
    '7d': overview({ failed_login: [0, 1, 0, 9, 2, 0, 2], rate_limit: [0, 0, 5, 0, 0, 1, 0] }),
    '24h': overview({}, { window: '24h', bucket: 'hour', buckets: Array.from({ length: 24 }, (_, i) => new Date(Date.parse(NOW) - (23 - i) * 3_600_000).toISOString()), stables: [], sources: [] }),
  };
  mockGet.mockImplementation(async (url: string, config?: { params?: { window?: string } }) => {
    if (url === '/api/admin/security/overview') {
      const data = responses[config?.params?.window ?? '7d'];
      if (data) return { data };
    }
    throw new Error(`unexpected GET ${url}`);
  });
});

function LocationProbe(): React.ReactElement {
  return <output data-testid="location">{useLocation().search}</output>;
}

function renderPage(path = '/admin/security') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/security" element={<><SecurityPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SecurityPage', () => {
  it('names the signal types that fired and shows every card', async () => {
    renderPage();
    expect(await screen.findByTestId('security-status')).toHaveTextContent(
      '2 of 6 signal types fired in the last 7 days: failed logins (14) and rate-limit hits (6).',
    );
    expect(mockGet).toHaveBeenCalledWith('/api/admin/security/overview', expect.objectContaining({ params: { window: '7d' } }));
    const failed = screen.getByTestId('signal-card-failed_login');
    expect(within(failed).getByText('14')).toHaveClass('text-warning');
    expect(within(failed).getByText('Last: 3h ago')).toBeInTheDocument();
    expect(within(screen.getByTestId('signal-card-race_condition_burst')).getByText('Last: never')).toBeInTheDocument();
    expect(within(screen.getByTestId('signal-card-nsfw_block')).getByRole('link', { name: /Image Uploads/ })).toHaveAttribute('href', '/admin/image-uploads');
    expect(screen.getByText(/Recorded since 1 Nov · kept 90 days/)).toBeInTheDocument();
  });

  it('charts signals per day with a readable table', async () => {
    renderPage();
    const chart = await screen.findByRole('region', { name: 'Signals per day' });
    const table = within(chart).getByRole('table', { hidden: true });
    expect(within(table).getByRole('row', { name: /Thu 29 9 0/, hidden: true })).toBeInTheDocument();
    expect(within(chart).getByText('Times in UTC.')).toBeInTheDocument();
  });

  it('lists stables with signals linking to their Players panel', async () => {
    renderPage();
    const region = await screen.findByRole('region', { name: 'Stables with signals' });
    expect(within(region).getByRole('link', { name: 'Stable K' })).toHaveAttribute('href', '/admin/players?user=11');
    expect(within(region).getByRole('link', { name: 'player_b' })).toHaveAttribute('href', '/admin/players?user=12');
    expect(within(region).getByText('Failed logins 9')).toBeInTheDocument();
    expect(within(region).getByText('Thu 29, 21:14')).toBeInTheDocument();
  });

  it('lists sources without an account and marks a failed-login burst', async () => {
    renderPage();
    const region = await screen.findByRole('region', { name: 'Without an account' });
    const rows = within(region).getAllByRole('row');
    expect(within(rows[1]).getByText('203.0.113.24')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Burst: 9 in 15 min')).toBeInTheDocument();
    expect(within(rows[2]).queryByText(/Burst/)).toBeNull();
    expect(within(region).getByText(/A burst is 5 or more failed logins from one IP within 15 minutes/)).toBeInTheDocument();
  });

  it('switches the window, keeps it in the URL and reads hourly buckets', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('security-status');
    await user.click(screen.getByRole('button', { name: 'Last 24 hours' }));

    await waitFor(() => expect(screen.getByTestId('security-status')).toHaveTextContent('No signals in the last 24 hours.'));
    expect(mockGet).toHaveBeenLastCalledWith('/api/admin/security/overview', expect.objectContaining({ params: { window: '24h' } }));
    expect(screen.getByTestId('location')).toHaveTextContent('?window=24h');
    expect(screen.getByRole('button', { name: 'Last 24 hours' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Signals per hour' })).toHaveTextContent('No signals in this window.');
    expect(screen.getByText('No stable triggered a signal in this window.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Last 7 days' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(''));
  });

  it('opens on the window from the URL', async () => {
    renderPage('/admin/security?window=24h');
    expect(await screen.findByTestId('security-status')).toHaveTextContent('No signals in the last 24 hours.');
  });

  it('shows an error with a working Retry', async () => {
    const user = userEvent.setup();
    mockGet.mockRejectedValueOnce(Object.assign(new Error('boom'), { isAxiosError: true, response: { status: 500, data: { error: 'Database down', code: 'INTERNAL_ERROR' } } }));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Database down');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('security-status')).toBeInTheDocument();
  });

  it('refreshes on demand', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('security-status');
    const calls = mockGet.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(mockGet.mock.calls.length).toBe(calls + 1));
  });
});
