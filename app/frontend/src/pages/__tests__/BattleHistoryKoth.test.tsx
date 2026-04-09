import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import BattleHistoryPage from '../BattleHistoryPage';
import { BattleHistory } from '../../utils/matchmakingApi';

// Mock Navigation component
vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Navigation</div>,
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useAuth
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser', email: 'test@test.com', role: 'user', currency: 1000, prestige: 0 },
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

// Mock tagTeamApi
vi.mock('../../utils/tagTeamApi', () => ({
  getTeamNameFromMatch: vi.fn(() => 'Team Name'),
}));

// Mock getMatchHistory
const mockGetMatchHistory = vi.fn();
vi.mock('../../utils/matchmakingApi', async () => {
  const actual = await vi.importActual('../../utils/matchmakingApi');
  return {
    ...actual,
    getMatchHistory: (...args: unknown[]) => mockGetMatchHistory(...args),
  };
});

function makeKothBattle(overrides: Partial<BattleHistory> = {}): BattleHistory {
  return {
    id: 200,
    battleType: 'koth',
    createdAt: '2026-03-20T12:00:00Z',
    winnerId: 10,
    robot1Id: 10,
    robot2Id: 20,
    robot1: { id: 10, name: 'IronClaw', userId: 1, user: { username: 'testuser' } },
    robot2: { id: 20, name: 'SteelFang', userId: 2, user: { username: 'opponent' } },
    robot1ELOBefore: 1200,
    robot1ELOAfter: 1200,
    robot2ELOBefore: 1150,
    robot2ELOAfter: 1150,
    robot1FinalHP: 80,
    robot2FinalHP: 0,
    winnerReward: 500,
    loserReward: 100,
    durationSeconds: 120,
    leagueType: 'koth',
    kothPlacement: 1,
    kothParticipantCount: 6,
    kothZoneScore: 32.5,
    kothRotatingZone: false,
    ...overrides,
  } as BattleHistory;
}

describe('BattleHistoryKoth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // localStorage is mocked in setupTests — configure getItem to return a token
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'token') return 'test-token';
      return null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderPage = () => {
    return render(
      <BrowserRouter>
        <BattleHistoryPage />
      </BrowserRouter>
    );
  };

  it('should show KotH filter option', async () => {
    mockGetMatchHistory.mockResolvedValue({
      data: [makeKothBattle()],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    renderPage();

    await waitFor(() => {
      const kothButton = screen.getByRole('button', { name: /KotH/i });
      expect(kothButton).toBeInTheDocument();
      expect(kothButton.textContent).toContain('👑');
    });
  });

  it('should show 👑 icon and orange border on KotH battle cards', async () => {
    mockGetMatchHistory.mockResolvedValue({
      data: [makeKothBattle()],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    renderPage();

    await waitFor(() => {
      // Verify 👑 icon is rendered on the battle card
      const crownIcons = screen.getAllByText('👑');
      // At least one crown should be on a battle card (not just the filter button)
      expect(crownIcons.length).toBeGreaterThanOrEqual(2); // filter button + card(s)

      // Verify orange border class on the card
      const card = crownIcons[1].closest('[class*="border-l-orange-500"]');
      expect(card).toBeTruthy();
    });
  });
});
