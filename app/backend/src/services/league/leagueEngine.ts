/**
 * League Engine — Generic promotion/demotion and instance rebalancing logic.
 *
 * This module extracts the shared algorithm from leagueRebalancingService.ts and
 * tagTeamLeagueRebalancingService.ts. Both services delegate to this engine via
 * adapter objects that encapsulate entity-specific Prisma queries and field mappings.
 *
 * Design: Strategy/Adapter pattern — no class inheritance, just interfaces.
 *
 * @module services/league/leagueEngine
 */

import logger from '../../config/logger';
import prisma from '../../lib/prisma';
import { LeagueError, LeagueErrorCode } from '../../errors/leagueErrors';
import { recordTierChange, getCurrentCycleNumber } from './leagueHistoryService';
import {
  LeaguePlanSelectors,
  LeagueTierRebalancingPlan,
  planLeagueInstanceRebalancing,
  planLeagueTierRebalancing,
} from './league-rebalancing-planner';
import { LeagueRuleSet } from './league-rules';

// ─── Configuration ───────────────────────────────────────────────────────────

export interface LeagueEngineConfig extends LeagueRuleSet {
  /** Log prefix for identifying which league system is logging */
  logPrefix: string;
  /** Label used in error messages (e.g., "robot", "team") */
  entityLabel: string;
}

// ─── Entity Adapter ──────────────────────────────────────────────────────────

/**
 * Minimal shape that any league entity must satisfy for the engine to operate.
 */
export interface LeagueEntityBase {
  id: number;
}

/**
 * Represents a league instance with its population count.
 */
export interface InstanceInfo {
  leagueId: string;
}

/**
 * Adapter interface that encapsulates all entity-specific operations.
 * Implementations provide Prisma queries for their specific model (Robot, TagTeam, etc.)
 */
export interface LeagueAdapter<T extends LeagueEntityBase> {
  /**
   * Get every entity in an instance. `excludeIds` is used by the standalone
   * per-instance helpers; full-cycle planning passes an empty set and snapshots
   * every tier before any movement occurs.
   */
  getEntitiesInInstance(instanceId: string, excludeIds: Set<number>): Promise<T[]>;

  /**
   * Get all instance IDs for a given tier.
   */
  getInstancesForTier(tier: string): Promise<InstanceInfo[]>;

  /**
   * Count total entities in a tier (for summary reporting).
   */
  countEntitiesInTier(tier: string): Promise<number>;

  /**
   * Count entities in the destination tier (for cohort check).
   */
  countEntitiesInDestinationTier(tier: string): Promise<number>;

  /**
   * Assign an entity to an appropriate instance in the given tier.
   * Returns the new leagueId.
   */
  assignInstance(tier: string): Promise<string>;

  /**
   * Update an entity's league tier and instance after promotion/demotion.
   * Must reset cycles counter to 0.
   */
  updateEntityLeague(entityId: number, newTier: string, newLeagueId: string): Promise<void>;

  /**
   * Get the current league tier of an entity (for error messages and history).
   */
  getEntityCurrentTier(entity: T): string;

  /**
   * Get the current league instance ID of an entity.
   */
  getEntityLeagueId(entity: T): string;

  /**
   * Get the current league points of an entity.
   */
  getEntityLeaguePoints(entity: T): number;

  /** Get completed residency cycles in the entity's current tier. */
  getEntityCyclesInTier(entity: T): number;

  /**
   * Get the user/owner ID for history recording and deterministic ordering.
   */
  getEntityOwnerId(entity: T): number;

  /**
   * Get a display name for logging purposes.
   */
  getEntityDisplayName(entity: T): string;

  /**
   * Entity type for league history recording ('robot' | 'tag_team' | 'team_battle').
   */
  entityType: 'robot' | 'tag_team' | 'team_battle';

  /**
   * Standings mode this adapter operates on (e.g., 'league_1v1', 'koth', 'grand_melee').
   * Used for league history recording so tier changes can be attributed to the correct mode.
   */
  mode: string;

