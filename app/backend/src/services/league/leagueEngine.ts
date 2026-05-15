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
import { LeagueError, LeagueErrorCode } from '../../errors/leagueErrors';
import { getMinLPForPromotion } from './leaguePromotionThresholds';
import { recordTierChange, getCurrentCycleNumber } from './leagueHistoryService';

// ─── Configuration ───────────────────────────────────────────────────────────

export interface LeagueEngineConfig {
  /** Top X% of eligible entities get promoted */
  promotionPercentage: number;
  /** Bottom X% of eligible entities get demoted */
  demotionPercentage: number;
  /** Minimum cycles an entity must spend in current league before being eligible */
  minCyclesForRebalancing: number;
  /** Minimum entities in an instance for promotion/demotion to trigger */
  minEntitiesForRebalancing: number;
  /** Minimum cohort size required to open a new (empty) tier */
  minCohortForNewTier: number;
  /** Log prefix for identifying which league system is logging */
  logPrefix: string;
  /** Ordered list of tier names from lowest to highest */
  tiers: readonly string[];
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
   * Get entities in a specific instance that meet the minimum cycles requirement
   * AND have league points >= minLP. Ordered by LP descending (with tiebreaker).
   * Must exclude entities in the excludeIds set.
   */
  getEntitiesWithMinPoints(instanceId: string, minLP: number, minCycles: number, excludeIds: Set<number>): Promise<T[]>;

  /**
   * Count eligible entities in a specific instance (those meeting min cycles).
   * Must exclude entities in the excludeIds set.
   */
  countEligibleInInstance(instanceId: string, minCycles: number, excludeIds: Set<number>): Promise<number>;

  /**
   * Get entities in a specific instance ordered by LP ascending (for demotion).
   * Only those meeting min cycles. Must exclude entities in the excludeIds set.
   */
  getEntitiesForDemotion(instanceId: string, minCycles: number, excludeIds: Set<number>): Promise<T[]>;

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

  /**
   * Get the user/owner ID for history recording.
   */
  getEntityOwnerId(entity: T): number;

  /**
   * Get a display name for logging purposes.
   */
  getEntityDisplayName(entity: T): string;

