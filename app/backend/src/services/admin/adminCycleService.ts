import { executeScheduledBattles } from '../league/leagueBattleOrchestrator';
import { executeScheduledKothBattles } from '../koth/kothBattleOrchestrator';
import { runMatchmaking } from '../analytics/matchmakingService';
import { runKothMatchmaking } from '../koth/kothMatchmakingService';
import { rebalanceLeagues } from '../league/leagueRebalancingService';
import { rebalanceTagTeamLeagues } from '../tag-team/tagTeamLeagueRebalancingService';
import { runTagTeamMatchmaking } from '../tag-team/tagTeamMatchmakingService';
import { executeScheduledTagTeamBattles } from '../tag-team/tagTeamBattleOrchestrator';
import { executeScheduledTeamBattles } from '../team-battle/teamBattleOrchestrator';
import { rebalanceTeamBattleLeagues } from '../team-battle/teamBattleAdapter';
import { runTeamBattleMatchmaking } from '../team-battle/teamBattleMatchmakingService';
import { generateBattleReadyUsers } from '../../utils/userGeneration';
import { repairAllRobots } from '../economy/repairService';
import {
  getActiveTournaments,
  getCurrentRoundMatches,
  autoCreateNextTournament,
  advanceWinnersToNextRound,
} from '../tournament/tournamentService';
import { processTournamentBattle } from '../tournament/tournamentBattleOrchestrator';
import { executeTeamTournamentRound } from '../tournament/teamTournamentBattleOrchestrator';
import { autoCreateNextTeamTournament } from '../tournament/teamTournamentService';
import { runOrphanCleanup } from '../moderation/orphanCleanupJob';
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
  includeDailyFinances?: boolean;
}

