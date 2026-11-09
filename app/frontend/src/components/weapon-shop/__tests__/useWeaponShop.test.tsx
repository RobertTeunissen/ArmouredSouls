import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../../utils/ApiError';

const mockRefreshUser = vi.fn().mockResolvedValue(undefined);
const auth = vi.hoisted(() => ({ user: { id: 1, currency: 60000 } }));
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.user, refreshUser: mockRefreshUser }),
}));

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../../../utils/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args), post: (...args: unknown[]) => mockPost(...args) },
}));

import { useWeaponShop } from '../useWeaponShop';

const NO_BONUSES = {
  combatPowerBonus: 0, targetingSystemsBonus: 0, criticalSystemsBonus: 0, penetrationBonus: 0,
  weaponControlBonus: 0, attackSpeedBonus: 0, armorPlatingBonus: 0, shieldCapacityBonus: 0,
  evasionThrustersBonus: 0, counterProtocolsBonus: 0, servoMotorsBonus: 0, gyroStabilizersBonus: 0,
  hydraulicSystemsBonus: 0, powerCoreBonus: 0, threatAnalysisBonus: 0,
};

function weapon(id: number, name: string, extra: Record<string, unknown> = {}) {
  return {
    id, name, weaponType: 'energy', loadoutType: 'single', handsRequired: 'one', rangeBand: 'mid', description: '',
    baseDamage: 20, cooldown: 2, cost: 50000, ...NO_BONUSES, ...extra,
  };
}

const CATALOG = [
  weapon(1, 'Zap Rifle', { combatPowerBonus: 2 }),
  weapon(2, 'Axe', { weaponType: 'melee', loadoutType: 'two_handed', handsRequired: 'two', rangeBand: 'melee', cost: 100000 }),
  weapon(3, 'Buckler', { weaponType: 'shield', loadoutType: 'weapon_shield', handsRequired: 'shield', cost: 20000 }),
  weapon(4, 'Basic Laser', { cost: 50000 }), // test fixture, hidden
  weapon(5, 'Pea Shooter', { cost: 500 }), // unrealistic price, hidden
];

const INVENTORY = [
  { id: 10, weaponId: 1, refinements: [], robotsMain: [{ id: 7, name: 'Alpha' }], robotsOffhand: [] },
  { id: 11, weaponId: 1, refinements: [{ tier: 'hone' }], robotsMain: [], robotsOffhand: [] },
];

let storageFull = false;
function serve(): void {
  mockGet.mockImplementation((url: string) => {
    switch (url) {
      case '/api/weapons': return Promise.resolve(CATALOG);
      case '/api/weapon-inventory': return Promise.resolve(INVENTORY);
      case '/api/facilities': return Promise.resolve({ facilities: [{ type: 'weapons_workshop', currentLevel: 2 }, { type: 'refinement_lab', currentLevel: 1 }] });
      case '/api/weapon-inventory/storage-status': return Promise.resolve({ currentWeapons: 2, maxCapacity: 5, remainingSlots: 3, isFull: storageFull, percentageFull: 40 });
      case '/api/onboarding/state': return Promise.resolve({ data: { choices: { weaponsPurchased: [9] } } });
      default: return Promise.reject(new Error(`unexpected ${url}`));
    }
  });
}

function wrapper(path = '/weapon-shop') {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
}

async function loaded(path?: string) {
  const hook = renderHook(() => useWeaponShop(), { wrapper: wrapper(path) });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

const names = (list: Array<{ name: string }>): string[] => list.map((w) => w.name);

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 1, currency: 60000 };
  storageFull = false;
  vi.mocked(localStorage.getItem).mockReturnValue(null);
  serve();
});

