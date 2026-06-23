/**
 * Factory for creating valid FinancialLedger entries.
 *
 * Supports all 12 transaction types with appropriate sign conventions:
 * - Income types: positive amounts (default 1000)
 * - Expense types: negative amounts (default -500)
 *
 * Types defined locally to match the Prisma schema from Spec #40.
 * Once `prisma generate` is run after Tasks 1.1–1.5, these can be
 * replaced with imports from '../../generated/prisma'.
 */

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
  createdAt: Date;
}

let ledgerIdCounter = 1000;

const TRANSACTION_TYPES = [
  'battle_income',
  'streaming_revenue',
  'repair_cost',
  'facility_upgrade',
  'weapon_purchase',
  'weapon_sale',
  'weapon_refinement',
  'robot_creation',
  'subscription_cost',
  'prestige_award',
  'attribute_upgrade',
  'settlement_adjustment',
] as const;

type TransactionType = (typeof TRANSACTION_TYPES)[number];

const INCOME_TYPES: TransactionType[] = [
  'battle_income',
  'streaming_revenue',
  'weapon_sale',
  'prestige_award',
  'settlement_adjustment',
];

const EXPENSE_TYPES: TransactionType[] = [
  'repair_cost',
  'facility_upgrade',
  'weapon_purchase',
  'weapon_refinement',
  'robot_creation',
  'subscription_cost',
  'attribute_upgrade',
];

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
    subscription_cost: 'Event subscription fee',
    prestige_award: 'Prestige milestone reward',
    attribute_upgrade: 'Attribute upgrade cost',
    settlement_adjustment: 'End-of-cycle settlement',
  };
  return descriptions[type];
}

/**
 * Creates a valid FinancialLedger entry with sensible defaults.
 * Amount defaults to 1000 (income) or -500 (expense) based on transaction type.
 */
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
    createdAt: new Date(),
  };

  return { ...base, ...overrides };
}

/**
 * Creates a ledger entry pre-configured for a specific transaction type.
 * Income types get positive amounts, expense types get negative amounts.
 */
export function createLedgerEntryForType(
  transactionType: TransactionType,
  overrides?: Partial<FinancialLedger>
): FinancialLedger {
  return createLedgerEntry({ transactionType, ...overrides });
}

export { TRANSACTION_TYPES, INCOME_TYPES, EXPENSE_TYPES, TransactionType };
