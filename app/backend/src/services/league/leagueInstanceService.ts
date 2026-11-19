import prisma from '../../lib/prisma';
import { StandingsMode } from '../../../generated/prisma';
import logger from '../../config/logger';
import { MAX_ENTITIES_PER_INSTANCE, pickLeagueInstanceInTransaction } from './leagueInstancePlacement';
import {
  InstanceMaintenancePlan,
  planInstanceMaintenance,
  targetInstanceCount,
} from './league-instance-planner';

// League tiers in order
export const LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;
export type LeagueTier = typeof LEAGUE_TIERS[number];

// Maximum entities per league instance (unified across all modes)
export const MAX_ROBOTS_PER_INSTANCE = MAX_ENTITIES_PER_INSTANCE;
export const MAX_TEAMS_PER_INSTANCE = MAX_ENTITIES_PER_INSTANCE;

export interface LeagueInstance {
  leagueId: string;
  tier: LeagueTier;
  instanceNumber: number;
  currentRobots: number;
  maxRobots: number;
  isFull: boolean;
}

export interface LeagueInstanceStats {
  tier: LeagueTier;
  instances: LeagueInstance[];
  totalRobots: number;
  averagePerInstance: number;
  /** True when the nightly maintenance would re-deal or merge this tier. */
  needsRebalancing: boolean;
  /** What the nightly maintenance would do with this tier (issue #603). */
  plan: InstanceMaintenancePlan;
}

/** Options for mode-aware instance management */
export interface InstanceOptions {
  mode: string;
  maxPerInstance: number;
}

/** Default options for 1v1 league (backward compatible) */
const DEFAULT_OPTIONS: InstanceOptions = { mode: 'league_1v1', maxPerInstance: MAX_ROBOTS_PER_INSTANCE };

/**
 * Get all instances for a specific league tier.
 * Mode-aware: defaults to league_1v1 for backward compatibility.
 */
export async function getInstancesForTier(tier: LeagueTier, options: InstanceOptions = DEFAULT_OPTIONS): Promise<LeagueInstance[]> {
  const { mode, maxPerInstance } = options;

  // Query from unified standings table (Spec #40)
  const instances = await prisma.standing.groupBy({
    by: ['leagueInstanceId'],
    where: {
      mode: mode as StandingsMode,
      tier,
    },
    _count: {
      id: true,
    },
  });

  // Parse instance data
  const leagueInstances: LeagueInstance[] = instances.map((instance) => {
    const instanceNumber = parseInt(instance.leagueInstanceId.split('_')[1] || '1');
    const currentRobots = instance._count.id;

    return {
      leagueId: instance.leagueInstanceId,
      tier,
      instanceNumber,
      currentRobots,
      maxRobots: maxPerInstance,
      isFull: currentRobots >= maxPerInstance,
    };
  });

  // Sort by instance number
  return leagueInstances.sort((a, b) => a.instanceNumber - b.instanceNumber);
}

/**
 * Get statistics for a league tier
 */
export async function getLeagueInstanceStats(tier: LeagueTier, options: InstanceOptions = DEFAULT_OPTIONS): Promise<LeagueInstanceStats> {
  const instances = await getInstancesForTier(tier, options);
  const totalRobots = instances.reduce((sum, inst) => sum + inst.currentRobots, 0);
  const averagePerInstance = instances.length > 0 ? totalRobots / instances.length : 0;
  const plan = planInstanceMaintenance(
    instances.map((inst) => ({
      leagueId: inst.leagueId,
      instanceNumber: inst.instanceNumber,
      count: inst.currentRobots,
    })),
    options.maxPerInstance,
  );

  return {
    tier,
    instances,
    totalRobots,
    averagePerInstance,
    needsRebalancing: plan.action !== 'none',
    plan,
  };
}

/**
 * Assign an entity to an appropriate league instance.
 * Places entity in instance with most free spots.
 * Mode-aware: defaults to league_1v1 for backward compatibility.
 */
export async function assignLeagueInstance(tier: LeagueTier, options: InstanceOptions = DEFAULT_OPTIONS): Promise<string> {
  const instances = await getInstancesForTier(tier, options);

  if (instances.length === 0) {
    // No instances exist yet, create first one
    return `${tier}_1`;
  }

  // Find instance with most free spots
  const leastFull = instances.sort((a, b) => a.currentRobots - b.currentRobots)[0];

  // Always assign to the least-full instance.
  // New instances are only created through rebalancing, not here.
  return leastFull.leagueId;
}

/**
 * Assign an entity to a league instance with advisory locking (for concurrent writes).
 * Used by team creation where multiple teams may be assigned simultaneously.
 * Delegates to the shared tx-scoped picker in `leagueInstancePlacement`.
 */
export async function assignLeagueInstanceWithLock(tier: LeagueTier, options: InstanceOptions): Promise<string> {
  return await prisma.$transaction((tx) =>
    pickLeagueInstanceInTransaction(tx, options.mode as StandingsMode, tier, options.maxPerInstance),
  );
}

/**
 * Re-deal every entity of a tier over its instances: round-robin, sorted by LP
 * desc for competitive balance. Unconditional; the nightly rebalance goes
 * through {@link maintainInstances}, which only re-deals when a tier needs it
 * (issue #603). Called directly by `redealLeagueInstances` at season start.
 * Mode-aware: defaults to league_1v1 for backward compatibility.
 *
 * The tier is spread over `targetInstanceCount` instances, which leaves room
 * in each for later entrants (see `league-instance-planner`).
 *
 * Equal LP is broken by standings id (oldest row first). At season start every
 * row has 0 LP, and the rows created after the bulk Automaton placement (the
 * human players, issue #599) are the newest: dealing them consecutively puts each
 * one in a different instance instead of leaving the order to Postgres.
 */
