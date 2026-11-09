import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import ComparisonModal from '../ComparisonModal';

type Props = ComponentProps<typeof ComparisonModal>;
type Weapon = Props['weapons'][number];

const NO_BONUSES = {
  combatPowerBonus: 0, targetingSystemsBonus: 0, criticalSystemsBonus: 0, penetrationBonus: 0,
  weaponControlBonus: 0, attackSpeedBonus: 0, armorPlatingBonus: 0, shieldCapacityBonus: 0,
  evasionThrustersBonus: 0, counterProtocolsBonus: 0, servoMotorsBonus: 0, gyroStabilizersBonus: 0,
  hydraulicSystemsBonus: 0, powerCoreBonus: 0, threatAnalysisBonus: 0,
};

function weapon(id: number, name: string, overrides: Partial<Weapon> = {}): Weapon {
  return {
    id, name, weaponType: 'energy', loadoutType: 'single', description: '', baseDamage: 20, cooldown: 2,
    cost: 10000, ...NO_BONUSES, ...overrides,
  };
}

// Cheap hitter: ₡250/damage, 1.00 DPS per ₡1K. Pricey brawler: ₡500/damage but +6 attributes.
const WEAPONS = [
  weapon(1, 'Cheap Laser', { baseDamage: 40, cooldown: 4, cost: 10000 }),
  weapon(2, 'Heavy Blade', { weaponType: 'melee', baseDamage: 40, cooldown: 4, cost: 20000, combatPowerBonus: 4, armorPlatingBonus: 2 }),
];

function renderModal(props: Partial<Props> = {}) {
  const handlers = { onClose: vi.fn(), onPurchase: vi.fn(), onRemove: vi.fn() };
  const { unmount } = render(
    <ComparisonModal
      weapons={WEAPONS}
      userCurrency={100000}
      weaponWorkshopLevel={0}
      storageIsFull={false}
      purchasingId={null}
      {...handlers}
      {...props}
    />,
  );
  return { ...handlers, unmount };
}

const card = (name: string): HTMLElement => screen.getByRole('heading', { name }).closest('.bg-surface') as HTMLElement;

describe('ComparisonModal', () => {
  it('is a named dialog that closes on Escape and the close button', () => {
    const { onClose } = renderModal();
    expect(screen.getByRole('dialog', { name: 'Compare Weapons' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows damage, DPS, attributes and the best value per metric', () => {
    renderModal();
    const laser = within(card('Cheap Laser'));
    expect(laser.getByText('10.0')).toBeInTheDocument(); // 40 / 4s
    expect(laser.getByText('₡250 ⭐')).toBeInTheDocument();
    expect(laser.getByText('1.00 ⭐')).toBeInTheDocument();

    const blade = within(card('Heavy Blade'));
    expect(blade.getByText('+6')).toBeInTheDocument();
    expect(blade.getByText('₡500')).toBeInTheDocument();
    expect(blade.getByText('0.30 ⭐')).toBeInTheDocument(); // 6 attributes / ₡20K
  });

  it('applies the Weapons Workshop discount to price and value', () => {
    renderModal({ weaponWorkshopLevel: 2 }); // 10% off
    const laser = within(card('Cheap Laser'));
    expect(laser.getByText('₡10,000')).toBeInTheDocument();
    expect(laser.getByText('(-10%)')).toBeInTheDocument();
    expect(laser.getByRole('button', { name: 'Buy ₡9,000' })).toBeEnabled();
  });

  it('blocks purchases the player cannot afford or store', () => {
    const first = renderModal({ userCurrency: 15000 });
    expect(within(card('Heavy Blade')).getByRole('button', { name: 'Insufficient Funds' })).toBeDisabled();

    first.unmount();
    renderModal({ storageIsFull: true });
    expect(within(card('Cheap Laser')).getByRole('button', { name: 'Storage Full' })).toBeDisabled();
  });

  it('buys and removes the chosen weapon, and shows a running purchase', () => {
    const { onPurchase, onRemove, unmount } = renderModal();
    fireEvent.click(within(card('Cheap Laser')).getByRole('button', { name: 'Buy ₡10,000' }));
    fireEvent.click(within(card('Heavy Blade')).getByRole('button', { name: 'Remove from comparison' }));
    expect(onPurchase).toHaveBeenCalledWith(1);
    expect(onRemove).toHaveBeenCalledWith(2);

    unmount();
    renderModal({ purchasingId: 2 });
    expect(within(card('Heavy Blade')).getByRole('button', { name: 'Purchasing...' })).toBeDisabled();
  });
});