  /**
   * Optional: Called after a successful promotion (e.g., for achievement checks).
   * Errors thrown here are caught and logged, never blocking the promotion.
   */
  onPromoted?(entity: T, newTier: string): Promise<void>;

  /**
   * Rebalance instances for a tier (redistribute entities evenly).
   * Called after all promotions/demotions are complete.
   */
  rebalanceInstances(tier: string): Promise<void>;

  /**
   * Count all entities in the system (for the full summary).
   */
  countAllEntities(): Promise<number>;
}

// ─── Result Types ────────────────────────────────────────────────────────────

export interface TierRebalancingSummary {
  tier: string;
  entitiesInTier: number;
  promoted: number;
  demoted: number;
  eligibleEntities: number;
}

export interface FullRebalancingResult {
  totalEntities: number;
  totalPromoted: number;
  totalDemoted: number;
  tierSummaries: TierRebalancingSummary[];
  errors: string[];
}

// ─── Tier Navigation ─────────────────────────────────────────────────────────

function getNextTierUp(currentTier: string, tiers: readonly string[]): string | null {
  const currentIndex = tiers.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === tiers.length - 1) {
    return null;
  }
  return tiers[currentIndex + 1];
}

function getNextTierDown(currentTier: string, tiers: readonly string[]): string | null {
  const currentIndex = tiers.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === 0) {
    return null;
  }
  return tiers[currentIndex - 1];
}

// ─── Core Engine Functions ───────────────────────────────────────────────────

function getPlanSelectors<T extends LeagueEntityBase>(adapter: LeagueAdapter<T>): LeaguePlanSelectors<T> {
  return {
    getEntityId: (entity) => adapter.getEntityOwnerId(entity),
    getLeaguePoints: (entity) => adapter.getEntityLeaguePoints(entity),
    getCyclesInTier: (entity) => adapter.getEntityCyclesInTier(entity),
  };
}

/**
 * Determine promotion candidates from the fixed top percentage of a complete
 * instance. The tier-level empty-destination cohort rule is applied by
 * `rebalanceTier`, after candidates from every instance have been combined.
 */
export async function determinePromotionsForInstance<T extends LeagueEntityBase>(
  instanceId: string,
  config: LeagueEngineConfig,
  adapter: LeagueAdapter<T>,
  excludeIds: Set<number>,
): Promise<T[]> {
  const tier = instanceId.split('_')[0];
  const entities = await adapter.getEntitiesInInstance(instanceId, excludeIds);
  const plan = planLeagueInstanceRebalancing(
    instanceId,
    tier,
    entities,
    config,
    getPlanSelectors(adapter),
  );

  logger.info(
    `[${config.logPrefix}] ${instanceId}: ${plan.promotionCandidates.length} promotion candidates `
    + `from ${plan.promotionSlots} fixed slots (${plan.totalEntities} total, `
    + `${plan.eligibleEntities} with ≥${config.minCyclesForRebalancing} cycles, `
    + `threshold ≥${plan.minPromotionLP} LP)`,
  );
  return plan.promotionCandidates;
}

/** Determine demotion candidates from the fixed bottom percentage. */
export async function determineDemotionsForInstance<T extends LeagueEntityBase>(
  instanceId: string,
  config: LeagueEngineConfig,
  adapter: LeagueAdapter<T>,
  excludeIds: Set<number>,
): Promise<T[]> {
  const tier = instanceId.split('_')[0];
  const entities = await adapter.getEntitiesInInstance(instanceId, excludeIds);
  const plan = planLeagueInstanceRebalancing(
    instanceId,
    tier,
    entities,
    config,
    getPlanSelectors(adapter),
  );

  logger.info(
    `[${config.logPrefix}] ${instanceId}: ${plan.demotionCandidates.length} demotion candidates `
    + `from ${plan.demotionSlots} fixed slots (${plan.totalEntities} total)`,
  );
  return plan.demotionCandidates;
}

