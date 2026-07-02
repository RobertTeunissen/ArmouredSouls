import { Robot, StandingsMode } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { achievementService } from '../achievement';

import { 
  assignLeagueInstance,
  assignLeagueInstanceWithLock,
  rebalanceInstances, 
  LEAGUE_TIERS,
  LeagueTier,
  MAX_ROBOTS_PER_INSTANCE,
  InstanceOptions,
} from './leagueInstanceService';
import {
  LeagueAdapter,
  LeagueEngineConfig,
  InstanceInfo,
  rebalanceAllTiers,
  determinePromotionsForInstance,
  determineDemotionsForInstance,
  promoteEntity,
  demoteEntity,
} from './leagueEngine';

// Re-export for consumers that need the helper
export { getMinLPForPromotion } from './leaguePromotionThresholds';

// ─── Configuration ───────────────────────────────────────────────────────────

const PROMOTION_PERCENTAGE = 0.10;
const DEMOTION_PERCENTAGE = 0.10;
const MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING = 5;
const MIN_ROBOTS_FOR_REBALANCING = 10;
const MIN_COHORT_FOR_NEW_TIER = 3;

const ROBOT_LEAGUE_CONFIG: LeagueEngineConfig = {
  promotionPercentage: PROMOTION_PERCENTAGE,
  demotionPercentage: DEMOTION_PERCENTAGE,
  minCyclesForRebalancing: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING,
  minEntitiesForRebalancing: MIN_ROBOTS_FOR_REBALANCING,
  minCohortForNewTier: MIN_COHORT_FOR_NEW_TIER,
  logPrefix: 'Rebalancing',
  tiers: LEAGUE_TIERS,
  entityLabel: 'robot',
};

// ─── Robot Adapter (uses unified factory) ────────────────────────────────────

const robotAdapter: LeagueAdapter<any> = createStandingsAdapter('league_1v1', {
  maxPerInstance: MAX_ROBOTS_PER_INSTANCE,
  entityType: 'robot',
});

// ─── Public API (unchanged signatures) ──────────────────────────────────────

export interface RebalancingSummary {
  tier: LeagueTier;
  robotsInTier: number;
  promoted: number;
  demoted: number;
  eligibleRobots: number;
}

export interface FullRebalancingSummary {
  totalRobots: number;
  totalPromoted: number;
  totalDemoted: number;
  tierSummaries: RebalancingSummary[];
  errors: string[];
}

/**
 * Determine which robots should be promoted from a SPECIFIC INSTANCE
 * Robots must meet per-tier LP threshold AND be in top 10% AND ≥5 cycles in current league
 */
export async function determinePromotions(instanceId: string, excludeRobotIds: Set<number> = new Set()): Promise<Robot[]> {
  return determinePromotionsForInstance(instanceId, ROBOT_LEAGUE_CONFIG, robotAdapter, excludeRobotIds);
}

/**
 * Determine which robots should be demoted from a SPECIFIC INSTANCE
 */
export async function determineDemotions(instanceId: string, excludeRobotIds: Set<number> = new Set()): Promise<Robot[]> {
  return determineDemotionsForInstance(instanceId, ROBOT_LEAGUE_CONFIG, robotAdapter, excludeRobotIds);
}

/**
 * Promote a robot to the next tier
 * LP retention - league points are NOT reset to 0
 */
export async function promoteRobot(robot: Robot): Promise<void> {
  return promoteEntity(robot, ROBOT_LEAGUE_CONFIG, robotAdapter);
}

/**
 * Demote a robot to the previous tier
 * LP retention - league points are NOT reset to 0
 */
export async function demoteRobot(robot: Robot): Promise<void> {
  return demoteEntity(robot, ROBOT_LEAGUE_CONFIG, robotAdapter);
}

/**
 * Rebalance all league tiers
 */
export async function rebalanceLeagues(): Promise<FullRebalancingSummary> {
  const result = await rebalanceAllTiers(ROBOT_LEAGUE_CONFIG, robotAdapter);

  // Map engine result to the existing public interface
  return {
    totalRobots: result.totalEntities,
    totalPromoted: result.totalPromoted,
    totalDemoted: result.totalDemoted,
    tierSummaries: result.tierSummaries.map(s => ({
      tier: s.tier as LeagueTier,
      robotsInTier: s.entitiesInTier,
      promoted: s.promoted,
      demoted: s.demoted,
      eligibleRobots: s.eligibleEntities,
    })),
    errors: result.errors,
  };
}

