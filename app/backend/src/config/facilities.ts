// Facility configuration - all 14 facilities
export interface FacilityConfig {
  type: string;
  name: string;
  description: string;
  maxLevel: number;
  costs: number[]; // Cost for each level (index 0 = level 1, etc.)
  benefits: string[]; // Benefit description for each level
  implemented: boolean; // Whether backend logic is implemented
  /**
   * Prestige requirements for each level (unified across all facilities).
   * Array index corresponds to level (index 0 = level 1, index 1 = level 2, etc.)
   * Value of 0 means no prestige requirement for that level.
   *
   * Universal curve: L1-L3: free, L4: 1000, L5: 3000, L6: 5000,
   * L7: 10000, L8: 15000, L9: 25000, L10: 50000
   */
  prestigeRequirements?: number[];
  /**
   * @deprecated No longer used. All facilities use raw prestige gates.
   * Kept temporarily for migration safety — will be removed in a future cleanup.
   */
  prestigeGateIsPerSlot?: boolean;
}

/**
 * Universal prestige gate curve applied to all facilities (10 levels).
 * L1–L3: free, then progressively gated.
 * Exported so the dashboard can compute "next unlock" without loading facility configs.
 */
export const PRESTIGE_GATES_10: number[] = [0, 0, 0, 1000, 3000, 5000, 10000, 15000, 25000, 50000];

