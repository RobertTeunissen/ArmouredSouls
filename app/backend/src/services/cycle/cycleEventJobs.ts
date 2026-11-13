/**
 * Scheduled battle-event job bodies, one per cron slot.
 *
 * Each job is a self-contained block (repair → execute → rebalance →
 * matchmaking) for its mode. `cycleScheduler` registers them, runs them
 * under its lock, and gates them during a Preparation_Phase.
 *
 * @module services/cycle/cycleEventJobs
 */

import logger from '../../config/logger';
import { repairRobotsForEvent } from '../economy/repairService';
import { executeScheduledBattles } from '../league/leagueBattleOrchestrator';
import { executeScheduledKothBattles } from '../koth/kothBattleOrchestrator';
import { rebalanceLeagues } from '../league/leagueRebalancingService';
import { runMatchmaking } from '../analytics/matchmakingService';
import {
  getActiveTournaments,
  getCurrentRoundMatches,
  advanceWinnersToNextRound,
  autoCreateNextTournament,
} from '../tournament/tournamentService';
import { executeSoloTournamentRound } from '../tournament/tournamentBattleOrchestrator';
import { executeScheduledTagTeamBattles } from '../tag-team/tagTeamBattleOrchestrator';
import { rebalanceTagTeamLeagues } from '../tag-team/tagTeamLeagueRebalancingService';
import { runTagTeamMatchmaking } from '../tag-team/tagTeamMatchmakingService';
import { runKothMatchmaking } from '../koth/kothMatchmakingService';
import { executeScheduledTeamBattles } from '../team-battle/teamBattleOrchestrator';
import { rebalanceTeamBattleLeagues } from '../team-battle/teamBattleAdapter';
import { runTeamBattleMatchmaking } from '../team-battle/teamBattleMatchmakingService';
import { executeTeamTournamentRound } from '../tournament/teamTournamentBattleOrchestrator';
import { autoCreateNextTeamTournament } from '../tournament/teamTournamentService';
import { executeScheduledGrandMeleeBattles } from '../grand-melee/grandMeleeBattleOrchestrator';
import { runGrandMeleeMatchmaking } from '../grand-melee/grandMeleeMatchmakingService';
import prisma from '../../lib/prisma';
import { JobContext } from '../notifications/integration';


export async function executeLeagueCycle(): Promise<JobContext> {
  // Step 1: Repair the robots fighting this slot (always first per Requirement 24.24)
  logger.info('League Cycle: Step 1 — Repairing robots with a 1v1 match queued');
  await repairRobotsForEvent('league_1v1');

  // Step 2: Execute scheduled league battles (1v1)
  logger.info('League Cycle: Step 2 — Executing scheduled league battles');
  const battleSummary = await executeScheduledBattles(new Date());
  logger.info(`League Cycle: ${battleSummary.totalBattles} league battles executed`);

  // Step 3: Rebalance leagues
  logger.info('League Cycle: Step 3 — Rebalancing leagues');
  const rebalanceSummary = await rebalanceLeagues();
  logger.info(`League Cycle: Rebalanced — ${rebalanceSummary.totalPromoted} promoted, ${rebalanceSummary.totalDemoted} demoted`);

  // Step 4: Schedule matchmaking (service handles 24h + rounding internally)
  logger.info('League Cycle: Step 4 — Scheduling league matchmaking');
  const matchesCreated = await runMatchmaking();
  logger.info(`League Cycle: ${matchesCreated} matches scheduled`);

  return { jobName: 'league', matchesCompleted: battleSummary.totalBattles };
}

