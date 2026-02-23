// Facility configuration for Phase 1 prototype - All 14 facilities
export interface FacilityConfig {
  type: string;
  name: string;
  description: string;
  maxLevel: number;
  costs: number[]; // Cost for each level (index 0 = level 1, etc.)
  benefits: string[]; // Benefit description for each level
  implemented: boolean; // Whether backend logic is implemented
  /**
   * Prestige requirements for each level (optional)
   * Array index corresponds to level (index 0 = level 1, index 1 = level 2, etc.)
   * Value of 0 or undefined means no prestige requirement for that level
   * Example: [0, 0, 0, 1000, 0, 0, 5000, 0, 10000, 0] means:
   *   - Level 4 requires 1,000 prestige
   *   - Level 7 requires 5,000 prestige
   *   - Level 9 requires 10,000 prestige
   */
  prestigeRequirements?: number[];
}

export const FACILITY_TYPES: FacilityConfig[] = [
  {
    type: 'repair_bay',
    name: 'Repair Bay',
    description: 'Reduces repair costs for damaged robots (scales with number of robots)',
    maxLevel: 10,
    costs: [100000, 200000, 300000, 400000, 500000, 600000, 750000, 1000000, 1250000, 1500000],
    benefits: [
      'Repair cost discount',
      'Repair cost discount',
      'Repair cost discount',
      'Repair cost discount',
      'Repair cost discount',
      'Repair cost discount',
      'Repair cost discount',
      'Repair cost discount',
      'Repair cost discount',
      'Repair cost discount (maximum 90%)',
    ],
    implemented: true,
    prestigeRequirements: [0, 0, 0, 1000, 0, 0, 5000, 0, 10000, 0], // L4: 1000, L7: 5000, L9: 10000
  },
  {
    type: 'training_facility',
    name: 'Training Facility',
    description: 'Reduces costs for upgrading robot attributes',
    maxLevel: 10,
    costs: [150000, 300000, 450000, 600000, 750000, 900000, 1100000, 1400000, 1750000, 2250000],
    benefits: [
      '5% discount on attribute upgrades',
      '10% discount on attribute upgrades',
      '15% discount on attribute upgrades',
      '20% discount on attribute upgrades',
      '25% discount on attribute upgrades',
      '30% discount on attribute upgrades',
      '35% discount on attribute upgrades',
      '40% discount on attribute upgrades',
      '45% discount on attribute upgrades',
      '50% discount on attribute upgrades, unlock special training programs',
    ],
    implemented: true,
    prestigeRequirements: [0, 0, 0, 1000, 0, 0, 5000, 0, 10000, 0], // L4: 1000, L7: 5000, L9: 10000
  },
  {
    type: 'weapons_workshop',
    name: 'Weapons Workshop',
    description: 'Reduces costs for purchasing weapons',
    maxLevel: 10,
    costs: [125000, 250000, 375000, 500000, 650000, 800000, 1000000, 1250000, 1500000, 2000000],
    benefits: [
      '5% discount on weapon purchases',
      '10% discount on weapon purchases',
      '15% discount on weapon purchases',
      '20% discount on weapon purchases',
      '25% discount on weapon purchases',
      '30% discount on weapon purchases',
      '35% discount on weapon purchases',
      '40% discount on weapon purchases',
      '45% discount on weapon purchases',
      '50% discount on weapon purchases',
    ],
    implemented: true,
    prestigeRequirements: [0, 0, 0, 1500, 0, 0, 5000, 0, 10000, 0], // L4: 1500, L7: 5000, L9: 10000
  },
  {
    type: 'research_lab',
    name: 'Research Lab',
    description: 'Unlock advanced analytics and loadout features',
    maxLevel: 10,
    costs: [200000, 400000, 600000, 800000, 1000000, 1250000, 1500000, 1750000, 2000000, 2500000],
    benefits: [
      'Unlock advanced battle analytics',
      'Unlock loadout presets (save 3 configurations per robot)',
      'Unlock AI behavior customization',
      'Unlock 5 loadout presets per robot',
      'Unlock battle simulation (test matchups without cost)',
      'Unlock advanced statistics dashboard',
      'Unlock predictive AI (opponent analysis)',
      'Unlock 8 loadout presets per robot',
      'Unlock experimental technology',
      'Unlock robot cloning',
    ],
    implemented: false,
    prestigeRequirements: [0, 0, 0, 2000, 0, 0, 7500, 0, 15000, 0], // L4: 2000, L7: 7500, L9: 15000
  },
  {
    type: 'medical_bay',
    name: 'Medical Bay',
    description: 'Reduces critical damage repair costs',
    maxLevel: 10,
    costs: [175000, 350000, 525000, 700000, 875000, 1050000, 1250000, 1500000, 1750000, 2250000],
    benefits: [
      '15% reduction on critical damage repair costs',
      '25% reduction on critical damage repair costs',
      '35% reduction on critical damage repair costs',
      '45% reduction on critical damage repair costs',
      '55% reduction on critical damage repair costs',
      '65% reduction on critical damage repair costs, faster recovery protocols',
      '75% reduction on critical damage repair costs',
      '85% reduction on critical damage repair costs',
      '95% reduction on critical damage repair costs, prevent permanent damage',
      'Eliminate critical damage penalties entirely',
    ],
    implemented: false,
    prestigeRequirements: [0, 0, 0, 2000, 0, 0, 7500, 0, 15000, 0], // L4: 2000, L7: 7500, L9: 15000
  },
  {
    type: 'roster_expansion',
    name: 'Roster Expansion',
    description: 'Increases the number of robots you can own',
    maxLevel: 9,
    costs: [150000, 300000, 450000, 600000, 750000, 900000, 1100000, 1300000, 1500000],
    benefits: [
      '2 robot slots',
      '3 robot slots',
      '4 robot slots',
      '5 robot slots',
      '6 robot slots',
      '7 robot slots',
      '8 robot slots',
      '9 robot slots',
      '10 robot slots (maximum)',
    ],
    implemented: true,
    prestigeRequirements: [0, 0, 0, 1000, 0, 0, 5000, 0, 10000], // L4: 1000, L7: 5000, L9: 10000
  },
  {
    type: 'storage_facility',
    name: 'Storage Facility',
    description: 'Increases weapon storage capacity',
    maxLevel: 10,
    costs: [75000, 150000, 225000, 300000, 375000, 450000, 550000, 650000, 750000, 1000000],
    benefits: [
      '10 weapons storage (5 base + 5 from facility)',
      '15 weapons storage (5 base + 10 from facility)',
      '20 weapons storage (5 base + 15 from facility)',
      '25 weapons storage (5 base + 20 from facility)',
      '30 weapons storage (5 base + 25 from facility)',
      '35 weapons storage (5 base + 30 from facility)',
      '40 weapons storage (5 base + 35 from facility)',
      '45 weapons storage (5 base + 40 from facility)',
      '50 weapons storage (5 base + 45 from facility)',
      '55 weapons storage (5 base + 50 from facility - maximum)',
    ],
    implemented: true,
    // No prestige requirements for Storage Facility
  },
  {
    type: 'coaching_staff',
    name: 'Coaching Staff',
    description: 'Hire coaches for stable-wide bonuses',
    maxLevel: 10,
    costs: [250000, 350000, 450000, 600000, 750000, 900000, 1100000, 1300000, 1500000, 1750000],
    benefits: [
      'Unlock Offensive Coach (+3% Combat Power for all robots)',
      'Unlock Defensive Coach (+3% Armor Plating for all robots)',
      'Unlock Tactical Coach (+5% Threat Analysis for all robots)',
      'Improve Offensive Coach (+5% Combat Power)',
      'Improve Defensive Coach (+5% Armor Plating)',
      'Improve Tactical Coach (+8% Threat Analysis)',
      'Unlock Team Coach (+5% team coordination bonuses for arena battles)',
      'Improve Offensive Coach (+7% Combat Power)',
      'Improve Defensive Coach (+7% Armor Plating)',
      'Master Coach (combine two coach bonuses at 75% effectiveness)',
    ],
    implemented: false,
    prestigeRequirements: [0, 0, 2000, 0, 0, 5000, 0, 0, 10000, 0], // L3: 2000, L6: 5000, L9: 10000
  },
  {
    type: 'booking_office',
    name: 'Booking Office',
    description: 'Access to tournaments and prestige events',
    maxLevel: 10,
    costs: [250000, 500000, 750000, 1000000, 1250000, 1500000, 1750000, 2000000, 2250000, 2500000],
    benefits: [
      'Unlock Silver league tournaments',
      'Unlock Gold league tournaments, custom paint jobs',
      'Unlock Platinum tournaments, exclusive weapon skins',
      'Unlock Diamond tournaments, legendary frame designs',
      'Enhanced tournament rewards (+10%)',
      'Enhanced tournament rewards (+20%)',
      'Access to Champion tournaments, hall of fame listing',
      'Enhanced tournament rewards (+30%)',
      'Enhanced tournament rewards (+40%)',
      'Access to World Championship, custom arena design',
    ],
    implemented: false,
    prestigeRequirements: [1000, 2500, 5000, 10000, 15000, 20000, 25000, 35000, 45000, 50000], // All levels have requirements
  },
  {
    type: 'combat_training_academy',
    name: 'Combat Training Academy',
    description: 'Increases Combat Systems attribute caps',
    maxLevel: 10,
    costs: [200000, 600000, 800000, 1000000, 1200000, 1400000, 1600000, 1800000, 2000000, 2500000],
    benefits: [
      'Combat Systems cap to level 15',
      'Combat Systems cap to level 20',
      'Combat Systems cap to level 25',
      'Combat Systems cap to level 30',
      'Combat Systems cap to level 35',
      'Combat Systems cap to level 40',
      'Combat Systems cap to level 42',
      'Combat Systems cap to level 45',
      'Combat Systems cap to level 48',
      'Combat Systems cap to level 50 (maximum)',
    ],
    implemented: true,
    prestigeRequirements: [0, 0, 2000, 0, 4000, 0, 7000, 0, 10000, 15000], // L3: 2000, L5: 4000, L7: 7000, L9: 10000, L10: 15000
  },
  {
    type: 'defense_training_academy',
    name: 'Defense Training Academy',
    description: 'Increases Defensive Systems attribute caps',
    maxLevel: 10,
    costs: [200000, 600000, 800000, 1000000, 1200000, 1400000, 1600000, 1800000, 2000000, 2500000],
    benefits: [
      'Defensive Systems cap to level 15',
      'Defensive Systems cap to level 20',
      'Defensive Systems cap to level 25',
      'Defensive Systems cap to level 30',
      'Defensive Systems cap to level 35',
      'Defensive Systems cap to level 40',
      'Defensive Systems cap to level 42',
      'Defensive Systems cap to level 45',
      'Defensive Systems cap to level 48',
      'Defensive Systems cap to level 50 (maximum)',
    ],
    implemented: true,
    prestigeRequirements: [0, 0, 2000, 0, 4000, 0, 7000, 0, 10000, 15000], // L3: 2000, L5: 4000, L7: 7000, L9: 10000, L10: 15000
  },
  {
    type: 'mobility_training_academy',
    name: 'Mobility Training Academy',
    description: 'Increases Chassis & Mobility attribute caps',
    maxLevel: 10,
    costs: [200000, 600000, 800000, 1000000, 1200000, 1400000, 1600000, 1800000, 2000000, 2500000],
    benefits: [
      'Chassis & Mobility cap to level 15',
      'Chassis & Mobility cap to level 20',
      'Chassis & Mobility cap to level 25',
      'Chassis & Mobility cap to level 30',
      'Chassis & Mobility cap to level 35',
      'Chassis & Mobility cap to level 40',
      'Chassis & Mobility cap to level 42',
      'Chassis & Mobility cap to level 45',
      'Chassis & Mobility cap to level 48',
      'Chassis & Mobility cap to level 50 (maximum)',
    ],
    implemented: true,
    prestigeRequirements: [0, 0, 2000, 0, 4000, 0, 7000, 0, 10000, 15000], // L3: 2000, L5: 4000, L7: 7000, L9: 10000, L10: 15000
  },
  {
    type: 'ai_training_academy',
    name: 'AI Training Academy',
    description: 'Increases AI Processing + Team Coordination attribute caps',
    maxLevel: 10,
    costs: [250000, 750000, 1000000, 1250000, 1500000, 1750000, 2000000, 2250000, 2500000, 3000000],
    benefits: [
      'AI & Team cap to level 15',
      'AI & Team cap to level 20',
      'AI & Team cap to level 25',
      'AI & Team cap to level 30',
      'AI & Team cap to level 35',
      'AI & Team cap to level 40',
      'AI & Team cap to level 42',
      'AI & Team cap to level 45',
      'AI & Team cap to level 48',
      'AI & Team cap to level 50 (maximum)',
    ],
    implemented: true,
    prestigeRequirements: [0, 0, 2000, 0, 4000, 0, 7000, 0, 10000, 15000], // L3: 2000, L5: 4000, L7: 7000, L9: 10000, L10: 15000
  },
  {
    type: 'merchandising_hub',
    name: 'Merchandising Hub',
    description: 'Unlocks merchandising revenue from your stable\'s brand. Scales with prestige. Note: Streaming revenue is awarded per battle via Streaming Studio.',
    maxLevel: 10,
    costs: [150000, 300000, 450000, 600000, 750000, 900000, 1050000, 1200000, 1350000, 1500000],
    benefits: [
      'Unlock Merchandising (₡5,000/day base, scales with prestige)',
      'Improve Merchandising (₡10,000/day base)',
      'Improve Merchandising (₡15,000/day base)',
      'Improve Merchandising (₡20,000/day base)',
      'Improve Merchandising (₡25,000/day base)',
      'Improve Merchandising (₡30,000/day base)',
      'Improve Merchandising (₡35,000/day base)',
      'Improve Merchandising (₡40,000/day base)',
      'Improve Merchandising (₡45,000/day base)',
      'Master Merchandising (₡50,000/day base)',
    ],
    implemented: true,
    prestigeRequirements: [0, 0, 0, 3000, 0, 0, 7500, 0, 15000, 0], // L4: 3000, L7: 7500, L9: 15000
  },
  {
    type: 'streaming_studio',
    name: 'Streaming Studio',
    description: 'Dramatically increases streaming revenue earned per battle. Rewards active multi-robot play.',
    maxLevel: 10,
    costs: [100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000],
    benefits: [
      'Double streaming revenue per battle (2× multiplier, ₡100/day operating cost)',
      'Triple streaming revenue per battle (3× multiplier, ₡200/day operating cost)',
      'Quadruple streaming revenue per battle (4× multiplier, ₡300/day operating cost)',
      '5× streaming revenue per battle (₡400/day operating cost)',
      '6× streaming revenue per battle (₡500/day operating cost)',
      '7× streaming revenue per battle (₡600/day operating cost)',
      '8× streaming revenue per battle (₡700/day operating cost)',
      '9× streaming revenue per battle (₡800/day operating cost)',
      '10× streaming revenue per battle (₡900/day operating cost)',
      '11× streaming revenue per battle - maximum multiplier (₡1,000/day operating cost)',
    ],
    implemented: true,
    prestigeRequirements: [0, 0, 0, 1000, 2500, 5000, 10000, 15000, 25000, 50000], // L4: 1000, L5: 2500, L6: 5000, L7: 10000, L8: 15000, L9: 25000, L10: 50000
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

// Helper function to get roster limit based on Roster Expansion level
export function getRosterLimit(rosterExpansionLevel: number): number {
  // Level 0 = 1 slot, Level 1 = 2 slots, etc.
  return rosterExpansionLevel + 1;
}
