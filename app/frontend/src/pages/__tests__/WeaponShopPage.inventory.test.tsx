/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for WeaponShopPage "My Inventory" tab (Spec #33).
 *
 * Coverage:
 * - Tab renders Available + Equipped sections in correct order with counts
 * - Equipped weapons appear only in the Equipped section with robot name + slot
 * - Equipped section is hidden when no weapons are equipped
 * - Empty-state message when all weapons are equipped
 * - Multi-robot equipped corner case
 * - Summary bar shows correct totals
 * - Sell button is enabled in Available, disabled in Equipped (with tooltip)
 * - Tab state persists in URL query string
 *
 * Spec #33 R5.1–R5.9, R6.1.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import WeaponShopPage from '../WeaponShopPage';
import { AuthProvider } from '../../contexts/AuthContext';
import apiClient from '../../utils/apiClient';

vi.mock('../../utils/apiClient');

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();
const mockSetSearchParams = vi.fn((next: URLSearchParams) => {
  mockSearchParams = next;
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  };
});

vi.mock('../../components/Navigation', () => ({
  default: () => <nav data-testid="navigation">Navigation</nav>,
}));

vi.mock('../../components/ViewModeToggle', () => ({
  default: () => <div data-testid="view-mode-toggle">ViewModeToggle</div>,
}));

vi.mock('../../components/FilterPanel', () => ({
  default: () => <div data-testid="filter-panel">FilterPanel</div>,
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
  default: () => <div data-testid="confirmation-modal">ConfirmationModal</div>,
}));

vi.mock('../../components/WeaponTable', () => ({
  default: () => <div data-testid="weapon-table">WeaponTable</div>,
}));

vi.mock('../../utils/weaponImages', () => ({
  getWeaponImagePath: (name: string) => `/images/${name}.png`,
}));

const mockWeapon1 = {
  id: 101,
  name: 'Plasma Rifle',
  weaponType: 'energy',
  loadoutType: 'single',
  handsRequired: 'one',
  description: 'Energy weapon',
  baseDamage: 50,
  cost: 200_000,
  cooldown: 3,
};

const mockWeapon2 = {
  id: 102,
  name: 'Auto Cannon',
  weaponType: 'ballistic',
  loadoutType: 'single',
  handsRequired: 'one',
  description: 'Ballistic weapon',
  baseDamage: 40,
  cost: 150_000,
  cooldown: 2,
};

const mockWeapon3 = {
  id: 103,
  name: 'Tower Shield',
  weaponType: 'shield',
  loadoutType: 'weapon_shield',
  handsRequired: 'shield',
  description: 'Shield',
  baseDamage: 0,
  cost: 100_000,
  cooldown: 0,
};

function setupApiMocks(opts: {
  inventory: any[];
  workshopLevel?: number;
}) {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url === '/api/user/profile') {
      return Promise.resolve({
        data: {
          id: 1, username: 'testuser', email: 'test@test.com',
          role: 'player', currency: 2_000_000, prestige: 0,
        },
      });
    }
    if (url === '/api/weapons') {
      return Promise.resolve({ data: [mockWeapon1, mockWeapon2, mockWeapon3] });
    }
    if (url === '/api/weapon-inventory') {
      return Promise.resolve({ data: opts.inventory });
    }
    if (url === '/api/facilities') {
      return Promise.resolve({
        data: {
          facilities: opts.workshopLevel
            ? [{ id: 1, type: 'weapons_workshop', facilityType: 'weapons_workshop', level: opts.workshopLevel, currentLevel: opts.workshopLevel }]
            : [],
        },
      });
    }
    if (url === '/api/weapon-inventory/storage-status') {
      return Promise.resolve({ data: { currentWeapons: opts.inventory.length, maxCapacity: 10, remainingSlots: 10 - opts.inventory.length, isFull: false, percentageFull: 50 } });
    }
    return Promise.resolve({ data: {} });
  });
}

