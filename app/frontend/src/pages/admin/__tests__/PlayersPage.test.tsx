/**
 * PlayersPage: segment cards, the human-stable list (filter, search, sort,
 * pages), the stable search, the detail panel for every stable type and the
 * password reset. Every control is exercised.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import PlayersPage from '../PlayersPage';
import type { PlayerDetail, PlayerRow, PlayersOverview } from '../../../utils/adminPlayersApi';

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

const NOW = '2026-10-30T12:00:00.000Z';
const hoursAgo = (h: number): string => new Date(new Date(NOW).getTime() - h * 3_600_000).toISOString();

function row(overrides: Partial<PlayerRow> & Pick<PlayerRow, 'userId' | 'username'>): PlayerRow {
  return {
    stableName: null, robots: 2, battles: 100, wins: 50, winRate: 50, currency: 500_000,
    lastLoginAt: hoursAgo(1), createdAt: '2026-03-28T00:00:00.000Z', segment: 'active', issues: [],
    ...overrides,
  };
}

const PLAYERS: PlayerRow[] = [
  row({ userId: 1, username: 'alpha', stableName: 'Alpha Stable', lastLoginAt: hoursAgo(0.25), battles: 1128, winRate: 41, currency: 7_442, issues: [{ code: 'low_balance', label: 'Low balance' }] }),
  row({ userId: 2, username: 'bravo', stableName: 'Bravo Stable', lastLoginAt: hoursAgo(2) }),
  row({ userId: 3, username: 'charlie', stableName: null, lastLoginAt: hoursAgo(24 * 5), segment: 'inactive' }),
  row({ userId: 4, username: 'delta', stableName: 'Delta Stable', lastLoginAt: null, createdAt: '2026-04-01T00:00:00.000Z', robots: 0, battles: 0, winRate: null, currency: 3_000_000, segment: 'dormant', issues: [{ code: 'onboarding_stuck', label: 'Stuck in onboarding (step 3)' }, { code: 'no_robots', label: 'No robots' }] }),
];

function overview(players: PlayerRow[] = PLAYERS): PlayersOverview {
  return {
    seasonNumber: 1,
    seasonStartedAt: '2026-08-01T00:00:00.000Z',
    thresholds: { lowBalance: 10_000, inactiveAfterDays: 3 },
    counts: {
      all: players.length,
      active: players.filter((p) => p.segment === 'active').length,
      inactive: players.filter((p) => p.segment === 'inactive').length,
      dormant: players.filter((p) => p.segment === 'dormant').length,
      onboardingStuck: players.filter((p) => p.issues.some((i) => i.code === 'onboarding_stuck')).length,
      lowBalance: players.filter((p) => p.issues.some((i) => i.code === 'low_balance')).length,
    },
    players,
    timestamp: NOW,
  };
}

function detail(overrides: Partial<PlayerDetail> = {}): PlayerDetail {
  return {
    id: 1, username: 'alpha', stableName: 'Alpha Stable', stableKind: 'human', automatonKey: null, role: 'user',
    currency: 7_442, createdAt: '2026-03-28T00:00:00.000Z', lastLoginAt: hoursAgo(0.5), segment: 'active',
    onboarding: { completed: true, skipped: false, currentStep: 9 }, battles: 1128, wins: 462, winRate: 41,
    issues: [{ code: 'low_balance', label: 'Low balance' }],
    cashflow: {
      points: [
        { cycle: 87, balance: 51_000, earned: 90_000, runningCosts: 60_000, bought: 0 },
        { cycle: 88, balance: 7_442, earned: 70_000, runningCosts: 80_000, bought: 33_558 },
      ],
      earned: 160_000, runningCosts: 140_000, bought: 33_558, lowBalanceCycles: 1,
    },
    robots: [{
      id: 10, name: 'Iron Warden', elo: 1412, hpPercent: 82, battleReady: true, mainWeapon: 'Vibro Mace', offhandWeapon: 'Combat Shield',
      loadout: 'weapon_shield', stance: 'defensive', wins: 462, losses: 655, draws: 11,
      tiers: { league_1v1: 'silver', koth: 'bronze' }, subscriptions: ['league_1v1', 'koth'],
    }],
    teams: [{ id: 5, name: 'Iron Pair', size: 2, tiers: { league_2v2: 'gold' } }],
    facilities: [{ type: 'repair_bay', level: 2 }, { type: 'merchandising_hub', level: 1 }],
    ...overrides,
  };
}

const AUTOMATON = detail({ id: 77, username: 't55amt_x', stableName: 'Kamino Clone Legion', stableKind: 'automaton', automatonKey: 'clone-legion', segment: null, issues: [], lastLoginAt: null });

let details: Record<number, PlayerDetail>;
let searchResults: unknown[];

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  details = { 1: detail(), 77: AUTOMATON };
  searchResults = [
    { id: 77, username: 't55amt_x', stableName: 'Kamino Clone Legion', stableKind: 'automaton' },
    { id: 1, username: 'alpha', stableName: 'Alpha Stable', stableKind: 'human' },
  ];
  mockGet.mockImplementation(async (url: string) => {
    if (url === '/api/admin/players') return { data: overview() };
    if (url === '/api/admin/users/search') return { data: { users: searchResults } };
    const match = /^\/api\/admin\/users\/(\d+)$/.exec(url);
    if (match) {
      const found = details[Number(match[1])];
      if (found) return { data: found };
      throw Object.assign(new Error('Request failed'), { isAxiosError: true, response: { status: 404, data: { error: 'User not found', code: 'USER_NOT_FOUND' } } });
    }
    throw new Error(`unexpected GET ${url}`);
  });
});

function LocationProbe(): React.ReactElement {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

const search = (): URLSearchParams => new URLSearchParams(screen.getByTestId('location').textContent ?? '');

function renderPage(path = '/admin/players') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/players" element={<><PlayersPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const listRegion = (): HTMLElement => screen.getByRole('region', { name: 'Human stables' });
const stableNames = (): string[] => within(within(listRegion()).getAllByRole('table')[0]).getAllByRole('button', { name: /^Open / }).map((b) => b.textContent ?? '');

describe('PlayersPage', () => {
  it('shows the segment cards and every human stable, last login first', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: /Active\s*2/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Inactive\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dormant\s*1\s*no login this season/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stuck in onboarding\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Low balance\s*1\s*below ₡10,000/ })).toBeInTheDocument();
    expect(screen.getByText(/Active \+ Inactive \+ Dormant = 4/)).toBeInTheDocument();
    expect(within(listRegion()).getByRole('status')).toHaveTextContent('All · 4 of 4');
    expect(stableNames()).toEqual(['Alpha Stable@alpha', 'Bravo Stable@bravo', 'charlie@charlie', 'Delta Stable@delta']);
    const alpha = within(listRegion()).getAllByRole('row')[1];
    expect(within(alpha).getByText('₡7,442')).toHaveClass('text-error');
    expect(within(alpha).getByText('15 min ago')).toBeInTheDocument();
    expect(within(alpha).getByText('41%')).toBeInTheDocument();
    expect(within(alpha).getByText('Low balance')).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('/api/admin/players', expect.anything());
  });

  it('filters by segment card and clears it on a second press', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Dormant/ }));
    expect(search().get('segment')).toBe('dormant');
    expect(screen.getByRole('button', { name: /Dormant/ })).toHaveAttribute('aria-pressed', 'true');
    expect(stableNames()).toEqual(['Delta Stable@delta']);
    await user.click(screen.getByRole('button', { name: /Stuck in onboarding/ }));
    expect(search().get('segment')).toBe('onboarding');
    expect(stableNames()).toEqual(['Delta Stable@delta']);
    await user.click(screen.getByRole('button', { name: /Stuck in onboarding/ }));
    expect(search().has('segment')).toBe(false);
    expect(stableNames()).toHaveLength(4);
  });

  it('opens Low balance from the dashboard link and the old ?tab=at-risk link', async () => {
    renderPage('/admin/players?tab=at-risk');
    expect(await screen.findByRole('button', { name: /Low balance/ })).toHaveAttribute('aria-pressed', 'true');
    expect(stableNames()).toEqual(['Alpha Stable@alpha']);
    expect(within(listRegion()).getByRole('status')).toHaveTextContent('Low balance · 1 of 4');
  });

  it('searches the list, sorts by a header and clears filters when nothing matches', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: /Active/ });
    await user.type(within(listRegion()).getByRole('searchbox', { name: 'Search this list' }), 'bravo');
    expect(search().get('q')).toBe('bravo');
    expect(stableNames()).toEqual(['Bravo Stable@bravo']);
    await user.clear(within(listRegion()).getByRole('searchbox', { name: 'Search this list' }));

    const table = within(listRegion()).getAllByRole('table')[0];
    await user.click(within(table).getByRole('button', { name: /^Balance/ }));
    expect(search().get('sort')).toBe('balance:desc');
    expect(within(table).getByRole('columnheader', { name: /^Balance/ })).toHaveAttribute('aria-sort', 'descending');
    expect(stableNames()[0]).toBe('Delta Stable@delta');
    await user.click(within(table).getByRole('button', { name: /^Balance/ }));
    expect(search().get('sort')).toBe('balance:asc');
    expect(stableNames()[0]).toBe('Alpha Stable@alpha');

    await user.type(within(listRegion()).getByRole('searchbox', { name: 'Search this list' }), 'nobody');
    expect(await within(listRegion()).findByText('No human stable matches these filters.')).toBeInTheDocument();
    await user.click(within(listRegion()).getByRole('button', { name: 'Clear filters' }));
    expect(search().has('q')).toBe(false);
    expect(stableNames()).toHaveLength(4);
  });

  it('pages a long list 25 stables at a time', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 30 }, (_, i) => row({ userId: 100 + i, username: `p${String(i).padStart(2, '0')}`, lastLoginAt: hoursAgo(i + 1) }));
    mockGet.mockImplementation(async (url: string) => ({ data: url === '/api/admin/players' ? overview(many) : {} }));
    renderPage();
    const pages = await screen.findByRole('navigation', { name: 'Stables pages' });
    expect(within(pages).getByText('Showing 1–25 of 30 stables')).toBeInTheDocument();
    await user.click(within(pages).getByRole('button', { name: 'Next' }));
    expect(search().get('page')).toBe('2');
    expect(within(screen.getByRole('navigation', { name: 'Stables pages' })).getByText('Showing 26–30 of 30 stables')).toBeInTheDocument();
    await user.click(within(screen.getByRole('navigation', { name: 'Stables pages' })).getByRole('button', { name: 'Previous' }));
    expect(search().has('page')).toBe(false);
  });

  it('opens a player from the list with tiers, teams, facilities, links and the balance trend', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: /Active/ });
    await user.click(within(listRegion()).getAllByRole('button', { name: 'Open Alpha Stable' })[0]);
    expect(search().get('user')).toBe('1');
    const panel = await screen.findByRole('dialog', { name: 'Alpha Stable' });
    expect(within(panel).getByText('@alpha · #1 · joined 28 Mar 2026')).toBeInTheDocument();
    expect(within(panel).getByText('Player')).toBeInTheDocument();
    expect(within(panel).getByText('₡7,442')).toHaveClass('text-error');
    expect(within(panel).getByText('1,128 · 41% won')).toBeInTheDocument();
    expect(within(panel).getByRole('img', { name: /cycle 87 ₡51,000, cycle 88 ₡7,442/ })).toBeInTheDocument();
    expect(panel).toHaveTextContent(/Earned ₡160k · running costs ₡140k · bought ₡34k/);
    expect(within(panel).getByRole('link', { name: /Iron Warden/ })).toHaveAttribute('href', '/robots/10');
    expect(within(panel).getByText(/Vibro Mace \+ Combat Shield · Weapon \+ shield · Defensive/)).toBeInTheDocument();
    expect(within(panel).getByText('Silver')).toBeInTheDocument();
    expect(within(panel).getByText('Subscribed: 1v1 League, King of the Hill')).toBeInTheDocument();
    expect(within(panel).getByText('2v2 League Gold')).toBeInTheDocument();
    expect(within(panel).getByText('Repair bay')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /Battles of this stable/ })).toHaveAttribute('href', '/admin/battles?q=Alpha%20Stable&range=7d');
    expect(within(panel).getByRole('link', { name: /Stable page/ })).toHaveAttribute('href', '/stables/1');
    expect(within(panel).queryByRole('link', { name: /Open in Editor/ })).toBeNull();

    await user.click(within(panel).getByRole('button', { name: 'Close panel' }));
    expect(search().has('user')).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('finds any stable, and an Automaton opens with its Editor link and no password reset', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByRole('searchbox', { name: 'Find any stable' }), 'kamino');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    const results = await screen.findByRole('list', { name: 'Search results' });
    expect(mockGet).toHaveBeenCalledWith('/api/admin/users/search', expect.objectContaining({ params: { q: 'kamino' } }));
    const first = within(results).getAllByRole('button')[0];
    expect(first).toHaveTextContent('Automaton');
    expect(first).toHaveTextContent('Kamino Clone Legion');
    await user.click(first);
    const panel = await screen.findByRole('dialog', { name: 'Kamino Clone Legion' });
    expect(within(panel).getByRole('link', { name: /Open in Editor/ })).toHaveAttribute('href', '/admin/automatons?tab=editor&stable=clone-legion');
    expect(within(panel).queryByRole('button', { name: 'Reset password' })).toBeNull();
    expect(within(panel).getByText('Automatons never log in, so there is no password to reset.')).toBeInTheDocument();
  });

  it('says when the search finds nothing', async () => {
    const user = userEvent.setup();
    searchResults = [];
    renderPage();
    await user.type(await screen.findByRole('searchbox', { name: 'Find any stable' }), 'zzz{Enter}');
    expect(await screen.findByText('No stable matches “zzz”.')).toBeInTheDocument();
  });

  it('opens the panel from a ?user= deep link and explains a deleted stable', async () => {
    renderPage('/admin/players?user=999');
    const panel = await screen.findByRole('dialog', { name: 'Stable' });
    expect(await within(panel).findByRole('alert')).toHaveTextContent('This stable no longer exists.');
  });

  it('checks the password rules before resetting, then resets', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({ data: { success: true, userId: 1, username: 'alpha' } });
    renderPage('/admin/players?user=1');
    const panel = await screen.findByRole('dialog', { name: 'Alpha Stable' });
    const reset = within(panel).getByRole('button', { name: 'Reset password' });
    await user.type(within(panel).getByLabelText('New password'), 'short');
    await user.click(reset);
    expect(within(panel).getByText('Password must be at least 8 characters')).toBeInTheDocument();
    await user.clear(within(panel).getByLabelText('New password'));
    await user.type(within(panel).getByLabelText('New password'), 'GoodPass1');
    await user.type(within(panel).getByLabelText('Confirm password'), 'GoodPass2');
    await user.click(reset);
    expect(within(panel).getByText('Passwords do not match')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
    await user.clear(within(panel).getByLabelText('Confirm password'));
    await user.type(within(panel).getByLabelText('Confirm password'), 'GoodPass1');
    await user.click(reset);
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/admin/users/1/reset-password', { password: 'GoodPass1' }));
    expect(await within(panel).findByRole('status')).toHaveTextContent('Password reset for alpha. They are signed out everywhere.');
  });

  it('shows a refused password reset', async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValue(Object.assign(new Error('Request failed'), { isAxiosError: true, response: { status: 429, data: { error: 'Too many password reset attempts. Try again later.', code: 'RATE_LIMIT_EXCEEDED' } } }));
    renderPage('/admin/players?user=1');
    const panel = await screen.findByRole('dialog', { name: 'Alpha Stable' });
    await user.type(within(panel).getByLabelText('New password'), 'GoodPass1');
    await user.type(within(panel).getByLabelText('Confirm password'), 'GoodPass1');
    await user.click(within(panel).getByRole('button', { name: 'Reset password' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Too many password reset attempts. Try again later.');
  });

  it('shows an error with Retry, and Refresh reloads', async () => {
    const user = userEvent.setup();
    let fail = true;
    mockGet.mockImplementation(async (url: string) => {
      if (url !== '/api/admin/players') return { data: {} };
      if (fail) throw new Error('boom');
      return { data: overview() };
    });
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load the players.');
    fail = false;
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: /Active\s*2/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(mockGet.mock.calls.filter(([url]) => url === '/api/admin/players')).toHaveLength(3));
  });
});
