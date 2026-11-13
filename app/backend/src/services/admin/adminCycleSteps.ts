/**
 * Admin bulk cycle event blocks.
 *
 * One function per slot-map event, each a self-contained block (repair →
 * execute → rebalance → matchmaking) mirroring the production cron handlers.
 * `executeBulkCycles` in `adminCycleService` runs them in slot-map order and
 * owns settlement and the financial cutover.
 *
 * Every step is numbered in run order and recorded with
 * `logCycleStepComplete`; the step names are part of the cycle event log.
 *
 * @module services/admin/adminCycleSteps
 */

import { executeScheduledBattles } from '../league/leagueBattleOrchestrator';
import { executeScheduledKothBattles } from '../koth/kothBattleOrchestrator';
import { runMatchmaking } from '../analytics/matchmakingService';
import { runKothMatchmaking } from '../koth/kothMatchmakingService';
import { rebalanceLeagues } from '../league/leagueRebalancingService';
import { rebalanceTagTeamLeagues } from '../tag-team/tagTeamLeagueRebalancingService';
import { runTagTeamMatchmaking } from '../tag-team/tagTeamMatchmakingService';
import { executeScheduledTagTeamBattles } from '../tag-team/tagTeamBattleOrchestrator';
import { executeScheduledTeamBattles, type TeamBattleExecutionResult } from '../team-battle/teamBattleOrchestrator';
import { rebalanceTeamBattleLeagues } from '../team-battle/teamBattleAdapter';
import { runTeamBattleMatchmaking } from '../team-battle/teamBattleMatchmakingService';
import { topUpGeneratedStables, type GeneratedStableTopUpResult } from '../../utils/userGeneration';
import { repairRobotsForEvent } from '../economy/repairService';
import {
  getActiveTournaments,
  getCurrentRoundMatches,
  autoCreateNextTournament,
  advanceWinnersToNextRound,
} from '../tournament/tournamentService';
import { executeSoloTournamentRound } from '../tournament/tournamentBattleOrchestrator';
import { executeTeamTournamentRound } from '../tournament/teamTournamentBattleOrchestrator';
import { autoCreateNextTeamTournament } from '../tournament/teamTournamentService';
import type { EventLogger } from '../common/eventLogger';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import type { TurnStepInput, TurnStepOutcome } from '../automaton/automatonTurnService';

// ─── Result shapes ───────────────────────────────────────────────────

/** Result of a team league block (2v2 or 3v3). */
export type TeamLeagueBlockResult =
  | { battles: unknown; rebalancing: unknown; matchmaking: unknown }
  | { error: string };

/** Result of a team tournament block (2v2 or 3v3). */
export type TeamTournamentBlockResult =
  | { skipped: true; message: string }
  | {
    repair: unknown;
    matchesExecuted: number;
    matchesFailed: number;
    tournamentName?: string;
    tournamentRound?: number;
    tournamentMaxRounds?: number;
    tournamentCreated?: boolean;
    skippedReason?: string;
  };

/** Result shape for the Grand Melee block of a bulk cycle. */
// A type alias (not an interface) so it stays assignable to the event logger's Record<string, unknown>.
export type GrandMeleeBlockSummary = {
  matchesExecuted: number;
  matchesFailed: number;
  /** Matches whose ready field fell below the minimum at battle time (byes and forfeits instead of a fight). */
  belowMinimumMatches: number;
  /** Robots placed last because they had no main weapon at battle time. */
  forfeitedRobots: number;
  matchesCreated: number;
};

/** Result shape for tournament execution step. */
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

// ─── Step runner ─────────────────────────────────────────────────────

/** Numbers the steps of one cycle and records each completed step. */
export class CycleStepRunner {
  private stepNumber = 0;

  constructor(
    private readonly eventLogger: EventLogger,
    readonly cycleNumber: number,
  ) {}

  /** Take the next step number and log `[Admin] Step N: label`. */
  next(label: string): number {
    this.stepNumber++;
    logger.info(`[Admin] Step ${this.stepNumber}: ${label}`);
    return this.stepNumber;
  }

