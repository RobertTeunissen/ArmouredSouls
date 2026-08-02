/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for DashboardPage notification system.
 *
 * Test coverage:
 * - Welcome notification for brand new users (step 1, no robots)
 * - Resume tutorial notification for partially completed users
 * - "No robots yet" notification when roster is empty
 * - No onboarding notifications when completed/skipped with robots
 * - Robot readiness notifications (no weapon, no subscriptions)
 * - Navigation on action button clicks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../DashboardPage';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock apiClient
vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

// Mock onboardingApi
const mockGetTutorialState = vi.fn();
vi.mock('../../utils/onboardingApi', () => ({
  getTutorialState: (...args: unknown[]) => mockGetTutorialState(...args),
}));

// Mock robotApi
const mockFetchMyRobots = vi.fn();
const mockFetchTuningAllocation = vi.fn();
vi.mock('../../utils/robotApi', () => ({
  fetchMyRobots: (...args: unknown[]) => mockFetchMyRobots(...args),
  fetchTuningAllocation: (...args: unknown[]) => mockFetchTuningAllocation(...args),
}));

// Mock teamBattleApi
vi.mock('../../utils/teamBattleApi', () => ({
  getMyTeamBattles: vi.fn().mockResolvedValue([]),
}));

// Mock api utility
vi.mock('../../utils/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ changes: [] }),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock child components to simplify rendering
vi.mock('../../components/Navigation', () => ({
  default: () => <nav data-testid="navigation">Navigation</nav>,
}));

vi.mock('../../components/UpcomingMatches', () => ({
  default: () => <div data-testid="upcoming-matches">UpcomingMatches</div>,
}));

vi.mock('../../components/RecentMatches', () => ({
  default: () => <div data-testid="recent-matches">RecentMatches</div>,
}));

vi.mock('../../components/FinancialSummary', () => ({
  default: () => <div data-testid="financial-summary">FinancialSummary</div>,
}));

vi.mock('../../components/RobotDashboardCard', () => ({
  default: ({ robot }: any) => <div data-testid="robot-card">{robot.name}</div>,
}));

vi.mock('../../components/StableStatistics', () => ({
  default: () => <div data-testid="stable-statistics">StableStatistics</div>,
}));

vi.mock('../../components/ChangelogModal', () => ({
  default: () => null,
}));

vi.mock('../../components/season/SeasonPhaseCard', () => ({
  default: () => null,
}));

vi.mock('../../components/LeagueStandingsSummary', () => ({
  default: () => null,
}));

vi.mock('../../components/ActiveTournamentCard', () => ({
  default: () => null,
}));

// Mock stores
vi.mock('../../stores', () => ({
  useRobotStore: (selector: any) => {
    const state = { robots: mockFetchMyRobots._robots ?? [], loading: false, error: null, fetchRobots: vi.fn() };
    return selector(state);
  },
  useStableStore: (selector: any) => {
    const state = { fetchStableData: vi.fn(), currency: 1000000, loading: false, error: null, financialSummary: null, stats: null };
    return selector(state);
  },
}));

vi.mock('../../stores/seasonStore', () => ({
  useSeasonStore: (selector: any) => {
    if (typeof selector === 'function') return selector({ season: null, failed: false, dismissedBanner: null, dismissBanner: vi.fn() });
    return null;
  },
  selectSeason: (s: any) => s.season,
  selectShouldShowCountdown: () => () => false,
}));

vi.mock('../../stores/subscriptionStore', () => ({
  useSubscriptionStore: (selector: any) => {
    const state = { overview: null, loading: false, error: null, fetchOverview: vi.fn(), refresh: vi.fn(), lastFetched: null, inFlight: null, invalidate: vi.fn() };
    return selector(state);
  },
}));

const mockUser = {
  id: 1,
  username: 'testplayer',
  stableName: 'Test Stable',
  currency: 3000000,
  email: 'test@test.com',
  role: 'player',
  prestige: 0,
};

// Mock useAuth
vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: any) => <>{children}</>,
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn(),
  }),
}));

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthProvider>
        <DashboardPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('DashboardPage - Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchMyRobots._robots = [];
    mockFetchMyRobots.mockResolvedValue([]);
    mockFetchTuningAllocation.mockResolvedValue({ robotId: 1, facilityLevel: 0, poolSize: 0, allocated: 0, remaining: 0, perAttributeMaxes: {}, allocations: {} });

    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'token') return 'mock-jwt-token';
      return null;
    });
  });

  describe('New User (step 1, no robots)', () => {
    beforeEach(() => {
      mockGetTutorialState.mockResolvedValue({
        currentStep: 1,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        strategy: null,
        choices: {},
        startedAt: null,
        completedAt: null,
      });
    });

    it('should display welcome message for new users', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('Welcome to Armoured Souls!')).toBeInTheDocument();
      });
    });

    it('should display "Begin Tutorial" action button', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /begin tutorial/i })).toBeInTheDocument();
      });
    });

    it('should navigate to /onboarding when "Begin Tutorial" is clicked', async () => {
      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /begin tutorial/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /begin tutorial/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });

    it('should display "no robots yet" notification', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("You don't have any robots yet")).toBeInTheDocument();
      });
    });

    it('should display "Create Robot" action button', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create robot/i })).toBeInTheDocument();
      });
    });
  });

  describe('Partially Completed User (step > 1, no robots)', () => {
    beforeEach(() => {
      mockGetTutorialState.mockResolvedValue({
        currentStep: 5,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        strategy: '1_mighty',
        choices: { rosterStrategy: '1_mighty' },
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
      });
    });

    it('should display tutorial in progress notification', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText(/Tutorial in progress/)).toBeInTheDocument();
      });
    });

    it('should display "Resume Tutorial" action button', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /resume tutorial/i })).toBeInTheDocument();
      });
    });

    it('should navigate to /onboarding when "Resume Tutorial" is clicked', async () => {
      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /resume tutorial/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /resume tutorial/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });
  });

  describe('Completed/Skipped User with no robots', () => {
    beforeEach(() => {
      mockGetTutorialState.mockResolvedValue({
        currentStep: 9,
        hasCompletedOnboarding: true,
        onboardingSkipped: false,
        strategy: '2_average',
        choices: {},
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: '2026-01-01T01:00:00Z',
      });
    });

    it('should show "no robots" notification but no tutorial notification', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("You don't have any robots yet")).toBeInTheDocument();
      });
      expect(screen.queryByText(/Tutorial in progress/)).not.toBeInTheDocument();
      expect(screen.queryByText('Welcome to Armoured Souls!')).not.toBeInTheDocument();
    });
  });

  describe('User with robots but incomplete onboarding', () => {
    beforeEach(() => {
      mockFetchMyRobots._robots = [
        { id: 1, name: 'TestBot', elo: 1500, currentHP: 100, maxHP: 100, mainWeaponId: 1 },
      ];
      mockGetTutorialState.mockResolvedValue({
        currentStep: 3,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        strategy: null,
        choices: {},
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
      });
    });

    it('should show tutorial reminder as notification', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText(/Tutorial in progress/)).toBeInTheDocument();
      });
    });

    it('should NOT show "no robots" notification', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByTestId('robot-card')).toBeInTheDocument();
      });
      expect(screen.queryByText("You don't have any robots yet")).not.toBeInTheDocument();
    });
  });

  describe('Robot readiness - no weapon', () => {
    beforeEach(() => {
      mockFetchMyRobots._robots = [
        { id: 1, name: 'Unarmed Bot', elo: 1000, currentHP: 100, maxHP: 100, mainWeaponId: null },
      ];
      mockGetTutorialState.mockResolvedValue({
        currentStep: 9,
        hasCompletedOnboarding: true,
        onboardingSkipped: false,
        strategy: null,
        choices: {},
        startedAt: null,
        completedAt: '2026-01-01T01:00:00Z',
      });
    });

    it('should show "no weapon equipped" notification', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText(/Unarmed Bot has no weapon equipped/)).toBeInTheDocument();
      });
    });

    it('should have "Equip Weapon" action button', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /equip weapon/i })).toBeInTheDocument();
      });
    });

    it('should navigate to robot page when "Equip Weapon" is clicked', async () => {
      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /equip weapon/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /equip weapon/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/robots/1');
    });
  });

  describe('Prestige unlock notification', () => {
    beforeEach(() => {
      mockFetchMyRobots._robots = [
        { id: 1, name: 'Bot', elo: 1200, currentHP: 100, maxHP: 100, mainWeaponId: 1 },
      ];
      mockGetTutorialState.mockResolvedValue({
        currentStep: 9,
        hasCompletedOnboarding: true,
        onboardingSkipped: false,
        strategy: null,
        choices: {},
        startedAt: null,
        completedAt: '2026-01-01T01:00:00Z',
      });
    });

    it('should not show prestige notification when prestige is below 1000', async () => {
      mockUser.prestige = 500;
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByTestId('robot-card')).toBeInTheDocument();
      });
      expect(screen.queryByText(/facilities unlocked/)).not.toBeInTheDocument();
    });

    it('should show prestige notification when prestige crosses a gate', async () => {
      mockUser.prestige = 3500;
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText(/L5 facilities unlocked/)).toBeInTheDocument();
      });
    });

    it('should show "View Facilities" action button', async () => {
      mockUser.prestige = 3500;
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /view facilities/i })).toBeInTheDocument();
      });
    });

    afterEach(() => {
      mockUser.prestige = 0; // reset for other tests
    });
  });
});
