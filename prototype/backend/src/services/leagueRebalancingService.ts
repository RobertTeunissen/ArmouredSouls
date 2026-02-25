import { Robot } from '@prisma/client';
import prisma from '../lib/prisma';

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
  MAX_ROBOTS_PER_INSTANCE 
} from './leagueInstanceService';

// Promotion/Demotion thresholds
const MIN_LEAGUE_POINTS_FOR_PROMOTION = 25; // Must have 25+ league points for promotion
const PROMOTION_PERCENTAGE = 0.10; // Top 10%
const DEMOTION_PERCENTAGE = 0.10; // Bottom 10%
const MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING = 5; // Must be in current league for 5+ cycles
const MIN_ROBOTS_FOR_REBALANCING = 10;

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
 * Robots must have ≥25 league points AND be in top 10% AND ≥5 cycles in current league
 * @param instanceId - The specific league instance to evaluate (e.g., "bronze_1")
 * @param excludeRobotIds - Set of robot IDs to exclude (already processed in this cycle)
 */
export async function determinePromotions(instanceId: string, excludeRobotIds: Set<number> = new Set()): Promise<Robot[]> {
  const tier = instanceId.split('_')[0] as LeagueTier;
  
  // Champion tier has no promotions
  if (tier === 'champion') {
    return [];
  }

  // Get all robots in this INSTANCE with minimum cycles AND minimum league points
  const robotsWithMinPoints = await prisma.robot.findMany({
    where: {
      leagueId: instanceId, // CHANGED: Query by instance, not tier
      cyclesInCurrentLeague: {
        gte: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING,
      },
      leaguePoints: {
        gte: MIN_LEAGUE_POINTS_FOR_PROMOTION,
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
    console.log(`[Rebalancing] ${instanceId}: No robots with ≥${MIN_LEAGUE_POINTS_FOR_PROMOTION} league points, skipping promotions`);
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
    console.log(`[Rebalancing] ${instanceId}: Too few eligible robots (${totalEligibleRobots} < ${MIN_ROBOTS_FOR_REBALANCING}), skipping promotions`);
    return [];
  }

  // Calculate top 10% of eligible robots in this INSTANCE
  const promotionCount = Math.floor(totalEligibleRobots * PROMOTION_PERCENTAGE);
  
  if (promotionCount === 0) {
    console.log(`[Rebalancing] ${instanceId}: Promotion count is 0 (${totalEligibleRobots} eligible robots), skipping`);
    return [];
  }

  // Take the top 10%, but only from robots with ≥25 league points
  const toPromote = robotsWithMinPoints.slice(0, Math.min(promotionCount, robotsWithMinPoints.length));
  
  console.log(`[Rebalancing] ${instanceId}: ${toPromote.length} robots eligible for promotion (top ${PROMOTION_PERCENTAGE * 100}% of ${totalEligibleRobots} AND ≥${MIN_LEAGUE_POINTS_FOR_PROMOTION} league points, ${robotsWithMinPoints.length} met points threshold)`);
  
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
    console.log(`[Rebalancing] ${instanceId}: Too few robots (${robots.length} < ${MIN_ROBOTS_FOR_REBALANCING}), skipping demotions`);
    return [];
  }

  // Calculate bottom 10% of this INSTANCE
  const demotionCount = Math.floor(robots.length * DEMOTION_PERCENTAGE);
  
  if (demotionCount === 0) {
    console.log(`[Rebalancing] ${instanceId}: Demotion count is 0 (${robots.length} robots), skipping`);
    return [];
  }

  const toDemote = robots.slice(0, demotionCount);
  console.log(`[Rebalancing] ${instanceId}: ${toDemote.length} robots eligible for demotion (bottom ${DEMOTION_PERCENTAGE * 100}% of ${robots.length})`);
  
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
    throw new Error(`Cannot promote robot ${robot.id} from ${robot.currentLeague} - already at top tier`);
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

  console.log(`[Rebalancing] Promoted: ${robot.name} (${robot.currentLeague} → ${nextTier}, LP: ${robot.leaguePoints} retained)`);
}

/**
 * Demote a robot to the previous tier
 * CHANGED: LP retention - league points are NOT reset to 0
 */
export async function demoteRobot(robot: Robot): Promise<void> {
  const previousTier = getNextTierDown(robot.currentLeague as LeagueTier);
  
  if (!previousTier) {
    throw new Error(`Cannot demote robot ${robot.id} from ${robot.currentLeague} - already at bottom tier`);
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

  console.log(`[Rebalancing] Demoted: ${robot.name} (${robot.currentLeague} → ${previousTier}, LP: ${robot.leaguePoints} retained)`);
}

/**
 * Rebalance a single league tier - INSTANCE-BASED
 * CHANGED: Process each instance separately instead of entire tier
 * @param tier - The league tier to rebalance
 * @param excludeRobotIds - Set of robot IDs already processed in this cycle
 */
async function rebalanceTier(tier: LeagueTier, excludeRobotIds: Set<number>): Promise<RebalancingSummary> {
  console.log(`\n[Rebalancing] Processing ${tier.toUpperCase()} league...`);

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
  
  console.log(`[Rebalancing] ${tier}: ${totalInTier} total robots across ${instances.length} instances`);

  // Process each instance separately
  for (const instance of instances) {
    console.log(`[Rebalancing] Processing ${instance.leagueId}...`);
    
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
      console.log(`[Rebalancing] ${instance.leagueId}: Skipping (${eligibleInInstance} eligible, need ${MIN_ROBOTS_FOR_REBALANCING})`);
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
        console.error(`[Rebalancing] Error promoting robot ${robot.id}:`, error);
      }
    }

    // Execute demotions
    for (const robot of toDemote) {
      try {
        await demoteRobot(robot);
        excludeRobotIds.add(robot.id); // Mark as processed
        summary.demoted++;
      } catch (error) {
        console.error(`[Rebalancing] Error demoting robot ${robot.id}:`, error);
      }
    }
  }

  console.log(`[Rebalancing] ${tier}: Promoted ${summary.promoted}, Demoted ${summary.demoted} across ${instances.length} instances`);

  return summary;
}

/**
 * Rebalance all league tiers
 */
export async function rebalanceLeagues(): Promise<FullRebalancingSummary> {
  console.log('═'.repeat(60));
  console.log('[Rebalancing] Starting league rebalancing...');
  console.log('═'.repeat(60));

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

  console.log(`[Rebalancing] Total robots in system: ${fullSummary.totalRobots}`);

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
      console.error(`[Rebalancing] Error in tier ${tier}:`, error);
    }
  }

  // Rebalance instances for each tier after all moves (ONLY if instance exceeds 100 robots)
  console.log('\n[Rebalancing] Checking instances for rebalancing...');
  for (const tier of LEAGUE_TIERS) {
    try {
      const instances = await getInstancesForTier(tier);
      const needsRebalancing = instances.some(inst => inst.currentRobots > MAX_ROBOTS_PER_INSTANCE);
      
      if (needsRebalancing) {
        console.log(`[Rebalancing] ${tier}: Instance exceeds ${MAX_ROBOTS_PER_INSTANCE} robots, rebalancing...`);
        await rebalanceInstances(tier);
      } else {
        console.log(`[Rebalancing] ${tier}: All instances at or under ${MAX_ROBOTS_PER_INSTANCE} robots, skipping rebalancing`);
      }
    } catch (error) {
      console.error(`[Rebalancing] Error checking ${tier} instances:`, error);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('[Rebalancing] League rebalancing complete!');
  console.log(`  Total promoted: ${fullSummary.totalPromoted}`);
  console.log(`  Total demoted: ${fullSummary.totalDemoted}`);
  console.log(`  Errors: ${fullSummary.errors.length}`);
  console.log('═'.repeat(60) + '\n');

  return fullSummary;
}
