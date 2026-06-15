/**
 * Team Battle League Adapter
 *
 * Implements `LeagueAdapter<TeamBattle>` for the generic league engine.
 * Handles promotion/demotion, instance assignment, and rebalancing for
 * 2v2 and 3v3 Team Battle leagues. Follows the same pattern as the
 * tag team adapter in `tagTeamLeagueRebalancingService.ts`.
 *
 * Config mirrors 1v1 league: 10% promote, 10% demote, 5 min cycles,
 * instance size target 50 teams.
 *
 * @module services/team-battle/teamBattleAdapter
 */

import { TeamBattle } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
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

// ─── Constants ───────────────────────────────────────────────────────────────

/** Six-tier structure matching 1v1 and tag team leagues */
export const TEAM_BATTLE_LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;
export type TeamBattleLeagueTier = typeof TEAM_BATTLE_LEAGUE_TIERS[number];

/** Maximum teams per league instance (design: 50 teams) */
export const MAX_TEAMS_PER_INSTANCE = 50;

/** Starting tier for new teams */
export const STARTING_TIER: TeamBattleLeagueTier = 'bronze';

/** Starting LP for new teams */
export const STARTING_LP = 0;

// ─── Configuration ───────────────────────────────────────────────────────────

const PROMOTION_PERCENTAGE = 0.10;
const DEMOTION_PERCENTAGE = 0.10;
const MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING = 5;
const MIN_TEAMS_FOR_REBALANCING = 4;
const MIN_COHORT_FOR_NEW_TIER = 3;

export const TEAM_BATTLE_LEAGUE_CONFIG: LeagueEngineConfig = {
  promotionPercentage: PROMOTION_PERCENTAGE,
  demotionPercentage: DEMOTION_PERCENTAGE,
  minCyclesForRebalancing: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING,
  minEntitiesForRebalancing: MIN_TEAMS_FOR_REBALANCING,
  minCohortForNewTier: MIN_COHORT_FOR_NEW_TIER,
  logPrefix: 'TeamBattleRebalancing',
  tiers: TEAM_BATTLE_LEAGUE_TIERS,
  entityLabel: 'team',
};

// ─── Instance Management ─────────────────────────────────────────────────────

/**
 * Assign a team battle to an appropriate league instance.
 * Places team in instance with most free spots. Creates new instance when all are full.
 * Uses PostgreSQL advisory locks to prevent race conditions.
 *
 * Instances are scoped per teamSize — 2v2 and 3v3 teams occupy separate instances.
 */
export async function assignTeamBattleLeagueInstance(tier: TeamBattleLeagueTier, teamSize: 2 | 3 = 2): Promise<string> {
  return await prisma.$transaction(async (tx) => {
    // Acquire advisory lock scoped to tier + teamSize to avoid collision
    const lockId = hashTierName(`team_battle_${tier}_${teamSize}v${teamSize}`);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

    const instances = await tx.teamBattle.groupBy({
      by: ['teamLeagueId'],
      where: {
        teamLeague: tier,
        teamSize,
      },
      _count: {
        id: true,
      },
    });

    if (instances.length === 0) {
      return `${tier}_1`;
    }

    const leagueInstances = instances
      .map((instance) => {
        const instanceNumber = parseInt(instance.teamLeagueId.split('_')[1] || '1');
        return {
          leagueId: instance.teamLeagueId,
          instanceNumber,
          currentTeams: instance._count.id,
        };
      })
      .sort((a, b) => a.currentTeams - b.currentTeams);

    const leastFull = leagueInstances[0];

    if (leastFull.currentTeams >= MAX_TEAMS_PER_INSTANCE) {
      const nextInstanceNumber = Math.max(...leagueInstances.map((i) => i.instanceNumber)) + 1;
      return `${tier}_${nextInstanceNumber}`;
    }

    return leastFull.leagueId;
  });
}

/**
 * Hash a tier name to a consistent integer for advisory locking.
 */
