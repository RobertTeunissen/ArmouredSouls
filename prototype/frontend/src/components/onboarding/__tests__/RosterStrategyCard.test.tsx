/**
 * RosterStrategyCard component tests
 * Tests for roster strategy selection card component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RosterStrategyCard, { STRATEGY_DATA } from '../RosterStrategyCard';
import type { RosterStrategy } from '../RosterStrategyCard';

describe('RosterStrategyCard', () => {
  const mockOnSelect = vi.fn();

  it('renders strategy name and description', () => {
    render(
      <RosterStrategyCard
        strategy="1_mighty"
        selected={false}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('1 Mighty Robot')).toBeInTheDocument();
    const matches = screen.getAllByText(/Maximum power concentration/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('displays key stats correctly', () => {
    render(
      <RosterStrategyCard
        strategy="2_average"
        selected={false}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('~3.2')).toBeInTheDocument(); // Battles per day
    const moderateElements = screen.getAllByText('Moderate');
    expect(moderateElements.length).toBeGreaterThan(0); // Power level (appears in multiple stats)
  });

  it('shows advantages and disadvantages', () => {
    render(
      <RosterStrategyCard
        strategy="1_mighty"
        selected={false}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('Advantages')).toBeInTheDocument();
    expect(screen.getByText('Disadvantages')).toBeInTheDocument();
    const maxPowerElements = screen.getAllByText(/Maximum power concentration/i);
    expect(maxPowerElements.length).toBeGreaterThan(0);
    expect(screen.getByText(/Single point of failure/i)).toBeInTheDocument();
  });

  it('displays budget breakdown', () => {
    render(
      <RosterStrategyCard
        strategy="1_mighty"
        selected={false}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('Budget Breakdown')).toBeInTheDocument();
    expect(screen.getByText(/Facilities:/i)).toBeInTheDocument();
    expect(screen.getByText(/Robots:/i)).toBeInTheDocument();
    expect(screen.getByText(/Weapons:/i)).toBeInTheDocument();
  });

  it('shows selected state when selected', () => {
    render(
      <RosterStrategyCard
        strategy="1_mighty"
        selected={true}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('SELECTED')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    render(
      <RosterStrategyCard
        strategy="2_average"
        selected={false}
        onSelect={mockOnSelect}
      />
    );

    const card = screen.getByRole('button', { name: /Select 2 Average Robots strategy/i });
    fireEvent.click(card);

    expect(mockOnSelect).toHaveBeenCalledWith('2_average');
  });

  it('calls onSelect when Enter key is pressed', () => {
    render(
      <RosterStrategyCard
        strategy="3_flimsy"
        selected={false}
        onSelect={mockOnSelect}
      />
    );

    const card = screen.getByRole('button', { name: /Select 3 Flimsy Robots strategy/i });
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(mockOnSelect).toHaveBeenCalledWith('3_flimsy');
  });

  it('has correct aria attributes', () => {
    render(
      <RosterStrategyCard
        strategy="1_mighty"
        selected={true}
        onSelect={mockOnSelect}
      />
    );

    const card = screen.getByRole('button', { pressed: true });
    expect(card).toBeInTheDocument();
  });

  it('renders all three strategies with correct data', () => {
    const strategies: RosterStrategy[] = ['1_mighty', '2_average', '3_flimsy'];

    strategies.forEach((strategy) => {
      const { unmount } = render(
        <RosterStrategyCard
          strategy={strategy}
          selected={false}
          onSelect={mockOnSelect}
        />
      );

      const data = STRATEGY_DATA[strategy];
      expect(screen.getByText(data.name)).toBeInTheDocument();
      expect(screen.getByText(data.battlesPerDay)).toBeInTheDocument();

      unmount();
    });
  });

  it('displays correct robot counts', () => {
    const { rerender } = render(
      <RosterStrategyCard
        strategy="1_mighty"
        selected={false}
        onSelect={mockOnSelect}
      />
    );
    expect(STRATEGY_DATA['1_mighty'].robotCount).toBe(1);

    rerender(
      <RosterStrategyCard
        strategy="2_average"
        selected={false}
        onSelect={mockOnSelect}
      />
    );
    expect(STRATEGY_DATA['2_average'].robotCount).toBe(2);

    rerender(
      <RosterStrategyCard
        strategy="3_flimsy"
        selected={false}
        onSelect={mockOnSelect}
      />
    );
    expect(STRATEGY_DATA['3_flimsy'].robotCount).toBe(3);
  });

  it('handles image load error gracefully', () => {
    render(
      <RosterStrategyCard
        strategy="1_mighty"
        selected={false}
        onSelect={mockOnSelect}
      />
    );

    const img = screen.getByAltText('1 Mighty Robot');
    expect(img).toBeInTheDocument();
    
    // Trigger error event
    fireEvent.error(img);
    
    // Should still render without crashing
    expect(screen.getByText('1 Mighty Robot')).toBeInTheDocument();
  });
});