function renderOnInventoryTab() {
  mockSearchParams = new URLSearchParams('tab=inventory');
  return render(
    <MemoryRouter initialEntries={['/weapons?tab=inventory']}>
      <AuthProvider>
        <WeaponShopPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('WeaponShopPage — My Inventory tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockSetSearchParams.mockClear();
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'token') return 'mock-jwt-token';
      return null;
    });
  });

  describe('Section ordering and counts', () => {
    it('renders Available and Equipped sections with correct counts', async () => {
      setupApiMocks({
        workshopLevel: 5,
        inventory: [
          { id: 1, weaponId: 101, pricePaid: 100_000, customName: null, purchasedAt: '2026-05-22T00:00:00Z', weapon: mockWeapon1, robotsMain: [], robotsOffhand: [], refinements: [] },
          { id: 2, weaponId: 102, pricePaid: 80_000, customName: null, purchasedAt: '2026-05-22T00:00:00Z', weapon: mockWeapon2, robotsMain: [{ id: 7, name: 'Iron Giant' }], robotsOffhand: [], refinements: [] },
          { id: 3, weaponId: 103, pricePaid: 50_000, customName: null, purchasedAt: '2026-05-22T00:00:00Z', weapon: mockWeapon3, robotsMain: [], robotsOffhand: [{ id: 7, name: 'Iron Giant' }], refinements: [] },
        ],
      });

      renderOnInventoryTab();

      await waitFor(() => {
        expect(screen.getByTestId('inventory-tab')).toBeInTheDocument();
      });

      expect(screen.getByText(/Available to Sell \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Equipped \(2\)/)).toBeInTheDocument();
    });

    it('hides Equipped section when no weapons are equipped', async () => {
      setupApiMocks({
        workshopLevel: 5,
        inventory: [
          { id: 1, weaponId: 101, pricePaid: 100_000, customName: null, purchasedAt: '2026-05-22T00:00:00Z', weapon: mockWeapon1, robotsMain: [], robotsOffhand: [], refinements: [] },
        ],
      });
      renderOnInventoryTab();

      await waitFor(() => {
        expect(screen.getByTestId('inventory-available-section')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('inventory-equipped-section')).not.toBeInTheDocument();
    });

    it('shows empty-state message when all weapons are equipped', async () => {
      setupApiMocks({
        workshopLevel: 5,
        inventory: [
          { id: 1, weaponId: 101, pricePaid: 100_000, customName: null, purchasedAt: '2026-05-22T00:00:00Z', weapon: mockWeapon1, robotsMain: [{ id: 7, name: 'Iron Giant' }], robotsOffhand: [], refinements: [] },
        ],
      });
      renderOnInventoryTab();

      await waitFor(() => {
        expect(screen.getByTestId('inventory-empty-state')).toBeInTheDocument();
      });
      expect(screen.getByTestId('inventory-empty-state').textContent).toMatch(/No unequipped weapons/i);
    });
  });

  describe('Equipped row details', () => {
    it('shows robot name and slot for each equipped weapon', async () => {
      setupApiMocks({
        workshopLevel: 3,
        inventory: [
          { id: 2, weaponId: 102, pricePaid: 80_000, customName: null, purchasedAt: '2026-05-22T00:00:00Z', weapon: mockWeapon2, robotsMain: [{ id: 7, name: 'Iron Giant' }], robotsOffhand: [], refinements: [] },
        ],
      });
      renderOnInventoryTab();

      await waitFor(() => {
        const row = screen.getByTestId('inventory-row-2');
        expect(within(row).getByText('Iron Giant')).toBeInTheDocument();
        expect(within(row).getByText(/\(Main\)/)).toBeInTheDocument();
      });
    });

    it('lists every robot name when a weapon is equipped on multiple robots', async () => {
      // Same WeaponInventory row referenced by Robot A's main AND Robot B's offhand
      // (real corner case from the API response shape)
      setupApiMocks({
        workshopLevel: 3,
        inventory: [
          {
            id: 5,
            weaponId: 102,
            pricePaid: 80_000,
            customName: null,
            purchasedAt: '2026-05-22T00:00:00Z',
            weapon: mockWeapon2,
            robotsMain: [{ id: 7, name: 'Iron Giant' }],
            robotsOffhand: [{ id: 8, name: 'Steel Beast' }],
            refinements: [],
          },
        ],
      });
      renderOnInventoryTab();

      await waitFor(() => {
        const row = screen.getByTestId('inventory-row-5');
        expect(within(row).getByText('Iron Giant')).toBeInTheDocument();
        expect(within(row).getByText('Steel Beast')).toBeInTheDocument();
      });
    });
  });

  describe('Sell button state', () => {
    it('Sell button is enabled in Available section', async () => {
      setupApiMocks({
        workshopLevel: 5,
        inventory: [
          { id: 1, weaponId: 101, pricePaid: 100_000, customName: null, purchasedAt: '2026-05-22T00:00:00Z', weapon: mockWeapon1, robotsMain: [], robotsOffhand: [], refinements: [] },
        ],
      });
      renderOnInventoryTab();

      await waitFor(() => {
        const button = screen.getByTestId('sell-button-1');
        expect(button).not.toBeDisabled();
      });
    });

    it('Sell button is disabled in Equipped section with tooltip naming the robot', async () => {
      setupApiMocks({
        workshopLevel: 5,
        inventory: [
          { id: 2, weaponId: 102, pricePaid: 80_000, customName: null, purchasedAt: '2026-05-22T00:00:00Z', weapon: mockWeapon2, robotsMain: [{ id: 7, name: 'Iron Giant' }], robotsOffhand: [], refinements: [] },
        ],
      });
      renderOnInventoryTab();

      await waitFor(() => {
        const button = screen.getByTestId('sell-button-2');
        expect(button).toBeDisabled();
        expect(button.getAttribute('title')).toMatch(/Iron Giant/);
      });
    });
  });

  describe('Summary bar', () => {
    it('shows correct totals at Workshop L3 (30% rate)', async () => {
      setupApiMocks({
        workshopLevel: 3,
        inventory: [
          { id: 1, weaponId: 101, pricePaid: 100_000, customName: null, purchasedAt: '2026-05-22T00:00:00Z', weapon: mockWeapon1, robotsMain: [], robotsOffhand: [], refinements: [] },
          { id: 2, weaponId: 102, pricePaid: 50_000, customName: null, purchasedAt: '2026-05-22T00:00:00Z', weapon: mockWeapon2, robotsMain: [], robotsOffhand: [], refinements: [] },
        ],
      });
      renderOnInventoryTab();

      await waitFor(() => {
        // Total resale: (100K + 50K) × 30% = 45K
        expect(screen.getByText(/₡45,000/)).toBeInTheDocument();
        // Workshop pill
        expect(screen.getByText(/Workshop L3/)).toBeInTheDocument();
        expect(screen.getByText(/30% resale/)).toBeInTheDocument();
      });
    });

    it('summary bar excludes equipped weapons from total', async () => {
      setupApiMocks({
        workshopLevel: 5,
        inventory: [
          { id: 1, weaponId: 101, pricePaid: 100_000, customName: null, purchasedAt: '2026-05-22T00:00:00Z', weapon: mockWeapon1, robotsMain: [], robotsOffhand: [], refinements: [] },
          { id: 2, weaponId: 102, pricePaid: 100_000, customName: null, purchasedAt: '2026-05-22T00:00:00Z', weapon: mockWeapon2, robotsMain: [{ id: 7, name: 'Iron Giant' }], robotsOffhand: [], refinements: [] },
        ],
      });
      renderOnInventoryTab();

      await waitFor(() => {
        expect(screen.getByTestId('inventory-tab')).toBeInTheDocument();
      });

      // Available count = 1, equipped count = 1
      expect(screen.getByText(/Available to Sell \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Equipped \(1\)/)).toBeInTheDocument();

      // Total resale value: only the available weapon (100K × 50% = 50K), NOT the equipped one
      // Multiple ₡50,000 matches exist (summary bar + row sell price for the available weapon),
      // so assert the summary section heading specifically.
      const summaryLabel = screen.getByText(/Total Resale Value/i);
      const summarySection = summaryLabel.closest('div');
      expect(summarySection?.textContent).toMatch(/₡50,000/);
    });
  });

  describe('Tab state persistence', () => {
    it('renders the Inventory tab when ?tab=inventory is in the URL', async () => {
      setupApiMocks({
        workshopLevel: 5,
        inventory: [],
      });
      renderOnInventoryTab();

      await waitFor(() => {
        expect(screen.getByTestId('inventory-tab')).toBeInTheDocument();
      });
    });

    it('renders the Catalog tab by default (no tab param)', async () => {
      setupApiMocks({
        workshopLevel: 5,
        inventory: [],
      });
      mockSearchParams = new URLSearchParams();
      render(
        <MemoryRouter initialEntries={['/weapons']}>
          <AuthProvider>
            <WeaponShopPage />
          </AuthProvider>
        </MemoryRouter>,
      );
      await waitFor(() => {
        // Catalog tab shows the FilterPanel; inventory tab does not
        expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
        expect(screen.queryByTestId('inventory-tab')).not.toBeInTheDocument();
      });
    });
  });
});
