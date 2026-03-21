import { Robot } from '@prisma/client';
import prisma from '../lib/prisma';
import { getInstancesForTier, LeagueTier, LEAGUE_TIERS } from './leagueInstanceService';
import logger from '../config/logger';


// Matchmaking configuration
export const LP_MATCH_IDEAL = 10;        // ±10 LP ideal range (PRIMARY)
export const LP_MATCH_FALLBACK = 20;     // ±20 LP fallback range (PRIMARY)
export const ELO_MATCH_IDEAL = 150;      // ±150 ELO ideal (SECONDARY)
export const ELO_MATCH_FALLBACK = 300;   // ±300 ELO max (SECONDARY)
export const RECENT_OPPONENT_LIMIT = 5;  // Number of recent opponents to track

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
 * Get recent opponents for a robot (last N matches)
 */
async function getRecentOpponents(robotId: number, limit: number = RECENT_OPPONENT_LIMIT): Promise<number[]> {
  // Get recent battles where this robot participated
  const recentBattles = await prisma.battle.findMany({
    where: {
      OR: [
        { robot1Id: robotId },
        { robot2Id: robotId },
      ],
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    select: {
      robot1Id: true,
      robot2Id: true,
    },
  });
  
  // Extract opponent IDs
  const opponentIds = recentBattles.map(battle => 
    battle.robot1Id === robotId ? battle.robot2Id : battle.robot1Id
  );
  
  return opponentIds;
}

/**
 * Calculate match quality score (lower is better)
 * CHANGED: LP-primary matching with ELO as secondary quality check
 */
function calculateMatchScore(
  robot1: Robot,
  robot2: Robot,
  recentOpponents1: number[],
  recentOpponents2: number[]
): number {
  let score = 0;
  
  // LP difference (PRIMARY factor)
  const lpDiff = Math.abs(robot1.leaguePoints - robot2.leaguePoints);
  
  // LP scoring: heavily penalize outside ideal/fallback ranges
  if (lpDiff <= LP_MATCH_IDEAL) {
    score += lpDiff * 1;  // Ideal range (±10 LP): minimal penalty
  } else if (lpDiff <= LP_MATCH_FALLBACK) {
    score += lpDiff * 5;  // Fallback range (±20 LP): moderate penalty
  } else {
    score += lpDiff * 20; // Outside range: heavy penalty
  }
  
  // ELO difference (SECONDARY factor - quality check)
  const eloDiff = Math.abs(robot1.elo - robot2.elo);
  
  if (eloDiff <= ELO_MATCH_IDEAL) {
    score += eloDiff * 0.1;  // Ideal ELO (±150): minimal penalty
  } else if (eloDiff <= ELO_MATCH_FALLBACK) {
    score += eloDiff * 0.5;  // Fallback ELO (±300): moderate penalty
  } else {
    score += 1000;  // Outside ELO range (>300): reject match
  }
  
  // Recent opponent penalty (soft deprioritize)
  if (recentOpponents1.includes(robot2.id)) {
    score += 200; // Add penalty if they fought recently
  }
  if (recentOpponents2.includes(robot1.id)) {
    score += 200;
  }
  
  // Same stable penalty (strongly deprioritize)
  if (robot1.userId === robot2.userId) {
    score += 500; // Heavy penalty for same-stable matches
  }
  
  return score;
}

/**
 * Find best opponent for a robot from available pool
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
  
  // Score all potential opponents
  const scoredOpponents = availableRobots.map(opponent => {
    const opponentRecentOpponents = recentOpponentsMap.get(opponent.id) || [];
    const score = calculateMatchScore(robot, opponent, robotRecentOpponents, opponentRecentOpponents);
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
  
  // Check if robots are already scheduled for a match
  const scheduledRobotIds = await prisma.scheduledLeagueMatch.findMany({
    where: {
      status: 'scheduled',
      OR: [
        { robot1Id: { in: readyRobots.map(r => r.id) } },
        { robot2Id: { in: readyRobots.map(r => r.id) } },
      ],
    },
    select: {
      robot1Id: true,
      robot2Id: true,
    },
  });
  
  const alreadyScheduledIds = new Set<number>();
  scheduledRobotIds.forEach(match => {
    alreadyScheduledIds.add(match.robot1Id);
    alreadyScheduledIds.add(match.robot2Id);
  });
  
  // Filter out already scheduled robots
  const availableRobots = readyRobots.filter(robot => !alreadyScheduledIds.has(robot.id));
  
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
  
  // Pre-fetch recent opponents for all robots
  const recentOpponentsMap = new Map<number, number[]>();
  await Promise.all(
    robots.map(async robot => {
      const opponents = await getRecentOpponents(robot.id);
      recentOpponentsMap.set(robot.id, opponents);
    })
  );
  
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
