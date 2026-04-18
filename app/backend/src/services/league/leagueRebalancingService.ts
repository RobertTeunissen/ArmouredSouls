import { Robot } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { LeagueError, LeagueErrorCode } from '../../errors/leagueErrors';

// NOTE: This service mirrors tagTeamLeagueRebalancingService.ts for tag team leagues.
// Both share identical promotion/demotion logic but operate on different Prisma models
// (Robot vs TagTeam) with different field names. If you change thresholds or logic here,
// apply the same change to the tag team version.
import { 
  assignLeagueInstance, 
  rebalanceInstances, 
  LEAGUE_TIERS,
  LeagueTier,
  getInstancesForTier,
} from './leagueInstanceService';

// Promotion/Demotion thresholds
// Per-tier LP thresholds: higher tiers require more LP to promote
const PROMOTION_LP_THRESHOLDS: Record<string, number> = {
  bronze: 25,   // Bronze → Silver
  silver: 50,   // Silver → Gold
  gold: 75,     // Gold → Platinum
  platinum: 100, // Platinum → Diamond
  diamond: 125,  // Diamond → Champion
  champion: Infinity, // Cannot promote from Champion
};
const PROMOTION_PERCENTAGE = 0.10; // Top 10%
const DEMOTION_PERCENTAGE = 0.10; // Bottom 10%
const MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING = 5; // Must be in current league for 5+ cycles
const MIN_ROBOTS_FOR_REBALANCING = 10;

/**
 * Get the minimum LP required for promotion from a given tier
 */
export function getMinLPForPromotion(tier: string): number {
  return PROMOTION_LP_THRESHOLDS[tier] ?? 25;
}

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
 * LP thresholds: Bronze→Silver 25, Silver→Gold 50, Gold→Platinum 75, Platinum→Diamond 100, Diamond→Champion 125
 * @param instanceId - The specific league instance to evaluate (e.g., "bronze_1")
 * @param excludeRobotIds - Set of robot IDs to exclude (already processed in this cycle)
 */
export async function determinePromotions(instanceId: string, excludeRobotIds: Set<number> = new Set()): Promise<Robot[]> {
  const tier = instanceId.split('_')[0] as LeagueTier;
  
  // Champion tier has no promotions
  if (tier === 'champion') {
    return [];
  }

  // Get the per-tier LP threshold for promotion
  const minLP = getMinLPForPromotion(tier);

  // Get all robots in this INSTANCE with minimum cycles AND minimum league points
  const robotsWithMinPoints = await prisma.robot.findMany({
    where: {
      leagueId: instanceId, // CHANGED: Query by instance, not tier
      cyclesInCurrentLeague: {
        gte: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING,
      },
      leaguePoints: {
        gte: minLP,
      },
      NOT: [
        { name: 'Bye Robot' },
        { id: { in: Array.from(excludeRobotIds) } },
      ],
    },
    orderBy: [
      { leaguePoints: 'desc' },
      { elo: 'desc' }, // Tiebreaker
    ],
  });

  // If no robots meet the minimum points threshold, skip
  if (robotsWithMinPoints.length === 0) {
    logger.info(`[Rebalancing] ${instanceId}: No robots with ≥${minLP} league points (${tier} tier threshold), skipping promotions`);
    return [];
  }

  // Get total eligible robots in this INSTANCE (for calculating top 10%)
  const totalEligibleRobots = await prisma.robot.count({
    where: {
      leagueId: instanceId, // CHANGED: Query by instance, not tier
      cyclesInCurrentLeague: {
        gte: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING,
      },
      NOT: [
        { name: 'Bye Robot' },
        { id: { in: Array.from(excludeRobotIds) } },
      ],
    },
  });

  // Skip if too few robots
  if (totalEligibleRobots < MIN_ROBOTS_FOR_REBALANCING) {
    logger.info(`[Rebalancing] ${instanceId}: Too few eligible robots (${totalEligibleRobots} < ${MIN_ROBOTS_FOR_REBALANCING}), skipping promotions`);
    return [];
  }

  // Calculate top 10% of eligible robots in this INSTANCE
  const promotionCount = Math.floor(totalEligibleRobots * PROMOTION_PERCENTAGE);
  
  if (promotionCount === 0) {
    logger.info(`[Rebalancing] ${instanceId}: Promotion count is 0 (${totalEligibleRobots} eligible robots), skipping`);
    return [];
  }

  // Take the top 10%, but only from robots meeting the per-tier LP threshold
  const toPromote = robotsWithMinPoints.slice(0, Math.min(promotionCount, robotsWithMinPoints.length));
  
  logger.info(`[Rebalancing] ${instanceId}: ${toPromote.length} robots eligible for promotion (top ${PROMOTION_PERCENTAGE * 100}% of ${totalEligibleRobots} AND ≥${minLP} league points [${tier} tier], ${robotsWithMinPoints.length} met points threshold)`);
  
  return toPromote;
}

