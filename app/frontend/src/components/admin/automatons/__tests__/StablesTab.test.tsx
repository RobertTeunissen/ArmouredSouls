import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { StablesTab, type StablesTabProps } from '../StablesTab';
import { LIBRARY, PROFILES, listItem } from './fixtures';

function tabProps(overrides: Partial<StablesTabProps> = {}): StablesTabProps {
  return {
    profiles: PROFILES,
    strategies: LIBRARY,
    filter: 'all',
    strategyFilter: null,
    query: '',
    sort: null,
    onFilterChange: vi.fn(),
    onStrategyChange: vi.fn(),
    onQueryChange: vi.fn(),
    onSortChange: vi.fn(),
    onClearFilters: vi.fn(),
    onOpenStable: vi.fn(),
    onActivateAll: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function renderTab(overrides: Partial<StablesTabProps> = {}): StablesTabProps {
  const props = tabProps(overrides);
  render(<StablesTab {...props} />);
  return props;
}

const table = (): HTMLElement => screen.getByRole('table');
const rowOf = (name: string): HTMLElement => within(table()).getByRole('button', { name }).closest('tr') as HTMLElement;

describe('StablesTab', () => {
  it('shows the highest tier with its mode under "Highest tier (any mode)", with the footnote', () => {
    const never = listItem({ catalogueKey: 'never-played', stableName: 'Never Played', bestTier: null, bestTierMode: null });
    renderTab({ profiles: [...PROFILES, never] });
    expect(within(table()).getByRole('columnheader', { name: /^Highest tier \(any mode\)/ })).toBeInTheDocument();
    expect(within(rowOf('Kamino Clone Legion')).getByText('Gold · 3v3 League')).toBeInTheDocument();
    expect(within(rowOf('Decepticon Armada')).getByText('Silver · 1v1 League')).toBeInTheDocument();
    const cells = (name: string): string[] => within(rowOf(name)).getAllByRole('cell').map((c) => c.textContent ?? '');
    expect(cells('Never Played')[6]).toBe('—');
    expect(cells('Grim Reaper Works')[6]).toBe('—');
    expect(screen.getByText(/^Highest tier \(any mode\): the highest league tier one of the stable's robots or teams holds right now \(not its peak this season\)/))
      .toHaveTextContent('Only modes the stable has actually played count; tournaments have no tier.');
    // Mobile cards show the tier with its mode too.
    const cards = screen.getByRole('list', { name: 'Stables' });
    expect(within(cards).getByText('Gold · 3v3 League')).toBeInTheDocument();
  });

  it('lists All strategies plus display names and reports the chosen strategy', () => {
    const props = renderTab();
    const select = screen.getByRole('combobox', { name: 'Strategy' });
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['All strategies', 'Generalist', 'Paragon', 'Swarm', 'Trio']);
    expect(select).toHaveValue('');
    fireEvent.change(select, { target: { value: 'trio' } });
    expect(props.onStrategyChange).toHaveBeenCalledWith('trio');
    fireEvent.change(select, { target: { value: '' } });
    expect(props.onStrategyChange).toHaveBeenLastCalledWith(null);
  });

  it('shows the strategy chip with the display name and clears it', () => {
    const props = renderTab({ strategyFilter: 'swarm' });
    expect(screen.getByRole('combobox', { name: 'Strategy' })).toHaveValue('swarm');
    const chips = screen.getByRole('group', { name: 'Filter stables' });
    const chip = within(chips).getByRole('button', { name: /^Strategy: Swarm/ });
    expect(chip).toHaveTextContent('Strategy: Swarm ✕');
    fireEvent.click(chip);
    expect(props.onStrategyChange).toHaveBeenCalledWith(null);
    expect(within(chips).getByRole('button', { name: 'All · 1' })).toBeInTheDocument();
  });

  it('reports search input', () => {
    const props = renderTab({ query: 'kam' });
    const search = screen.getByRole('searchbox', { name: 'Search stables' });
    expect(search).toHaveValue('kam');
    expect(search).toHaveAttribute('placeholder', 'Name, key or franchise');
    expect(search).toHaveAttribute('maxLength', '100');
    fireEvent.change(search, { target: { value: 'kamino' } });
    expect(props.onQueryChange).toHaveBeenCalledWith('kamino');
  });

  it('sorts from the column headers and exposes aria-sort', () => {
    const props = renderTab({ sort: { key: 'credits', direction: 'desc' } });
    const credits = within(table()).getByRole('columnheader', { name: /^Credits/ });
    expect(credits).toHaveAttribute('aria-sort', 'descending');
    expect(within(table()).getByRole('columnheader', { name: /^Prestige/ })).toHaveAttribute('aria-sort', 'none');
    expect(within(table()).getByRole('columnheader', { name: 'Status' })).not.toHaveAttribute('aria-sort');
    expect(within(table()).getByRole('columnheader', { name: 'Needs attention' })).not.toHaveAttribute('aria-sort');
    fireEvent.click(within(credits).getByRole('button', { name: /^Credits/ }));
    expect(props.onSortChange).toHaveBeenCalledWith({ key: 'credits', direction: 'asc' });
    fireEvent.click(within(table()).getByRole('button', { name: /^Stable/ }));
    expect(props.onSortChange).toHaveBeenLastCalledWith({ key: 'name', direction: 'asc' });
    // Rows follow the sort: credits descending, the draft (no balance) last.
    const names = within(table()).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent);
    expect(names).toEqual(['Kamino Clone Legion', 'Decepticon Armada', 'Grim Reaper Works']);
  });

  it('offers a labelled Sort by select and direction button', () => {
    const props = renderTab();
    const sortBy = screen.getByRole('combobox', { name: 'Sort by' });
    expect(within(sortBy).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Catalogue order', 'Stable name', 'Strategy', 'Robots', 'Credits', 'Prestige', 'Highest tier', 'Last cycle']);
    expect(screen.getByRole('button', { name: /^Sort direction/ })).toBeDisabled();
    fireEvent.change(sortBy, { target: { value: 'prestige' } });
    expect(props.onSortChange).toHaveBeenCalledWith({ key: 'prestige', direction: 'desc' });
    fireEvent.change(sortBy, { target: { value: '' } });
    expect(props.onSortChange).toHaveBeenLastCalledWith(null);
  });

  it('toggles the direction from the direction button', () => {
    const props = renderTab({ sort: { key: 'tier', direction: 'desc' } });
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('tier');
    const direction = screen.getByRole('button', { name: 'Sort direction: Descending' });
    fireEvent.click(direction);
    expect(props.onSortChange).toHaveBeenCalledWith({ key: 'tier', direction: 'asc' });
  });

  it('shows the result count and keeps the chip names', () => {
    renderTab({ filter: 'active' });
    expect(screen.getByText('2 of 3 stables')).toHaveAttribute('role', 'status');
    const chips = screen.getByRole('group', { name: 'Filter stables' });
    expect(within(chips).getByRole('button', { name: 'All · 3' })).toBeInTheDocument();
    expect(within(chips).getByRole('button', { name: 'Needs attention · 1' })).toBeInTheDocument();
    const active = within(chips).getByRole('button', { name: 'Active · 2' });
    expect(active).toHaveAttribute('aria-pressed', 'true');
    // The selected chip is marked by a check mark, not by colour alone.
    expect(within(active).getByText('✓')).toBeInTheDocument();
    const all = within(chips).getByRole('button', { name: 'All · 3' });
    expect(all).toHaveAttribute('aria-pressed', 'false');
    expect(within(all).queryByText('✓')).not.toBeInTheDocument();
  });

  it('chip counts follow the search text', () => {
    renderTab({ query: 'decep' });
    const chips = screen.getByRole('group', { name: 'Filter stables' });
    expect(within(chips).getByRole('button', { name: 'All · 1' })).toBeInTheDocument();
    expect(within(chips).getByRole('button', { name: 'Draft · 0' })).toBeInTheDocument();
    expect(screen.getByText('1 of 3 stables')).toBeInTheDocument();
  });

  it('offers Clear filters when nothing matches', () => {
    const props = renderTab({ query: 'no such stable' });
    expect(screen.getByText('No stables match these filters.')).toBeInTheDocument();
    expect(screen.getByText('0 of 3 stables')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(props.onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('shows the loading and no-stables states', () => {
    const { unmount } = render(<StablesTab {...tabProps({ profiles: null })} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    unmount();
    render(<StablesTab {...tabProps({ profiles: [] })} />);
    expect(screen.getByText('No stables yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('keeps every toolbar control at least 44 px high', () => {
    renderTab();
    for (const control of [
      screen.getByRole('combobox', { name: 'Strategy' }),
      screen.getByRole('searchbox', { name: 'Search stables' }),
      screen.getByRole('combobox', { name: 'Sort by' }),
      screen.getByRole('button', { name: /^Sort direction/ }),
      ...within(table()).getAllByRole('columnheader').flatMap((h) => within(h).queryAllByRole('button')),
    ]) {
      expect(control.className).toContain('min-h-11');
    }
  });
});
