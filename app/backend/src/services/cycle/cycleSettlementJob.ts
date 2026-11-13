/**
 * Scheduled settlement job: closes the active financial cycle (daily
 * finances, closing evidence, snapshot, cutover), then runs the non-fatal
 * end-of-cycle maintenance (generated stable top-up, Automaton turns, league
 * instance re-deal). Also advances a Preparation_Phase day.
 *
 * @module services/cycle/cycleSettlementJob
 */

import logger from '../../config/logger';
import prisma from '../../lib/prisma';
import { EventLogger } from '../common/eventLogger';
import { JobContext } from '../notifications/integration';
import { settlementService } from '../financial/settlementService';
import { formatProcessMemoryUsage } from '../../utils/process-memory';
import {
  abortSerializedCycleCutover,
  beginSerializedCycleCutover,
  completeSerializedCycleCutover,
  getSerializedCycleCutoverUserIdWatermark,
} from './canonicalCycleIdentity';
import { logCycleEndBalances } from './cycle-closing-evidence';
import type { TurnStepInput } from '../automaton/automatonTurnService';

const eventLogger = new EventLogger();

export async function executeSettlement(): Promise<JobContext> {
  const settlementStart = Date.now();

  // Spec #45 R2.1: read the season phase before any other step.
  //
  // During a Preparation_Phase the settlement performs phase advancement only
  // and returns before step 1. Gating by early return rather than by
  // per-step conditionals is deliberate: R2.4 lists every side-effecting step,
  // so an early return cannot drift out of sync as steps are added.
  const { getCurrentSeason, advancePreparationCycle, advanceCompetitiveCycle } =
    await import('../season/seasonService');
  const seasonAtStart = await getCurrentSeason();

  if (seasonAtStart.phase === 'preparation') {
    const advanced = await advancePreparationCycle();
    logger.info(
      `Daily Settlement: preparation day ${advanced.preparationCyclesCompleted} complete — ` +
      `${advanced.remainingPreparationCycles} preparation cycle(s) remaining` +
      (advanced.transitionedToCompetitive
        ? ` — Season ${advanced.seasonNumber} now competitive`
        : ''),
    );
    // The rollover deleted every generated stable: rebuild the population now,
    // before competitive cycle 1 creates the first tournaments. Non-fatal.
    await topUpGeneratedStablesStep('Daily Settlement (preparation)');
    // Spec #55 R7.3: Automaton turns for this preparation day. Non-fatal.
    await runAutomatonTurnStep({
      trigger: 'preparation',
      seasonNumber: advanced.seasonNumber,
      slot: advanced.preparationCyclesCompleted,
      source: 'scheduler',
    });
    // Battle events (and their nightly rebalance) are suspended, so re-deal the
    // league instances here: robots and teams entered since the last re-deal
    // all joined the least-full instance (issue #599). Never throws.
    await redealLeagueInstancesStep('Daily Settlement (preparation)');
    // Global_Cycle_Counter deliberately untouched (R2.6).
    return { jobName: 'settlement' };
  }

  // Claim the active cycle once all in-flight financial writers have committed.
  // From this point, non-settlement writers fail closed rather than attaching
  // money to balances already captured for this closing cycle.
  const closingCycle = await beginSerializedCycleCutover({ resumeExisting: true });
  let totalPassiveIncome: number;
  let totalOperatingCosts: number;
  let endOfCycleUserCount: number;

  try {
    const maximumUserId = await getSerializedCycleCutoverUserIdWatermark(closingCycle);
    await eventLogger.logCycleStart(closingCycle, 'scheduled');

    // Settlement owns the two zero-capable financial component rows and is the
    // sole writer allowed to retain the claimed closing identity.
    logger.info(`Daily Settlement: Processing passive income and operating costs — ${formatProcessMemoryUsage()}`);
    const settlementResult = await settlementService.settleCycle({
      cycleNumber: closingCycle,
      includeAdmins: true,
      maximumUserId: maximumUserId ?? undefined,
      resultMode: 'totals',
    });
    totalPassiveIncome = settlementResult.totalPassiveIncome;
    totalOperatingCosts = settlementResult.totalOperatingCosts;
    logger.info(`Daily Settlement: Passive income credited — ₡${totalPassiveIncome.toLocaleString()}`);
    logger.info(`Daily Settlement: Operating costs debited — ₡${totalOperatingCosts.toLocaleString()}`);

    // Capture every closing balance before publishing a completed cycle. The
    // helper pages users and audit batches so no full stable list is retained.
    logger.info(`Daily Settlement: Logging end-of-cycle balances — ${formatProcessMemoryUsage()}`);
    endOfCycleUserCount = await logCycleEndBalances(closingCycle, maximumUserId);
    if (endOfCycleUserCount !== settlementResult.usersProcessed) {
      throw new Error(
        `Cycle ${closingCycle} closing cohort changed: settled `
        + `${settlementResult.usersProcessed}, captured ${endOfCycleUserCount}`,
      );
    }

    // The complete marker is evidence consumed by the snapshot service.
    await eventLogger.logCycleComplete(closingCycle, Date.now() - settlementStart);
    const { cycleSnapshotService } = await import('./cycleSnapshotService');
    logger.info(`Daily Settlement: Creating cycle snapshot — ${formatProcessMemoryUsage()}`);
    await cycleSnapshotService.createSnapshot(closingCycle);

    // Completed count is deliberately the final close-evidence mutation.
    await completeSerializedCycleCutover(closingCycle);
  } catch (error) {
    await abortSerializedCycleCutover(closingCycle);
    throw error;
  }

  // Increment tier residency only after the financial cycle is complete.
  await prisma.standing.updateMany({ where: {}, data: { cyclesInTier: { increment: 1 } } });
  logger.info(`Daily Settlement: Cycle ${closingCycle} closed with ${endOfCycleUserCount} balances captured`);

  // Settlement achievements after closure: bankruptcy (E17), and since Season 2
  // repair spend, merchandising income, balance recovery and the unlock count.
  // Human and Automaton stables are checked every settlement; Generated stables
  // only when bankrupt, as before (they are deleted at rollover). Achievement
  // failures remain isolated from the completed financial evidence and resolve
  // to the newly active cycle.
  try {
    const { achievementService } = await import('../achievement');
    const settlementUsers = await prisma.user.findMany({
      where: { OR: [{ currency: { lt: 0 } }, { stableType: { not: 'generated' } }] },
      select: { id: true, currency: true },
    });
    for (const user of settlementUsers) {
      try {
        await achievementService.checkAndAward(user.id, null, { type: 'daily_finances', data: { bankrupt: user.currency < 0 } });
      } catch (error) {
        logger.error(`[Settlement] Achievement check failed for user ${user.id}: ${error}`);
      }
    }
  } catch (error) {
    logger.error(`[Settlement] Settlement achievement check failed: ${error}`);
  }

  // (Step 6, the Practice Arena counter flush, is gone: usage is recorded per
  // request in practice_arena_events.)

  // Step 7: Top up the generated stables to their target (normally nothing to
  // do: the first preparation day after a rollover built them).
  logger.info('Daily Settlement: Step 7 — Topping up generated stables');
  await topUpGeneratedStablesStep('Daily Settlement');

  logger.info(`Daily Settlement: Completed — passive income ₡${totalPassiveIncome.toLocaleString()}, operating costs ₡${totalOperatingCosts.toLocaleString()}, ${endOfCycleUserCount} users processed`);

  // Refresh achievement rarity cache after settlement
  try {
    const { achievementService } = await import('../achievement');
    await achievementService.refreshRarityCache();
    logger.info('Daily Settlement: Achievement rarity cache refreshed');
  } catch (err) {
    logger.error(`Daily Settlement: Failed to refresh achievement rarity cache — ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 8: Refresh leaderboard cache (Spec #40)
  // Runs after all battle results and standings updates are complete
  try {
    const { leaderboardService } = await import('../leaderboard/leaderboardService');
    await leaderboardService.refreshAll();
    logger.info('Daily Settlement: Leaderboard cache refreshed');
  } catch (err) {
    logger.error(`Daily Settlement: Failed to refresh leaderboard cache — ${err instanceof Error ? err.message : String(err)}`);
  }

  // Admin dashboard trend data: human-player activity counts for the closed
  // cycle. Non-fatal by construction (the helper logs and swallows its errors);
  // the import is guarded too so a module-load failure cannot fail settlement.
  try {
    const { recordKpiSnapshotNonFatal } = await import('../admin/adminKpiSnapshotService');
    await recordKpiSnapshotNonFatal(seasonAtStart.seasonNumber, closingCycle);
  } catch (err) {
    logger.error(`Daily Settlement: Failed to record admin KPI snapshot — ${err instanceof Error ? err.message : String(err)}`);
  }

  // Spec #45 R2.2/R2.3: advance the season counter, then roll over if the
  // season has reached its length. The rollover runs AFTER every settlement
  // step above, so the final cycle of a season settles normally before
  // anything is archived or purged. Season_Zero never reports a boundary.
  const advanced = await advanceCompetitiveCycle();
  logger.info(
    `Daily Settlement: Season ${advanced.seasonNumber} cycle ${advanced.competitiveCyclesCompleted} complete`,
  );

  if (advanced.boundaryReached) {
    logger.info(
      `Daily Settlement: Season ${advanced.seasonNumber} reached its length — starting rollover`,
    );
    try {
      const { executeSeasonRollover } = await import('../season/seasonRolloverService');
      await executeSeasonRollover({ trigger: 'settlement' });
    } catch (rolloverError) {
      logger.error(
        `Daily Settlement: Season rollover failed — ${rolloverError instanceof Error ? rolloverError.stack || rolloverError.message : String(rolloverError)}`,
      );
      throw rolloverError;
    }
  } else {
    // Spec #55 R7.1/R7.2: Automaton turns run as the last step of settlement,
    // after the close, and never on the boundary cycle (the rollover's
    // Stage 5 gives them their `season_open` turn instead). Non-fatal.
    await runAutomatonTurnStep({
      trigger: 'settlement',
      seasonNumber: advanced.seasonNumber,
      slot: closingCycle,
      source: 'scheduler',
    });
  }

  return { jobName: 'settlement', cycleNumber: closingCycle };
}

/**
 * Top up the generated stables to `GENERATED_STABLE_TARGET`. Non-fatal: a
 * failure is logged and settlement continues (the next settlement retries).
 */
async function topUpGeneratedStablesStep(label: string): Promise<void> {
  try {
    const { topUpGeneratedStables } = await import('../../utils/userGeneration');
    const summary = await topUpGeneratedStables();
    logger.info(
      `${label}: generated stables ${summary.existingBefore} → ${summary.existingBefore + summary.usersCreated} ` +
      `(target ${summary.target}; created ${summary.usersCreated} stables, ${summary.robotsCreated} robots)`,
    );
  } catch (error) {
    logger.error(`${label}: Failed to top up generated stables — ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Run an Automaton Turn_Step without ever failing settlement (Spec #55 R7.8):
 * `runTurnStepNonFatal` logs and alerts its own failures; this guard also
 * covers the module load.
 */
async function runAutomatonTurnStep(input: TurnStepInput): Promise<void> {
  try {
    const { runTurnStepNonFatal } = await import('../automaton');
    await runTurnStepNonFatal(input);
  } catch (error) {
    logger.error(`Daily Settlement: Automaton Turn_Step failed (non-fatal) — ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Re-deal every tiered league's instances without ever failing settlement:
 * `redealLeagueInstances` logs per-tier failures itself; this guard also
 * covers the module load.
 */
async function redealLeagueInstancesStep(label: string): Promise<void> {
  try {
    const { redealLeagueInstances } = await import('../league/leagueInstanceRedeal');
    await redealLeagueInstances(label);
  } catch (error) {
    logger.error(`${label}: league instance re-deal failed (non-fatal) — ${error instanceof Error ? error.message : String(error)}`);
  }
}

