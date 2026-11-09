/** Weapon Shop filter panel and the active-filter chips. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import FilterPanel, { type WeaponFilters } from '../FilterPanel';
import ActiveFiltersDisplay from '../ActiveFiltersDisplay';

const EMPTY: WeaponFilters = {
  loadoutTypes: [], weaponTypes: [], rangeBands: [], priceRange: null, canAffordOnly: false, onlyOwnedWeapons: false,
};

/** FilterPanel with its filters held in state, as the shop page holds them. */
function StatefulPanel({ onChange }: { onChange: (filters: WeaponFilters) => void }) {
  const [filters, setFilters] = useState(EMPTY);
  return (
    <FilterPanel
      filters={filters}
      onFiltersChange={(next) => { setFilters(next); onChange(next); }}
      userCredits={123456}
      weaponCount={40}
      filteredCount={12}
    />
  );
}

// setupTests replaces localStorage with bare mocks; back them with a map here.
beforeEach(() => {
  const store = new Map<string, string>();
  vi.mocked(localStorage.getItem).mockImplementation((key) => store.get(key) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((key, value) => { store.set(key, String(value)); });
});

describe('FilterPanel', () => {
  it('starts collapsed, shows the result count, and remembers being opened', () => {
    const { unmount } = render(<StatefulPanel onChange={vi.fn()} />);
    expect(screen.getByText('Showing 12 of 40 weapons')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Show filters' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Loadout Type')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide filters' })).toHaveAttribute('aria-expanded', 'true');
    expect(localStorage.getItem('weaponShopFiltersExpanded')).toBe('true');

    unmount();
    render(<StatefulPanel onChange={vi.fn()} />);
    expect(screen.getByText('Loadout Type')).toBeInTheDocument();
  });

  it('toggles filters on and off and reports their pressed state', () => {
    localStorage.setItem('weaponShopFiltersExpanded', 'true');
    const onChange = vi.fn();
    render(<StatefulPanel onChange={onChange} />);

    const twoHanded = screen.getByRole('button', { name: 'Two-Handed' });
    fireEvent.click(twoHanded);
    expect(twoHanded).toHaveAttribute('aria-pressed', 'true');
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, loadoutTypes: ['two_handed'] });

    fireEvent.click(screen.getByRole('button', { name: 'Energy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Long' }));
    fireEvent.click(screen.getByRole('button', { name: 'Can Afford (₡123,456)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Only Owned Weapons' }));
    expect(onChange).toHaveBeenLastCalledWith({
      loadoutTypes: ['two_handed'], weaponTypes: ['energy'], rangeBands: ['long'],
      priceRange: null, canAffordOnly: true, onlyOwnedWeapons: true,
    });

    fireEvent.click(twoHanded);
    expect(twoHanded).toHaveAttribute('aria-pressed', 'false');
  });

  it('picks one price range at a time and clears it on a second click', () => {
    localStorage.setItem('weaponShopFiltersExpanded', 'true');
    const onChange = vi.fn();
    render(<StatefulPanel onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Budget (<₡100K)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Luxury (₡400K+)' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, priceRange: { min: 400000, max: Infinity } });
    expect(screen.getByRole('button', { name: 'Budget (<₡100K)' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Luxury (₡400K+)' }));
    expect(onChange).toHaveBeenLastCalledWith(EMPTY);
  });

  it('clears every filter at once', () => {
    const onChange = vi.fn();
    render(
      <FilterPanel
        filters={{ ...EMPTY, weaponTypes: ['melee'], canAffordOnly: true }}
        onFiltersChange={onChange}
        userCredits={0}
        weaponCount={1}
        filteredCount={1}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));
    expect(onChange).toHaveBeenCalledWith(EMPTY);
  });
});

describe('ActiveFiltersDisplay', () => {
  it('renders nothing without active filters', () => {
    const { container } = render(<ActiveFiltersDisplay filters={EMPTY} onRemoveFilter={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a removable chip per active filter', () => {
    const onRemove = vi.fn();
    render(
      <ActiveFiltersDisplay
        filters={{
          loadoutTypes: ['weapon_shield'], weaponTypes: ['ballistic'], rangeBands: ['short'],
          priceRange: { min: 100000, max: 250000 }, canAffordOnly: true, onlyOwnedWeapons: true,
        }}
        onRemoveFilter={onRemove}
      />,
    );
    expect(screen.getByText('Weapon + Shield')).toBeInTheDocument();
    expect(screen.getByText('Ballistic')).toBeInTheDocument();
    expect(screen.getByText('Short Range')).toBeInTheDocument();
    expect(screen.getByText('₡100K-₡250K')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Weapon + Shield filter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ballistic filter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Short range filter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove price range filter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove can afford filter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove only owned filter' }));
    expect(onRemove.mock.calls).toEqual([
      ['loadoutType', 'weapon_shield'], ['weaponType', 'ballistic'], ['rangeBand', 'short'],
      ['priceRange'], ['canAfford'], ['onlyOwned'],
    ]);
  });

  it('shows the open-ended Luxury range as ₡400K+', () => {
    render(<ActiveFiltersDisplay filters={{ ...EMPTY, priceRange: { min: 400000, max: Infinity } }} onRemoveFilter={vi.fn()} />);
    expect(screen.getByText('₡400K+')).toBeInTheDocument();
  });
});
