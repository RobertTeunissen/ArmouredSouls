/**
 * Unit tests for the admin MetaPage (`/admin/meta`): compact stances,
 * loadouts, yield thresholds, facilities and weapons; the shared URL filter;
 * refresh; errors with retry; and the stale-response race on a filter change.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MetaPage from '../MetaPage';
import type { SystemStats } from '../../../components/admin/types';

type Config = { params?: Record<string, unknown>; signal?: AbortSignal };
const mockGet = vi.fn<(url: string, config?: Config) => Promise<{ data: unknown }>>();

vi.mock('../../../utils/apiClient', () => ({
  default: { get: (url: string, config?: Config) => mockGet(url, config) },
}));

const stats = (overrides: Partial<SystemStats> = {}): SystemStats => ({
  robots: { total: 144, byTier: [], battleReady: 124, battleReadyPercentage: 86.1 },
  matches: { scheduled: 0, completed: 0 },
  battles: { last24Hours: 0, total: 0, draws: 0, drawPercentage: 0, avgDuration: 0, kills: 0, killPercentage: 0 },
  finances: { totalCredits: 0, avgBalance: 0, usersAtRisk: 0, totalUsers: 52 },
  facilities: {
    summary: [
      { type: 'repair_bay', purchaseCount: 30, avgLevel: 2.5 },
      { type: 'training_facility', purchaseCount: 45, avgLevel: 3.25 },
    ],
    totalPurchases: 75,
    mostPopular: 'training_facility',
  },
  weapons: { totalBought: 200, equipped: 120, equippedInventoryItems: 150 },
  stances: [{ stance: 'offensive', count: 60 }, { stance: 'defensive', count: 40 }],
  loadouts: [{ type: 'weapon_shield', count: 70 }, { type: 'dual_wield', count: 30 }],
  yieldThresholds: {
    distribution: [
      { threshold: 0, count: 10 },
      { threshold: 10, count: 50 },
      { threshold: 15, count: 20 },
      { threshold: 30, count: 20 },
    ],
    mostCommon: 10,
    mostCommonCount: 50,
  },
  ...overrides,
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/admin/meta${search}`]}>
      <Routes>
        <Route path="/admin/meta" element={<><MetaPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const statsCalls = () => mockGet.mock.calls.filter(([url]) => url === '/api/admin/stats');

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockImplementation((url) => (url === '/api/admin/stats'
    ? Promise.resolve({ data: stats() })
    : Promise.reject(new Error(`unexpected ${url}`))));
});

describe('MetaPage', () => {
  it('shows stances and loadouts as shares, largest first, for real players by default', async () => {
    renderPage();

    const stances = await screen.findByRole('region', { name: 'Stances' });
    expect(statsCalls()[0]?.[1]?.params).toEqual({ filter: 'real' });
    expect(within(stances).getByText('100 robots')).toBeInTheDocument();
    const items = within(stances).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Offensive60.0%60');
    expect(items[1]).toHaveTextContent('Defensive40.0%40');

    const loadouts = screen.getByRole('region', { name: 'Loadouts' });
    expect(within(loadouts).getByText('Weapon shield')).toBeInTheDocument();
    expect(within(loadouts).getByText('70.0%')).toBeInTheDocument();
  });

  it('summarises yield thresholds in one chart with the exact numbers in a table', async () => {
    renderPage();

    const yieldPanel = await screen.findByRole('region', { name: 'Yield thresholds' });
    expect(within(yieldPanel).getByText('Most common').nextElementSibling).toHaveTextContent('10% (50.0%)');
    expect(within(yieldPanel).getByText('Median').nextElementSibling).toHaveTextContent('10%');
    expect(within(yieldPanel).getByText('Above 20%').nextElementSibling).toHaveTextContent('20 (20.0%)');

    const table = within(yieldPanel).getByRole('table', { name: 'Robots per yield threshold' });
    expect(within(table).getAllByRole('row')).toHaveLength(5); // header + 4 thresholds in use
    expect(within(table).getByRole('rowheader', { name: '30%' })).toBeInTheDocument();
  });

  it('lists facilities by stables owning them and shows weapon equip rate', async () => {
    renderPage();

    const facilities = await screen.findByRole('region', { name: 'Facilities' });
    const rows = within(within(facilities).getByRole('list', { name: /Stables owning each facility/ })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Training facility45 stables, average levelL3.3');
    expect(rows[1]).toHaveTextContent('Repair bay30 stables, average levelL2.5');

    const weapons = screen.getByRole('region', { name: 'Weapons' });
    expect(within(weapons).getByText('75.0%')).toBeInTheDocument(); // 150 of 200, offhands included
    expect(within(weapons).getByRole('link', { name: /Weapons →/ })).toHaveAttribute('href', '/admin/weapons');
  });

  it('keeps the filter in the URL, shared with the dashboard', async () => {
    const user = userEvent.setup();
    renderPage('?filter=all');
    await screen.findByRole('region', { name: 'Stances' });
    expect(statsCalls()[0]?.[1]?.params).toEqual({ filter: 'all' });

    await user.click(screen.getByRole('button', { name: /Automatons/ }));
    await waitFor(() => expect(statsCalls().at(-1)?.[1]?.params).toEqual({ filter: 'automaton' }));
    expect(screen.getByTestId('location')).toHaveTextContent('?filter=automaton');

    await user.click(screen.getByRole('button', { name: /Real players/ }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^$/));
  });

  it('shows an error with Retry, and Refresh refetches', async () => {
    const user = userEvent.setup();
    mockGet.mockImplementationOnce(() => Promise.reject({ response: { status: 500, data: { error: 'Stats failed', code: 'INTERNAL' } } }));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Stats failed');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('region', { name: 'Stances' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(statsCalls()).toHaveLength(3));
  });

  it('keeps the current filter when an old response arrives late', async () => {
    const user = userEvent.setup();
    let resolveReal: (value: { data: SystemStats }) => void = () => undefined;
    mockGet.mockImplementation((_url, config) => (config?.params?.filter === 'real'
      ? new Promise((resolve) => { resolveReal = resolve; })
      : Promise.resolve({ data: stats({ stances: [{ stance: 'balanced', count: 9 }] }) })));
    renderPage();

    await user.click(screen.getByRole('button', { name: /Auto-generated/ }));
    expect(await screen.findByText('Balanced')).toBeInTheDocument();

    resolveReal({ data: stats() });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.queryByText('Offensive')).not.toBeInTheDocument();
    expect(statsCalls()[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('says so when the filter has no robots', async () => {
    mockGet.mockImplementation(() => Promise.resolve({
      data: stats({
        stances: [],
        loadouts: [],
        yieldThresholds: { distribution: [], mostCommon: 10, mostCommonCount: 0 },
        facilities: { summary: [], totalPurchases: 0, mostPopular: '' },
      }),
    }));
    renderPage('?filter=automaton');

    const stances = await screen.findByRole('region', { name: 'Stances' });
    expect(within(stances).getByText('No robots')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Yield thresholds' })).getByText('No robots')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Facilities' })).getByText('No facilities owned yet')).toBeInTheDocument();
  });
});