/** Per-cycle result entry. */
export interface CycleResult {
  cycle: number;
  // Event block results (slot map order)
  leagueBlock?: { battles: unknown; repair: unknown; rebalancing: unknown; matchmaking: unknown };
  team2v2LeagueBlock?: { battles: unknown; rebalancing: unknown; matchmaking: unknown } | { error: string };
  tournamentBlock?: { repair: unknown; tournaments: unknown };
  tagTeamBlock?: { repair: unknown; battles: unknown; rebalancing: unknown; matchmaking: unknown };
  kothBlock?: { repair: unknown; battles: unknown; matchmaking: unknown };
  team3v3LeagueBlock?: { battles: unknown; rebalancing: unknown; matchmaking: unknown } | { error: string };
  team2v2TournamentBlock?: { skipped: true; message: string } | { repair: unknown; matchesExecuted: number; matchesFailed: number; tournamentName?: string; tournamentRound?: number; tournamentMaxRounds?: number; tournamentCreated?: boolean; skippedReason?: string };
  grandMeleeBlock?: { skipped: true; message: string };
  team3v3TournamentBlock?: { skipped: true; message: string } | { repair: unknown; matchesExecuted: number; matchesFailed: number; tournamentName?: string; tournamentRound?: number; tournamentMaxRounds?: number; tournamentCreated?: boolean; skippedReason?: string };
  // Settlement results
  settlement?: {
    userGeneration: unknown;
    finances: unknown;
    cycleCounters: unknown;
    snapshot: unknown;
    orphanCleanup: unknown;
    endOfCycleBalances: unknown;
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

/** Result shape for tournament execution step. */
export interface TournamentStepSummary {
  tournamentsExecuted?: number;
  roundsExecuted?: number;
  matchesExecuted?: number;
  tournamentsCompleted?: number;
  tournamentsCreated?: number;
  errors?: string[];
  error?: string;
}

/**
 * Execute tournament rounds, advance winners, and auto-create next tournament.
 * Shared by both the cycles=0 tournament-only path and the full cycle pipeline.
 */
async function executeTournamentStep(): Promise<TournamentStepSummary> {
  const summary: TournamentStepSummary = {
    tournamentsExecuted: 0,
    roundsExecuted: 0,
    matchesExecuted: 0,
    tournamentsCompleted: 0,
    tournamentsCreated: 0,
    errors: [],
  };

  try {
    const activeTournaments = await getActiveTournaments();

    for (const tournament of activeTournaments) {
      try {
        const currentRoundMatches = await getCurrentRoundMatches(tournament.id);

        if (currentRoundMatches.length > 0) {
          for (const match of currentRoundMatches) {
            if (match.participant1Id && !match.participant2Id) {
              await prisma.scheduledTournamentMatch.update({
                where: { id: match.id },
                data: {
                  winnerId: match.participant1Id,
                  status: 'completed',
                  isByeMatch: true,
                  completedAt: new Date(),
                },
              });
              logger.info(`[Admin] Auto-completed bye match ${match.id} in tournament ${tournament.id}`);
              summary.matchesExecuted!++;
              continue;
            }

            if (!match.participant1Id && !match.participant2Id) {
              summary.errors!.push(`Tournament ${tournament.id} Match ${match.id}: No robots assigned`);
              continue;
            }

            try {
              await processTournamentBattle(match);
              summary.matchesExecuted!++;
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              summary.errors!.push(`Tournament ${tournament.id} Match ${match.id}: ${errorMsg}`);
            }
          }

          await advanceWinnersToNextRound(tournament.id);
          summary.roundsExecuted!++;
        }

        summary.tournamentsExecuted!++;

        const updatedTournament = await prisma.tournament.findUnique({
          where: { id: tournament.id },
        });

        if (updatedTournament?.status === 'completed') {
          summary.tournamentsCompleted!++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        summary.errors!.push(`Tournament ${tournament.id}: ${errorMsg}`);
      }
    }

    try {
      const nextTournament = await autoCreateNextTournament();
      if (nextTournament) {
        summary.tournamentsCreated!++;
        logger.info(`[Admin] Auto-created tournament: ${nextTournament.name}`);
      }
    } catch (error) {
      logger.error('[Admin] Failed to auto-create tournament:', error);
    }
  } catch (error) {
    logger.error('[Admin] Tournament execution error:', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }

  return summary;
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

  // cycles=0 means "run only the tournament step without a full cycle"
  if (cycleCount === 0 && includeTournaments) {
    logger.info('[Admin] Running tournament-only execution (cycles=0)...');
    await repairAllRobots(true, cycleMetadata.totalCycles);
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

  let currentCycleNumber = cycleMetadata.totalCycles;
  const cycleResults: CycleResult[] = [];

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

      let stepNumber = 0;
      const reservedSlotsFired: string[] = [];

      // ═══════════════════════════════════════════════════════════════════
      // SLOT 1: 1v1 League (repair → execute → rebalance → matchmaking)
      // ═══════════════════════════════════════════════════════════════════
      logger.info(`[Admin] Slot 1: 1v1 League`);

      // 1.1 Repair
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Repair All Robots (pre-league)`);
      const leagueRepairStart = Date.now();
      const leagueRepairSummary = await repairAllRobots(true, currentCycleNumber);
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'repair_pre_league',
        stepNumber,
        Date.now() - leagueRepairStart,
        { robotsRepaired: leagueRepairSummary.robotsRepaired, totalCost: leagueRepairSummary.totalFinalCost }
      );

      // 1.2 Execute battles
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Execute League Battles (1v1)`);
      const leagueBattleStart = Date.now();
      const battleSummary = await executeScheduledBattles(new Date());
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'execute_league_battles',
        stepNumber,
        Date.now() - leagueBattleStart,
        { battlesExecuted: battleSummary.totalBattles }
      );

      // 1.3 Rebalance leagues
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Rebalance Leagues`);
      const leagueRebalanceStart = Date.now();
      const rebalancingSummary = await rebalanceLeagues();
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'rebalance_leagues',
        stepNumber,
        Date.now() - leagueRebalanceStart,
        { promotions: rebalancingSummary.totalPromoted, demotions: rebalancingSummary.totalDemoted }
      );

      // 1.4 Matchmaking (24h lead time)
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Matchmaking for Leagues (1v1)`);
      const leagueMatchmakingStart = Date.now();
      const leagueScheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
      leagueScheduledFor.setMinutes(0, 0, 0);
      const leagueMatchesCreated = await runMatchmaking(leagueScheduledFor);
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'matchmaking_leagues',
        stepNumber,
        Date.now() - leagueMatchmakingStart,
        { matchesCreated: leagueMatchesCreated }
      );

      // ═══════════════════════════════════════════════════════════════════
      // SLOT 2: Team 2v2 League (execute → rebalance → matchmaking)
      // ═══════════════════════════════════════════════════════════════════
      logger.info(`[Admin] Slot 2: Team 2v2 League`);
      let team2v2BattleSummary = null;
      let team2v2RebalancingSummary = null;
      let team2v2MatchesCreated = 0;
      let team2v2Error: string | undefined;

      try {
        // 2.1 Execute scheduled 2v2 battles
        stepNumber++;
        logger.info(`[Admin] Step ${stepNumber}: Execute Team 2v2 League Battles`);
        const team2v2BattleStart = Date.now();
        team2v2BattleSummary = await executeScheduledTeamBattles(2);
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'execute_team_2v2_battles',
          stepNumber,
          Date.now() - team2v2BattleStart,
          { matchesCompleted: team2v2BattleSummary.matchesCompleted, matchesCancelled: team2v2BattleSummary.matchesCancelled }
        );

        // 2.2 Rebalance 2v2 league tiers
        stepNumber++;
        logger.info(`[Admin] Step ${stepNumber}: Rebalance Team 2v2 Leagues`);
        const team2v2RebalanceStart = Date.now();
        team2v2RebalancingSummary = await rebalanceTeamBattleLeagues(2);
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'rebalance_team_2v2_leagues',
          stepNumber,
          Date.now() - team2v2RebalanceStart,
          { promotions: team2v2RebalancingSummary.totalPromoted, demotions: team2v2RebalancingSummary.totalDemoted }
        );