export const FACILITY_TYPES: FacilityConfig[] = [
  {
    type: 'repair_bay',
    name: 'Repair Bay',
    description: 'Reduces repair costs for damaged robots by 6% per level (60% at Level 10).',
    maxLevel: 10,
    costs: [50000, 100000, 150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000],
    benefits: [
      '6% repair cost discount',
      '12% repair cost discount',
      '18% repair cost discount',
      '24% repair cost discount',
      '30% repair cost discount',
      '36% repair cost discount',
      '42% repair cost discount',
      '48% repair cost discount',
      '54% repair cost discount',
      '60% repair cost discount (maximum)',
    ],
    implemented: true,
    prestigeRequirements: PRESTIGE_GATES_10,
  },
  {
    type: 'training_facility',
    name: 'Training Facility',
    // Spec #46 R11 / Season 2 #526: the discount rate per level is
    // `0.75 × (10 − robot slots)` percent (7.5% − 0.75% per slot), so a
    // concentrated stable gets far more out of the facility than a wide one. The
    // benefit strings below quote the best case (Roster_Capacity 1); the actual
    // figure is shown live on the Facilities page against the player's own roster.
    description: 'Reduces costs for upgrading robot attributes. Each level gives 7.5% off minus 0.75% per robot slot, so a smaller roster earns a bigger discount (max 67.5%)',
    maxLevel: 10,
    costs: [150000, 300000, 450000, 600000, 750000, 900000, 1050000, 1200000, 1350000, 1500000],
    benefits: [
      'Up to 6.75% off attribute upgrades — 6.75% per level with 1 robot, less as your roster grows (₡250/day operating cost)',
      'Up to 13.5% off attribute upgrades with 1 robot (₡500/day operating cost)',
      'Up to 20.25% off attribute upgrades with 1 robot (₡750/day operating cost)',
      'Up to 27% off attribute upgrades with 1 robot (₡1,000/day operating cost)',
      'Up to 33.75% off attribute upgrades with 1 robot (₡1,250/day operating cost)',
      'Up to 40.5% off attribute upgrades with 1 robot (₡1,500/day operating cost)',
      'Up to 47.25% off attribute upgrades with 1 robot (₡1,750/day operating cost)',
      'Up to 54% off attribute upgrades with 1 robot (₡2,000/day operating cost)',
      'Up to 60.75% off attribute upgrades with 1 robot (₡2,250/day operating cost)',
      'Up to 67.5% off attribute upgrades with 1 robot — the maximum (₡2,500/day operating cost)',
    ],
    implemented: true,
    // L4: 1000, L7: 5000, L9: 10000. L10 is ungated — it was previously unreachable
    // as a max level and no new gate is introduced here.
    prestigeRequirements: PRESTIGE_GATES_10,
  },
  {
    type: 'weapons_workshop',
    name: 'Weapons Workshop',
    description: 'Reduces weapon purchase costs and enables weapon resale, both scaling per level',
    maxLevel: 10,
    costs: [75000, 150000, 225000, 300000, 375000, 450000, 525000, 600000, 675000, 750000],
    benefits: [
      '5% discount on weapon purchases · 10% resale rate when selling',
      '10% discount on weapon purchases · 20% resale rate when selling',
      '15% discount on weapon purchases · 30% resale rate when selling',
      '20% discount on weapon purchases · 40% resale rate when selling',
      '25% discount on weapon purchases · 50% resale rate when selling',
      '30% discount on weapon purchases · 60% resale rate when selling',
      '35% discount on weapon purchases · 70% resale rate when selling',
      '40% discount on weapon purchases · 80% resale rate when selling',
      '45% discount on weapon purchases · 90% resale rate when selling',
      '50% discount on weapon purchases · 100% resale rate (full credit recovery)',
    ],
    implemented: true,
    prestigeRequirements: PRESTIGE_GATES_10, // L4: 1000, L5: 3000, L6: 5000, L7: 10000, L8: 15000, L9: 25000, L10: 50000
  },
  {
    // Season 2: takes over the refinement tier gates from the Weapons Workshop
    // (REQUIRED_REFINEMENT_LAB_LEVELS in app/shared/utils/weaponRefinement.ts).
    type: 'refinement_lab',
    name: 'Refinement Lab',
    description: 'Unlocks weapon refinement tiers (Hone, Augment, Sharpen, Forge)',
    maxLevel: 10,
    costs: [75000, 150000, 225000, 300000, 375000, 450000, 525000, 600000, 675000, 750000],
    benefits: [
      'Unlocks Hone · next: Augment at L3',
      'Hone available · next: Augment at L3',
      'Unlocks Augment · Hone and Augment available · next: Sharpen at L5',
      'Hone and Augment available · next: Sharpen at L5',
      'Unlocks Sharpen · Hone, Augment and Sharpen available · next: Forge at L8',
      'Hone, Augment and Sharpen available · next: Forge at L8',
      'Hone, Augment and Sharpen available · next: Forge at L8',
      'Unlocks Forge (all tiers available)',
      'All tiers available',
      'All tiers available (maximum)',
    ],
    implemented: true,
    prestigeRequirements: PRESTIGE_GATES_10,
  },

  {
    type: 'roster_expansion',
    name: 'Roster Expansion',
    description: 'Increases the number of robots you can own',
    maxLevel: 10,
    costs: [150000, 300000, 450000, 600000, 750000, 900000, 1100000, 1300000, 1500000, 1800000],
    benefits: [
      '2 robot slots',
      '3 robot slots',
      '4 robot slots',
      '5 robot slots',
      '6 robot slots',
      '7 robot slots',
      '8 robot slots',
      '9 robot slots',
      '10 robot slots',
      '11 robot slots (maximum)',
    ],
    implemented: true,
    prestigeRequirements: PRESTIGE_GATES_10,
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
    prestigeRequirements: PRESTIGE_GATES_10,
  },

  {
    type: 'booking_office',
    name: 'Booking Office',
    description: 'Event Subscription System — each level grants +1 concurrent event subscription per robot (3 base + level). Controls which battle events each robot participates in.',
    maxLevel: 10,
    costs: [75000, 150000, 225000, 300000, 375000, 450000, 525000, 600000, 675000, 750000],
    benefits: [
      '4 event subscriptions per robot',
      '5 event subscriptions per robot',
      '6 event subscriptions per robot',
      '7 event subscriptions per robot',
      '8 event subscriptions per robot',
      '9 event subscriptions per robot',
      '10 event subscriptions per robot',
      '11 event subscriptions per robot',
      '12 event subscriptions per robot',
      '13 event subscriptions per robot (maximum)',
    ],
    implemented: true,
    prestigeRequirements: PRESTIGE_GATES_10,
  },
  {
    type: 'combat_training_academy',
    name: 'Combat Training Academy',
    description: 'Increases Combat Systems attribute caps',
    maxLevel: 10,
    costs: [100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000],
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
    prestigeRequirements: PRESTIGE_GATES_10,
  },
  {
    type: 'defense_training_academy',
    name: 'Defense Training Academy',
    description: 'Increases Defensive Systems attribute caps',
    maxLevel: 10,
    costs: [100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000],
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
    prestigeRequirements: PRESTIGE_GATES_10,
  },
  {
    type: 'mobility_training_academy',
    name: 'Mobility Training Academy',
    description: 'Increases Chassis & Mobility attribute caps',
    maxLevel: 10,
    costs: [100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000],
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
    prestigeRequirements: PRESTIGE_GATES_10,
  },
  {
    type: 'ai_training_academy',
    name: 'AI Training Academy',
    description: 'Increases AI Processing + Team Coordination attribute caps',
    maxLevel: 10,
    costs: [100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000],
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
    prestigeRequirements: PRESTIGE_GATES_10,
  },
  {
    type: 'merchandising_hub',
    name: 'Merchandising Hub',
    description: 'Unlocks merchandising revenue from your stable\'s brand. Income scales with prestige per robot slot, so a larger roster divides the same prestige across more slots. Note: Streaming revenue is awarded per battle via Streaming Studio.',
    maxLevel: 10,
    costs: [150000, 300000, 450000, 600000, 750000, 900000, 1050000, 1200000, 1350000, 1500000],
    benefits: [
      'Unlock Merchandising (₡25,000/day base, ×prestige per robot slot)',
      'Improve Merchandising (₡50,000/day base, ×prestige per robot slot)',
      'Improve Merchandising (₡75,000/day base, ×prestige per robot slot)',
      'Improve Merchandising (₡100,000/day base, ×prestige per robot slot)',
      'Improve Merchandising (₡125,000/day base, ×prestige per robot slot)',
      'Improve Merchandising (₡150,000/day base, ×prestige per robot slot)',
      'Improve Merchandising (₡175,000/day base, ×prestige per robot slot)',
      'Improve Merchandising (₡200,000/day base, ×prestige per robot slot)',
      'Improve Merchandising (₡225,000/day base, ×prestige per robot slot)',
      'Master Merchandising (₡250,000/day base, ×prestige per robot slot)',
    ],
    implemented: true,
    prestigeRequirements: PRESTIGE_GATES_10,
  },
  {
    type: 'streaming_studio',
    name: 'Streaming Studio',
    description: 'Increases streaming revenue earned per battle by 50% per level (6× at Level 10).',
    maxLevel: 10,
    costs: [100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000],
    benefits: [
      '+50% streaming revenue per battle (1.5× multiplier, ₡100/day operating cost)',
      '2× streaming revenue per battle (₡200/day operating cost)',
      '2.5× streaming revenue per battle (₡300/day operating cost)',
      '3× streaming revenue per battle (₡400/day operating cost)',
      '3.5× streaming revenue per battle (₡500/day operating cost)',
      '4× streaming revenue per battle (₡600/day operating cost)',
      '4.5× streaming revenue per battle (₡700/day operating cost)',
      '5× streaming revenue per battle (₡800/day operating cost)',
      '5.5× streaming revenue per battle (₡900/day operating cost)',
      '6× streaming revenue per battle - maximum multiplier (₡1,000/day operating cost)',
    ],
    implemented: true,
    prestigeRequirements: PRESTIGE_GATES_10,
  },
  {
    type: 'tuning_bay',
    name: 'Tuning Bay',
    description: 'Fine-tune your robots for specific matchups with bonus attribute points. Higher levels grant a larger tuning pool.',
    maxLevel: 10,
    costs: [200000, 400000, 600000, 800000, 1000000, 1200000, 1400000, 1600000, 1800000, 2000000],
    benefits: [
      'Tuning pool: 20 bonus points per robot (₡300/day operating cost)',
      'Tuning pool: 30 bonus points per robot (₡600/day operating cost)',
      'Tuning pool: 40 bonus points per robot (₡900/day operating cost)',
      'Tuning pool: 50 bonus points per robot (₡1,200/day operating cost)',
      'Tuning pool: 60 bonus points per robot (₡1,500/day operating cost)',
      'Tuning pool: 70 bonus points per robot (₡1,800/day operating cost)',
      'Tuning pool: 80 bonus points per robot (₡2,100/day operating cost)',
      'Tuning pool: 90 bonus points per robot (₡2,400/day operating cost)',
      'Tuning pool: 100 bonus points per robot (₡2,700/day operating cost)',
      'Tuning pool: 110 bonus points per robot — maximum (₡3,000/day operating cost)',
    ],
    implemented: true,
    prestigeRequirements: PRESTIGE_GATES_10,
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