describe('useWeaponShop', () => {
  it('loads the catalog without test weapons, sorted by name, with ownership and facilities', async () => {
    const { result } = await loaded();
    expect(names(result.current.processedWeapons)).toEqual(['Axe', 'Buckler', 'Zap Rifle']);
    expect(result.current.ownedWeapons.get(1)).toBe(2);
    expect(result.current.equippedWeaponsCount).toBe(1);
    expect(result.current.ownedBreakdownByWeaponId.get(1)).toEqual({ Stock: 1, Refined: 1, Crafted: 0, Mastercrafted: 0, Legendary: 0 });
    expect(result.current.weaponWorkshopLevel).toBe(2);
    expect(result.current.refinementLabLevel).toBe(1);
    expect(result.current.storageStatus?.remainingSlots).toBe(3);
    // Weapons Workshop L2 = 10% off
    expect(result.current.calculateDiscountedPrice(50000)).toBe(45000);
  });

  it('groups the catalog by how a weapon is held', async () => {
    const { result } = await loaded();
    expect(names(result.current.groupedWeapons.one_handed)).toEqual(['Zap Rifle']);
    expect(names(result.current.groupedWeapons.two_handed)).toEqual(['Axe']);
    expect(names(result.current.groupedWeapons.shield)).toEqual(['Buckler']);
  });

  it('reports a failed load', async () => {
    mockGet.mockRejectedValue(new Error('down'));
    const { result } = await loaded();
    expect(result.current.error).toBe('Failed to load weapons. Please try refreshing the page.');
  });

  it('filters by loadout, type, range, price, affordability and ownership', async () => {
    const { result } = await loaded();
    const empty = result.current.filters;
    const apply = (patch: Partial<typeof empty>) => act(() => result.current.handleFiltersChange({ ...empty, ...patch }));

    apply({ loadoutTypes: ['weapon_shield'] });
    expect(names(result.current.processedWeapons)).toEqual(['Buckler', 'Zap Rifle']);
    apply({ loadoutTypes: ['two_handed'] });
    expect(names(result.current.processedWeapons)).toEqual(['Axe']);
    apply({ weaponTypes: ['melee'] });
    expect(names(result.current.processedWeapons)).toEqual(['Axe']);
    apply({ rangeBands: ['mid'] });
    expect(names(result.current.processedWeapons)).toEqual(['Buckler', 'Zap Rifle']);
    // The discounted price counts: 100,000 → 90,000 is above the range.
    apply({ priceRange: { min: 0, max: 50000 } });
    expect(names(result.current.processedWeapons)).toEqual(['Buckler', 'Zap Rifle']);
    apply({ canAffordOnly: true });
    expect(names(result.current.processedWeapons)).toEqual(['Buckler', 'Zap Rifle']);
    apply({ onlyOwnedWeapons: true });
    expect(names(result.current.processedWeapons)).toEqual(['Zap Rifle']);
  });

  it('removes one filter at a time', async () => {
    const { result } = await loaded();
    act(() => result.current.handleFiltersChange({
      loadoutTypes: ['single'], weaponTypes: ['energy'], rangeBands: ['mid'], priceRange: { min: 0, max: 1 },
      canAffordOnly: true, onlyOwnedWeapons: true,
    }));
    for (const [type, value] of [['loadoutType', 'single'], ['weaponType', 'energy'], ['rangeBand', 'mid'], ['priceRange'], ['canAfford'], ['onlyOwned']] as const) {
      act(() => result.current.handleRemoveFilter(type, value));
    }
    expect(result.current.filters).toEqual({
      loadoutTypes: [], weaponTypes: [], rangeBands: [], priceRange: null, canAffordOnly: false, onlyOwnedWeapons: false,
    });
  });

  it('remembers the view mode', async () => {
    const { result } = await loaded();
    act(() => result.current.handleViewModeChange('table'));
    expect(result.current.viewMode).toBe('table');
    expect(localStorage.setItem).toHaveBeenCalledWith('weaponShopViewMode', 'table');
  });

  it('refuses a purchase the player cannot afford or store', async () => {
    const { result } = await loaded();
    act(() => { void result.current.handlePurchase(2, 100000); });
    expect(result.current.confirmationModal).toMatchObject({ isOpen: true, title: 'Insufficient Credits' });
    expect(result.current.confirmationModal.message).toContain('₡90,000');

    storageFull = true;
    const full = await loaded();
    act(() => { void full.result.current.handlePurchase(1, 50000); });
    expect(full.result.current.confirmationModal.title).toBe('Storage Full');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('buys after confirmation and refreshes credits, storage and inventory', async () => {
    mockPost.mockResolvedValue({});
    const { result } = await loaded();
    act(() => result.current.setSelectedWeapon(result.current.weapons[0]));
    act(() => { void result.current.handlePurchase(1, 50000); });
    expect(result.current.confirmationModal).toMatchObject({
      title: 'Confirm Purchase', message: 'Are you sure you want to purchase Zap Rifle for ₡45,000?',
    });

    await act(async () => { await result.current.confirmationModal.onConfirm(); });
    expect(mockPost).toHaveBeenCalledWith('/api/weapon-inventory/purchase', { weaponId: 1 });
    expect(mockRefreshUser).toHaveBeenCalled();
    expect(result.current.confirmationModal).toMatchObject({ title: 'Purchase Successful', message: 'Zap Rifle purchased successfully!' });
    expect(result.current.selectedWeapon).toBeNull();
    expect(result.current.purchasing).toBeNull();
  });

  it('records an onboarding purchase in the tutorial state', async () => {
    mockPost.mockResolvedValue({});
    const { result } = await loaded('/weapon-shop?onboarding=true');
    act(() => { void result.current.handlePurchase(1, 50000); });
    await act(async () => { await result.current.confirmationModal.onConfirm(); });
    expect(mockPost).toHaveBeenCalledWith('/api/onboarding/state', { choices: { weaponsPurchased: [9, 1] } });
    expect(result.current.confirmationModal.message).toContain('return to the tutorial');
  });

  it('shows why a purchase failed', async () => {
    mockPost.mockRejectedValue(new ApiError('Storage capacity full', 'STORAGE_FULL', 400));
    const { result } = await loaded();
    act(() => { void result.current.handlePurchase(1, 50000); });
    await act(async () => { await result.current.confirmationModal.onConfirm(); });
    expect(result.current.confirmationModal).toMatchObject({ title: 'Purchase Failed', message: 'Storage capacity full' });
  });

  it('compares two or three weapons', async () => {
    const { result } = await loaded();
    act(() => result.current.toggleComparison(1));
    act(() => result.current.handleCompare());
    expect(result.current.showComparisonModal).toBe(false);

    for (const id of [2, 3, 4]) act(() => result.current.toggleComparison(id));
    expect(result.current.selectedForComparison).toEqual([1, 2, 3]);
    act(() => result.current.handleCompare());
    expect(result.current.showComparisonModal).toBe(true);

    act(() => result.current.toggleComparison(2));
    act(() => result.current.handleRemoveFromComparison(3));
    expect(result.current.selectedForComparison).toEqual([1]);
    expect(result.current.showComparisonModal).toBe(false);

    act(() => result.current.handleClearComparison());
    expect(result.current.selectedForComparison).toEqual([]);
  });

  it('lists non-zero attribute bonuses with their sign', async () => {
    const { result } = await loaded();
    expect(result.current.getAttributeBonuses(result.current.weapons.find((w) => w.id === 1)!)).toEqual(['Combat Power: +2']);
  });

  it('refreshes inventory, storage and credits after a sale', async () => {
    const { result } = await loaded();
    mockGet.mockClear();
    await act(() => result.current.refreshInventory());
    expect(mockGet.mock.calls.map(([url]) => url).sort()).toEqual(['/api/weapon-inventory', '/api/weapon-inventory/storage-status']);
    expect(mockRefreshUser).toHaveBeenCalled();
  });
});
