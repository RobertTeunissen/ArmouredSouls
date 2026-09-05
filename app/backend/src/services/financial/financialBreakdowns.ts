import type {
  AchievementRewardBreakdown,
  OperatingCostsBreakdown,
  PassiveIncomeBreakdown,
  PurchaseBreakdown,
  RepairBreakdown,
  PurchaseTransactionType,
} from '../../types';

interface PurchaseBreakdownInput {
  transactionType: PurchaseTransactionType;
  sourceEventId: string;
  amount: number;
  operation: string;
  itemId?: number | string | null;
  facilityType?: string | null;
  previousLevel?: number | null;
  newLevel?: number | null;
  basePrice: number;
  discountAmount?: number;
  saleValue?: number | null;
  inputs?: readonly { name: string; value: string | number | boolean | null; unit: string; source: string }[];
  modifiers?: readonly { name: string; value: number; unit: string; source: string; applied: boolean }[];
  roundingMode?: 'none' | 'round' | 'floor' | 'ceil' | 'trunc';
  operationOrder?: readonly string[];
  roundingScope?: 'per_item' | 'aggregate';
}

export function buildPurchaseBreakdown(input: PurchaseBreakdownInput): PurchaseBreakdown {
  return {
    schemaVersion: 1,
    formula: `economy.${input.transactionType}`,
    formulaVersion: '1',
    inputs: input.inputs ?? [
      { name: 'basePrice', value: input.basePrice, unit: 'credits', source: 'economic_operation' },
    ],
    modifiers: input.modifiers ?? [],
    rounding: {
      precision: 0,
      mode: input.roundingMode ?? 'none',
      operationOrder: input.operationOrder ?? ['basePrice', 'discountAmount', 'finalAmount'],
      scope: input.roundingScope ?? 'aggregate',
    },
    finalAmount: input.amount,
    sourceEventId: input.sourceEventId,
    transactionType: input.transactionType,
    operation: input.operation,
    itemId: input.itemId ?? null,
    facilityType: input.facilityType ?? null,
    previousLevel: input.previousLevel ?? null,
    newLevel: input.newLevel ?? null,
    basePrice: input.basePrice,
    discountAmount: input.discountAmount ?? 0,
    saleValue: input.saleValue ?? null,
  };
}

interface RepairBreakdownInput {
  sourceEventId: string;
  amount: number;
  repairType: 'manual' | 'automatic';
  robotId: number;
  baseQuote: number;
  damageRepaired: number;
  repairBayLevel: number;
  activeRobotCount: number;
  repairBayDiscountPercent: number;
  manualRepairDiscountPercent: number;
  quoteBeforeManualDiscount: number;
  attributeTotal?: number;
  damagePercent?: number;
  hpPercent?: number;
}

export function buildRepairBreakdown(input: RepairBreakdownInput): RepairBreakdown {
  const isManual = input.repairType === 'manual';
  const inputs = [
    { name: 'baseQuote', value: input.baseQuote, unit: 'credits', source: 'shared_repair_module' },
    ...(input.attributeTotal === undefined ? [] : [
      { name: 'attributeTotal', value: input.attributeTotal, unit: 'attribute_points', source: 'robot' },
    ]),
    ...(input.damagePercent === undefined ? [] : [
      { name: 'damagePercent', value: input.damagePercent, unit: 'percent', source: 'robot' },
    ]),
    ...(input.hpPercent === undefined ? [] : [
      { name: 'hpPercent', value: input.hpPercent, unit: 'percent', source: 'robot' },
    ]),
    { name: 'damageRepaired', value: input.damageRepaired, unit: 'hp', source: 'robot' },
    { name: 'repairBayLevel', value: input.repairBayLevel, unit: 'levels', source: 'facility' },
    { name: 'activeRobotCount', value: input.activeRobotCount, unit: 'robots', source: 'stable' },
    { name: 'quoteBeforeManualDiscount', value: input.quoteBeforeManualDiscount, unit: 'credits', source: 'shared_repair_module' },
    { name: 'quoteRoundingMode', value: 'round', unit: 'mode', source: 'shared_repair_module' },
    { name: 'chargeRoundingMode', value: isManual ? 'floor' : 'round', unit: 'mode', source: 'shared_repair_module' },
  ];

  return {
    schemaVersion: 1,
    formula: 'repair.quote',
    formulaVersion: '1',
    inputs,
    modifiers: [
      { name: 'repairBayDiscount', value: input.repairBayDiscountPercent, unit: 'percent', source: 'shared_repair_module', applied: input.repairBayDiscountPercent > 0 },
      { name: 'manualRepairDiscount', value: input.manualRepairDiscountPercent, unit: 'percent', source: 'shared_repair_module', applied: input.manualRepairDiscountPercent > 0 },
    ],
    rounding: {
      precision: 0,
      mode: isManual ? 'floor' : 'round',
      operationOrder: isManual
        ? ['baseQuote', 'repairBayDiscount', 'quoteBeforeManualDiscount', 'manualRepairDiscount', 'perRobotCharge']
        : ['baseQuote', 'repairBayDiscount', 'quoteBeforeManualDiscount', 'perRobotCharge'],
      scope: 'per_item',
    },
    finalAmount: input.amount,
    sourceEventId: input.sourceEventId,
    transactionType: 'repair_cost',
    repairType: input.repairType,
    robotId: input.robotId,
    baseQuote: input.baseQuote,
    damageRepaired: input.damageRepaired,
    repairBayLevel: input.repairBayLevel,
    activeRobotCount: input.activeRobotCount,
    repairBayDiscountPercent: input.repairBayDiscountPercent,
    manualRepairDiscountPercent: input.manualRepairDiscountPercent,
    quoteBeforeManualDiscount: input.quoteBeforeManualDiscount,
    perRobotCharge: Math.abs(input.amount),
  };
}

