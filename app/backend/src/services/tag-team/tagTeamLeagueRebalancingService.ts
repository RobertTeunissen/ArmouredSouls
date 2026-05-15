import { TagTeam } from '../../../generated/prisma';
import prisma from '../../lib/prisma';

import { 
  assignTagTeamLeagueInstance, 
  rebalanceTagTeamInstances,
  TAG_TEAM_LEAGUE_TIERS,
  TagTeamLeagueTier 
} from './tagTeamLeagueInstanceService';
import {
  LeagueAdapter,
  LeagueEngineConfig,
  InstanceInfo,
  rebalanceAllTiers,
  determinePromotionsForInstance,
  determineDemotionsForInstance,
  promoteEntity,
  demoteEntity,
} from '../league/leagueEngine';

// Re-export for consumers that need the helper
export { getMinLPForPromotion } from '../league/leaguePromotionThresholds';

// Re-export from instance service for convenience
export { TAG_TEAM_LEAGUE_TIERS, TagTeamLeagueTier };

// ─── Configuration ───────────────────────────────────────────────────────────

const PROMOTION_PERCENTAGE = 0.10;
const DEMOTION_PERCENTAGE = 0.10;
const MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING = 5;
const MIN_TEAMS_FOR_REBALANCING = 10;
const MIN_COHORT_FOR_NEW_TIER = 3;

const TAG_TEAM_LEAGUE_CONFIG: LeagueEngineConfig = {
  promotionPercentage: PROMOTION_PERCENTAGE,
  demotionPercentage: DEMOTION_PERCENTAGE,
  minCyclesForRebalancing: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING,
  minEntitiesForRebalancing: MIN_TEAMS_FOR_REBALANCING,
  minCohortForNewTier: MIN_COHORT_FOR_NEW_TIER,
  logPrefix: 'TagTeamRebalancing',
  tiers: TAG_TEAM_LEAGUE_TIERS,
  entityLabel: 'team',
};

// ─── Tag Team Adapter ────────────────────────────────────────────────────────

const tagTeamAdapter: LeagueAdapter<TagTeam> = {
  entityType: 'tag_team',

  async getEntitiesWithMinPoints(instanceId, minLP, minCycles, excludeIds) {
    return prisma.tagTeam.findMany({
      where: {
        tagTeamLeagueId: instanceId,
        cyclesInTagTeamLeague: { gte: minCycles },
        tagTeamLeaguePoints: { gte: minLP },
        NOT: {
          id: { in: Array.from(excludeIds) },
        },
      },
      orderBy: [
        { tagTeamLeaguePoints: 'desc' },
        { id: 'asc' },
      ],
    });
  },

  async countEligibleInInstance(instanceId, minCycles, excludeIds) {
    return prisma.tagTeam.count({
      where: {
        tagTeamLeagueId: instanceId,
        cyclesInTagTeamLeague: { gte: minCycles },
        NOT: {
          id: { in: Array.from(excludeIds) },
        },
      },
    });
  },

  async getEntitiesForDemotion(instanceId, minCycles, excludeIds) {
    return prisma.tagTeam.findMany({
      where: {
        tagTeamLeagueId: instanceId,
        cyclesInTagTeamLeague: { gte: minCycles },
        NOT: {
          id: { in: Array.from(excludeIds) },
        },
      },
      orderBy: [
        { tagTeamLeaguePoints: 'asc' },
        { id: 'asc' },
      ],
    });
  },

  async getInstancesForTier(tier): Promise<InstanceInfo[]> {
    const instances = await prisma.tagTeam.findMany({
      where: { tagTeamLeague: tier },
      select: { tagTeamLeagueId: true },
      distinct: ['tagTeamLeagueId'],
    });
    return instances.map(i => ({ leagueId: i.tagTeamLeagueId }));
  },

  async countEntitiesInTier(tier) {
    return prisma.tagTeam.count({
      where: { tagTeamLeague: tier },
    });
  },

  async countEntitiesInDestinationTier(tier) {
    return prisma.tagTeam.count({
      where: { tagTeamLeague: tier },
    });
  },

  async assignInstance(tier) {
    return assignTagTeamLeagueInstance(tier as TagTeamLeagueTier);
  },

  async updateEntityLeague(entityId, newTier, newLeagueId) {
    await prisma.tagTeam.update({
      where: { id: entityId },
      data: {
        tagTeamLeague: newTier,
        tagTeamLeagueId: newLeagueId,
        cyclesInTagTeamLeague: 0,
      },
    });
  },

  getEntityCurrentTier(entity) {
    return entity.tagTeamLeague;
  },

  getEntityLeagueId(entity) {
    return entity.tagTeamLeagueId;
  },

  getEntityLeaguePoints(entity) {
    return entity.tagTeamLeaguePoints;
  },

  getEntityOwnerId(entity) {
    return entity.stableId;
  },

  getEntityDisplayName(entity) {
    return `Team ${entity.id}`;
  },

  // No achievement hook for tag teams

  async rebalanceInstances(tier) {
    await rebalanceTagTeamInstances(tier as TagTeamLeagueTier);
  },

  async countAllEntities() {
    return prisma.tagTeam.count();
  },
};