  /**
   * Entity type for league history recording ('robot' | 'tag_team').
   */
  entityType: 'robot' | 'tag_team';

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

/**
 * Determine which entities should be promoted from a specific instance.
 * Entities must meet per-tier LP threshold AND be in top X% AND have ≥N cycles in current league.
 */
export async function determinePromotionsForInstance<T extends LeagueEntityBase>(
  instanceId: string,
  config: LeagueEngineConfig,
  adapter: LeagueAdapter<T>,
  excludeIds: Set<number>,
): Promise<T[]> {
  const tier = instanceId.split('_')[0];

  // Top tier has no promotions
  if (tier === config.tiers[config.tiers.length - 1]) {
    return [];
  }

  const minLP = getMinLPForPromotion(tier);

  // Get entities meeting both min cycles AND min LP
  const entitiesWithMinPoints = await adapter.getEntitiesWithMinPoints(
    instanceId, minLP, config.minCyclesForRebalancing, excludeIds
  );

  if (entitiesWithMinPoints.length === 0) {
    logger.info(
      `[${config.logPrefix}] ${instanceId}: No entities with ≥${minLP} league points (${tier} tier threshold), skipping promotions`
    );
    return [];
  }

  // Get total eligible count for percentage calculation
  const totalEligible = await adapter.countEligibleInInstance(
    instanceId, config.minCyclesForRebalancing, excludeIds
  );

  if (totalEligible < config.minEntitiesForRebalancing) {
    logger.info(
      `[${config.logPrefix}] ${instanceId}: Too few eligible entities (${totalEligible} < ${config.minEntitiesForRebalancing}), skipping promotions`
    );
    return [];
  }

  const promotionCount = Math.floor(totalEligible * config.promotionPercentage);

  if (promotionCount === 0) {
    logger.info(
      `[${config.logPrefix}] ${instanceId}: Promotion count is 0 (${totalEligible} eligible entities), skipping`
    );
    return [];
  }

  const toPromote = entitiesWithMinPoints.slice(0, Math.min(promotionCount, entitiesWithMinPoints.length));

  logger.info(
    `[${config.logPrefix}] ${instanceId}: ${toPromote.length} entities eligible for promotion (top ${config.promotionPercentage * 100}% of ${totalEligible} AND ≥${minLP} league points [${tier} tier], ${entitiesWithMinPoints.length} met points threshold)`
  );

  return toPromote;
}

/**
 * Determine which entities should be demoted from a specific instance.
 */
export async function determineDemotionsForInstance<T extends LeagueEntityBase>(
  instanceId: string,
  config: LeagueEngineConfig,
  adapter: LeagueAdapter<T>,
  excludeIds: Set<number>,
): Promise<T[]> {
  const tier = instanceId.split('_')[0];

  // Bottom tier has no demotions
  if (tier === config.tiers[0]) {
    return [];
  }

  const entities = await adapter.getEntitiesForDemotion(
    instanceId, config.minCyclesForRebalancing, excludeIds
  );

  if (entities.length < config.minEntitiesForRebalancing) {
    logger.info(
      `[${config.logPrefix}] ${instanceId}: Too few entities (${entities.length} < ${config.minEntitiesForRebalancing}), skipping demotions`
    );
    return [];
  }

  const demotionCount = Math.floor(entities.length * config.demotionPercentage);

  if (demotionCount === 0) {
    logger.info(
      `[${config.logPrefix}] ${instanceId}: Demotion count is 0 (${entities.length} entities), skipping`
    );
    return [];
  }

  const toDemote = entities.slice(0, demotionCount);
  logger.info(
    `[${config.logPrefix}] ${instanceId}: ${toDemote.length} entities eligible for demotion (bottom ${config.demotionPercentage * 100}% of ${entities.length})`
  );

  return toDemote;
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
  await adapter.updateEntityLeague(entity.id, nextTier, newLeagueId);

  const lp = adapter.getEntityLeaguePoints(entity);
  logger.info(
    `[${config.logPrefix}] Promoted: ${adapter.getEntityDisplayName(entity)} (${currentTier} → ${nextTier}, LP: ${lp} retained)`
  );

  // Record league history (non-blocking)
  try {
    const cycleNumber = await getCurrentCycleNumber();
    await recordTierChange({
      entityType: adapter.entityType,
      entityId: entity.id,
      userId: adapter.getEntityOwnerId(entity),
      changeType: 'promotion',
      sourceTier: currentTier,
      destinationTier: nextTier,
      sourceLeagueId: adapter.getEntityLeagueId(entity),
      destinationLeagueId: newLeagueId,
      leaguePoints: lp,
      cycleNumber,
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
  await adapter.updateEntityLeague(entity.id, previousTier, newLeagueId);

  const lp = adapter.getEntityLeaguePoints(entity);
  logger.info(
    `[${config.logPrefix}] Demoted: ${adapter.getEntityDisplayName(entity)} (${currentTier} → ${previousTier}, LP: ${lp} retained)`
  );

  // Record league history (non-blocking)
  try {
    const cycleNumber = await getCurrentCycleNumber();
    await recordTierChange({
      entityType: adapter.entityType,
      entityId: entity.id,
      userId: adapter.getEntityOwnerId(entity),
      changeType: 'demotion',
      sourceTier: currentTier,
      destinationTier: previousTier,
      sourceLeagueId: adapter.getEntityLeagueId(entity),
      destinationLeagueId: newLeagueId,
      leaguePoints: lp,
      cycleNumber,
    });
  } catch (error) {
    logger.error(`[${config.logPrefix}] Failed to record demotion history for ${adapter.entityType} ${entity.id}: ${error}`);
  }
}

/**
 * Rebalance a single tier — process each instance, collect candidates, execute moves.
 */
async function rebalanceTier<T extends LeagueEntityBase>(
  tier: string,
  config: LeagueEngineConfig,
  adapter: LeagueAdapter<T>,
  excludeIds: Set<number>,
): Promise<TierRebalancingSummary> {
  logger.info(`\n[${config.logPrefix}] Processing ${tier.toUpperCase()} league...`);

  const totalInTier = await adapter.countEntitiesInTier(tier);

  const summary: TierRebalancingSummary = {
    tier,
    entitiesInTier: totalInTier,
    promoted: 0,
    demoted: 0,
    eligibleEntities: 0,
  };

  const instances = await adapter.getInstancesForTier(tier);

  logger.info(`[${config.logPrefix}] ${tier}: ${totalInTier} total entities across ${instances.length} instances`);

  // Collect all promotion and demotion candidates across instances
  const allPromotionCandidates: T[] = [];
  const allDemotionCandidates: T[] = [];

  for (const instance of instances) {
    logger.info(`[${config.logPrefix}] Processing ${instance.leagueId}...`);

    const eligibleInInstance = await adapter.countEligibleInInstance(
      instance.leagueId, config.minCyclesForRebalancing, excludeIds
    );

    summary.eligibleEntities += eligibleInInstance;

    if (eligibleInInstance < config.minEntitiesForRebalancing) {
      logger.info(
        `[${config.logPrefix}] ${instance.leagueId}: Skipping (${eligibleInInstance} eligible, need ${config.minEntitiesForRebalancing})`
      );
      continue;
    }

    const toPromote = await determinePromotionsForInstance(instance.leagueId, config, adapter, excludeIds);
    allPromotionCandidates.push(...toPromote);

    const toDemote = await determineDemotionsForInstance(instance.leagueId, config, adapter, excludeIds);
    allDemotionCandidates.push(...toDemote);
  }

  // Check if destination tier needs a minimum cohort before promoting
  const nextTier = getNextTierUp(tier, config.tiers);
  let promotionsBlocked = false;

  if (nextTier && allPromotionCandidates.length > 0) {
    const entitiesInDestination = await adapter.countEntitiesInDestinationTier(nextTier);

    if (entitiesInDestination === 0 && allPromotionCandidates.length < config.minCohortForNewTier) {
      logger.info(
        `[${config.logPrefix}] ${tier}: Holding promotions — destination ${nextTier} is empty, need ${config.minCohortForNewTier} candidates but only have ${allPromotionCandidates.length}`
      );
      promotionsBlocked = true;
    }
  }

  // Execute promotions (unless blocked by cohort requirement)
  if (!promotionsBlocked) {
    for (const entity of allPromotionCandidates) {
      try {
        await promoteEntity(entity, config, adapter);
        excludeIds.add(entity.id);
        summary.promoted++;
      } catch (error) {
        logger.error(`[${config.logPrefix}] Error promoting entity ${entity.id}:`, error);
      }
    }
  }

  // Execute demotions (always — not affected by cohort logic)
  for (const entity of allDemotionCandidates) {
    if (excludeIds.has(entity.id)) continue;
    try {
      await demoteEntity(entity, config, adapter);
      excludeIds.add(entity.id);
      summary.demoted++;
    } catch (error) {
      logger.error(`[${config.logPrefix}] Error demoting entity ${entity.id}:`, error);
    }
  }

  logger.info(
    `[${config.logPrefix}] ${tier}: Promoted ${summary.promoted}, Demoted ${summary.demoted} across ${instances.length} instances`
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

  const processedIds = new Set<number>();

  // Process each tier (bottom to top to avoid conflicts)
  for (const tier of config.tiers) {
    try {
      const summary = await rebalanceTier(tier, config, adapter, processedIds);
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
