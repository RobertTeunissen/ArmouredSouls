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
 */
export async function assignTeamBattleLeagueInstance(tier: TeamBattleLeagueTier): Promise<string> {
  return await prisma.$transaction(async (tx) => {
    // Acquire advisory lock for this tier (offset by 1000000 to avoid collision with tag team locks)
    const lockId = hashTierName(`team_battle_${tier}`);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

    const instances = await tx.teamBattle.groupBy({
      by: ['teamLeagueId'],
      where: {
        teamLeague: tier,
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
 */
export async function rebalanceTeamBattleInstances(tier: TeamBattleLeagueTier): Promise<void> {
  const allTeams = await prisma.teamBattle.findMany({
    where: {
      teamLeague: tier,
    },
    orderBy: [
      { teamLp: 'desc' },
      { id: 'asc' },
    ],
  });

  if (allTeams.length === 0) {
    logger.info(`[TeamBattleLeagueInstance] ${tier}: No teams, skipping`);
    return;
  }

  const targetInstanceCount = Math.ceil(allTeams.length / MAX_TEAMS_PER_INSTANCE);

  logger.info(`[TeamBattleLeagueInstance] Rebalancing ${tier}: ${allTeams.length} teams across ${targetInstanceCount} instances`);

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
    logger.info(`[TeamBattleLeagueInstance] ${tier}: Moved ${updates.length} teams`);
  } else {
    logger.info(`[TeamBattleLeagueInstance] ${tier}: Already balanced`);
  }
}

// ─── Team Battle Adapter ─────────────────────────────────────────────────────

export const teamBattleAdapter: LeagueAdapter<TeamBattle> = {
  entityType: 'team_battle',

  async getEntitiesWithMinPoints(instanceId, minLP, minCycles, excludeIds) {
    return prisma.teamBattle.findMany({
      where: {
        teamLeagueId: instanceId,
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
      where: { teamLeague: tier },
      select: { teamLeagueId: true },
      distinct: ['teamLeagueId'],
    });
    return instances.map(i => ({ leagueId: i.teamLeagueId }));
  },

  async countEntitiesInTier(tier) {
    return prisma.teamBattle.count({
      where: { teamLeague: tier },
    });
  },

  async countEntitiesInDestinationTier(tier) {
    return prisma.teamBattle.count({
      where: { teamLeague: tier },
    });
  },

  async assignInstance(tier) {
    return assignTeamBattleLeagueInstance(tier as TeamBattleLeagueTier);
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
    await rebalanceTeamBattleInstances(tier as TeamBattleLeagueTier);
  },

  async countAllEntities() {
    return prisma.teamBattle.count();
  },
};

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
 * Rebalance all team battle league tiers.
 * Called every cycle (daily cadence) after team battles are executed.
 * Requirements: R8.1–R8.8
 */
export async function rebalanceTeamBattleLeagues(): Promise<FullTeamBattleRebalancingSummary> {
  const result = await rebalanceAllTiers(TEAM_BATTLE_LEAGUE_CONFIG, teamBattleAdapter);

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
