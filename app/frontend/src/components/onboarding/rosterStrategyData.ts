/**
 * Roster strategy options shown in onboarding step 1.
 *
 * Kept out of `RosterStrategyCard.tsx` so that file exports only components,
 * which React fast refresh requires (`react-refresh/only-export-components`).
 *
 * Requirements: 4.1-4.8, 8.1-8.9
 */

export type RosterStrategy = '1_mighty' | '2_average' | '3_flimsy';

export interface StrategyData {
  name: string;
  description: string;
  robotCount: number;
  battlesPerDay: string;
  powerLevel: string;
  complexity: string;
  facilityInvestment: string;
  riskProfile: string;
  advantages: string[];
  disadvantages: string[];
  budgetBreakdown: {
    facilities: { min: number; max: number };
    robots: { min: number; max: number };
    weapons: { min: number; max: number };
    attributes: { min: number; max: number };
    reserve: { min: number; max: number };
  };
  imagePath: string;
}

export const STRATEGY_DATA: Record<RosterStrategy, StrategyData> = {
  '1_mighty': {
    name: '1 Mighty Robot',
    description: 'Maximum power concentration, simplest management',
    robotCount: 1,
    battlesPerDay: '~1.6',
    powerLevel: 'Highest',
    complexity: 'Simplest',
    facilityInvestment: 'Moderate',
    riskProfile: 'High risk if robot damaged',
    advantages: [
      'Maximum power concentration',
      'Simplest management',
      'Higher chance of winning battles',
      'Can reach highest attribute levels fastest',
    ],
    disadvantages: [
      'Single point of failure',
      'Fewer battles per day',
      'Limited strategic flexibility',
      'High repair costs if you LOSE a battle',
    ],
    budgetBreakdown: {
      facilities: { min: 350000, max: 350000 },
      robots: { min: 500000, max: 500000 },
      weapons: { min: 550000, max: 550000 },
      attributes: { min: 1550000, max: 1550000 },
      reserve: { min: 50000, max: 50000 },
    },
    imagePath: '/assets/onboarding/strategies/roster-1-mighty.webp',
  },
  '2_average': {
    name: '2 Average Robots',
    description: 'Balanced power and participation, moderate complexity',
    robotCount: 2,
    battlesPerDay: '~3.2',
    powerLevel: 'Moderate',
    complexity: 'Moderate',
    facilityInvestment: 'Moderate',
    riskProfile: 'Distributed risk',
    advantages: [
      'Balanced power and participation',
      'Risk distribution',
      'Moderate complexity',
      'Flexible strategies',
      'Unlocks Tag Team battles',
    ],
    disadvantages: [
      'Requires Roster Expansion facility',
      'Split attribute upgrade budget',
      'More weapon purchases needed',
      'Moderate facility investment',
      'Could mean MORE total repair costs if you lose more battles',
    ],
    budgetBreakdown: {
      facilities: { min: 350000, max: 350000 },
      robots: { min: 1000000, max: 1000000 },
      weapons: { min: 500000, max: 500000 },
      attributes: { min: 1100000, max: 1100000 },
      reserve: { min: 50000, max: 50000 },
    },
    imagePath: '/assets/onboarding/strategies/roster-2-average.webp',
  },
  '3_flimsy': {
    name: '3 Flimsy Robots',
    description: 'Maximum battle participation, highest complexity',
    robotCount: 3,
    battlesPerDay: '~4.8',
    powerLevel: 'Lowest',
    complexity: 'Most Complex',
    facilityInvestment: 'Highest',
    riskProfile: 'Distributed risk',
    advantages: [
      'Maximum battle participation',
      'Distributed risk',
      'Highest passive income potential',
      'Multiple strategic approaches',
      'Unlocks Tag Team battles',
    ],
    disadvantages: [
      'Highest facility investment (Roster Expansion Level 2)',
      'Lowest power per robot',
      'Most complex management',
      'Requires more weapons',
      'Could mean MORE total repair costs if you lose more battles',
    ],
    budgetBreakdown: {
      facilities: { min: 350000, max: 350000 },
      robots: { min: 1500000, max: 1500000 },
      weapons: { min: 450000, max: 450000 },
      attributes: { min: 650000, max: 650000 },
      reserve: { min: 50000, max: 50000 },
    },
    imagePath: '/assets/onboarding/strategies/roster-3-flimsy.webp',
  },
};