export async function rebalanceInstances(tier: LeagueTier, options: InstanceOptions = DEFAULT_OPTIONS): Promise<number> {
  const { mode, maxPerInstance } = options;
  const logLabel = mode === 'league_1v1' ? 'LeagueInstance' : `LeagueInstance:${mode}`;

  // Get all standings in this tier from unified table (Spec #40)
  const allStandings = await prisma.standing.findMany({
    where: {
      mode: mode as StandingsMode,
      tier,
    },
    orderBy: [
      { leaguePoints: 'desc' },
      { id: 'asc' },
    ],
  });

  if (allStandings.length === 0) {
    logger.info(`[${logLabel}] ${tier}: No entities, skipping`);
    return 0;
  }

  const instanceCount = targetInstanceCount(allStandings.length, maxPerInstance);

  logger.info(`[${logLabel}] Rebalancing ${tier}: ${allStandings.length} entities across ${instanceCount} instances`);

  // Redistribute standings ROUND-ROBIN to maintain competitive balance
  const updates: Promise<unknown>[] = [];
  
  for (let i = 0; i < allStandings.length; i++) {
    const standing = allStandings[i];
    const targetInstanceNumber = (i % instanceCount) + 1;
    const targetLeagueId = `${tier}_${targetInstanceNumber}`;

    if (standing.leagueInstanceId !== targetLeagueId) {
      updates.push(
        prisma.standing.update({
          where: { id: standing.id },
          data: { leagueInstanceId: targetLeagueId },
        })
      );
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
    logger.info(`[${logLabel}] ${tier}: Moved ${updates.length} entities`);
  } else {
    logger.info(`[${logLabel}] ${tier}: Already balanced`);
  }
  return updates.length;
}


/**
 * Dissolve the `dissolve` instances of a tier into the `keep` instances.
 *
 * Members of the dissolved instances are taken by LP desc (oldest row first on
 * a tie) and each joins the kept instance with the fewest entities at that
 * moment (ties to the lowest instance number). Entities in kept instances do
 * not move. Returns the number of standings moved.
 */
async function mergeInstances(
  tier: LeagueTier,
  mode: string,
  keep: readonly string[],
  dissolve: readonly string[],
): Promise<number> {
  if (keep.length === 0 || dissolve.length === 0) return 0;

  const [keptCounts, movers] = await Promise.all([
    prisma.standing.groupBy({
      by: ['leagueInstanceId'],
      where: { mode: mode as StandingsMode, tier, leagueInstanceId: { in: [...keep] } },
      _count: { id: true },
    }),
    prisma.standing.findMany({
      where: { mode: mode as StandingsMode, tier, leagueInstanceId: { in: [...dissolve] } },
      orderBy: [{ leaguePoints: 'desc' }, { id: 'asc' }],
      select: { id: true },
    }),
  ]);

  const sizes = keep.map((leagueId) => ({
    leagueId,
    instanceNumber: parseInt(leagueId.split('_')[1] || '1'),
    count: keptCounts.find((group) => group.leagueInstanceId === leagueId)?._count.id ?? 0,
  }));

  const updates = movers.map((standing) => {
    const destination = sizes.reduce((best, candidate) =>
      candidate.count < best.count
      || (candidate.count === best.count && candidate.instanceNumber < best.instanceNumber)
        ? candidate
        : best,
    );
    destination.count += 1;
    return prisma.standing.update({
      where: { id: standing.id },
      data: { leagueInstanceId: destination.leagueId },
    });
  });

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
  return updates.length;
}

/**
 * Nightly instance maintenance for one tier, after promotions and demotions
 * (issue #603). Instances stay fixed unless the tier needs fixing:
 *
 * - an instance above the maximum, or one far off the tier average → full
 *   round-robin re-deal ({@link rebalanceInstances});
 * - the tier shrank enough to drop instances → the highest-numbered instances
 *   are dissolved into the others; nobody else moves;
 * - otherwise nothing moves.
 *
 * Returns the number of standings moved.
 */
export async function maintainInstances(tier: LeagueTier, options: InstanceOptions = DEFAULT_OPTIONS): Promise<number> {
  const logLabel = options.mode === 'league_1v1' ? 'LeagueInstance' : `LeagueInstance:${options.mode}`;
  const { plan, totalRobots, instances } = await getLeagueInstanceStats(tier, options);

  switch (plan.action) {
    case 'redeal':
      logger.info(`[${logLabel}] ${tier}: re-dealing (${plan.reason}) — ${totalRobots} entities in ${instances.length} instances`);
      return rebalanceInstances(tier, options);
    case 'merge': {
      const moved = await mergeInstances(tier, options.mode, plan.keep, plan.dissolve);
      logger.info(
        `[${logLabel}] ${tier}: merged ${plan.dissolve.join(', ')} into ${plan.keep.length} instances — moved ${moved} entities`,
      );
      return moved;
    }
    case 'none':
      if (totalRobots > 0) {
        logger.info(`[${logLabel}] ${tier}: instances unchanged (${totalRobots} entities in ${instances.length})`);
      }
      return 0;
  }
}
