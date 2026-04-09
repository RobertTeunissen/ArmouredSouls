import { executeScheduledBattles } from '../league/leagueBattleOrchestrator';
import { executeScheduledKothBattles } from '../koth/kothBattleOrchestrator';
import { runMatchmaking } from '../analytics/matchmakingService';
import { runKothMatchmaking } from '../koth/kothMatchmakingService';
import { rebalanceLeagues } from '../league/leagueRebalancingService';
import { rebalanceTagTeamLeagues } from '../tag-team/tagTeamLeagueRebalancingService';
import { runTagTeamMatchmaking } from '../tag-team/tagTeamMatchmakingService';
import { executeScheduledTagTeamBattles } from '../tag-team/tagTeamBattleOrchestrator';
import { generateBattleReadyUsers } from '../../utils/userGeneration';
import { repairAllRobots } from '../economy/repairService';
import {
  getActiveTournaments,
  getCurrentRoundMatches,
  autoCreateNextTournament,
  advanceWinnersToNextRound,
} from '../tournament/tournamentService';
import { processTournamentBattle } from '../tournament/tournamentBattleOrchestrator';
import { EventLogger } from '../common/eventLogger';
import { cycleLogger } from '../../utils/cycleLogger';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';

/** Options accepted by the bulk cycle executor (mirrors req.body fields). */
export interface BulkCycleOptions {
  cycles?: number;
  generateUsersPerCycle?: boolean;
  includeTournaments?: boolean;
  includeKoth?: boolean;
}

/** Per-cycle result entry. */
export interface CycleResult {
  cycle: number;
  battles?: unknown;
  repair1?: unknown;
  tagTeamBattles?: unknown;
  repair2?: unknown;
  kothBattles?: unknown;
  repairPostKoth?: unknown;
  kothMatchmaking?: unknown;
  tournaments?: unknown;
  repair3?: unknown;
  rebalancing?: unknown;
  tagTeamRebalancing?: unknown;
  userGeneration?: unknown;
  matchmaking?: unknown;
  tagTeamMatchmaking?: unknown;
  totalStreamingRevenue?: number;
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
  generateUsersPerCycleEnabled: boolean;
  totalDuration: number;
  averageCycleDuration: number;
  results: CycleResult[];
  timestamp: string;
}

/**
 * Execute one or more complete game cycles.
 *
 * Each cycle runs the full orchestration pipeline: league battles → repairs →
 * tag-team battles → KotH → tournaments → rebalancing → user generation →
 * matchmaking → finances → snapshots.
 */
