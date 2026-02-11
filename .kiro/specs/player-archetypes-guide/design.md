# Design Document: Player Archetypes and Starting Strategies Guide

## Overview

This design document specifies the structure, content, and analysis framework for the "Player Archetypes and Starting Strategies Guide" for Armoured Souls. The guide will be a comprehensive markdown document that helps players understand different playstyles and make informed decisions about their ₡3,000,000 starting budget.

The guide addresses a critical player need: **decision paralysis at game start**. With 23 attributes, 23 weapons, 14 facilities, and complex economic systems, new players face overwhelming choices. This guide reduces cognitive load by organizing strategies into 6 distinct archetypes, each with clear spending plans and progression roadmaps.

## Architecture

### Document Structure

The guide will be organized as a single markdown document with the following major sections:

1. **Introduction** - Overview of the guide's purpose and how to use it
2. **Understanding the Economy** - Quick primer on game systems (robots, facilities, income, costs)
3. **Player Archetypes** - Detailed description of 10 playstyles
4. **Archetype Comparison Table** - Side-by-side comparison of all archetypes
5. **Starting Budget Allocations** - Detailed spending breakdowns for each archetype
6. **Early Game Strategy (Days 1-30)** - First month guidance per archetype
7. **Mid Game Transition (Days 30-120)** - Expansion and scaling strategies
8. **Build Synergies** - How archetypes align with robot builds and combat systems
9. **Economic Analysis** - ROI calculations, profitability, and risk assessment
10. **Hybrid Strategies** - Combining and transitioning between archetypes
11. **Quick Reference** - Summary tables and cheat sheets
12. **Appendices** - Detailed calculations, formulas, and advanced topics

### Content Organization Principles

- **Archetype-First**: Organize by playstyle, not by game system
- **Progressive Disclosure**: Start with high-level concepts, drill down to details
- **Practical Examples**: Every strategy includes concrete numbers and calculations
- **Visual Hierarchy**: Use tables, lists, and formatting to improve scannability
- **Cross-References**: Link related sections for deeper exploration

## Components and Interfaces

### Component 1: Player Archetypes

Ten distinct archetypes based on strategic focus, robot build style, and resource allocation:

#### 1. Tank Fortress (Weapon+Shield Build)
- **Philosophy**: Outlast opponents through superior defense and counter-attacks
- **Robot Build**: High Hull Integrity, Armor Plating, Shield Capacity, Counter Protocols
- **Loadout**: Weapon+Shield (Combat Shield + Power Sword or Hammer)
- **Resource Allocation**: 45% robot (defensive attributes), 25% weapons (shield + weapon), 20% facilities (Repair Bay, Medical Bay), 10% buffer
- **Personality Fit**: Players who enjoy defensive play, attrition warfare, and survivability
- **Risk Level**: Low (high survivability, forgiving of mistakes)
- **League Scaling**: Benefits greatly from higher leagues - repair costs stay low while income scales

#### 2. Glass Cannon (Two-Handed Build)
- **Philosophy**: Eliminate opponents before they can respond with overwhelming damage
- **Robot Build**: High Combat Power, Critical Systems, Penetration, Weapon Control
- **Loadout**: Two-Handed (Plasma Cannon, Railgun, or Heavy Hammer)
- **Resource Allocation**: 50% robot (offensive attributes), 30% weapon (premium two-handed), 15% facilities (Training Facility), 5% buffer
- **Personality Fit**: Players who enjoy high-risk/high-reward, aggressive play, and quick battles
- **Risk Level**: High (low HP, expensive repairs when losing)
- **League Scaling**: High risk in Bronze (repair costs hurt), high reward in Gold+ (income covers risks)

#### 3. Speed Demon (Dual-Wield Build)
- **Philosophy**: Overwhelm with rapid attacks and superior positioning
- **Robot Build**: High Attack Speed, Servo Motors, Gyro Stabilizers, Weapon Control
- **Loadout**: Dual-Wield (2× Machine Guns, 2× Plasma Blades, or mixed)
- **Resource Allocation**: 40% robot (speed/mobility attributes), 30% weapons (two one-handed), 20% facilities (Training Facility, Weapons Workshop), 10% buffer
- **Personality Fit**: Players who enjoy fast-paced combat, DPS optimization, and mobility
- **Risk Level**: Medium (moderate survivability, requires good positioning)
- **League Scaling**: Consistent across leagues - steady income and repair costs

