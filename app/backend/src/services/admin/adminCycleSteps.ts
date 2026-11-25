/**
 * Admin bulk cycle event blocks.
 *
 * One function per slot-map event. Each runs the slot's step sequence from
 * `cycle/eventSlotSteps` (the same steps the cron jobs run) and shapes the
 * result for the bulk response. `executeBulkCycles` in `adminCycleService`
 * runs them in slot-map order and owns settlement and the financial cutover.
 *
 * Every step is numbered in run order and recorded with
 * `logCycleStepComplete`; the step names are part of the cycle event log.
 *
 * @module services/admin/adminCycleSteps
 */

import type { TeamBattleExecutionResult } from '../team-battle/teamBattleOrchestrator';
import { topUpGeneratedStables, type GeneratedStableTopUpResult } from '../../utils/userGeneration';
import {
  executeSoloTournaments,
  runGrandMeleeSlot,
  runKothSlot,
  runLeague1v1Slot,
  runSoloTournamentSlot,
  runTagTeamSlot,
  runTeamLeagueSlot,
  runTeamTournamentSlot,
  type SlotStepRunner,
  type TournamentStepSummary,
} from '../cycle/eventSlotSteps';
import type { EventLogger } from '../common/eventLogger';
import logger from '../../config/logger';
import type { TurnStepInput, TurnStepOutcome } from '../automaton/automatonTurnService';

export type { TournamentStepSummary };

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

// ─── Step runner ─────────────────────────────────────────────────────

/** Numbers the steps of one cycle and records each completed step. */
export class CycleStepRunner implements SlotStepRunner {
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
 * Used by the cycles=0 tournament-only path; the full pipeline runs it inside
 * the 1v1 tournament slot.
 */
export async function executeTournamentStep(): Promise<TournamentStepSummary> {
  return (await executeSoloTournaments()).summary;
}

// ─── Event blocks (slot map order) ───────────────────────────────────
// Each block runs the slot's shared step sequence (cycle/eventSlotSteps), the
// same steps the cron jobs run, and shapes the result for the bulk response.

/** SLOT 1: 1v1 League (repair → execute → rebalance → matchmaking). */
export async function runLeague1v1Block(steps: CycleStepRunner): Promise<{
  battles: Awaited<ReturnType<typeof runLeague1v1Slot>>['battles'];
  repair: unknown;
  rebalancing: unknown;
  matchmaking: { matchesCreated: number };
}> {
  logger.info(`[Admin] Slot 1: 1v1 League`);
  const { repair, battles, rebalancing, matchesCreated } = await runLeague1v1Slot(steps);
  return { battles, repair, rebalancing, matchmaking: { matchesCreated } };
}

/**
 * SLOTS 2 and 6: Team 2v2 / 3v3 League. A failure is recorded and the cycle
 * continues (R14.7).
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
  const progress: { battles?: TeamBattleExecutionResult } = {};
  try {
    const { battles, rebalancing, matchesCreated } = await runTeamLeagueSlot(steps, teamSize, progress);
    return { block: { battles, rebalancing, matchmaking: { matchesCreated } }, battles };
  } catch (err) {
    // R14.7: Record failure, continue remaining steps and iterations
    logger.error(`[Admin] Team ${mode} League block failed:`, err);
    return { block: { error: err instanceof Error ? err.message : String(err) }, battles: progress.battles ?? null };
  }
}

/** SLOT 3: 1v1 Tournament (repair → execute/advance/auto-create). */
export async function runTournamentBlock(
  steps: CycleStepRunner,
  includeTournaments: boolean,
): Promise<{ repair: unknown; tournaments: TournamentStepSummary | null }> {
  logger.info(`[Admin] Slot 3: 1v1 Tournament`);
  const { repair, tournaments } = await runSoloTournamentSlot(steps, includeTournaments);
  return { repair, tournaments: tournaments?.summary ?? null };
}

/** SLOT 4: Tag Team (repair → execute → rebalance → matchmaking). */
export async function runTagTeamBlock(steps: CycleStepRunner): Promise<{
  repair: unknown;
  battles: Awaited<ReturnType<typeof runTagTeamSlot>>['battles'];
  rebalancing: unknown;
  matchmaking: { matchesCreated: number };
}> {
  logger.info(`[Admin] Slot 4: Tag Team`);
  const { repair, battles, rebalancing, matchesCreated } = await runTagTeamSlot(steps);
  return { repair, battles, rebalancing, matchmaking: { matchesCreated } };
}

/** SLOT 5: KotH (repair → execute → rebalance → matchmaking), or a skip step. */
export async function runKothBlock(
  steps: CycleStepRunner,
  includeKoth: boolean,
): Promise<{
  repair: unknown;
  battles: Awaited<ReturnType<typeof runKothSlot>>['battles'];
  matchmaking: { matchesCreated: number };
} | undefined> {
  logger.info(`[Admin] Slot 5: KotH`);
  if (!includeKoth) {
    const step = steps.next('Skipping KotH (includeKoth=false)');
    await steps.complete(step, 'koth_skipped', 0, { skipped: true });
    return undefined;
  }
  const { repair, battles, matchesCreated } = await runKothSlot(steps);
  return { repair, battles, matchmaking: { matchesCreated } };
}

/**
 * SLOTS 7 and 9: Team 2v2 / 3v3 Tournament (repair → execute/advance →
 * auto-create). A failure is recorded as a skip reason.
 */
export async function runTeamTournamentBlock(
  steps: CycleStepRunner,
  teamSize: 2 | 3,
): Promise<TeamTournamentBlockResult> {
  const mode = `${teamSize}v${teamSize}`;
  logger.info(`[Admin] Slot ${teamSize === 2 ? 7 : 9}: Team ${mode} Tournament`);
  try {
    const { repair, processed, created } = await runTeamTournamentSlot(steps, teamSize);
    if (processed) {
      return {
        repair,
        matchesExecuted: processed.matchesExecuted,
        matchesFailed: processed.matchesFailed,
        tournamentName: processed.name,
        tournamentRound: processed.currentRound,
        tournamentMaxRounds: processed.maxRounds,
        ...(created ? { tournamentCreated: true } : {}),
      };
    }
    if (created) {
      return { repair, matchesExecuted: 0, matchesFailed: 0, tournamentName: created.name, tournamentCreated: true };
    }
    return { repair, matchesExecuted: 0, matchesFailed: 0, skippedReason: 'insufficient eligible teams' };
  } catch (err) {
    logger.error(`[Admin] Team ${mode} Tournament block failed:`, err);
    return {
      repair: null,
      matchesExecuted: 0,
      matchesFailed: 0,
      skippedReason: err instanceof Error ? err.message : String(err),
    };
  }
}

/** SLOT 8: Grand Melee (Spec #44: R7.5) — repair → execute → rebalance → matchmake. */
export async function runGrandMeleeBlock(steps: CycleStepRunner): Promise<GrandMeleeBlockSummary | { error: string }> {
  logger.info(`[Admin] Slot 8: Grand Melee`);
  try {
    const { battles, matchesCreated } = await runGrandMeleeSlot(steps);
    return {
      matchesExecuted: battles.successfulMatches,
      matchesFailed: battles.failedMatches,
      belowMinimumMatches: battles.belowMinimumMatches,
      forfeitedRobots: battles.forfeitedRobots,
      matchesCreated,
    };
  } catch (err) {
    logger.error('[Admin] Grand Melee cycle failed:', err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
