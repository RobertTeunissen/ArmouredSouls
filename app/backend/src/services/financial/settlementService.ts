import type { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import {
  calculateFacilityOperatingCost,
  calculateMerchandisingIncome,
  getFacilityName,
  getMerchandisingBaseRate,
  getRosterCapacity,
} from '../../utils/economyFormulas';
import { eventLogger } from '../common/eventLogger';
import {
  buildOperatingCostsBreakdown,
  buildPassiveIncomeBreakdown,
} from './financialBreakdowns';
import { buildSettlementEventId } from './financialEventIdentity';
import {
  creditMutationService,
  type CreditMutationResult,
} from './creditMutationService';
import type { DailyFinancialSummary } from '../../utils/economyCalculations';
import {
  type OperatingCostsBreakdown,
  type PassiveIncomeBreakdown,
  validateFinancialBreakdown,
} from '../../types';
import { lockUserForSpending } from '../../lib/creditGuard';

const SETTLEMENT_USER_SELECT = {
  id: true,
  username: true,
  role: true,
  currency: true,
  prestige: true,
} as const;

type SettlementUser = Prisma.UserGetPayload<{ select: typeof SETTLEMENT_USER_SELECT }>;

const SETTLEMENT_FACILITY_SELECT = {
  userId: true,
  facilityType: true,
  level: true,
} as const;

type SettlementFacility = Prisma.FacilityGetPayload<{ select: typeof SETTLEMENT_FACILITY_SELECT }>;

const SETTLEMENT_ROBOT_SELECT = {
  userId: true,
  totalBattles: true,
  fame: true,
  currentHP: true,
  maxHP: true,
  repairQuoteCredits: true,
} as const;

type SettlementRobot = Prisma.RobotGetPayload<{ select: typeof SETTLEMENT_ROBOT_SELECT }>;

export interface SettlementOptions {
  /** The cycle identity used by both financial components and compatibility rows. */
  cycleNumber: number;
  /** Admin compatibility processing excludes admin accounts; cron and bulk include them. */
  includeAdmins?: boolean;
  /** Restrict processing to these stable IDs, primarily for compatibility callers. */
  userIds?: readonly number[];
}

export interface SettlementOperatingCostComponent {
  facilityType: string;
  level: number;
  cost: number;
  source: 'facility_operating_cost' | 'roster_expansion';
}

export interface SettlementFacts {
  merchandisingHubLevel: number;
  baseMerchandisingRate: number;
  prestige: number;
  rosterCapacity: number;
  prestigePerSlot: number;
  passiveIncome: number;
  operatingCosts: number;
  operatingCostComponents: readonly SettlementOperatingCostComponent[];
  robotCount: number;
  rosterCostPerAdditionalRobot: number;
  totalBattles: number;
  totalFame: number;
  repairQuoteTotal: number;
  damagedRobotCount: number;
}

export interface SettlementComponentResult {
  userId: number;
  passiveIncome: SettlementFinancialComponentResult;
  operatingCosts: SettlementFinancialComponentResult;
}

export interface SettlementFinancialComponentResult {
  financialEventId: string;
  amount: number;
  created: boolean;
  balanceBefore: number;
  balanceAfter: number;
}

export interface SettlementResult {
  cycleNumber: number;
  usersProcessed: number;
  totalPassiveIncome: number;
  totalOperatingCosts: number;
  bankruptUsers: number;
  summaries: DailyFinancialSummary[];
  components: SettlementComponentResult[];
}

/**
 * Calculate the complete settlement input set for one stable.
 *
 * This is deliberately pure: all values used by the two financial mutations
 * are captured before the transaction and then persisted in their typed
 * breakdowns. Streaming Studio revenue is intentionally absent because it is
 * a per-battle `streaming_revenue` event, not settlement income.
 */
export function calculateSettlementFacts(
  user: Pick<SettlementUser, 'prestige'>,
  facilities: readonly Pick<SettlementFacility, 'facilityType' | 'level'>[],
  robots: readonly Pick<SettlementRobot, 'totalBattles' | 'fame' | 'currentHP' | 'maxHP' | 'repairQuoteCredits'>[],
): SettlementFacts {
  const merchandisingHubLevel = facilities.find(
    (facility) => facility.facilityType === 'merchandising_hub',
  )?.level ?? 0;
  const rosterExpansionLevel = facilities.find(
    (facility) => facility.facilityType === 'roster_expansion',
  )?.level ?? 0;
  const rosterCapacity = getRosterCapacity(rosterExpansionLevel);
  const prestigePerSlot = user.prestige / rosterCapacity;
  const baseMerchandisingRate = getMerchandisingBaseRate(merchandisingHubLevel);
  const passiveIncome = calculateMerchandisingIncome(
    merchandisingHubLevel,
    user.prestige,
    rosterCapacity,
  );

  const operatingCostComponents: SettlementOperatingCostComponent[] = facilities
    .map((facility) => ({
      facilityType: facility.facilityType,
      level: facility.level,
      cost: calculateFacilityOperatingCost(facility.facilityType, facility.level),
      source: 'facility_operating_cost' as const,
    }))
    .filter((component) => component.cost > 0);

  const rosterCostPerAdditionalRobot = 500;
  if (robots.length > 1) {
    operatingCostComponents.push({
      facilityType: 'roster_expansion',
      level: 0,
      cost: (robots.length - 1) * rosterCostPerAdditionalRobot,
      source: 'roster_expansion',
    });
  }

  const operatingCosts = operatingCostComponents.reduce(
    (total, component) => total + component.cost,
    0,
  );
  const damagedRobots = robots.filter((robot) => robot.currentHP < robot.maxHP);

  return {
    merchandisingHubLevel,
    baseMerchandisingRate,
    prestige: user.prestige,
    rosterCapacity,
    prestigePerSlot,
    passiveIncome,
    operatingCosts,
    operatingCostComponents,
    robotCount: robots.length,
    rosterCostPerAdditionalRobot,
    totalBattles: robots.reduce((total, robot) => total + robot.totalBattles, 0),
    totalFame: robots.reduce((total, robot) => total + robot.fame, 0),
    repairQuoteTotal: damagedRobots.reduce(
      (total, robot) => total + (robot.repairQuoteCredits || 0),
      0,
    ),
    damagedRobotCount: damagedRobots.length,
  };
}

function toSettlementFinancialComponentResult(
  result: CreditMutationResult,
  financialEventId: string,
): SettlementFinancialComponentResult {
  return {
    financialEventId,
    amount: result.amount,
    created: result.created,
    balanceBefore: result.balanceBefore,
    balanceAfter: result.balanceAfter,
  };
}

function buildDailySummary(
  user: SettlementUser,
  facts: SettlementFacts,
  passiveResult: Pick<CreditMutationResult, 'balanceBefore' | 'balanceAfter'>,
  operatingResult: Pick<CreditMutationResult, 'balanceAfter'>,
): DailyFinancialSummary {
  const startingBalance = passiveResult.balanceBefore;
  const endingBalance = operatingResult.balanceAfter;
  const totalCosts = facts.operatingCosts;

  return {
    userId: user.id,
    username: user.username,
    startingBalance,
    operatingCosts: {
      total: totalCosts,
      breakdown: facts.operatingCostComponents.map((component) => ({
        facilityType: component.facilityType,
        facilityName: getFacilityName(component.facilityType),
        cost: component.cost,
        level: component.facilityType === 'roster_expansion' ? undefined : component.level,
      })),
    },
    repairCosts: {
      // This is the existing informational quote summary. It is never used as
      // a mutation source; Repair_Spend remains robot_repair audit rows.
      total: facts.repairQuoteTotal,
      robotsRepaired: 0,
    },
    totalCosts,
    endingBalance,
    balanceChange: endingBalance - startingBalance,
    isBankrupt: endingBalance <= 0,
    canAffordCosts: startingBalance >= totalCosts,
  };
}

async function loadSettlementUsers(
  options: SettlementOptions,
): Promise<SettlementUser[]> {
  const userWhere: Prisma.UserWhereInput = {};
  if (options.includeAdmins === false) {
    userWhere.role = { not: 'admin' };
  }
  if (options.userIds !== undefined) {
    userWhere.id = { in: [...options.userIds] };
  }

  // This is an ordered eligibility list only. Each stable's mutable inputs are
  // deliberately read after its balance row is locked in the short transaction.
  return prisma.user.findMany({
    where: userWhere,
    select: SETTLEMENT_USER_SELECT,
    orderBy: { id: 'asc' },
  });
}

interface ExistingSettlementLedger {
  financialEventId: string | null;
  amount: number;
  balanceAfter: number;
  metadata: unknown;
}

function existingSettlementComponent(
  financialEventId: string,
  ledger: ExistingSettlementLedger,
): SettlementFinancialComponentResult {
  return {
    financialEventId,
    amount: ledger.amount,
    created: false,
    balanceBefore: ledger.balanceAfter - ledger.amount,
    balanceAfter: ledger.balanceAfter,
  };
}

function buildExistingSettlementSummary(
  user: SettlementUser,
  passiveLedger: ExistingSettlementLedger,
  operatingLedger: ExistingSettlementLedger,
  passiveIncomeEventId: string,
  operatingCostsEventId: string,
): DailyFinancialSummary {
  if (
    !validateFinancialBreakdown(passiveLedger.metadata, 'passive_income')
    || !validateFinancialBreakdown(operatingLedger.metadata, 'operating_costs')
  ) {
    throw new Error(`Settlement components for user ${user.id} contain invalid financial breakdowns`);
  }

  const passiveBreakdown = passiveLedger.metadata as unknown as PassiveIncomeBreakdown;
  const operatingBreakdown = operatingLedger.metadata as unknown as OperatingCostsBreakdown;
  if (
    passiveBreakdown.sourceEventId !== passiveIncomeEventId
    || operatingBreakdown.sourceEventId !== operatingCostsEventId
    || passiveBreakdown.finalAmount !== passiveLedger.amount
    || operatingBreakdown.finalAmount !== operatingLedger.amount
  ) {
    throw new Error(`Settlement components for user ${user.id} do not match their ledger identities`);
  }

  const startingBalance = passiveLedger.balanceAfter - passiveLedger.amount;
  const endingBalance = operatingLedger.balanceAfter;
  const totalCosts = Math.abs(operatingLedger.amount);
  return {
    userId: user.id,
    username: user.username,
    startingBalance,
    operatingCosts: {
      total: totalCosts,
      breakdown: operatingBreakdown.costComponents.map((component) => ({
        facilityType: component.name,
        facilityName: getFacilityName(component.name),
        cost: component.amount,
      })),
    },
    // Repair quotes are deliberately not captured by either settlement
    // financial component, so an idempotent replay must not derive a historic
    // value from the robot's current forward-looking quote.
    repairCosts: { total: 0, robotsRepaired: 0 },
    totalCosts,
    endingBalance,
    balanceChange: endingBalance - startingBalance,
    isBankrupt: endingBalance <= 0,
    canAffordCosts: startingBalance >= totalCosts,
  };
}

/**
 * Settle one stable after locking its balance row and reading its current
 * inputs. Completed component identities are returned from the financial
 * ledger before mutable inputs can be recomputed, making a partially completed
 * cycle safely resumable even when the stable changes before the retry.
 */
async function settleStableInTransaction(
  tx: Prisma.TransactionClient,
  userId: number,
  cycleNumber: number,
): Promise<{
  component: SettlementComponentResult;
  summary: DailyFinancialSummary;
}> {
  await lockUserForSpending(tx, userId);

  const passiveIncomeEventId = buildSettlementEventId(userId, cycleNumber, 'passive_income');
  const operatingCostsEventId = buildSettlementEventId(userId, cycleNumber, 'operating_costs');
  const existingLedgers = await tx.financialLedger.findMany({
    where: {
      financialEventId: { in: [passiveIncomeEventId, operatingCostsEventId] },
    },
    select: {
      financialEventId: true,
      amount: true,
      balanceAfter: true,
      metadata: true,
    },
  });
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: SETTLEMENT_USER_SELECT,
  });
  if (!user) {
    throw new Error(`Settlement user ${userId} no longer exists`);
  }

  if (existingLedgers.length === 0) {
    const [facilities, robots] = await Promise.all([
      tx.facility.findMany({ where: { userId }, select: SETTLEMENT_FACILITY_SELECT }),
      tx.robot.findMany({ where: { userId }, select: SETTLEMENT_ROBOT_SELECT }),
    ]);
    const facts = calculateSettlementFacts(user, facilities, robots);
    return settleUserInTransaction(tx, user, facts, cycleNumber);
  }
  if (existingLedgers.length !== 2) {
    throw new Error(`Settlement components for user ${userId} and cycle ${cycleNumber} are incomplete`);
  }

  const passiveLedger = existingLedgers.find(
    (ledger) => ledger.financialEventId === passiveIncomeEventId,
  );
  const operatingLedger = existingLedgers.find(
    (ledger) => ledger.financialEventId === operatingCostsEventId,
  );
  if (!passiveLedger || !operatingLedger) {
    throw new Error(`Settlement components for user ${userId} and cycle ${cycleNumber} are invalid`);
  }

  const passiveIncome = existingSettlementComponent(passiveIncomeEventId, passiveLedger);
  const operatingCosts = existingSettlementComponent(operatingCostsEventId, operatingLedger);
  return {
    component: { userId, passiveIncome, operatingCosts },
    summary: buildExistingSettlementSummary(
      user,
      passiveLedger,
      operatingLedger,
      passiveIncomeEventId,
      operatingCostsEventId,
    ),
  };
}

