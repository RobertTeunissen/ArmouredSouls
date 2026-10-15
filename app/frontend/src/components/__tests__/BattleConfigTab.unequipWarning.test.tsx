/**
 * T20 — unequipping with booked matches asks for confirmation first
 * (design §9.2, rule 10).
 *
 * Without a main weapon a booked match is forfeited; without an offhand it is
 * fought with a single weapon. Unequipping stays allowed: the existing
 * ConfirmationModal only makes the consequence explicit.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ComponentProps } from 'react';
import BattleConfigTab from '../BattleConfigTab';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

type Props = ComponentProps<typeof BattleConfigTab>;

function inventoryWeapon(id: number, name: string, handsRequired: string) {
  return {
    id,
    weapon: {
      id,
      name,
      weaponType: 'melee',
      handsRequired,
      loadoutType: 'single',
      rangeBand: 'melee',
      description: null,
      baseDamage: 10,
      cost: 1000,
    },
  };
}

function createRobot(loadoutType = 'weapon_shield') {
  return {
    id: 3,
    name: 'Iron Duke',
    currentHP: 1000,
    maxHP: 1000,
    currentShield: 500,
    maxShield: 500,
    battleReadiness: 100,
    repairQuoteCredits: 0,
    loadoutType,
    mainWeaponId: 11,
    offhandWeaponId: 12,
    stance: 'balanced',
    yieldThreshold: 10,
    mainWeapon: inventoryWeapon(11, 'Laser Rifle', 'one'),
    offhandWeapon: inventoryWeapon(12, 'Combat Shield', 'shield'),
  } as unknown as Props['robot'];
}

function renderTab(heldEvents?: string[]) {
  const onUnequipWeapon = vi.fn().mockResolvedValue(undefined);
  render(
    <BattleConfigTab
      robot={createRobot()}
      weapons={[]}
      onRobotUpdate={vi.fn()}
      onEquipWeapon={vi.fn()}
      onUnequipWeapon={onUnequipWeapon}
      heldEvents={heldEvents}
    />,
  );
  const [mainUnequip, offhandUnequip] = screen.getAllByRole('button', { name: 'Unequip' });
  return { onUnequipWeapon, mainUnequip, offhandUnequip };
}

describe('BattleConfigTab unequip confirmation', () => {
  it('asks before unequipping the main weapon when matches are booked', () => {
    const { onUnequipWeapon, mainUnequip } = renderTab(['1v1 League', 'King of the Hill']);
    fireEvent.click(mainUnequip);
    const dialog = screen.getByRole('dialog', { name: 'Unequip main weapon?' });
    expect(dialog).toHaveTextContent(
      'Iron Duke has booked matches (1v1 League, King of the Hill). Without a main weapon it will forfeit them unless re-armed before they run.',
    );
    expect(screen.getByRole('button', { name: 'Keep weapon' })).toBeInTheDocument();
    expect(onUnequipWeapon).not.toHaveBeenCalled();
  });

  it('keeps the weapon when the player cancels', () => {
    const { onUnequipWeapon, mainUnequip } = renderTab(['1v1 League']);
    fireEvent.click(mainUnequip);
    fireEvent.click(screen.getByRole('button', { name: 'Keep weapon' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onUnequipWeapon).not.toHaveBeenCalled();
  });

  it('unequips the main weapon when the player confirms', () => {
    const { onUnequipWeapon, mainUnequip } = renderTab(['1v1 League']);
    fireEvent.click(mainUnequip);
    fireEvent.click(screen.getByRole('button', { name: 'Unequip anyway' }));
    expect(onUnequipWeapon).toHaveBeenCalledTimes(1);
    expect(onUnequipWeapon).toHaveBeenCalledWith('main');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('unequips directly when nothing is booked', () => {
    const { onUnequipWeapon, mainUnequip } = renderTab([]);
    fireEvent.click(mainUnequip);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onUnequipWeapon).toHaveBeenCalledWith('main');
  });

  it('warns about the single-weapon fallback when unequipping the offhand', () => {
    const { onUnequipWeapon, offhandUnequip } = renderTab(['Tag Team']);
    fireEvent.click(offhandUnequip);
    const dialog = screen.getByRole('dialog', { name: 'Unequip offhand weapon?' });
    expect(dialog).toHaveTextContent(
      'Iron Duke has booked matches (Tag Team). Without an offhand it will fight them with a single weapon.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Unequip anyway' }));
    expect(onUnequipWeapon).toHaveBeenCalledWith('offhand');
  });

  it('shows no confirmation when no booked events are passed (non-owner view)', () => {
    const { onUnequipWeapon, mainUnequip } = renderTab(undefined);
    fireEvent.click(mainUnequip);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onUnequipWeapon).toHaveBeenCalledWith('main');
  });
});