/**
 * Determine which robots should be demoted from a SPECIFIC INSTANCE
 * @param instanceId - The specific league instance to evaluate (e.g., "silver_1")
 * @param excludeRobotIds - Set of robot IDs to exclude (already processed in this cycle)
 */
export async function determineDemotions(instanceId: string, excludeRobotIds: Set<number> = new Set()): Promise<Robot[]> {
  const tier = instanceId.split('_')[0] as LeagueTier;
  
  // Bronze tier has no demotions
  if (tier === 'bronze') {
    return [];
  }

  // Get all robots in this INSTANCE with minimum cycles in current league
  const robots = await prisma.robot.findMany({
    where: {
      leagueId: instanceId, // CHANGED: Query by instance, not tier
      cyclesInCurrentLeague: {
        gte: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING,
      },
      NOT: [
        { name: 'Bye Robot' },
        { id: { in: Array.from(excludeRobotIds) } },
      ],
    },
    orderBy: [
      { leaguePoints: 'asc' },
      { elo: 'asc' }, // Tiebreaker
    ],
  });

  // Skip if too few robots
  if (robots.length < MIN_ROBOTS_FOR_REBALANCING) {
    logger.info(`[Rebalancing] ${instanceId}: Too few robots (${robots.length} < ${MIN_ROBOTS_FOR_REBALANCING}), skipping demotions`);
    return [];
  }

  // Calculate bottom 10% of this INSTANCE
  const demotionCount = Math.floor(robots.length * DEMOTION_PERCENTAGE);
  
  if (demotionCount === 0) {
    logger.info(`[Rebalancing] ${instanceId}: Demotion count is 0 (${robots.length} robots), skipping`);
    return [];
  }

  const toDemote = robots.slice(0, demotionCount);
  logger.info(`[Rebalancing] ${instanceId}: ${toDemote.length} robots eligible for demotion (bottom ${DEMOTION_PERCENTAGE * 100}% of ${robots.length})`);
  
  return toDemote;
}

/**
 * Get the next tier up
 */
function getNextTierUp(currentTier: LeagueTier): LeagueTier | null {
  const currentIndex = LEAGUE_TIERS.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === LEAGUE_TIERS.length - 1) {
    return null; // Already at top
  }
  return LEAGUE_TIERS[currentIndex + 1];
}

/**
 * Get the next tier down
 */
function getNextTierDown(currentTier: LeagueTier): LeagueTier | null {
  const currentIndex = LEAGUE_TIERS.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === 0) {
    return null; // Already at bottom
  }
  return LEAGUE_TIERS[currentIndex - 1];
}

/**
 * Promote a robot to the next tier
 * CHANGED: LP retention - league points are NOT reset to 0
 */
export async function promoteRobot(robot: Robot): Promise<void> {
  const nextTier = getNextTierUp(robot.currentLeague as LeagueTier);
  
  if (!nextTier) {
    throw new LeagueError(
      LeagueErrorCode.PROMOTION_BLOCKED,
      `Cannot promote robot ${robot.id} from ${robot.currentLeague} - already at top tier`,
      400,
      { robotId: robot.id, currentLeague: robot.currentLeague }
    );
  }

  // Assign to new instance
  const newLeagueId = await assignLeagueInstance(nextTier);

  // Update robot - RETAIN league points
  await prisma.robot.update({
    where: { id: robot.id },
    data: {
      currentLeague: nextTier,
      leagueId: newLeagueId,
      // leaguePoints: REMOVED - LP retained across promotions
      cyclesInCurrentLeague: 0, // Reset cycles counter for new league
    },
  });

  logger.info(`[Rebalancing] Promoted: ${robot.name} (${robot.currentLeague} → ${nextTier}, LP: ${robot.leaguePoints} retained)`);
}

/**
 * Demote a robot to the previous tier
 * CHANGED: LP retention - league points are NOT reset to 0
 */
export async function demoteRobot(robot: Robot): Promise<void> {
  const previousTier = getNextTierDown(robot.currentLeague as LeagueTier);
  
  if (!previousTier) {
    throw new LeagueError(
      LeagueErrorCode.RELEGATION_BLOCKED,
      `Cannot demote robot ${robot.id} from ${robot.currentLeague} - already at bottom tier`,
      400,
      { robotId: robot.id, currentLeague: robot.currentLeague }
    );
  }

  // Assign to new instance
  const newLeagueId = await assignLeagueInstance(previousTier);

  // Update robot - RETAIN league points
  await prisma.robot.update({
    where: { id: robot.id },
    data: {
      currentLeague: previousTier,
      leagueId: newLeagueId,
      // leaguePoints: REMOVED - LP retained across demotions
      cyclesInCurrentLeague: 0, // Reset cycles counter for new league
    },
  });

  logger.info(`[Rebalancing] Demoted: ${robot.name} (${robot.currentLeague} → ${previousTier}, LP: ${robot.leaguePoints} retained)`);
}