async function settleUserInTransaction(
  tx: Prisma.TransactionClient,
  user: SettlementUser,
  facts: SettlementFacts,
  cycleNumber: number,
): Promise<{
  component: SettlementComponentResult;
  summary: DailyFinancialSummary;
}> {
  const passiveIncomeEventId = buildSettlementEventId(user.id, cycleNumber, 'passive_income');
  const operatingCostsEventId = buildSettlementEventId(user.id, cycleNumber, 'operating_costs');
  const operatingCostsAmount = facts.operatingCosts === 0 ? 0 : -facts.operatingCosts;

  const passiveBreakdown = buildPassiveIncomeBreakdown({
    sourceEventId: passiveIncomeEventId,
    amount: facts.passiveIncome,
    cycleNumber,
    merchandisingHubLevel: facts.merchandisingHubLevel,
    baseMerchandisingRate: facts.baseMerchandisingRate,
    prestige: facts.prestige,
    rosterCapacity: facts.rosterCapacity,
    prestigePerSlot: facts.prestigePerSlot,
  });
  const operatingBreakdown = buildOperatingCostsBreakdown({
    sourceEventId: operatingCostsEventId,
    amount: operatingCostsAmount,
    cycleNumber,
    costComponents: facts.operatingCostComponents.map((component) => ({
      name: component.facilityType,
      amount: component.cost,
      source: component.source,
    })),
    robotCount: facts.robotCount,
    rosterCostPerAdditionalRobot: facts.rosterCostPerAdditionalRobot,
  });

  // Credit_Mutation_Service takes the users row lock before any other mutable
  // state and re-checks the identity after locking. Keeping both components in
  // this stable-ordered outer transaction makes a partial component failure
  // roll back the complete stable/cycle settlement.
  const passiveResult = await creditMutationService.applyInTransaction(tx, {
    cycleNumber,
    userId: user.id,
    transactionType: 'passive_income',
    amount: facts.passiveIncome,
    description: `Settlement passive income for cycle ${cycleNumber}`,
    financialEventId: passiveIncomeEventId,
    breakdown: passiveBreakdown,
  });
  const operatingResult = await creditMutationService.applyInTransaction(tx, {
    cycleNumber,
    userId: user.id,
    transactionType: 'operating_costs',
    amount: operatingCostsAmount,
    description: `Settlement operating costs for cycle ${cycleNumber}`,
    financialEventId: operatingCostsEventId,
    breakdown: operatingBreakdown,
  });

  await eventLogger.logSettlementComponentInTransaction(tx, {
    cycleNumber,
    userId: user.id,
    componentType: 'passive_income',
    financialEventId: passiveIncomeEventId,
    payload: {
      merchandising: facts.passiveIncome,
      streaming: 0,
      totalIncome: facts.passiveIncome,
      facilityLevel: facts.merchandisingHubLevel,
      prestige: facts.prestige,
      rosterCapacity: facts.rosterCapacity,
      prestigePerSlot: Number(facts.prestigePerSlot.toFixed(2)),
      totalBattles: facts.totalBattles,
      totalFame: facts.totalFame,
    },
  });
  await eventLogger.logSettlementComponentInTransaction(tx, {
    cycleNumber,
    userId: user.id,
    componentType: 'operating_costs',
    financialEventId: operatingCostsEventId,
    payload: {
      costs: facts.operatingCostComponents.map((component) => ({
        facilityType: component.facilityType,
        level: component.level,
        cost: component.cost,
      })),
      totalCost: facts.operatingCosts,
    },
  });

  return {
    component: {
      userId: user.id,
      passiveIncome: toSettlementFinancialComponentResult(passiveResult, passiveIncomeEventId),
      operatingCosts: toSettlementFinancialComponentResult(operatingResult, operatingCostsEventId),
    },
    summary: buildDailySummary(user, facts, passiveResult, operatingResult),
  };
}

