/**
 * StrategyComparison component tests
 * Tests for strategy comparison view component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StrategyComparison from '../StrategyComparison';
import type { RosterStrategy } from '../RosterStrategyCard';

describe('StrategyComparison', () => {
  it('renders comparison header', () => {
    render(<StrategyComparison />);

    expect(screen.getByText('Compare Roster Strategies')).toBeInTheDocument();
    expect(screen.getByText(/Understand the trade-offs/i)).toBeInTheDocument();
  });

  it('displays all three strategies in comparison table', () => {
    render(<StrategyComparison />);

    const mighty = screen.getAllByText('1 Mighty Robot');
    expect(mighty.length).toBeGreaterThan(0);
    const average = screen.getAllByText('2 Average Robots');
    expect(average.length).toBeGreaterThan(0);
    const flimsy = screen.getAllByText('3 Flimsy Robots');
    expect(flimsy.length).toBeGreaterThan(0);
  });

  it('shows comparison metrics', () => {
    render(<StrategyComparison />);

    expect(screen.getByText('Robot Count')).toBeInTheDocument();
    expect(screen.getByText('Battles Per Day')).toBeInTheDocument();
    expect(screen.getByText('Power Level')).toBeInTheDocument();
    expect(screen.getByText('Complexity')).toBeInTheDocument();
  });

  it('displays budget allocation comparison', () => {
    render(<StrategyComparison />);

    expect(screen.getByText('Budget Allocation Comparison')).toBeInTheDocument();
  });

  it('shows key trade-offs section', () => {
    render(<StrategyComparison />);

    expect(screen.getByText('Key Trade-offs')).toBeInTheDocument();
    expect(screen.getByText('Power vs Participation')).toBeInTheDocument();
    expect(screen.getByText('Simplicity vs Flexibility')).toBeInTheDocument();
    expect(screen.getByText('Risk Distribution')).toBeInTheDocument();
  });

  it('displays recommendation guide', () => {
    render(<StrategyComparison />);

    expect(screen.getByText('Which Strategy is Right for You?')).toBeInTheDocument();
    expect(screen.getByText(/Prefer simplicity and power/i)).toBeInTheDocument();
    expect(screen.getByText(/Want balance and flexibility/i)).toBeInTheDocument();
    expect(screen.getByText(/Enjoy complexity and participation/i)).toBeInTheDocument();
  });

  it('highlights selected strategy in table', () => {
    render(<StrategyComparison selectedStrategy="2_average" />);

    const selectedHeaders = screen.getAllByText('SELECTED');
    expect(selectedHeaders.length).toBeGreaterThan(0);
  });

  it('renders action buttons when onSelectStrategy is provided', () => {
    const mockOnSelect = vi.fn();
    render(<StrategyComparison onSelectStrategy={mockOnSelect} />);

    expect(screen.getByText(/Select 1 Mighty Robot/i)).toBeInTheDocument();
    expect(screen.getByText(/Select 2 Average Robots/i)).toBeInTheDocument();
    expect(screen.getByText(/Select 3 Flimsy Robots/i)).toBeInTheDocument();
  });

  it('calls onSelectStrategy when button is clicked', () => {
    const mockOnSelect = vi.fn();
    render(<StrategyComparison onSelectStrategy={mockOnSelect} />);

    const button = screen.getByText(/Select 2 Average Robots/i);
    fireEvent.click(button);

    expect(mockOnSelect).toHaveBeenCalledWith('2_average');
  });

  it('shows checkmark on selected strategy button', () => {
    const mockOnSelect = vi.fn();
    render(
      <StrategyComparison
        selectedStrategy="1_mighty"
        onSelectStrategy={mockOnSelect}
      />
    );

    expect(screen.getByText(/✓ Select 1 Mighty Robot/i)).toBeInTheDocument();
  });

  it('does not render action buttons when onSelectStrategy is not provided', () => {
    render(<StrategyComparison />);

    expect(screen.queryByText(/Select 1 Mighty Robot/i)).not.toBeInTheDocument();
  });

  it('displays reset account reminder', () => {
    render(<StrategyComparison />);

    expect(screen.getByText(/You can reset your account later/i)).toBeInTheDocument();
  });

  it('shows all budget categories in comparison', () => {
    render(<StrategyComparison />);

    const facilities = screen.getAllByText(/Facilities/i);
    expect(facilities.length).toBeGreaterThan(0);
    const robots = screen.getAllByText(/Robots/i);
    expect(robots.length).toBeGreaterThan(0);
    const weapons = screen.getAllByText(/Weapons/i);
    expect(weapons.length).toBeGreaterThan(0);
    const attributes = screen.getAllByText(/Attributes/i);
    expect(attributes.length).toBeGreaterThan(0);
    const reserve = screen.getAllByText(/Reserve/i);
    expect(reserve.length).toBeGreaterThan(0);
  });

  it('displays metric descriptions', () => {
    render(<StrategyComparison />);

    expect(screen.getByText(/Number of robots in your roster/i)).toBeInTheDocument();
    expect(screen.getByText(/Average number of battles/i)).toBeInTheDocument();
  });

  it('highlights selected strategy in budget comparison', () => {
    render(<StrategyComparison selectedStrategy="3_flimsy" />);

    // Should have multiple SELECTED indicators
    const selectedIndicators = screen.getAllByText('SELECTED');
    expect(selectedIndicators.length).toBeGreaterThan(1);
  });
});
