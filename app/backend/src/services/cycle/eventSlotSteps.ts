/**
 * The step sequence of every battle-event slot, shared by the scheduled cron
 * jobs (`cycleEventJobs`) and the admin bulk cycle runner (`adminCycleSteps`).
 *
 * Each slot is repair → execute → rebalance → matchmaking for its mode
 * (tournaments: repair → rounds → auto-create). Both runners call these
 * functions, so a manual cycle can no longer drift from the cron behaviour.
 * The runners differ only in how steps are recorded: the cron runner logs
 * them, the admin runner also writes them to the cycle event log.
 *
 * @module services/cycle/eventSlotSteps
 */

import logger from '../../config/logger';
import prisma from '../../lib/prisma';
import { repairRobotsForEvent } from '../economy/repairService';
import { executeScheduledBattles } from '../league/leagueBattleOrchestrator';
import {
  rebalanceLeagues,
  rebalanceKothLeagues,
  rebalanceGrandMeleeLeagues,
} from '../league/leagueRebalancingService';
import { runMatchmaking } from '../analytics/matchmakingService';
import { executeScheduledTagTeamBattles } from '../tag-team/tagTeamBattleOrchestrator';
import { rebalanceTagTeamLeagues } from '../tag-team/tagTeamLeagueRebalancingService';
import { runTagTeamMatchmaking } from '../tag-team/tagTeamMatchmakingService';
import { executeScheduledKothBattles } from '../koth/kothBattleOrchestrator';
import { runKothMatchmaking } from '../koth/kothMatchmakingService';
import { executeScheduledGrandMeleeBattles } from '../grand-melee/grandMeleeBattleOrchestrator';
import { runGrandMeleeMatchmaking } from '../grand-melee/grandMeleeMatchmakingService';
import { executeScheduledTeamBattles, type TeamBattleExecutionResult } from '../team-battle/teamBattleOrchestrator';
import { rebalanceTeamBattleLeagues } from '../team-battle/teamBattleAdapter';
import { runTeamBattleMatchmaking } from '../team-battle/teamBattleMatchmakingService';
import {
  getActiveTournaments,
  getCurrentRoundMatches,
  advanceWinnersToNextRound,
  autoCreateNextTournament,
} from '../tournament/tournamentService';
import { executeSoloTournamentRound } from '../tournament/tournamentBattleOrchestrator';
import { executeTeamTournamentRound } from '../tournament/teamTournamentBattleOrchestrator';
import { autoCreateNextTeamTournament } from '../tournament/teamTournamentService';

// ─── Step runner ─────────────────────────────────────────────────────

/** Runs and records one named step of a slot. */
export interface SlotStepRunner {
  run<T>(
    label: string,
    name: string,
    fn: () => Promise<T>,
    details: (result: T) => Record<string, unknown>,
  ): Promise<T>;
}

/**
 * Step runner for the cron jobs: logs `<prefix>: Step N — label` and the step's details.
 * A step that returns nothing (a mocked or void service) logs empty details.
 */
export function createLoggingStepRunner(prefix: string): SlotStepRunner {
  let stepNumber = 0;
  return {
    async run(label, _name, fn, details) {
      stepNumber++;
      logger.info(`${prefix}: Step ${stepNumber} — ${label}`);
      const result = await fn();
      logger.info(`${prefix}: ${label} — ${JSON.stringify(result === undefined || result === null ? {} : details(result))}`);
      return result;
    },
  };
}

type RepairResult = Awaited<ReturnType<typeof repairRobotsForEvent>>;

const repairDetails = (r: RepairResult): Record<string, unknown> => ({
  robotsRepaired: r.robotsRepaired,
  totalCost: r.totalFinalCost,
});

const rebalanceDetails = (r: { totalPromoted: number; totalDemoted: number }): Record<string, unknown> => ({
  promotions: r.totalPromoted,
  demotions: r.totalDemoted,
});

const matchmakingDetails = (matchesCreated: number): Record<string, unknown> => ({ matchesCreated });

// ─── League-style slots ──────────────────────────────────────────────

/** SLOT 1: 1v1 League. */
export async function runLeague1v1Slot(steps: SlotStepRunner): Promise<{
  repair: RepairResult;
  battles: Awaited<ReturnType<typeof executeScheduledBattles>>;
  rebalancing: Awaited<ReturnType<typeof rebalanceLeagues>>;
  matchesCreated: number;
}> {
  const repair = await steps.run(
    'Repair Scheduled Robots (pre-league)', 'repair_pre_league',
    () => repairRobotsForEvent('league_1v1'), repairDetails,
  );
  const battles = await steps.run(
    'Execute League Battles (1v1)', 'execute_league_battles',
    () => executeScheduledBattles(new Date()),
    (r) => ({ battlesExecuted: r.totalBattles }),
  );
  const rebalancing = await steps.run('Rebalance Leagues', 'rebalance_leagues', () => rebalanceLeagues(), rebalanceDetails);
  // Matchmaking (24h lead time, rounded inside the service)
  const matchesCreated = await steps.run(
    'Matchmaking for Leagues (1v1)', 'matchmaking_leagues', () => runMatchmaking(), matchmakingDetails,
  );
  return { repair, battles, rebalancing, matchesCreated };
}

