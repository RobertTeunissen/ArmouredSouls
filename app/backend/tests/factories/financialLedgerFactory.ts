/**
 * Factory for FinancialLedger reader tests.
 *
 * The taxonomy is imported from the production type barrel so fixtures cannot
 * silently reintroduce an obsolete new-writer label.
 */

import {
  TRANSACTION_TYPES,
  type TransactionType,
} from '../../src/types';

export interface FinancialLedger {
  id: number;
  cycleNumber: number;
  userId: number;
  robotId: number | null;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  description: string;
  metadata: Record<string, unknown> | null;
  financialEventId?: string | null;
  createdAt: Date;
}

const INCOME_TYPES: TransactionType[] = [
  'battle_income',
  'streaming_revenue',
  'weapon_sale',
  'achievement_reward',
  'passive_income',
];

const EXPENSE_TYPES: TransactionType[] = [
  'repair_cost',
  'facility_upgrade',
  'weapon_purchase',
  'weapon_refinement',
  'robot_creation',
  'attribute_upgrade',
  'operating_costs',
];

let ledgerIdCounter = 1000;

function isIncomeType(type: TransactionType): boolean {
  return INCOME_TYPES.includes(type);
}

function getDefaultAmount(type: TransactionType): number {
  return isIncomeType(type) ? 1000 : -500;
}

function getDefaultDescription(type: TransactionType): string {
  const descriptions: Record<TransactionType, string> = {
    battle_income: 'League battle victory reward',
    streaming_revenue: 'Streaming studio revenue',
    repair_cost: 'Robot repair after battle',
    facility_upgrade: 'Facility upgrade purchase',
    weapon_purchase: 'Weapon shop purchase',
    weapon_sale: 'Weapon sold to shop',
    weapon_refinement: 'Weapon refinement cost',
    robot_creation: 'New robot construction',
    attribute_upgrade: 'Attribute upgrade cost',
    achievement_reward: 'Achievement reward',
    passive_income: 'Cycle passive income',
    operating_costs: 'Cycle operating costs',
  };
  return descriptions[type];
}

export function createLedgerEntry(overrides?: Partial<FinancialLedger>): FinancialLedger {
  const id = overrides?.id ?? ++ledgerIdCounter;
  const transactionType = (overrides?.transactionType ?? 'battle_income') as TransactionType;
  const amount = overrides?.amount ?? getDefaultAmount(transactionType);
  const balanceAfter = overrides?.balanceAfter ?? 10000 + amount;

  const base: FinancialLedger = {
    id,
    cycleNumber: 1,
    userId: id + 2000,
    robotId: id + 3000,
    transactionType,
    amount,
    balanceAfter,
    description: getDefaultDescription(transactionType),
    metadata: null,
    financialEventId: null,
    createdAt: new Date(),
  };

  return { ...base, ...overrides };
}

export function createLedgerEntryForType(
  transactionType: TransactionType,
  overrides?: Partial<FinancialLedger>,
): FinancialLedger {
  return createLedgerEntry({ transactionType, ...overrides });
}

export { TRANSACTION_TYPES, INCOME_TYPES, EXPENSE_TYPES, TransactionType };
