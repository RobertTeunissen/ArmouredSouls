import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LeagueStandingsPage from '../LeagueStandingsPage';
import { useSeasonStore } from '../../stores/seasonStore';

const mockGet = vi.fn();
vi.mock('../../utils/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 414, username: 'SmashHit', stableName: 'ApenRots', role: 'user', currency: 0, prestige: 0 } }),
}));

const ME = { userId: 414, username: 'ApenRots', stableName: 'ApenRots', stableType: 'human' };
const BOT = { username: 'Zenith Engineering', stableName: 'Zenith Engineering', stableType: 'generated' };

const entries = [
  { mode: 'league_1v1', entityType: 'robot', entityId: 1, name: 'DunneAap', tier: 'champion', leagueInstanceId: 'champion_1', place: 10, instanceSize: 34, leaguePoints: 133, cyclesInTier: 5, minCycles: 5, status: null },
  { mode: 'league_1v1', entityType: 'robot', entityId: 3, name: 'StommeAap', tier: 'diamond', leagueInstanceId: 'diamond_1', place: 3, instanceSize: 12, leaguePoints: 123, cyclesInTier: 15, minCycles: 5, status: { kind: 'held_lp', zone: 'promotion', minLP: 125 } },
  { mode: 'koth', entityType: 'robot', entityId: 3, name: 'StommeAap', tier: 'platinum', leagueInstanceId: 'platinum_4', place: 2, instanceSize: 12, leaguePoints: 260, cyclesInTier: 9, minCycles: 10, status: { kind: 'held_cycles', zone: 'promotion', cyclesToGo: 1 } },
];

const robotRow = (rank: number, over: Record<string, unknown> = {}) => ({
  rank, id: 100 + rank, name: `AverageBot ${rank}`, elo: 1200, leaguePoints: 130 - rank, wins: 40, draws: 5, losses: 30,
  totalBattles: 75, userId: 900, cyclesInCurrentLeague: 10, leagueInstanceId: 'diamond_1', isSubscribed: true, user: BOT, status: null, ...over,
});

function zoneMeta(over: Record<string, unknown> = {}) {
  return {
    tier: 'diamond', minLP: 125, minCycles: 5, minRobotsRequired: 10, hasEnoughRobots: true, promotionSlots: 1, demotionSlots: 1,
    promotionBlockReason: null, totalEntities: 12, totalInstances: 1, activeInstances: 1, instancesBelowMinimum: 0,
    smallestInstancePopulation: 12, isChampion: false, isBronze: false, ...over,
  };
}

/** Diamond 1: 12 robots, StommeAap (ours) 3rd and held below 125 LP, GoreAap (ours) new and 11th. */
function diamondRows() {
  return Array.from({ length: 12 }, (_, i) => {
    const rank = i + 1;
    if (rank === 1) return robotRow(rank, { status: { kind: 'held_lp', zone: 'promotion', minLP: 125 } });
    if (rank === 3) return robotRow(rank, { id: 3, name: 'StommeAap', userId: 414, user: ME, status: null });
    if (rank === 11) return robotRow(rank, { id: 4, name: 'GoreAap', userId: 414, user: ME, cyclesInCurrentLeague: 0 });
    if (rank === 12) return robotRow(rank, { isSubscribed: false, status: { kind: 'held_cycles', zone: 'demotion', cyclesToGo: 3 } });
    return robotRow(rank);
  });
}