  /** Record a completed step in the cycle event log. */
  async complete(step: number, name: string, durationMs: number, details: Record<string, unknown>): Promise<void> {
    await this.eventLogger.logCycleStepComplete(this.cycleNumber, name, step, durationMs, details);
  }

  /** Run one timed step and record it. A throwing step is not recorded. */
  async run<T>(
    label: string,
    name: string,
    fn: () => Promise<T>,
    details: (result: T) => Record<string, unknown>,
  ): Promise<T> {
    const step = this.next(label);
    const start = Date.now();
    const result = await fn();
    await this.complete(step, name, Date.now() - start, details(result));
    return result;
  }
}

// ─── Non-fatal helpers ───────────────────────────────────────────────

/**
 * Top up the generated stables to `GENERATED_STABLE_TARGET` for a manual run
 * (the "generateUsersPerCycle" option). A failure is reported in the cycle
 * result instead of failing the run, as before.
 */
export async function topUpGeneratedStablesForAdmin(): Promise<GeneratedStableTopUpResult | { error: string }> {
  try {
    const summary = await topUpGeneratedStables();
    logger.info(`[Admin] Generated stables: created ${summary.usersCreated} (had ${summary.existingBefore}, target ${summary.target})`);
    return summary;
  } catch (error) {
    logger.error(`[Admin] Error topping up generated stables:`, error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Run an Automaton Turn_Step for a bulk cycle (Spec #55 R7.3, R7.4) and
 * return its outcome for the bulk response. Never throws (R7.8).
 */
export async function runAutomatonTurnStep(input: TurnStepInput): Promise<TurnStepOutcome> {
  try {
    const { runTurnStepNonFatal } = await import('../automaton');
    return await runTurnStepNonFatal(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Admin] Automaton Turn_Step failed (non-fatal) — ${message}`);
    return { ok: false, code: 'UNEXPECTED_ERROR', message };
  }
}

/**
 * Execute tournament rounds, advance winners, and auto-create next tournament.
 * Shared by both the cycles=0 tournament-only path and the full cycle pipeline.
 */
export async function executeTournamentStep(): Promise<TournamentStepSummary> {
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

  try {
    const activeTournaments = await getActiveTournaments();

    for (const tournament of activeTournaments) {
      try {
        const currentRoundMatches = await getCurrentRoundMatches(tournament.id);

        if (currentRoundMatches.length > 0) {
          // Shared executor (rule 7): byes, fought matches and the failure
          // policy, identical to the cron path.
          const roundResult = await executeSoloTournamentRound(tournament.id);
          summary.matchesExecuted! += roundResult.matchesExecuted + roundResult.byesResolved + roundResult.matchesResumed;
          summary.byeMatchesResolved = (summary.byeMatchesResolved ?? 0) + roundResult.byesResolved;
          summary.forfeits = (summary.forfeits ?? 0) + roundResult.forfeits;
          for (const err of roundResult.errors) {
            summary.errors!.push(`Tournament ${tournament.id} ${err}`);
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

// ─── Event blocks (slot map order) ───────────────────────────────────

/** SLOT 1: 1v1 League (repair → execute → rebalance → matchmaking). */
export async function runLeague1v1Block(steps: CycleStepRunner): Promise<{
  battles: Awaited<ReturnType<typeof executeScheduledBattles>>;
  repair: unknown;
  rebalancing: unknown;
  matchmaking: { matchesCreated: number };
}> {
  logger.info(`[Admin] Slot 1: 1v1 League`);
  const repair = await steps.run(
    'Repair Scheduled Robots (pre-league)', 'repair_pre_league',
    () => repairRobotsForEvent('league_1v1', true, steps.cycleNumber),
    (r) => ({ robotsRepaired: r.robotsRepaired, totalCost: r.totalFinalCost }),
  );
  const battles = await steps.run(
    'Execute League Battles (1v1)', 'execute_league_battles',
    () => executeScheduledBattles(new Date()),
    (r) => ({ battlesExecuted: r.totalBattles }),
  );
  const rebalancing = await steps.run(
    'Rebalance Leagues', 'rebalance_leagues',
    () => rebalanceLeagues(),
    (r) => ({ promotions: r.totalPromoted, demotions: r.totalDemoted }),
  );
  // Matchmaking (24h lead time)
  const matchesCreated = await steps.run(
    'Matchmaking for Leagues (1v1)', 'matchmaking_leagues',
    () => runMatchmaking(),
    (r) => ({ matchesCreated: r }),
  );
  return { battles, repair, rebalancing, matchmaking: { matchesCreated } };
}

/**
 * SLOTS 2 and 6: Team 2v2 / 3v3 League (repair → execute → rebalance →
 * matchmaking). A failure is recorded and the cycle continues (R14.7).
 *
 * @returns The block result, and the battle summary for the cycle log even
 *   when a later step failed
 */
export async function runTeamLeagueBlock(
  steps: CycleStepRunner,
  teamSize: 2 | 3,
): Promise<{ block: TeamLeagueBlockResult; battles: TeamBattleExecutionResult | null }> {
  const mode = `${teamSize}v${teamSize}`;
  logger.info(`[Admin] Slot ${teamSize === 2 ? 2 : 6}: Team ${mode} League`);
  let battles: TeamBattleExecutionResult | null = null;
  try {
    // Repair (Spec #41 — was missing, must match cron behavior)
    await steps.run(
      `Repair Scheduled Robots (pre-team-${mode}-league)`, `repair_pre_team_${mode}_league`,
      () => repairRobotsForEvent(teamSize === 2 ? 'league_2v2' : 'league_3v3', true, steps.cycleNumber),
      () => ({}),
    );
    battles = await steps.run(
      `Execute Team ${mode} League Battles`, `execute_team_${mode}_battles`,
      () => executeScheduledTeamBattles(teamSize),
      (r) => ({ matchesCompleted: r.matchesCompleted, matchesCancelled: r.matchesCancelled }),
    );
    const rebalancing = await steps.run(
      `Rebalance Team ${mode} Leagues`, `rebalance_team_${mode}_leagues`,
      () => rebalanceTeamBattleLeagues(teamSize),
      (r) => ({ promotions: r.totalPromoted, demotions: r.totalDemoted }),
    );
    // Matchmaking (24h lead time)
    const matchesCreated = await steps.run(
      `Matchmaking for Team ${mode} League`, `matchmaking_team_${mode}`,
      () => runTeamBattleMatchmaking(teamSize),
      (r) => ({ matchesCreated: r }),
    );
    return { block: { battles, rebalancing, matchmaking: { matchesCreated } }, battles };
  } catch (err) {
    // R14.7: Record failure, continue remaining steps and iterations
    logger.error(`[Admin] Team ${mode} League block failed:`, err);
    return { block: { error: err instanceof Error ? err.message : String(err) }, battles };
  }
}

/** SLOT 3: 1v1 Tournament (repair → execute/advance/auto-create). */
export async function runTournamentBlock(
  steps: CycleStepRunner,
  includeTournaments: boolean,
): Promise<{ repair: unknown; tournaments: TournamentStepSummary | null }> {
  logger.info(`[Admin] Slot 3: 1v1 Tournament`);
  const repair = await steps.run(
    'Repair Scheduled Robots (pre-tournament)', 'repair_pre_tournament',
    () => repairRobotsForEvent('tournament_1v1', true, steps.cycleNumber),
    (r) => ({ robotsRepaired: r.robotsRepaired, totalCost: r.totalFinalCost }),
  );
  const tournaments = await steps.run(
    'Tournament Execution / Scheduling', 'tournament_execution',
    async () => {
      if (!includeTournaments) return null;
      const summary = await executeTournamentStep();
      logger.info(`[Admin] Tournaments: ${summary.tournamentsExecuted || 0} executed, ${summary.roundsExecuted || 0} rounds, ${summary.matchesExecuted || 0} matches, ${summary.forfeits || 0} forfeits`);
      return summary;
    },
    (r) => ({
      tournamentsExecuted: r?.tournamentsExecuted || 0,
      matchesExecuted: r?.matchesExecuted || 0,
      forfeits: r?.forfeits || 0,
    }),
  );
  return { repair, tournaments };
}

/** SLOT 4: Tag Team (repair → execute → rebalance → matchmaking). */
export async function runTagTeamBlock(steps: CycleStepRunner): Promise<{
  repair: unknown;
  battles: Awaited<ReturnType<typeof executeScheduledTagTeamBattles>>;
  rebalancing: unknown;
  matchmaking: { matchesCreated: number };
}> {
  logger.info(`[Admin] Slot 4: Tag Team`);
  const repair = await steps.run(
    'Repair Scheduled Robots (pre-tag-team)', 'repair_pre_tag_team',
    () => repairRobotsForEvent('tag_team', true, steps.cycleNumber),
    (r) => ({ robotsRepaired: r.robotsRepaired, totalCost: r.totalFinalCost }),
  );
  const battles = await steps.run(
    'Execute Tag Team Battles', 'execute_tag_team_battles',
    () => executeScheduledTagTeamBattles(new Date()),
    (r) => ({ battlesExecuted: r?.totalBattles || 0 }),
  );
  const rebalancing = await steps.run(
    'Rebalance Tag Team Leagues', 'rebalance_tag_team_leagues',
    () => rebalanceTagTeamLeagues(),
    (r) => ({ promotions: r.totalPromoted, demotions: r.totalDemoted }),
  );
  // Matchmaking (24h lead time)
  const matchesCreated = await steps.run(
    'Matchmaking for Tag Teams', 'matchmaking_tag_teams',
    () => runTagTeamMatchmaking(),
    (r) => ({ matchesCreated: r }),
  );
  return { repair, battles, rebalancing, matchmaking: { matchesCreated } };
}

/** SLOT 5: KotH (repair → execute → rebalance → matchmaking), or a skip step. */
export async function runKothBlock(
  steps: CycleStepRunner,
  includeKoth: boolean,
): Promise<{
  repair: unknown;
  battles: Awaited<ReturnType<typeof executeScheduledKothBattles>>;
  matchmaking: { matchesCreated: number };
} | undefined> {
  logger.info(`[Admin] Slot 5: KotH`);
  if (!includeKoth) {
    const step = steps.next('Skipping KotH (includeKoth=false)');
    await steps.complete(step, 'koth_skipped', 0, { skipped: true });
    return undefined;
  }
  const repair = await steps.run(
    'Repair Scheduled Robots (pre-koth)', 'repair_pre_koth',
    () => repairRobotsForEvent('koth', true, steps.cycleNumber),
    (r) => ({ robotsRepaired: r.robotsRepaired, totalCost: r.totalFinalCost }),
  );
  const battles = await steps.run(
    'Execute Scheduled KotH Battles', 'execute_koth_battles',
    () => executeScheduledKothBattles(new Date()),
    (r) => ({
      battlesExecuted: r.totalMatches,
      belowMinimumMatches: r.belowMinimumMatches,
      forfeitedRobots: r.forfeitedRobots,
    }),
  );
  // Rebalance KotH leagues (Spec #41 — was missing, must match cron behavior)
  await steps.run(
    'Rebalance KotH Leagues', 'rebalance_koth_leagues',
    async () => {
      const { rebalanceKothLeagues } = await import('../league/leagueRebalancingService');
      return rebalanceKothLeagues();
    },
    (r) => ({ promotions: r.totalPromoted, demotions: r.totalDemoted }),
  );
  // Matchmaking (24h lead time)
  const matchesCreated = await steps.run(
    'KotH Matchmaking', 'matchmaking_koth',
    () => runKothMatchmaking(),
    (r) => ({ matchesCreated: r }),
  );
  return { repair, battles, matchmaking: { matchesCreated } };
}

/**
 * SLOTS 7 and 9: Team 2v2 / 3v3 Tournament (repair → execute/advance, or
 * auto-create when none is active). A failure is recorded as a skip reason.
 */
export async function runTeamTournamentBlock(
  steps: CycleStepRunner,
  teamSize: 2 | 3,
): Promise<TeamTournamentBlockResult> {
  const mode = `${teamSize}v${teamSize}`;
  logger.info(`[Admin] Slot ${teamSize === 2 ? 7 : 9}: Team ${mode} Tournament`);
  const repair = await steps.run(
    `Repair Scheduled Robots (pre-team-${mode}-tournament)`, `repair_pre_team_${mode}_tournament`,
    () => repairRobotsForEvent(teamSize === 2 ? 'tournament_2v2' : 'tournament_3v3', true, steps.cycleNumber),
    (r) => ({ robotsRepaired: r.robotsRepaired, totalCost: r.totalFinalCost }),
  );

  const step = steps.next(`Execute Team ${mode} Tournament`);
  const start = Date.now();
  let result: TeamTournamentBlockResult;
  try {
    const active = await prisma.tournament.findFirst({
      where: { participantType: teamSize === 2 ? 'team_2v2' : 'team_3v3', status: 'active' },
    });

    if (active) {
      logger.info(`[Admin] Executing round ${active.currentRound} of "${active.name}"`);
      const roundResult = await executeTeamTournamentRound(active.id, teamSize);
      await advanceWinnersToNextRound(active.id);
      result = {
        repair,
        matchesExecuted: roundResult.matchesExecuted,
        matchesFailed: roundResult.matchesFailed,
        tournamentName: active.name,
        tournamentRound: active.currentRound,
        tournamentMaxRounds: active.maxRounds,
      };
    } else {
      // No active tournament — try to create one
      const newTournament = await autoCreateNextTeamTournament(teamSize);
      if (newTournament) {
        logger.info(`[Admin] Auto-created team ${mode} tournament: "${newTournament.name}"`);
        result = { repair, matchesExecuted: 0, matchesFailed: 0, tournamentName: newTournament.name, tournamentCreated: true };
      } else {
        logger.info(`[Admin] Team ${mode} Tournament: Skipped — insufficient eligible teams`);
        result = { repair, matchesExecuted: 0, matchesFailed: 0, skippedReason: 'insufficient eligible teams' };
      }
    }
  } catch (err) {
    logger.error(`[Admin] Team ${mode} Tournament block failed:`, err);
    result = {
      repair,
      matchesExecuted: 0,
      matchesFailed: 0,
      skippedReason: err instanceof Error ? err.message : String(err),
    };
  }

  await steps.complete(step, `team_${mode}_tournament_execution`, Date.now() - start, {
    matchesExecuted: 'matchesExecuted' in result ? result.matchesExecuted : 0,
  });
  return result;
}

/** SLOT 8: Grand Melee (Spec #44: R7.5) — repair → execute → rebalance → matchmake. */
export async function runGrandMeleeBlock(steps: CycleStepRunner): Promise<GrandMeleeBlockSummary | { error: string }> {
  const step = steps.next('Grand Melee — executing cycle (repair → execute → rebalance → matchmake)');
  let result: GrandMeleeBlockSummary | { error: string };
  try {
    const { executeScheduledGrandMeleeBattles } = await import('../grand-melee/grandMeleeBattleOrchestrator');
    const { runGrandMeleeMatchmaking } = await import('../grand-melee/grandMeleeMatchmakingService');
    const { rebalanceGrandMeleeLeagues } = await import('../league/leagueRebalancingService');

    await repairRobotsForEvent('grand_melee', true, steps.cycleNumber);
    const execSummary = await executeScheduledGrandMeleeBattles();
    await rebalanceGrandMeleeLeagues();
    const matchesCreated = await runGrandMeleeMatchmaking();

    result = {
      matchesExecuted: execSummary.successfulMatches,
      matchesFailed: execSummary.failedMatches,
      belowMinimumMatches: execSummary.belowMinimumMatches,
      forfeitedRobots: execSummary.forfeitedRobots,
      matchesCreated,
    };
  } catch (err) {
    result = { error: err instanceof Error ? err.message : String(err) };
    logger.error('[Admin] Grand Melee cycle failed:', err);
  }
  await steps.complete(step, 'grand_melee', 0, result);
  return result;
}
