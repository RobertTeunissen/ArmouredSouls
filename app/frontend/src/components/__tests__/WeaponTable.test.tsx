import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import WeaponTable from '../WeaponTable';

// The `?react` SVG component imports need the Vite SVGR transform, which the
// test runner does not apply.
vi.mock('../../assets/icons/weapon-types/melee.svg?react', () => ({ default: () => <svg data-testid="icon-melee" /> }));
vi.mock('../../assets/icons/weapon-types/ballistic.svg?react', () => ({ default: () => <svg data-testid="icon-ballistic" /> }));
vi.mock('../../assets/icons/weapon-types/energy.svg?react', () => ({ default: () => <svg data-testid="icon-energy" /> }));
vi.mock('../../assets/icons/weapon-types/shield.svg?react', () => ({ default: () => <svg data-testid="icon-shield" /> }));

type Props = ComponentProps<typeof WeaponTable>;
type Weapon = Props['weapons'][number];

function weapon(id: number, name: string, overrides: Partial<Weapon> = {}): Weapon {
  return {
    id, name, weaponType: 'energy', loadoutType: 'single', description: '', baseDamage: 20, cooldown: 2,
    cost: 10000, rangeBand: 'mid', ...overrides,
  };
}

const WEAPONS: Weapon[] = [
  weapon(1, 'Bravo Blaster', { baseDamage: 30, cooldown: 3, cost: 20000, rangeBand: 'long', combatPowerBonus: 2 }),
  weapon(2, 'Alpha Axe', { weaponType: 'melee', loadoutType: 'two_handed', baseDamage: 50, cooldown: 5, cost: 5000, rangeBand: 'melee', armorPlatingBonus: 5, penetrationBonus: 3 }),
  weapon(3, 'Charlie Cannon', { weaponType: 'ballistic', baseDamage: 12, cooldown: 1, cost: 40000, rangeBand: 'short' }),
];

function renderTable(props: Partial<Props> = {}) {
  const onPurchase = vi.fn();
  const onWeaponClick = vi.fn();
  render(
    <WeaponTable
      weapons={WEAPONS}
      onPurchase={onPurchase}
      calculateDiscountedPrice={(cost) => cost}
      userCredits={25000}
      isFull={false}
      purchasing={null}
      hasDiscount={false}
      discountPercent={0}
      onWeaponClick={onWeaponClick}
      {...props}
    />,
  );
  return { onPurchase, onWeaponClick };
}

const names = (): string[] =>
  screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('button')[0].textContent ?? '');

const header = (label: string): HTMLElement => screen.getByRole('columnheader', { name: new RegExp(`^${label}`) });

describe('WeaponTable', () => {
  it('sorts by name ascending first and reports it on the header', () => {
    renderTable();
    expect(names()).toEqual(['Alpha Axe', 'Bravo Blaster', 'Charlie Cannon']);
    expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
    expect(header('DPS')).toHaveAttribute('aria-sort', 'none');
  });

  it('sorts by a column, then flips the direction on a second click', () => {
    renderTable();
    fireEvent.click(within(header('DPS')).getByRole('button'));
    // 30/3 = 10.0 and 50/5 = 10.0 keep their input order; 12/1 = 12.0 is last
    expect(names()).toEqual(['Bravo Blaster', 'Alpha Axe', 'Charlie Cannon']);
    fireEvent.click(within(header('DPS')).getByRole('button'));
    expect(header('DPS')).toHaveAttribute('aria-sort', 'descending');
    expect(names()[0]).toBe('Charlie Cannon');
  });

  it('sorts range bands from melee to long and attributes by their total', () => {
    renderTable();
    fireEvent.click(within(header('Range')).getByRole('button'));
    expect(names()).toEqual(['Alpha Axe', 'Charlie Cannon', 'Bravo Blaster']);
    fireEvent.click(within(header('Attributes')).getByRole('button'));
    expect(names()).toEqual(['Charlie Cannon', 'Bravo Blaster', 'Alpha Axe']);
  });

  it('shows loadout, DPS, attribute total and owned copies', () => {
    renderTable({ ownedWeapons: new Map([[2, 3]]) });
    const axe = within(screen.getByRole('button', { name: 'Alpha Axe' }).closest('tr')!);
    expect(axe.getByText('Two Handed')).toBeInTheDocument();
    expect(axe.getByText('Melee')).toBeInTheDocument();
    expect(axe.getByText('10.0')).toBeInTheDocument();
    expect(axe.getByText('+8')).toBeInTheDocument();
    expect(axe.getByText('Own (3)')).toBeInTheDocument();
  });

  it('shows the discounted price next to the list price', () => {
    renderTable({ hasDiscount: true, discountPercent: 10, calculateDiscountedPrice: (cost) => cost * 0.9 });
    const blaster = within(screen.getByRole('button', { name: 'Bravo Blaster' }).closest('tr')!);
    expect(blaster.getByText('₡20,000')).toBeInTheDocument();
    expect(blaster.getByText('₡18,000')).toBeInTheDocument();
    expect(blaster.getByText('(-10%)')).toBeInTheDocument();
  });

  it('buys affordable weapons and blocks the rest', () => {
    const { onPurchase } = renderTable({ purchasing: 1 });
    const row = (name: string) => within(screen.getByRole('button', { name }).closest('tr')!);

    fireEvent.click(row('Alpha Axe').getByRole('button', { name: 'Buy' }));
    expect(onPurchase).toHaveBeenCalledWith(2, 5000);
    expect(row('Bravo Blaster').getByRole('button', { name: 'Buying...' })).toBeDisabled();
    expect(row('Charlie Cannon').getByRole('button', { name: 'Low ₡' })).toBeDisabled();
  });

  it('blocks every purchase when storage is full', () => {
    renderTable({ isFull: true });
    for (const button of screen.getAllByRole('button', { name: 'Full' })) expect(button).toBeDisabled();
  });

  it('opens a weapon from its name', () => {
    const { onWeaponClick } = renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Charlie Cannon' }));
    expect(onWeaponClick).toHaveBeenCalledWith(WEAPONS[2]);
  });
});
