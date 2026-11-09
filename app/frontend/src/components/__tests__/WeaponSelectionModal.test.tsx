import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import WeaponSelectionModal from '../WeaponSelectionModal';

type Props = ComponentProps<typeof WeaponSelectionModal>;
type Inventory = Props['weapons'][number];

const NO_BONUSES = {
  combatPowerBonus: 0, targetingSystemsBonus: 0, criticalSystemsBonus: 0, penetrationBonus: 0,
  weaponControlBonus: 0, attackSpeedBonus: 0, armorPlatingBonus: 0, shieldCapacityBonus: 0,
  evasionThrustersBonus: 0, counterProtocolsBonus: 0, servoMotorsBonus: 0, gyroStabilizersBonus: 0,
  hydraulicSystemsBonus: 0, powerCoreBonus: 0, threatAnalysisBonus: 0,
};

function inventory(id: number, name: string, overrides: Partial<Inventory['weapon']> = {}, extra: Partial<Inventory> = {}): Inventory {
  return {
    id,
    weapon: {
      id: 100 + id, name, weaponType: 'energy', handsRequired: 'one', loadoutType: 'single',
      rangeBand: 'mid', description: null, baseDamage: 10, cost: 1000, ...NO_BONUSES, ...overrides,
    },
    robotsMain: [], robotsOffhand: [],
    ...extra,
  };
}

const ARMORY: Inventory[] = [
  inventory(1, 'Laser Rifle', { combatPowerBonus: 3, evasionThrustersBonus: -2, description: 'Steady beam' }),
  inventory(2, 'Machine Gun', { weaponType: 'ballistic' }),
  inventory(3, 'War Hammer', { weaponType: 'melee', handsRequired: 'two' }),
  inventory(4, 'Tower Shield', { weaponType: 'shield', handsRequired: 'shield' }),
  inventory(5, 'Borrowed Blade', { weaponType: 'melee' }, { robotsMain: [{ id: 99, name: 'Other' }] }),
  inventory(6, 'Own Blade', { weaponType: 'melee' }, { robotsMain: [{ id: 7, name: 'Me' }] }),
];

function renderModal(props: Partial<Props> = {}) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  render(
    <WeaponSelectionModal
      isOpen
      onClose={onClose}
      onSelect={onSelect}
      weapons={ARMORY}
      currentRobotId={7}
      {...props}
    />,
  );
  return { onSelect, onClose };
}

const cardNames = (): string[] => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent ?? '');

describe('WeaponSelectionModal', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <WeaponSelectionModal isOpen={false} onClose={vi.fn()} onSelect={vi.fn()} weapons={ARMORY} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('is a named dialog that lists only weapons fitting a single main slot', () => {
    renderModal({ title: 'Select Main Weapon' });
    expect(screen.getByRole('dialog', { name: 'Select Main Weapon' })).toBeInTheDocument();
    // Two-handed and shields do not fit; a weapon equipped on another robot is hidden,
    // one equipped on this robot stays.
    expect(cardNames()).toEqual(['Laser Rifle', 'Machine Gun', 'Own Blade']);
  });

  it('offers two-handed weapons only to a two-handed main slot', () => {
    renderModal({ robotLoadoutType: 'two_handed' });
    expect(cardNames()).toEqual(['War Hammer']);
  });

  it('offers shields only to a weapon-and-shield offhand slot', () => {
    renderModal({ slot: 'offhand', robotLoadoutType: 'weapon_shield' });
    expect(cardNames()).toEqual(['Tower Shield']);
  });

  it('offers one-handed offhand weapons only to dual wield', () => {
    renderModal({ slot: 'offhand', robotLoadoutType: 'single' });
    expect(screen.getByText('No weapons found. Visit the Weapon Shop to purchase weapons.')).toBeInTheDocument();
  });

  it('filters by name and by type', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Search weapons'), { target: { value: 'laser' } });
    expect(cardNames()).toEqual(['Laser Rifle']);

    fireEvent.change(screen.getByLabelText('Search weapons'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Weapon type'), { target: { value: 'melee' } });
    expect(cardNames()).toEqual(['Own Blade']);
  });

  it('shows non-zero bonuses with their sign and marks the equipped weapon', () => {
    renderModal({ currentWeaponId: 1 });
    expect(screen.getByText('Combat Power: +3')).toBeInTheDocument();
    expect(screen.getByText('Evasion: -2')).toBeInTheDocument();
    expect(screen.queryByText(/Targeting:/)).not.toBeInTheDocument();
    expect(screen.getByText('✓ Currently Equipped')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Laser Rifle/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('selects with a click or Enter and closes', () => {
    const { onSelect, onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Machine Gun/ }));
    expect(onSelect).toHaveBeenCalledWith(2);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole('button', { name: /Laser Rifle/ }), { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes on Escape, the close button and Cancel without selecting', () => {
    const { onSelect, onClose } = renderModal();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
