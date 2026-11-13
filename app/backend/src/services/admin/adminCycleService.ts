/**
 * Admin bulk cycle executor: runs one or more complete game cycles on demand
 * (the admin "run cycles" action), sharing the scheduler's preparation and
 * settlement boundaries. The per-event blocks live in `adminCycleSteps`.
 *
 * @module services/admin/adminCycleService
 */

import { redealLeagueInstances } from '../league/leagueInstanceRedeal';
import { repairRobotsForEvent } from '../economy/repairService';
import { cleanupSeasonOrphans } from '../moderation/imageLibraryService';
import { EventLogger } from '../common/eventLogger';
import { cycleLogger } from '../../utils/cycleLogger';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { settlementService } from '../financial/settlementService';
import { logCycleEndBalances } from '../cycle/cycle-closing-evidence';
import {
  abortSerializedCycleCutover,
  beginSerializedCycleCutover,
  completeSerializedCycleCutover,
  getActiveFinancialCycleNumber,
  getSerializedCycleCutoverUserIdWatermark,
} from '../cycle/canonicalCycleIdentity';
import type { TurnStepOutcome } from '../automaton/automatonTurnService';
import {
  CycleStepRunner,
  executeTournamentStep,
  runAutomatonTurnStep,
  runGrandMeleeBlock,
  runKothBlock,
  runLeague1v1Block,
  runTagTeamBlock,
  runTeamLeagueBlock,
  runTeamTournamentBlock,
  runTournamentBlock,
  topUpGeneratedStablesForAdmin,
  type GrandMeleeBlockSummary,
  type TeamLeagueBlockResult,
  type TeamTournamentBlockResult,
} from './adminCycleSteps';

/** Options accepted by the bulk cycle executor (mirrors req.body fields). */
export interface BulkCycleOptions {
  cycles?: number;
  generateUsersPerCycle?: boolean;
  includeTournaments?: boolean;
  includeKoth?: boolean;
  includeDailyFinances?: boolean;
}

/** Per-cycle result entry. */
export interface CycleResult {
  cycle: number;
  // Event block results (slot map order)
  leagueBlock?: { battles: unknown; repair: unknown; rebalancing: unknown; matchmaking: unknown };
  team2v2LeagueBlock?: TeamLeagueBlockResult;
  tournamentBlock?: { repair: unknown; tournaments: unknown };
  tagTeamBlock?: { repair: unknown; battles: unknown; rebalancing: unknown; matchmaking: unknown };
  kothBlock?: { repair: unknown; battles: unknown; matchmaking: unknown };
  team3v3LeagueBlock?: TeamLeagueBlockResult;
  team2v2TournamentBlock?: TeamTournamentBlockResult;
  grandMeleeBlock?: GrandMeleeBlockSummary | { error: string };
  team3v3TournamentBlock?: TeamTournamentBlockResult;
  // Settlement results
  settlement?: {
    userGeneration: unknown;
    finances: unknown;
    cycleCounters: unknown;
    snapshot: unknown;
    orphanCleanup: unknown;
    endOfCycleBalances: unknown;
    /** Spec #55: the Automaton Turn_Step run after this cycle (summary or failure). */
    automatonTurns?: TurnStepOutcome;
  };
  // Reserved slots that fired this cycle
  reservedSlotsFired?: string[];
  duration: number;
  error?: string;
}

/** Aggregate result returned by executeBulkCycles. */
export interface BulkCycleResult {
  success: true;
  cyclesCompleted: number;
  totalCyclesInSystem: number;
  includeTournaments: boolean;
  includeKoth: boolean;
  includeDailyFinances: boolean;
  generateUsersPerCycleEnabled: boolean;
  totalDuration: number;
  averageCycleDuration: number;
  results: CycleResult[];
  timestamp: string;
}