function respond(url: string, options?: { params?: Record<string, unknown> }) {
  const params = options?.params ?? {};
  if (url === '/api/leagues/my-standings') return Promise.resolve({ entries });
  const standings = url.match(/^\/api\/leagues\/(\w+)\/standings$/);
  if (standings) {
    const tier = standings[1];
    if (params.stables === 'players') {
      // The server keeps each player's place among every robot.
      const players = diamondRows().filter((row) => row.user === ME);
      return Promise.resolve({
        data: players,
        pagination: { page: 1, pageSize: Number(params.perPage), total: players.length, totalPages: 1 },
        zoneMeta: zoneMeta({ tier }),
      });
    }
    const rows = params.instance ? diamondRows() : diamondRows().slice(0, 5);
    return Promise.resolve({
      data: rows,
      pagination: { page: Number(params.page ?? 1), pageSize: Number(params.perPage), total: params.instance ? 12 : 120, totalPages: params.instance ? 1 : 3 },
      zoneMeta: zoneMeta({ tier, ...(params.instance ? {} : { totalEntities: 120, totalInstances: 2, activeInstances: 2 }), ...(params.mode === 'koth' ? { minLP: 0, minCycles: 10 } : {}) }),
    });
  }
  if (/^\/api\/leagues\/(\w+)\/instances$/.test(url)) {
    const tier = url.split('/')[3];
    return Promise.resolve([{ leagueId: `${tier}_2`, currentRobots: 60, players: 1 }, { leagueId: `${tier}_1`, currentRobots: 12, players: 2 }]);
  }
  if (url.includes('/tag-team-instances') || /\/team-battles\/leagues\/\d\/\w+\/instances$/.test(url)) return Promise.resolve([]);
  if (url.includes('/team-battles/leagues/')) {
    return Promise.resolve({ standings: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 }, zoneMeta: zoneMeta({ totalEntities: 0, totalInstances: 0, activeInstances: 0 }) });
  }
  return Promise.reject(new Error(`unmocked ${url}`));
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/league-standings" element={<><LeagueStandingsPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockImplementation(respond);
  useSeasonStore.setState(useSeasonStore.getInitialState());
  vi.mocked(localStorage.getItem).mockReturnValue(null);
  vi.mocked(localStorage.setItem).mockClear();
});