// ─── Public API (unchanged signatures) ──────────────────────────────────────

export interface TagTeamRebalancingSummary {
  tier: TagTeamLeagueTier;
  teamsInTier: number;
  promoted: number;
  demoted: number;
  eligibleTeams: number;
}

export interface FullTagTeamRebalancingSummary {
  totalTeams: number;
  totalPromoted: number;
  totalDemoted: number;
  tierSummaries: TagTeamRebalancingSummary[];
  errors: string[];
}

/**
 * Determine which teams should be promoted from a SPECIFIC INSTANCE
 * Requirement 6.3: Promote top 10% of eligible teams (≥5 cycles in tier AND per-tier LP threshold)
 */
export async function determinePromotions(
  instanceId: string,
  excludeTeamIds: Set<number> = new Set()
): Promise<TagTeam[]> {
  return determinePromotionsForInstance(instanceId, TAG_TEAM_LEAGUE_CONFIG, tagTeamAdapter, excludeTeamIds);
}

/**
 * Determine which teams should be demoted from a SPECIFIC INSTANCE
 * Requirement 6.4: Demote bottom 10% of eligible teams (≥5 cycles in tier)
 */
export async function determineDemotions(
  instanceId: string,
  excludeTeamIds: Set<number> = new Set()
): Promise<TagTeam[]> {
  return determineDemotionsForInstance(instanceId, TAG_TEAM_LEAGUE_CONFIG, tagTeamAdapter, excludeTeamIds);
}

/**
 * Promote a team to the next tier
 * LP retention - league points are NOT reset to 0
 */
export async function promoteTeam(team: TagTeam): Promise<void> {
  return promoteEntity(team, TAG_TEAM_LEAGUE_CONFIG, tagTeamAdapter);
}

/**
 * Demote a team to the previous tier
 * LP retention - league points are NOT reset to 0
 */
export async function demoteTeam(team: TagTeam): Promise<void> {
  return demoteEntity(team, TAG_TEAM_LEAGUE_CONFIG, tagTeamAdapter);
}

/**
 * Rebalance all tag team league tiers
 * This should be called every other cycle (odd cycles only)
 */
export async function rebalanceTagTeamLeagues(): Promise<FullTagTeamRebalancingSummary> {
  const result = await rebalanceAllTiers(TAG_TEAM_LEAGUE_CONFIG, tagTeamAdapter);

  // Map engine result to the existing public interface
  return {
    totalTeams: result.totalEntities,
    totalPromoted: result.totalPromoted,
    totalDemoted: result.totalDemoted,
    tierSummaries: result.tierSummaries.map(s => ({
      tier: s.tier as TagTeamLeagueTier,
      teamsInTier: s.entitiesInTier,
      promoted: s.promoted,
      demoted: s.demoted,
      eligibleTeams: s.eligibleEntities,
    })),
    errors: result.errors,
  };
}
