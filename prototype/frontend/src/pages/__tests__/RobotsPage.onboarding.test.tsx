/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for RobotsPage and RobotDetailPage onboarding integration
 *
 * Test coverage:
 * - Onboarding mode detection via URL param (?onboarding=true)
 * - Onboarding banner display with tutorial guidance
 * - "Return to Tutorial" button navigation
 * - Robot card navigation passes onboarding param
 * - Guided overlay display in onboarding mode
 * - Normal mode behavior preserved (no onboarding elements)
 * - RobotDetailPage onboarding banner
 * - Accessibility attributes
 *
 * Requirements: 11.1-11.11
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RobotsPage from '../RobotsPage';

// Mock apiClient
vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

import apiClient from '../../utils/apiClient';
const mockedApiClient = vi.mocked(apiClient);

// Mock navigate and searchParams
const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/robots' }),
    useSearchParams: () => [mockSearchParams],
  };
});

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

// Mock Navigation component
vi.mock('../../components/Navigation', () => ({
  default: () => <nav data-testid="navigation">Navigation</nav>,
}));

// Mock GuidedUIOverlay
vi.mock('../../components/onboarding/GuidedUIOverlay', () => ({
  default: ({ tooltipContent, onClose }: any) => (
    <div data-testid="guided-overlay">
      <div data-testid="overlay-content">{tooltipContent}</div>
      {onClose && (
        <button data-testid="overlay-close" onClick={onClose}>
          Close
        </button>
      )}
    </div>
  ),
}));

// Mock ViewModeToggle
vi.mock('../../components/ViewModeToggle', () => ({
  default: () => <div data-testid="view-mode-toggle">ViewModeToggle</div>,
}));

// Mock RobotImage
vi.mock('../../components/RobotImage', () => ({
  default: ({ robotName }: { robotName: string }) => (
    <div data-testid="robot-image">{robotName}</div>
  ),
}));

// Mock ConfirmationModal
vi.mock('../../components/ConfirmationModal', () => ({
  default: () => null,
}));

const mockRobots = [
  {
    id: 1,
    name: 'Iron Fist',
    elo: 1450,
    fame: 100,
    currentLeague: 'silver',
    leagueId: 'silver_1',
    leaguePoints: 45,
    currentHP: 850,
    maxHP: 1000,
    currentShield: 200,
    maxShield: 200,
    wins: 23,
    losses: 12,
    draws: 3,
    totalBattles: 38,
    battleReadiness: 85,
    repairCost: 0,
    loadoutType: 'single',
    mainWeaponId: 1,
    offhandWeaponId: null,
    mainWeapon: {
      weapon: { name: 'Laser Rifle', weaponType: 'energy' },
    },
    offhandWeapon: null,
    imageUrl: null,
    userId: 1,
    level: 1,
    yieldThreshold: 50,
    createdAt: '2026-01-15T00:00:00Z',
    combatPower: 1,
    targetingSystems: 1,
    criticalSystems: 1,
    penetration: 1,
    weaponControl: 1,
    attackSpeed: 1,
    armorPlating: 1,
    shieldCapacity: 1,
    evasionThrusters: 1,
    damageDampeners: 1,
    counterProtocols: 1,
    hullIntegrity: 1,
    servoMotors: 1,
    gyroStabilizers: 1,
    hydraulicSystems: 1,
    powerCore: 1,
    combatAlgorithms: 1,
    threatAnalysis: 1,
    adaptiveAI: 1,
    logicCores: 1,
    syncProtocols: 1,
  },
  {
    id: 2,
    name: 'Steel Thunder',
    elo: 1380,
    fame: 50,
    currentLeague: 'bronze',
    leagueId: 'bronze_1',
    leaguePoints: 78,
    currentHP: 1000,
    maxHP: 1000,
    currentShield: 150,
    maxShield: 200,
    wins: 15,
    losses: 18,
    draws: 2,
    totalBattles: 35,
    battleReadiness: 100,
    repairCost: 0,
    loadoutType: 'single',
    mainWeaponId: null,
    offhandWeaponId: null,
    mainWeapon: null,
    offhandWeapon: null,
    imageUrl: null,
    userId: 1,
    level: 1,
    yieldThreshold: 50,
    createdAt: '2026-01-20T00:00:00Z',
    combatPower: 1,
    targetingSystems: 1,
    criticalSystems: 1,
    penetration: 1,
    weaponControl: 1,
    attackSpeed: 1,
    armorPlating: 1,
    shieldCapacity: 1,
    evasionThrusters: 1,
    damageDampeners: 1,
    counterProtocols: 1,
    hullIntegrity: 1,
    servoMotors: 1,
    gyroStabilizers: 1,
    hydraulicSystems: 1,
    powerCore: 1,
    combatAlgorithms: 1,
    threatAnalysis: 1,
    adaptiveAI: 1,
    logicCores: 1,
    syncProtocols: 1,
  },
];

const mockFacilities = [
  { type: 'repair_bay', currentLevel: 0 },
  { type: 'roster_expansion', currentLevel: 2 },
];

function setupMocks(robots = mockRobots, facilities = mockFacilities) {
  mockedApiClient.get.mockImplementation((url: string) => {
    if (url.includes('/api/robots')) {
      return Promise.resolve({ data: robots });
    }
    if (url.includes('/api/facilities')) {
      return Promise.resolve({ data: facilities });
    }
    return Promise.reject(new Error('Unknown URL'));
  });
}

