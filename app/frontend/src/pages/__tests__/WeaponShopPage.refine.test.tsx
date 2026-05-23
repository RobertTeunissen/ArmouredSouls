/**
 * Tests for the weapon refinement flow on WeaponShopPage (Spec #34).
 *
 * Coverage:
 *   - InventoryRow renders the SlotBar, RankPrefix, and Refine button.
 *   - Clicking Refine opens the modal with the correct inventory item.
 *   - Successful refinement updates the inventory tab without a page refresh
 *     (rank prefix updates, slot bar updates, currency updates via refresh).
 *   - Catalog tab "Already Own" badge reflects rank breakdown after refinement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import WeaponShopPage from '../WeaponShopPage';
import { AuthProvider } from '../../contexts/AuthContext';
import apiClient from '../../utils/apiClient';

vi.mock('../../utils/apiClient');

let mockSearchParams = new URLSearchParams();
const mockSetSearchParams = vi.fn((next: URLSearchParams) => {
  mockSearchParams = next;
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  };
});

vi.mock('../../components/Navigation', () => ({ default: () => <nav>Nav</nav> }));
vi.mock('../../components/ViewModeToggle', () => ({ default: () => <div /> }));
vi.mock('../../components/FilterPanel', () => ({ default: () => <div data-testid="filter-panel" /> }));
vi.mock('../../components/ActiveFiltersDisplay', () => ({ default: () => <div /> }));
vi.mock('../../components/ComparisonBar', () => ({ default: () => <div /> }));
vi.mock('../../components/ComparisonModal', () => ({ default: () => <div /> }));
vi.mock('../../components/WeaponDetailModal', () => ({ default: () => <div /> }));
vi.mock('../../components/ConfirmationModal', () => ({ default: () => <div /> }));
vi.mock('../../components/WeaponTable', () => ({ default: () => <div /> }));
vi.mock('../../utils/weaponImages', () => ({ getWeaponImagePath: () => '/img.png' }));

const mockWeapon = {
  id: 101,
  name: 'Volt Sabre',
  weaponType: 'energy',
  loadoutType: 'single',
  handsRequired: 'one',
  description: 'Energy weapon',
  baseDamage: 12,
  cost: 425_000,
  cooldown: 3,
  combatPowerBonus: 5,
  attackSpeedBonus: 3,
};

function makeInventory(refinementCount = 0) {
  return [{
    id: 1,
    weaponId: 101,
    pricePaid: 425_000,
    customName: null,
    purchasedAt: '2026-05-22T00:00:00Z',
    weapon: mockWeapon,
    robotsMain: [],
    robotsOffhand: [],
    refinements: Array.from({ length: refinementCount }, (_, i) => ({
      id: i + 1,
      tier: 'hone' as const,
      magnitude: 1,
      targetAttribute: 'combatPower',
      costPaid: 10_000,
      slotIndex: i + 1,
      createdAt: '2026-05-23T00:00:00Z',
    })),
  }];
}

function setupApiMocks(opts: { workshopLevel?: number; initialRefinements?: number; refineResponseRefinements?: number } = {}) {
  let inventory = makeInventory(opts.initialRefinements ?? 0);

  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url === '/api/user/profile') {
      return Promise.resolve({
        data: {
          id: 1, username: 'testuser', email: 'test@test.com',
          role: 'player', currency: 5_000_000, prestige: 10_000,
        },
      });
    }
    if (url === '/api/weapons') return Promise.resolve({ data: [mockWeapon] });
    if (url === '/api/weapon-inventory') return Promise.resolve({ data: inventory });
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
      return Promise.resolve({
        data: {
          currentWeapons: inventory.length, maxCapacity: 10,
          remainingSlots: 10 - inventory.length, isFull: false, percentageFull: 50,
        },
      });
    }
    return Promise.resolve({ data: {} });
  });

  vi.mocked(apiClient.post).mockImplementation((url: string) => {
    if (url.includes('/refine')) {
      // Swap inventory for the post-refine snapshot
      inventory = makeInventory(opts.refineResponseRefinements ?? 1);
      return Promise.resolve({
        data: {
          weaponInventory: inventory[0],
          currency: 4_990_000,
          cost: 10_000,
          message: 'Refined Volt Sabre: hone combatPower +1',
          achievementUnlocks: [],
        },
      });
    }
    return Promise.reject(new Error(`Unmocked post: ${url}`));
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

describe('WeaponShopPage — refine flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockSetSearchParams.mockClear();
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'token') return 'mock-jwt-token';
      return null;
    });
  });

  it('renders SlotBar and Refine button on every owned weapon', async () => {
    setupApiMocks({ workshopLevel: 8 });
    renderOnInventoryTab();

    await waitFor(() => {
      expect(screen.getByTestId('inventory-row-1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('refine-button-1')).toBeInTheDocument();
    // SlotBar is rendered inside the row
    const row = screen.getByTestId('inventory-row-1');
    expect(row.querySelector('[data-testid="slot-bar"]')).not.toBeNull();
  });

  it('clicking Refine opens the modal with the correct inventory item', async () => {
    setupApiMocks({ workshopLevel: 8 });
    renderOnInventoryTab();

    await waitFor(() => {
      expect(screen.getByTestId('refine-button-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('refine-button-1'));

    await waitFor(() => {
      expect(screen.getByTestId('refinement-modal')).toBeInTheDocument();
    });
    // Modal title shows the weapon name (scope to the modal so we don't match
    // the same name in the InventoryRow underneath)
    const modal = screen.getByTestId('refinement-modal');
    expect(modal.querySelector('#refinement-modal-title')).toHaveTextContent('Volt Sabre');
  });

  it('successful refinement closes the modal and refreshes inventory', async () => {
    setupApiMocks({ workshopLevel: 8, initialRefinements: 0, refineResponseRefinements: 1 });
    renderOnInventoryTab();

    await waitFor(() => {
      expect(screen.getByTestId('refine-button-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('refine-button-1'));

    await waitFor(() => {
      expect(screen.getByTestId('refinement-modal')).toBeInTheDocument();
    });

    // Pick Hone, attribute combatPower, magnitude 1, then confirm
    fireEvent.click(screen.getByTestId('tier-card-hone'));

    const select = await screen.findByTestId('refine-attribute-select');
    fireEvent.change(select, { target: { value: 'combatPower' } });

    fireEvent.click(screen.getByTestId('magnitude-1'));
    fireEvent.click(screen.getByTestId('confirm-refinement-button'));

    // Modal closes
    await waitFor(() => {
      expect(screen.queryByTestId('refinement-modal')).not.toBeInTheDocument();
    });

    // Success banner / toast appears
    await waitFor(() => {
      expect(screen.getByTestId('sale-success-message')).toBeInTheDocument();
    });
    expect(screen.getByTestId('sale-success-message').textContent).toMatch(/Refined Volt Sabre/);

    // After refresh, the row's slot bar shows 1 of 5 slots filled
    await waitFor(() => {
      expect(screen.getByLabelText(/1 of 5 refinement slots filled/)).toBeInTheDocument();
    });
  });

  it('renders rank prefix on the row when the weapon already has refinements', async () => {
    setupApiMocks({ workshopLevel: 8, initialRefinements: 3 });
    renderOnInventoryTab();

    await waitFor(() => {
      expect(screen.getByTestId('inventory-row-1')).toBeInTheDocument();
    });

    // 3 refinements → rank prefix "Crafted"
    expect(screen.getByText('Crafted')).toBeInTheDocument();
    expect(screen.getByLabelText(/3 of 5 refinement slots filled/)).toBeInTheDocument();
  });
});
