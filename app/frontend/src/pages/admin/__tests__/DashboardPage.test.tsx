/**
 * Unit tests for the admin DashboardPage.
 *
 * Covers the status strip, KPI cards and trends, "Needs attention", the battle
 * activity table (including the mobile Volume/Rates toggle), the collapsed meta
 * snapshot, the URL filter, refresh, per-section errors and the stale-response
 * race on a filter change. API shapes match the backend contracts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import DashboardPage from '../DashboardPage';
import type { BattleActivity, DashboardKpis, DashboardStatus } from '../../../utils/adminDashboardApi';

// ----------------------------------------------------------------
// apiClient mock: routes each URL to a handler
// ----------------------------------------------------------------
type Config = { params?: Record<string, unknown>; signal?: AbortSignal };
const mockGet = vi.fn<(url: string, config?: Config) => Promise<{ data: unknown }>>();

vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: (url: string, config?: Config) => mockGet(url, config),
  },
}));

// ----------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------
const kpis = (overrides: Partial<DashboardKpis['humanPlayers']> = {}, active7d = 38): DashboardKpis => ({
  currentCycle: 412,
  lastCycleAt: '2026-10-22T00:01:00.000Z',
  humanPlayers: {
    total: 52, active7d, new7d: 5, inactive3d: 7,
    previous: { active7d: 32, new7d: 7, inactive3d: 6 },
    ...overrides,
  },
  robots: { total: 144, battleReady: 124, battleReadyPercentage: 86.1 },
  timestamp: '2026-10-22T14:02:31.000Z',
});

const statusFixture = (attention: Partial<DashboardStatus['attention']> = {}): DashboardStatus => ({
  cycle: { number: 412, lastSettlementAt: '2026-10-22T00:01:00.000Z', nextSettlementAt: '2026-10-23T00:00:00.000Z' },
  season: { number: 2, phase: 'competitive', seasonCycle: 38 },
  scheduler: {
    active: true, runningJob: null, queueLength: 0, jobsTotal: 10, jobsSucceeded: 10,
    jobsFailed: [], jobsNotYetReported: 0, processStartedAt: '2026-10-20T09:00:00.000Z',
  },
  queuedMatches: 180,
  attention: {
    bankruptcyRisk: { count: 3, threshold: 10000 },
    security: { activeAlerts: 1, critical: 1 },
    automatons: { needAttention: 5, failed: 0 },
    cycleHealth: { settlementOverdue: false, failedJobs: [], stuckMatches: 0 },
    ...attention,
  },
  timestamp: '2026-10-22T14:02:30.000Z',
});

const activityFixture: BattleActivity = {
  rows: [
    { mode: 'league_1v1', lastCycle: 96, season: 39552, walkovers: 12, queued: 96, drawRate: 4.2, killRate: 31.3, avgDurationSeconds: 48.6 },
    { mode: 'koth', lastCycle: 6, season: 2472, walkovers: 0, queued: 6, drawRate: null, killRate: 44, avgDurationSeconds: 92.1 },
  ],
  totals: { lastCycle: 102, season: 42024, walkovers: 12, queued: 102, drawRate: 4.2, killRate: 31.9, avgDurationSeconds: 51.2 },
  lastCycleWindow: { cycleNumber: 412, from: '2026-10-21T00:01:00.000Z', to: '2026-10-22T00:01:00.000Z' },
  timestamp: '2026-10-22T14:02:31.000Z',
};

const systemStats = {
  robots: { total: 144, byTier: [{ league: 'silver', count: 20 }, { league: 'bronze', count: 100 }], battleReady: 124, battleReadyPercentage: 86.1 },
  matches: { scheduled: 0, completed: 0 },
  battles: { last24Hours: 0, total: 0, draws: 0, drawPercentage: 0, avgDuration: 0, kills: 0, killPercentage: 0 },
  finances: { totalCredits: 0, avgBalance: 0, usersAtRisk: 0, totalUsers: 52 },
  facilities: { summary: [{ type: 'repair_bay', purchaseCount: 30, avgLevel: 2.5 }], totalPurchases: 30, mostPopular: 'repair_bay' },
  weapons: { totalBought: 200, equipped: 120, equippedInventoryItems: 150 },
  stances: [{ stance: 'offensive', count: 60 }, { stance: 'defensive', count: 40 }],
  loadouts: [{ type: 'weapon_shield', count: 70 }],
  yieldThresholds: { distribution: [{ threshold: 10, count: 50 }], mostCommon: 10, mostCommonCount: 50 },
};

function routeApi(handlers: Partial<Record<'kpis' | 'status' | 'activity' | 'stats', (config?: Config) => Promise<unknown>>> = {}): void {
  mockGet.mockImplementation((url, config) => {
    if (url === '/api/admin/stats') {
      return (handlers.stats?.(config) ?? Promise.resolve(systemStats)).then((data) => ({ data }));
    }
    if (url === '/api/admin/dashboard/status') {
      return (handlers.status?.(config) ?? Promise.resolve(statusFixture())).then((data) => ({ data }));
    }
    if (url === '/api/admin/dashboard/kpis') {
      return (handlers.kpis?.(config) ?? Promise.resolve(kpis())).then((data) => ({ data }));
    }
    if (url === '/api/admin/dashboard/battle-activity') {
      return (handlers.activity?.(config) ?? Promise.resolve(activityFixture)).then((data) => ({ data }));
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/admin/dashboard${search}`]}>
      <Routes>
        <Route path="/admin/dashboard" element={<><DashboardPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const callsTo = (url: string) => mockGet.mock.calls.filter(([called]) => called === url);

beforeEach(() => {
  vi.clearAllMocks();
  routeApi();
});

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------
describe('DashboardPage', () => {
  it('renders the status strip', async () => {
    renderPage();

    const strip = await screen.findByRole('region', { name: 'System status' });
    await waitFor(() => expect(within(strip).getByText('412 · Season 2')).toBeInTheDocument());
    expect(within(strip).getByText('Healthy · 10 jobs')).toBeInTheDocument();
    expect(within(strip).getByText('180')).toBeInTheDocument();
    expect(within(strip).getByText(/^00:00 UTC · /)).toBeInTheDocument();
  });

  it('renders KPI cards with trends; a rising inactive count is red', async () => {
    renderPage();

    expect(await screen.findByText('38')).toBeInTheDocument();
    expect(screen.getByLabelText('Trend: up 6')).toHaveClass('text-success');
    expect(screen.getByLabelText('Trend: down 2')).toHaveClass('text-error');
    expect(screen.getByLabelText('Trend: up 1')).toHaveClass('text-error');
    expect(screen.getByText('86.1%')).toBeInTheDocument();
    expect(screen.getByText('124 of 144 robots')).toBeInTheDocument();
  });

  it('says "No comparison yet" until a snapshot exists', async () => {
    routeApi({ kpis: () => Promise.resolve(kpis({ previous: { active7d: null, new7d: 7, inactive3d: null } })) });
    renderPage();

    await screen.findByText('38');
    expect(screen.getAllByText('No comparison yet')).toHaveLength(2);
  });

  it('lists open attention items first as links, and OK items as plain text', async () => {
    renderPage();

    const panel = await screen.findByRole('region', { name: 'Needs attention' });
    await waitFor(() => expect(within(panel).getByText('3 open')).toBeInTheDocument());

    const links = within(panel).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/admin/players?tab=at-risk',
      '/admin/security',
      '/admin/automatons?tab=stables&filter=attention',
    ]);
    expect(within(panel).getByText('Last cycle healthy')).toBeInTheDocument();
    expect(within(panel).getByText('Last cycle healthy').closest('a')).toBeNull();
  });

  it('shows "All clear" when nothing needs attention', async () => {
    routeApi({
      status: () => Promise.resolve(statusFixture({
        bankruptcyRisk: { count: 0, threshold: 10000 },
        security: { activeAlerts: 0, critical: 0 },
        automatons: { needAttention: 0, failed: 0 },
      })),
    });
    renderPage();

    const panel = await screen.findByRole('region', { name: 'Needs attention' });
    await waitFor(() => expect(within(panel).getByText('All clear')).toBeInTheDocument());
    expect(within(panel).queryAllByRole('link')).toHaveLength(0);
  });

  it('renders battle activity rows and totals, with n/a draws for KotH', async () => {
    renderPage();

    const table = await screen.findByRole('table', { name: 'Battles per mode for the selected filter' });
    const koth = within(table).getByRole('row', { name: /King of the Hill/ });
    expect(within(koth).getByText('n/a')).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /Total/ })).toHaveTextContent('42,024');
    expect(screen.getByText(/Last cycle: cycle 412, settled 00:01 UTC/)).toBeInTheDocument();
  });

  it('switches column sets on mobile with the Volume/Rates toggle', async () => {
    const user = userEvent.setup();
    renderPage();

    const table = await screen.findByRole('table');
    const drawHeader = within(table).getByRole('columnheader', { name: 'Draw %' });
    const seasonHeader = within(table).getByRole('columnheader', { name: 'Season' });
    expect(drawHeader).toHaveClass('hidden', 'md:table-cell');
    expect(seasonHeader).toHaveClass('table-cell');

    await user.click(screen.getByRole('button', { name: 'Rates' }));

    expect(screen.getByRole('button', { name: 'Rates' })).toHaveAttribute('aria-pressed', 'true');
    expect(drawHeader).toHaveClass('table-cell');
    expect(seasonHeader).toHaveClass('hidden', 'md:table-cell');
  });

  it('defaults to the real filter, takes the filter from the URL and ignores unknown values', async () => {
    const { unmount } = renderPage('?filter=automaton');
    await waitFor(() => expect(callsTo('/api/admin/dashboard/kpis')[0]?.[1]?.params).toEqual({ filter: 'automaton' }));
    unmount();

    mockGet.mockClear();
    renderPage('?filter=bogus');
    await waitFor(() => expect(callsTo('/api/admin/dashboard/kpis')[0]?.[1]?.params).toEqual({ filter: 'real' }));
    expect(callsTo('/api/admin/dashboard/battle-activity')[0]?.[1]?.params).toEqual({ filter: 'real', fresh: 'false' });
  });

  it('refetches filtered sections on a filter change, updates the URL, and leaves the status alone', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('38');
    expect(callsTo('/api/admin/dashboard/status')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /Auto-generated/ }));

    await waitFor(() => expect(callsTo('/api/admin/dashboard/kpis').at(-1)?.[1]?.params).toEqual({ filter: 'auto' }));
    expect(callsTo('/api/admin/dashboard/battle-activity').at(-1)?.[1]?.params).toEqual({ filter: 'auto', fresh: 'false' });
    expect(callsTo('/api/admin/dashboard/status')).toHaveLength(1);
    expect(screen.getByTestId('location')).toHaveTextContent('?filter=auto');
    expect(screen.getByRole('button', { name: /Auto-generated/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('never lets a slow response for the previous filter overwrite the current one', async () => {
    const user = userEvent.setup();
    let resolveReal: (value: DashboardKpis) => void = () => undefined;
    routeApi({
      kpis: (config) => (config?.params?.filter === 'real'
        ? new Promise<DashboardKpis>((resolve) => { resolveReal = resolve; })
        : Promise.resolve(kpis({}, 11))),
    });
    renderPage();
    await screen.findByRole('region', { name: 'System status' });

    await user.click(screen.getByRole('button', { name: /Auto-generated/ }));
    expect(await screen.findByText('11')).toBeInTheDocument();

    resolveReal(kpis({}, 99));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText('99')).not.toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
  });

  it('shows a per-section error and keeps the other sections', async () => {
    routeApi({ activity: () => Promise.reject({ response: { status: 500, data: { error: 'Battle activity failed', code: 'INTERNAL' } } }) });
    renderPage();

    const panel = await screen.findByRole('region', { name: 'Battle activity' });
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Battle activity failed');
    expect(await screen.findByText('38')).toBeInTheDocument();
    expect(screen.getByText('Stables at bankruptcy risk')).toBeInTheDocument();
  });

  it('refresh refetches everything and bypasses the battle-activity cache', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('38');
    await waitFor(() => expect(screen.getByText(/Last updated 14:02:31 UTC/)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Refresh/ }));

    await waitFor(() => expect(callsTo('/api/admin/dashboard/status')).toHaveLength(2));
    expect(callsTo('/api/admin/dashboard/kpis')).toHaveLength(2);
    expect(callsTo('/api/admin/dashboard/battle-activity').at(-1)?.[1]?.params).toEqual({ filter: 'real', fresh: 'true' });
  });

  it('keeps the meta snapshot collapsed and unfetched until opened', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('38');

    const toggle = screen.getByRole('button', { name: /Meta snapshot/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(callsTo('/api/admin/stats')).toHaveLength(0);

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(callsTo('/api/admin/stats')[0]?.[1]?.params).toEqual({ filter: 'real' });
    expect(await screen.findByText('Stances')).toBeInTheDocument();
    expect(screen.getByText('Weapon shield')).toBeInTheDocument();
    expect(screen.queryByText(/tiers/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'League Health' })).toHaveAttribute('href', '/admin/league-health');
    expect(screen.getByText('75.0%')).toBeInTheDocument(); // 150 of 200 equipped, offhands included
  });

  it('keeps the meta snapshot on the current filter when an old response arrives late', async () => {
    const user = userEvent.setup();
    let resolveReal: (value: typeof systemStats) => void = () => undefined;
    const autoStats = { ...systemStats, stances: [{ stance: 'balanced', count: 9 }] };
    routeApi({
      stats: (config) => (config?.params?.filter === 'real'
        ? new Promise<typeof systemStats>((resolve) => { resolveReal = resolve; })
        : Promise.resolve(autoStats)),
    });
    renderPage();
    await screen.findByRole('region', { name: 'System status' });

    await user.click(screen.getByRole('button', { name: /Meta snapshot/ }));
    await user.click(screen.getByRole('button', { name: /Auto-generated/ }));
    expect(await screen.findByText('Balanced')).toBeInTheDocument();

    // The slow Real response lands after the Auto one: it must not replace it
    // or blank the panel.
    resolveReal(systemStats);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.queryByText('Offensive')).not.toBeInTheDocument();
    expect(callsTo('/api/admin/stats').at(-1)?.[1]?.signal?.aborted).toBe(false);
    expect(callsTo('/api/admin/stats')[0]?.[1]?.signal?.aborted).toBe(true);
  });
});