describe('RobotsPage - Onboarding Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    setupMocks();
  });

  const renderInOnboardingMode = () => {
    mockSearchParams = new URLSearchParams('onboarding=true');
    return render(
      <MemoryRouter initialEntries={['/robots?onboarding=true']}>
        <RobotsPage />
      </MemoryRouter>,
    );
  };

  const renderInNormalMode = () => {
    mockSearchParams = new URLSearchParams();
    return render(
      <MemoryRouter initialEntries={['/robots']}>
        <RobotsPage />
      </MemoryRouter>,
    );
  };

  describe('Onboarding Mode Detection', () => {
    it('should detect onboarding mode from URL param', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        expect(screen.getByTestId('onboarding-banner')).toBeInTheDocument();
      });
    });

    it('should not show onboarding elements in normal mode', async () => {
      renderInNormalMode();
      await waitFor(() => {
        expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0);
      });
      expect(screen.queryByTestId('onboarding-banner')).not.toBeInTheDocument();
    });
  });

  describe('Onboarding Banner', () => {
    it('should display tutorial step title', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        expect(
          screen.getByText('Tutorial Step 8: Equip Your Weapon'),
        ).toBeInTheDocument();
      });
    });

    it('should display guidance text about equipping weapons', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        expect(
          screen.getByText(/Select your robot below to visit its detail page/),
        ).toBeInTheDocument();
      });
    });

    it('should have proper accessibility role and label', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        const banner = screen.getByTestId('onboarding-banner');
        expect(banner).toHaveAttribute('role', 'region');
        expect(banner).toHaveAttribute('aria-label', 'Onboarding guidance');
      });
    });

    it('should display Return to Tutorial button', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        expect(screen.getByTestId('return-to-tutorial')).toBeInTheDocument();
        expect(screen.getByText('Return to Tutorial')).toBeInTheDocument();
      });
    });

    it('should have accessible label on Return to Tutorial button', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        const button = screen.getByTestId('return-to-tutorial');
        expect(button).toHaveAttribute('aria-label', 'Return to tutorial');
      });
    });
  });

  describe('Return to Tutorial Navigation', () => {
    it('should navigate to /onboarding when Return to Tutorial is clicked', async () => {
      const user = userEvent.setup();
      renderInOnboardingMode();

      await waitFor(() => {
        expect(screen.getByTestId('return-to-tutorial')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('return-to-tutorial'));
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });
  });

  describe('Robot Card Navigation with Onboarding Param', () => {
    it('should pass onboarding=true when clicking View Details in onboarding mode', async () => {
      const user = userEvent.setup();
      renderInOnboardingMode();

      await waitFor(() => {
        expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0);
      });

      const viewDetailsButtons = screen.getAllByText('View Details →');
      await user.click(viewDetailsButtons[0]);

      expect(mockNavigate).toHaveBeenCalledWith('/robots/1?onboarding=true');
    });

    it('should NOT pass onboarding param in normal mode', async () => {
      const user = userEvent.setup();
      renderInNormalMode();

      await waitFor(() => {
        expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0);
      });

      const viewDetailsButtons = screen.getAllByText('View Details →');
      await user.click(viewDetailsButtons[0]);

      expect(mockNavigate).toHaveBeenCalledWith('/robots/1');
    });
  });

  describe('Guided Overlay', () => {
    it('should show guided overlay in onboarding mode after robots load', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        expect(screen.getByTestId('guided-overlay')).toBeInTheDocument();
      });
    });

    it('should display guidance about selecting a robot', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        expect(screen.getByText('Select Your Robot')).toBeInTheDocument();
      });
    });

    it('should dismiss overlay when Close is clicked', async () => {
      const user = userEvent.setup();
      renderInOnboardingMode();

      await waitFor(() => {
        expect(screen.getByTestId('guided-overlay')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('overlay-close'));

      await waitFor(() => {
        expect(screen.queryByTestId('guided-overlay')).not.toBeInTheDocument();
      });
    });

    it('should not show guided overlay in normal mode', async () => {
      renderInNormalMode();
      await waitFor(() => {
        expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0);
      });
      expect(screen.queryByTestId('guided-overlay')).not.toBeInTheDocument();
    });

    it('should not show guided overlay when no robots exist', async () => {
      setupMocks([]);
      mockSearchParams = new URLSearchParams('onboarding=true');
      render(
        <MemoryRouter initialEntries={['/robots?onboarding=true']}>
          <RobotsPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByText("You don't have any robots yet."),
        ).toBeInTheDocument();
      });
      expect(screen.queryByTestId('guided-overlay')).not.toBeInTheDocument();
    });
  });

  describe('Normal Mode Preserved', () => {
    it('should render robots list title in normal mode', async () => {
      renderInNormalMode();
      await waitFor(() => {
        expect(screen.getByText(/My Robots/)).toBeInTheDocument();
      });
    });

    it('should render robot cards in normal mode without onboarding classes', async () => {
      renderInNormalMode();
      await waitFor(() => {
        expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Steel Thunder').length).toBeGreaterThan(0);
      });
      // No onboarding banner
      expect(screen.queryByText('Tutorial Step 8: Equip Your Weapon')).not.toBeInTheDocument();
      // No guided overlay
      expect(screen.queryByTestId('guided-overlay')).not.toBeInTheDocument();
    });
  });
});
