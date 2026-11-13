import prisma from '../../lib/prisma';
import { StandingsMode } from '../../../generated/prisma';
import logger from '../../config/logger';
import { MAX_ENTITIES_PER_INSTANCE, pickLeagueInstanceInTransaction } from './leagueInstancePlacement';

// League tiers in order
export const LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;
export type LeagueTier = typeof LEAGUE_TIERS[number];

// Maximum entities per league instance (unified across all modes)
export const MAX_ROBOTS_PER_INSTANCE = MAX_ENTITIES_PER_INSTANCE;
export const MAX_TEAMS_PER_INSTANCE = MAX_ENTITIES_PER_INSTANCE;

// Threshold for triggering instance rebalancing
const REBALANCE_THRESHOLD = 20;

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
  needsRebalancing: boolean;
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

  // Check if rebalancing is needed:
  // 1. Any instance exceeds the maximum limit
  // 2. Significant imbalance between instances (deviation > threshold from target)
  const hasOverflow = instances.some((inst) => 
    inst.currentRobots > options.maxPerInstance
  );
  const targetPerInstance = instances.length > 0 ? Math.ceil(totalRobots / instances.length) : 0;
  const hasImbalance = instances.length >= 2 && instances.some((inst) =>
    Math.abs(inst.currentRobots - targetPerInstance) > REBALANCE_THRESHOLD
  );
  const needsRebalancing = hasOverflow || hasImbalance;

  return {
    tier,
    instances,
    totalRobots,
    averagePerInstance,
    needsRebalancing,
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
 * Rebalance entities across instances in a tier.
 * Always redistributes entities evenly using round-robin (sorted by LP desc for competitive balance).
 * Called after promotions/demotions during league rebalancing, and by
 * `redealLeagueInstances` after bulk placements (season start).
 * Mode-aware: defaults to league_1v1 for backward compatibility.
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

  // Calculate how many instances we need
  const targetInstanceCount = Math.ceil(allStandings.length / maxPerInstance);

  logger.info(`[${logLabel}] Rebalancing ${tier}: ${allStandings.length} entities across ${targetInstanceCount} instances`);

  // Redistribute standings ROUND-ROBIN to maintain competitive balance
  const updates: Promise<unknown>[] = [];
  
  for (let i = 0; i < allStandings.length; i++) {
    const standing = allStandings[i];
    const targetInstanceNumber = (i % targetInstanceCount) + 1;
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