export async function executeTournamentCycle(): Promise<JobContext> {
  // Step 1: Repair the robots fighting this slot (always first per Requirement 24.24)
  logger.info('Tournament Cycle: Step 1 — Repairing robots with a tournament match queued');
  await repairRobotsForEvent('tournament_1v1');
  logger.info('Tournament Cycle: Step 1 complete');

  // Step 2: Execute/schedule tournament matches
  logger.info('Tournament Cycle: Step 2 — Executing tournament matches');
  let totalMatchesExecuted = 0;
  let totalForfeits = 0;
  let totalRoundsExecuted = 0;
  let tournamentsCompleted = 0;

  const activeTournaments = await getActiveTournaments();
  let lastTournament: { name: string; currentRound: number; maxRounds: number } | null = null;

  for (const tournament of activeTournaments) {
    const currentRoundMatches = await getCurrentRoundMatches(tournament.id);
    logger.info(`Tournament Cycle: Tournament ${tournament.id} — ${currentRoundMatches.length} matches in round ${tournament.currentRound}`);

    if (currentRoundMatches.length > 0) {
      // Rule 7: one failing match never fails the job. The shared executor
      // resolves byes, fights matches and hands any error to the failure policy.
      const roundResult = await executeSoloTournamentRound(tournament.id);
      totalMatchesExecuted += roundResult.matchesExecuted + roundResult.byesResolved + roundResult.matchesResumed;
      totalForfeits += roundResult.forfeits;
      if (roundResult.errors.length > 0) {
        logger.warn(`Tournament Cycle: Tournament ${tournament.id} — ${roundResult.errors.length} match(es) handled by the failure policy: ${roundResult.errors.join('; ')}`);
      }

      // Step 3: Advance winners to next round
      logger.info(`Tournament Cycle: Step 3 — Advancing winners for tournament ${tournament.id}`);
      await advanceWinnersToNextRound(tournament.id);
      totalRoundsExecuted++;
    }

    // Check if tournament completed
    const updatedTournament = await prisma.tournament.findUnique({
      where: { id: tournament.id },
    });

    if (updatedTournament?.status === 'completed') {
      tournamentsCompleted++;
    }

    lastTournament = {
      name: tournament.name,
      currentRound: tournament.currentRound,
      maxRounds: tournament.maxRounds,
    };
  }

  logger.info(`Tournament Cycle: ${activeTournaments.length} tournaments processed, ${totalRoundsExecuted} rounds, ${totalMatchesExecuted} matches executed, ${totalForfeits} forfeits, ${tournamentsCompleted} completed`);

  // Step 4: Auto-create next tournament if none active. Never reached during a
  // Preparation_Phase: the scheduler skips every battle event job then (Spec #45).
  logger.info('Tournament Cycle: Step 4 — Auto-creating next tournament if needed');
  const nextTournament = await autoCreateNextTournament();
  if (nextTournament) {
    logger.info(`Tournament Cycle: Auto-created tournament "${nextTournament.name}"`);
    if (!lastTournament) {
      return {
        jobName: 'tournament',
        tournamentName: nextTournament.name,
        tournamentScheduled: true,
      };
    }
  } else {
    logger.info('Tournament Cycle: No new tournament needed (active tournament exists or not enough participants)');
  }

  if (lastTournament) {
    return {
      jobName: 'tournament',
      tournamentName: lastTournament.name,
      tournamentRound: lastTournament.currentRound,
      tournamentMaxRounds: lastTournament.maxRounds,
      matchesCompleted: totalMatchesExecuted,
    };
  }

  return { jobName: 'tournament' };
}