describe('LeagueStandingsPage — opening view', () => {
  it('opens on the viewer\'s best instance of the league', async () => {
    renderPage('/league-standings');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/league-standings?tier=champion&instance=champion_1'));
    expect(await screen.findByRole('heading', { name: 'Champion 1' })).toBeInTheDocument();
  });

  it('opens a league without entries on all of Bronze', async () => {
    renderPage('/league-standings?mode=3v3');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/league-standings?mode=3v3&tier=bronze'));
  });

  it('keeps a deep link from another page as it is', async () => {
    renderPage('/league-standings?mode=koth&tier=gold&instance=gold_1');
    expect(await screen.findByRole('heading', { name: 'Gold 1' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('mode=koth&tier=gold&instance=gold_1');
  });
});

describe('LeagueStandingsPage — league cards and chips', () => {
  it('shows where the stable stands in each league, and every league is reachable', async () => {
    renderPage('/league-standings?tier=diamond&instance=diamond_1');
    const solo = await screen.findByTestId('league-card-1v1');
    await waitFor(() => expect(solo).toHaveTextContent('2 robots in 2 tiers'));
    expect(solo).toHaveTextContent('Best: #10, Champion 1');
    expect(solo).toHaveTextContent('1 held below the LP minimum');
    expect(solo).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('league-card-koth')).toHaveTextContent('1 in a promotion place');
    const trio = screen.getByTestId('league-card-3v3');
    expect(trio).toHaveTextContent('No teams entered');
    expect(trio).toHaveAttribute('href', '/league-standings?mode=3v3');
  });

  it('counts the viewer\'s entries per tier and links a tier to their instance in it', async () => {
    renderPage('/league-standings?tier=diamond&instance=diamond_1');
    const champion = await screen.findByTestId('tier-chip-champion');
    await waitFor(() => expect(champion).toHaveTextContent('1 of yours'));
    expect(champion).toHaveAttribute('href', '/league-standings?tier=champion&instance=champion_1');
    expect(screen.getByTestId('tier-chip-bronze')).toHaveAttribute('href', '/league-standings?tier=bronze');
    expect(screen.getByTestId('tier-chip-diamond')).toHaveAttribute('aria-current', 'page');
  });

  it('lists instances in number order with the viewer\'s count, plus the whole tier', async () => {
    renderPage('/league-standings?tier=diamond&instance=diamond_1');
    const first = await screen.findByTestId('instance-chip-diamond_1');
    await waitFor(() => expect(first).toHaveTextContent('Diamond 1 · 12 · 1 yours'));
    const chips = within(screen.getByRole('navigation', { name: 'Diamond instances' })).getAllByRole('link');
    expect(chips.map((c) => c.textContent)).toEqual(['Diamond 1 · 12 · 1 yours', 'Diamond 2 · 60', 'All of Diamond · 72']);
    expect(screen.getByTestId('instance-chip-all')).toHaveAttribute('href', '/league-standings?tier=diamond');
  });
});

describe('LeagueStandingsPage — the instance list', () => {
  it('puts the zone places between bands and says why a place is held', async () => {
    renderPage('/league-standings?tier=diamond&instance=diamond_1');
    const table = await screen.findByTestId('standings-table');
    expect(within(table).getByTestId('zone-band-up')).toHaveTextContent('Promotion places · top 1');
    expect(within(table).getByTestId('zone-band-down')).toHaveTextContent('Demotion places · bottom 1');
    const rows = within(table).getAllByTestId('standings-row');
    expect(rows).toHaveLength(12);
    expect(within(rows[0]).getAllByTestId('standing-status')[0]).toHaveTextContent('Needs 125 LP');
    expect(within(rows[11]).getAllByTestId('standing-status')[0]).toHaveTextContent('3 cycles to go');
    expect(rows[11]).toHaveTextContent('Not entered');
    expect(screen.getByTestId('zone-summary')).toHaveTextContent('12 robots · top 1 go up to Champion, bottom 1 down to Platinum · moving needs 5 cycles in Diamond; going up also needs 125 LP');
  });

  it('marks the viewer\'s rows, links them to the Workshop and notes a robot new in the tier', async () => {
    renderPage('/league-standings?tier=diamond&instance=diamond_1');
    const rows = await screen.findAllByTestId('standings-row');
    const mine = rows.filter((r) => r.dataset.mine === 'true');
    expect(mine).toHaveLength(2);
    expect(within(mine[0]).getByRole('link', { name: 'StommeAap' })).toHaveAttribute('href', '/robots/3/prepare');
    expect(within(rows[0]).getByRole('link', { name: 'AverageBot 1' })).toHaveAttribute('href', '/robots/101');
    expect(mine[1]).toHaveTextContent('New in Diamond · 0 of 5 cycles');
    // The generated stable carries the "bot" chip.
    expect(within(rows[0]).getByTestId('record-bot-stable')).toBeInTheDocument();
  });

  it('shows ELO only in 1v1, and wins out of matches in placement leagues', async () => {
    const { unmount } = renderPage('/league-standings?tier=diamond&instance=diamond_1');
    expect(await screen.findByRole('columnheader', { name: 'ELO' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'W-D-L' })).toBeInTheDocument();
    unmount();
    renderPage('/league-standings?mode=koth&tier=diamond&instance=diamond_1');
    expect(await screen.findByRole('columnheader', { name: 'Wins / matches' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'ELO' })).not.toBeInTheDocument();
    expect(screen.getAllByText('40 / 75').length).toBeGreaterThan(0);
  });

  it('asks the API for the whole instance on one page, with the robot mode', async () => {
    renderPage('/league-standings?mode=grand_melee&tier=diamond&instance=diamond_1');
    await screen.findByTestId('standings-table');
    expect(mockGet).toHaveBeenCalledWith('/api/leagues/diamond/standings', { params: { page: 1, perPage: 100, instance: 'diamond_1', mode: 'grand_melee' } });
  });
});

describe('LeagueStandingsPage — whole tier', () => {
  it('pages through the tier without zone bands', async () => {
    const user = userEvent.setup();
    renderPage('/league-standings?tier=diamond');
    expect(await screen.findByRole('heading', { name: 'All of Diamond' })).toBeInTheDocument();
    expect(screen.queryByTestId('zone-band-up')).not.toBeInTheDocument();
    expect(screen.getByTestId('zone-summary')).toHaveTextContent('120 robots in 2 instances · top 10% of each instance go up to Champion');
    await user.click(within(screen.getByTestId('standings-pager')).getByRole('link', { name: 'Next' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/league-standings?tier=diamond&page=2');
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/leagues/diamond/standings', { params: { page: 2, perPage: 50, mode: 'league_1v1' } }));
  });
});

describe('LeagueStandingsPage — loading', () => {
  it('offers a retry when the standings fail', async () => {
    const user = userEvent.setup();
    let fail = true;
    mockGet.mockImplementation((url: string, options?: { params?: Record<string, unknown> }) =>
      (fail && url.endsWith('/standings') ? Promise.reject(new Error('down')) : respond(url, options)));
    renderPage('/league-standings?tier=diamond&instance=diamond_1');
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load the standings.');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('standings-table')).toBeInTheDocument();
  });

  it('never shows an older request\'s rows over a newer one', async () => {
    const user = userEvent.setup();
    let releaseSlow: () => void = () => {};
    mockGet.mockImplementation((url: string, options?: { params?: Record<string, unknown> }) => {
      if (url === '/api/leagues/diamond/standings' && options?.params?.instance === 'diamond_1') {
        return new Promise((resolve) => { releaseSlow = () => resolve(respond(url, options)); });
      }
      if (url === '/api/leagues/gold/standings') {
        return Promise.resolve({ data: [robotRow(1, { name: 'GoldBot' })], pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 }, zoneMeta: zoneMeta({ tier: 'gold', totalEntities: 1 }) });
      }
      return respond(url, options);
    });
    renderPage('/league-standings?tier=diamond&instance=diamond_1');
    await user.click(await screen.findByTestId('tier-chip-gold'));
    expect(await screen.findByRole('link', { name: 'GoldBot' })).toBeInTheDocument();
    releaseSlow();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByRole('link', { name: 'GoldBot' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'StommeAap' })).not.toBeInTheDocument();
  });
});

describe('LeagueStandingsPage — Players filter (#595)', () => {
  it('lists only players with their real places, counts players per instance and drops the bands', async () => {
    const user = userEvent.setup();
    renderPage('/league-standings?tier=diamond&instance=diamond_1');
    await screen.findByTestId('standings-table');
    expect(screen.getByTestId('zone-band-up')).toBeInTheDocument();

    const control = screen.getByRole('group', { name: 'Stables' });
    expect(within(control).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(control).getByRole('button', { name: 'Players' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('stables=players'));
    expect(localStorage.setItem).toHaveBeenCalledWith('stableFilter', 'players');
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/leagues/diamond/standings', { params: { page: 1, perPage: 100, instance: 'diamond_1', stables: 'players', mode: 'league_1v1' } }));
    const rows = await screen.findAllByTestId('standings-row');
    expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(['3', '11']);
    expect(screen.queryByTestId('zone-band-up')).not.toBeInTheDocument();
    expect(screen.getByTestId('players-summary')).toHaveTextContent('2 players among 12 robots in Diamond 1. Places count every robot');
    expect(screen.getByTestId('instance-chip-diamond_1')).toHaveTextContent('Diamond 1 · 2 players · 1 yours');
    expect(screen.getByTestId('instance-chip-all')).toHaveTextContent('All of Diamond · 3 players');
    expect(screen.getByTestId('instance-chip-diamond_2')).toHaveAttribute('href', '/league-standings?tier=diamond&instance=diamond_2&stables=players');
  });

  it('opens filtered when Players is remembered, and puts it in the URL', async () => {
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => (key === 'stableFilter' ? 'players' : null));
    renderPage('/league-standings?tier=diamond&instance=diamond_1');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/league-standings?tier=diamond&instance=diamond_1&stables=players'));
    expect(await screen.findByTestId('players-summary')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Stables' })).getByRole('button', { name: 'Players' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the filter when the page picks its opening view', async () => {
    renderPage('/league-standings?stables=players');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/league-standings?tier=champion&instance=champion_1&stables=players'));
  });

  it('goes back to every stable with "Show all stables"', async () => {
    const user = userEvent.setup();
    renderPage('/league-standings?tier=diamond&instance=diamond_1&stables=players');
    await user.click(await screen.findByRole('button', { name: 'Show all stables' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/league-standings?tier=diamond&instance=diamond_1'));
    expect(screen.getByTestId('location')).not.toHaveTextContent('stables');
    expect(localStorage.setItem).toHaveBeenCalledWith('stableFilter', 'all');
    expect(await screen.findAllByTestId('standings-row')).toHaveLength(12);
  });

  it('shows each robot\'s group in the whole-tier view', async () => {
    renderPage('/league-standings?tier=diamond');
    expect(await screen.findByRole('columnheader', { name: 'Group' })).toBeInTheDocument();
    expect(within(screen.getAllByTestId('standings-row')[0]).getByText('Diamond 1')).toBeInTheDocument();
  });
});