#### 4. Balanced Brawler (Single Weapon Build)
- **Philosophy**: Flexible all-rounder that adapts to any situation
- **Robot Build**: Balanced attributes across combat, defense, and mobility
- **Loadout**: Single (Power Sword, Plasma Rifle, or versatile weapon)
- **Resource Allocation**: 40% robot (balanced attributes), 20% weapon (mid-tier), 25% facilities (Training Facility, Repair Bay), 15% buffer
- **Personality Fit**: Players who prefer flexibility, safety, and gradual learning
- **Risk Level**: Low (most forgiving, no major weaknesses)
- **League Scaling**: Steady progression - no dramatic swings in risk/reward

#### 5. Facility Investor (Economic Focus)
- **Philosophy**: Invest heavily in infrastructure for long-term passive income and cost reduction
- **Robot Build**: Moderate balanced build (sufficient for Bronze/Silver)
- **Loadout**: Budget weapons (Practice Sword, Machine Gun)
- **Resource Allocation**: 50% facilities (Income Generator, Repair Bay, Training Facility), 30% robot, 15% weapons, 5% buffer
- **Personality Fit**: Players who enjoy economic simulation, long-term planning, and passive growth
- **Risk Level**: Low (sustainable economics, slow but steady)
- **League Scaling**: Excellent - facility benefits compound over time, passive income grows with prestige

#### 6. Two-Robot Specialist (Roster Expansion)
- **Philosophy**: Two specialized robots for different matchups and redundancy
- **Robot Build**: Robot 1 (Tank), Robot 2 (Glass Cannon) - complementary builds
- **Loadout**: Varied - one defensive, one offensive
- **Resource Allocation**: 55% robots (2× ₡500K + moderate upgrades), 25% weapons (one per robot), 15% facilities (Roster Expansion required), 5% buffer
- **Personality Fit**: Players who enjoy variety, strategic matchup selection, and portfolio management
- **Risk Level**: Medium (requires Roster Expansion facility, spread resources)
- **League Scaling**: Strong in higher leagues - can select optimal robot per opponent

#### 7. Melee Specialist (Hydraulic Systems Focus)
- **Philosophy**: Dominate close combat with devastating melee strikes
- **Robot Build**: High Hydraulic Systems, Combat Power, Servo Motors, Hull Integrity
- **Loadout**: Two-Handed melee (Heavy Hammer, Battle Axe) or Weapon+Shield (Power Sword + shield)
- **Resource Allocation**: 45% robot (melee-focused attributes), 30% weapon (premium melee), 20% facilities (Training Facility), 5% buffer
- **Personality Fit**: Players who enjoy melee combat, positioning gameplay, and high-impact strikes
- **Risk Level**: Medium-High (requires closing distance, vulnerable to ranged)
- **League Scaling**: Improves in higher leagues - better opponents mean more tactical positioning opportunities

#### 8. Ranged Sniper (Targeting Systems Focus)
- **Philosophy**: Win through superior accuracy and armor penetration from range
- **Robot Build**: High Targeting Systems, Penetration, Critical Systems, Weapon Control
- **Loadout**: Two-Handed ranged (Railgun, Sniper Rifle, Plasma Cannon)
- **Resource Allocation**: 45% robot (accuracy/penetration attributes), 30% weapon (premium ranged), 20% facilities (Training Facility), 5% buffer
- **Personality Fit**: Players who enjoy precision gameplay, calculated strikes, and ranged combat
- **Risk Level**: Medium (relies on accuracy, vulnerable if opponent closes distance)
- **League Scaling**: Excellent in higher leagues - precision matters more against skilled opponents

#### 9. AI Tactician (Combat Algorithms Focus)
- **Philosophy**: Win through superior decision-making and adaptive AI
- **Robot Build**: High Combat Algorithms, Threat Analysis, Adaptive AI, Logic Cores
- **Loadout**: Balanced (any loadout works - AI optimizes usage)
- **Resource Allocation**: 45% robot (AI attributes), 25% weapon (mid-tier), 25% facilities (AI Training Academy), 5% buffer
- **Personality Fit**: Players who enjoy strategic depth, AI optimization, and tactical gameplay
- **Risk Level**: Medium (requires understanding AI mechanics, less intuitive)
- **League Scaling**: Scales excellently - AI attributes become more valuable against better opponents

#### 10. Prestige Rusher (Fast Progression Focus)
- **Philosophy**: Optimize for rapid prestige accumulation to unlock high-tier content
- **Robot Build**: Optimized for win rate - balanced offensive/defensive
- **Loadout**: Cost-effective weapons that maximize win probability
- **Resource Allocation**: 50% robot (win-optimized attributes), 25% weapons (efficient choices), 20% facilities (Booking Office for tournaments), 5% buffer
- **Personality Fit**: Competitive players who enjoy progression systems, unlocks, and long-term goals
- **Risk Level**: Medium-High (requires consistent wins to justify strategy)
- **League Scaling**: Critical - must advance leagues quickly to maximize prestige gains