export async function executeTagTeamCycle(): Promise<JobContext> {
  // Step 1: Repair the robots fighting this slot (always first per Requirement 24.24)
  logger.info('Tag Team Cycle: Step 1 — Repairing robots with a tag team match queued');
  await repairRobotsForEvent('tag_team');

  // Step 2: Execute tag team battles (daily cadence — no parity check)
  logger.info('Tag Team Cycle: Step 2 — Executing tag team battles');
  const battleSummary = await executeScheduledTagTeamBattles(new Date());
  logger.info(`Tag Team Cycle: ${battleSummary.totalBattles} tag team battles executed (${battleSummary.forfeits} forfeits)`);

  // Step 3: Rebalance tag team leagues
  logger.info('Tag Team Cycle: Step 3 — Rebalancing tag team leagues');
  const rebalanceSummary = await rebalanceTagTeamLeagues();
  logger.info(`Tag Team Cycle: Rebalanced — ${rebalanceSummary.totalPromoted} promoted, ${rebalanceSummary.totalDemoted} demoted`);

  // Step 4: Schedule tag team matchmaking (service handles 24h + rounding internally)
  logger.info('Tag Team Cycle: Step 4 — Scheduling tag team matchmaking');
  const matchesCreated = await runTagTeamMatchmaking();
  logger.info(`Tag Team Cycle: ${matchesCreated} tag team matches scheduled`);

  return { jobName: 'tag-team', matchesCompleted: battleSummary.totalBattles };
}


// --- KotH cycle handler ---

export async function executeKothCycle(): Promise<JobContext> {
  // Step 1: Repair the robots fighting this slot — everyone else keeps the
  // option of the cheaper manual repair (issue #411)
  logger.info('KotH Cycle: Step 1 — Repairing robots with a KotH match queued');
  await repairRobotsForEvent('koth');

  // Step 2: Execute scheduled KotH battles
  logger.info('KotH Cycle: Step 2 — Executing scheduled KotH battles');
  const battleSummary = await executeScheduledKothBattles(new Date());
  logger.info(`KotH Cycle: ${battleSummary.successfulMatches} KotH matches executed (${battleSummary.failedMatches} failed, ${battleSummary.belowMinimumMatches} below minimum, ${battleSummary.forfeitedRobots} robots forfeited)`);

  // Step 3: Rebalance KotH leagues (same system as other leagues — top 10% promoted, bottom 10% demoted)
  logger.info('KotH Cycle: Step 3 — Rebalancing KotH leagues');
  const { rebalanceKothLeagues } = await import('../league/leagueRebalancingService');
  const rebalanceSummary = await rebalanceKothLeagues();
  logger.info(`KotH Cycle: Rebalanced — ${rebalanceSummary.totalPromoted} promoted, ${rebalanceSummary.totalDemoted} demoted`);

  // Step 4: Schedule KotH matchmaking (service handles 24h + rounding internally)
  logger.info('KotH Cycle: Step 4 — Scheduling KotH matchmaking');
  const matchesCreated = await runKothMatchmaking();
  logger.info(`KotH Cycle: ${matchesCreated} KotH matches scheduled`);

  return { jobName: 'koth', matchesCompleted: battleSummary.successfulMatches };
}

// --- Grand Melee cycle handler (Spec #44: R7.1–R7.6) ---

export async function executeGrandMeleeCycle(): Promise<JobContext> {
  // Step 1: Repair the robots fighting this slot (same as all other battle modes)
  logger.info('Grand Melee Cycle: Step 1 — Repairing robots with a Grand Melee match queued');
  await repairRobotsForEvent('grand_melee');

  // Step 2: Execute all scheduled Grand Melee battles
  logger.info('Grand Melee Cycle: Step 2 — Executing scheduled Grand Melee battles');
  const execResult = await executeScheduledGrandMeleeBattles();
  logger.info(`Grand Melee Cycle: ${execResult.successfulMatches} matches executed (${execResult.failedMatches} failed, ${execResult.belowMinimumMatches} below minimum, ${execResult.forfeitedRobots} robots forfeited)`);

  // Step 3: Rebalance Grand Melee leagues (promotion/demotion)
  logger.info('Grand Melee Cycle: Step 3 — Rebalancing Grand Melee leagues');
  const { rebalanceGrandMeleeLeagues } = await import('../league/leagueRebalancingService');
  const rebalanceSummary = await rebalanceGrandMeleeLeagues();
  logger.info(`Grand Melee Cycle: Rebalanced — ${rebalanceSummary.totalPromoted} promoted, ${rebalanceSummary.totalDemoted} demoted`);

  // Step 4: Run matchmaking for next cycle
  logger.info('Grand Melee Cycle: Step 4 — Scheduling Grand Melee matchmaking');
  const matchesCreated = await runGrandMeleeMatchmaking();
  logger.info(`Grand Melee Cycle: ${matchesCreated} Grand Melee matches scheduled`);

  return { jobName: 'grandMelee', matchesCompleted: execResult.successfulMatches };
}

