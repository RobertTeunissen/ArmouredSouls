/**
 * Shared League Cycle Orchestrator
 *
 * Eliminates duplicated orchestration code between cycleScheduler.ts and
 * adminCycleService.ts. Both delegate to this function for the standard
 * `repair → execute → rebalance → matchmaking` pipeline.
 *
 * Spec #41: Unified Match Scheduling — Requirement 26
 */

import logger from '../../config/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RepairSummary {
  robotsRepaired: number;
  totalFinalCost?: number;
}

export interface BattleSummary {
  totalBattles?: number;
  matchesCompleted?: number;
  matchesCancelled?: number;
  successfulMatches?: number;
  failedMatches?: number;
  [key: string]: unknown;
}

export interface RebalanceSummary {
  totalPromoted: number;
  totalDemoted: number;
  [key: string]: unknown;
}

export interface LeagueCycleConfig {
  /** Human-readable name for logging (e.g., 'League 1v1', 'Team 2v2 League') */
  modeName: string;
  /** Repair function — repairs all robots before battle execution */
  repairFn: () => Promise<RepairSummary>;
  /** Execute function — runs scheduled battles for this mode */
  executeFn: () => Promise<BattleSummary>;
  /** Rebalance function — promotes/demotes entities between tiers */
  rebalanceFn: () => Promise<RebalanceSummary>;
  /** Matchmaking function — schedules matches for the next cycle */
  matchmakingFn: () => Promise<number>;
}

export interface LeagueCycleResult {
  repair: RepairSummary;
  battles: BattleSummary;
  rebalance: RebalanceSummary;
  matchesCreated: number;
}

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Execute the standard league cycle pipeline:
 * 1. Repair all robots
 * 2. Execute scheduled battles
 * 3. Rebalance leagues (promotions/demotions)
 * 4. Run matchmaking for next cycle
 *
 * Used by both cron handlers and admin bulk cycles to ensure identical behavior.
 *
 * @param config - Mode-specific callbacks and configuration
 * @returns Structured result with per-step outputs
 */
export async function executeLeagueCycleSteps(config: LeagueCycleConfig): Promise<LeagueCycleResult> {
  const { modeName, repairFn, executeFn, rebalanceFn, matchmakingFn } = config;

  // Step 1: Repair
  logger.info(`${modeName} Cycle: Step 1 — Repairing all robots`);
  const repair = await repairFn();
  logger.info(`${modeName} Cycle: Repair complete`);

  // Step 2: Execute battles
  logger.info(`${modeName} Cycle: Step 2 — Executing scheduled battles`);
  const battles = await executeFn();
  logger.info(`${modeName} Cycle: Battles executed`);

  // Step 3: Rebalance
  logger.info(`${modeName} Cycle: Step 3 — Rebalancing leagues`);
  const rebalance = await rebalanceFn();
  logger.info(`${modeName} Cycle: Rebalanced — ${rebalance.totalPromoted} promoted, ${rebalance.totalDemoted} demoted`);

  // Step 4: Matchmaking (service handles scheduledFor internally)
  logger.info(`${modeName} Cycle: Step 4 — Scheduling matchmaking`);
  const matchesCreated = await matchmakingFn();
  logger.info(`${modeName} Cycle: ${matchesCreated} matches scheduled`);

  return { repair, battles, rebalance, matchesCreated };
}