function hashTierName(tier: string): number {
  let hash = 0;
  for (let i = 0; i < tier.length; i++) {
    hash = ((hash << 5) - hash) + tier.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 2147483647;
}

/**
 * Rebalance team battles across instances in a tier.
 * Redistributes teams evenly using round-robin (sorted by LP desc for competitive balance).
 * Scoped per teamSize — 2v2 and 3v3 are rebalanced independently.
 */
export async function rebalanceTeamBattleInstances(tier: TeamBattleLeagueTier, teamSize: 2 | 3 = 2): Promise<void> {
  const allTeams = await prisma.teamBattle.findMany({
    where: {
      teamLeague: tier,
      teamSize,
    },
    orderBy: [
      { teamLp: 'desc' },
      { id: 'asc' },
    ],
  });

  if (allTeams.length === 0) {
    logger.info(`[TeamBattleLeagueInstance] ${tier} ${teamSize}v${teamSize}: No teams, skipping`);
    return;
  }

  const targetInstanceCount = Math.ceil(allTeams.length / MAX_TEAMS_PER_INSTANCE);

  logger.info(`[TeamBattleLeagueInstance] Rebalancing ${tier} ${teamSize}v${teamSize}: ${allTeams.length} teams across ${targetInstanceCount} instances`);

  const updates: Promise<unknown>[] = [];

  for (let i = 0; i < allTeams.length; i++) {
    const team = allTeams[i];
    const targetInstanceNumber = (i % targetInstanceCount) + 1;
    const targetLeagueId = `${tier}_${targetInstanceNumber}`;

    if (team.teamLeagueId !== targetLeagueId) {
      updates.push(
        prisma.teamBattle.update({
          where: { id: team.id },
          data: { teamLeagueId: targetLeagueId },
        })
      );
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
    logger.info(`[TeamBattleLeagueInstance] ${tier} ${teamSize}v${teamSize}: Moved ${updates.length} teams`);
  } else {
    logger.info(`[TeamBattleLeagueInstance] ${tier} ${teamSize}v${teamSize}: Already balanced`);
  }
}

// ─── Team Battle Adapter ─────────────────────────────────────────────────────

/**
 * Creates a teamSize-scoped league adapter.
 * 2v2 and 3v3 teams are managed independently — separate instances per size.
 */
function createTeamBattleAdapter(teamSize: 2 | 3): LeagueAdapter<TeamBattle> {
  return {
    entityType: 'team_battle',

    async getEntitiesWithMinPoints(instanceId, minLP, minCycles, excludeIds) {
      return prisma.teamBattle.findMany({
        where: {
          teamLeagueId: instanceId,
          teamSize,
          cyclesInLeague: { gte: minCycles },
          teamLp: { gte: minLP },
          NOT: {
            id: { in: Array.from(excludeIds) },
          },
        },
        orderBy: [
          { teamLp: 'desc' },
          { id: 'asc' },
        ],
      });
    },

    async countEligibleInInstance(instanceId, minCycles, excludeIds) {
      return prisma.teamBattle.count({
        where: {
          teamLeagueId: instanceId,
          teamSize,
          cyclesInLeague: { gte: minCycles },
          NOT: {
            id: { in: Array.from(excludeIds) },
          },
        },
      });
    },

    async getEntitiesForDemotion(instanceId, minCycles, excludeIds) {
      return prisma.teamBattle.findMany({
        where: {
          teamLeagueId: instanceId,
          teamSize,
          cyclesInLeague: { gte: minCycles },
          NOT: {
            id: { in: Array.from(excludeIds) },
          },
        },
        orderBy: [
          { teamLp: 'asc' },
          { id: 'asc' },
        ],
      });
    },

    async getInstancesForTier(tier): Promise<InstanceInfo[]> {
      const instances = await prisma.teamBattle.findMany({
        where: { teamLeague: tier, teamSize },
        select: { teamLeagueId: true },
        distinct: ['teamLeagueId'],
      });
      return instances.map(i => ({ leagueId: i.teamLeagueId }));
    },

    async countEntitiesInTier(tier) {
      return prisma.teamBattle.count({
        where: { teamLeague: tier, teamSize },
      });
    },

    async countEntitiesInDestinationTier(tier) {
      return prisma.teamBattle.count({
        where: { teamLeague: tier, teamSize },
      });
    },

    async assignInstance(tier) {
      return assignTeamBattleLeagueInstance(tier as TeamBattleLeagueTier, teamSize);
    },

    async updateEntityLeague(entityId, newTier, newLeagueId) {
      await prisma.teamBattle.update({
        where: { id: entityId },
        data: {
          teamLeague: newTier,
          teamLeagueId: newLeagueId,
          cyclesInLeague: 0,
        },
      });
    },

    getEntityCurrentTier(entity) {
      return entity.teamLeague;
    },

    getEntityLeagueId(entity) {
      return entity.teamLeagueId;
    },

    getEntityLeaguePoints(entity) {
      return entity.teamLp;
    },

    getEntityOwnerId(entity) {
      return entity.stableId;
    },

    getEntityDisplayName(entity) {
      return `Team "${entity.teamName}" (${entity.id})`;
    },

    async rebalanceInstances(tier) {
      await rebalanceTeamBattleInstances(tier as TeamBattleLeagueTier, teamSize);
    },

    async countAllEntities() {
      return prisma.teamBattle.count({ where: { teamSize } });
    },
  };
}

/** Adapter for 2v2 team battle leagues */
export const teamBattle2v2Adapter: LeagueAdapter<TeamBattle> = createTeamBattleAdapter(2);

/** Adapter for 3v3 team battle leagues */
export const teamBattle3v3Adapter: LeagueAdapter<TeamBattle> = createTeamBattleAdapter(3);

/**
 * Legacy adapter — aliases to teamBattle2v2Adapter (filters by teamSize=2).
 * @deprecated Use teamBattle2v2Adapter or teamBattle3v3Adapter instead.
 */
export const teamBattleAdapter: LeagueAdapter<TeamBattle> = teamBattle2v2Adapter;

// ─── Public API ──────────────────────────────────────────────────────────────

export interface TeamBattleRebalancingSummary {
  tier: TeamBattleLeagueTier;
  teamsInTier: number;
  promoted: number;
  demoted: number;
  eligibleTeams: number;
}

export interface FullTeamBattleRebalancingSummary {
  totalTeams: number;
  totalPromoted: number;
  totalDemoted: number;
  tierSummaries: TeamBattleRebalancingSummary[];
  errors: string[];
}

/**
 * Determine which teams should be promoted from a specific instance.
 * Requirement R8.2: Promote top 10% of eligible teams (≥5 cycles in tier AND per-tier LP threshold)
 */
export async function determineTeamBattlePromotions(
  instanceId: string,
  excludeTeamIds: Set<number> = new Set()
): Promise<TeamBattle[]> {
  return determinePromotionsForInstance(instanceId, TEAM_BATTLE_LEAGUE_CONFIG, teamBattleAdapter, excludeTeamIds);
}

/**
 * Determine which teams should be demoted from a specific instance.
 * Requirement R8.3: Demote bottom 10% of eligible teams (≥5 cycles in tier)
 */
export async function determineTeamBattleDemotions(
  instanceId: string,
  excludeTeamIds: Set<number> = new Set()
): Promise<TeamBattle[]> {
  return determineDemotionsForInstance(instanceId, TEAM_BATTLE_LEAGUE_CONFIG, teamBattleAdapter, excludeTeamIds);
}

/**
 * Promote a team to the next tier.
 * LP retention — league points are NOT reset to 0.
 */
export async function promoteTeamBattle(team: TeamBattle): Promise<void> {
  return promoteEntity(team, TEAM_BATTLE_LEAGUE_CONFIG, teamBattleAdapter);
}

/**
 * Demote a team to the previous tier.
 * LP retention — league points are NOT reset to 0.
 */
export async function demoteTeamBattle(team: TeamBattle): Promise<void> {
  return demoteEntity(team, TEAM_BATTLE_LEAGUE_CONFIG, teamBattleAdapter);
}

/**
 * Rebalance all team battle league tiers for a specific team size.
 * Called every cycle (daily cadence) after team battles are executed.
 * Requirements: R8.1–R8.8
 */
export async function rebalanceTeamBattleLeagues(teamSize: 2 | 3 = 2): Promise<FullTeamBattleRebalancingSummary> {
  const adapter = teamSize === 2 ? teamBattle2v2Adapter : teamBattle3v3Adapter;
  const result = await rebalanceAllTiers(TEAM_BATTLE_LEAGUE_CONFIG, adapter);

  return {
    totalTeams: result.totalEntities,
    totalPromoted: result.totalPromoted,
    totalDemoted: result.totalDemoted,
    tierSummaries: result.tierSummaries.map(s => ({
      tier: s.tier as TeamBattleLeagueTier,
      teamsInTier: s.entitiesInTier,
      promoted: s.promoted,
      demoted: s.demoted,
      eligibleTeams: s.eligibleEntities,
    })),
    errors: result.errors,
  };
}

// ─── Tag Team League Adapter ─────────────────────────────────────────────────

/**
 * Configuration for the tag team league adapter.
 * Unified with team battle leagues: 10% promote, 10% demote, min 5 cycles,
 * min 4 teams, 50 max per instance.
 */
export const TAG_TEAM_LEAGUE_CONFIG: LeagueEngineConfig = {
  promotionPercentage: 0.10,
  demotionPercentage: 0.10,
  minCyclesForRebalancing: 5,
  minEntitiesForRebalancing: 4,
  minCohortForNewTier: 3,
  logPrefix: 'TagTeamLeagueRebalancing',
  tiers: TEAM_BATTLE_LEAGUE_TIERS,
  entityLabel: 'team',
};

/**
 * Assign a tag team to an appropriate tag team league instance.
 * Places team in the `tagTeamLeagueId` instance with most free spots.
 * Creates new instance when all are full.
 * Uses PostgreSQL advisory locks to prevent race conditions.
 */
export async function assignTagTeamLeagueInstanceOnTeamBattle(tier: TeamBattleLeagueTier): Promise<string> {
  return await prisma.$transaction(async (tx) => {
    const lockId = hashTierName(`tag_team_league_${tier}`);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

    const instances = await tx.teamBattle.groupBy({
      by: ['tagTeamLeagueId'],
      where: {
        tagTeamLeague: tier,
        teamSize: 2,
      },
      _count: {
        id: true,
      },
    });

    if (instances.length === 0) {
      return `${tier}_1`;
    }

    const leagueInstances = instances
      .map((instance) => {
        const instanceNumber = parseInt(instance.tagTeamLeagueId.split('_')[1] || '1');
        return {
          leagueId: instance.tagTeamLeagueId,
          instanceNumber,
          currentTeams: instance._count.id,
        };
      })
      .sort((a, b) => a.currentTeams - b.currentTeams);

    const leastFull = leagueInstances[0];

    if (leastFull.currentTeams >= MAX_TEAMS_PER_INSTANCE) {
      const nextInstanceNumber = Math.max(...leagueInstances.map((i) => i.instanceNumber)) + 1;
      return `${tier}_${nextInstanceNumber}`;
    }

    return leastFull.leagueId;
  });
}

/**
 * Rebalance tag team league instances within a tier.
 * Redistributes teams evenly using round-robin (sorted by tagTeamLp desc for competitive balance).
 * Operates on TeamBattle rows where teamSize=2, using tagTeamLeagueId for instance assignment.
 */
export async function rebalanceTagTeamLeagueInstances(tier: TeamBattleLeagueTier): Promise<void> {
  const allTeams = await prisma.teamBattle.findMany({
    where: {
      tagTeamLeague: tier,
      teamSize: 2,
    },
    orderBy: [
      { tagTeamLp: 'desc' },
      { id: 'asc' },
    ],
  });

  if (allTeams.length === 0) {
    logger.info(`[TagTeamLeagueInstance] ${tier}: No teams, skipping`);
    return;
  }

  const targetInstanceCount = Math.ceil(allTeams.length / MAX_TEAMS_PER_INSTANCE);

  logger.info(`[TagTeamLeagueInstance] Rebalancing ${tier}: ${allTeams.length} teams across ${targetInstanceCount} instances`);

  const updates: Promise<unknown>[] = [];

  for (let i = 0; i < allTeams.length; i++) {
    const team = allTeams[i];
    const targetInstanceNumber = (i % targetInstanceCount) + 1;
    const targetLeagueId = `${tier}_${targetInstanceNumber}`;

    if (team.tagTeamLeagueId !== targetLeagueId) {
      updates.push(
        prisma.teamBattle.update({
          where: { id: team.id },
          data: { tagTeamLeagueId: targetLeagueId },
        })
      );
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
    logger.info(`[TagTeamLeagueInstance] ${tier}: Moved ${updates.length} teams`);
  } else {
    logger.info(`[TagTeamLeagueInstance] ${tier}: Already balanced`);
  }
}

/**
 * Tag-team-scoped league adapter.
 *
 * Uses the same `LeagueAdapter<TeamBattle>` interface but remaps all league fields
 * to the tag team columns: `tagTeamLp`, `tagTeamLeague`, `tagTeamLeagueId`,
 * `cyclesInTagTeamLeague`. Filters by `teamSize = 2`.
 *
 * This adapter is consumed by `tagTeamLeagueRebalancingService` after rewiring.
 */
export const tagTeamLeagueAdapter: LeagueAdapter<TeamBattle> = {
  entityType: 'tag_team',

  async getEntitiesWithMinPoints(instanceId, minLP, minCycles, excludeIds) {
    return prisma.teamBattle.findMany({
      where: {
        tagTeamLeagueId: instanceId,
        teamSize: 2,
        cyclesInTagTeamLeague: { gte: minCycles },
        tagTeamLp: { gte: minLP },
        NOT: {
          id: { in: Array.from(excludeIds) },
        },
      },
      orderBy: [
        { tagTeamLp: 'desc' },
        { id: 'asc' },
      ],
    });
  },

  async countEligibleInInstance(instanceId, minCycles, excludeIds) {
    return prisma.teamBattle.count({
      where: {
        tagTeamLeagueId: instanceId,
        teamSize: 2,
        cyclesInTagTeamLeague: { gte: minCycles },
        NOT: {
          id: { in: Array.from(excludeIds) },
        },
      },
    });
  },

  async getEntitiesForDemotion(instanceId, minCycles, excludeIds) {
    return prisma.teamBattle.findMany({
      where: {
        tagTeamLeagueId: instanceId,
        teamSize: 2,
        cyclesInTagTeamLeague: { gte: minCycles },
        NOT: {
          id: { in: Array.from(excludeIds) },
        },
      },
      orderBy: [
        { tagTeamLp: 'asc' },
        { id: 'asc' },
      ],
    });
  },

  async getInstancesForTier(tier): Promise<InstanceInfo[]> {
    const instances = await prisma.teamBattle.findMany({
      where: { tagTeamLeague: tier, teamSize: 2 },
      select: { tagTeamLeagueId: true },
      distinct: ['tagTeamLeagueId'],
    });
    return instances.map(i => ({ leagueId: i.tagTeamLeagueId }));
  },

  async countEntitiesInTier(tier) {
    return prisma.teamBattle.count({
      where: { tagTeamLeague: tier, teamSize: 2 },
    });
  },

  async countEntitiesInDestinationTier(tier) {
    return prisma.teamBattle.count({
      where: { tagTeamLeague: tier, teamSize: 2 },
    });
  },

  async assignInstance(tier) {
    return assignTagTeamLeagueInstanceOnTeamBattle(tier as TeamBattleLeagueTier);
  },

  async updateEntityLeague(entityId, newTier, newLeagueId) {
    await prisma.teamBattle.update({
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
    return entity.tagTeamLp;
  },

  getEntityOwnerId(entity) {
    return entity.stableId;
  },

  getEntityDisplayName(entity) {
    return `Team "${entity.teamName}" (${entity.id})`;
  },

  async rebalanceInstances(tier) {
    await rebalanceTagTeamLeagueInstances(tier as TeamBattleLeagueTier);
  },

  async countAllEntities() {
    return prisma.teamBattle.count({ where: { teamSize: 2 } });
  },
};
