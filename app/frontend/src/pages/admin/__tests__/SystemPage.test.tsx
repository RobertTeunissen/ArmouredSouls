/**
 * Admin System page: status cards, failing and slow requests (including the
 * "nothing recorded yet" state), backend starts as Deploy/Restart, scheduler
 * jobs with the slow-run highlight, largest tables, Refresh and the load error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminSystemPage from '../SystemPage';
import { ApiError } from '../../../utils/ApiError';
import type { SystemOverview } from '../../../utils/adminSystemApi';

const mockGetOverview = vi.fn();
vi.mock('../../../utils/adminSystemApi', () => ({
  getSystemOverview: () => mockGetOverview(),
}));

const GB = 1024 ** 3;
const DAYS = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];

function overview(partial: Partial<SystemOverview> = {}): SystemOverview {
  return {
    generatedAt: '2026-11-02T18:08:12.000Z',
    disk: { usagePercent: 66, usedMB: 29 * 1024, totalMB: 45 * 1024, availableMB: 16 * 1024, status: 'ok' },
    memory: { totalMB: 1961, availableMB: 940, swapTotalMB: 2048, swapUsedMB: 188 },
    database: {
      sizeBytes: 15 * GB,
      tables: [
        { name: 'audit_logs', sizeBytes: 5.4 * GB, rows: 3_500_000 },
        { name: 'battles', sizeBytes: 4.5 * GB, rows: 214_000 },
      ],
    },
    backup: { status: 'ok', file: 'armouredsouls_acc_daily_20261102_020002.sql.zst', at: '2026-11-02T02:10:00.000Z', sizeBytes: 4.4 * GB, note: null },
    backend: { startedAt: '2026-11-02T15:50:00.000Z', uptimeSeconds: 2 * 3600 + 18 * 60, deployTag: 'deploy-acc-20261102-154800', nodeVersion: 'v24.1.0' },
    starts: [
      { at: '2026-11-02T15:50:00.000Z', kind: 'deploy', deployTag: 'deploy-acc-20261102-154800' },
      { at: '2026-11-01T23:05:00.000Z', kind: 'restart', deployTag: null },
    ],
    requests: {
      windowDays: 7,
      days: DAYS,
      failures24h: 2,
      errors: [{
        method: 'GET', route: '/api/admin/economy/overview', page: 'Economy', code: 'STATEMENT_TIMEOUT',
        count: 7, lastAt: '2026-11-02T07:10:00.000Z', perDay: [0, 0, 0, 0, 0, 5, 2],
      }],
      slow: [{ method: 'GET', route: '/api/admin/meta/choices', page: 'Meta', count: 3, avgMs: 2_400, maxMs: 4_100, lastAt: '2026-11-02T12:00:00.000Z' }],
      recordingSince: '2026-11-01T00:00:00.000Z',
    },
    jobs: {
      windowDays: 8,
      rows: [{
        jobName: 'grandMelee',
        runs: [
          { startedAt: '2026-10-31T17:00:00.000Z', durationMs: 3_583_000, status: 'success' },
          { startedAt: '2026-11-01T17:00:00.000Z', durationMs: 1_272_000, status: 'success' },
          { startedAt: '2026-11-02T17:00:00.000Z', durationMs: 1_287_000, status: 'success' },
        ],
        last: { startedAt: '2026-11-02T17:00:00.000Z', durationMs: 1_287_000, status: 'success' },
        medianMs: 1_287_000,
        slowest: { startedAt: '2026-10-31T17:00:00.000Z', durationMs: 3_583_000, status: 'success' },
        interrupted: 0,
        failed: 0,
      }],
      lockPerDay: [{ day: '2026-11-01', ms: 2 * 3_600_000 }, { day: '2026-11-02', ms: 3 * 3_600_000 }],
    },
    ...partial,
  };
}

const renderPage = (): void => {
  render(<MemoryRouter><AdminSystemPage /></MemoryRouter>);
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOverview.mockResolvedValue(overview());
});

describe('AdminSystemPage', () => {
  it('shows the six status cards', async () => {
    renderPage();
    const cards = await screen.findByRole('region', { name: 'System status' });

    expect(within(cards).getByTestId('system-card-disk')).toHaveTextContent('66%29 GB of 45 GB used');
    expect(within(cards).getByTestId('system-card-database')).toHaveTextContent('largest: audit_logs 5.4 GB');
    expect(within(cards).getByTestId('system-card-memory')).toHaveTextContent('940 MB free');
    expect(within(cards).getByTestId('system-card-backup')).toHaveTextContent('Today 02:10');
    expect(within(cards).getByTestId('system-card-backend')).toHaveTextContent('up 2h 18m');
    expect(within(cards).getByTestId('system-card-requests')).toHaveTextContent('in 24 h · Economy (statement timeout)');
    expect(screen.getByText('Last updated 18:08:12 UTC')).toBeInTheDocument();
  });

  it('lists failing requests per route with the per-day counts in text', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: /Server errors per route/ });

    const row = within(table).getByRole('row', { name: /GET \/api\/admin\/economy\/overview/ });
    expect(row).toHaveTextContent('Economy');
    expect(row).toHaveTextContent('7');
    expect(row).toHaveTextContent('statement timeout');
    expect(row).toHaveTextContent('Today 07:10');
    expect(row).toHaveTextContent('Per day: 27 Oct: 0, 28 Oct: 0, 29 Oct: 0, 30 Oct: 0, 31 Oct: 0, 1 Nov: 5, 2 Nov: 2');
  });

  it('lists slow requests with average and slowest', async () => {
    renderPage();
    const list = await screen.findByRole('list', { name: 'Slow requests, most first' });

    expect(list).toHaveTextContent('GET /api/admin/meta/choices');
    expect(list).toHaveTextContent('Meta · 3× · average 2.4 s · slowest 4.1 s');
  });

  it('says nothing was recorded yet before the first request was counted', async () => {
    mockGetOverview.mockResolvedValue(overview({
      requests: { windowDays: 7, days: DAYS, failures24h: 0, errors: [], slow: [], recordingSince: null },
    }));
    renderPage();

    expect(await screen.findByText(/Nothing recorded yet. Server errors are counted/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing recorded yet. Requests of 2 s or longer/)).toBeInTheDocument();
    expect(screen.getByTestId('system-card-requests')).toHaveTextContent('Nothing recorded yet');
  });

  it('tells a quiet week apart from no recording', async () => {
    mockGetOverview.mockResolvedValue(overview({
      requests: { windowDays: 7, days: DAYS, failures24h: 0, errors: [], slow: [], recordingSince: '2026-10-20T00:00:00.000Z' },
    }));
    renderPage();

    expect(await screen.findByText('No server errors in the last 7 days.')).toBeInTheDocument();
    expect(screen.getByText('No request took 2 s or longer in the last 7 days.')).toBeInTheDocument();
  });

  it('marks backend starts as Deploy or Restart', async () => {
    renderPage();
    const list = await screen.findByRole('list', { name: 'Backend starts, newest first' });
    const [deploy, restart] = within(list).getAllByRole('listitem');

    expect(deploy).toHaveTextContent('Today 15:50Deploydeploy-acc-20261102-154800');
    expect(restart).toHaveTextContent('Yesterday 23:05Restartno deploy tag recorded');
  });

  it('shows job durations, highlighting a slowest run far above the median', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: /Scheduler job durations/ });
    const row = within(table).getByRole('row', { name: /Grand Melee/ });

    expect(row).toHaveTextContent('21m 27s');
    const slowest = within(row).getByText('59m 43s');
    expect(slowest).toHaveClass('text-warning');
    expect(row).toHaveTextContent('31 Oct');
    expect(screen.getByText('2h 00m – 3h 00m (median 2h 30m)')).toBeInTheDocument();
  });

  it('says no job held the lock instead of drawing empty bars', async () => {
    mockGetOverview.mockResolvedValue(overview({
      jobs: { windowDays: 8, rows: [], lockPerDay: [{ day: '2026-11-01', ms: 0 }, { day: '2026-11-02', ms: 0 }] },
    }));
    renderPage();

    expect(await screen.findByText('No finished runs in the last 8 days.')).toBeInTheDocument();
    expect(screen.getByText(/no job held the lock 1 Nov – 2 Nov/)).toBeInTheDocument();
  });

  it('lists the largest tables', async () => {
    renderPage();
    const list = await screen.findByRole('list', { name: 'Largest tables' });

    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('audit_logs5.4 GB3.5M rows');
    expect(screen.getByText(/Database total 15 GB/)).toBeInTheDocument();
  });

  it('reloads on Refresh', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('region', { name: 'System status' });

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(mockGetOverview).toHaveBeenCalledTimes(2);
  });

  it('shows the load error', async () => {
    mockGetOverview.mockRejectedValue(new ApiError('Access denied', 'FORBIDDEN', 403));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('You are not authorized to view the system status.');
  });
});
