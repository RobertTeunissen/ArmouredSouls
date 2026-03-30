/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for DashboardPage onboarding welcome section integration.
 *
 * Test coverage:
 * - "Start Your Journey" display for brand new users (step 1)
 * - "Resume Tutorial" display for partially completed users (step > 1)
 * - Original "Welcome to Your Stable!" for completed/skipped users
 * - Navigation to /onboarding on button clicks
 * - Progress bar rendering for partial completion
 * - Fallback when onboarding state fetch fails
 * - No welcome section when user has robots
 *
 * Requirements: 1.1, 1.3
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
vi.mock('../../utils/robotApi', () => ({
  fetchMyRobots: (...args: unknown[]) => mockFetchMyRobots(...args),
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

vi.mock('../../components/TagTeamReadinessWarning', () => ({
  default: () => <div data-testid="tag-team-warning">TagTeamWarning</div>,
}));

vi.mock('../../components/DashboardOnboardingBanner', () => ({
  default: () => <div data-testid="onboarding-banner-mock">OnboardingBanner</div>,
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

describe('DashboardPage - Onboarding Welcome Section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchMyRobots.mockResolvedValue([]);

    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'token') return 'mock-jwt-token';
      return null;
    });
  });

  describe('New User (step 1, not completed)', () => {
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

    it('should display "Start Your Journey" heading for new users', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('Start Your Journey')).toBeInTheDocument();
      });
    });

    it('should display "Learn strategic decisions in 9 guided steps" description', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('Learn strategic decisions in 9 guided steps')).toBeInTheDocument();
      });
    });

    it('should display "Begin Interactive Tutorial" button', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /begin interactive tutorial/i })).toBeInTheDocument();
      });
    });

    it('should navigate to /onboarding when "Begin Interactive Tutorial" is clicked', async () => {
      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /begin interactive tutorial/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /begin interactive tutorial/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });

    it('should NOT display the old 4-step guide', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('Start Your Journey')).toBeInTheDocument();
      });
      expect(screen.queryByText('Welcome to Your Stable!')).not.toBeInTheDocument();
      expect(screen.queryByText('1. Upgrade Facilities')).not.toBeInTheDocument();
    });
  });

  describe('Partially Completed User (step > 1, not completed)', () => {
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

    it('should display "Welcome Back!" heading', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('Welcome Back!')).toBeInTheDocument();
      });
    });

    it('should display "Continue from Step 2 of 5"', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('Continue from Step 2 of 5')).toBeInTheDocument();
      });
    });

    it('should display "Resume Tutorial" button', async () => {
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

    it('should render a progress bar', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('Welcome Back!')).toBeInTheDocument();
      });
      // Progress bar: (5-1)/9 * 100 ≈ 44.4%
      const progressBar = document.querySelector('[style*="width"]');
      expect(progressBar).toBeInTheDocument();
    });

    it('should NOT display the old 4-step guide', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('Welcome Back!')).toBeInTheDocument();
      });
      expect(screen.queryByText('Welcome to Your Stable!')).not.toBeInTheDocument();
      expect(screen.queryByText('1. Upgrade Facilities')).not.toBeInTheDocument();
    });
  });

  describe('Completed User (hasCompletedOnboarding = true)', () => {
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

    it('should display "Welcome to Your Stable!" for completed users', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('Welcome to Your Stable!')).toBeInTheDocument();
      });
    });

    it('should display the 4-step getting started guide', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('1. Upgrade Facilities')).toBeInTheDocument();
        expect(screen.getByText('2. Create Your Robot')).toBeInTheDocument();
        expect(screen.getByText('3. Equip Weapons')).toBeInTheDocument();
        expect(screen.getByText('4. Enter Battles')).toBeInTheDocument();
      });
    });

    it('should display "Get Started" button that navigates to /facilities', async () => {
      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /get started/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/facilities');
    });

    it('should NOT display onboarding tutorial buttons', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('Welcome to Your Stable!')).toBeInTheDocument();
      });
      expect(screen.queryByText('Begin Interactive Tutorial')).not.toBeInTheDocument();
      expect(screen.queryByText('Resume Tutorial')).not.toBeInTheDocument();
    });
  });

  describe('Skipped User (onboardingSkipped = true)', () => {
    it('should display "Welcome to Your Stable!" for skipped users', async () => {
      mockGetTutorialState.mockResolvedValue({
        currentStep: 3,
        hasCompletedOnboarding: false,
        onboardingSkipped: true,
        strategy: null,
        choices: {},
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
      });

      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('Welcome to Your Stable!')).toBeInTheDocument();
      });
      expect(screen.queryByText('Resume Tutorial')).not.toBeInTheDocument();
    });
  });

  describe('Fallback (onboarding state fetch fails)', () => {
    it('should display "Welcome to Your Stable!" when onboarding fetch fails', async () => {
      mockGetTutorialState.mockRejectedValue(new Error('Network error'));

      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('Welcome to Your Stable!')).toBeInTheDocument();
      });
    });
  });

  describe('User with robots (no welcome section)', () => {
    it('should not display any welcome section when user has robots', async () => {
      mockFetchMyRobots.mockResolvedValue([
        { id: 1, name: 'TestBot', elo: 1500, currentHP: 100, maxHP: 100 },
      ]);
      mockGetTutorialState.mockResolvedValue({
        currentStep: 1,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        strategy: null,
        choices: {},
        startedAt: null,
        completedAt: null,
      });

      renderDashboard();
      await waitFor(() => {
        expect(screen.getByTestId('robot-card')).toBeInTheDocument();
      });
      expect(screen.queryByText('Start Your Journey')).not.toBeInTheDocument();
      expect(screen.queryByText('Welcome to Your Stable!')).not.toBeInTheDocument();
    });
  });

  describe('Different step progress display', () => {
    it('should display correct step number for step 8', async () => {
      mockGetTutorialState.mockResolvedValue({
        currentStep: 8,
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        strategy: '2_average',
        choices: {},
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
      });

      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('Continue from Step 4 of 5')).toBeInTheDocument();
      });
    });
  });
});
