/**
 * Unit Tests for AdminFilterBar
 *
 * Tests filter chip rendering, toggle click, clear all button,
 * active/inactive states, and children slot.
 *
 * _Requirements: 26.3_
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminFilterBar, type FilterChip } from '../AdminFilterBar';

const filters: FilterChip[] = [
  { key: 'league', label: 'League', active: true },
  { key: 'tournament', label: 'Tournament', active: false },
  { key: 'koth', label: 'KotH', active: false },
];

describe('AdminFilterBar', () => {
  it('should render all filter chips', () => {
    render(
      <AdminFilterBar filters={filters} onFilterToggle={vi.fn()} />,
    );

    expect(screen.getByText('League')).toBeInTheDocument();
    expect(screen.getByText('Tournament')).toBeInTheDocument();
    expect(screen.getByText('KotH')).toBeInTheDocument();
  });

  it('should apply active styling to active filters', () => {
    render(
      <AdminFilterBar filters={filters} onFilterToggle={vi.fn()} />,
    );

    const leagueBtn = screen.getByText('League');
    expect(leagueBtn.className).toContain('bg-primary');

    const tournamentBtn = screen.getByText('Tournament');
    expect(tournamentBtn.className).toContain('bg-surface-elevated');
  });

  it('should set aria-pressed correctly for active and inactive filters', () => {
    render(
      <AdminFilterBar filters={filters} onFilterToggle={vi.fn()} />,
    );

    expect(screen.getByText('League')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Tournament')).toHaveAttribute('aria-pressed', 'false');
  });

  it('should call onFilterToggle with the correct key when a filter is clicked', () => {
    const onFilterToggle = vi.fn();

    render(
      <AdminFilterBar filters={filters} onFilterToggle={onFilterToggle} />,
    );

    fireEvent.click(screen.getByText('Tournament'));
    expect(onFilterToggle).toHaveBeenCalledWith('tournament');
  });

  it('should show Clear all button when onClearAll is provided and filters are active', () => {
    const onClearAll = vi.fn();

    render(
      <AdminFilterBar
        filters={filters}
        onFilterToggle={vi.fn()}
        onClearAll={onClearAll}
      />,
    );

    const clearBtn = screen.getByText('Clear all');
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it('should not show Clear all button when no filters are active', () => {
    const inactiveFilters: FilterChip[] = [
      { key: 'league', label: 'League', active: false },
      { key: 'tournament', label: 'Tournament', active: false },
    ];

    render(
      <AdminFilterBar
        filters={inactiveFilters}
        onFilterToggle={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );

    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });

  it('should not show Clear all button when onClearAll is not provided', () => {
    render(
      <AdminFilterBar filters={filters} onFilterToggle={vi.fn()} />,
    );

    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });

  it('should render children in the trailing slot', () => {
    render(
      <AdminFilterBar filters={filters} onFilterToggle={vi.fn()}>
        <input data-testid="search-input" placeholder="Search..." />
      </AdminFilterBar>,
    );

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });
});