/**
 * Promote a single entity to the next tier.
 * LP is retained across promotions. Cycles counter is reset.
 */
export async function promoteEntity<T extends LeagueEntityBase>(
  entity: T,
  config: LeagueEngineConfig,
  adapter: LeagueAdapter<T>,
): Promise<void> {
  const currentTier = adapter.getEntityCurrentTier(entity);
  const nextTier = getNextTierUp(currentTier, config.tiers);

  if (!nextTier) {
    throw new LeagueError(
      LeagueErrorCode.PROMOTION_BLOCKED,
      `Cannot promote ${config.entityLabel} ${entity.id} from ${currentTier} - already at top tier`,
      400,
      { entityId: entity.id, currentLeague: currentTier }
    );
  }

  const newLeagueId = await adapter.assignInstance(nextTier);
  await adapter.updateEntityLeague(adapter.getEntityOwnerId(entity), nextTier, newLeagueId);

  const lp = adapter.getEntityLeaguePoints(entity);
  logger.info(
    `[${config.logPrefix}] Promoted: ${adapter.getEntityDisplayName(entity)} (${currentTier} → ${nextTier}, LP: ${lp} retained)`
  );

  // Record league history (non-blocking)
  try {
    const cycleNumber = await getCurrentCycleNumber();
    // Resolve actual owner: for robots → userId, for teams → stableId
    let resolvedUserId = adapter.getEntityOwnerId(entity);
    if (adapter.entityType === 'robot') {
      const robot = await prisma.robot.findUnique({ where: { id: adapter.getEntityOwnerId(entity) }, select: { userId: true } });
      if (robot) resolvedUserId = robot.userId;
    } else {
      const team = await prisma.teamBattle.findUnique({ where: { id: adapter.getEntityOwnerId(entity) }, select: { stableId: true } });
      if (team) resolvedUserId = team.stableId;
    }
    await recordTierChange({
      entityType: adapter.entityType,
      entityId: adapter.getEntityOwnerId(entity),
      userId: resolvedUserId,
      changeType: 'promotion',
      sourceTier: currentTier,
      destinationTier: nextTier,
      sourceLeagueId: adapter.getEntityLeagueId(entity),
      destinationLeagueId: newLeagueId,
      leaguePoints: lp,
      cycleNumber,
      mode: adapter.mode,
    });
  } catch (error) {
    logger.error(`[${config.logPrefix}] Failed to record promotion history for ${adapter.entityType} ${entity.id}: ${error}`);
  }

  // Optional post-promotion hook (e.g., achievements)
  if (adapter.onPromoted) {
    try {
      await adapter.onPromoted(entity, nextTier);
    } catch (error) {
      logger.error(`[${config.logPrefix}] Post-promotion hook failed for ${adapter.entityType} ${entity.id}: ${error}`);
    }
  }
}

/**
 * Demote a single entity to the previous tier.
 * LP is retained across demotions. Cycles counter is reset.
 */
