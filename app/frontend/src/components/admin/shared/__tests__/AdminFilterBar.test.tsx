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
import { AdminFilterBar, REAL_PLAYERS_HELP, type FilterChip } from '../AdminFilterBar';

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

  it('describes a chip with its help text (Spec #55: Real Players excludes Automatons)', () => {
    render(
      <AdminFilterBar
        filters={[
          { key: 'real', label: 'Real Players', active: true, description: REAL_PLAYERS_HELP },
          { key: 'auto', label: 'Auto-Generated', active: false },
          { key: 'automaton', label: 'Automatons', active: false },
          { key: 'all', label: 'All', active: false },
        ]}
        onFilterToggle={vi.fn()}
      />,
    );
    expect(REAL_PLAYERS_HELP).toBe('Human players only. Excludes auto-generated bots and Automatons.');
    expect(screen.getByRole('button', { name: 'Real Players' })).toHaveAccessibleDescription(REAL_PLAYERS_HELP);
    expect(screen.getByRole('button', { name: 'Real Players' })).toHaveAttribute('title', REAL_PLAYERS_HELP);
    expect(screen.getByRole('button', { name: 'Automatons' })).not.toHaveAttribute('aria-describedby');
  });

  describe('segmented variant', () => {
    const segmented: FilterChip[] = [
      { key: 'real', label: 'Real players', shortLabel: 'Real', active: true, description: REAL_PLAYERS_HELP },
      { key: 'auto', label: 'Auto-generated', shortLabel: 'Generated', active: false },
      { key: 'all', label: 'All', active: false },
    ];

    it('renders one labelled group of pressed/unpressed buttons', () => {
      render(<AdminFilterBar variant="segmented" groupLabel="Stable type filter" filters={segmented} onFilterToggle={vi.fn()} />);

      const group = screen.getByRole('group', { name: 'Stable type filter' });
      expect(group).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Real players/ })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /Auto-generated/ })).toHaveAttribute('aria-pressed', 'false');
    });

    it('renders both the short and the full label (shown per breakpoint)', () => {
      render(<AdminFilterBar variant="segmented" filters={segmented} onFilterToggle={vi.fn()} />);

      expect(screen.getByText('Generated')).toHaveClass('sm:hidden');
      expect(screen.getByText('Auto-generated')).toHaveClass('hidden', 'sm:inline');
    });

    it('keeps the help text and reports the clicked key', () => {
      const onFilterToggle = vi.fn();
      render(<AdminFilterBar variant="segmented" filters={segmented} onFilterToggle={onFilterToggle} />);

      expect(screen.getByRole('button', { name: /Real players/ })).toHaveAccessibleDescription(REAL_PLAYERS_HELP);
      fireEvent.click(screen.getByRole('button', { name: 'All' }));
      expect(onFilterToggle).toHaveBeenCalledWith('all');
    });
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