        // 2.3 Run 2v2 matchmaking (24h lead time)
        stepNumber++;
        logger.info(`[Admin] Step ${stepNumber}: Matchmaking for Team 2v2 League`);
        const team2v2MatchmakingStart = Date.now();
        const team2v2ScheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
        team2v2ScheduledFor.setMinutes(0, 0, 0);
        team2v2MatchesCreated = await runTeamBattleMatchmaking(2, team2v2ScheduledFor);
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'matchmaking_team_2v2',
          stepNumber,
          Date.now() - team2v2MatchmakingStart,
          { matchesCreated: team2v2MatchesCreated }
        );
      } catch (team2v2Err) {
        // R14.7: Record failure, continue remaining steps and iterations
        team2v2Error = team2v2Err instanceof Error ? team2v2Err.message : String(team2v2Err);
        logger.error(`[Admin] Team 2v2 League block failed:`, team2v2Err);
      }

      // ═══════════════════════════════════════════════════════════════════
      // SLOT 3: 1v1 Tournament (repair → execute/advance/auto-create)
      // ═══════════════════════════════════════════════════════════════════
      logger.info(`[Admin] Slot 3: 1v1 Tournament`);
      let tournamentSummary: TournamentStepSummary | null = null;

      // 3.1 Repair
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Repair All Robots (pre-tournament)`);
      const tournamentRepairStart = Date.now();
      const tournamentRepairSummary = await repairAllRobots(true, currentCycleNumber);
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'repair_pre_tournament',
        stepNumber,
        Date.now() - tournamentRepairStart,
        { robotsRepaired: tournamentRepairSummary.robotsRepaired, totalCost: tournamentRepairSummary.totalFinalCost }
      );

      // 3.2 Execute tournament step
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Tournament Execution / Scheduling`);
      const tournamentExecStart = Date.now();
      if (includeTournaments) {
        tournamentSummary = await executeTournamentStep();
        logger.info(`[Admin] Tournaments: ${tournamentSummary.tournamentsExecuted || 0} executed, ${tournamentSummary.roundsExecuted || 0} rounds, ${tournamentSummary.matchesExecuted || 0} matches`);
      }
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'tournament_execution',
        stepNumber,
        Date.now() - tournamentExecStart,
        {
          tournamentsExecuted: tournamentSummary?.tournamentsExecuted || 0,
          matchesExecuted: tournamentSummary?.matchesExecuted || 0,
        }
      );

      // ═══════════════════════════════════════════════════════════════════
      // SLOT 4: Tag Team (repair → execute → rebalance → matchmaking)
      // ═══════════════════════════════════════════════════════════════════
      logger.info(`[Admin] Slot 4: Tag Team`);

      // 4.1 Repair
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Repair All Robots (pre-tag-team)`);
      const tagTeamRepairStart = Date.now();
      const tagTeamRepairSummary = await repairAllRobots(true, currentCycleNumber);
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'repair_pre_tag_team',
        stepNumber,
        Date.now() - tagTeamRepairStart,
        { robotsRepaired: tagTeamRepairSummary.robotsRepaired, totalCost: tagTeamRepairSummary.totalFinalCost }
      );

      // 4.2 Execute tag team battles
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Execute Tag Team Battles`);
      const tagTeamBattleStart = Date.now();
      const tagTeamBattleSummary = await executeScheduledTagTeamBattles(new Date());
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'execute_tag_team_battles',
        stepNumber,
        Date.now() - tagTeamBattleStart,
        { battlesExecuted: tagTeamBattleSummary?.totalBattles || 0 }
      );

      // 4.3 Rebalance tag team leagues
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Rebalance Tag Team Leagues`);
      const tagTeamRebalanceStart = Date.now();
      const tagTeamRebalancingSummary = await rebalanceTagTeamLeagues();
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'rebalance_tag_team_leagues',
        stepNumber,
        Date.now() - tagTeamRebalanceStart,
        { promotions: tagTeamRebalancingSummary.totalPromoted, demotions: tagTeamRebalancingSummary.totalDemoted }
      );

      // 4.4 Tag Team matchmaking (24h lead time)
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Matchmaking for Tag Teams`);
      const tagTeamMatchmakingStart = Date.now();
      const tagTeamScheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
      tagTeamScheduledFor.setMinutes(0, 0, 0);
      const tagTeamMatchesCreated = await runTagTeamMatchmaking(tagTeamScheduledFor);
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'matchmaking_tag_teams',
        stepNumber,
        Date.now() - tagTeamMatchmakingStart,
        { matchesCreated: tagTeamMatchesCreated }
      );

      // ═══════════════════════════════════════════════════════════════════
      // SLOT 5: KotH (repair → execute → matchmaking)
      // ═══════════════════════════════════════════════════════════════════
      logger.info(`[Admin] Slot 5: KotH`);
      let kothBattleSummary = null;
      let kothMatchesCreated = 0;
      let kothRepairSummary = null;

      if (includeKoth) {
        // 5.1 Repair
        stepNumber++;
        logger.info(`[Admin] Step ${stepNumber}: Repair All Robots (pre-koth)`);
        const kothRepairStart = Date.now();
        kothRepairSummary = await repairAllRobots(true, currentCycleNumber);
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'repair_pre_koth',
          stepNumber,
          Date.now() - kothRepairStart,
          { robotsRepaired: kothRepairSummary.robotsRepaired, totalCost: kothRepairSummary.totalFinalCost }
        );

        // 5.2 Execute KotH battles
        stepNumber++;
        logger.info(`[Admin] Step ${stepNumber}: Execute Scheduled KotH Battles`);
        const kothBattleStart = Date.now();
        kothBattleSummary = await executeScheduledKothBattles(new Date());
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'execute_koth_battles',
          stepNumber,
          Date.now() - kothBattleStart,
          { battlesExecuted: kothBattleSummary.totalMatches }
        );

        // 5.3 KotH matchmaking (24h lead time, pass cycleNumber for zone rotation)
        stepNumber++;
        logger.info(`[Admin] Step ${stepNumber}: KotH Matchmaking`);
        const kothMatchmakingStart = Date.now();
        const kothScheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
        kothScheduledFor.setMinutes(0, 0, 0);
        kothMatchesCreated = await runKothMatchmaking(kothScheduledFor, currentCycleNumber);
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'matchmaking_koth',
          stepNumber,
          Date.now() - kothMatchmakingStart,
          { matchesCreated: kothMatchesCreated }
        );
      } else {
        stepNumber++;
        logger.info(`[Admin] Step ${stepNumber}: Skipping KotH (includeKoth=false)`);
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'koth_skipped',
          stepNumber,
          0,
          { skipped: true }
        );
      }

      // ═══════════════════════════════════════════════════════════════════
      // SLOT 6: Team 3v3 League (execute → rebalance → matchmaking)
      // ═══════════════════════════════════════════════════════════════════
      logger.info(`[Admin] Slot 6: Team 3v3 League`);
      let team3v3BattleSummary = null;
      let team3v3RebalancingSummary = null;
      let team3v3MatchesCreated = 0;
      let team3v3Error: string | undefined;

      try {
        // 6.1 Execute scheduled 3v3 battles
        stepNumber++;
        logger.info(`[Admin] Step ${stepNumber}: Execute Team 3v3 League Battles`);
        const team3v3BattleStart = Date.now();
        team3v3BattleSummary = await executeScheduledTeamBattles(3);
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'execute_team_3v3_battles',
          stepNumber,
          Date.now() - team3v3BattleStart,
          { matchesCompleted: team3v3BattleSummary.matchesCompleted, matchesCancelled: team3v3BattleSummary.matchesCancelled }
        );

        // 6.2 Rebalance 3v3 league tiers
        stepNumber++;
        logger.info(`[Admin] Step ${stepNumber}: Rebalance Team 3v3 Leagues`);
        const team3v3RebalanceStart = Date.now();
        team3v3RebalancingSummary = await rebalanceTeamBattleLeagues(3);
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'rebalance_team_3v3_leagues',
          stepNumber,
          Date.now() - team3v3RebalanceStart,
          { promotions: team3v3RebalancingSummary.totalPromoted, demotions: team3v3RebalancingSummary.totalDemoted }
        );

        // 6.3 Run 3v3 matchmaking (24h lead time)
        stepNumber++;
        logger.info(`[Admin] Step ${stepNumber}: Matchmaking for Team 3v3 League`);
        const team3v3MatchmakingStart = Date.now();
        const team3v3ScheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
        team3v3ScheduledFor.setMinutes(0, 0, 0);
        team3v3MatchesCreated = await runTeamBattleMatchmaking(3, team3v3ScheduledFor);
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'matchmaking_team_3v3',
          stepNumber,
          Date.now() - team3v3MatchmakingStart,
          { matchesCreated: team3v3MatchesCreated }
        );
      } catch (team3v3Err) {
        // R14.7: Record failure, continue remaining steps and iterations
        team3v3Error = team3v3Err instanceof Error ? team3v3Err.message : String(team3v3Err);
        logger.error(`[Admin] Team 3v3 League block failed:`, team3v3Err);
      }

      // ═══════════════════════════════════════════════════════════════════
      // SLOT 7: Team 2v2 Tournament (repair → execute/advance/auto-create)
      // ═══════════════════════════════════════════════════════════════════
      logger.info(`[Admin] Slot 7: Team 2v2 Tournament`);
      let team2v2TournamentResult: CycleResult['team2v2TournamentBlock'] = undefined;

      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Repair All Robots (pre-team-2v2-tournament)`);
      const team2v2TournamentRepairStart = Date.now();
      const team2v2TournamentRepairSummary = await repairAllRobots(true, currentCycleNumber);
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'repair_pre_team_2v2_tournament',
        stepNumber,
        Date.now() - team2v2TournamentRepairStart,
        { robotsRepaired: team2v2TournamentRepairSummary.robotsRepaired, totalCost: team2v2TournamentRepairSummary.totalFinalCost }
      );

      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Execute Team 2v2 Tournament`);
      const team2v2TournamentExecStart = Date.now();

      try {
        const active2v2Tournament = await prisma.tournament.findFirst({
          where: { participantType: 'team_2v2', status: 'active' },
        });

        if (active2v2Tournament) {
          logger.info(`[Admin] Executing round ${active2v2Tournament.currentRound} of "${active2v2Tournament.name}"`);
          const roundResult = await executeTeamTournamentRound(active2v2Tournament.id, 2);
          await advanceWinnersToNextRound(active2v2Tournament.id);

          team2v2TournamentResult = {
            repair: team2v2TournamentRepairSummary,
            matchesExecuted: roundResult.matchesExecuted,
            matchesFailed: roundResult.matchesFailed,
            tournamentName: active2v2Tournament.name,
            tournamentRound: active2v2Tournament.currentRound,
            tournamentMaxRounds: active2v2Tournament.maxRounds,
          };
        } else {
          // No active tournament — try to create one
          const newTournament = await autoCreateNextTeamTournament(2);
          if (newTournament) {
            logger.info(`[Admin] Auto-created team 2v2 tournament: "${newTournament.name}"`);
            team2v2TournamentResult = {
              repair: team2v2TournamentRepairSummary,
              matchesExecuted: 0,
              matchesFailed: 0,
              tournamentName: newTournament.name,
              tournamentCreated: true,
            };
          } else {
            logger.info(`[Admin] Team 2v2 Tournament: Skipped — insufficient eligible teams`);
            team2v2TournamentResult = {
              repair: team2v2TournamentRepairSummary,
              matchesExecuted: 0,
              matchesFailed: 0,
              skippedReason: 'insufficient eligible teams',
            };
          }
        }
      } catch (team2v2TournamentErr) {
        logger.error(`[Admin] Team 2v2 Tournament block failed:`, team2v2TournamentErr);
        team2v2TournamentResult = {
          repair: team2v2TournamentRepairSummary,
          matchesExecuted: 0,
          matchesFailed: 0,
          skippedReason: team2v2TournamentErr instanceof Error ? team2v2TournamentErr.message : String(team2v2TournamentErr),
        };
      }

      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'team_2v2_tournament_execution',
        stepNumber,
        Date.now() - team2v2TournamentExecStart,
        { matchesExecuted: (team2v2TournamentResult && 'matchesExecuted' in team2v2TournamentResult) ? team2v2TournamentResult.matchesExecuted : 0 }
      );

      // ═══════════════════════════════════════════════════════════════════
      // SLOT 8: Grand Melee (reserved stub)
      // ═══════════════════════════════════════════════════════════════════
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Grand Melee — reserved slot, no handler implemented`);
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'grand_melee_reserved',
        stepNumber,
        0,
        { reserved: true }
      );
      reservedSlotsFired.push('grand_melee');

      // ═══════════════════════════════════════════════════════════════════
      // SLOT 9: Team 3v3 Tournament (repair → execute/advance/auto-create)
      // ═══════════════════════════════════════════════════════════════════
      logger.info(`[Admin] Slot 9: Team 3v3 Tournament`);
      let team3v3TournamentResult: CycleResult['team3v3TournamentBlock'] = undefined;

      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Repair All Robots (pre-team-3v3-tournament)`);
      const team3v3TournamentRepairStart = Date.now();
      const team3v3TournamentRepairSummary = await repairAllRobots(true, currentCycleNumber);
      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'repair_pre_team_3v3_tournament',
        stepNumber,
        Date.now() - team3v3TournamentRepairStart,
        { robotsRepaired: team3v3TournamentRepairSummary.robotsRepaired, totalCost: team3v3TournamentRepairSummary.totalFinalCost }
      );

      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Execute Team 3v3 Tournament`);
      const team3v3TournamentExecStart = Date.now();

      try {
        const active3v3Tournament = await prisma.tournament.findFirst({
          where: { participantType: 'team_3v3', status: 'active' },
        });

        if (active3v3Tournament) {
          logger.info(`[Admin] Executing round ${active3v3Tournament.currentRound} of "${active3v3Tournament.name}"`);
          const roundResult = await executeTeamTournamentRound(active3v3Tournament.id, 3);
          await advanceWinnersToNextRound(active3v3Tournament.id);

          team3v3TournamentResult = {
            repair: team3v3TournamentRepairSummary,
            matchesExecuted: roundResult.matchesExecuted,
            matchesFailed: roundResult.matchesFailed,
            tournamentName: active3v3Tournament.name,
            tournamentRound: active3v3Tournament.currentRound,
            tournamentMaxRounds: active3v3Tournament.maxRounds,
          };
        } else {
          // No active tournament — try to create one
          const newTournament = await autoCreateNextTeamTournament(3);
          if (newTournament) {
            logger.info(`[Admin] Auto-created team 3v3 tournament: "${newTournament.name}"`);
            team3v3TournamentResult = {
              repair: team3v3TournamentRepairSummary,
              matchesExecuted: 0,
              matchesFailed: 0,
              tournamentName: newTournament.name,
              tournamentCreated: true,
            };
          } else {
            logger.info(`[Admin] Team 3v3 Tournament: Skipped — insufficient eligible teams`);
            team3v3TournamentResult = {
              repair: team3v3TournamentRepairSummary,
              matchesExecuted: 0,
              matchesFailed: 0,
              skippedReason: 'insufficient eligible teams',
            };
          }
        }
      } catch (team3v3TournamentErr) {
        logger.error(`[Admin] Team 3v3 Tournament block failed:`, team3v3TournamentErr);
        team3v3TournamentResult = {
          repair: team3v3TournamentRepairSummary,
          matchesExecuted: 0,
          matchesFailed: 0,
          skippedReason: team3v3TournamentErr instanceof Error ? team3v3TournamentErr.message : String(team3v3TournamentErr),
        };
      }

      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'team_3v3_tournament_execution',
        stepNumber,
        Date.now() - team3v3TournamentExecStart,
        { matchesExecuted: (team3v3TournamentResult && 'matchesExecuted' in team3v3TournamentResult) ? team3v3TournamentResult.matchesExecuted : 0 }
      );

      // ═══════════════════════════════════════════════════════════════════
      // SLOT 10: Settlement
      // (user gen → daily finances → cycle counters → snapshot →
      //  orphan cleanup → end-of-cycle balances)
      // ═══════════════════════════════════════════════════════════════════
      logger.info(`[Admin] Slot 10: Settlement`);

      // 10.1 Auto Generate New Users (battle ready)
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Auto Generate New Users`);
      const userGenStart = Date.now();
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
        stepNumber,
        Date.now() - userGenStart,
        { usersCreated: userGenerationSummary?.usersCreated || 0 }
      );

      // 10.2 Calculate and Log Passive Income & Operating Costs
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Calculate Passive Income & Operating Costs`);
      const financesStart = Date.now();

      let totalPassiveIncome = 0;
      let totalOperatingCosts = 0;
      let financesUsersProcessed = 0;

      if (includeDailyFinances) {
        const { calculateDailyPassiveIncome, calculateFacilityOperatingCost } = await import('../../utils/economyCalculations');

        const allUsers = await prisma.user.findMany({
          where: { NOT: { username: 'bye_robot_user' } },
          select: { id: true, prestige: true },
        });
        financesUsersProcessed = allUsers.length;

        // Collect all currency updates to batch in a single transaction
        const currencyUpdates: Array<ReturnType<typeof prisma.user.update>> = [];

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

            totalPassiveIncome += passiveIncome.total;
          }

          if (totalCost > 0) {
            await eventLogger.logOperatingCosts(
              currentCycleNumber,
              user.id,
              facilityCosts.filter(f => f.cost > 0),
              totalCost
            );

            const facilityList = facilityCosts.filter(f => f.cost > 0).map(f => `${f.facilityType}(L${f.level}): ₡${f.cost}`).join(', ');
            logger.info(`[OperatingCosts] User ${user.id} | Total: ₡${totalCost.toLocaleString()} | Facilities: ${facilityList}`);

            totalOperatingCosts += totalCost;
          }

          // Calculate net change (income - costs) and batch the update
          const netChange = passiveIncome.total - totalCost;
          if (netChange !== 0) {
            currencyUpdates.push(prisma.user.update({
              where: { id: user.id },
              data: { currency: { increment: netChange } },
            }));
          }
        }

        // Execute all currency updates in a single transaction
        if (currencyUpdates.length > 0) {
          await prisma.$transaction(currencyUpdates, { timeout: 30000 });
        }

        logger.info(`[Admin] Passive income: ₡${totalPassiveIncome.toLocaleString()}, Operating costs: ₡${totalOperatingCosts.toLocaleString()}`);
      } else {
        logger.info(`[Admin] Skipping daily finances (includeDailyFinances=false)`);
      }

      await eventLogger.logCycleStepComplete(
        currentCycleNumber,
        'calculate_passive_income_and_costs',
        stepNumber,
        Date.now() - financesStart,
        {
          usersProcessed: financesUsersProcessed,
          totalPassiveIncome,
          totalOperatingCosts,
          skipped: !includeDailyFinances,
        }
      );

      // 10.3 Finalize Cycle Counters
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Finalize Cycle Counters`);
      const cycleCountersStart = Date.now();

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
        stepNumber,
        Date.now() - cycleCountersStart,
        {}
      );

      // 10.4 Create Cycle Snapshot
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Create Cycle Snapshot`);
      const snapshotStart = Date.now();
      let snapshotResult = null;
      try {
        const { cycleSnapshotService } = await import('../cycle/cycleSnapshotService');
        await cycleSnapshotService.createSnapshot(currentCycleNumber);
        logger.info(`[Admin] Cycle snapshot created for cycle ${currentCycleNumber}`);
        snapshotResult = { created: true };
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'create_cycle_snapshot',
          stepNumber,
          Date.now() - snapshotStart,
          {}
        );
      } catch (snapshotError) {
        logger.error(`[Admin] Failed to create cycle snapshot:`, snapshotError);
        snapshotResult = { error: snapshotError instanceof Error ? snapshotError.message : String(snapshotError) };
      }

      // 10.5 Orphan Image Cleanup
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Orphan Image Cleanup`);
      const orphanStart = Date.now();
      let orphanResult = null;
      try {
        orphanResult = await runOrphanCleanup();
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'orphan_image_cleanup',
          stepNumber,
          Date.now() - orphanStart,
          { filesDeleted: orphanResult.filesDeleted, bytesReclaimed: orphanResult.bytesReclaimed }
        );
      } catch (orphanError) {
        logger.error(`[Admin] Failed to run orphan image cleanup:`, orphanError);
      }

      // 10.6 Log End-of-Cycle Balances
      stepNumber++;
      logger.info(`[Admin] Step ${stepNumber}: Log End-of-Cycle Balances`);
      logger.info(`[Admin] === End of Cycle ${currentCycleNumber} Balances ===`);
      const balancesStart = Date.now();
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
        stepNumber,
        Date.now() - balancesStart,
        { usersLogged: endOfCycleUsers.length }
      );

      // Log cycle complete
      const cycleDuration = Date.now() - cycleStart;
      await eventLogger.logCycleComplete(currentCycleNumber, cycleDuration);

      // Display Cycle Summary
      logger.info(`[Admin] === Cycle ${currentCycleNumber} Summary ===`);
      logger.info(`[Admin] 1v1 League Battles: ${battleSummary.totalBattles}`);
      logger.info(`[Admin] Team 2v2 League Battles: ${team2v2BattleSummary?.matchesCompleted ?? 0}${team2v2Error ? ' (ERROR)' : ''}`);
      logger.info(`[Admin] Tag Team Battles: ${tagTeamBattleSummary?.totalBattles || 0}`);
      if (kothBattleSummary) {
        logger.info(`[Admin] KotH Battles: ${kothBattleSummary.totalMatches} (${kothBattleSummary.successfulMatches} successful, ${kothBattleSummary.failedMatches} failed)`);
      }
      logger.info(`[Admin] Team 3v3 League Battles: ${team3v3BattleSummary?.matchesCompleted ?? 0}${team3v3Error ? ' (ERROR)' : ''}`);
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
        leagueBlock: {
          battles: battleSummary,
          repair: leagueRepairSummary,
          rebalancing: rebalancingSummary,
          matchmaking: { matchesCreated: leagueMatchesCreated },
        },
        team2v2LeagueBlock: team2v2Error
          ? { error: team2v2Error }
          : { battles: team2v2BattleSummary, rebalancing: team2v2RebalancingSummary, matchmaking: { matchesCreated: team2v2MatchesCreated } },
        tournamentBlock: {
          repair: tournamentRepairSummary,
          tournaments: tournamentSummary,
        },
        tagTeamBlock: {
          repair: tagTeamRepairSummary,
          battles: tagTeamBattleSummary,
          rebalancing: tagTeamRebalancingSummary,
          matchmaking: { matchesCreated: tagTeamMatchesCreated },
        },
        kothBlock: includeKoth ? {
          repair: kothRepairSummary,
          battles: kothBattleSummary,
          matchmaking: { matchesCreated: kothMatchesCreated },
        } : undefined,
        team3v3LeagueBlock: team3v3Error
          ? { error: team3v3Error }
          : { battles: team3v3BattleSummary, rebalancing: team3v3RebalancingSummary, matchmaking: { matchesCreated: team3v3MatchesCreated } },
        team2v2TournamentBlock: team2v2TournamentResult,
        grandMeleeBlock: { skipped: true, message: 'reserved slot, no handler implemented' },
        team3v3TournamentBlock: team3v3TournamentResult,
        settlement: {
          userGeneration: userGenerationSummary,
          finances: { totalPassiveIncome, totalOperatingCosts, usersProcessed: financesUsersProcessed, skipped: !includeDailyFinances },
          cycleCounters: { updated: true },
          snapshot: snapshotResult,
          orphanCleanup: orphanResult,
          endOfCycleBalances: { usersLogged: endOfCycleUsers.length },
        },
        reservedSlotsFired,
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
    includeDailyFinances,
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