export async function demoteEntity<T extends LeagueEntityBase>(
  entity: T,
  config: LeagueEngineConfig,
  adapter: LeagueAdapter<T>,
): Promise<void> {
  const currentTier = adapter.getEntityCurrentTier(entity);
  const previousTier = getNextTierDown(currentTier, config.tiers);

  if (!previousTier) {
    throw new LeagueError(
      LeagueErrorCode.RELEGATION_BLOCKED,
      `Cannot demote ${config.entityLabel} ${entity.id} from ${currentTier} - already at bottom tier`,
      400,
      { entityId: entity.id, currentLeague: currentTier }
    );
  }

  const newLeagueId = await adapter.assignInstance(previousTier);
  await adapter.updateEntityLeague(adapter.getEntityOwnerId(entity), previousTier, newLeagueId);

  const lp = adapter.getEntityLeaguePoints(entity);
  logger.info(
    `[${config.logPrefix}] Demoted: ${adapter.getEntityDisplayName(entity)} (${currentTier} → ${previousTier}, LP: ${lp} retained)`
  );

  // Record league history (non-blocking)
  try {
    const cycleNumber = await getCurrentCycleNumber();
    // Resolve actual owner: for robots → userId, for teams → stableId
    let resolvedUserId = adapter.getEntityOwnerId(entity);
    if (adapter.entityType === 'robot') {
      const robot = await prisma.robot.findUnique({ where: { id: adapter.getEntityOwnerId(entity) }, select: { userId: true } });
      if (robot) resolvedUserId = robot.userId;
    } else {
      const team = await prisma.teamBattle.findUnique({ where: { id: adapter.getEntityOwnerId(entity) }, select: { stableId: true } });
      if (team) resolvedUserId = team.stableId;
    }
    await recordTierChange({
      entityType: adapter.entityType,
      entityId: adapter.getEntityOwnerId(entity),
      userId: resolvedUserId,
      changeType: 'demotion',
      sourceTier: currentTier,
      destinationTier: previousTier,
      sourceLeagueId: adapter.getEntityLeagueId(entity),
      destinationLeagueId: newLeagueId,
      leaguePoints: lp,
      cycleNumber,
      mode: adapter.mode,
    });
  } catch (error) {
    logger.error(`[${config.logPrefix}] Failed to record demotion history for ${adapter.entityType} ${adapter.getEntityOwnerId(entity)}: ${error}`);
  }
}

interface TierPlanSnapshot<T extends LeagueEntityBase> {
  tier: string;
  totalInTier: number;
  instanceCount: number;
  nextTier: string | null;
  plan: LeagueTierRebalancingPlan<T>;
}

/** Snapshot one tier's complete population before any tier changes are written. */
async function buildTierPlanSnapshot<T extends LeagueEntityBase>(
  tier: string,
  config: LeagueEngineConfig,
  adapter: LeagueAdapter<T>,
): Promise<TierPlanSnapshot<T>> {
  const totalInTier = await adapter.countEntitiesInTier(tier);
  const instances = await adapter.getInstancesForTier(tier);
  const selectors = getPlanSelectors(adapter);
  const instancePlans = [];

  for (const instance of instances) {
    const entities = await adapter.getEntitiesInInstance(instance.leagueId, new Set<number>());
    instancePlans.push(planLeagueInstanceRebalancing(
      instance.leagueId,
      tier,
      entities,
      config,
      selectors,
    ));
  }

  const nextTier = getNextTierUp(tier, config.tiers);
  const destinationPopulation = nextTier
    ? await adapter.countEntitiesInDestinationTier(nextTier)
    : 0;

  return {
    tier,
    totalInTier,
    instanceCount: instances.length,
    nextTier,
    plan: planLeagueTierRebalancing(tier, instancePlans, destinationPopulation, config),
  };
}

