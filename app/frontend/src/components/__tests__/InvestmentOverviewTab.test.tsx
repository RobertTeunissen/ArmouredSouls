/**
 * Frontend component tests for InvestmentOverviewTab
 *
 * Tests rendering with ROI data, empty state, recommendations,
 * economic-only filtering, and loading state.
 *
 * **Validates: Requirements 4.2**
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InvestmentOverviewTab } from '../facilities/InvestmentOverviewTab';
import type { UnifiedFacilityROI, FacilityRecommendation } from '../facilities/types';

const mockGetFacilityDisplayName = (type: string): string => {
  const names: Record<string, string> = {
    merchandising_hub: 'Merchandising Hub',
    streaming_studio: 'Streaming Studio',
    repair_bay: 'Repair Bay',
    training_facility: 'Training Facility',
    weapons_workshop: 'Weapons Workshop',
  };
  return names[type] || type;
};

const createMockROI = (overrides: Partial<UnifiedFacilityROI> = {}): UnifiedFacilityROI => ({
  facilityType: 'merchandising_hub',
  currentLevel: 3,
  totalInvestment: 900000,
  totalReturns: 450000,
  totalOperatingCosts: 30000,
  netROI: -0.53,
  paidOff: false,
  projectedPayoffCycles: 45,
  cyclesSincePurchase: 20,
  dataSource: 'snapshot',
  ...overrides,
});

const createMockRecommendation = (overrides: Partial<FacilityRecommendation> = {}): FacilityRecommendation => ({
  facilityType: 'merchandising_hub',
  facilityName: 'Merchandising Hub',
  currentLevel: 3,
  recommendedLevel: 5,
  upgradeCost: 1350000,
  projectedROI: 0.25,
  projectedPayoffCycles: 30,
  reason: 'High prestige makes this a strong investment',
  priority: 'high',
  ...overrides,
});

describe('InvestmentOverviewTab', () => {
  describe('rendering with ROI data', () => {
    it('should display all 5 economic facilities when provided', () => {
      const facilityROIs: UnifiedFacilityROI[] = [
        createMockROI({ facilityType: 'merchandising_hub', currentLevel: 3 }),
        createMockROI({ facilityType: 'streaming_studio', currentLevel: 2 }),
        createMockROI({ facilityType: 'repair_bay', currentLevel: 4 }),
        createMockROI({ facilityType: 'training_facility', currentLevel: 5 }),
        createMockROI({ facilityType: 'weapons_workshop', currentLevel: 1 }),
      ];

      render(
        <InvestmentOverviewTab
          loading={false}
          facilityROIs={facilityROIs}
          recommendations={[]}
          getFacilityDisplayName={mockGetFacilityDisplayName}
        />
      );

      expect(screen.getByText('Merchandising Hub')).toBeInTheDocument();
      expect(screen.getByText('Streaming Studio')).toBeInTheDocument();
      expect(screen.getByText('Repair Bay')).toBeInTheDocument();
      expect(screen.getByText('Training Facility')).toBeInTheDocument();
      expect(screen.getByText('Weapons Workshop')).toBeInTheDocument();
    });

    it('should display investment and returns for each facility', () => {
      const facilityROIs: UnifiedFacilityROI[] = [
        createMockROI({
          facilityType: 'merchandising_hub',
          totalInvestment: 900000,
          totalReturns: 450000,
        }),
      ];

      render(
        <InvestmentOverviewTab
          loading={false}
          facilityROIs={facilityROIs}
          recommendations={[]}
          getFacilityDisplayName={mockGetFacilityDisplayName}
        />
      );

      expect(screen.getByText('₡900,000')).toBeInTheDocument();
      expect(screen.getByText('₡450,000')).toBeInTheDocument();
    });

    it('should show "Paid Off" badge when facility is paid off', () => {
      const facilityROIs: UnifiedFacilityROI[] = [
        createMockROI({
          paidOff: true,
          projectedPayoffCycles: null,
        }),
      ];

      render(
        <InvestmentOverviewTab
          loading={false}
          facilityROIs={facilityROIs}
          recommendations={[]}
          getFacilityDisplayName={mockGetFacilityDisplayName}
        />
      );

      expect(screen.getByText('Paid Off ✓')).toBeInTheDocument();
    });

    it('should show estimated warning when dataSource is estimate', () => {
      const facilityROIs: UnifiedFacilityROI[] = [
        createMockROI({ dataSource: 'estimate' }),
      ];

      render(
        <InvestmentOverviewTab
          loading={false}
          facilityROIs={facilityROIs}
          recommendations={[]}
          getFacilityDisplayName={mockGetFacilityDisplayName}
        />
      );

      expect(screen.getByText('⚠ Estimated (no snapshot data)')).toBeInTheDocument();
    });
  });

  describe('rendering empty state', () => {
    it('should display empty state when no facilities are owned', () => {
      render(
        <InvestmentOverviewTab
          loading={false}
          facilityROIs={[]}
          recommendations={[]}
          getFacilityDisplayName={mockGetFacilityDisplayName}
        />
      );

      expect(screen.getByText('No economic facilities owned')).toBeInTheDocument();
      expect(
        screen.getByText('Purchase economic facilities to see investment performance.')
      ).toBeInTheDocument();
    });
  });

  describe('rendering recommendations section', () => {
    it('should display recommendations with priority badges', () => {
      const recommendations: FacilityRecommendation[] = [
        createMockRecommendation({
          facilityName: 'Merchandising Hub',
          priority: 'high',
          reason: 'High prestige makes this a strong investment',
        }),
        createMockRecommendation({
          facilityType: 'streaming_studio',
          facilityName: 'Streaming Studio',
          priority: 'medium',
          reason: 'Good for active players',
        }),
      ];

      render(
        <InvestmentOverviewTab
          loading={false}
          facilityROIs={[createMockROI()]}
          recommendations={recommendations}
          getFacilityDisplayName={mockGetFacilityDisplayName}
        />
      );

      expect(screen.getByText('Upgrade Recommendations')).toBeInTheDocument();
      expect(screen.getByText('High prestige makes this a strong investment')).toBeInTheDocument();
      expect(screen.getByText('Good for active players')).toBeInTheDocument();
      expect(screen.getByText('High Priority')).toBeInTheDocument();
      expect(screen.getByText('Medium Priority')).toBeInTheDocument();
    });

    it('should not render recommendations section when empty', () => {
      render(
        <InvestmentOverviewTab
          loading={false}
          facilityROIs={[createMockROI()]}
          recommendations={[]}
          getFacilityDisplayName={mockGetFacilityDisplayName}
        />
      );

      expect(screen.queryByText('Upgrade Recommendations')).not.toBeInTheDocument();
    });
  });

  describe('only economic facilities appear', () => {
    it('should only render the provided economic facility types', () => {
      // Only provide 3 economic facilities
      const facilityROIs: UnifiedFacilityROI[] = [
        createMockROI({ facilityType: 'merchandising_hub' }),
        createMockROI({ facilityType: 'repair_bay' }),
        createMockROI({ facilityType: 'streaming_studio' }),
      ];

      render(
        <InvestmentOverviewTab
          loading={false}
          facilityROIs={facilityROIs}
          recommendations={[]}
          getFacilityDisplayName={mockGetFacilityDisplayName}
        />
      );

      expect(screen.getByText('Merchandising Hub')).toBeInTheDocument();
      expect(screen.getByText('Repair Bay')).toBeInTheDocument();
      expect(screen.getByText('Streaming Studio')).toBeInTheDocument();
      // Non-economic facilities should not appear
      expect(screen.queryByText('Roster Expansion')).not.toBeInTheDocument();
      expect(screen.queryByText('Storage Facility')).not.toBeInTheDocument();
      expect(screen.queryByText('Combat Training Academy')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should render loading state correctly', () => {
      render(
        <InvestmentOverviewTab
          loading={true}
          facilityROIs={[]}
          recommendations={[]}
          getFacilityDisplayName={mockGetFacilityDisplayName}
        />
      );

      expect(screen.getByText('Loading investment data...')).toBeInTheDocument();
    });

    it('should not render facility data while loading', () => {
      render(
        <InvestmentOverviewTab
          loading={true}
          facilityROIs={[createMockROI()]}
          recommendations={[createMockRecommendation()]}
          getFacilityDisplayName={mockGetFacilityDisplayName}
        />
      );

      expect(screen.queryByText('Investment Performance')).not.toBeInTheDocument();
      expect(screen.queryByText('Upgrade Recommendations')).not.toBeInTheDocument();
    });
  });
});