/**
 * The single mutating implementation for passive income and operating costs.
 *
 * A settlement run writes two deterministic component identities per selected
 * stable. Both zero amounts are still sent through the paired mutation path so
 * the ledger/audit rows record the completed calculation and unchanged balance.
 */
export async function settleCycle(options: SettlementOptions): Promise<SettlementResult> {
  if (!Number.isInteger(options.cycleNumber) || options.cycleNumber < 0) {
    throw new Error('Settlement cycleNumber must be a non-negative integer');
  }

  const users = await loadSettlementUsers(options);
  const summaries: DailyFinancialSummary[] = [];
  const components: SettlementComponentResult[] = [];
  let totalPassiveIncome = 0;
  let totalOperatingCosts = 0;

  if (users.length === 0) {
    return {
      cycleNumber: options.cycleNumber,
      usersProcessed: 0,
      totalPassiveIncome: 0,
      totalOperatingCosts: 0,
      bankruptUsers: 0,
      summaries,
      components,
    };
  }

  // A stable's two settlement components must commit together, but an
  // event-wide transaction holds the cycle audit-sequence lock and every prior
  // user row while the remaining stables are processed. Bound the transaction
  // to one stable so other cycle work can obtain the lock between settlements.
  // Each stable re-reads mutable inputs after its balance lock, and returns
  // completed component identities without recomputing their stored evidence.
  for (const user of users) {
    const settled = await prisma.$transaction(
      (tx) => settleStableInTransaction(tx, user.id, options.cycleNumber),
      { timeout: 30_000 },
    );
    summaries.push(settled.summary);
    components.push(settled.component);
    totalPassiveIncome += settled.component.passiveIncome.amount;
    totalOperatingCosts += Math.abs(settled.component.operatingCosts.amount);
  }

  return {
    cycleNumber: options.cycleNumber,
    usersProcessed: users.length,
    totalPassiveIncome,
    totalOperatingCosts,
    bankruptUsers: summaries.filter((summary) => summary.isBankrupt).length,
    summaries,
    components,
  };
}

/** Return the current cycle identity for an administrative compatibility call. */
export async function getCurrentSettlementCycleNumber(): Promise<number> {
  const cycleMetadata = await prisma.cycleMetadata.findUnique({
    where: { id: 1 },
    select: { totalCycles: true },
  });
  return cycleMetadata?.totalCycles ?? 0;
}

export class SettlementService {
  async settleCycle(options: SettlementOptions): Promise<SettlementResult> {
    return settleCycle(options);
  }

  async getCurrentSettlementCycleNumber(): Promise<number> {
    return getCurrentSettlementCycleNumber();
  }
}

export const settlementService = new SettlementService();