/** Execute a previously snapshotted tier plan without replanning after moves. */
async function executeTierPlan<T extends LeagueEntityBase>(
  snapshot: TierPlanSnapshot<T>,
  config: LeagueEngineConfig,
  adapter: LeagueAdapter<T>,
  processedIds: Set<number>,
): Promise<TierRebalancingSummary> {
  const { tier, totalInTier, instanceCount, nextTier, plan } = snapshot;
  logger.info(`\n[${config.logPrefix}] Processing ${tier.toUpperCase()} league...`);
  for (const instancePlan of plan.instancePlans) {
    logger.info(
      `[${config.logPrefix}] ${instancePlan.instanceId}: ${instancePlan.totalEntities} total, `
      + `${instancePlan.promotionSlots} promotion slots, ${instancePlan.demotionSlots} demotion slots`,
    );
  }

  const summary: TierRebalancingSummary = {
    tier,
    entitiesInTier: totalInTier,
    promoted: 0,
    demoted: 0,
    eligibleEntities: plan.eligibleEntities,
  };

  if (plan.promotionBlockReason === 'destination_cohort_too_small') {
    logger.info(
      `[${config.logPrefix}] ${tier}: Holding promotions — destination ${nextTier} is empty, `
      + `need ${config.minCohortForNewTier} candidates but only have ${plan.promotionCandidates.length}`,
    );
  }

  for (const entity of plan.effectivePromotionCandidates) {
    const entityId = adapter.getEntityOwnerId(entity);
    if (processedIds.has(entityId)) continue;
    try {
      await promoteEntity(entity, config, adapter);
      processedIds.add(entityId);
      summary.promoted++;
    } catch (error) {
      logger.error(`[${config.logPrefix}] Error promoting entity ${entityId}:`, error);
    }
  }

  for (const entity of plan.demotionCandidates) {
    const entityId = adapter.getEntityOwnerId(entity);
    if (processedIds.has(entityId)) continue;
    try {
      await demoteEntity(entity, config, adapter);
      processedIds.add(entityId);
      summary.demoted++;
    } catch (error) {
      logger.error(`[${config.logPrefix}] Error demoting entity ${entityId}:`, error);
    }
  }

  logger.info(
    `[${config.logPrefix}] ${tier}: Promoted ${summary.promoted}, Demoted ${summary.demoted} across ${instanceCount} instances`,
  );
  return summary;
}

/**
 * Rebalance all league tiers — the main entry point for the engine.
 * Processes tiers bottom-to-top, then rebalances instances.
 */
export async function rebalanceAllTiers<T extends LeagueEntityBase>(
  config: LeagueEngineConfig,
  adapter: LeagueAdapter<T>,
): Promise<FullRebalancingResult> {
  logger.info('═'.repeat(60));
  logger.info(`[${config.logPrefix}] Starting league rebalancing...`);
  logger.info('═'.repeat(60));

  const result: FullRebalancingResult = {
    totalEntities: 0,
    totalPromoted: 0,
    totalDemoted: 0,
    tierSummaries: [],
    errors: [],
  };

  result.totalEntities = await adapter.countAllEntities();
  logger.info(`[${config.logPrefix}] Total entities in system: ${result.totalEntities}`);

  // Freeze every tier at the same settlement boundary. Moves executed for an
  // earlier tier must not change the population or fixed positions of a later one.
  const snapshots = new Map<string, TierPlanSnapshot<T>>();
  for (const tier of config.tiers) {
    try {
      snapshots.set(tier, await buildTierPlanSnapshot(tier, config, adapter));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`${tier}: ${errorMsg}`);
      logger.error(`[${config.logPrefix}] Error planning tier ${tier}:`, error);
    }
  }

  const processedIds = new Set<number>();
  for (const tier of config.tiers) {
    const snapshot = snapshots.get(tier);
    if (!snapshot) continue;
    try {
      const summary = await executeTierPlan(snapshot, config, adapter, processedIds);
      result.tierSummaries.push(summary);
      result.totalPromoted += summary.promoted;
      result.totalDemoted += summary.demoted;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`${tier}: ${errorMsg}`);
      logger.error(`[${config.logPrefix}] Error in tier ${tier}:`, error);
    }
  }

  // Rebalance instances for each tier after all moves
  logger.info(`\n[${config.logPrefix}] Checking instances for rebalancing...`);
  for (const tier of config.tiers) {
    try {
      await adapter.rebalanceInstances(tier);
    } catch (error) {
      logger.error(`[${config.logPrefix}] Error checking ${tier} instances:`, error);
    }
  }

  logger.info('\n' + '═'.repeat(60));
  logger.info(`[${config.logPrefix}] League rebalancing complete!`);
  logger.info(`  Total promoted: ${result.totalPromoted}`);
  logger.info(`  Total demoted: ${result.totalDemoted}`);
  logger.info(`  Errors: ${result.errors.length}`);
  logger.info('═'.repeat(60) + '\n');

  return result;
}