### Component 2: Budget Allocation Framework

Each archetype will have a detailed spending breakdown following this template:

```markdown
### [Archetype Name] - Starting Budget Allocation

**Total Budget**: ₡3,000,000

#### Robot Purchases
- [Number] robots @ ₡500,000 each = ₡[total]
- Rationale: [why this number of robots]

#### Attribute Upgrades
- Focus attributes: [list 5-7 key attributes]
- Estimated levels: [target levels for each]
- Total cost: ₡[amount]
- Calculation: [show formula]

#### Weapon Purchases
- Main weapon: [weapon name] (₡[cost])
- Offhand/Secondary: [weapon name] (₡[cost])
- Total: ₡[amount]
- Rationale: [why these weapons]

#### Facility Investments
- [Facility 1]: Level [X] (₡[cost])
- [Facility 2]: Level [X] (₡[cost])
- Total: ₡[amount]
- Priority order: [explain sequence]

#### Reserve Buffer
- Amount: ₡[amount] (typically ₡5,000-₡15,000)
- Purpose: [1-2 emergency repairs only]
- Note: Players typically spend 99%+ of starting budget

#### Facility Investment Rationale
- [Explain why facilities are purchased FIRST if applicable]
- [Show cost savings: e.g., Training Facility Level 1 saves 5% on all attribute upgrades]
- [Calculate break-even: if spending ₡500K on attributes, Training Facility saves ₡25K, pays for itself after ₡6M in upgrades]
- [Roster Expansion: REQUIRED to own more than 1 robot - must purchase before second robot]

#### Total Spent: ₡[amount] / ₡3,000,000
#### Remaining: ₡[amount] (emergency repairs only)
```

### Component 3: Economic Analysis Framework

Each archetype will include economic projections:

```markdown
### [Archetype Name] - Economic Analysis

#### Income Projections (50% Win Rate)
- Weekly battles: [number]
- League: [Bronze/Silver/Gold] (affects income dramatically)
- Battle winnings (Bronze): ₡[amount]/week (₡5-10K per win + ₡1.5K participation per battle)
- Battle winnings (Silver): ₡[amount]/week (₡10-20K per win + ₡3K participation per battle)
- Battle winnings (Gold): ₡[amount]/week (₡20-40K per win + ₡6K participation per battle)
- Passive income: ₡[amount]/week (if Income Generator purchased)
- Total weekly income: ₡[amount] (league-dependent)

#### League Progression Impact
- Bronze (Weeks 1-4): [income range]
- Silver (Weeks 5-12): [income range] - 2× Bronze income
- Gold (Weeks 13+): [income range] - 4× Bronze income
- Risk assessment changes: [how risk level changes with league advancement]

#### Operating Costs
- Daily facility costs: ₡[amount]/day
- Weekly facility costs: ₡[amount]/week
- Average repair costs: ₡[amount]/week
- Total weekly costs: ₡[amount]

#### Net Income
- Weekly net: ₡[income - costs]
- Monthly net: ₡[weekly × 4]
- Break-even win rate: [percentage]

#### ROI Analysis
- [Major Investment 1]: Payback in [X] weeks
- [Major Investment 2]: Payback in [X] weeks
- Overall profitability: [assessment]

#### Risk Assessment
- Bankruptcy risk (Bronze): [Low/Medium/High]
- Bankruptcy risk (Silver): [Low/Medium/High] (typically lower due to higher income)
- Bankruptcy risk (Gold+): [Low/Medium/High] (typically much lower)
- Sensitivity to losses: [description - how badly does losing streak hurt]
- Recovery difficulty: [description - how hard to recover from bankruptcy]
- League advancement dependency: [how critical is advancing leagues for this archetype]
```

### Component 4: Progression Roadmap

Each archetype will have a timeline:

```markdown
### [Archetype Name] - Progression Roadmap

#### Days 1-7 (Week 1)
- Goal: [primary objective]
- Battles: [number] per week
- Expected league: Bronze
- Key actions: [list 3-5 actions]
- Avoid: [common mistakes]

#### Days 8-30 (Weeks 2-4)
- Goal: [primary objective]
- Expected league: Bronze → Silver
- Income milestone: ₡[amount] total earned
- First major purchase: [what and when]
- Expansion trigger: [condition to expand]

#### Days 31-60 (Months 2)
- Goal: [primary objective]
- Expected league: Silver → Gold
- Facility upgrades: [which facilities]
- Robot expansion: [if applicable]
- Income diversification: [passive income setup]

#### Days 61-120 (Months 3-4)
- Goal: [primary objective]
- Expected league: Gold → Platinum
- Advanced investments: [what to buy]
- Prestige target: [amount]
- Transition considerations: [next phase]
```

