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
  passiveResult: CreditMutationResult,
  operatingResult: CreditMutationResult,
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
): Promise<{
  users: SettlementUser[];
  facilitiesByUser: Map<number, SettlementFacility[]>;
  robotsByUser: Map<number, SettlementRobot[]>;
}> {
  const userWhere: Prisma.UserWhereInput = {};
  if (options.includeAdmins === false) {
    userWhere.role = { not: 'admin' };
  }
  if (options.userIds !== undefined) {
    userWhere.id = { in: [...options.userIds] };
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    select: SETTLEMENT_USER_SELECT,
    orderBy: { id: 'asc' },
  });
  if (users.length === 0) {
    return {
      users,
      facilitiesByUser: new Map(),
      robotsByUser: new Map(),
    };
  }

  const userIds = users.map((user) => user.id);
  const [facilities, robots] = await Promise.all([
    prisma.facility.findMany({
      where: { userId: { in: userIds } },
      select: SETTLEMENT_FACILITY_SELECT,
    }),
    prisma.robot.findMany({
      where: { userId: { in: userIds } },
      select: SETTLEMENT_ROBOT_SELECT,
    }),
  ]);

  const facilitiesByUser = new Map<number, SettlementFacility[]>();
  for (const facility of facilities) {
    const current = facilitiesByUser.get(facility.userId) ?? [];
    current.push(facility);
    facilitiesByUser.set(facility.userId, current);
  }

  const robotsByUser = new Map<number, SettlementRobot[]>();
  for (const robot of robots) {
    const current = robotsByUser.get(robot.userId) ?? [];
    current.push(robot);
    robotsByUser.set(robot.userId, current);
  }

  return { users, facilitiesByUser, robotsByUser };
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

  const { users, facilitiesByUser, robotsByUser } = await loadSettlementUsers(options);
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

  await prisma.$transaction(async (tx) => {
    for (const user of users) {
      const facts = calculateSettlementFacts(
        user,
        facilitiesByUser.get(user.id) ?? [],
        robotsByUser.get(user.id) ?? [],
      );
      const settled = await settleUserInTransaction(tx, user, facts, options.cycleNumber);
      summaries.push(settled.summary);
      components.push(settled.component);
      totalPassiveIncome += settled.component.passiveIncome.amount;
      totalOperatingCosts += Math.abs(settled.component.operatingCosts.amount);
    }
  }, { timeout: 30000 });

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
