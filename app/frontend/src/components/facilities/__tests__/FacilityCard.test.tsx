import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock FacilityIcon to avoid dynamic asset imports
vi.mock('../../FacilityIcon', () => ({
  default: () => <div data-testid="facility-icon" />,
}));

import { FacilityCard } from '../FacilityCard';
import type { Facility } from '../types';

const makeFacility = (overrides: Partial<Facility> = {}): Facility => ({
  type: 'training_facility',
  name: 'Training Facility',
  description: 'Reduces upgrade costs',
  maxLevel: 10,
  costs: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
  benefits: ['5% discount', '10% discount', '15% discount', '20% discount', '25% discount', '30% discount', '35% discount', '40% discount', '45% discount', '50% discount'],
  currentLevel: 3,
  upgradeCost: 4000,
  canUpgrade: true,
  implemented: true,
  currentBenefit: '15% discount',
  nextBenefit: '20% discount',
  ...overrides,
});

const defaultProps = {
  currency: 50000,
  userPrestige: 100,
  upgrading: null,
  onUpgrade: vi.fn(),
  facilityRef: vi.fn(),
};

function renderCard(facilityOverrides: Partial<Facility> = {}, propOverrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...propOverrides };
  return render(
    <FacilityCard
      facility={makeFacility(facilityOverrides)}
      currency={props.currency}
      userPrestige={props.userPrestige}
      upgrading={props.upgrading}
      onUpgrade={props.onUpgrade}
      facilityRef={props.facilityRef}
    />,
  );
}

describe('FacilityCard', () => {
  it('displays facility name and level progress', () => {
    renderCard();

    expect(screen.getByText('Training Facility')).toBeInTheDocument();
    expect(screen.getByText('3/10')).toBeInTheDocument();
  });

  it('shows "Coming Soon" badge when implemented is false', () => {
    renderCard({ implemented: false });

    const comingSoonElements = screen.getAllByText(/Coming Soon/);
    expect(comingSoonElements.length).toBeGreaterThanOrEqual(1);
    // The badge in the top-right corner
    expect(screen.getByText(/⚠ Coming Soon/)).toBeInTheDocument();
  });

  it('shows upgrade button enabled when credits sufficient and prestige met', () => {
    renderCard();

    const upgradeButton = screen.getByRole('button', { name: /upgrade/i });
    expect(upgradeButton).toBeEnabled();
  });

  it('disables upgrade button when credits insufficient and shows message', () => {
    renderCard({}, { currency: 100 });

    const upgradeButton = screen.getByRole('button', { name: /upgrade/i });
    expect(upgradeButton).toBeDisabled();
    expect(screen.getByText(/Insufficient credits/i)).toBeInTheDocument();
  });

  it('shows "Maximum Level Reached" when canUpgrade is false', () => {
    renderCard({ canUpgrade: false });

    expect(screen.getByText(/Maximum Level Reached/)).toBeInTheDocument();
  });

  it('shows prestige requirement warning when prestige insufficient', () => {
    renderCard(
      { nextLevelPrestigeRequired: 500, hasPrestige: false },
      { userPrestige: 50 },
    );

    expect(screen.getByText(/Insufficient prestige/)).toBeInTheDocument();
  });

  it('calls onUpgrade when upgrade button is clicked', async () => {
    const user = userEvent.setup();
    const onUpgrade = vi.fn();
    renderCard({}, { onUpgrade });

    await user.click(screen.getByRole('button', { name: /upgrade/i }));

    expect(onUpgrade).toHaveBeenCalledWith('training_facility');
  });
});