// ─── KotH Rebalancing (Spec #40) ────────────────────────────────────────────

/**
 * Create a standings-based adapter for any mode.
 * Unified factory — all modes (1v1, 2v2, 3v3, tag_team, koth) use this.
 *
 * Options:
 *  - overrideMinLP: KotH uses 0 (no LP threshold for promotion, uses position-based ranking)
 *  - maxPerInstance: 100 for robots (1v1, koth), 50 for teams (2v2, 3v3, tag_team)
 *  - entityType: 'robot' | 'tag_team' | 'team_battle' (for league history recording)
 *  - useLocking: true for team creation (advisory lock on instance assignment)
 */
export interface StandingsAdapterOptions {
  overrideMinLP?: number;
  maxPerInstance?: number;
  entityType?: 'robot' | 'tag_team' | 'team_battle';
  useLocking?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createStandingsAdapter(mode: string, options: StandingsAdapterOptions | number = {}): LeagueAdapter<any> {
  // Backward compat: if second arg is a number, treat as overrideMinLP
  const opts: StandingsAdapterOptions = typeof options === 'number' ? { overrideMinLP: options } : options;

  const maxPerInstance = opts.maxPerInstance ?? MAX_ROBOTS_PER_INSTANCE;
  const entityType: 'robot' | 'tag_team' | 'team_battle' = opts.entityType ?? 'robot';
  const useLocking = opts.useLocking ?? false;
  // For standings queries, map to Prisma entity type ('robot' or 'team')
  const standingsEntityType = entityType === 'robot' ? 'robot' : 'team';

  const instanceOptions: InstanceOptions = { mode, maxPerInstance };

  return {
    entityType,
    mode,

    async getEntitiesWithMinPoints(instanceId, minLP, minCycles, excludeIds) {
      const effectiveMinLP = opts.overrideMinLP ?? minLP;
      return prisma.standing.findMany({
        where: {
          mode: mode as StandingsMode,
          leagueInstanceId: instanceId,
          cyclesInTier: { gte: minCycles },
          leaguePoints: { gte: effectiveMinLP },
          NOT: { entityId: { in: Array.from(excludeIds) } },
        },
        orderBy: [{ leaguePoints: 'desc' }],
      });
    },

    async countEligibleInInstance(instanceId, minCycles, excludeIds) {
      return prisma.standing.count({
        where: {
          mode: mode as StandingsMode,
          leagueInstanceId: instanceId,
          cyclesInTier: { gte: minCycles },
          NOT: { entityId: { in: Array.from(excludeIds) } },
        },
      });
    },

    async getEntitiesForDemotion(instanceId, minCycles, excludeIds) {
      return prisma.standing.findMany({
        where: {
          mode: mode as StandingsMode,
          leagueInstanceId: instanceId,
          cyclesInTier: { gte: minCycles },
          NOT: { entityId: { in: Array.from(excludeIds) } },
        },
        orderBy: [{ leaguePoints: 'asc' }],
      });
    },

    async getInstancesForTier(tier): Promise<InstanceInfo[]> {
      const standings = await prisma.standing.findMany({
        where: { mode: mode as StandingsMode, tier },
        distinct: ['leagueInstanceId'],
        select: { leagueInstanceId: true },
      });
      return standings.map(s => ({ leagueId: s.leagueInstanceId }));
    },

    async countEntitiesInTier(tier) {
      return prisma.standing.count({ where: { mode: mode as StandingsMode, tier } });
    },

    async countEntitiesInDestinationTier(tier) {
      return prisma.standing.count({ where: { mode: mode as StandingsMode, tier } });
    },

    async assignInstance(tier) {
      if (useLocking) {
        return assignLeagueInstanceWithLock(tier as LeagueTier, instanceOptions);
      }
      return assignLeagueInstance(tier as LeagueTier, instanceOptions);
    },

    async updateEntityLeague(entityId, newTier, newLeagueId) {
      await prisma.standing.updateMany({
        where: { entityType: standingsEntityType, entityId, mode: mode as StandingsMode },
        data: { tier: newTier, leagueInstanceId: newLeagueId, cyclesInTier: 0 },
      });
    },

    getEntityCurrentTier(entity) { return entity.tier; },
    getEntityLeagueId(entity) { return entity.leagueInstanceId; },
    getEntityLeaguePoints(entity) { return entity.leaguePoints; },
    getEntityOwnerId(entity) { return entity.entityId; },
    getEntityDisplayName(entity) { return `${standingsEntityType}#${entity.entityId}`; },

    async onPromoted(entity, newTier) {
      if (entityType === 'robot') {
        const robot = await prisma.robot.findUnique({ where: { id: entity.entityId }, select: { userId: true } });
        if (robot) {
          await achievementService.checkAndAward(robot.userId, entity.entityId, {
            type: 'league_promotion',
            data: { newLeague: newTier, robotId: entity.entityId },
          });
        }
      }
    },

    async rebalanceInstances(tier) {
      await rebalanceInstances(tier as LeagueTier, instanceOptions);
    },

    async countAllEntities() {
      return prisma.standing.count({ where: { mode: mode as StandingsMode } });
    },
  };
}

/**
 * Rebalance KotH leagues — uses the same engine as 1v1 but with mode='koth' and no LP threshold.
 * KotH uses position-based ranking instead of LP thresholds.
 * Min cycles set to 10 (vs 5 for other leagues) to balance promotion speed,
 * since KotH points accumulate faster than LP in head-to-head modes.
 */
export async function rebalanceKothLeagues(): Promise<FullRebalancingSummary> {
  const kothConfig: LeagueEngineConfig = {
    ...ROBOT_LEAGUE_CONFIG,
    minCyclesForRebalancing: 10,
    logPrefix: 'KotH Rebalancing',
  };
  const kothAdapter = createStandingsAdapter('koth', {
    overrideMinLP: 0,
    maxPerInstance: MAX_ROBOTS_PER_INSTANCE,
    entityType: 'robot',
  });
  const result = await rebalanceAllTiers(kothConfig, kothAdapter);

  return {
    totalRobots: result.totalEntities,
    totalPromoted: result.totalPromoted,
    totalDemoted: result.totalDemoted,
    tierSummaries: result.tierSummaries.map(s => ({
      tier: s.tier as LeagueTier,
      robotsInTier: s.entitiesInTier,
      promoted: s.promoted,
      demoted: s.demoted,
      eligibleRobots: s.eligibleEntities,
    })),
    errors: result.errors,
  };
}

// ─── Grand Melee Rebalancing (Spec #44) ─────────────────────────────────────

/**
 * Rebalance Grand Melee leagues — uses the same engine as KotH with mode='grand_melee' and no LP threshold.
 * Grand Melee uses position-based ranking instead of LP thresholds.
 * Min cycles set to 10 (same as KotH) to balance promotion speed,
 * since Grand Melee points accumulate faster than LP in head-to-head modes.
 */
export async function rebalanceGrandMeleeLeagues(): Promise<FullRebalancingSummary> {
  const grandMeleeConfig: LeagueEngineConfig = {
    ...ROBOT_LEAGUE_CONFIG,
    minCyclesForRebalancing: 10,
    logPrefix: 'Grand Melee Rebalancing',
  };
  const grandMeleeAdapter = createStandingsAdapter('grand_melee', {
    overrideMinLP: 0,
    maxPerInstance: MAX_ROBOTS_PER_INSTANCE,
    entityType: 'robot',
  });
  const result = await rebalanceAllTiers(grandMeleeConfig, grandMeleeAdapter);

  return {
    totalRobots: result.totalEntities,
    totalPromoted: result.totalPromoted,
    totalDemoted: result.totalDemoted,
    tierSummaries: result.tierSummaries.map(s => ({
      tier: s.tier as LeagueTier,
      robotsInTier: s.entitiesInTier,
      promoted: s.promoted,
      demoted: s.demoted,
      eligibleRobots: s.eligibleEntities,
    })),
    errors: result.errors,
  };
}
