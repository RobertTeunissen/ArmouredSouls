import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RefinementHistoryPopover } from '../RefinementHistoryPopover';
import type { WeaponInventoryItem } from '../../weapon-shop/types';

type Refinement = WeaponInventoryItem['refinements'][number];

const makeRef = (overrides: Partial<Refinement>): Refinement => ({
  id: 1,
  tier: 'hone',
  magnitude: 1,
  targetAttribute: 'combatPower',
  costPaid: 10000,
  slotIndex: 1,
  createdAt: '2026-05-23T00:00:00Z',
  ...overrides,
});

describe('RefinementHistoryPopover', () => {
  it('renders empty state when there are no refinements', () => {
    render(<RefinementHistoryPopover refinements={[]} />);
    expect(screen.getByText(/No refinements yet/)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 5 slots filled/)).toBeInTheDocument();
  });

  it('lists all refinements with correct fields', () => {
    render(
      <RefinementHistoryPopover
        refinements={[
          makeRef({ id: 1, slotIndex: 1, tier: 'hone', magnitude: 3, targetAttribute: 'combatPower', costPaid: 90000 }),
          makeRef({ id: 2, slotIndex: 2, tier: 'sharpen', magnitude: 1, targetAttribute: null, costPaid: 300000 }),
          makeRef({ id: 3, slotIndex: 3, tier: 'forge', magnitude: 1, targetAttribute: null, costPaid: 400000 }),
        ]}
      />,
    );

    // Hone row shows the formatted attribute
    expect(screen.getByText(/\+3 Combat Power/)).toBeInTheDocument();
    // Sharpen row shows the fixed cooldown text
    expect(screen.getByText(/−0\.25s cooldown/)).toBeInTheDocument();
    // Forge row shows the fixed damage text
    expect(screen.getByText(/\+1\.0 base damage/)).toBeInTheDocument();
    // Costs are formatted in locale form
    expect(screen.getByText(/₡90,000/)).toBeInTheDocument();
    expect(screen.getByText(/₡300,000/)).toBeInTheDocument();
    expect(screen.getByText(/₡400,000/)).toBeInTheDocument();
    // Total spend in the footer
    expect(screen.getByText(/₡790,000/)).toBeInTheDocument();
    // 3/5 slots filled
    expect(screen.getByText(/3 \/ 5 slots filled/)).toBeInTheDocument();
  });

  it('sorts refinements by slotIndex ascending', () => {
    render(
      <RefinementHistoryPopover
        refinements={[
          makeRef({ id: 3, slotIndex: 3, tier: 'forge', targetAttribute: null }),
          makeRef({ id: 1, slotIndex: 1, tier: 'hone' }),
          makeRef({ id: 2, slotIndex: 2, tier: 'augment', targetAttribute: 'attackSpeed' }),
        ]}
      />,
    );

    const rows = screen.getAllByTestId(/refinement-row-/);
    expect(rows[0]).toHaveAttribute('data-testid', 'refinement-row-1');
    expect(rows[1]).toHaveAttribute('data-testid', 'refinement-row-2');
    expect(rows[2]).toHaveAttribute('data-testid', 'refinement-row-3');
  });
});
