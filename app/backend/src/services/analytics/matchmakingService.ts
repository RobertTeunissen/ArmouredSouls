import { Robot } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { getInstancesForTier, LeagueTier, LEAGUE_TIERS } from '../league/leagueInstanceService';
import logger from '../../config/logger';
import {
  calculateMatchScore,
  MatchScoreInput,
  LP_MATCH_IDEAL,
  LP_MATCH_FALLBACK,
  ELO_MATCH_IDEAL,
  ELO_MATCH_FALLBACK,
  RECENT_OPPONENT_LIMIT,
} from '../matchmaking/teamMatchmakingUtils';

// Bye-robot identifier
export const BYE_ROBOT_NAME = 'Bye Robot';

export interface BattleReadinessCheck {
  isReady: boolean;
  reasons: string[];
  hpCheck: boolean;
  weaponCheck: boolean;
}

export interface MatchPair {
  robot1: Robot;
  robot2: Robot;
  isByeMatch: boolean;
  leagueType: string;
}

/**
 * Check if a robot meets battle readiness requirements.
 * Only checks weapon loadout — HP is not checked because
 * robots are always repaired before battles execute.
 */
export function checkBattleReadiness(robot: Robot): BattleReadinessCheck {
  const reasons: string[] = [];

  // Weapon Check: Must have all required weapons equipped based on loadout type
  let weaponCheck = false;

  switch (robot.loadoutType) {
    case 'single':
      weaponCheck = robot.mainWeaponId !== null;
      if (!weaponCheck) reasons.push('No main weapon equipped');
      break;

    case 'dual_wield':
      weaponCheck = robot.mainWeaponId !== null && robot.offhandWeaponId !== null;
      if (robot.mainWeaponId === null) reasons.push('No main weapon equipped');
      if (robot.offhandWeaponId === null) reasons.push('No offhand weapon equipped');
      break;

    case 'weapon_shield':
      weaponCheck = robot.mainWeaponId !== null && robot.offhandWeaponId !== null;
      if (robot.mainWeaponId === null) reasons.push('No main weapon equipped');
      if (robot.offhandWeaponId === null) reasons.push('No shield equipped');
      break;

    case 'two_handed':
      weaponCheck = robot.mainWeaponId !== null;
      if (!weaponCheck) reasons.push('No two-handed weapon equipped');
      break;

    default:
      weaponCheck = false;
      reasons.push('Invalid loadout type');
  }

  return {
    isReady: weaponCheck,
    reasons,
    hpCheck: true, // HP not checked — repairs run before battles
    weaponCheck,
  };
}
/**
 * Check if a robot meets scheduling readiness requirements.
 * Used when scheduling future matches — only checks weapon loadout,
 * NOT HP. Robots will be repaired before the scheduled match executes,
 * so HP status at scheduling time is irrelevant.
 */
export function checkSchedulingReadiness(robot: Robot): BattleReadinessCheck {
  return checkBattleReadiness(robot);
}

/**
 * Get recent opponents for multiple robots in a single query (batch version).
 * Returns a map of robotId → array of recent opponent IDs.
 *
 * NOTE: Uses a global `take` limit which is an approximation — if one robot
 * has many more recent battles than others, some robots may get incomplete
 * opponent lists. This is an acceptable tradeoff for matchmaking quality vs
 * query count (1 query instead of N). The soft deprioritization of recent
 * opponents means an occasional repeat match is not game-breaking.
 */