// --- Team Battle cycle handlers ---

export async function executeTeam2v2LeagueCycle(): Promise<JobContext> {
  // Step 1: Repair the robots fighting this slot (always first per Requirement 24.24)
  logger.info('Team 2v2 League Cycle: Step 1 — Repairing robots with a 2v2 match queued');
  await repairRobotsForEvent('league_2v2');

  // Step 2: Execute scheduled 2v2 team battles
  logger.info('Team 2v2 League Cycle: Step 2 — Executing scheduled 2v2 team battles');
  const execResult = await executeScheduledTeamBattles(2);
  logger.info(`Team 2v2 League Cycle: ${execResult.matchesCompleted} team battles executed (${execResult.matchesCancelled} cancelled)`);

  // Step 3: Rebalance 2v2 league tiers
  logger.info('Team 2v2 League Cycle: Step 3 — Rebalancing 2v2 league tiers');
  const rebalanceSummary = await rebalanceTeamBattleLeagues(2);
  logger.info(`Team 2v2 League Cycle: Rebalanced — ${rebalanceSummary.totalPromoted} promoted, ${rebalanceSummary.totalDemoted} demoted`);

  // Step 4: Run 2v2 matchmaking (service handles 24h + rounding internally)
  logger.info('Team 2v2 League Cycle: Step 4 — Scheduling 2v2 matchmaking');
  const matchesCreated = await runTeamBattleMatchmaking(2);
  logger.info(`Team 2v2 League Cycle: ${matchesCreated} matches scheduled`);

  return { jobName: 'team2v2League', matchesCompleted: execResult.matchesCompleted };
}

export async function executeTeam3v3LeagueCycle(): Promise<JobContext> {
  // Step 1: Repair the robots fighting this slot (always first per Requirement 24.24)
  logger.info('Team 3v3 League Cycle: Step 1 — Repairing robots with a 3v3 match queued');
  await repairRobotsForEvent('league_3v3');

  // Step 2: Execute scheduled 3v3 team battles
  logger.info('Team 3v3 League Cycle: Step 2 — Executing scheduled 3v3 team battles');
  const execResult = await executeScheduledTeamBattles(3);
  logger.info(`Team 3v3 League Cycle: ${execResult.matchesCompleted} team battles executed (${execResult.matchesCancelled} cancelled)`);

  // Step 3: Rebalance 3v3 league tiers
  logger.info('Team 3v3 League Cycle: Step 3 — Rebalancing 3v3 league tiers');
  const rebalanceSummary = await rebalanceTeamBattleLeagues(3);
  logger.info(`Team 3v3 League Cycle: Rebalanced — ${rebalanceSummary.totalPromoted} promoted, ${rebalanceSummary.totalDemoted} demoted`);

  // Step 4: Run 3v3 matchmaking (service handles 24h + rounding internally)
  logger.info('Team 3v3 League Cycle: Step 4 — Scheduling 3v3 matchmaking');
  const matchesCreated = await runTeamBattleMatchmaking(3);
  logger.info(`Team 3v3 League Cycle: ${matchesCreated} matches scheduled`);

  return { jobName: 'team3v3League', matchesCompleted: execResult.matchesCompleted };
}

// --- Team Tournament cycle handlers ---

/**
 * Shared team tournament cycle handler for both 2v2 and 3v3 (Spec #46 R1).
 *
 * Control flow mirrors `executeTournamentCycle()` for 1v1: process the active
 * tournament's round when one exists, then fall through to Tournament_Auto_Creation
 * on EVERY run. Previously both team handlers returned from inside the
 * active-tournament branch, so the run that completed a final round never
 * reached auto-creation and each tournament cost an idle cycle (R1.1, R1.2).
 *
 * The active-tournament and participant-shortfall guards live inside
 * `autoCreateNextTeamTournament()`, so a still-active tournament creates
 * nothing and a shortfall is logged there (R1.3, R1.4).
 */
