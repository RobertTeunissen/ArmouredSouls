/**
 * EconomyOverviewPage: the stable-type and window toggles (in the URL), the
 * KPIs, flows, per-cycle chart, balance bands, the per-type table, Refresh
 * and the error state.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import EconomyOverviewPage from '../EconomyOverviewPage';
import type { EconomyOverview, EconomyStableScope, EconomyWindow } from '../../../utils/adminEconomyApi';

const mockGet = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

function overview(stables: EconomyStableScope, window: EconomyWindow): EconomyOverview {
  const players = stables === 'players';
  return {
    scope: { stables, window, fromCycle: window === 'season' ? 1 : 82, toCycle: 88, cycles: window === 'season' ? 88 : 7 },
    kpis: {
      earned: players ? 315_000_000 : 371_000_000,
      spent: players ? 267_000_000 : 1_230_000_000,
      net: players ? 48_000_000 : -859_000_000,
      earnedPerCycle: 45_000_000, spentPerCycle: 38_000_000,
      repairsShareOfBattleIncome: players ? 18.4 : null,
      heldNow: 401_000_000, medianBalance: 3_100_000, stables: 87,
    },
    sources: [
      { key: 'battle_income', label: 'Battle income', amount: 267_000_000 },
      { key: 'streaming_revenue', label: 'Streaming', amount: 24_000_000 },
    ],
    sinks: [
      { key: 'attribute_upgrade', label: 'Attribute upgrades', amount: 143_000_000 },
      { key: 'repair_cost', label: 'Repairs', amount: 49_000_000 },
    ],
    perCycle: [{ cycle: 87, earned: 33_000_000, spent: 35_000_000 }, { cycle: 88, earned: 45_000_000, spent: 35_000_000 }],
    balanceBands: [
      { label: 'below ₡0', count: 1, negative: true },
      { label: '₡3–5M', count: 62, negative: false },
    ],
    byStableType: [
      { stables: 'players', count: 87, earned: 315_000_000, spent: 267_000_000, net: 48_000_000, heldNow: 401_000_000 },
      { stables: 'automatons', count: 500, earned: 371_000_000, spent: 1_230_000_000, net: -859_000_000, heldNow: 32_000_000 },
      { stables: 'generated', count: 3903, earned: 2_730_000_000, spent: 1_280_000_000, net: 1_450_000_000, heldNow: 6_120_000_000 },
    ],
    timestamp: '2026-10-30T12:00:00.000Z',
  };
}

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockImplementation(async (_url: string, config: { params: { stables: EconomyStableScope; window: EconomyWindow } }) => ({
    data: overview(config.params.stables, config.params.window),
  }));
});

function LocationProbe(): React.ReactElement {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

const search = (): URLSearchParams => new URLSearchParams(screen.getByTestId('location').textContent ?? '');

function renderPage(path = '/admin/economy') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/economy" element={<><EconomyOverviewPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EconomyOverviewPage', () => {
  it('defaults to players over 7 cycles and shows every block', async () => {
    renderPage();
    expect(await screen.findByText('₡315M', { selector: 'dd' })).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('/api/admin/economy', expect.objectContaining({ params: { stables: 'players', window: '7' } }));
    expect(screen.getByText(/^Scope:/)).toHaveTextContent('Scope: human stables, ledger cycles 82–88 (7 closed cycles');
    expect(screen.getByText('+₡48.0M', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('18.4%')).toBeInTheDocument();
    expect(screen.getByText('median ₡3.10M · 87 stables')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Income by source' })).getByText('Battle income')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Spending by sink' })).getByText('Attribute upgrades')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /cycle 87 earned ₡33.0M, spent ₡35.0M; cycle 88 earned ₡45.0M/ })).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Stables per balance band' })).getByText('62')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: /per stable type/ });
    expect(within(table).getByText('−₡859M')).toHaveClass('text-error');
    expect(within(table).getByText('₡6.12B')).toBeInTheDocument();
    expect(screen.queryByText(/Facility Popularity/i)).toBeNull();
  });

  it('switches stable type and window, keeping both in the URL', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('₡315M', { selector: 'dd' });
    await user.click(screen.getByRole('button', { name: 'Automatons' }));
    expect(search().get('stables')).toBe('automatons');
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/api/admin/economy', expect.objectContaining({ params: { stables: 'automatons', window: '7' } })));
    expect(await screen.findByText('₡371M', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('−₡859M', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Automatons' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Season' }));
    expect(search().get('window')).toBe('season');
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/api/admin/economy', expect.objectContaining({ params: { stables: 'automatons', window: 'season' } })));
    expect(await screen.findByText(/ledger cycles 1–88/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Players' }));
    await user.click(screen.getByRole('button', { name: '7 cycles' }));
    expect(search().has('stables')).toBe(false);
    expect(search().has('window')).toBe(false);
  });

  it('reads the toggles from a deep link', async () => {
    renderPage('/admin/economy?stables=all&window=30');
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/admin/economy', expect.objectContaining({ params: { stables: 'all', window: '30' } })));
    expect(await screen.findByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '30 cycles' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('refreshes past the cache', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('₡315M', { selector: 'dd' });
    await user.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/api/admin/economy', expect.objectContaining({ params: { stables: 'players', window: '7', fresh: 'true' } })));
  });

  it('shows an error with Retry', async () => {
    const user = userEvent.setup();
    mockGet.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load the economy.');
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('₡315M', { selector: 'dd' })).toBeInTheDocument();
  });
});
