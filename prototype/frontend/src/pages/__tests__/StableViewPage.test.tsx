import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// --- Mocks ---

const mockNavigate = vi.fn();

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

import apiClient from '../../utils/apiClient';
import StableViewPage from '../StableViewPage';

// --- Test data ---

function buildStableResponse(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 42,
      username: 'rival_player',
      stableName: 'Iron Wolves',
      prestige: 12500,
      prestigeRank: 'Elite',
      championshipTitles: 3,
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
      },
    ],
    facilities: [
      { type: 'repair_bay', name: 'Repair Bay', level: 3, maxLevel: 10 },
      { type: 'combat_training_academy', name: 'Combat Training Academy', level: 5, maxLevel: 10 },
    ],
    stats: {
      totalBattles: 45,
      totalWins: 30,
      totalLosses: 10,
      totalDraws: 5,
      winRate: 66.7,
      highestElo: 1500,
      activeRobots: 1,
    },
    ...overrides,
  };
}

// --- Helpers ---

function renderPage(userId = '42') {
  return render(
    <MemoryRouter initialEntries={[`/stables/${userId}`]}>
      <StableViewPage />
    </MemoryRouter>,
  );
}

// --- Tests ---

describe('StableViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Requirement 8.3 — loading indicator
  it('renders loading state while fetching', () => {
    // Never resolve the promise so we stay in loading
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading stable...')).toBeInTheDocument();
  });

  // Requirement 8.1 — 404 error state
  it('renders 404 error state with "Stable not found" and back link', async () => {
    vi.mocked(apiClient.get).mockRejectedValue({ response: { status: 404 } });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Stable not found')).toBeInTheDocument();
    });
    // Back link present
    expect(screen.getByText(/go back/i)).toBeInTheDocument();
  });

  // Requirement 8.2 — network error state
  it('renders network error state with retry button', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network Error'));
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load stable. Please try again.'),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  // Requirement 8.4 — empty robots
  it('renders "This stable has no robots yet" when robots array is empty', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: buildStableResponse({ robots: [] }),
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('This stable has no robots yet')).toBeInTheDocument();
    });
  });

  // Requirements 1.1, 1.3, 4.5 — stable header
  it('renders stable header with username, prestige, prestige rank title, championship titles', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: buildStableResponse(),
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Iron Wolves')).toBeInTheDocument();
    });
    expect(screen.getByText('12,500')).toBeInTheDocument(); // prestige formatted
    expect(screen.getByText('Elite')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // championship titles
  });

  // Requirements 4.2, 4.3, 4.4 — stable statistics
  it('renders stable statistics (total battles, wins, losses, draws, win rate, highest ELO, active robots)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: buildStableResponse(),
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Stable Statistics')).toBeInTheDocument();
    });

    // Verify each stat label is present
    expect(screen.getByText('Total Battles')).toBeInTheDocument();
    expect(screen.getByText('Total Wins')).toBeInTheDocument();
    expect(screen.getByText('Total Losses')).toBeInTheDocument();
    expect(screen.getByText('Total Draws')).toBeInTheDocument();
    expect(screen.getByText('Win Rate')).toBeInTheDocument();
    expect(screen.getByText('Highest ELO')).toBeInTheDocument();
    expect(screen.getByText('Active Robots')).toBeInTheDocument();

    // Verify stat values by checking the value next to each label
    // Use the stat card structure: label div followed by value div
    const statsSection = screen.getByText('Stable Statistics').closest('div.bg-surface')!;
    expect(statsSection).toBeTruthy();

    // Win rate and highest ELO are unique enough to check directly
    expect(screen.getByText('66.7%')).toBeInTheDocument();
    expect(screen.getByText('1,500')).toBeInTheDocument();
  });

  // Requirements 3.2, 3.3, 3.4 — facility groups with level progress
  it('renders facility groups with level progress indicators ("Level X/Y")', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: buildStableResponse(),
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Facilities')).toBeInTheDocument();
    });
    // Category headings
    expect(screen.getByText('Economy & Discounts')).toBeInTheDocument();
    expect(screen.getByText('Training Academies')).toBeInTheDocument();
    // Facility names
    expect(screen.getByText('Repair Bay')).toBeInTheDocument();
    expect(screen.getByText('Combat Training Academy')).toBeInTheDocument();
    // Level progress indicators
    expect(screen.getByText('Level 3/10')).toBeInTheDocument();
    expect(screen.getByText('Level 5/10')).toBeInTheDocument();
  });

  // Requirement 2.7 — robot card navigation
  it('robot cards navigate to /robots/:id on click', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: buildStableResponse(),
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Titan')).toBeInTheDocument();
    });

    // The RobotDashboardCard renders a div with role="button"
    const card = screen.getByText('Titan').closest('[role="button"]');
    expect(card).toBeTruthy();
    fireEvent.click(card!);
    expect(mockNavigate).toHaveBeenCalledWith('/robots/10');
  });

  // Requirement 6.5 — back button
  it('back button navigates to previous page', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: buildStableResponse(),
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Iron Wolves')).toBeInTheDocument();
    });

    const backButton = screen.getByText('← Back');
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