/**
 * Rebalance a single league tier - INSTANCE-BASED
 * CHANGED: Process each instance separately instead of entire tier
 * @param tier - The league tier to rebalance
 * @param excludeRobotIds - Set of robot IDs already processed in this cycle
 */
async function rebalanceTier(tier: LeagueTier, excludeRobotIds: Set<number>): Promise<RebalancingSummary> {
  logger.info(`\n[Rebalancing] Processing ${tier.toUpperCase()} league...`);

  // Count total robots in tier
  const totalInTier = await prisma.robot.count({
    where: {
      currentLeague: tier,
      NOT: { name: 'Bye Robot' },
    },
  });

  const summary: RebalancingSummary = {
    tier,
    robotsInTier: totalInTier,
    promoted: 0,
    demoted: 0,
    eligibleRobots: 0,
  };

  // Get all instances for this tier
  const instances = await getInstancesForTier(tier);
  
  logger.info(`[Rebalancing] ${tier}: ${totalInTier} total robots across ${instances.length} instances`);

  // Process each instance separately
  for (const instance of instances) {
    logger.info(`[Rebalancing] Processing ${instance.leagueId}...`);
    
    // Count eligible robots in this instance
    const eligibleInInstance = await prisma.robot.count({
      where: {
        leagueId: instance.leagueId,
        cyclesInCurrentLeague: { gte: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING },
        NOT: [
          { name: 'Bye Robot' },
          { id: { in: Array.from(excludeRobotIds) } },
        ],
      },
    });
    
    summary.eligibleRobots += eligibleInInstance;

    // Skip if too few robots in this instance
    if (eligibleInInstance < MIN_ROBOTS_FOR_REBALANCING) {
      logger.info(`[Rebalancing] ${instance.leagueId}: Skipping (${eligibleInInstance} eligible, need ${MIN_ROBOTS_FOR_REBALANCING})`);
      continue;
    }

    // Determine promotions for this instance
    const toPromote = await determinePromotions(instance.leagueId, excludeRobotIds);
    
    // Determine demotions for this instance
    const toDemote = await determineDemotions(instance.leagueId, excludeRobotIds);

    // Execute promotions
    for (const robot of toPromote) {
      try {
        await promoteRobot(robot);
        excludeRobotIds.add(robot.id); // Mark as processed
        summary.promoted++;
      } catch (error) {
        logger.error(`[Rebalancing] Error promoting robot ${robot.id}:`, error);
      }
    }

    // Execute demotions
    for (const robot of toDemote) {
      try {
        await demoteRobot(robot);
        excludeRobotIds.add(robot.id); // Mark as processed
        summary.demoted++;
      } catch (error) {
        logger.error(`[Rebalancing] Error demoting robot ${robot.id}:`, error);
      }
    }
  }

  logger.info(`[Rebalancing] ${tier}: Promoted ${summary.promoted}, Demoted ${summary.demoted} across ${instances.length} instances`);

  return summary;
}

/**
 * Rebalance all league tiers
 */
export async function rebalanceLeagues(): Promise<FullRebalancingSummary> {
  logger.info('═'.repeat(60));
  logger.info('[Rebalancing] Starting league rebalancing...');
  logger.info('═'.repeat(60));

  const fullSummary: FullRebalancingSummary = {
    totalRobots: 0,
    totalPromoted: 0,
    totalDemoted: 0,
    tierSummaries: [],
    errors: [],
  };

  // Get total robot count
  fullSummary.totalRobots = await prisma.robot.count({
    where: { NOT: { name: 'Bye Robot' } },
  });

  logger.info(`[Rebalancing] Total robots in system: ${fullSummary.totalRobots}`);

  // Track which robots have already been processed in this cycle
  const processedRobotIds = new Set<number>();

  // Process each tier (bottom to top to avoid conflicts)
  for (const tier of LEAGUE_TIERS) {
    try {
      const summary = await rebalanceTier(tier, processedRobotIds);
      fullSummary.tierSummaries.push(summary);
      fullSummary.totalPromoted += summary.promoted;
      fullSummary.totalDemoted += summary.demoted;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      fullSummary.errors.push(`${tier}: ${errorMsg}`);
      logger.error(`[Rebalancing] Error in tier ${tier}:`, error);
    }
  }

  // Rebalance instances for each tier after all moves
  logger.info('\n[Rebalancing] Checking instances for rebalancing...');
  for (const tier of LEAGUE_TIERS) {
    try {
      await rebalanceInstances(tier);
    } catch (error) {
      logger.error(`[Rebalancing] Error checking ${tier} instances:`, error);
    }
  }

  logger.info('\n' + '═'.repeat(60));
  logger.info('[Rebalancing] League rebalancing complete!');
  logger.info(`  Total promoted: ${fullSummary.totalPromoted}`);
  logger.info(`  Total demoted: ${fullSummary.totalDemoted}`);
  logger.info(`  Errors: ${fullSummary.errors.length}`);
  logger.info('═'.repeat(60) + '\n');

  return fullSummary;
}