async function executeTeamTournamentCycle(teamSize: 2 | 3): Promise<JobContext> {
  const jobName = teamSize === 2 ? 'team2v2Tournament' : 'team3v3Tournament';
  const label = `Team ${teamSize}v${teamSize} Tournament Cycle`;
  const participantType = teamSize === 2 ? 'team_2v2' : 'team_3v3';

  // Step 1: Repair the robots fighting this slot (pre-match repair)
  logger.info(`${label}: Step 1 — Repairing robots with a ${teamSize}v${teamSize} tournament match queued`);
  await repairRobotsForEvent(teamSize === 2 ? 'tournament_2v2' : 'tournament_3v3');

  // Step 2: Execute the active tournament's round, if one is active
  const activeTournament = await prisma.tournament.findFirst({
    where: { participantType, status: 'active' },
  });

  let processed: { name: string; currentRound: number; maxRounds: number } | null = null;
  let matchesCompleted = 0;

  if (activeTournament) {
    logger.info(`${label}: Step 2 — Executing round ${activeTournament.currentRound}`);
    const roundResult = await executeTeamTournamentRound(activeTournament.id, teamSize);

    // Advance winners to next round (handles completion detection internally)
    await advanceWinnersToNextRound(activeTournament.id);

    matchesCompleted = roundResult.matchesExecuted;
    processed = {
      name: activeTournament.name,
      currentRound: activeTournament.currentRound,
      maxRounds: activeTournament.maxRounds,
    };
  }

  // Step 3: Attempt auto-creation on every run, including the run that just
  // completed a final round (R1.1, R1.2, R1.5). Never reached during a
  // Preparation_Phase: the scheduler skips every battle event job then (Spec #45).
  logger.info(`${label}: Step 3 — Attempting auto-creation`);
  const newTournament = await autoCreateNextTeamTournament(teamSize);

  if (newTournament) {
    logger.info(`${label}: Created "${newTournament.name}"`);
    // Only report the new tournament when no round was processed this run,
    // matching the 1v1 handler's JobContext convention (R1.6)
    if (!processed) {
      return { jobName, tournamentName: newTournament.name, tournamentScheduled: true };
    }
  }

  if (processed) {
    return {
      jobName,
      matchesCompleted,
      tournamentName: processed.name,
      tournamentRound: processed.currentRound,
      tournamentMaxRounds: processed.maxRounds,
    };
  }

  logger.info(`${label}: Skipped — insufficient eligible teams`);
  return { jobName };
}

export async function executeTeam2v2TournamentCycle(): Promise<JobContext> {
  return executeTeamTournamentCycle(2);
}

export async function executeTeam3v3TournamentCycle(): Promise<JobContext> {
  return executeTeamTournamentCycle(3);
}

// --- Reserved-slot stub handler factory ---

/**
 * Creates a no-op handler for a reserved cron slot.
 * The stub logs an info message with the event name and cycle number,
 * then returns successfully. It does NOT trigger monitoring alerts or
 * count as a failure — the notification system only dispatches for
 * known JobName values, so unknown names fall through silently.
 *
 * Future specs replace these stubs with real handlers without modifying
 * env.ts or the slot map.
 */
export function createReservedSlotHandler(eventName: string): () => Promise<JobContext> {
  return async (): Promise<JobContext> => {
    const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    const cycleNumber = cycleMetadata?.totalCycles ?? 0;
    logger.info(
      `Scheduler: reserved slot "${eventName}" fired (cycle ${cycleNumber}) — reserved slot, no handler implemented yet`
    );
    return { jobName: eventName as JobContext['jobName'] };
  };
}