/**
 * Execute one or more complete game cycles.
 *
 * Each cycle runs the full slot map in order. Every battle event is a
 * self-contained block (repair → execute → rebalance → matchmaking) mirroring
 * the production cron handlers. Reserved slots log a no-op message.
 *
 * Slot map order: 1v1 League → Team 2v2 League → 1v1 Tournament →
 * Tag Team → KotH → Team 3v3 League → Team 2v2 Tournament (stub) →
 * Grand Melee (stub) → Team 3v3 Tournament (stub) → Settlement.
 */
export async function executeBulkCycles(options: BulkCycleOptions): Promise<BulkCycleResult> {
  const {
    cycles = 1,
    generateUsersPerCycle = false,
    includeTournaments = true,
    includeKoth = true,
    includeDailyFinances = true,
  } = options;

  const maxCycles = 100;
  const cycleCount = cycles === 0 ? 0 : Math.min(Math.max(1, cycles), maxCycles);
  const eventLogger = new EventLogger();
  const startTime = Date.now();

  // Get or create cycle metadata (singleton pattern) — needed for both paths
  let cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  if (!cycleMetadata) {
    cycleMetadata = await prisma.cycleMetadata.create({
      data: { id: 1, totalCycles: 0 },
    });
  }

  const { getCurrentSeason, advancePreparationCycle } = await import('../season/seasonService');
  const seasonAtStart = await getCurrentSeason();
  if (seasonAtStart.phase === 'preparation') {
    // Manual execution shares the scheduler's preparation boundary: it moves
    // preparation state only and never runs matches, settlement, or cutover.
    const preparationResults: CycleResult[] = [];
    for (let i = 0; i < cycleCount; i += 1) {
      const cycleStart = Date.now();
      const advanced = await advancePreparationCycle();
      // As in scheduled settlement: the first preparation day rebuilds the
      // generated stables the rollover deleted.
      const userGeneration = generateUsersPerCycle ? await topUpGeneratedStablesForAdmin() : null;
      // Spec #55 R7.3: the preparation Automaton turn, as in scheduled settlement.
      const automatonTurns = await runAutomatonTurnStep({
        trigger: 'preparation',
        seasonNumber: advanced.seasonNumber,
        slot: advanced.preparationCyclesCompleted,
        source: 'admin_bulk',
      });
      // As in scheduled settlement: re-deal the league instances (issue #599).
      // Never throws; failures are logged per mode/tier.
      await redealLeagueInstances('[Admin] Preparation day');
      preparationResults.push({
        cycle: cycleMetadata.totalCycles + 1,
        reservedSlotsFired: [],
        duration: Date.now() - cycleStart,
        settlement: {
          userGeneration,
          finances: { skipped: true, reason: 'preparation_phase' },
          cycleCounters: { preparationCyclesCompleted: advanced.preparationCyclesCompleted },
          snapshot: null,
          orphanCleanup: null,
          endOfCycleBalances: null,
          automatonTurns,
        },
      });
    }
    const duration = Date.now() - startTime;
    return {
      success: true,
      cyclesCompleted: cycleCount,
      totalCyclesInSystem: cycleMetadata.totalCycles,
      includeTournaments: false,
      includeKoth: false,
      includeDailyFinances: false,
      generateUsersPerCycleEnabled: generateUsersPerCycle,
      totalDuration: duration,
      averageCycleDuration: cycleCount === 0 ? 0 : Math.round(duration / cycleCount),
      results: preparationResults,
      timestamp: new Date().toISOString(),
    };
  }

  // cycles=0 means "run only the tournament step without a full cycle"
  if (cycleCount === 0 && includeTournaments) {
    logger.info('[Admin] Running tournament-only execution (cycles=0)...');
    // executeTournamentStep() covers the 1v1 bracket only; the team brackets
    // have their own steps further down with their own scoped repair.
    await repairRobotsForEvent('tournament_1v1', true, cycleMetadata.totalCycles);
    const tournamentSummary = await executeTournamentStep();
    const duration = Date.now() - startTime;

    return {
      success: true as const,
      cyclesCompleted: 0,
      totalCyclesInSystem: cycleMetadata.totalCycles,
      includeTournaments: true,
      includeKoth: false,
      includeDailyFinances: false,
      generateUsersPerCycleEnabled: false,
      totalDuration: duration,
      averageCycleDuration: 0,
      results: [{ cycle: 0, tournamentBlock: { repair: null, tournaments: tournamentSummary }, duration }],
      timestamp: new Date().toISOString(),
    };
  }

  logger.info(`[Admin] Running ${cycleCount} bulk cycles (includeTournaments: ${includeTournaments}, generateUsersPerCycle: ${generateUsersPerCycle})...`);

  let currentCycleNumber = cycleMetadata.totalCycles + 1;
  const cycleResults: CycleResult[] = [];

  for (let i = 1; i <= cycleCount; i++) {
    const cycleStart = Date.now();
    // `totalCycles` is completed-only. Battle slots run on the active cycle
    // without pre-publishing completion to other financial writers.
    currentCycleNumber = await getActiveFinancialCycleNumber();
    let claimedClosingCycle: number | null = null;

    // Start cycle logging
    cycleLogger.startCycle(currentCycleNumber);
    cycleLogger.log('INFO', `Cycle ${currentCycleNumber} (${i}/${cycleCount})`);

    logger.info(`\n[Admin] === Cycle ${currentCycleNumber} (${i}/${cycleCount}) ===`);

    try {
      // Log cycle start. `totalCycles` remains unchanged until closing
      // evidence and snapshot creation have completed.
      await eventLogger.logCycleStart(currentCycleNumber, 'manual');

      const steps = new CycleStepRunner(eventLogger, currentCycleNumber);
      const reservedSlotsFired: string[] = [];

      const leagueBlock = await runLeague1v1Block(steps);
      const team2v2League = await runTeamLeagueBlock(steps, 2);
      const tournamentBlock = await runTournamentBlock(steps, includeTournaments);
      const tagTeamBlock = await runTagTeamBlock(steps);
      const kothBlock = await runKothBlock(steps, includeKoth);
      const team3v3League = await runTeamLeagueBlock(steps, 3);
      const team2v2TournamentResult = await runTeamTournamentBlock(steps, 2);
      const grandMeleeResult = await runGrandMeleeBlock(steps);
      const team3v3TournamentResult = await runTeamTournamentBlock(steps, 3);

      // ═══════════════════════════════════════════════════════════════════
      // SLOT 10: Settlement
      // (user gen → daily finances → cycle counters → snapshot →
      //  orphan cleanup → end-of-cycle balances)
      // ═══════════════════════════════════════════════════════════════════
      logger.info(`[Admin] Slot 10: Settlement`);

      // 10.1 Top up generated stables to GENERATED_STABLE_TARGET
      const userGenerationSummary = await steps.run(
        'Top up generated stables', 'auto_generate_users',
        async () => (generateUsersPerCycle ? topUpGeneratedStablesForAdmin() : null),
        (r) => ({ usersCreated: r && 'usersCreated' in r ? r.usersCreated : 0 }),
      );

      // 10.2 Calculate and Log Passive Income & Operating Costs
      const financesStep = steps.next('Calculate Passive Income & Operating Costs');
      const financesStart = Date.now();

      let totalPassiveIncome = 0;
      let totalOperatingCosts = 0;
      let financesUsersProcessed = 0;

      // Claim the active financial cycle before writing its settlement rows.
      // Full-cycle execution cannot omit settlement: zero-value component rows
      // are required closing evidence for a modern no-activity cycle.
      claimedClosingCycle = await beginSerializedCycleCutover();
      if (claimedClosingCycle !== currentCycleNumber) {
        throw new Error(`Canonical cycle identity changed during admin execution: expected ${currentCycleNumber}, got ${claimedClosingCycle}`);
      }
      const maximumUserId = await getSerializedCycleCutoverUserIdWatermark(
        claimedClosingCycle,
      );
      const settlementResult = await settlementService.settleCycle({
        cycleNumber: claimedClosingCycle,
        includeAdmins: true,
        maximumUserId: maximumUserId ?? undefined,
        resultMode: 'totals',
      });
      financesUsersProcessed = settlementResult.usersProcessed;
      totalPassiveIncome = settlementResult.totalPassiveIncome;
      totalOperatingCosts = settlementResult.totalOperatingCosts;

      logger.info(`[Admin] Passive income: ₡${totalPassiveIncome.toLocaleString()}, Operating costs: ₡${totalOperatingCosts.toLocaleString()}`);

      await steps.complete(financesStep, 'calculate_passive_income_and_costs', Date.now() - financesStart, {
        usersProcessed: financesUsersProcessed,
        totalPassiveIncome,
        totalOperatingCosts,
        skipped: false,
      });

      // 10.3 Log end-of-cycle balances before creating the completion proof.
      const endOfCycleUserCount = await steps.run(
        'Log End-of-Cycle Balances', 'log_end_of_cycle_balances',
        async () => {
          const usersLogged = await logCycleEndBalances(currentCycleNumber, maximumUserId);
          if (usersLogged !== financesUsersProcessed) {
            throw new Error(
              `Cycle ${currentCycleNumber} closing cohort changed: settled `
              + `${financesUsersProcessed}, captured ${usersLogged}`,
            );
          }
          return usersLogged;
        },
        (usersLogged) => ({ usersLogged }),
      );

      // 10.4 Write the final completion event and its snapshot. A snapshot
      // failure is a close failure, never a completed cycle without evidence.
      await steps.run('Create Cycle Snapshot', 'create_cycle_snapshot', async () => {
        await eventLogger.logCycleComplete(currentCycleNumber, Date.now() - cycleStart);
        const { cycleSnapshotService } = await import('../cycle/cycleSnapshotService');
        await cycleSnapshotService.createSnapshot(currentCycleNumber);
      }, () => ({}));
      const snapshotResult = { created: true };

      // 10.5 Advance the completed count last, then update non-financial tier
      // residency. This is the shared scheduled/admin cutover boundary.
      const closingCycle = claimedClosingCycle;
      await steps.run('Finalize Cycle Counters', 'increment_cycle_counters', async () => {
        await completeSerializedCycleCutover(closingCycle);
        claimedClosingCycle = null;
        await prisma.standing.updateMany({ where: {}, data: { cyclesInTier: { increment: 1 } } });
      }, () => ({}));

      // 10.5a Spec #55 R7.4: the settlement Automaton turn for the closed
      // cycle. Admin bulk cycles never advance the season counter, so the
      // season read at the start is still current. Non-fatal.
      const automatonTurns = await runAutomatonTurnStep({
        trigger: 'settlement',
        seasonNumber: seasonAtStart.seasonNumber,
        slot: currentCycleNumber,
        source: 'admin_bulk',
      });

      // 10.6 Orphan cleanup is operational maintenance, not closing evidence.
      let orphanResult = null;
      try {
        // Archive- and Image_Library-aware: retained images survive the sweep.
        orphanResult = await steps.run(
          'Orphan Image Cleanup', 'orphan_image_cleanup',
          () => cleanupSeasonOrphans(),
          (r) => ({ filesDeleted: r.filesDeleted, bytesReclaimed: r.bytesReclaimed }),
        );
      } catch (orphanError) {
        logger.error(`[Admin] Failed to run orphan image cleanup:`, orphanError);
      }

      // Display Cycle Summary
      logger.info(`[Admin] === Cycle ${currentCycleNumber} Summary ===`);
      logger.info(`[Admin] 1v1 League Battles: ${leagueBlock.battles.totalBattles}`);
      logger.info(`[Admin] Team 2v2 League Battles: ${team2v2League.battles?.matchesCompleted ?? 0}${'error' in team2v2League.block ? ' (ERROR)' : ''}`);
      logger.info(`[Admin] Tag Team Battles: ${tagTeamBlock.battles?.totalBattles || 0}`);
      if (kothBlock) {
        logger.info(`[Admin] KotH Battles: ${kothBlock.battles.totalMatches} (${kothBlock.battles.successfulMatches} successful, ${kothBlock.battles.failedMatches} failed)`);
      }
      logger.info(`[Admin] Team 3v3 League Battles: ${team3v3League.battles?.matchesCompleted ?? 0}${'error' in team3v3League.block ? ' (ERROR)' : ''}`);
      if (team2v2TournamentResult && 'matchesExecuted' in team2v2TournamentResult) {
        logger.info(`[Admin] Team 2v2 Tournament: ${team2v2TournamentResult.matchesExecuted} matches executed${team2v2TournamentResult.tournamentCreated ? ' (new tournament created)' : ''}${team2v2TournamentResult.skippedReason ? ` (skipped: ${team2v2TournamentResult.skippedReason})` : ''}`);
      }
      if (team3v3TournamentResult && 'matchesExecuted' in team3v3TournamentResult) {
        logger.info(`[Admin] Team 3v3 Tournament: ${team3v3TournamentResult.matchesExecuted} matches executed${team3v3TournamentResult.tournamentCreated ? ' (new tournament created)' : ''}${team3v3TournamentResult.skippedReason ? ` (skipped: ${team3v3TournamentResult.skippedReason})` : ''}`);
      }
      logger.info(`[Admin] Reserved slots fired: ${reservedSlotsFired.join(', ') || 'none'}`);
      logger.info(`[Admin] ===================================`);

      cycleResults.push({
        cycle: currentCycleNumber,
        leagueBlock,
        team2v2LeagueBlock: team2v2League.block,
        tournamentBlock,
        tagTeamBlock,
        kothBlock,
        team3v3LeagueBlock: team3v3League.block,
        team2v2TournamentBlock: team2v2TournamentResult,
        grandMeleeBlock: grandMeleeResult,
        team3v3TournamentBlock: team3v3TournamentResult,
        settlement: {
          userGeneration: userGenerationSummary,
          finances: { totalPassiveIncome, totalOperatingCosts, usersProcessed: financesUsersProcessed, skipped: false },
          cycleCounters: { updated: true },
          snapshot: snapshotResult,
          orphanCleanup: orphanResult,
          endOfCycleBalances: { usersLogged: endOfCycleUserCount },
          automatonTurns,
        },
        reservedSlotsFired,
        duration: Date.now() - cycleStart,
      });

      // End cycle logging
      cycleLogger.endCycle();
    } catch (error) {
      if (claimedClosingCycle !== null) {
        try {
          await abortSerializedCycleCutover(claimedClosingCycle);
        } catch (abortError) {
          logger.error(`[Admin] Failed to abort financial cutover for cycle ${claimedClosingCycle}:`, abortError);
        }
      }
      logger.error(`[Admin] Error in cycle ${currentCycleNumber}:`, error);
      cycleLogger.log('ERROR', `Cycle ${currentCycleNumber} failed`, { error: error instanceof Error ? error.message : String(error) });
      cycleLogger.endCycle();

      cycleResults.push({
        cycle: currentCycleNumber,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - cycleStart,
      });
    }
  }

  const totalDuration = Date.now() - startTime;

  return {
    success: true,
    cyclesCompleted: cycleCount,
    totalCyclesInSystem: currentCycleNumber,
    includeTournaments,
    includeKoth,
    includeDailyFinances,
    generateUsersPerCycleEnabled: generateUsersPerCycle,
    totalDuration,
    averageCycleDuration: Math.round(totalDuration / cycleCount),
    results: cycleResults,
    timestamp: new Date().toISOString(),
  };
}
