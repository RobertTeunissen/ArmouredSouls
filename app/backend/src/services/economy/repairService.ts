import prisma from '../../lib/prisma';
import { calculateAttributeSum } from '../../utils/robotCalculations';
import { calculateRepairQuote } from '../../shared/utils/repairCost';
import { recordLedgerEntry } from '../financial/recordLedgerEntry';
import { eventLogger } from '../common/eventLogger';
import logger from '../../config/logger';
import { resolveRobotIdsForEvent } from './repairScope';
import type { SubscribableEventType } from '../subscription/eventRegistry';



export interface RepairSummary {
  robotsRepaired: number;
  totalBaseCost: number;
  totalFinalCost: number;
  costsDeducted: boolean;
  userSummaries: Array<{
    userId: number;
    robotsRepaired: number;
    totalCost: number;
    repairBayDiscount: number;
  }>;
}

/**
 * Repair the robots queued for one battle type, before that battle type runs.
 *
 * This is the single pre-battle repair entry point for all nine battle types —
 * league 1v1/2v2/3v3, tag team, KotH, Grand Melee, and the three tournament
 * brackets. Every cron and the admin cycle runner call it with their own event
 * type; none of them repair the whole roster any more (issue #411).
 *
 * Robots with no match queued for this type are left damaged on purpose, so
 * their owner can still claim the 50% manual repair discount whenever they next
 * log in. Nothing is saved or lost overall: a robot that does fight is repaired
 * at the same full price as before, just not one it was never going to need.
 *
 * @param eventType - Battle type about to execute
 * @param deductCosts - Whether to deduct repair costs from user currency
 * @param cycleNumber - The current cycle number for logging (optional)
 * @returns Summary of repairs performed
 */
export async function repairRobotsForEvent(
  eventType: SubscribableEventType,
  deductCosts: boolean = true,
  cycleNumber?: number,
): Promise<RepairSummary> {
  const robotIds = await resolveRobotIdsForEvent(eventType);

  logger.info(
    `[RepairService] Pre-battle repair scoped to ${eventType}: ${robotIds.length} robot(s) with a queued match`,
  );

  return repairRobots(robotIds, deductCosts, cycleNumber);
}

/**
 * Repair every damaged robot in the game, ignoring what is scheduled.
 *
 * Retained for admin maintenance and the manual battle triggers, where the
 * operator explicitly wants the whole roster patched up. The daily crons use
 * {@link repairRobotsForEvent} instead.
 *
 * @param deductCosts - Whether to deduct repair costs from user currency
 * @param cycleNumber - The current cycle number for logging (optional, will query if not provided)
 * @returns Summary of repairs performed
 */
export async function repairAllRobots(deductCosts: boolean = true, cycleNumber?: number): Promise<RepairSummary> {
  return repairRobots(null, deductCosts, cycleNumber);
}

/**
 * Repair damaged robots, optionally restricted to a set of ids.
 *
 * Shared implementation behind both entry points, so the cost formula and the
 * Repair_Bay discount behave identically however repair was triggered:
 * base_repair = (sum_of_all_23_attributes × 100)
 * damage_percentage = damage_taken / max_hp
 * multiplier = 2.0 if HP=0, 1.5 if HP<10%, else 1.0
 * repair_cost = base_repair × damage_percentage × multiplier × (1 - repair_bay_discount)
 *
 * @param robotIds - Restrict to these robots, or null for every damaged robot
 * @param deductCosts - Whether to deduct repair costs from user currency
 * @param cycleNumber - The current cycle number for logging (optional)
 * @returns Summary of repairs performed
 */