## Data Models

### Archetype Data Structure

```typescript
interface PlayerArchetype {
  name: string;
  philosophy: string;
  robotBuildStyle: string; // Tank, Glass Cannon, Speed Demon, Balanced, etc.
  loadoutType: 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
  attributeFocus: string[]; // Top 5-7 attributes to prioritize
  personalityFit: string;
  riskLevel: 'Low' | 'Medium' | 'Medium-High' | 'High';
  leagueScaling: {
    bronze: string; // Risk assessment in Bronze
    silver: string; // Risk assessment in Silver
    gold: string; // Risk assessment in Gold+
  };
  
  budgetAllocation: {
    robots: {
      count: number;
      cost: number;
      attributeUpgrades: {
        focusAttributes: string[];
        estimatedLevels: Record<string, number>;
        totalCost: number;
        calculationNotes: string; // Show formula
      };
    };
    weapons: {
      mainWeapon: { name: string; cost: number };
      offhandWeapon?: { name: string; cost: number };
      totalCost: number;
      rationale: string; // Why these specific weapons
    };
    facilities: {
      purchases: Array<{ 
        name: string; 
        level: number; 
        cost: number;
        purchaseOrder: number; // 1 = buy first, 2 = buy second, etc.
        roiAnalysis: string; // Why this facility, when it pays for itself
      }>;
      totalCost: number;
      priorityOrder: string[];
    };
    reserveBuffer: number; // Typically ₡5K-₡15K
    totalSpent: number;
    remaining: number;
  };
  
  economicProjections: {
    weeklyBattles: number;
    leagueIncome: {
      bronze: { winnings: number; participation: number; total: number };
      silver: { winnings: number; participation: number; total: number };
      gold: { winnings: number; participation: number; total: number };
    };
    passiveIncome: number; // If Income Generator purchased
    dailyFacilityCosts: number;
    weeklyFacilityCosts: number;
    averageRepairCosts: {
      bronze: number;
      silver: number;
      gold: number;
    };
    weeklyNet: {
      bronze: number;
      silver: number;
      gold: number;
    };
    breakEvenWinRate: {
      bronze: number;
      silver: number;
      gold: number;
    };
  };
  
  riskAssessment: {
    bankruptcyRisk: {
      bronze: 'Low' | 'Medium' | 'High';
      silver: 'Low' | 'Medium' | 'High';
      gold: 'Low' | 'Medium' | 'High';
    };
    sensitivityToLosses: string;
    recoveryDifficulty: string;
    leagueAdvancementDependency: string; // How critical is advancing leagues
  };
  
  buildSynergies: {
    robotBuildType: string; // Tank, Glass Cannon, Speed Demon, etc.
    loadoutType: string;
    battleStance: string; // Offensive, Defensive, Balanced
    yieldThreshold: number; // Recommended %
    attributePriorities: Array<{
      attribute: string;
      targetLevel: number;
      priority: number; // 1 = highest
      rationale: string;
    }>;
    weaponSynergies: string; // How weapons complement the build
  };
  
  progressionRoadmap: {
    week1: RoadmapPhase;
    weeks2to4: RoadmapPhase;
    month2: RoadmapPhase;
    months3to4: RoadmapPhase;
  };
  
  weaponStrategy: {
    initialPurchases: number; // How many weapons to buy at start
    expansionTiming: string; // When to buy more weapons
    experimentationAdvice: string; // When weapon variety makes sense
    storageRequirements: string; // Whether Storage Facility needed
  };
}

interface RoadmapPhase {
  goal: string;
  battles: number;
  expectedLeague: string;
  keyActions: string[];
  commonMistakes: string[];
  milestones?: string[];
  incomeExpectations: string; // League-specific income ranges
}
```

### Economic Constants

