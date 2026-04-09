import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock shared utils
vi.mock('../../../../../shared/utils/discounts', () => ({
  calculateWeaponWorkshopDiscount: vi.fn(() => 10),
}));

vi.mock('../../../utils/weaponImages', () => ({
  getWeaponImagePath: vi.fn(() => '/test-image.png'),
}));

import { WeaponCard } from '../WeaponCard';
import type { Weapon, StorageStatus } from '../types';

const makeWeapon = (overrides: Partial<Weapon> = {}): Weapon => ({
  id: 1,
  name: 'Plasma Blade',
  weaponType: 'energy',
  loadoutType: 'single',
  handsRequired: 'one',
  description: 'A powerful energy weapon',
  rangeBand: 'melee',
  baseDamage: 25,
  cost: 5000,
  cooldown: 2,
  combatPowerBonus: 3,
  targetingSystemsBonus: 0,
  criticalSystemsBonus: 1,
  penetrationBonus: 0,
  weaponControlBonus: 0,
  attackSpeedBonus: 2,
  armorPlatingBonus: 0,
  shieldCapacityBonus: 0,
  evasionThrustersBonus: 0,
  counterProtocolsBonus: 0,
  servoMotorsBonus: 0,
  gyroStabilizersBonus: 0,
  hydraulicSystemsBonus: 0,
  powerCoreBonus: 0,
  threatAnalysisBonus: 0,
  ...overrides,
});

const makeStorageStatus = (overrides: Partial<StorageStatus> = {}): StorageStatus => ({
  currentWeapons: 3,
  maxCapacity: 10,
  remainingSlots: 7,
  isFull: false,
  percentageFull: 30,
  ...overrides,
});

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    weapon: makeWeapon(),
    userCurrency: 50000,
    weaponWorkshopLevel: 0,
    storageStatus: makeStorageStatus(),
    purchasing: null,
    ownedCount: 0,
    isSelectedForComparison: false,
    comparisonCount: 0,
    calculateDiscountedPrice: (price: number) => price,
    getTypeColor: () => 'text-blue-400',
    getAttributeBonuses: () => ['Combat Power +3', 'Attack Speed +2'],
    onPurchase: vi.fn(),
    onToggleComparison: vi.fn(),
    onSelectWeapon: vi.fn(),
    ...overrides,
  };
}

function renderCard(overrides: Record<string, unknown> = {}) {
  const props = defaultProps(overrides);
  return {
    props,
    ...render(<WeaponCard {...props as React.ComponentProps<typeof WeaponCard>} />),
  };
}

describe('WeaponCard', () => {
  it('displays weapon name, type, stats, and cost', () => {
    renderCard();

    expect(screen.getByText('Plasma Blade')).toBeInTheDocument();
    expect(screen.getByText('energy')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument(); // baseDamage
    expect(screen.getByText('2s')).toBeInTheDocument(); // cooldown
    expect(screen.getByText(/5,000/)).toBeInTheDocument(); // cost
  });

  it('shows discounted price when weaponWorkshopLevel > 0', () => {
    renderCard({
      weaponWorkshopLevel: 2,
      calculateDiscountedPrice: () => 4500,
    });

    // Original price should be struck through
    expect(screen.getByText('₡5,000')).toBeInTheDocument();
    // Discounted price shown
    expect(screen.getByText(/4,500/)).toBeInTheDocument();
    // Discount percentage shown
    expect(screen.getByText(/10% off/)).toBeInTheDocument();
  });

  it('shows "Already Own" badge when ownedCount > 0', () => {
    renderCard({ ownedCount: 2 });

    expect(screen.getByText(/Already Own/)).toBeInTheDocument();
    expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
  });

  it('disables purchase button when credits insufficient', () => {
    renderCard({
      userCurrency: 100,
      calculateDiscountedPrice: () => 5000,
    });

    expect(screen.getByRole('button', { name: /Insufficient Credits/i })).toBeDisabled();
  });

  it('disables purchase button when storage full', () => {
    renderCard({
      storageStatus: makeStorageStatus({ isFull: true }),
    });

    expect(screen.getByRole('button', { name: /Storage Full/i })).toBeDisabled();
  });

  it('comparison checkbox is toggleable', async () => {
    const user = userEvent.setup();
    const onToggleComparison = vi.fn();
    renderCard({ onToggleComparison });

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(onToggleComparison).toHaveBeenCalledWith(1);
  });
});
