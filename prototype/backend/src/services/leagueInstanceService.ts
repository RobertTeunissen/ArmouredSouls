import prisma from '../lib/prisma';
import logger from '../config/logger';

// NOTE: This service mirrors tagTeamLeagueInstanceService.ts for tag team leagues.
// Both share similar instance management logic but operate on different Prisma models
// (Robot vs TagTeam). If you change instance sizing or rebalancing logic here,
// apply the same change to the tag team version.

// League tiers in order
export const LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;
export type LeagueTier = typeof LEAGUE_TIERS[number];

// Maximum robots per league instance
export const MAX_ROBOTS_PER_INSTANCE = 100;

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

/**
 * Get all instances for a specific league tier
 */
export async function getInstancesForTier(tier: LeagueTier): Promise<LeagueInstance[]> {
  // Query robots grouped by leagueId for this tier
  const instances = await prisma.robot.groupBy({
    by: ['leagueId'],
    where: {
      currentLeague: tier,
      NOT: {
        leagueId: `${tier}_bye`, // Exclude bye-robot
      },
    },
    _count: {
      id: true,
    },
  });

  // Parse instance data
  const leagueInstances: LeagueInstance[] = instances.map((instance) => {
    const instanceNumber = parseInt(instance.leagueId.split('_')[1] || '1');
    const currentRobots = instance._count.id;

    return {
      leagueId: instance.leagueId,
      tier,
      instanceNumber,
      currentRobots,
      maxRobots: MAX_ROBOTS_PER_INSTANCE,
      isFull: currentRobots >= MAX_ROBOTS_PER_INSTANCE,
    };
  });

  // Sort by instance number
  return leagueInstances.sort((a, b) => a.instanceNumber - b.instanceNumber);
}

/**
 * Get statistics for a league tier
 */
export async function getLeagueInstanceStats(tier: LeagueTier): Promise<LeagueInstanceStats> {
  const instances = await getInstancesForTier(tier);
  const totalRobots = instances.reduce((sum, inst) => sum + inst.currentRobots, 0);
  const averagePerInstance = instances.length > 0 ? totalRobots / instances.length : 0;

  // Check if rebalancing is needed:
  // 1. Any instance significantly exceeds the maximum robot limit (overflow with buffer)
  // 2. Significant imbalance between instances (deviation > threshold from target)
  // A small overflow (up to 10% over cap) is tolerated to avoid unnecessary instance splits
  const OVERFLOW_BUFFER = Math.ceil(MAX_ROBOTS_PER_INSTANCE * 0.1); // 10% buffer = 10 robots
  const hasOverflow = instances.some((inst) => 
    inst.currentRobots > MAX_ROBOTS_PER_INSTANCE + OVERFLOW_BUFFER
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
 * Assign a robot to an appropriate league instance
 * Places robot in instance with most free spots
 */
export async function assignLeagueInstance(tier: LeagueTier): Promise<string> {
  const instances = await getInstancesForTier(tier);

  if (instances.length === 0) {
    // No instances exist yet, create first one
    return `${tier}_1`;
  }

  // Find instance with most free spots
  const leastFull = instances.sort((a, b) => a.currentRobots - b.currentRobots)[0];

  if (leastFull.currentRobots >= MAX_ROBOTS_PER_INSTANCE + Math.ceil(MAX_ROBOTS_PER_INSTANCE * 0.1)) {
    // All instances are significantly over capacity, create new one as fallback
    // (This should rarely happen - rebalancing should handle splits)
    const nextInstanceNumber = Math.max(...instances.map((i) => i.instanceNumber)) + 1;
    return `${tier}_${nextInstanceNumber}`;
  }

  return leastFull.leagueId;
}

/**
 * Rebalance robots across instances in a tier
 * Redistributes robots when deviation exceeds threshold
 */
export async function rebalanceInstances(tier: LeagueTier): Promise<void> {
  const stats = await getLeagueInstanceStats(tier);

  if (!stats.needsRebalancing) {
    logger.info(`[LeagueInstance] ${tier} instances balanced, no action needed`);
    return;
  }

  logger.info(`[LeagueInstance] Rebalancing ${tier} instances...`);
  logger.info(`  Total robots: ${stats.totalRobots}`);
  logger.info(`  Instances: ${stats.instances.length}`);
  logger.info(`  Average per instance: ${stats.averagePerInstance.toFixed(1)}`);

  // Get all robots in this tier (excluding bye-robot)
  const allRobots = await prisma.robot.findMany({
    where: {
      currentLeague: tier,
      NOT: {
        leagueId: `${tier}_bye`,
      },
    },
    orderBy: [
      { leaguePoints: 'desc' },
      { elo: 'desc' },
    ],
  });

  // Calculate how many instances we need
  const targetInstanceCount = Math.ceil(stats.totalRobots / MAX_ROBOTS_PER_INSTANCE);

  logger.info(`  Target instances: ${targetInstanceCount}`);

  // Redistribute robots ROUND-ROBIN to maintain competitive balance
  // This ensures each instance has a mix of high, medium, and low LP robots
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Promise<any>[] = [];
  
  for (let i = 0; i < allRobots.length; i++) {
    const robot = allRobots[i];
    // Round-robin: robot 0→instance 1, robot 1→instance 2, ..., robot N→instance 1, ...
    const targetInstanceNumber = (i % targetInstanceCount) + 1;
    const targetLeagueId = `${tier}_${targetInstanceNumber}`;

    if (robot.leagueId !== targetLeagueId) {
      updates.push(
        prisma.robot.update({
          where: { id: robot.id },
          data: { leagueId: targetLeagueId },
        })
      );
    }
  }

  await Promise.all(updates);
  logger.info(`[LeagueInstance] Rebalanced ${updates.length} robots across ${targetInstanceCount} instances`);
}

/**
 * Get all robots in a specific instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getRobotsInInstance(leagueId: string): Promise<any[]> {
  return prisma.robot.findMany({
    where: { leagueId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
    orderBy: [
      { leaguePoints: 'desc' },
      { elo: 'desc' },
    ],
  });
}

/**
 * Move robot to a different instance (used during promotion/demotion)
 */
export async function moveRobotToInstance(robotId: number, newTier: LeagueTier): Promise<void> {
  const targetLeagueId = await assignLeagueInstance(newTier);
  
  await prisma.robot.update({
    where: { id: robotId },
    data: {
      currentLeague: newTier,
      leagueId: targetLeagueId,
    },
  });
}
