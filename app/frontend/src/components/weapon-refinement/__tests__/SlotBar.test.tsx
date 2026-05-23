import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SlotBar } from '../SlotBar';
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

describe('SlotBar', () => {
  it('renders 5 slots regardless of refinement count', () => {
    render(<SlotBar refinements={[]} workshopLevel={1} />);
    const bar = screen.getByTestId('slot-bar');
    // Exactly 5 children for the 5 slots
    expect(bar.children).toHaveLength(5);
  });

  it('renders aria-label with N of 5 filled', () => {
    render(<SlotBar refinements={[
      makeRef({ id: 1, slotIndex: 1, tier: 'hone' }),
      makeRef({ id: 2, slotIndex: 2, tier: 'forge', targetAttribute: null }),
    ]} workshopLevel={5} />);
    expect(screen.getByLabelText(/2 of 5 refinement slots filled/)).toBeInTheDocument();
  });

  it('renders locked tooltip on empty slots when Workshop level < 1 (Hone gated)', () => {
    render(<SlotBar refinements={[]} workshopLevel={0} />);
    const bar = screen.getByTestId('slot-bar');
    // First empty slot should be a "locked" variant — we check via aria-label substring
    const lockedSlots = bar.querySelectorAll('[aria-label*="locked"]');
    expect(lockedSlots.length).toBe(5);
  });

  it('renders empty (not locked) slots when Workshop ≥ L1', () => {
    render(<SlotBar refinements={[]} workshopLevel={1} />);
    const bar = screen.getByTestId('slot-bar');
    const lockedSlots = bar.querySelectorAll('[aria-label*="locked"]');
    expect(lockedSlots.length).toBe(0);
  });

  it('fires onSlotClick when a filled slot is clicked', async () => {
    const onSlotClick = vi.fn();
    render(
      <SlotBar
        refinements={[makeRef({ id: 1, slotIndex: 2, tier: 'sharpen', magnitude: 1, targetAttribute: null })]}
        workshopLevel={5}
        onSlotClick={onSlotClick}
      />,
    );
    const filled = screen.getByLabelText(/Slot 2: Sharpen/);
    await userEvent.click(filled);
    expect(onSlotClick).toHaveBeenCalledWith(2);
  });

  it('renders compact variant with smaller boxes', () => {
    const { rerender } = render(<SlotBar refinements={[]} workshopLevel={1} />);
    const normal = screen.getByTestId('slot-bar');
    const normalSize = normal.children[0].getAttribute('style') ?? '';

    rerender(<SlotBar refinements={[]} workshopLevel={1} compact />);
    const compact = screen.getByTestId('slot-bar');
    const compactSize = compact.children[0].getAttribute('style') ?? '';

    expect(normalSize).not.toBe(compactSize);
  });
});