```typescript
const GAME_CONSTANTS = {
  startingBudget: 3_000_000,
  robotCost: 500_000,
  attributeUpgradeCost: (level: number) => (level + 1) * 1_500,
  
  leagueRewards: {
    bronze: { min: 5_000, max: 10_000, prestige: 5, participation: 1_500 },
    silver: { min: 10_000, max: 20_000, prestige: 10, participation: 3_000 },
    gold: { min: 20_000, max: 40_000, prestige: 20, participation: 6_000 },
    platinum: { min: 40_000, max: 80_000, prestige: 30, participation: 12_000 },
    diamond: { min: 80_000, max: 150_000, prestige: 50, participation: 24_000 },
    champion: { min: 150_000, max: 300_000, prestige: 75, participation: 45_000 },
  },
  
  participationReward: (leagueBase: number) => leagueBase * 0.3,
  
  repairCostFormula: (totalAttributes: number, damagePercent: number, multiplier: number) => {
    return totalAttributes * 100 * damagePercent * multiplier;
  },
  
  facilityOperatingCosts: {
    repairBay: (level: number) => 1_000 + (level * 500),
    trainingFacility: (level: number) => 1_500 + (level * 750),
    weaponsWorkshop: (level: number) => 1_000 + (level * 500),
    incomeGenerator: (level: number) => 1_000 + (level * 500),
    rosterExpansion: (robotCount: number) => (robotCount - 1) * 500, // First robot free
    storageFacility: (level: number) => 500 + (level * 250),
    // ... other facilities
  },
  
  facilityPurchaseCosts: {
    repairBay: { level1: 200_000 },
    trainingFacility: { level1: 300_000 },
    weaponsWorkshop: { level1: 250_000 },
    incomeGenerator: { level1: 800_000 },
    rosterExpansion: { level1: 300_000 }, // Required for 2nd robot
    storageFacility: { level1: 150_000 }, // Required for >5 weapons
    combatTrainingAcademy: { level1: 400_000 },
    defenseTrainingAcademy: { level1: 400_000 },
    mobilityTrainingAcademy: { level1: 400_000 },
    aiTrainingAcademy: { level1: 500_000 },
  },
  
  facilityBenefits: {
    repairBay: {
      level1: { discount: 0.05, description: '5% discount on all repairs' },
      level5: { discount: 0.25, description: '25% discount on all repairs' },
      level10: { discount: 0.50, description: '50% discount on all repairs' },
    },
    trainingFacility: {
      level1: { discount: 0.05, description: '5% discount on attribute upgrades' },
      level5: { discount: 0.25, description: '25% discount on attribute upgrades' },
      level10: { discount: 0.50, description: '50% discount on attribute upgrades' },
    },
    weaponsWorkshop: {
      level1: { discount: 0.05, description: '5% discount on weapon purchases' },
      level5: { discount: 0.25, description: '25% discount on weapon purchases' },
      level10: { discount: 0.50, description: '50% discount on weapon purchases' },
    },
    rosterExpansion: {
      level1: { slots: 2, description: 'Allows owning 2 robots' },
      level5: { slots: 6, description: 'Allows owning 6 robots' },
      level9: { slots: 10, description: 'Allows owning 10 robots' },
    },
    storageFacility: {
      level0: { capacity: 5, description: 'Default 5 weapon storage' },
      level1: { capacity: 10, description: '10 weapon storage' },
      level5: { capacity: 30, description: '30 weapon storage' },
      level10: { capacity: 55, description: '55 weapon storage' },
    },
  },
};
```

### Facility ROI Analysis Framework

