import { Robot } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { achievementService } from '../achievement';

import { 
  assignLeagueInstance, 
  rebalanceInstances, 
  LEAGUE_TIERS,
  LeagueTier,
  getInstancesForTier,
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

// ─── Robot Adapter ───────────────────────────────────────────────────────────

const robotAdapter: LeagueAdapter<Robot> = {
  entityType: 'robot',

  async getEntitiesWithMinPoints(instanceId, minLP, minCycles, excludeIds) {
    return prisma.robot.findMany({
      where: {
        leagueId: instanceId,
        cyclesInCurrentLeague: { gte: minCycles },
        leaguePoints: { gte: minLP },
        NOT: [
          { name: 'Bye Robot' },
          { id: { in: Array.from(excludeIds) } },
        ],
      },
      orderBy: [
        { leaguePoints: 'desc' },
        { elo: 'desc' },
      ],
    });
  },

  async countEligibleInInstance(instanceId, minCycles, excludeIds) {
    return prisma.robot.count({
      where: {
        leagueId: instanceId,
        cyclesInCurrentLeague: { gte: minCycles },
        NOT: [
          { name: 'Bye Robot' },
          { id: { in: Array.from(excludeIds) } },
        ],
      },
    });
  },

  async getEntitiesForDemotion(instanceId, minCycles, excludeIds) {
    return prisma.robot.findMany({
      where: {
        leagueId: instanceId,
        cyclesInCurrentLeague: { gte: minCycles },
        NOT: [
          { name: 'Bye Robot' },
          { id: { in: Array.from(excludeIds) } },
        ],
      },
      orderBy: [
        { leaguePoints: 'asc' },
        { elo: 'asc' },
      ],
    });
  },

  async getInstancesForTier(tier): Promise<InstanceInfo[]> {
    const instances = await getInstancesForTier(tier as LeagueTier);
    return instances.map(i => ({ leagueId: i.leagueId }));
  },

  async countEntitiesInTier(tier) {
    return prisma.robot.count({
      where: {
        currentLeague: tier,
        NOT: { name: 'Bye Robot' },
      },
    });
  },

  async countEntitiesInDestinationTier(tier) {
    return prisma.robot.count({
      where: {
        currentLeague: tier,
        NOT: { name: 'Bye Robot' },
      },
    });
  },

  async assignInstance(tier) {
    return assignLeagueInstance(tier as LeagueTier);
  },

  async updateEntityLeague(entityId, newTier, newLeagueId) {
    await prisma.robot.update({
      where: { id: entityId },
      data: {
        currentLeague: newTier,
        leagueId: newLeagueId,
        cyclesInCurrentLeague: 0,
      },
    });
  },

  getEntityCurrentTier(entity) {
    return entity.currentLeague;
  },

  getEntityLeagueId(entity) {
    return entity.leagueId;
  },

  getEntityLeaguePoints(entity) {
    return entity.leaguePoints;
  },

  getEntityOwnerId(entity) {
    return entity.userId;
  },

  getEntityDisplayName(entity) {
    return entity.name;
  },

  async onPromoted(entity, newTier) {
    await achievementService.checkAndAward(entity.userId, entity.id, {
      type: 'league_promotion',
      data: { newLeague: newTier, robotId: entity.id },
    });
  },

  async rebalanceInstances(tier) {
    await rebalanceInstances(tier as LeagueTier);
  },

  async countAllEntities() {
    return prisma.robot.count({
      where: { NOT: { name: 'Bye Robot' } },
    });
  },
};

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