/**
 * SLOTS 2 and 6: Team 2v2 / 3v3 League.
 *
 * @param progress - receives the battle summary as soon as battles ran, so a
 *   caller that catches a later step's failure can still report the battles
 */
export async function runTeamLeagueSlot(
  steps: SlotStepRunner,
  teamSize: 2 | 3,
  progress: { battles?: TeamBattleExecutionResult } = {},
): Promise<{
  repair: RepairResult;
  battles: TeamBattleExecutionResult;
  rebalancing: Awaited<ReturnType<typeof rebalanceTeamBattleLeagues>>;
  matchesCreated: number;
}> {
  const mode = `${teamSize}v${teamSize}`;
  const repair = await steps.run(
    `Repair Scheduled Robots (pre-team-${mode}-league)`, `repair_pre_team_${mode}_league`,
    () => repairRobotsForEvent(teamSize === 2 ? 'league_2v2' : 'league_3v3'), repairDetails,
  );
  const battles = await steps.run(
    `Execute Team ${mode} League Battles`, `execute_team_${mode}_battles`,
    () => executeScheduledTeamBattles(teamSize),
    (r) => ({ matchesCompleted: r.matchesCompleted, matchesCancelled: r.matchesCancelled }),
  );
  progress.battles = battles;
  const rebalancing = await steps.run(
    `Rebalance Team ${mode} Leagues`, `rebalance_team_${mode}_leagues`,
    () => rebalanceTeamBattleLeagues(teamSize), rebalanceDetails,
  );
  const matchesCreated = await steps.run(
    `Matchmaking for Team ${mode} League`, `matchmaking_team_${mode}`,
    () => runTeamBattleMatchmaking(teamSize), matchmakingDetails,
  );
  return { repair, battles, rebalancing, matchesCreated };
}

/** SLOT 4: Tag Team. */
export async function runTagTeamSlot(steps: SlotStepRunner): Promise<{
  repair: RepairResult;
  battles: Awaited<ReturnType<typeof executeScheduledTagTeamBattles>>;
  rebalancing: Awaited<ReturnType<typeof rebalanceTagTeamLeagues>>;
  matchesCreated: number;
}> {
  const repair = await steps.run(
    'Repair Scheduled Robots (pre-tag-team)', 'repair_pre_tag_team',
    () => repairRobotsForEvent('tag_team'), repairDetails,
  );
  const battles = await steps.run(
    'Execute Tag Team Battles', 'execute_tag_team_battles',
    () => executeScheduledTagTeamBattles(new Date()),
    (r) => ({ battlesExecuted: r?.totalBattles || 0, forfeits: r?.forfeits || 0 }),
  );
  const rebalancing = await steps.run(
    'Rebalance Tag Team Leagues', 'rebalance_tag_team_leagues', () => rebalanceTagTeamLeagues(), rebalanceDetails,
  );
  const matchesCreated = await steps.run(
    'Matchmaking for Tag Teams', 'matchmaking_tag_teams', () => runTagTeamMatchmaking(), matchmakingDetails,
  );
  return { repair, battles, rebalancing, matchesCreated };
}

/** SLOT 5: King of the Hill. */
export async function runKothSlot(steps: SlotStepRunner): Promise<{
  repair: RepairResult;
  battles: Awaited<ReturnType<typeof executeScheduledKothBattles>>;
  rebalancing: Awaited<ReturnType<typeof rebalanceKothLeagues>>;
  matchesCreated: number;
}> {
  const repair = await steps.run(
    'Repair Scheduled Robots (pre-koth)', 'repair_pre_koth', () => repairRobotsForEvent('koth'), repairDetails,
  );
  const battles = await steps.run(
    'Execute Scheduled KotH Battles', 'execute_koth_battles',
    () => executeScheduledKothBattles(new Date()),
    (r) => ({
      battlesExecuted: r.successfulMatches,
      failedMatches: r.failedMatches,
      belowMinimumMatches: r.belowMinimumMatches,
      forfeitedRobots: r.forfeitedRobots,
    }),
  );
  const rebalancing = await steps.run(
    'Rebalance KotH Leagues', 'rebalance_koth_leagues', () => rebalanceKothLeagues(), rebalanceDetails,
  );
  const matchesCreated = await steps.run(
    'KotH Matchmaking', 'matchmaking_koth', () => runKothMatchmaking(), matchmakingDetails,
  );
  return { repair, battles, rebalancing, matchesCreated };
}

