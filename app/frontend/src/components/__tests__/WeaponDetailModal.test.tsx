import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import WeaponDetailModal from '../WeaponDetailModal';

// The `?react` SVG component imports need the Vite SVGR transform, which the
// test runner does not apply.
vi.mock('../../assets/icons/weapon-types/melee.svg?react', () => ({ default: () => <svg /> }));
vi.mock('../../assets/icons/weapon-types/ballistic.svg?react', () => ({ default: () => <svg /> }));
vi.mock('../../assets/icons/weapon-types/energy.svg?react', () => ({ default: () => <svg /> }));
vi.mock('../../assets/icons/weapon-types/shield.svg?react', () => ({ default: () => <svg /> }));

type Props = ComponentProps<typeof WeaponDetailModal>;

const WEAPON: Props['weapon'] = {
  id: 9, name: 'Plasma Cutter', weaponType: 'energy', loadoutType: 'dual_wield', description: 'Cuts through plating',
  baseDamage: 36, cooldown: 4, cost: 50000, combatPowerBonus: 5, evasionThrustersBonus: -2, armorPlatingBonus: 0,
};

function renderModal(props: Partial<Props> = {}) {
  const onClose = vi.fn();
  const onPurchase = vi.fn();
  render(
    <WeaponDetailModal
      weapon={WEAPON}
      onClose={onClose}
      onPurchase={onPurchase}
      calculateDiscountedPrice={(cost) => cost}
      userCredits={80000}
      isFull={false}
      purchasing={false}
      hasDiscount={false}
      discountPercent={0}
      {...props}
    />,
  );
  return { onClose, onPurchase };
}

describe('WeaponDetailModal', () => {
  it('is a dialog named after the weapon with its stats', () => {
    renderModal({ ownedCount: 2 });
    expect(screen.getByRole('dialog', { name: 'Plasma Cutter' })).toBeInTheDocument();
    expect(screen.getByText('Dual Wield')).toBeInTheDocument();
    expect(screen.getByText('Cuts through plating')).toBeInTheDocument();
    expect(screen.getByText('9.0')).toBeInTheDocument(); // 36 / 4s
    expect(screen.getByText('+3')).toBeInTheDocument(); // 5 − 2
    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getByText('-2')).toBeInTheDocument();
    expect(screen.getByText('Already Own (2)')).toBeInTheDocument();
  });

  it('shows the Weapon Workshop discount and buys at list cost', () => {
    const { onPurchase } = renderModal({ hasDiscount: true, discountPercent: 20, calculateDiscountedPrice: (cost) => cost * 0.8 });
    expect(screen.getByText('₡50,000')).toBeInTheDocument();
    expect(screen.getByText('₡40,000')).toBeInTheDocument();
    expect(screen.getByText('(-20% Weapon Workshop discount)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Purchase' }));
    expect(onPurchase).toHaveBeenCalledWith(9, 50000);
  });

  it.each([
    [{ userCredits: 1000 }, 'Insufficient Credits'],
    [{ isFull: true }, 'Storage Full'],
    [{ purchasing: true }, 'Purchasing...'],
  ] as const)('blocks the purchase when %o', (props, label) => {
    renderModal(props);
    expect(screen.getByRole('button', { name: label })).toBeDisabled();
  });

  it('closes from the header, the footer and Escape', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Close weapon details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
