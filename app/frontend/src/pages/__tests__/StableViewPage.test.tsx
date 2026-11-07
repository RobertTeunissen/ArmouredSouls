import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// --- Mocks ---

const mockNavigate = vi.fn();
const mockAuth = vi.hoisted(() => ({ user: { id: 1, userId: 1, username: 'test_user', role: 'user' } as { id: number } | null }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Navigation</div>,
}));

vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

import apiClient from '../../utils/apiClient';
import StableViewPage from '../StableViewPage';
import { useSeasonStore } from '../../stores/seasonStore';

// --- Test data ---

function buildStableResponse(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 42,
      username: 'rival_player',
      stableName: 'Iron Wolves',
      memberSince: '2026-03-29T08:33:28.636Z',
      prestige: 12500,
      prestigeRank: 'Elite',
      championshipTitles: 3,
      championshipTitles1v1: 0,
      championshipTitles2v2: 0,
      championshipTitles3v3: 3,
    },
    robots: [
      {
        id: 10,
        name: 'Titan',
        imageUrl: null,
        elo: 1500,
        currentLeague: 'gold',
        leaguePoints: 80,
        wins: 30,
        losses: 10,
        draws: 5,
        totalBattles: 45,
        fame: 2000,
        kills: 12,
        damageDealtLifetime: 50000,
        damageTakenLifetime: 30000,
        standings: [
          { mode: 'league_1v1', tier: 'gold', leaguePoints: 54, wins: 18, losses: 3, draws: 0, totalMatches: null, teamName: null },
          { mode: 'league_2v2', tier: 'champion', leaguePoints: 122, wins: 54, losses: 42, draws: 1, totalMatches: null, teamName: 'Wolfpack' },
          { mode: 'grand_melee', tier: 'champion', leaguePoints: 718, wins: 14, losses: 0, draws: 0, totalMatches: 50, teamName: null },
        ],
      },
      {
        id: 11,
        name: 'Rookie',
        imageUrl: null,
        elo: 1200,
        wins: 0, losses: 0, draws: 0, totalBattles: 0, fame: 0, kills: 0,
        damageDealtLifetime: 0, damageTakenLifetime: 0,
        standings: [],
      },
    ],
    facilities: [
      { type: 'repair_bay', name: 'Repair Bay', level: 3, maxLevel: 10 },
      { type: 'roster_expansion', name: 'Roster Expansion', level: 10, maxLevel: 10 },
    ],
    stats: {
      totalBattles: 45, totalWins: 30, totalLosses: 10, totalDraws: 5, winRate: 66.7, highestElo: 1500,
      activeRobots: 2, totalTeamBattles: 12, teamBattleWins: 8, teamBattleWinRate: 75.0,
    },
    achievements: {
      pinned: [],
      showcase: [
        { id: 'E30', name: 'To Infinity and Beyond', tier: 'hard', badgeIconFile: 'achievement-e30', unlockedAt: '2026-11-05T16:52:36.633Z', pinned: false, holders: 2 },
      ],
      totalUnlocked: 106,
      totalAvailable: 130,
    },
    recentResults: [
      {
        battleId: 612265, battleType: 'grand_melee', tier: 'champion', tournamentRound: null, createdAt: '2026-11-06T17:24:17.283Z',
        entries: [{ robotId: 10, robotName: 'Titan', outcome: null, placement: 1 }],
      },
    ],
    accolades: [
      { seasonNumber: 0, category: 'mostKills', rank: 1, subjectName: 'Smasher', value: 470, valueLabel: 'kills', mode: null },
    ],
    ...overrides,
  };
}

// --- Helpers ---