async function getRecentOpponentsBatch(robotIds: number[], limit: number = RECENT_OPPONENT_LIMIT): Promise<Map<number, number[]>> {
  if (robotIds.length === 0) return new Map();

  // Single query to get recent battles for all robots in the set
  const recentBattles = await prisma.battle.findMany({
    where: {
      OR: [
        { robot1Id: { in: robotIds } },
        { robot2Id: { in: robotIds } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    // Fetch enough battles to cover all robots (worst case: each robot has `limit` unique battles)
    take: robotIds.length * limit,
    select: {
      robot1Id: true,
      robot2Id: true,
    },
  });

  // Build per-robot opponent lists from the batch result
  const map = new Map<number, number[]>();
  for (const robotId of robotIds) {
    const opponents: number[] = [];
    for (const battle of recentBattles) {
      if (opponents.length >= limit) break;
      if (battle.robot1Id === robotId) {
        opponents.push(battle.robot2Id);
      } else if (battle.robot2Id === robotId) {
        opponents.push(battle.robot1Id);
      }
    }
    map.set(robotId, opponents);
  }

  return map;
}

/**
 * Find best opponent for a robot from available pool.
 * Uses the shared calculateMatchScore from teamMatchmakingUtils.ts
 * with LP-primary scoring and ELO as a soft secondary factor (no hard reject).
 */
function findBestOpponent(
  robot: Robot,
  availableRobots: Robot[],
  recentOpponentsMap: Map<number, number[]>
): Robot | null {
  if (availableRobots.length === 0) {
    return null;
  }
  
  const robotRecentOpponents = recentOpponentsMap.get(robot.id) || [];
  
  // Score all potential opponents using the shared formula
  const scoredOpponents = availableRobots.map(opponent => {
    const opponentRecentOpponents = recentOpponentsMap.get(opponent.id) || [];
    const input: MatchScoreInput = {
      entity1LP: robot.leaguePoints,
      entity2LP: opponent.leaguePoints,
      entity1ELO: robot.elo,
      entity2ELO: opponent.elo,
      recentOpponents1: robotRecentOpponents,
      recentOpponents2: opponentRecentOpponents,
      entity1Id: robot.id,
      entity2Id: opponent.id,
      entity1StableId: robot.userId,
      entity2StableId: opponent.userId,
    };
    const score = calculateMatchScore(input);
    return { opponent, score };
  });
  
  // Sort by score (lower is better) and return best match
  scoredOpponents.sort((a, b) => a.score - b.score);
  return scoredOpponents[0].opponent;
}

/**
 * Build matchmaking queue for a league instance
 */
async function buildMatchmakingQueue(leagueId: string): Promise<Robot[]> {
  // Get all robots in this instance
  const robots = await prisma.robot.findMany({
    where: {
      leagueId,
      NOT: {
        name: BYE_ROBOT_NAME, // Exclude bye-robot from queue
      },
    },
    orderBy: [
      { leaguePoints: 'desc' },
      { elo: 'desc' },
    ],
  });
  
  // Filter for scheduling-ready robots (weapons equipped, HP not checked)
  // Robots will be repaired before the scheduled match executes
  const readyRobots = robots.filter(robot => {
    const readiness = checkSchedulingReadiness(robot);
    return readiness.isReady;
  });
  
  // Activate pending subscriptions for robots that have room under cap
  const { batchActivatePendingSubscriptions } = await import('../subscription/subscriptionService');
  await batchActivatePendingSubscriptions(readyRobots.map(r => r.id), 'league_1v1');

  // Filter by league subscription — only active subscriptions (batch query for efficiency)
  const subscribedRobotIds = await prisma.subscription.findMany({
    where: { eventType: 'league_1v1', robotId: { in: readyRobots.map(r => r.id) }, status: 'active' },
    select: { robotId: true },
  });
  const subscribedSet = new Set(subscribedRobotIds.map(s => s.robotId));
  const subscribedRobots = readyRobots.filter(r => subscribedSet.has(r.id));

  const excludedBySubscription = readyRobots.length - subscribedRobots.length;
  if (excludedBySubscription > 0) {
    logger.info(`[Matchmaking] Excluded ${excludedBySubscription} robots without league subscription`, { leagueId });
  }

  // Check if robots are already scheduled for a match
  const scheduledRobotIds2 = await prisma.scheduledLeagueMatch.findMany({
    where: {
      status: 'scheduled',
      OR: [
        { robot1Id: { in: subscribedRobots.map(r => r.id) } },
        { robot2Id: { in: subscribedRobots.map(r => r.id) } },
      ],
    },
    select: {
      robot1Id: true,
      robot2Id: true,
    },
  });
  
  const alreadyScheduledIds = new Set<number>();
  scheduledRobotIds2.forEach(match => {
    alreadyScheduledIds.add(match.robot1Id);
    alreadyScheduledIds.add(match.robot2Id);
  });
  
  // Filter out already scheduled robots
  const availableRobots = subscribedRobots.filter(robot => !alreadyScheduledIds.has(robot.id));
  
  logger.info(`[Matchmaking] Queue for ${leagueId}: ${availableRobots.length} robots available (${robots.length} total, ${readyRobots.length} ready)`);
  
  return availableRobots;
}

/**
 * Pair robots for matches within an instance
 */
async function pairRobots(robots: Robot[]): Promise<MatchPair[]> {
  if (robots.length === 0) {
    return [];
  }
  
  const matches: MatchPair[] = [];
  const availableRobots = [...robots]; // Copy array
  
  // Pre-fetch recent opponents for all robots in a single batch query
  const recentOpponentsMap = await getRecentOpponentsBatch(robots.map(r => r.id));
  
  // Pair robots using greedy algorithm
  while (availableRobots.length > 1) {
    const robot1 = availableRobots.shift()!;
    const opponent = findBestOpponent(robot1, availableRobots, recentOpponentsMap);
    
    if (opponent) {
      // Remove opponent from available pool
      const opponentIndex = availableRobots.indexOf(opponent);
      availableRobots.splice(opponentIndex, 1);
      
      // Create match pair
      matches.push({
        robot1,
        robot2: opponent,
        isByeMatch: false,
        leagueType: robot1.currentLeague,
      });
    } else {
      // No suitable opponent found, put robot back for bye-match
      availableRobots.push(robot1);
      break;
    }
  }
  
  // Handle odd robot with bye-match
  if (availableRobots.length === 1) {
    const lastRobot = availableRobots[0];
    const byeRobot = await prisma.robot.findFirst({
      where: { name: BYE_ROBOT_NAME },
    });
    
    if (byeRobot) {
      matches.push({
        robot1: lastRobot,
        robot2: byeRobot,
        isByeMatch: true,
        leagueType: lastRobot.currentLeague,
      });
      
      logger.info(`[Matchmaking] Bye-match created for ${lastRobot.name}`);
    } else {
      logger.warn(`[Matchmaking] No ${BYE_ROBOT_NAME} found for ${lastRobot.name}`);
    }
  }
  
  return matches;
}

/**
 * Create scheduled matches in database
 */
async function createScheduledMatches(matches: MatchPair[], scheduledFor: Date): Promise<void> {
  const matchData = matches.map(match => ({
    robot1Id: match.robot1.id,
    robot2Id: match.robot2.id,
    leagueType: match.leagueType,
    scheduledFor,
    status: 'scheduled',
  }));
  
  await prisma.scheduledLeagueMatch.createMany({
    data: matchData,
  });
  
  logger.info(`[Matchmaking] Created ${matches.length} scheduled matches`);
}

/**
 * Run matchmaking for a specific league tier
 */
export async function runMatchmakingForTier(tier: LeagueTier, scheduledFor: Date): Promise<number> {
  logger.info(`[Matchmaking] Running matchmaking for ${tier.toUpperCase()} league...`);
  
  const instances = await getInstancesForTier(tier);
  let totalMatches = 0;
  
  for (const instance of instances) {
    logger.info(`[Matchmaking] Processing ${instance.leagueId}...`);
    
    // Build queue for this instance
    const queue = await buildMatchmakingQueue(instance.leagueId);
    
    if (queue.length < 2) {
      logger.info(`[Matchmaking] ${instance.leagueId}: Not enough robots for matches (${queue.length} available)`);
      continue;
    }
    
    // Pair robots
    const matches = await pairRobots(queue);
    
    // Create scheduled matches
    await createScheduledMatches(matches, scheduledFor);
    
    totalMatches += matches.length;
  }
  
  logger.info(`[Matchmaking] ${tier.toUpperCase()}: Created ${totalMatches} matches across ${instances.length} instances`);
  return totalMatches;
}

/**
 * Run matchmaking for all league tiers
 */
export async function runMatchmaking(scheduledFor?: Date): Promise<number> {
  const matchTime = scheduledFor || new Date(Date.now() + 24 * 60 * 60 * 1000); // Default: 24 hours from now
  
  logger.info(`[Matchmaking] Starting matchmaking run...`);
  logger.info(`[Matchmaking] Matches scheduled for: ${matchTime.toISOString()}`);
  
  let totalMatches = 0;
  
  for (const tier of LEAGUE_TIERS) {
    const tierMatches = await runMatchmakingForTier(tier, matchTime);
    totalMatches += tierMatches;
  }
  
  logger.info(`[Matchmaking] ========================================`);
  logger.info(`[Matchmaking] COMPLETE: ${totalMatches} total matches created`);
  logger.info(`[Matchmaking] ========================================`);
  
  return totalMatches;
}