export async function executeBulkCycles(options: BulkCycleOptions): Promise<BulkCycleResult> {
  const {
    cycles = 1,
    generateUsersPerCycle = false,
    includeTournaments = true,
    includeKoth = true,
  } = options;

  const maxCycles = 100;
  const cycleCount = Math.min(Math.max(1, cycles), maxCycles);
  const eventLogger = new EventLogger();

  logger.info(`[Admin] Running ${cycleCount} bulk cycles (includeTournaments: ${includeTournaments}, generateUsersPerCycle: ${generateUsersPerCycle})...`);

  // Get or create cycle metadata (singleton pattern)
  let cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  if (!cycleMetadata) {
    cycleMetadata = await prisma.cycleMetadata.create({
      data: { id: 1, totalCycles: 0 },
    });
  }

  let currentCycleNumber = cycleMetadata.totalCycles;
  const cycleResults: CycleResult[] = [];
  const startTime = Date.now();

  for (let i = 1; i <= cycleCount; i++) {
    const cycleStart = Date.now();
    currentCycleNumber++;

    // Start cycle logging
    cycleLogger.startCycle(currentCycleNumber);
    cycleLogger.log('INFO', `Cycle ${currentCycleNumber} (${i}/${cycleCount})`);

    logger.info(`\n[Admin] === Cycle ${currentCycleNumber} (${i}/${cycleCount}) ===`);

    try {
      // Advance cycle number in DB so getCurrentCycleNumber() returns the
      // correct value when called by battle orchestrators during this cycle.
      await prisma.cycleMetadata.update({
        where: { id: 1 },
        data: { totalCycles: currentCycleNumber },
      });

      // Log cycle start
      await eventLogger.logCycleStart(currentCycleNumber, 'manual');

      // Step 1: Execute League Battles (1v1)
      logger.info(`[Admin] Step 1: Execute League Battles (1v1)`);
      const step1Start = Date.now();
      const battleSummary = await executeScheduledBattles(new Date());
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'execute_league_battles',
        1,
        Date.now() - step1Start,
        { battlesExecuted: battleSummary.totalBattles }
      );

      // Step 2: Repair All Robots (post-league)
      logger.info(`[Admin] Step 2: Repair All Robots (post-league)`);
      const step2Start = Date.now();
      const repair1Summary = await repairAllRobots(true, currentCycleNumber);
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'repair_post_league',
        2,
        Date.now() - step2Start,
        { robotsRepaired: repair1Summary.robotsRepaired, totalCost: repair1Summary.totalFinalCost }
      );

      // Step 3: Execute Tag Team Battles (odd cycles only)
      let tagTeamBattleSummary = null;
      const shouldRunTagTeam = currentCycleNumber % 2 === 1;
      if (shouldRunTagTeam) {
        logger.info(`[Admin] Step 3: Execute Tag Team Battles (Cycle ${currentCycleNumber})`);
        const step3Start = Date.now();
        tagTeamBattleSummary = await executeScheduledTagTeamBattles(new Date());
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'execute_tag_team_battles',
          3,
          Date.now() - step3Start,
          { battlesExecuted: tagTeamBattleSummary?.totalBattles || 0 }
        );
      } else {
        logger.info(`[Admin] Step 3: Skipping Tag Team Battles (even cycle ${currentCycleNumber})`);
      }

      // Step 4: Repair All Robots (post-tag-team)
      logger.info(`[Admin] Step 4: Repair All Robots (post-tag-team)`);
      const step4Start = Date.now();
      const repair2Summary = await repairAllRobots(true, currentCycleNumber);
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'repair_post_tag_team',
        4,
        Date.now() - step4Start,
        { robotsRepaired: repair2Summary.robotsRepaired, totalCost: repair2Summary.totalFinalCost }
      );

      // Step 4.5: Execute Scheduled KotH Battles
      const simulatedDayOfWeek = ((currentCycleNumber - 1) % 7) + 1;
      const isKothDay = simulatedDayOfWeek === 1 || simulatedDayOfWeek === 3 || simulatedDayOfWeek === 5;
      let kothBattleSummary = null;
      if (includeKoth && isKothDay) {
        logger.info(`[Admin] Step 4.5: Execute Scheduled KotH Battles (simulated day ${simulatedDayOfWeek})`);
        const step4_5Start = Date.now();
        kothBattleSummary = await executeScheduledKothBattles(new Date());
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'execute_koth_battles',
          4.5,
          Date.now() - step4_5Start,
          { battlesExecuted: kothBattleSummary.totalMatches }
        );
      } else if (includeKoth && !isKothDay) {
        logger.info(`[Admin] Step 4.5: Skipping KotH Battles (not a KotH day, simulated day ${simulatedDayOfWeek})`);
      } else {
        logger.info(`[Admin] Step 4.5: Skipping KotH Battles (includeKoth=false)`);
      }

      // Step 4.6: Repair All Robots (post-KotH)
      let repairKothSummary = null;
      if (includeKoth && kothBattleSummary && kothBattleSummary.totalMatches > 0) {
        logger.info(`[Admin] Step 4.6: Repair All Robots (post-KotH)`);
        const step4_6Start = Date.now();
        repairKothSummary = await repairAllRobots(true, currentCycleNumber);
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'repair_post_koth',
          4.6,
          Date.now() - step4_6Start,
          { robotsRepaired: repairKothSummary.robotsRepaired, totalCost: repairKothSummary.totalFinalCost }
        );
      }

      // Step 4.7: KotH Matchmaking (only on KotH days)
      let kothMatchmakingSummary = null;
      if (includeKoth && isKothDay) {
        logger.info(`[Admin] Step 4.7: KotH Matchmaking (simulated day ${simulatedDayOfWeek})`);
        const step4_7Start = Date.now();
        const kothScheduledFor = new Date();
        kothScheduledFor.setUTCHours(16, 0, 0, 0);
        const jsDayOfWeek = (simulatedDayOfWeek as number) === 7 ? 0 : simulatedDayOfWeek;
        const currentJsDay = kothScheduledFor.getUTCDay();
        let daysUntil = jsDayOfWeek - currentJsDay;
        if (daysUntil <= 0) daysUntil += 7;
        kothScheduledFor.setUTCDate(kothScheduledFor.getUTCDate() + daysUntil);
        const kothMatchesCreated = await runKothMatchmaking(kothScheduledFor);
        kothMatchmakingSummary = { matchesCreated: kothMatchesCreated };
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'matchmaking_koth',
          4.7,
          Date.now() - step4_7Start,
          { matchesCreated: kothMatchesCreated }
        );
      } else if (includeKoth && !isKothDay) {
        logger.info(`[Admin] Step 4.7: Skipping KotH Matchmaking (not a KotH day, simulated day ${simulatedDayOfWeek})`);
      } else {
        logger.info(`[Admin] Step 4.7: Skipping KotH Matchmaking (includeKoth=false)`);
      }

      // Step 5: Tournament Execution / Scheduling
      logger.info(`[Admin] Step 5: Tournament Execution / Scheduling`);
      const step5Start = Date.now();
      let tournamentSummary = null;
      if (includeTournaments) {
        try {
          tournamentSummary = {
            tournamentsExecuted: 0,
            roundsExecuted: 0,
            matchesExecuted: 0,
            tournamentsCompleted: 0,
            tournamentsCreated: 0,
            errors: [] as string[],
          };

          const activeTournaments = await getActiveTournaments();

          for (const tournament of activeTournaments) {
            try {
              const currentRoundMatches = await getCurrentRoundMatches(tournament.id);

              if (currentRoundMatches.length > 0) {
                for (const match of currentRoundMatches) {
                  if (match.robot1Id && !match.robot2Id) {
                    await prisma.scheduledTournamentMatch.update({
                      where: { id: match.id },
                      data: {
                        winnerId: match.robot1Id,
                        status: 'completed',
                        isByeMatch: true,
                        completedAt: new Date(),
                      },
                    });
                    logger.info(`[Admin] Auto-completed bye match ${match.id} in tournament ${tournament.id}`);
                    tournamentSummary.matchesExecuted++;
                    continue;
                  }

                  if (!match.robot1Id && !match.robot2Id) {
                    tournamentSummary.errors.push(`Tournament ${tournament.id} Match ${match.id}: No robots assigned`);
                    continue;
                  }

                  try {
                    await processTournamentBattle(match);
                    tournamentSummary.matchesExecuted++;
                  } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    tournamentSummary.errors.push(`Tournament ${tournament.id} Match ${match.id}: ${errorMsg}`);
                  }
                }

                await advanceWinnersToNextRound(tournament.id);
                tournamentSummary.roundsExecuted++;
              }

              tournamentSummary.tournamentsExecuted++;

              const updatedTournament = await prisma.tournament.findUnique({
                where: { id: tournament.id },
              });

              if (updatedTournament?.status === 'completed') {
                tournamentSummary.tournamentsCompleted++;
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              tournamentSummary.errors.push(`Tournament ${tournament.id}: ${errorMsg}`);
            }
          }

          try {
            const nextTournament = await autoCreateNextTournament();
            if (nextTournament) {
              tournamentSummary.tournamentsCreated++;
              logger.info(`[Admin] Auto-created tournament: ${nextTournament.name}`);
            }
          } catch (error) {
            logger.error('[Admin] Failed to auto-create tournament:', error);
          }

          logger.info(`[Admin] Tournaments: ${tournamentSummary.tournamentsExecuted} executed, ${tournamentSummary.roundsExecuted} rounds, ${tournamentSummary.matchesExecuted} matches`);
        } catch (error) {
          logger.error('[Admin] Tournament execution error:', error);
          tournamentSummary = {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'tournament_execution',
        5,
        Date.now() - step5Start,
        {
          tournamentsExecuted: tournamentSummary?.tournamentsExecuted || 0,
          matchesExecuted: tournamentSummary?.matchesExecuted || 0,
        }
      );

      // Step 6: Repair All Robots (post-tournament)
      logger.info(`[Admin] Step 6: Repair All Robots (post-tournament)`);
      const step6Start = Date.now();
      const repair3Summary = await repairAllRobots(true, currentCycleNumber);
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'repair_post_tournament',
        6,
        Date.now() - step6Start,
        { robotsRepaired: repair3Summary.robotsRepaired, totalCost: repair3Summary.totalFinalCost }
      );

      // Step 7: Rebalance Leagues
      logger.info(`[Admin] Step 7: Rebalance Leagues`);
      const step7Start = Date.now();
      const rebalancingSummary = await rebalanceLeagues();
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'rebalance_leagues',
        7,
        Date.now() - step7Start,
        { promotions: rebalancingSummary.totalPromoted, demotions: rebalancingSummary.totalDemoted }
      );

      // Step 7.5: Rebalance Tag Team Leagues (odd cycles only)
      let tagTeamRebalancingSummary = null;
      if (shouldRunTagTeam) {
        logger.info(`[Admin] Step 7.5: Rebalance Tag Team Leagues (Cycle ${currentCycleNumber})`);
        const step7_5Start = Date.now();
        tagTeamRebalancingSummary = await rebalanceTagTeamLeagues();
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'rebalance_tag_team_leagues',
          8,
          Date.now() - step7_5Start,
          { promotions: tagTeamRebalancingSummary.totalPromoted, demotions: tagTeamRebalancingSummary.totalDemoted }
        );
      } else {
        logger.info(`[Admin] Step 7.5: Skipping Tag Team Rebalancing (even cycle ${currentCycleNumber})`);
      }

      // Step 8: Auto Generate New Users (battle ready)
      logger.info(`[Admin] Step 8: Auto Generate New Users`);
      const step8Start = Date.now();
      let userGenerationSummary = null;
      if (generateUsersPerCycle) {
        try {
          userGenerationSummary = await generateBattleReadyUsers(currentCycleNumber);
          logger.info(`[Admin] Generated ${userGenerationSummary.usersCreated} users for cycle ${currentCycleNumber}`);
        } catch (error) {
          logger.error(`[Admin] Error generating users:`, error);
          userGenerationSummary = {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'auto_generate_users',
        9,
        Date.now() - step8Start,
        { usersCreated: userGenerationSummary?.usersCreated || 0 }
      );

      // Step 9: Matchmaking for Leagues (1v1)
      logger.info(`[Admin] Step 9: Matchmaking for Leagues (1v1)`);
      const step9Start = Date.now();
      const scheduledFor = new Date(Date.now() + 1000);
      const matchesCreated = await runMatchmaking(scheduledFor);
      const matchmakingSummary = { matchesCreated };
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'matchmaking_leagues',
        10,
        Date.now() - step9Start,
        { matchesCreated }
      );

      // Step 9.5: Matchmaking for Tag Teams (odd cycles only)
      let tagTeamMatchmakingSummary = null;
      if (shouldRunTagTeam) {
        logger.info(`[Admin] Step 9.5: Matchmaking for Tag Teams (Cycle ${currentCycleNumber})`);
        const step9_5Start = Date.now();
        const tagTeamMatchesCreated = await runTagTeamMatchmaking(scheduledFor);
        tagTeamMatchmakingSummary = { matchesCreated: tagTeamMatchesCreated };
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'matchmaking_tag_teams',
          11,
          Date.now() - step9_5Start,
          { matchesCreated: tagTeamMatchesCreated }
        );
      } else {
        logger.info(`[Admin] Step 9.5: Skipping Tag Team Matchmaking (even cycle ${currentCycleNumber})`);
      }

      // Step 10: Finalize Cycle Counters
      logger.info(`[Admin] Step 10: Finalize Cycle Counters`);
      const step10Start = Date.now();

      await prisma.cycleMetadata.update({
        where: { id: 1 },
        data: { lastCycleAt: new Date() },
      });

      await prisma.robot.updateMany({
        where: { NOT: { name: 'Bye Robot' } },
        data: { cyclesInCurrentLeague: { increment: 1 } },
      });

      await prisma.tagTeam.updateMany({
        data: { cyclesInTagTeamLeague: { increment: 1 } },
      });
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'increment_cycle_counters',
        12,
        Date.now() - step10Start,
        {}
      );

      // Step 11: Calculate and Log Passive Income & Operating Costs
      logger.info(`[Admin] Step 11: Calculate Passive Income & Operating Costs`);
      const step11Start = Date.now();
      const { calculateDailyPassiveIncome, calculateFacilityOperatingCost } = await import('../../utils/economyCalculations');

      const allUsers = await prisma.user.findMany({
        where: { NOT: { username: 'bye_robot_user' } },
        select: { id: true, prestige: true },
      });

      let totalPassiveIncome = 0;
      let totalOperatingCosts = 0;

      for (const user of allUsers) {
        const passiveIncome = await calculateDailyPassiveIncome(user.id);

        const facilities = await prisma.facility.findMany({
          where: { userId: user.id },
        });

        const userRobots = await prisma.robot.findMany({
          where: { userId: user.id },
          select: { totalBattles: true, fame: true },
        });

        const facilityCosts = facilities.map(f => ({
          facilityType: f.facilityType,
          level: f.level,
          cost: calculateFacilityOperatingCost(f.facilityType, f.level),
        }));

        let totalCost = facilityCosts.reduce((sum, f) => sum + f.cost, 0);

        if (userRobots.length > 1) {
          const rosterCost = (userRobots.length - 1) * 500;
          facilityCosts.push({
            facilityType: 'roster_expansion',
            level: 0,
            cost: rosterCost,
          });
          totalCost += rosterCost;
        }

        const totalBattles = userRobots.reduce((sum, r) => sum + r.totalBattles, 0);
        const totalFame = userRobots.reduce((sum, r) => sum + r.fame, 0);

        const incomeGenerator = await prisma.facility.findUnique({
          where: {
            userId_facilityType: {
              userId: user.id,
              facilityType: 'merchandising_hub',
            },
          },
        });

        if (passiveIncome.total > 0) {
          await eventLogger.logPassiveIncome(
            currentCycleNumber,
            user.id,
            passiveIncome.merchandising,
            0,
            incomeGenerator?.level || 0,
            user.prestige,
            totalBattles,
            totalFame
          );

          await prisma.user.update({
            where: { id: user.id },
            data: { currency: { increment: passiveIncome.total } },
          });

          totalPassiveIncome += passiveIncome.total;
        }

        if (totalCost > 0) {
          await eventLogger.logOperatingCosts(
            currentCycleNumber,
            user.id,
            facilityCosts.filter(f => f.cost > 0),
            totalCost
          );

          const _userBeforeDeduction = await prisma.user.findUnique({
            where: { id: user.id },
            select: { currency: true },
          });

          await prisma.user.update({
            where: { id: user.id },
            data: { currency: { decrement: totalCost } },
          });

          const facilityList = facilityCosts.filter(f => f.cost > 0).map(f => `${f.facilityType}(L${f.level}): ₡${f.cost}`).join(', ');
          logger.info(`[OperatingCosts] User ${user.id} | Total: ₡${totalCost.toLocaleString()} | Facilities: ${facilityList}`);

          totalOperatingCosts += totalCost;
        }
      }

      logger.info(`[Admin] Passive income: ₡${totalPassiveIncome.toLocaleString()}, Operating costs: ₡${totalOperatingCosts.toLocaleString()}`);

      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'calculate_passive_income_and_costs',
        11,
        Date.now() - step11Start,
        {
          usersProcessed: allUsers.length,
          totalPassiveIncome,
          totalOperatingCosts,
        }
      );

      // Step 12: Wait (1.1 second delay)
      logger.info(`[Admin] Step 12: Wait (1.1 second delay)`);
      const step12Start = Date.now();
      await new Promise(resolve => setTimeout(resolve, 1100));
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'wait_delay',
        12,
        Date.now() - step12Start,
        {}
      );

      // Log cycle complete
      const cycleDuration = Date.now() - cycleStart;
      await eventLogger.logCycleComplete(currentCycleNumber, cycleDuration);

      // Step 13: Log End-of-Cycle Balances
      logger.info(`[Admin] Step 13: Log End-of-Cycle Balances`);
      logger.info(`[Admin] === End of Cycle ${currentCycleNumber} Balances ===`);
      const step13Start = Date.now();
      const endOfCycleUsers = await prisma.user.findMany({
        where: { NOT: { username: 'bye_robot_user' } },
        select: { id: true, username: true, stableName: true, currency: true },
        orderBy: { id: 'asc' },
      });

      for (const user of endOfCycleUsers) {
        logger.info(`[Balance] User ${user.id} | Stable: ${user.stableName || user.username} | Balance: ₡${user.currency.toLocaleString()}`);

        await eventLogger.logCycleEndBalance(
          currentCycleNumber,
          user.id,
          user.username,
          user.stableName,
          user.currency
        );
      }
      logger.info(`[Admin] ===================================`);
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'log_end_of_cycle_balances',
        13,
        Date.now() - step13Start,
        { usersLogged: endOfCycleUsers.length }
      );

      // Step 14: Create Cycle Snapshot
      logger.info(`[Admin] Step 14: Create Cycle Snapshot`);
      const step14Start = Date.now();
      try {
        const { cycleSnapshotService } = await import('../cycle/cycleSnapshotService');
        await cycleSnapshotService.createSnapshot(currentCycleNumber);
        logger.info(`[Admin] Cycle snapshot created for cycle ${currentCycleNumber}`);
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'create_cycle_snapshot',
          14,
          Date.now() - step14Start,
          {}
        );
      } catch (snapshotError) {
        logger.error(`[Admin] Failed to create cycle snapshot:`, snapshotError);
      }

      // Display Cycle Summary
      logger.info(`[Admin] === Cycle ${currentCycleNumber} Summary ===`);
      logger.info(`[Admin] Battles: ${battleSummary.totalBattles}`);
      if (kothBattleSummary) {
        logger.info(`[Admin] KotH Battles: ${kothBattleSummary.totalMatches} (${kothBattleSummary.successfulMatches} successful, ${kothBattleSummary.failedMatches} failed)`);
      }
      const totalStreamingRevenue = (battleSummary.totalStreamingRevenue || 0) + (tagTeamBattleSummary?.totalStreamingRevenue || 0);
      if (totalStreamingRevenue > 0) {
        logger.info(`[Admin] Streaming Revenue: ₡${totalStreamingRevenue.toLocaleString()}`);
      }
      logger.info(`[Admin] ===================================`);

      cycleResults.push({
        cycle: currentCycleNumber,
        battles: battleSummary,
        repair1: repair1Summary,
        tagTeamBattles: tagTeamBattleSummary,
        repair2: repair2Summary,
        kothBattles: kothBattleSummary,
        repairPostKoth: repairKothSummary,
        kothMatchmaking: kothMatchmakingSummary,
        tournaments: tournamentSummary,
        repair3: repair3Summary,
        rebalancing: rebalancingSummary,
        tagTeamRebalancing: tagTeamRebalancingSummary,
        userGeneration: userGenerationSummary,
        matchmaking: matchmakingSummary,
        tagTeamMatchmaking: tagTeamMatchmakingSummary,
        totalStreamingRevenue,
        duration: Date.now() - cycleStart,
      });

      // End cycle logging
      cycleLogger.endCycle();
    } catch (error) {
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
    generateUsersPerCycleEnabled: generateUsersPerCycle,
    totalDuration,
    averageCycleDuration: Math.round(totalDuration / cycleCount),
    results: cycleResults,
    timestamp: new Date().toISOString(),
  };
}

