import { PrismaClient, Robot } from '@prisma/client';
import { getInstancesForTier, LeagueTier, LEAGUE_TIERS } from './leagueInstanceService';

const prisma = new PrismaClient();

// Matchmaking configuration
export const ELO_MATCH_IDEAL = 150; // Ideal ELO difference for a fair match
export const ELO_MATCH_FALLBACK = 300; // Maximum ELO difference for fallback matching
export const RECENT_OPPONENT_LIMIT = 5; // Number of recent opponents to track
export const BATTLE_READINESS_HP_THRESHOLD = 0.75; // 75% HP required

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
 * Check if a robot meets battle readiness requirements
 */
export function checkBattleReadiness(robot: Robot): BattleReadinessCheck {
  const reasons: string[] = [];
  
  // HP Check: Robot must have at least 75% HP
  const hpPercentage = robot.currentHP / robot.maxHP;
  const hpCheck = hpPercentage >= BATTLE_READINESS_HP_THRESHOLD;
  
  if (!hpCheck) {
    reasons.push(`HP too low (${Math.floor(hpPercentage * 100)}%, need ${BATTLE_READINESS_HP_THRESHOLD * 100}%)`);
  }
  
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
    isReady: hpCheck && weaponCheck,
    reasons,
    hpCheck,
    weaponCheck,
  };
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
 */
function calculateMatchScore(
  robot1: Robot,
  robot2: Robot,
  recentOpponents1: number[],
  recentOpponents2: number[]
): number {
  let score = 0;
  
  // ELO difference (primary factor)
  const eloDiff = Math.abs(robot1.elo - robot2.elo);
  score += eloDiff;
  
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
  
  // Filter for battle-ready robots
  const readyRobots = robots.filter(robot => {
    const readiness = checkBattleReadiness(robot);
    return readiness.isReady;
  });
  
  // Check if robots are already scheduled for a match
  const scheduledRobotIds = await prisma.scheduledMatch.findMany({
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
  
  console.log(`[Matchmaking] Queue for ${leagueId}: ${availableRobots.length} robots available (${robots.length} total, ${readyRobots.length} ready)`);
  
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
      
      console.log(`[Matchmaking] Bye-match created for ${lastRobot.name}`);
    } else {
      console.warn(`[Matchmaking] No ${BYE_ROBOT_NAME} found for ${lastRobot.name}`);
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
  
  await prisma.scheduledMatch.createMany({
    data: matchData,
  });
  
  console.log(`[Matchmaking] Created ${matches.length} scheduled matches`);
}

/**
 * Run matchmaking for a specific league tier
 */
export async function runMatchmakingForTier(tier: LeagueTier, scheduledFor: Date): Promise<number> {
  console.log(`[Matchmaking] Running matchmaking for ${tier.toUpperCase()} league...`);
  
  const instances = await getInstancesForTier(tier);
  let totalMatches = 0;
  
  for (const instance of instances) {
    console.log(`[Matchmaking] Processing ${instance.leagueId}...`);
    
    // Build queue for this instance
    const queue = await buildMatchmakingQueue(instance.leagueId);
    
    if (queue.length < 2) {
      console.log(`[Matchmaking] ${instance.leagueId}: Not enough robots for matches (${queue.length} available)`);
      continue;
    }
    
    // Pair robots
    const matches = await pairRobots(queue);
    
    // Create scheduled matches
    await createScheduledMatches(matches, scheduledFor);
    
    totalMatches += matches.length;
  }
  
  console.log(`[Matchmaking] ${tier.toUpperCase()}: Created ${totalMatches} matches across ${instances.length} instances`);
  return totalMatches;
}

/**
 * Run matchmaking for all league tiers
 */
export async function runMatchmaking(scheduledFor?: Date): Promise<number> {
  const matchTime = scheduledFor || new Date(Date.now() + 24 * 60 * 60 * 1000); // Default: 24 hours from now
  
  console.log(`[Matchmaking] Starting matchmaking run...`);
  console.log(`[Matchmaking] Matches scheduled for: ${matchTime.toISOString()}`);
  
  let totalMatches = 0;
  
  for (const tier of LEAGUE_TIERS) {
    const tierMatches = await runMatchmakingForTier(tier, matchTime);
    totalMatches += tierMatches;
  }
  
  console.log(`[Matchmaking] ========================================`);
  console.log(`[Matchmaking] COMPLETE: ${totalMatches} total matches created`);
  console.log(`[Matchmaking] ========================================`);
  
  return totalMatches;
}