/** SLOT 8: Grand Melee (Spec #44: R7.1–R7.6). */
export async function runGrandMeleeSlot(steps: SlotStepRunner): Promise<{
  repair: RepairResult;
  battles: Awaited<ReturnType<typeof executeScheduledGrandMeleeBattles>>;
  rebalancing: Awaited<ReturnType<typeof rebalanceGrandMeleeLeagues>>;
  matchesCreated: number;
}> {
  const repair = await steps.run(
    'Repair Scheduled Robots (pre-grand-melee)', 'repair_pre_grand_melee',
    () => repairRobotsForEvent('grand_melee'), repairDetails,
  );
  const battles = await steps.run(
    'Execute Grand Melee Battles', 'execute_grand_melee_battles',
    () => executeScheduledGrandMeleeBattles(),
    (r) => ({
      battlesExecuted: r.successfulMatches,
      failedMatches: r.failedMatches,
      belowMinimumMatches: r.belowMinimumMatches,
      forfeitedRobots: r.forfeitedRobots,
    }),
  );
  const rebalancing = await steps.run(
    'Rebalance Grand Melee Leagues', 'rebalance_grand_melee_leagues', () => rebalanceGrandMeleeLeagues(), rebalanceDetails,
  );
  const matchesCreated = await steps.run(
    'Grand Melee Matchmaking', 'matchmaking_grand_melee', () => runGrandMeleeMatchmaking(), matchmakingDetails,
  );
  return { repair, battles, rebalancing, matchesCreated };
}

// ─── Tournament slots ────────────────────────────────────────────────

/** Result shape for the 1v1 tournament execution step. */
export interface TournamentStepSummary {
  tournamentsExecuted?: number;
  roundsExecuted?: number;
  matchesExecuted?: number;
  /** Bracket Bye_Events resolved and paid this run (Spec #49). */
  byeMatchesResolved?: number;
  /** Matches resolved as battle-time forfeits (single or double; nothing simulated). */
  forfeits?: number;
  tournamentsCompleted?: number;
  tournamentsCreated?: number;
  errors?: string[];
  error?: string;
}

/** A tournament processed or created by the 1v1 tournament step. */
export interface TournamentRef {
  name: string;
  currentRound: number;
  maxRounds: number;
}

/**
 * Execute the current round of every active 1v1 tournament, advance winners,
 * then auto-create the next tournament when none is active.
 *
 * Rule 7: one failing tournament never fails the run; its error is listed in
 * `summary.errors`. Auto-creation is never reached during a Preparation_Phase:
 * the scheduler skips every battle event job then (Spec #45).
 *
 * @returns the summary, the last active tournament processed, and the
 *   tournament created this run (if any)
 */