/** Result returned by backfillCycleSnapshots. */
export interface BackfillSnapshotsResult {
  success: true;
  totalCycles: number;
  snapshotsCreated: number;
  cycles: number[];
  errors?: Array<{ cycle: number; error: string }>;
}

/**
 * Backfill cycle snapshots for cycles that don't already have one.
 */
export async function backfillCycleSnapshots(): Promise<BackfillSnapshotsResult> {
  logger.info('[Admin] Backfilling cycle snapshots...');

  const { cycleSnapshotService } = await import('../cycle/cycleSnapshotService');

  const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  if (!cycleMetadata || cycleMetadata.totalCycles === 0) {
    return {
      success: true,
      totalCycles: 0,
      snapshotsCreated: 0,
      cycles: [],
    };
  }

  const totalCycles = cycleMetadata.totalCycles;
  const snapshotsCreated: number[] = [];
  const errors: Array<{ cycle: number; error: string }> = [];

  const existingSnapshots = await prisma.cycleSnapshot.findMany({
    select: { cycleNumber: true },
  });
  const existingCycles = new Set(existingSnapshots.map(s => s.cycleNumber));

  for (let cycle = 1; cycle <= totalCycles; cycle++) {
    if (existingCycles.has(cycle)) {
      logger.info(`[Admin] Snapshot already exists for cycle ${cycle}, skipping`);
      continue;
    }

    try {
      logger.info(`[Admin] Creating snapshot for cycle ${cycle}`);
      await cycleSnapshotService.createSnapshot(cycle);
      snapshotsCreated.push(cycle);
    } catch (error) {
      logger.error(`[Admin] Failed to create snapshot for cycle ${cycle}:`, error);
      errors.push({
        cycle,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    success: true,
    totalCycles,
    snapshotsCreated: snapshotsCreated.length,
    cycles: snapshotsCreated,
    errors: errors.length > 0 ? errors : undefined,
  };
}
