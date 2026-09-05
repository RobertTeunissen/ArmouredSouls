/**
 * Closed financial transaction taxonomy and typed formula facts.
 *
 * These types describe JSON persisted in `FinancialLedger.metadata` and the
 * paired `AuditLog.payload`. They intentionally contain facts captured at the
 * time of a mutation; readers must not re-derive historical amounts from live
 * facilities, prestige, fame, quotes, or current formula code.
 */

export const TRANSACTION_TYPES = [
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
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** Labels retained only for reading pre-cutover legacy rows. */
export const LEGACY_TRANSACTION_TYPES = [
  'subscription_cost',
  'prestige_award',
  'settlement_adjustment',
] as const;

export type LegacyTransactionType = (typeof LEGACY_TRANSACTION_TYPES)[number];

export type FinancialInputValue = string | number | boolean | null;

export interface FinancialInput {
  name: string;
  value: FinancialInputValue;
  unit: string;
  source: string;
}

export interface FinancialModifier {
  name: string;
  value: number;
  unit: string;
  source: string;
  applied: boolean;
}

export interface FinancialRounding {
  precision: number;
  mode: 'none' | 'round' | 'floor' | 'ceil' | 'trunc';
  operationOrder: readonly string[];
  scope: 'per_item' | 'aggregate';
}

export interface FinancialBreakdownBase {
  schemaVersion: 1;
  formula: string;
  formulaVersion: string;
  inputs: readonly FinancialInput[];
  modifiers: readonly FinancialModifier[];
  rounding: FinancialRounding;
  /** Signed amount written to the balance mutation. */
  finalAmount: number;
  /** Durable source identity that explains why this event exists. */
  sourceEventId: string;
}

export interface PlacementRewardComponentBase {
  robotId: number;
  tier: number | string;
  placement: number;
  credits: number;
  tierBaseReward: number;
  modeBaseMultiplier: number;
  placementMultiplier: number;
}

/** Per-robot KotH facts retained inside a stable-level placement income mutation. */
export interface KothPlacementRewardComponent extends PlacementRewardComponentBase {
  mode: 'koth';
  zoneScore: number;
  zoneTime: number;
  uncontestedScore: number;
  zoneDominanceBonus: boolean;
  zoneDominanceMultiplier: number;
}

/** Per-robot Grand Melee facts retained inside a stable-level placement income mutation. */
export interface GrandMeleePlacementRewardComponent extends PlacementRewardComponentBase {
  mode: 'grand_melee';
  totalParticipants: number;
  participationFloorApplied: boolean;
  participationFloorMultiplier: number;
}

export type PlacementRewardComponent =
  | KothPlacementRewardComponent
  | GrandMeleePlacementRewardComponent;

export interface BattleIncomeBreakdown extends FinancialBreakdownBase {
  transactionType: 'battle_income';
  mode: string;
  tier: number | string;
  outcome: string;
  placement: number | null;
  participationFloor: number;
  winComponent: number;
  teamSize: number;
  stableAggregation: 'stable';
  isBye: boolean;
  /** Required only for KotH and Grand Melee placement outcomes. */
  placementRewardComponents?: readonly PlacementRewardComponent[];
}

export interface StreamingRevenueBreakdown extends FinancialBreakdownBase {
  transactionType: 'streaming_revenue';
  battleId: number | string;
  robotId: number;
  mode: string;
  eligible: true;
  baseAmount: number;
  battleMultiplier: number;
  fameMultiplier: number;
  studioMultiplier: number;
  totalRevenue: number;
}

export interface RepairBreakdown extends FinancialBreakdownBase {
  transactionType: 'repair_cost';
  repairType: 'manual' | 'automatic';
  robotId: number;
  baseQuote: number;
  damageRepaired: number;
  repairBayLevel: number;
  activeRobotCount: number;
  repairBayDiscountPercent: number;
  manualRepairDiscountPercent: number;
  quoteBeforeManualDiscount: number;
  perRobotCharge: number;
}

export type PurchaseTransactionType =
  | 'facility_upgrade'
  | 'weapon_purchase'
  | 'weapon_sale'
  | 'weapon_refinement'
  | 'robot_creation'
  | 'attribute_upgrade';

export interface PurchaseBreakdown extends FinancialBreakdownBase {
  transactionType: PurchaseTransactionType;
  operation: string;
  itemId: number | string | null;
  facilityType: string | null;
  previousLevel: number | null;
  newLevel: number | null;
  basePrice: number;
  discountAmount: number;
  saleValue: number | null;
}

export interface AchievementRewardBreakdown extends FinancialBreakdownBase {
  transactionType: 'achievement_reward';
  achievementId: number | string;
  unlockId: number | string;
  baseReward: number;
  rewardAmount: number;
}

export interface PassiveIncomeBreakdown extends FinancialBreakdownBase {
  transactionType: 'passive_income';
  cycleNumber: number;
  merchandisingHubLevel: number;
  baseMerchandisingRate: number;
  prestige: number;
  rosterCapacity: number;
  prestigePerSlot: number;
  passiveIncomeAmount: number;
}

export interface OperatingCostsBreakdown extends FinancialBreakdownBase {
  transactionType: 'operating_costs';
  cycleNumber: number;
  costComponents: readonly {
    name: string;
    amount: number;
    source: string;
  }[];
  robotCount: number;
  rosterCostPerAdditionalRobot: number;
  operatingCostAmount: number;
}

export type FinancialBreakdown =
  | BattleIncomeBreakdown
  | StreamingRevenueBreakdown
  | RepairBreakdown
  | PurchaseBreakdown
  | AchievementRewardBreakdown
  | PassiveIncomeBreakdown
  | OperatingCostsBreakdown;

export interface FinancialAuditPayload {
  financialEventId: string;
  transactionType: TransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  breakdown: FinancialBreakdown;
}

const TRANSACTION_TYPE_SET: ReadonlySet<string> = new Set(TRANSACTION_TYPES);
const ROUNDING_MODES: ReadonlySet<string> = new Set(['none', 'round', 'floor', 'ceil', 'trunc']);
const ROUNDING_SCOPES: ReadonlySet<string> = new Set(['per_item', 'aggregate']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

function isInputValue(value: unknown): value is FinancialInputValue {
  return value === null || typeof value === 'string' || typeof value === 'boolean' || isFiniteNumber(value);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invalid Financial_Breakdown: ${message}`);
  }
}

function validateCommon(value: Record<string, unknown>): void {
  assert(value.schemaVersion === 1, 'schemaVersion must be 1');
  assert(typeof value.formula === 'string' && value.formula.length > 0, 'formula is required');
  assert(typeof value.formulaVersion === 'string' && value.formulaVersion.length > 0, 'formulaVersion is required');
  assert(typeof value.sourceEventId === 'string' && value.sourceEventId.length > 0, 'sourceEventId is required');
  assert(isFiniteNumber(value.finalAmount), 'finalAmount must be finite');
  assert(Array.isArray(value.inputs), 'inputs must be an array');
  for (const input of value.inputs) {
    assert(isRecord(input), 'each input must be an object');
    assert(typeof input.name === 'string' && input.name.length > 0, 'input.name is required');
    assert(isInputValue(input.value), 'input.value must be a typed scalar');
    assert(typeof input.unit === 'string' && input.unit.length > 0, 'input.unit is required');
    assert(typeof input.source === 'string' && input.source.length > 0, 'input.source is required');
  }

  assert(Array.isArray(value.modifiers), 'modifiers must be an array');
  for (const modifier of value.modifiers) {
    assert(isRecord(modifier), 'each modifier must be an object');
    assert(typeof modifier.name === 'string' && modifier.name.length > 0, 'modifier.name is required');
    assert(isFiniteNumber(modifier.value), 'modifier.value must be finite');
    assert(typeof modifier.unit === 'string' && modifier.unit.length > 0, 'modifier.unit is required');
    assert(typeof modifier.source === 'string' && modifier.source.length > 0, 'modifier.source is required');
    assert(typeof modifier.applied === 'boolean', 'modifier.applied is required');
  }

  assert(isRecord(value.rounding), 'rounding is required');
  assert(isInteger(value.rounding.precision) && value.rounding.precision >= 0, 'rounding.precision must be a non-negative integer');
  assert(typeof value.rounding.mode === 'string' && ROUNDING_MODES.has(value.rounding.mode), 'rounding.mode is invalid');
  assert(Array.isArray(value.rounding.operationOrder), 'rounding.operationOrder must be an array');
  assert(value.rounding.operationOrder.every((step) => typeof step === 'string' && step.length > 0), 'rounding.operationOrder must contain strings');
  assert(typeof value.rounding.scope === 'string' && ROUNDING_SCOPES.has(value.rounding.scope), 'rounding.scope is invalid');
}

function validatePlacementRewardComponent(component: unknown, mode: 'koth' | 'grand_melee'): void {
  assert(isRecord(component), 'placement reward component must be an object');
  assert(component.mode === mode, 'placement reward component mode is invalid');
  assert(isInteger(component.robotId) && component.robotId > 0, 'placement reward robotId must be positive');
  assert(typeof component.tier === 'string' || isFiniteNumber(component.tier), 'placement reward tier is required');
  assert(isInteger(component.placement) && component.placement > 0, 'placement reward placement must be positive');
  for (const field of ['credits', 'tierBaseReward', 'modeBaseMultiplier', 'placementMultiplier']) {
    assert(isFiniteNumber(component[field]) && component[field] >= 0, `placement reward ${field} is invalid`);
  }

  if (mode === 'koth') {
    for (const field of ['zoneScore', 'zoneTime', 'uncontestedScore']) {
      assert(isFiniteNumber(component[field]) && component[field] >= 0, `KotH ${field} is invalid`);
    }
    assert(typeof component.zoneDominanceBonus === 'boolean', 'KotH zoneDominanceBonus is required');
    assert(
      component.zoneDominanceMultiplier === 1 || component.zoneDominanceMultiplier === 1.25,
      'KotH zoneDominanceMultiplier is invalid',
    );
    assert(
      component.zoneDominanceMultiplier === (component.zoneDominanceBonus ? 1.25 : 1),
      'KotH zone dominance facts disagree',
    );
    return;
  }

  assert(isInteger(component.totalParticipants) && component.totalParticipants > 0, 'Grand Melee totalParticipants must be positive');
  assert(typeof component.participationFloorApplied === 'boolean', 'Grand Melee participationFloorApplied is required');
  assert(isFiniteNumber(component.participationFloorMultiplier), 'Grand Melee participationFloorMultiplier is invalid');
  assert(
    component.participationFloorMultiplier === (component.participationFloorApplied ? 0.2 : 0),
    'Grand Melee participation floor facts disagree',
  );
}

function validateBattle(value: Record<string, unknown>): void {
  assert(typeof value.mode === 'string' && value.mode.length > 0, 'battle mode is required');
  assert(typeof value.tier === 'string' || isFiniteNumber(value.tier), 'battle tier is required');
  assert(typeof value.outcome === 'string' && value.outcome.length > 0, 'battle outcome is required');
  assert(value.placement === null || isInteger(value.placement), 'battle placement is invalid');
  assert(isFiniteNumber(value.participationFloor), 'participationFloor is required');
  assert(isFiniteNumber(value.winComponent), 'winComponent is required');
  assert(isInteger(value.teamSize) && value.teamSize > 0, 'teamSize must be positive');
  assert(value.stableAggregation === 'stable', 'stableAggregation must be stable');
  assert(typeof value.isBye === 'boolean', 'isBye is required');

  const isPlacementMode = value.mode === 'koth' || value.mode === 'grand_melee';
  const hasComponents = value.placementRewardComponents !== undefined;
  if (!isPlacementMode || value.outcome !== 'placement') {
    assert(!hasComponents, 'placement reward components are only valid for KotH and Grand Melee placement outcomes');
    return;
  }

  assert(Array.isArray(value.placementRewardComponents) && value.placementRewardComponents.length > 0, 'placement reward components are required');
  const componentMode = value.mode as 'koth' | 'grand_melee';
  for (const component of value.placementRewardComponents) {
    validatePlacementRewardComponent(component, componentMode);
  }
  const componentTotal = value.placementRewardComponents.reduce<number>((total, component) => {
    return total + (component as PlacementRewardComponent).credits;
  }, 0);
  assert(componentTotal === value.finalAmount, 'placement reward components must sum to finalAmount');
}

function validateStreaming(value: Record<string, unknown>): void {
  assert(typeof value.battleId === 'string' || isFiniteNumber(value.battleId), 'battleId is required');
  assert(isInteger(value.robotId) && value.robotId > 0, 'robotId must be positive');
  assert(typeof value.mode === 'string' && value.mode.length > 0, 'streaming mode is required');
  assert(value.eligible === true, 'streaming eligibility must be true');
  for (const field of ['baseAmount', 'battleMultiplier', 'fameMultiplier', 'studioMultiplier', 'totalRevenue']) {
    assert(isFiniteNumber(value[field]), `${field} is required`);
  }
}

function validateRepair(value: Record<string, unknown>): void {
  assert(value.repairType === 'manual' || value.repairType === 'automatic', 'repairType must be manual or automatic');
  assert(isInteger(value.robotId) && value.robotId > 0, 'repair robotId must be positive');
  for (const field of ['baseQuote', 'damageRepaired', 'repairBayDiscountPercent', 'manualRepairDiscountPercent', 'quoteBeforeManualDiscount', 'perRobotCharge']) {
    assert(isFiniteNumber(value[field]), `${field} is required`);
  }
  assert(isInteger(value.repairBayLevel) && value.repairBayLevel >= 0, 'repairBayLevel must be non-negative');
  assert(isInteger(value.activeRobotCount) && value.activeRobotCount >= 0, 'activeRobotCount must be non-negative');
}

function validatePurchase(value: Record<string, unknown>): void {
  assert(typeof value.operation === 'string' && value.operation.length > 0, 'purchase operation is required');
  assert(value.itemId === null || typeof value.itemId === 'string' || isFiniteNumber(value.itemId), 'itemId is invalid');
  assert(value.facilityType === null || typeof value.facilityType === 'string', 'facilityType is invalid');
  assert(value.previousLevel === null || isInteger(value.previousLevel), 'previousLevel is invalid');
  assert(value.newLevel === null || isInteger(value.newLevel), 'newLevel is invalid');
  assert(isFiniteNumber(value.basePrice), 'basePrice is required');
  assert(isFiniteNumber(value.discountAmount), 'discountAmount is required');
  assert(value.saleValue === null || isFiniteNumber(value.saleValue), 'saleValue is invalid');
}

function validateAchievement(value: Record<string, unknown>): void {
  assert(typeof value.achievementId === 'string' || isFiniteNumber(value.achievementId), 'achievementId is required');
  assert(typeof value.unlockId === 'string' || isFiniteNumber(value.unlockId), 'unlockId is required');
  assert(isFiniteNumber(value.baseReward), 'baseReward is required');
  assert(isFiniteNumber(value.rewardAmount), 'rewardAmount is required');
}

function validatePassive(value: Record<string, unknown>): void {
  assert(isInteger(value.cycleNumber) && value.cycleNumber >= 0, 'cycleNumber is required');
  assert(isInteger(value.merchandisingHubLevel) && value.merchandisingHubLevel >= 0, 'merchandisingHubLevel is required');
  assert(isFiniteNumber(value.baseMerchandisingRate), 'baseMerchandisingRate is required');
  assert(isFiniteNumber(value.prestige), 'prestige is required');
  assert(isInteger(value.rosterCapacity) && value.rosterCapacity > 0, 'rosterCapacity must be positive');
  assert(isFiniteNumber(value.prestigePerSlot), 'prestigePerSlot is required');
  assert(isFiniteNumber(value.passiveIncomeAmount), 'passiveIncomeAmount is required');
}

function validateOperatingCosts(value: Record<string, unknown>): void {
  assert(isInteger(value.cycleNumber) && value.cycleNumber >= 0, 'cycleNumber is required');
  assert(Array.isArray(value.costComponents), 'costComponents must be an array');
  for (const component of value.costComponents) {
    assert(isRecord(component), 'each cost component must be an object');
    assert(typeof component.name === 'string' && component.name.length > 0, 'cost component name is required');
    assert(isFiniteNumber(component.amount), 'cost component amount is required');
    assert(typeof component.source === 'string' && component.source.length > 0, 'cost component source is required');
  }
  assert(isInteger(value.robotCount) && value.robotCount >= 0, 'robotCount is required');
  assert(isFiniteNumber(value.rosterCostPerAdditionalRobot) && value.rosterCostPerAdditionalRobot >= 0, 'rosterCostPerAdditionalRobot is required');
  assert(isFiniteNumber(value.operatingCostAmount), 'operatingCostAmount is required');
}

/** Returns true only for the twelve current writer transaction types. */
export function isTransactionType(value: unknown): value is TransactionType {
  return typeof value === 'string' && TRANSACTION_TYPE_SET.has(value);
}

/** Throws when a new writer attempts an obsolete or unknown transaction type. */
export function assertTransactionType(value: unknown): asserts value is TransactionType {
  assert(isTransactionType(value), `transactionType ${String(value)} is not permitted for new writes`);
}

/**
 * Validate a complete typed breakdown before it reaches Prisma JSON storage.
 * The optional expected type prevents a breakdown from being paired with a
 * different ledger taxonomy value.
 */
export function validateFinancialBreakdown(
  value: unknown,
  expectedTransactionType?: TransactionType,
): value is FinancialBreakdown {
  try {
    assert(isRecord(value), 'breakdown must be an object');
    assertTransactionType(value.transactionType);
    if (expectedTransactionType !== undefined) {
      assert(value.transactionType === expectedTransactionType, 'transactionType does not match the mutation');
    }
    validateCommon(value);

    switch (value.transactionType) {
      case 'battle_income':
        validateBattle(value);
        break;
      case 'streaming_revenue':
        validateStreaming(value);
        break;
      case 'repair_cost':
        validateRepair(value);
        break;
      case 'facility_upgrade':
      case 'weapon_purchase':
      case 'weapon_sale':
      case 'weapon_refinement':
      case 'robot_creation':
      case 'attribute_upgrade':
        validatePurchase(value);
        break;
      case 'achievement_reward':
        validateAchievement(value);
        break;
      case 'passive_income':
        validatePassive(value);
        break;
      case 'operating_costs':
        validateOperatingCosts(value);
        break;
    }
    return true;
  } catch {
    return false;
  }
}

/** Throwing counterpart used at the mutation boundary. */
export function assertValidFinancialBreakdown(
  value: unknown,
  expectedTransactionType: TransactionType,
): asserts value is FinancialBreakdown {
  assert(validateFinancialBreakdown(value, expectedTransactionType), 'required fields are missing or invalid');
}
