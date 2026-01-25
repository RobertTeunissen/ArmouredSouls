// Simplified facility types for Phase 1 prototype
export interface FacilityConfig {
  type: string;
  name: string;
  description: string;
  maxLevel: number;
  costs: number[]; // Cost for each level (index 0 = level 1, etc.)
  benefits: string[]; // Benefit description for each level
}

export const FACILITY_TYPES: FacilityConfig[] = [
  {
    type: 'repair_bay',
    name: 'Repair Bay',
    description: 'Reduces repair costs for damaged robots',
    maxLevel: 5,
    costs: [200000, 400000, 600000, 800000, 1000000],
    benefits: [
      '10% discount on repair costs',
      '15% discount on repair costs',
      '20% discount on repair costs',
      '25% discount on repair costs',
      '30% discount on repair costs',
    ],
  },
  {
    type: 'training_facility',
    name: 'Training Facility',
    description: 'Reduces costs for upgrading robot attributes',
    maxLevel: 5,
    costs: [300000, 600000, 900000, 1200000, 1500000],
    benefits: [
      '5% discount on attribute upgrades',
      '10% discount on attribute upgrades',
      '15% discount on attribute upgrades',
      '20% discount on attribute upgrades',
      '25% discount on attribute upgrades',
    ],
  },
  {
    type: 'weapons_workshop',
    name: 'Weapons Workshop',
    description: 'Reduces costs for purchasing weapons',
    maxLevel: 5,
    costs: [250000, 500000, 750000, 1000000, 1300000],
    benefits: [
      '10% discount on weapon purchases',
      '15% discount on weapon purchases',
      '20% discount on weapon purchases',
      '25% discount on weapon purchases',
      '30% discount on weapon purchases',
    ],
  },
  {
    type: 'roster_expansion',
    name: 'Roster Expansion',
    description: 'Increases the number of robots you can own',
    maxLevel: 5,
    costs: [300000, 600000, 900000, 1200000, 1500000],
    benefits: [
      '2 robot slots',
      '3 robot slots',
      '4 robot slots',
      '5 robot slots',
      '6 robot slots',
    ],
  },
];

// Helper function to get facility config by type
export function getFacilityConfig(type: string): FacilityConfig | undefined {
  return FACILITY_TYPES.find((f) => f.type === type);
}

// Helper function to get cost for a specific level
export function getFacilityUpgradeCost(type: string, currentLevel: number): number {
  const config = getFacilityConfig(type);
  if (!config || currentLevel >= config.maxLevel) {
    return 0;
  }
  return config.costs[currentLevel];
}