async function repairRobots(
  robotIds: number[] | null,
  deductCosts: boolean = true,
  cycleNumber?: number,
): Promise<RepairSummary> {
  // An empty scope means nothing is queued for this battle type — skip the work
  // rather than issuing a query that would match every robot.
  if (robotIds !== null && robotIds.length === 0) {
    return {
      robotsRepaired: 0,
      totalBaseCost: 0,
      totalFinalCost: 0,
      costsDeducted: deductCosts,
      userSummaries: [],
    };
  }

  // Get all robots that need repair with all attributes for cost calculation
  const robots = await prisma.robot.findMany({
    where: {
      ...(robotIds !== null ? { id: { in: robotIds } } : {}),
      currentHP: {
        lt: prisma.robot.fields.maxHP,
      },
    },
  });

  if (robots.length === 0) {
    return {
      robotsRepaired: 0,
      totalBaseCost: 0,
      totalFinalCost: 0,
      costsDeducted: deductCosts,
      userSummaries: [],
    };
  }

  // Group robots by user to apply facility discounts
  const robotsByUser = new Map<number, typeof robots>();
  for (const robot of robots) {
    if (!robotsByUser.has(robot.userId)) {
      robotsByUser.set(robot.userId, []);
    }
    robotsByUser.get(robot.userId)!.push(robot);
  }

  // Batch-load all facilities and robot counts for all affected users (2 queries instead of 2N)
  //
  // Both queries filter on the user, never on the scoped robot ids: the
  // Repair_Bay discount is `repairBayLevel × (5 + activeRobotCount)` capped at
  // 90%, where activeRobotCount is the owner's whole roster. Narrowing either
  // query to the robots being repaired would shrink the discount for a scoped
  // repair, making the same robot cost more when repaired before its own match
  // than when repaired as part of a full sweep.
  const affectedUserIds = Array.from(robotsByUser.keys());
  const [allFacilities, robotCounts] = await Promise.all([
    prisma.facility.findMany({
      where: {
        userId: { in: affectedUserIds },
        facilityType: 'repair_bay',
      },
    }),
    prisma.robot.groupBy({
      by: ['userId'],
      where: {
        userId: { in: affectedUserIds },
      },
      _count: { id: true },
    }),
  ]);

  // Build lookup maps
  const facilitiesByUser = new Map<number, typeof allFacilities>();
  for (const f of allFacilities) {
    if (!facilitiesByUser.has(f.userId)) facilitiesByUser.set(f.userId, []);
    facilitiesByUser.get(f.userId)!.push(f);
  }
  const robotCountByUser = new Map(robotCounts.map(r => [r.userId, r._count.id]));

  let totalBaseCost = 0;
  let totalFinalCost = 0;
  const userSummaries: RepairSummary['userSummaries'] = [];

  // Collect all DB operations for batching
  const robotUpdates: ReturnType<typeof prisma.robot.update>[] = [];
  const userDeductions: ReturnType<typeof prisma.user.update>[] = [];
  /** Owner of each entry in `userDeductions`, same order. */
  const deductionUserIds: number[] = [];
  const repairEvents: Array<{
    userId: number;
    robotId: number;
    robotName: string;
    repairCost: number;
    damageTaken: number;
    repairBayDiscount: number;
  }> = [];

  for (const [userId, userRobots] of robotsByUser.entries()) {
    const facilities = facilitiesByUser.get(userId) || [];

    const repairBay = facilities.find(f => f.facilityType === 'repair_bay');
    
    const repairBayLevel = repairBay?.level || 0;
    const activeRobotCount = robotCountByUser.get(userId) || 0;
    
    // Calculate discount using new formula: repairBayLevel × (5 + activeRobotCount), capped at 90%
    const rawDiscount = repairBayLevel * (5 + activeRobotCount);
    const repairBayDiscount = Math.min(rawDiscount, 90);

    let userBaseCost = 0;
    let userFinalCost = 0;

    for (const robot of userRobots) {
      // Calculate sum of all 23 attributes
      const sumOfAllAttributes = calculateAttributeSum(robot);
      
      // Calculate damage percentage
      const damageTaken = robot.maxHP - robot.currentHP;
      const damagePercent = (damageTaken / robot.maxHP) * 100;
      
      // Calculate HP percentage for multiplier
      const hpPercent = (robot.currentHP / robot.maxHP) * 100;
      
      // The Repair_Quote — what this path charges. Spec #48 Requirement 15
      // criterion 7: pricing comes from the Shared_Repair_Module only.
      const repairCost = calculateRepairQuote(
        { attributeTotal: sumOfAllAttributes, damagePercent, hpPercent },
        { repairBayLevel, activeRobotCount },
      );

      // The same quote priced with no Repair Bay discount, for the reporting
      // figures below. Obtained from the same function rather than by repeating
      // the formula, so the two cannot drift.
      const baseCost = calculateRepairQuote(
        { attributeTotal: sumOfAllAttributes, damagePercent, hpPercent },
        { repairBayLevel: 0, activeRobotCount: 0 },
      );

      userBaseCost += baseCost;
      userFinalCost += repairCost;

      // Collect robot update for batching
      robotUpdates.push(prisma.robot.update({
        where: { id: robot.id },
        data: {
          currentHP: robot.maxHP,
          currentShield: robot.maxShield,
          repairQuoteCredits: 0,
          battleReadiness: 100,
          lifetimeRepairCreditsPaid: {
            increment: repairCost,
          },
        },
      }));

      // Collect repair event data for logging after transaction
      repairEvents.push({
        userId,
        robotId: robot.id,
        robotName: robot.name,
        repairCost,
        damageTaken,
        repairBayDiscount,
      });
    }

    totalBaseCost += userBaseCost;
    totalFinalCost += userFinalCost;

    // Collect user currency deduction for batching
    if (deductCosts && userFinalCost > 0) {
      userDeductions.push(prisma.user.update({
        where: { id: userId },
        data: {
          currency: {
            decrement: userFinalCost,
          },
        },
      }));
      // Parallel to `userDeductions`, so the transaction results below can be
      // mapped back to owners without a second query.
      deductionUserIds.push(userId);
    }

    userSummaries.push({
      userId,
      robotsRepaired: userRobots.length,
      totalCost: userFinalCost,
      repairBayDiscount,
    });
  }

  // Execute robot updates and user deductions in chunked transactions
  // to avoid exceeding Prisma's interactive transaction timeout on large rosters.
  const CHUNK_SIZE = 200;
  for (let i = 0; i < robotUpdates.length; i += CHUNK_SIZE) {
    const chunk = robotUpdates.slice(i, i + CHUNK_SIZE);
    await prisma.$transaction(chunk, { timeout: 30000 });
  }
  // Post-deduction balance per owner, taken from the update results themselves so
  // the ledger writes below need no extra query. A mocked or non-returning
  // transaction simply yields an empty map, and the ledger step skips those owners.
  const postDeductionBalance = new Map<number, number>();
  for (let i = 0; i < userDeductions.length; i += CHUNK_SIZE) {
    const chunk = userDeductions.slice(i, i + CHUNK_SIZE);
    const updated = await prisma.$transaction(chunk, { timeout: 30000 });
    if (Array.isArray(updated)) {
      updated.forEach((row, offset) => {
        const userId = deductionUserIds[i + offset];
        const currency = (row as { currency?: number } | undefined)?.currency;
        if (userId !== undefined && typeof currency === 'number') {
          postDeductionBalance.set(userId, currency);
        }
      });
    }
  }

  // Log repair events sequentially (audit trail, non-critical)
  for (const event of repairEvents) {
    try {
      await eventLogger.logRobotRepair(
        event.userId,
        event.robotId,
        event.repairCost,
        event.damageTaken,
        event.repairBayDiscount,
        cycleNumber,
        'automatic'
      );
      
      logger.info(`[RepairService] | User ${event.userId} | Robot ${event.robotId} (${event.robotName}) | Cost: ₡${event.repairCost.toLocaleString()} | Discount: ${event.repairBayDiscount}%`);
    } catch (logError) {
      logger.error(`[RepairService] | ERROR | User ${event.userId} | Robot ${event.robotId} | Failed to log repair event:`, logError instanceof Error ? logError.message : logError);
    }
  }

  // Spec #48 Requirement 16: one Repair_Ledger_Entry per robot, matching the
  // granularity of the audit rows above so the two reconcile one-to-one.
  //
  // Skipped entirely when `deductCosts` is false: that mode moves no credits, so an
  // entry would record a charge that never happened and a `balanceAfter` with no
  // meaning (criterion 2's balance has nothing to refer to).
  //
  // `balanceAfter` is walked backwards from each user's committed post-deduction
  // balance because the deduction is one decrement per user, not per robot — the
  // per-robot balance is derived, never observed.
  if (deductCosts) {
    await writeAutomaticRepairLedgerEntries(repairEvents, postDeductionBalance, cycleNumber);
  }

  return {
    robotsRepaired: robots.length,
    totalBaseCost,
    totalFinalCost,
    costsDeducted: deductCosts,
    userSummaries,
  };
}