```typescript
interface FacilityROI {
  facilityName: string;
  level: number;
  purchaseCost: number;
  operatingCostPerDay: number;
  operatingCostPerWeek: number;
  
  benefit: {
    type: 'discount' | 'capacity' | 'passive_income' | 'unlock';
    value: number | string;
    description: string;
  };
  
  roiCalculation: {
    assumedSpending: number; // How much player spends on affected category
    savingsPerWeek: number; // How much facility saves per week
    netSavingsPerWeek: number; // Savings minus operating cost
    paybackWeeks: number; // Weeks to break even
    paybackMonths: number; // Months to break even
    worthIt: boolean; // Is ROI reasonable?
    notes: string;
  };
}

// Example: Training Facility Level 1
const trainingFacilityROI: FacilityROI = {
  facilityName: 'Training Facility',
  level: 1,
  purchaseCost: 300_000,
  operatingCostPerDay: 1_500,
  operatingCostPerWeek: 10_500,
  
  benefit: {
    type: 'discount',
    value: 0.05,
    description: '5% discount on all attribute upgrades',
  },
  
  roiCalculation: {
    assumedSpending: 100_000, // ₡100K per week on upgrades (aggressive)
    savingsPerWeek: 5_000, // 5% of ₡100K
    netSavingsPerWeek: -5_500, // ₡5K savings - ₡10.5K operating cost = negative!
    paybackWeeks: Infinity, // Never pays for itself at this spending rate
    paybackMonths: Infinity,
    worthIt: false,
    notes: 'Only worth it if planning to spend ₡6M+ on upgrades (₡300K / 0.05 = ₡6M). Better to skip early game and buy later when upgrading to high levels.',
  },
};

// Example: Repair Bay Level 1
const repairBayROI: FacilityROI = {
  facilityName: 'Repair Bay',
  level: 1,
  purchaseCost: 200_000,
  operatingCostPerDay: 1_000,
  operatingCostPerWeek: 7_000,
  
  benefit: {
    type: 'discount',
    value: 0.05,
    description: '5% discount on all repairs',
  },
  
  roiCalculation: {
    assumedSpending: 20_000, // ₡20K per week on repairs (7 battles, 50% win rate)
    savingsPerWeek: 1_000, // 5% of ₡20K
    netSavingsPerWeek: -6_000, // ₡1K savings - ₡7K operating cost = negative!
    paybackWeeks: Infinity,
    paybackMonths: Infinity,
    worthIt: false,
    notes: 'Only worth it long-term (multi-robot stables with high repair costs). Early game: skip and invest in robot power instead.',
  },
};

// Example: Roster Expansion Level 1 (REQUIRED for 2nd robot)
const rosterExpansionROI: FacilityROI = {
  facilityName: 'Roster Expansion',
  level: 1,
  purchaseCost: 300_000,
  operatingCostPerDay: 500, // ₡500/day for 2nd robot slot
  operatingCostPerWeek: 3_500,
  
  benefit: {
    type: 'capacity',
    value: 2,
    description: 'Allows owning 2 robots (required for multi-robot strategies)',
  },
  
  roiCalculation: {
    assumedSpending: 0, // Not a discount, it's a capacity unlock
    savingsPerWeek: 0,
    netSavingsPerWeek: -3_500, // Pure cost
    paybackWeeks: Infinity,
    paybackMonths: Infinity,
    worthIt: true, // Despite no ROI, required for Two-Robot Specialist archetype
    notes: 'Not about ROI - it\'s a hard requirement to own more than 1 robot. Two-Robot Specialist MUST purchase this.',
  },
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Budget Constraint Compliance

*For any* archetype budget allocation, the total spent (robots + weapons + facilities + buffer) should equal or be less than ₡3,000,000.

**Validates: Requirements 2.4**

### Property 2: Economic Sustainability

*For any* archetype with 50% win rate, the weekly net income (battle winnings + passive income - operating costs - repair costs) should be non-negative after the first month.

**Validates: Requirements 6.3**

### Property 3: ROI Calculation Accuracy

*For any* facility investment, the calculated payback period (investment cost / weekly savings) should match the formula: `payback_weeks = facility_cost / (weekly_benefit - weekly_operating_cost)`.

**Validates: Requirements 6.1, 8.2**

### Property 4: Attribute Upgrade Cost Accuracy

*For any* attribute upgrade sequence, the total cost should equal the sum of individual upgrade costs using the formula: `Σ((level + 1) × 1,500)` for each level.

**Validates: Requirements 2.7, 8.1**

### Property 5: Repair Cost Calculation Accuracy

*For any* robot with given total attributes and damage percentage, the repair cost should equal: `(total_attributes × 100) × damage_percentage × condition_multiplier × (1 - repair_bay_discount)`.

**Validates: Requirements 8.5**

### Property 6: Income Projection Consistency

*For any* archetype, the weekly battle income at 50% win rate should equal: `(battles_per_week × 0.5 × average_win_reward) + (battles_per_week × participation_reward)`.

**Validates: Requirements 3.2, 8.4**

### Property 7: Archetype Differentiation

*For any* two distinct archetypes, at least one of the following should differ by more than 20%: robot count, weapon spending, facility spending, or attribute focus distribution.

**Validates: Requirements 1.4**

### Property 8: Risk Assessment Consistency

*For any* archetype with reserve buffer less than 2× average weekly costs, the bankruptcy risk should be classified as "Medium" or "High".

**Validates: Requirements 9.1, 9.2**

### Property 9: Progression Milestone Reachability

*For any* archetype progression roadmap, the income required to reach each milestone should be achievable with the projected win rate and battle frequency.

**Validates: Requirements 4.1, 4.4**

### Property 10: Facility Priority Ordering

*For any* archetype facility priority list, facilities with higher ROI (shorter payback period) should appear earlier in the priority order.

**Validates: Requirements 4.2**

## Error Handling

### Invalid Budget Allocations

**Error**: Total spending exceeds ₡3,000,000
- **Detection**: Sum validation during budget calculation
- **Handling**: Adjust reserve buffer or reduce optional purchases
- **User Guidance**: "This allocation exceeds starting budget. Consider reducing [lowest priority item]."

### Unsustainable Economics

**Error**: Archetype has negative weekly net income at 50% win rate
- **Detection**: Economic projection calculation
- **Handling**: Flag as high-risk, provide warnings
- **User Guidance**: "This strategy requires >50% win rate to remain profitable. Consider increasing passive income or reducing operating costs."

### Impossible Progression Goals

**Error**: Roadmap milestone requires more income than archetype can generate
- **Detection**: Compare milestone cost to projected income
- **Handling**: Adjust timeline or milestone
- **User Guidance**: "This milestone may take longer than estimated. Actual timeline depends on win rate."

### Missing Facility Prerequisites

**Error**: Archetype recommends facility level that requires prestige not yet earned
- **Detection**: Check prestige requirements against projected prestige accumulation
- **Handling**: Adjust facility level or add prestige farming phase
- **User Guidance**: "This facility level requires [X] prestige. You'll need approximately [Y] wins to unlock."

## Testing Strategy

### Unit Testing

The guide itself is a documentation artifact, but we can validate its correctness through:

1. **Budget Validation Tests**
   - Test each archetype's budget allocation sums to ≤ ₡3,000,000
   - Test that all costs use correct formulas from game documentation
   - Test that weapon costs match SEED_DATA_SPECIFICATION.md

2. **Economic Calculation Tests**
   - Test repair cost calculations against game formulas
   - Test income projections against league reward tables
   - Test ROI calculations for facility investments
   - Test break-even win rate calculations

3. **Formula Consistency Tests**
   - Test attribute upgrade costs match: `(level + 1) × 1,500`
   - Test facility operating costs match documented formulas
   - Test prestige accumulation rates match game mechanics

### Property-Based Testing

Since this is a documentation project, property-based testing will validate the mathematical correctness of calculations:

1. **Property Test: Budget Constraints**
   - Generate random budget allocations
   - Verify total never exceeds ₡3,000,000
   - Verify all individual costs are positive

2. **Property Test: Economic Sustainability**
   - Generate random archetype configurations
   - Calculate weekly net income at various win rates
   - Verify sustainability thresholds are accurate

3. **Property Test: ROI Calculations**
   - Generate random facility investments
   - Calculate payback periods
   - Verify formula consistency across all facilities

### Integration Testing

1. **Cross-Reference Validation**
   - Verify all weapon names/costs match SEED_DATA_SPECIFICATION.md
   - Verify all facility costs match STABLE_SYSTEM.md
   - Verify all formulas match PRD_ECONOMY_SYSTEM.md
   - Verify all attribute costs match PRD_ROBOT_ATTRIBUTES.md

2. **Archetype Completeness**
   - Verify each archetype has all required sections
   - Verify all archetypes have economic projections
   - Verify all archetypes have progression roadmaps
   - Verify all archetypes have risk assessments

3. **Example Validation**
   - Verify all numerical examples use correct formulas
   - Verify all step-by-step calculations are accurate
   - Verify all projections are realistic given game mechanics

### Manual Review Checklist

- [ ] All 6 archetypes are clearly differentiated
- [ ] All budget allocations sum correctly
- [ ] All economic projections use correct formulas
- [ ] All weapon costs match current game data
- [ ] All facility costs match current game data
- [ ] All attribute upgrade costs use correct formula
- [ ] All repair cost examples are accurate
- [ ] All ROI calculations are correct
- [ ] All risk assessments are justified
- [ ] All progression timelines are realistic
- [ ] All cross-references are valid
- [ ] All tables are properly formatted
- [ ] All terminology matches game documentation
- [ ] Guide is accessible to new players
- [ ] Guide provides value to experienced players

## Dependencies

### Game Documentation Dependencies

The guide depends on accurate information from:

1. **PRD_ECONOMY_SYSTEM.md** - Starting budget, costs, income formulas
2. **PRD_ROBOT_ATTRIBUTES.md** - Attribute upgrade costs, attribute list
3. **PRD_WEAPONS_LOADOUT.md** - Weapon costs, loadout bonuses
4. **SEED_DATA_SPECIFICATION.md** - Complete weapon catalog with exact prices
5. **STABLE_SYSTEM.md** - Facility costs, operating costs, benefits
6. **PRD_PRESTIGE_AND_FAME.md** - Prestige earning rates, benefits
7. **COMBAT_FORMULAS.md** - Damage calculations, repair cost formulas
8. **OPTION_C_IMPLEMENTATION.md** - Current economy balance (₡3M budget)

### Formula Dependencies

Key formulas that must remain accurate:

- Attribute upgrade cost: `(level + 1) × 1,500`
- Repair cost: `(total_attributes × 100) × damage_% × multiplier`
- League rewards: Bronze ₡5-10K, Silver ₡10-20K, etc.
- Participation reward: `league_base × 0.3`
- Facility operating costs: Varies by facility type
- Prestige multipliers: +5% to +20% based on thresholds

### Version Sensitivity

The guide is sensitive to:

- **Economy rebalancing** - Changes to starting budget, costs, or income
- **Weapon pricing** - Changes to weapon costs or catalog
- **Facility costs** - Changes to purchase or operating costs
- **Formula changes** - Changes to repair, upgrade, or income formulas

If any of these change, the guide must be updated to maintain accuracy.

## Implementation Notes

### Content Generation Approach

1. **Start with Economic Foundation**
   - Calculate baseline economics (income, costs, sustainability)
   - Establish break-even thresholds
   - Identify viable investment ranges

2. **Design Archetypes**
   - Identify distinct strategic focuses
   - Ensure differentiation (no overlap)
   - Map to player personality types

3. **Create Budget Allocations**
   - Start with archetype philosophy
   - Allocate budget according to strategic focus
   - Validate totals and sustainability

4. **Project Economics**
   - Calculate income at 50% win rate
   - Calculate operating costs
   - Assess profitability and risk

5. **Build Progression Roadmaps**
   - Define milestones for each phase
   - Sequence investments logically
   - Provide actionable guidance

6. **Add Synergies and Analysis**
   - Map to robot builds and combat systems
   - Calculate ROI for major investments
   - Identify hybrid strategies

### Writing Style Guidelines

- **Clarity over Cleverness**: Use simple, direct language
- **Numbers over Vagueness**: Always provide specific costs and projections
- **Examples over Abstractions**: Show concrete calculations
- **Warnings over Assumptions**: Flag risks and pitfalls explicitly
- **Actionable over Theoretical**: Focus on what players should do

### Formatting Conventions

- **Currency**: Always use ₡ symbol with comma separators (₡3,000,000)
- **Percentages**: Use % symbol (50% win rate)
- **Ranges**: Use en-dash (₡5,000-₡10,000)
- **Formulas**: Use code blocks for calculations
- **Tables**: Use markdown tables for comparisons
- **Emphasis**: Use **bold** for key terms, *italics* for emphasis
- **Lists**: Use numbered lists for sequences, bullet lists for collections

### Validation Process

Before finalizing the guide:

1. **Mathematical Validation**: Verify all calculations against game formulas
2. **Cross-Reference Check**: Ensure all data matches source documentation
3. **Completeness Check**: Verify all archetypes have all required sections
4. **Readability Review**: Ensure guide is accessible to target audience
5. **Accuracy Review**: Verify all examples and projections are realistic

## Future Enhancements

### Potential Additions

1. **Interactive Calculator**: Web tool to customize budget allocations
2. **Visual Diagrams**: Flowcharts for decision trees and progression paths
3. **Video Guides**: Companion videos demonstrating each archetype
4. **Community Builds**: Player-submitted archetype variations
5. **Meta Analysis**: How archetypes perform in current competitive meta
6. **Advanced Archetypes**: Specialized strategies for experienced players
7. **League-Specific Guides**: Tailored advice for each league tier
8. **Tournament Preparation**: Specialized guide for competitive play

### Maintenance Plan

The guide should be reviewed and updated when:

- **Economy changes**: Starting budget, costs, or income formulas change
- **New content**: New weapons, facilities, or systems are added
- **Balance patches**: Significant changes to game mechanics
- **Meta shifts**: Dominant strategies change in competitive play
- **Community feedback**: Players identify errors or request clarifications

### Localization Considerations

If the guide is translated:

- Currency symbols may need localization
- Numerical formatting may vary by locale
- Examples should remain culturally neutral
- Formulas should use universal mathematical notation

## Conclusion

This design provides a comprehensive framework for creating a player-friendly guide to Armoured Souls' complex economic and strategic systems. By organizing strategies into 6 distinct archetypes with detailed budget allocations, economic projections, and progression roadmaps, the guide will help players make informed decisions and avoid common pitfalls.

The guide's value lies in its specificity: concrete numbers, realistic projections, and actionable advice based on actual game mechanics. By validating all calculations against source documentation and providing clear risk assessments, the guide will serve as a trusted reference for both new and experienced players.