interface AchievementBreakdownInput {
  sourceEventId: string;
  amount: number;
  achievementId: number | string;
  unlockId: number | string;
  baseReward: number;
}

export function buildAchievementRewardBreakdown(input: AchievementBreakdownInput): AchievementRewardBreakdown {
  return {
    schemaVersion: 1,
    formula: 'achievement.reward',
    formulaVersion: '1',
    inputs: [
      { name: 'baseReward', value: input.baseReward, unit: 'credits', source: 'achievement_definition' },
      { name: 'achievementId', value: input.achievementId, unit: 'id', source: 'achievement' },
      { name: 'unlockId', value: input.unlockId, unit: 'id', source: 'achievement_unlock' },
    ],
    modifiers: [],
    rounding: { precision: 0, mode: 'none', operationOrder: ['baseReward'], scope: 'aggregate' },
    finalAmount: input.amount,
    sourceEventId: input.sourceEventId,
    transactionType: 'achievement_reward',
    achievementId: input.achievementId,
    unlockId: input.unlockId,
    baseReward: input.baseReward,
    rewardAmount: input.amount,
  };
}

interface PassiveIncomeBreakdownInput {
  sourceEventId: string;
  amount: number;
  cycleNumber: number;
  merchandisingHubLevel: number;
  baseMerchandisingRate: number;
  prestige: number;
  rosterCapacity: number;
  prestigePerSlot: number;
}

export function buildPassiveIncomeBreakdown(input: PassiveIncomeBreakdownInput): PassiveIncomeBreakdown {
  return {
    schemaVersion: 1,
    formula: 'settlement.passive_income',
    formulaVersion: '1',
    inputs: [
      { name: 'merchandisingHubLevel', value: input.merchandisingHubLevel, unit: 'levels', source: 'facility' },
      { name: 'baseMerchandisingRate', value: input.baseMerchandisingRate, unit: 'credits', source: 'shared_economy_formula' },
      { name: 'prestige', value: input.prestige, unit: 'prestige', source: 'user' },
      { name: 'rosterCapacity', value: input.rosterCapacity, unit: 'slots', source: 'facility' },
      { name: 'prestigePerSlot', value: input.prestigePerSlot, unit: 'prestige_per_slot', source: 'shared_economy_formula' },
      { name: 'cycleNumber', value: input.cycleNumber, unit: 'cycle', source: 'cycle_metadata' },
    ],
    modifiers: [],
    rounding: {
      precision: 0,
      mode: 'round',
      operationOrder: [
        'merchandisingHubLevel',
        'baseMerchandisingRate',
        'rosterCapacity',
        'prestige',
        'prestigePerSlot',
        'merchandisingIncome',
      ],
      scope: 'aggregate',
    },
    finalAmount: input.amount,
    sourceEventId: input.sourceEventId,
    transactionType: 'passive_income',
    cycleNumber: input.cycleNumber,
    merchandisingHubLevel: input.merchandisingHubLevel,
    baseMerchandisingRate: input.baseMerchandisingRate,
    prestige: input.prestige,
    rosterCapacity: input.rosterCapacity,
    prestigePerSlot: input.prestigePerSlot,
    passiveIncomeAmount: input.amount,
  };
}

interface OperatingCostsBreakdownInput {
  sourceEventId: string;
  amount: number;
  cycleNumber: number;
  costComponents: readonly { name: string; amount: number; source: string }[];
  robotCount: number;
  rosterCostPerAdditionalRobot: number;
}

export function buildOperatingCostsBreakdown(input: OperatingCostsBreakdownInput): OperatingCostsBreakdown {
  return {
    schemaVersion: 1,
    formula: 'settlement.operating_costs',
    formulaVersion: '1',
    inputs: [
      { name: 'cycleNumber', value: input.cycleNumber, unit: 'cycle', source: 'cycle_metadata' },
      { name: 'componentCount', value: input.costComponents.length, unit: 'components', source: 'settlement' },
      { name: 'robotCount', value: input.robotCount, unit: 'robots', source: 'stable' },
      { name: 'rosterCostPerAdditionalRobot', value: input.rosterCostPerAdditionalRobot, unit: 'credits_per_robot', source: 'settlement' },
    ],
    modifiers: [
      { name: 'operatingCostDiscount', value: 0, unit: 'credits', source: 'settlement', applied: false },
      { name: 'operatingCostWaiver', value: 0, unit: 'credits', source: 'settlement', applied: false },
    ],
    rounding: {
      precision: 0,
      mode: 'none',
      operationOrder: ['facilityComponents', 'rosterExpansionComponent', 'costComponents', 'finalAmount'],
      scope: 'aggregate',
    },
    finalAmount: input.amount,
    sourceEventId: input.sourceEventId,
    transactionType: 'operating_costs',
    cycleNumber: input.cycleNumber,
    costComponents: input.costComponents,
    robotCount: input.robotCount,
    rosterCostPerAdditionalRobot: input.rosterCostPerAdditionalRobot,
    operatingCostAmount: Math.abs(input.amount),
  };
}