/**
 * Write one Repair_Ledger_Entry per repaired robot on the Automatic_Repair_Path.
 *
 * Spec #48 Requirement 16 criteria 2, 3 and 6.
 *
 * Both repair paths deduct once per user rather than once per robot, so a
 * per-robot `balanceAfter` is not something the database ever saw. It is derived:
 * take each owner's committed post-deduction balance — returned by the `user.update`
 * inside the deduction transaction, so no extra query is needed — then walk
 * backwards through that owner's repair events, emitting last-robot-first so each
 * entry's `balanceAfter` is the balance immediately after that robot's share was
 * taken.
 *
 * An owner absent from `postDeductionBalance` is skipped rather than guessed at.
 *
 * `recordLedgerEntry` swallows its own failures, so a ledger problem cannot affect
 * a repair that has already been charged (criterion 5). While
 * `financial_ledger_active` is false, `financialService.recordTransaction` returns
 * null and no row is persisted (criterion 7) — this is consistency work that makes
 * the ledger correct whenever it is switched on, not a visible feature.
 */
async function writeAutomaticRepairLedgerEntries(
  repairEvents: Array<{ userId: number; robotId: number; repairCost: number }>,
  postDeductionBalance: Map<number, number>,
  cycleNumber?: number,
): Promise<void> {
  if (repairEvents.length === 0) return;

  const eventsByUser = new Map<number, Array<{ robotId: number; repairCost: number }>>();
  for (const event of repairEvents) {
    const existing = eventsByUser.get(event.userId);
    if (existing) existing.push({ robotId: event.robotId, repairCost: event.repairCost });
    else eventsByUser.set(event.userId, [{ robotId: event.robotId, repairCost: event.repairCost }]);
  }

  for (const [userId, events] of eventsByUser) {
    let runningBalance = postDeductionBalance.get(userId);
    if (runningBalance === undefined) continue;

    for (const event of [...events].reverse()) {
      if (event.repairCost <= 0) continue;

      await recordLedgerEntry({
        userId,
        robotId: event.robotId,
        transactionType: 'repair_cost',
        amount: -event.repairCost,
        balanceAfter: runningBalance,
        description: 'Automatic pre-battle repair of 1 robot',
        metadata: { repairType: 'automatic', robotCount: 1, cycleNumber },
      });

      runningBalance += event.repairCost;
    }
  }
}
