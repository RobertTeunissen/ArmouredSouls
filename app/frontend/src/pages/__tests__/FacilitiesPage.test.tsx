import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Facility } from '../../components/facilities/types';

// Mock FacilityIcon to avoid dynamic asset imports
vi.mock('../../components/FacilityIcon', () => ({
  default: () => <div data-testid="facility-icon" />,
}));

const mockUseFacilities = vi.fn();
vi.mock('../../components/facilities/useFacilities', () => ({
  useFacilities: () => mockUseFacilities(),
}));

vi.mock('../../components/facilities/InvestmentOverviewTab', () => ({
  InvestmentOverviewTab: ({ loading }: { loading: boolean }) => (
    <div data-testid="investment-overview">{loading ? 'advisor loading' : 'advisor ready'}</div>
  ),
}));

import FacilitiesPage from '../FacilitiesPage';

function facility(type: string, name: string): Facility {
  return {
    type, name, description: `${name} description`, maxLevel: 10, costs: [1000], benefits: ['benefit'],
    currentLevel: 1, upgradeCost: 2000, canUpgrade: true, implemented: true,
  };
}

const FACILITIES = [facility('repair_bay', 'Repair Bay'), facility('roster_expansion', 'Roster Expansion')];

function hookState(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 1 },
    currency: 100000,
    activeTab: 'facilities',
    setActiveTab: vi.fn(),
    facilities: FACILITIES,
    userPrestige: 0,
    loading: false,
    upgrading: null,
    error: null,
    collapsedCategories: new Set<string>(),
    facilityRefs: { current: {} },
    facilityROIs: [],
    recommendations: [],
    advisorLoading: false,
    handleUpgrade: vi.fn(),
    toggleCategory: vi.fn(),
    getCategoryFacilities: (types: string[]) => FACILITIES.filter((f) => types.includes(f.type)),
    getFacilityDisplayName: (type: string) => type,
    ...overrides,
  };
}

beforeEach(() => {
  mockUseFacilities.mockReset();
});

describe('FacilitiesPage', () => {
  it('renders nothing without a signed-in user', () => {
    mockUseFacilities.mockReturnValue(hookState({ user: null }));
    const { container } = render(<FacilitiesPage />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists facilities per category with the current tab marked', () => {
    mockUseFacilities.mockReturnValue(hookState());
    render(<FacilitiesPage />);

    expect(screen.getByRole('button', { name: 'Facilities & Upgrades' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Investment Overview' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Repair Bay')).toBeInTheDocument();
    expect(screen.getByText('Roster Expansion')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Economy/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('hides a collapsed category and reports toggles and tab switches', () => {
    const state = hookState({ collapsedCategories: new Set(['economy']) });
    mockUseFacilities.mockReturnValue(state);
    render(<FacilitiesPage />);

    const economy = screen.getByRole('button', { name: /Economy/ });
    expect(economy).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Repair Bay')).not.toBeInTheDocument();
    fireEvent.click(economy);
    expect(state.toggleCategory).toHaveBeenCalledWith('economy');

    fireEvent.click(screen.getByRole('button', { name: 'Investment Overview' }));
    expect(state.setActiveTab).toHaveBeenCalledWith('investment-overview');
  });

  it('shows the investment overview tab, loading and errors', () => {
    mockUseFacilities.mockReturnValue(hookState({ activeTab: 'investment-overview', advisorLoading: true, error: 'Upgrade failed' }));
    render(<FacilitiesPage />);
    expect(screen.getByTestId('investment-overview')).toHaveTextContent('advisor loading');
    expect(screen.getByText('Upgrade failed')).toBeInTheDocument();
    expect(screen.queryByText('Repair Bay')).not.toBeInTheDocument();
  });

  it('shows a loading state before the facilities arrive', () => {
    mockUseFacilities.mockReturnValue(hookState({ loading: true }));
    render(<FacilitiesPage />);
    expect(screen.getByText('Loading facilities...')).toBeInTheDocument();
  });
});
