import prisma from '../../lib/prisma';
import { Prisma, StandingsMode } from '../../../generated/prisma';
import logger from '../../config/logger';

// League tiers in order
export const LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;
export type LeagueTier = typeof LEAGUE_TIERS[number];

// Maximum entities per league instance (unified across all modes)
export const MAX_ROBOTS_PER_INSTANCE = 100;
export const MAX_TEAMS_PER_INSTANCE = 100;

// Threshold for triggering instance rebalancing
export const REBALANCE_THRESHOLD = 20;

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
 */
export async function assignLeagueInstanceWithLock(tier: LeagueTier, options: InstanceOptions): Promise<string> {
  return await prisma.$transaction(async (tx) => {
    // Acquire advisory lock scoped to mode + tier to avoid collision
    const lockId = hashTierName(`${options.mode}_${tier}`);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

    // Group standings by leagueInstanceId
    const instances = await tx.standing.groupBy({
      by: ['leagueInstanceId'],
      where: {
        mode: options.mode as StandingsMode,
        tier,
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
        const instanceNumber = parseInt(instance.leagueInstanceId.split('_')[1] || '1');
        return {
          leagueId: instance.leagueInstanceId,
          instanceNumber,
          currentEntities: instance._count.id,
        };
      })
      .sort((a, b) => a.currentEntities - b.currentEntities);

    const leastFull = leagueInstances[0];

    if (leastFull.currentEntities >= options.maxPerInstance) {
      const nextInstanceNumber = Math.max(...leagueInstances.map((i) => i.instanceNumber)) + 1;
      return `${tier}_${nextInstanceNumber}`;
    }

    return leastFull.leagueId;
  });
}

/**
 * Hash a tier/mode string to a consistent integer for advisory locking.
 */
function hashTierName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 2147483647;
}

/**
 * Rebalance entities across instances in a tier.
 * Always redistributes entities evenly using round-robin (sorted by LP desc for competitive balance).
 * Called after promotions/demotions during league rebalancing.
 * Mode-aware: defaults to league_1v1 for backward compatibility.
 */
export async function rebalanceInstances(tier: LeagueTier, options: InstanceOptions = DEFAULT_OPTIONS): Promise<void> {
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
    ],
  });

  if (allStandings.length === 0) {
    logger.info(`[${logLabel}] ${tier}: No entities, skipping`);
    return;
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
}

type RobotWithUser = Prisma.RobotGetPayload<{
  include: { user: { select: { id: true; username: true } } };
}>;

/**
 * Get all robots in a specific instance (via standings table)
 */
export async function getRobotsInInstance(leagueId: string): Promise<RobotWithUser[]> {
  // Look up robot IDs from the standings table
  const standings = await prisma.standing.findMany({
    where: {
      mode: 'league_1v1',
      entityType: 'robot',
      leagueInstanceId: leagueId,
    },
    orderBy: [
      { leaguePoints: 'desc' },
    ],
    select: { entityId: true },
  });

  if (standings.length === 0) return [];

  const robotIds = standings.map(s => s.entityId);

  return prisma.robot.findMany({
    where: { id: { in: robotIds } },
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
    orderBy: [
      { elo: 'desc' },
    ],
  });
}

/**
 * Move robot to a different instance (used during promotion/demotion).
 * Updates the standing record for this robot.
 */
export async function moveRobotToInstance(robotId: number, newTier: LeagueTier): Promise<void> {
  const targetLeagueId = await assignLeagueInstance(newTier);
  
  await prisma.standing.updateMany({
    where: {
      entityType: 'robot',
      entityId: robotId,
      mode: 'league_1v1',
    },
    data: {
      tier: newTier,
      leagueInstanceId: targetLeagueId,
    },
  });
}