function renderPage(userId = '42') {
  return render(
    <MemoryRouter initialEntries={[`/stables/${userId}`]}>
      <Routes>
        <Route path="/stables/:userId" element={<StableViewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function serve(data: unknown): void {
  vi.mocked(apiClient.get).mockImplementation((url: string) =>
    url.startsWith('/api/stables/') ? Promise.resolve({ data }) : Promise.resolve({ data: [] }));
}

// --- Tests ---

describe('StableViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = { id: 1 };
    useSeasonStore.setState({
      season: {
        seasonNumber: 1, phase: 'competitive', seasonCycle: 95, seasonLengthCycles: 100,
        remainingCompetitiveCycles: 5, preparationDay: 0, remainingPreparationCycles: 0, isLegacy: false,
      },
    });
  });

  it('renders loading state while fetching', () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading stable...')).toBeInTheDocument();
  });

  it('renders 404 error state with "Stable not found" and back link', async () => {
    const axiosError = new Error('Request failed with status code 404') as Error & { isAxiosError: boolean; response: { status: number } };
    axiosError.isAxiosError = true;
    axiosError.response = { status: 404 };
    vi.mocked(apiClient.get).mockRejectedValue(axiosError);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Stable not found')).toBeInTheDocument();
    });
    expect(screen.getByText(/go back/i)).toBeInTheDocument();
  });

  it('renders network error state with retry button', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network Error'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load stable. Please try again.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders "This stable has no robots yet" when robots array is empty', async () => {
    serve(buildStableResponse({ robots: [] }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('This stable has no robots yet')).toBeInTheDocument();
    });
    // Nothing to summarise without robots.
    expect(screen.queryByRole('heading', { name: 'This season' })).toBeNull();
  });

  it('renders the header: name, rank, member since, season, titles and first places', async () => {
    serve(buildStableResponse());
    renderPage();

    const heading = await screen.findByRole('heading', { name: 'Iron Wolves' });
    const header = heading.closest('section') as HTMLElement;
    expect(within(header).getByText('Elite')).toBeInTheDocument();
    expect(within(header).getByText(/rival_player · Member since March 2026 · Season 1, cycle 95 of 100/)).toBeInTheDocument();
    expect(within(header).getByText('12,500')).toBeInTheDocument();
    expect(within(header).getByText(/3× 3v3 Tournament champion/)).toBeInTheDocument();
    expect(within(header).getByText(/#1 Most Kills · Season 0/)).toBeInTheDocument();
  });

  it('summarises the season by highest tier per robot and best tier per mode', async () => {
    serve(buildStableResponse());
    renderPage();

    const overview = (await screen.findByRole('heading', { name: 'This season' })).closest('section') as HTMLElement;
    expect(within(overview).getByText('1 Champion')).toBeInTheDocument();
    expect(within(overview).getByText('2v2 · Champion')).toBeInTheDocument();
    expect(within(overview).getByText('3v3 · –')).toBeInTheDocument();
  });

  it('shows each robot\'s highest tier over every mode, counting the modes at that tier', async () => {
    serve(buildStableResponse());
    renderPage();

    const roster = (await screen.findByRole('heading', { name: /Roster/ })).closest('section') as HTMLElement;
    // Champion in 2v2 and Grand Melee; only Gold in 1v1.
    expect(within(roster).getAllByText('Champion ×2').length).toBeGreaterThan(0);
    expect(within(roster).getAllByText('Not played').length).toBeGreaterThan(0);
    const cell = within(roster).getAllByTestId('mode-cell-league_2v2')[0];
    expect(cell).toHaveAccessibleName('League 2v2: Champion, Team Wolfpack · 54–42–1 · 122 LP');
    expect(within(roster).getAllByTestId('mode-cell-grand_melee')[0])
      .toHaveAccessibleName('Grand Melee: Champion, 14 first places in 50 · 718 LP');
    expect(within(roster).getByRole('link', { name: 'Titan' })).toHaveAttribute('href', '/robots/10');
  });

  it('sorts the roster by name', async () => {
    serve(buildStableResponse());
    renderPage();

    const roster = (await screen.findByRole('heading', { name: /Roster/ })).closest('section') as HTMLElement;
    const names = (): string[] => within(roster).getAllByRole('link').map((a) => a.textContent ?? '');
    expect(names()).toEqual(['Titan', 'Rookie']);
    fireEvent.click(within(roster).getByRole('button', { name: 'Sort by Robot' }));
    expect(names()).toEqual(['Rookie', 'Titan']);
  });

  it('switches to cards, which navigate to /robots/:id on click', async () => {
    serve(buildStableResponse());
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'cards' }));
    const roster = screen.getByRole('heading', { name: /Roster/ }).closest('section') as HTMLElement;
    const card = within(roster).getByText('Titan').closest('[role="button"]');
    expect(card).toBeTruthy();
    fireEvent.click(card!);
    expect(mockNavigate).toHaveBeenCalledWith('/robots/10');
  });

  it('fills the trophy cabinet without pins and shows rarity, with no Customise for visitors', async () => {
    serve(buildStableResponse());
    renderPage();

    const cabinet = (await screen.findByRole('heading', { name: 'Trophy cabinet' })).closest('section') as HTMLElement;
    expect(within(cabinet).getByText('To Infinity and Beyond')).toBeInTheDocument();
    expect(within(cabinet).getByText('Held by 2 players')).toBeInTheDocument();
    expect(within(cabinet).getByText(/106 of 130 achievements · rarest first/)).toBeInTheDocument();
    expect(within(cabinet).queryByRole('button', { name: 'Customise' })).toBeNull();
    expect(within(cabinet).queryByRole('link', { name: /All achievements/ })).toBeNull();
  });

  it('gives the owner a Customise button that opens the pinner', async () => {
    mockAuth.user = { id: 42 };
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.startsWith('/api/stables/')) return Promise.resolve({ data: buildStableResponse() });
      if (url === '/api/achievements') return Promise.resolve({ data: { achievements: [] } });
      return Promise.resolve({ data: [] });
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Customise' }));
    expect(await screen.findByText(/Pin Achievements/)).toBeInTheDocument();
  });

  it('lists recent results that open the battle', async () => {
    serve(buildStableResponse());
    renderPage();

    const recent = (await screen.findByRole('heading', { name: 'Recent results' })).closest('section') as HTMLElement;
    const link = within(recent).getByRole('link', { name: /Titan/ });
    expect(link).toHaveAttribute('href', '/battle/612265');
    expect(within(link).getByText('Grand Melee, Champion')).toBeInTheDocument();
    expect(within(link).getByText('1st')).toBeInTheDocument();
  });

  it('shows built facilities as chips, highest level first', async () => {
    serve(buildStableResponse());
    renderPage();

    const facilities = (await screen.findByRole('heading', { name: /Facilities/ })).closest('section') as HTMLElement;
    expect(within(facilities).getByText('2 of 14 built · 1 maxed')).toBeInTheDocument();
    const chips = within(facilities).getAllByRole('listitem').map((li) => li.textContent);
    expect(chips).toEqual(['Roster ExpansionMAX', 'Repair BayLevel 3/10']);
  });

  it('mounts the season history block on the stable page', async () => {
    serve(buildStableResponse());
    renderPage();

    await screen.findByRole('heading', { name: 'Iron Wolves' });
    expect(await screen.findByRole('heading', { name: /season history/i })).toBeInTheDocument();
  });

  it('back button navigates to previous page', async () => {
    serve(buildStableResponse());
    renderPage();

    await screen.findByRole('heading', { name: 'Iron Wolves' });
    fireEvent.click(screen.getByText('← Back'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
