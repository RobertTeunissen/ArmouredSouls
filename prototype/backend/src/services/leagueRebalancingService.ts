import { PrismaClient, Robot } from '@prisma/client';
import { 
  assignLeagueInstance, 
  rebalanceInstances, 
  LEAGUE_TIERS,
  LeagueTier 
} from './leagueInstanceService';

const prisma = new PrismaClient();

// Promotion/Demotion thresholds
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
 * Determine which robots should be promoted from a tier
 * @param tier - The league tier to evaluate
 * @param excludeRobotIds - Set of robot IDs to exclude (already processed in this cycle)
 */
export async function determinePromotions(tier: LeagueTier, excludeRobotIds: Set<number> = new Set()): Promise<Robot[]> {
  // Champion tier has no promotions
  if (tier === 'champion') {
    return [];
  }

  // Get all robots in this tier with minimum cycles in current league
  const robots = await prisma.robot.findMany({
    where: {
      currentLeague: tier,
      cyclesInCurrentLeague: {
        gte: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING,
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

  // Skip if too few robots
  if (robots.length < MIN_ROBOTS_FOR_REBALANCING) {
    console.log(`[Rebalancing] ${tier}: Too few robots (${robots.length} < ${MIN_ROBOTS_FOR_REBALANCING}), skipping promotions`);
    return [];
  }

  // Calculate top 10%
  const promotionCount = Math.floor(robots.length * PROMOTION_PERCENTAGE);
  
  if (promotionCount === 0) {
    console.log(`[Rebalancing] ${tier}: Promotion count is 0 (${robots.length} robots), skipping`);
    return [];
  }

  const toPromote = robots.slice(0, promotionCount);
  console.log(`[Rebalancing] ${tier}: ${toPromote.length} robots eligible for promotion (top ${PROMOTION_PERCENTAGE * 100}% of ${robots.length})`);
  
  return toPromote;
}

/**
 * Determine which robots should be demoted from a tier
 * @param tier - The league tier to evaluate
 * @param excludeRobotIds - Set of robot IDs to exclude (already processed in this cycle)
 */
export async function determineDemotions(tier: LeagueTier, excludeRobotIds: Set<number> = new Set()): Promise<Robot[]> {
  // Bronze tier has no demotions
  if (tier === 'bronze') {
    return [];
  }

  // Get all robots in this tier with minimum cycles in current league
  const robots = await prisma.robot.findMany({
    where: {
      currentLeague: tier,
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
    console.log(`[Rebalancing] ${tier}: Too few robots (${robots.length} < ${MIN_ROBOTS_FOR_REBALANCING}), skipping demotions`);
    return [];
  }

  // Calculate bottom 10%
  const demotionCount = Math.floor(robots.length * DEMOTION_PERCENTAGE);
  
  if (demotionCount === 0) {
    console.log(`[Rebalancing] ${tier}: Demotion count is 0 (${robots.length} robots), skipping`);
    return [];
  }

  const toDemote = robots.slice(0, demotionCount);
  console.log(`[Rebalancing] ${tier}: ${toDemote.length} robots eligible for demotion (bottom ${DEMOTION_PERCENTAGE * 100}% of ${robots.length})`);
  
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
 */
export async function promoteRobot(robot: Robot): Promise<void> {
  const nextTier = getNextTierUp(robot.currentLeague as LeagueTier);
  
  if (!nextTier) {
    throw new Error(`Cannot promote robot ${robot.id} from ${robot.currentLeague} - already at top tier`);
  }

  // Assign to new instance
  const newLeagueId = await assignLeagueInstance(nextTier);

  // Update robot
  await prisma.robot.update({
    where: { id: robot.id },
    data: {
      currentLeague: nextTier,
      leagueId: newLeagueId,
      leaguePoints: 0, // Reset league points
      cyclesInCurrentLeague: 0, // Reset cycles counter for new league
    },
  });

  console.log(`[Rebalancing] Promoted: ${robot.name} (${robot.currentLeague} → ${nextTier})`);
}

/**
 * Demote a robot to the previous tier
 */
export async function demoteRobot(robot: Robot): Promise<void> {
  const previousTier = getNextTierDown(robot.currentLeague as LeagueTier);
  
  if (!previousTier) {
    throw new Error(`Cannot demote robot ${robot.id} from ${robot.currentLeague} - already at bottom tier`);
  }

  // Assign to new instance
  const newLeagueId = await assignLeagueInstance(previousTier);

  // Update robot
  await prisma.robot.update({
    where: { id: robot.id },
    data: {
      currentLeague: previousTier,
      leagueId: newLeagueId,
      leaguePoints: 0, // Reset league points
      cyclesInCurrentLeague: 0, // Reset cycles counter for new league
    },
  });

  console.log(`[Rebalancing] Demoted: ${robot.name} (${robot.currentLeague} → ${previousTier})`);
}

/**
 * Rebalance a single league tier
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

  // Count eligible robots (≥5 cycles in current league and not already processed)
  const eligibleRobots = await prisma.robot.count({
    where: {
      currentLeague: tier,
      cyclesInCurrentLeague: { gte: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING },
      NOT: [
        { name: 'Bye Robot' },
        { id: { in: Array.from(excludeRobotIds) } },
      ],
    },
  });

  console.log(`[Rebalancing] ${tier}: ${totalInTier} total robots, ${eligibleRobots} eligible for rebalancing`);

  const summary: RebalancingSummary = {
    tier,
    robotsInTier: totalInTier,
    promoted: 0,
    demoted: 0,
    eligibleRobots,
  };

  // Skip if too few robots
  if (eligibleRobots < MIN_ROBOTS_FOR_REBALANCING) {
    console.log(`[Rebalancing] ${tier}: Skipping (not enough eligible robots)`);
    return summary;
  }

  // Determine promotions
  const toPromote = await determinePromotions(tier, excludeRobotIds);
  
  // Determine demotions
  const toDemote = await determineDemotions(tier, excludeRobotIds);

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

  console.log(`[Rebalancing] ${tier}: Promoted ${summary.promoted}, Demoted ${summary.demoted}`);

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

  // Rebalance instances for each tier after all moves
  console.log('\n[Rebalancing] Balancing instances...');
  for (const tier of LEAGUE_TIERS) {
    try {
      await rebalanceInstances(tier);
    } catch (error) {
      console.error(`[Rebalancing] Error balancing ${tier} instances:`, error);
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
