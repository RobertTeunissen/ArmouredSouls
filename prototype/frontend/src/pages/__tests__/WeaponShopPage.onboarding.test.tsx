/**
 * Tests for WeaponShopPage onboarding integration
 *
 * Test coverage:
 * - Onboarding mode detection via URL param
 * - Onboarding banner display
 * - Budget-friendly filters auto-applied in onboarding mode
 * - Guided overlay on first load
 * - Navigation back to onboarding after weapon purchase
 * - Back to Tutorial button
 * - Normal mode behavior preserved
 *
 * Requirements: 10.1-10.14
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import WeaponShopPage from '../WeaponShopPage';
import { AuthProvider } from '../../contexts/AuthContext';
import apiClient from '../../utils/apiClient';

// Mock apiClient
vi.mock('../../utils/apiClient');

// Mock react-router-dom navigate and searchParams
const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  };
});

// Mock GuidedUIOverlay
vi.mock('../../components/onboarding/GuidedUIOverlay', () => ({
  default: ({ tooltipContent, onClose }: any) => (
    <div data-testid="guided-overlay">
      <div data-testid="overlay-content">{tooltipContent}</div>
      {onClose && <button data-testid="overlay-close" onClick={onClose}>Close</button>}
    </div>
  ),
}));

// Mock Navigation component
vi.mock('../../components/Navigation', () => ({
  default: () => <nav data-testid="navigation">Navigation</nav>,
}));

// Mock child components to simplify rendering
vi.mock('../../components/ViewModeToggle', () => ({
  default: () => <div data-testid="view-mode-toggle">ViewModeToggle</div>,
}));

vi.mock('../../components/FilterPanel', () => ({
  default: ({ filters }: any) => (
    <div data-testid="filter-panel" data-can-afford={filters.canAffordOnly} data-price-max={filters.priceRange?.max}>
      FilterPanel
    </div>
  ),
  // Re-export the WeaponFilters type
}));

vi.mock('../../components/ActiveFiltersDisplay', () => ({
  default: () => <div data-testid="active-filters">ActiveFilters</div>,
}));

vi.mock('../../components/ComparisonBar', () => ({
  default: () => <div data-testid="comparison-bar">ComparisonBar</div>,
}));

vi.mock('../../components/ComparisonModal', () => ({
  default: () => <div data-testid="comparison-modal">ComparisonModal</div>,
}));

vi.mock('../../components/WeaponDetailModal', () => ({
  default: () => <div data-testid="weapon-detail-modal">WeaponDetailModal</div>,
}));

vi.mock('../../components/ConfirmationModal', () => ({
  default: ({ title, message, onConfirm }: any) => (
    <div data-testid="confirmation-modal">
      <span data-testid="modal-title">{title}</span>
      <span data-testid="modal-message">{message}</span>
      <button data-testid="modal-confirm" onClick={onConfirm}>Confirm</button>
    </div>
  ),
}));

vi.mock('../../components/WeaponTable', () => ({
  default: () => <div data-testid="weapon-table">WeaponTable</div>,
}));

// Mock weapon images
vi.mock('../../utils/weaponImages', () => ({
  getWeaponImagePath: (name: string) => `/images/${name}.png`,
}));

const mockWeapons = [
  {
    id: 1,
    name: 'Laser Rifle',
    weaponType: 'energy',
    loadoutType: 'single',
    handsRequired: 'one',
    description: 'A precise energy weapon',
    baseDamage: 50,
    cost: 244000,
    cooldown: 3,
    combatPowerBonus: 2,
    targetingSystemsBonus: 3,
    criticalSystemsBonus: 0,
    penetrationBonus: 0,
    weaponControlBonus: 0,
    attackSpeedBonus: 0,
    armorPlatingBonus: 0,
    shieldCapacityBonus: 0,
    evasionThrustersBonus: 0,
    counterProtocolsBonus: 0,
    servoMotorsBonus: 0,
    gyroStabilizersBonus: 0,
    hydraulicSystemsBonus: 0,
    powerCoreBonus: 0,
    threatAnalysisBonus: 0,
  },
  {
    id: 2,
    name: 'Machine Gun',
    weaponType: 'ballistic',
    loadoutType: 'single',
    handsRequired: 'one',
    description: 'A reliable ballistic weapon',
    baseDamage: 40,
    cost: 150000,
    cooldown: 2,
    combatPowerBonus: 0,
    targetingSystemsBonus: 0,
    criticalSystemsBonus: 0,
    penetrationBonus: 0,
    weaponControlBonus: 2,
    attackSpeedBonus: 3,
    armorPlatingBonus: 0,
    shieldCapacityBonus: 0,
    evasionThrustersBonus: 0,
    counterProtocolsBonus: 0,
    servoMotorsBonus: 0,
    gyroStabilizersBonus: 0,
    hydraulicSystemsBonus: 0,
    powerCoreBonus: 0,
    threatAnalysisBonus: 0,
  },
];

const mockStorageStatus = {
  currentWeapons: 1,
  maxCapacity: 5,
  remainingSlots: 4,
  isFull: false,
  percentageFull: 20,
};

describe('WeaponShopPage - Onboarding Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();

    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'token') return 'mock-jwt-token';
      return null;
    });
  });

  const setupMocks = () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/user/profile') {
        return Promise.resolve({
          data: {
            id: 1,
            username: 'testuser',
            email: 'test@test.com',
            role: 'player',
            currency: 2000000,
            prestige: 0,
          },
        });
      }
      if (url === '/api/weapons') {
        return Promise.resolve({ data: mockWeapons });
      }
      if (url === '/api/weapon-inventory') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/api/facilities') {
        return Promise.resolve({ data: { facilities: [] } });
      }
      if (url === '/api/weapon-inventory/storage-status') {
        return Promise.resolve({ data: mockStorageStatus });
      }
      if (url === '/api/onboarding/state') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              currentStep: 7,
              hasCompletedOnboarding: false,
              onboardingSkipped: false,
              strategy: '1_mighty',
              choices: {},
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
  };

  const renderInOnboardingMode = () => {
    setupMocks();
    mockSearchParams = new URLSearchParams('onboarding=true');
    return render(
      <MemoryRouter initialEntries={['/weapons?onboarding=true']}>
        <AuthProvider>
          <WeaponShopPage />
        </AuthProvider>
      </MemoryRouter>,
    );
  };

  const renderInNormalMode = () => {
    setupMocks();
    mockSearchParams = new URLSearchParams();
    return render(
      <MemoryRouter initialEntries={['/weapons']}>
        <AuthProvider>
          <WeaponShopPage />
        </AuthProvider>
      </MemoryRouter>,
    );
  };

  describe('Onboarding Mode Detection', () => {
    it('should show onboarding banner when onboarding=true param is present', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        expect(screen.getByText('Tutorial Step 7: Weapon Purchase')).toBeInTheDocument();
      });
    });

    it('should not show onboarding banner in normal mode', async () => {
      renderInNormalMode();
      await waitFor(() => {
        expect(screen.getByText('Weapon Shop')).toBeInTheDocument();
      });
      expect(screen.queryByText('Tutorial Step 7: Weapon Purchase')).not.toBeInTheDocument();
    });
  });

  describe('Onboarding Banner Content', () => {
    it('should display tutorial guidance text', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        expect(screen.getByText(/Browse the weapons below and purchase one/)).toBeInTheDocument();
      });
    });

    it('should show Back to Tutorial button', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        expect(screen.getByText('Back to Tutorial')).toBeInTheDocument();
      });
    });

    it('should navigate to /onboarding when Back to Tutorial is clicked', async () => {
      const user = userEvent.setup();
      renderInOnboardingMode();

      await waitFor(() => {
        expect(screen.getByText('Back to Tutorial')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Back to Tutorial'));

      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });
  });

  describe('Budget Filters in Onboarding Mode', () => {
    it('should auto-apply canAffordOnly filter in onboarding mode', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        const filterPanel = screen.getByTestId('filter-panel');
        expect(filterPanel.getAttribute('data-can-afford')).toBe('true');
      });
    });

    it('should auto-apply price range max of 300000 in onboarding mode', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        const filterPanel = screen.getByTestId('filter-panel');
        expect(filterPanel.getAttribute('data-price-max')).toBe('300000');
      });
    });

    it('should NOT auto-apply filters in normal mode', async () => {
      renderInNormalMode();
      await waitFor(() => {
        const filterPanel = screen.getByTestId('filter-panel');
        expect(filterPanel.getAttribute('data-can-afford')).toBe('false');
      });
    });
  });

  describe('Guided Overlay', () => {
    it('should show guided overlay in onboarding mode after loading', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        expect(screen.getByTestId('guided-overlay')).toBeInTheDocument();
      });
    });

    it('should not show guided overlay in normal mode', async () => {
      renderInNormalMode();
      await waitFor(() => {
        expect(screen.getByText('Weapon Shop')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('guided-overlay')).not.toBeInTheDocument();
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

    it('should display guidance about choosing a weapon', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        expect(screen.getByText('Choose a Weapon')).toBeInTheDocument();
      });
    });
  });

  describe('Normal Mode Preserved', () => {
    it('should render weapon shop title in normal mode', async () => {
      renderInNormalMode();
      await waitFor(() => {
        expect(screen.getByText('Weapon Shop')).toBeInTheDocument();
      });
    });

    it('should render filter panel in normal mode', async () => {
      renderInNormalMode();
      await waitFor(() => {
        expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
      });
    });
  });
});