export async function executeSoloTournaments(): Promise<{
  summary: TournamentStepSummary;
  lastTournament: TournamentRef | null;
  createdTournament: { name: string } | null;
}> {
  const summary: TournamentStepSummary = {
    tournamentsExecuted: 0,
    roundsExecuted: 0,
    matchesExecuted: 0,
    byeMatchesResolved: 0,
    forfeits: 0,
    tournamentsCompleted: 0,
    tournamentsCreated: 0,
    errors: [],
  };
  let lastTournament: TournamentRef | null = null;
  let createdTournament: { name: string } | null = null;

  try {
    const activeTournaments = await getActiveTournaments();

    for (const tournament of activeTournaments) {
      try {
        const currentRoundMatches = await getCurrentRoundMatches(tournament.id);
        logger.info(`[Tournaments] Tournament ${tournament.id} — ${currentRoundMatches.length} matches in round ${tournament.currentRound}`);

        if (currentRoundMatches.length > 0) {
          // The shared executor resolves byes, fights matches and hands any
          // error to the failure policy.
          const roundResult = await executeSoloTournamentRound(tournament.id);
          summary.matchesExecuted! += roundResult.matchesExecuted + roundResult.byesResolved + roundResult.matchesResumed;
          summary.byeMatchesResolved! += roundResult.byesResolved;
          summary.forfeits! += roundResult.forfeits;
          for (const err of roundResult.errors) {
            summary.errors!.push(`Tournament ${tournament.id} ${err}`);
          }

          await advanceWinnersToNextRound(tournament.id);
          summary.roundsExecuted!++;
        }

        summary.tournamentsExecuted!++;

        const updatedTournament = await prisma.tournament.findUnique({ where: { id: tournament.id } });
        if (updatedTournament?.status === 'completed') {
          summary.tournamentsCompleted!++;
        }
        lastTournament = {
          name: tournament.name,
          currentRound: tournament.currentRound,
          maxRounds: tournament.maxRounds,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        summary.errors!.push(`Tournament ${tournament.id}: ${errorMsg}`);
      }
    }

    try {
      const nextTournament = await autoCreateNextTournament();
      if (nextTournament) {
        summary.tournamentsCreated!++;
        createdTournament = { name: nextTournament.name };
        logger.info(`[Tournaments] Auto-created tournament "${nextTournament.name}"`);
      } else {
        logger.info('[Tournaments] No new tournament needed (active tournament exists or not enough participants)');
      }
    } catch (error) {
      logger.error('[Tournaments] Failed to auto-create tournament:', error);
    }
  } catch (error) {
    logger.error('[Tournaments] Tournament execution error:', error);
    return { summary: { error: error instanceof Error ? error.message : String(error) }, lastTournament, createdTournament };
  }

  if (summary.errors!.length > 0) {
    logger.warn(`[Tournaments] ${summary.errors!.length} error(s) handled: ${summary.errors!.join('; ')}`);
  }
  return { summary, lastTournament, createdTournament };
}

/** SLOT 3: 1v1 Tournament (repair → rounds/advance/auto-create). */
export async function runSoloTournamentSlot(
  steps: SlotStepRunner,
  includeTournaments = true,
): Promise<{
  repair: RepairResult;
  tournaments: Awaited<ReturnType<typeof executeSoloTournaments>> | null;
}> {
  const repair = await steps.run(
    'Repair Scheduled Robots (pre-tournament)', 'repair_pre_tournament',
    () => repairRobotsForEvent('tournament_1v1'), repairDetails,
  );
  const tournaments = await steps.run(
    'Tournament Execution / Scheduling', 'tournament_execution',
    async () => (includeTournaments ? executeSoloTournaments() : null),
    (r) => ({
      tournamentsExecuted: r?.summary.tournamentsExecuted || 0,
      matchesExecuted: r?.summary.matchesExecuted || 0,
      forfeits: r?.summary.forfeits || 0,
    }),
  );
  return { repair, tournaments };
}

/** Outcome of one team tournament slot run. */
export interface TeamTournamentSlotOutcome {
  repair: RepairResult;
  /** The active tournament whose round ran, if any. */
  processed: (TournamentRef & { matchesExecuted: number; matchesFailed: number }) | null;
  /** The tournament auto-created this run, if any. */
  created: { name: string } | null;
}

/**
 * SLOTS 7 and 9: Team 2v2 / 3v3 Tournament (Spec #46 R1).
 *
 * Runs the active tournament's round when one exists, then attempts
 * auto-creation on EVERY run, including the run that completed a final round,
 * so a finished tournament never costs an idle cycle. The active-tournament
 * and participant-shortfall guards live in `autoCreateNextTeamTournament()`.
 */
export async function runTeamTournamentSlot(steps: SlotStepRunner, teamSize: 2 | 3): Promise<TeamTournamentSlotOutcome> {
  const mode = `${teamSize}v${teamSize}`;
  const repair = await steps.run(
    `Repair Scheduled Robots (pre-team-${mode}-tournament)`, `repair_pre_team_${mode}_tournament`,
    () => repairRobotsForEvent(teamSize === 2 ? 'tournament_2v2' : 'tournament_3v3'), repairDetails,
  );

  const { processed, created } = await steps.run(
    `Execute Team ${mode} Tournament`, `team_${mode}_tournament_execution`,
    async () => {
      const active = await prisma.tournament.findFirst({
        where: { participantType: teamSize === 2 ? 'team_2v2' : 'team_3v3', status: 'active' },
      });
      let processedRound: TeamTournamentSlotOutcome['processed'] = null;
      if (active) {
        logger.info(`[Tournaments] Team ${mode}: executing round ${active.currentRound} of "${active.name}"`);
        const roundResult = await executeTeamTournamentRound(active.id, teamSize);
        // Handles bracket completion internally
        await advanceWinnersToNextRound(active.id);
        processedRound = {
          name: active.name,
          currentRound: active.currentRound,
          maxRounds: active.maxRounds,
          matchesExecuted: roundResult.matchesExecuted,
          matchesFailed: roundResult.matchesFailed,
        };
      }

      const newTournament = await autoCreateNextTeamTournament(teamSize);
      if (newTournament) {
        logger.info(`[Tournaments] Team ${mode}: auto-created "${newTournament.name}"`);
      } else if (!processedRound) {
        logger.info(`[Tournaments] Team ${mode}: Skipped — insufficient eligible teams`);
      }
      return { processed: processedRound, created: newTournament ? { name: newTournament.name } : null };
    },
    (r) => ({ matchesExecuted: r.processed?.matchesExecuted ?? 0, tournamentCreated: r.created !== null }),
  );

  return { repair, processed, created };
}
