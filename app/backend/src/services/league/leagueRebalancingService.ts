import { StandingsMode, type Standing } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { achievementService } from '../achievement';

import {
  assignLeagueInstance,
  assignLeagueInstanceWithLock,
  maintainInstances,
  LeagueTier,
  MAX_ROBOTS_PER_INSTANCE,
  InstanceOptions,
} from './leagueInstanceService';
import {
  FullRebalancingResult,
  LeagueAdapter,
  LeagueEngineConfig,
  InstanceInfo,
  rebalanceAllTiers,
} from './leagueEngine';

import { HEAD_TO_HEAD_LEAGUE_RULES, PLACEMENT_LEAGUE_RULES } from './league-rules';

// ─── Configuration ───────────────────────────────────────────────────────────

export const ROBOT_LEAGUE_CONFIG: LeagueEngineConfig = {
  ...HEAD_TO_HEAD_LEAGUE_RULES,
  logPrefix: 'Rebalancing',
  entityLabel: 'robot',
};

// ─── Standings adapter ───────────────────────────────────────────────────────

/**
 * Options for a standings-based adapter.
 *  - maxPerInstance: 100 for every current head-to-head and placement-mode instance
 *  - entityType: 'robot' | 'tag_team' | 'team_battle' (for league history recording)
 *  - useLocking: true for team modes (advisory lock on instance assignment)
 */
export interface StandingsAdapterOptions {
  maxPerInstance?: number;
  entityType?: 'robot' | 'tag_team' | 'team_battle';
  useLocking?: boolean;
}

/**
 * Create a standings-based league adapter for one mode. Every mode (1v1,
 * 2v2, 3v3, tag team, KotH, Grand Melee) ranks from its `standings` rows.
 */
export function createStandingsAdapter(mode: StandingsMode, opts: StandingsAdapterOptions = {}): LeagueAdapter<Standing> {
  const maxPerInstance = opts.maxPerInstance ?? MAX_ROBOTS_PER_INSTANCE;
  const entityType: 'robot' | 'tag_team' | 'team_battle' = opts.entityType ?? 'robot';
  const useLocking = opts.useLocking ?? false;
  // For standings queries, map to Prisma entity type ('robot' or 'team')
  const standingsEntityType = entityType === 'robot' ? 'robot' : 'team';

  const instanceOptions: InstanceOptions = { mode, maxPerInstance };

  return {
    entityType,
    mode,

    async getEntitiesInInstance(instanceId, excludeIds) {
      return prisma.standing.findMany({
        where: {
          mode,
          leagueInstanceId: instanceId,
          NOT: { entityId: { in: Array.from(excludeIds) } },
        },
      });
    },

    async getInstancesForTier(tier): Promise<InstanceInfo[]> {
      const standings = await prisma.standing.findMany({
        where: { mode, tier },
        distinct: ['leagueInstanceId'],
        select: { leagueInstanceId: true },
      });
      return standings.map(s => ({ leagueId: s.leagueInstanceId }));
    },

    async countEntitiesInTier(tier) {
      return prisma.standing.count({ where: { mode, tier } });
    },

    async countEntitiesInDestinationTier(tier) {
      return prisma.standing.count({ where: { mode, tier } });
    },

    async assignInstance(tier) {
      if (useLocking) {
        return assignLeagueInstanceWithLock(tier as LeagueTier, instanceOptions);
      }
      return assignLeagueInstance(tier as LeagueTier, instanceOptions);
    },

    async updateEntityLeague(entityId, newTier, newLeagueId) {
      await prisma.standing.updateMany({
        where: { entityType: standingsEntityType, entityId, mode },
        data: { tier: newTier, leagueInstanceId: newLeagueId, cyclesInTier: 0 },
      });
    },

    getEntityCurrentTier(entity) { return entity.tier; },
    getEntityLeagueId(entity) { return entity.leagueInstanceId; },
    getEntityLeaguePoints(entity) { return entity.leaguePoints; },
    getEntityCyclesInTier(entity) { return entity.cyclesInTier; },
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
      await maintainInstances(tier as LeagueTier, instanceOptions);
    },

    async countAllEntities() {
      return prisma.standing.count({ where: { mode } });
    },
  };
}

export const robotAdapter: LeagueAdapter<Standing> = createStandingsAdapter(StandingsMode.league_1v1, {
  maxPerInstance: MAX_ROBOTS_PER_INSTANCE,
  entityType: 'robot',
});

// ─── Public API ──────────────────────────────────────────────────────────────

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

/** Engine result in the robot-mode summary shape. */
function toRobotSummary(result: FullRebalancingResult): FullRebalancingSummary {
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

/** Rebalance all 1v1 league tiers. */
export async function rebalanceLeagues(): Promise<FullRebalancingSummary> {
  return toRobotSummary(await rebalanceAllTiers(ROBOT_LEAGUE_CONFIG, robotAdapter));
}

/**
 * Placement modes use the same engine with position-based ranking instead of
 * an LP threshold, and a longer minimum residency (PLACEMENT_LEAGUE_RULES),
 * since placement points accumulate faster than LP in head-to-head modes.
 */
async function rebalancePlacementLeagues(mode: StandingsMode, logPrefix: string): Promise<FullRebalancingSummary> {
  const config: LeagueEngineConfig = { ...ROBOT_LEAGUE_CONFIG, ...PLACEMENT_LEAGUE_RULES, logPrefix };
  const adapter = createStandingsAdapter(mode, { maxPerInstance: MAX_ROBOTS_PER_INSTANCE, entityType: 'robot' });
  return toRobotSummary(await rebalanceAllTiers(config, adapter));
}

/** Rebalance KotH leagues (Spec #40). */
export function rebalanceKothLeagues(): Promise<FullRebalancingSummary> {
  return rebalancePlacementLeagues(StandingsMode.koth, 'KotH Rebalancing');
}

/** Rebalance Grand Melee leagues (Spec #44). */
export function rebalanceGrandMeleeLeagues(): Promise<FullRebalancingSummary> {
  return rebalancePlacementLeagues(StandingsMode.grand_melee, 'Grand Melee Rebalancing');
}
