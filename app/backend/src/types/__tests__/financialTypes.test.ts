import {
  LEGACY_TRANSACTION_TYPES,
  TRANSACTION_TYPES,
  assertValidFinancialBreakdown,
  isTransactionType,
  validateFinancialBreakdown,
  type FinancialBreakdown,
} from '../financialTypes';

const base = {
  schemaVersion: 1 as const,
  formula: 'test.formula',
  formulaVersion: '1',
  inputs: [{ name: 'base', value: 100, unit: 'credits', source: 'test' }],
  modifiers: [],
  rounding: {
    precision: 0,
    mode: 'round' as const,
    operationOrder: ['base'],
    scope: 'aggregate' as const,
  },
  finalAmount: 100,
  sourceEventId: 'test-event',
};

function breakdown(transactionType: FinancialBreakdown['transactionType']): FinancialBreakdown {
  switch (transactionType) {
    case 'battle_income':
      return {
        ...base,
        transactionType,
        mode: 'league_1v1',
        tier: 1,
        outcome: 'win',
        placement: null,
        participationFloor: 100,
        winComponent: 0,
        teamSize: 1,
        stableAggregation: 'stable',
        isBye: false,
      };
    case 'streaming_revenue':
      return {
        ...base,
        transactionType,
        battleId: 10,
        robotId: 20,
        mode: 'league_1v1',
        eligible: true,
        baseAmount: 100,
        battleMultiplier: 1,
        fameMultiplier: 1,
        studioMultiplier: 1,
        totalRevenue: 100,
      };
    case 'repair_cost':
      return {
        ...base,
        transactionType,
        repairType: 'manual',
        robotId: 20,
        baseQuote: 100,
        damageRepaired: 50,
        repairBayLevel: 1,
        activeRobotCount: 1,
        repairBayDiscountPercent: 5,
        manualRepairDiscountPercent: 50,
        quoteBeforeManualDiscount: 95,
        perRobotCharge: -48,
        finalAmount: -48,
      };
    case 'facility_upgrade':
    case 'weapon_purchase':
    case 'weapon_sale':
    case 'weapon_refinement':
    case 'robot_creation':
    case 'attribute_upgrade':
      return {
        ...base,
        transactionType,
        operation: transactionType,
        itemId: null,
        facilityType: null,
        previousLevel: null,
        newLevel: null,
        basePrice: 100,
        discountAmount: 0,
        saleValue: transactionType === 'weapon_sale' ? 100 : null,
      };
    case 'achievement_reward':
      return {
        ...base,
        transactionType,
        achievementId: 1,
        unlockId: 2,
        baseReward: 100,
        rewardAmount: 100,
      };
    case 'passive_income':
      return {
        ...base,
        transactionType,
        cycleNumber: 1,
        merchandisingHubLevel: 1,
        baseMerchandisingRate: 100,
        prestige: 100,
        rosterCapacity: 2,
        prestigePerSlot: 50,
        passiveIncomeAmount: 100,
      };
    case 'operating_costs':
      return {
        ...base,
        transactionType,
        cycleNumber: 1,
        costComponents: [{ name: 'robots', amount: 100, source: 'test' }],
        robotCount: 2,
        rosterCostPerAdditionalRobot: 500,
        operatingCostAmount: -100,
      };
  }
}

describe('financial transaction taxonomy and breakdown contract', () => {
  it('should expose exactly the twelve current transaction types', () => {
    expect(TRANSACTION_TYPES).toEqual([
      'battle_income',
      'streaming_revenue',
      'repair_cost',
      'facility_upgrade',
      'weapon_purchase',
      'weapon_sale',
      'weapon_refinement',
      'robot_creation',
      'attribute_upgrade',
      'achievement_reward',
      'passive_income',
      'operating_costs',
    ]);
    expect(LEGACY_TRANSACTION_TYPES).toEqual([
      'subscription_cost',
      'prestige_award',
      'settlement_adjustment',
    ]);
    expect(isTransactionType('battle_income')).toBe(true);
    expect(isTransactionType('subscription_cost')).toBe(false);
    expect(isTransactionType('unknown')).toBe(false);
  });

  it('should validate every breakdown variant', () => {
    for (const transactionType of TRANSACTION_TYPES) {
      const value = breakdown(transactionType);
      expect(validateFinancialBreakdown(value, transactionType)).toBe(true);
      expect(validateFinancialBreakdown(value, transactionType === 'battle_income' ? 'streaming_revenue' : 'battle_income')).toBe(false);
    }
  });

  it('should require repair subtype metadata and reject invalid repair values', () => {
    const value = breakdown('repair_cost');
    expect(validateFinancialBreakdown(value, 'repair_cost')).toBe(true);

    const invalid = { ...value, repairType: 'bye' };
    expect(validateFinancialBreakdown(invalid, 'repair_cost')).toBe(false);
  });

  it('should reject unknown and incomplete breakdowns before persistence', () => {
    expect(validateFinancialBreakdown({ transactionType: 'subscription_cost' }, 'battle_income')).toBe(false);
    expect(validateFinancialBreakdown({ ...base, transactionType: 'battle_income' }, 'battle_income')).toBe(false);
    expect(() => assertValidFinancialBreakdown({ ...base, transactionType: 'battle_income' }, 'battle_income')).toThrow();
  });

  it('should retain legacy labels as reader-only values', () => {
    for (const type of LEGACY_TRANSACTION_TYPES) {
      expect(isTransactionType(type)).toBe(false);
    }
  });
});


describe('placement battle-income provenance', () => {
  it('should require and validate KotH and Grand Melee per-robot placement components', () => {
    const koth = {
      ...breakdown('battle_income'),
      mode: 'koth',
      tier: 'placement_aggregate',
      outcome: 'placement',
      placement: null,
      participationFloor: 0,
      winComponent: 0,
      finalAmount: 100,
      placementRewardComponents: [{
        mode: 'koth',
        robotId: 20,
        tier: 'gold',
        placement: 1,
        credits: 100,
        tierBaseReward: 50,
        modeBaseMultiplier: 1.5,
        placementMultiplier: 1,
        zoneScore: 80,
        zoneTime: 40,
        uncontestedScore: 64,
        zoneDominanceBonus: true,
        zoneDominanceMultiplier: 1.25,
      }],
    };
    const grandMelee = {
      ...breakdown('battle_income'),
      mode: 'grand_melee',
      tier: 'placement_aggregate',
      outcome: 'placement',
      placement: null,
      participationFloor: 0,
      winComponent: 0,
      finalAmount: 100,
      placementRewardComponents: [{
        mode: 'grand_melee',
        robotId: 20,
        tier: 'silver',
        placement: 12,
        credits: 100,
        tierBaseReward: 200,
        modeBaseMultiplier: 2.5,
        placementMultiplier: 0.2,
        totalParticipants: 20,
        participationFloorApplied: true,
        participationFloorMultiplier: 0.2,
      }],
    };

    expect(validateFinancialBreakdown(koth, 'battle_income')).toBe(true);
    expect(validateFinancialBreakdown(grandMelee, 'battle_income')).toBe(true);
    expect(validateFinancialBreakdown({ ...koth, placementRewardComponents: undefined }, 'battle_income')).toBe(false);
    expect(validateFinancialBreakdown({ ...grandMelee, finalAmount: 99 }, 'battle_income')).toBe(false);
    expect(validateFinancialBreakdown({ ...koth, mode: 'league_1v1' }, 'battle_income')).toBe(false);
  });
});