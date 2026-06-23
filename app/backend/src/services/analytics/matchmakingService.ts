import { Robot, MatchType } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { LEAGUE_TIERS, LeagueTier } from '../league/leagueInstanceService';
import logger from '../../config/logger';
import schedulingService from '../scheduling/schedulingService';
import {
  calculateMatchScore,
  MatchScoreInput,
  RECENT_OPPONENT_LIMIT,
  defaultScheduledFor,
} from '../matchmaking/teamMatchmakingUtils';

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
  let weaponCheck: boolean;

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
 * Create an in-memory fabricated bye robot for 1v1 matchmaking.
 * Used when a tier instance has an odd number of eligible robots.
 * The bye robot always loses — no combat simulation is run.
 */
function createByeRobot(): Robot {
  const { Prisma } = require('../../../generated/prisma');
  return {
    id: -1,
    userId: -1,
    name: 'Bye Robot',
    frameId: 1,
    paintJob: null,
    imageUrl: null,
    combatPower: new Prisma.Decimal(10),
    targetingSystems: new Prisma.Decimal(10),
    criticalSystems: new Prisma.Decimal(10),
    penetration: new Prisma.Decimal(10),
    weaponControl: new Prisma.Decimal(10),
    attackSpeed: new Prisma.Decimal(10),
    armorPlating: new Prisma.Decimal(10),
    shieldCapacity: new Prisma.Decimal(10),
    evasionThrusters: new Prisma.Decimal(10),
    damageDampeners: new Prisma.Decimal(10),
    counterProtocols: new Prisma.Decimal(10),
    hullIntegrity: new Prisma.Decimal(10),
    servoMotors: new Prisma.Decimal(10),
    gyroStabilizers: new Prisma.Decimal(10),
    hydraulicSystems: new Prisma.Decimal(10),
    powerCore: new Prisma.Decimal(10),
    combatAlgorithms: new Prisma.Decimal(10),
    threatAnalysis: new Prisma.Decimal(10),
    adaptiveAI: new Prisma.Decimal(10),
    logicCores: new Prisma.Decimal(10),
    syncProtocols: new Prisma.Decimal(10),
    supportSystems: new Prisma.Decimal(10),
    formationTactics: new Prisma.Decimal(10),
    currentHP: 100,
    maxHP: 100,
    currentShield: 20,
    maxShield: 20,
    damageTaken: 0,
    elo: 1000,
    totalBattles: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    damageDealtLifetime: 0,
    damageTakenLifetime: 0,
    kills: 0,
    currentLeague: 'bronze',
    leagueId: 'bronze_1',
    leaguePoints: 0,
    cyclesInCurrentLeague: 0,
    fame: 0,
    titles: null,
    totalTagTeamBattles: 0,
    totalTagTeamWins: 0,
    totalTagTeamLosses: 0,
    totalTagTeamDraws: 0,
    timesTaggedIn: 0,
    timesTaggedOut: 0,
    totalLeague1v1Wins: 0,
    totalLeague1v1Losses: 0,
    totalLeague1v1Draws: 0,
    totalLeague2v2Wins: 0,
    totalLeague3v3Wins: 0,
    repairCost: 0,
    battleReadiness: 100,
    totalRepairsPaid: 0,
    yieldThreshold: 10,
    loadoutType: 'single',
    stance: 'balanced',
    kothWins: 0,
    kothMatches: 0,
    kothTotalZoneScore: 0,
    kothTotalZoneTime: 0,
    kothKills: 0,
    kothBestPlacement: null,
    kothCurrentWinStreak: 0,
    kothBestWinStreak: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    currentLoseStreak: 0,
    offensiveWins: 0,
    defensiveWins: 0,
    balancedWins: 0,
    dualWieldWins: 0,
    mainWeaponId: null,
    offhandWeaponId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Robot;
}

/**
 * Get recent opponents for multiple robots using unified scheduled_matches_v2.
 * Queries completed 1v1 league matches only (mode-specific).
 */
async function getRecentOpponentsBatch(robotIds: number[], limit: number = RECENT_OPPONENT_LIMIT): Promise<Map<number, number[]>> {
  if (robotIds.length === 0) return new Map();
  const { createRecentOpponentQueryFn } = await import('../matchmaking/teamMatchmakingUtils');
  const { MatchType } = await import('../../../generated/prisma');
  const queryFn = createRecentOpponentQueryFn(MatchType.league_1v1, 'robot');
  return queryFn(robotIds, limit);
}

/**
 * Find best opponent for a robot from available pool.
 * Uses the shared calculateMatchScore from teamMatchmakingUtils.ts
 * with LP-primary scoring and ELO as a soft secondary factor (no hard reject).
 */
function findBestOpponent(
  robot: Robot,
  availableRobots: Robot[],
  recentOpponentsMap: Map<number, number[]>,
  standingsLPMap: Map<number, number>
): Robot | null {
  if (availableRobots.length === 0) {
    return null;
  }
  
  const robotRecentOpponents = recentOpponentsMap.get(robot.id) || [];
  
  // Score all potential opponents using the shared formula
  const scoredOpponents = availableRobots.map(opponent => {
    const opponentRecentOpponents = recentOpponentsMap.get(opponent.id) || [];
    const input: MatchScoreInput = {
      entity1LP: standingsLPMap.get(robot.id) ?? 0,
      entity2LP: standingsLPMap.get(opponent.id) ?? 0,
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
  
  // Sort by score (lower is better), tie-break by createdAt (deterministic)
  scoredOpponents.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.opponent.createdAt.getTime() - b.opponent.createdAt.getTime();
  });

  // R4.7: If the best match is a recent opponent, check if ANY non-recent exists
  const bestMatch = scoredOpponents[0];
  const bestIsRecentOpponent =
    robotRecentOpponents.includes(bestMatch.opponent.id) ||
    (recentOpponentsMap.get(bestMatch.opponent.id) || []).includes(robot.id);

  if (bestIsRecentOpponent) {
    const nonRecentOpponent = scoredOpponents.find(so => {
      const oppRecent = recentOpponentsMap.get(so.opponent.id) || [];
      return !robotRecentOpponents.includes(so.opponent.id) && !oppRecent.includes(robot.id);
    });

    if (nonRecentOpponent) {
      // Non-recent opponent exists — normal scoring handles it (best score wins)
      return bestMatch.opponent;
    }

    // R4.7 fallback: ALL opponents are recent — select closest-ELO
    const closestELO = [...scoredOpponents].sort((a, b) => {
      const diffA = Math.abs(a.opponent.elo - robot.elo);
      const diffB = Math.abs(b.opponent.elo - robot.elo);
      if (diffA !== diffB) return diffA - diffB;
      return a.opponent.createdAt.getTime() - b.opponent.createdAt.getTime();
    });
    return closestELO[0].opponent;
  }

  return bestMatch.opponent;
}

/**
 * Build matchmaking queue for a league instance
 */
async function buildMatchmakingQueue(leagueId: string): Promise<Robot[]> {
  // Get robot IDs in this instance from standings (source of truth for league placement)
  const standingsInInstance = await prisma.standing.findMany({
    where: { mode: 'league_1v1', leagueInstanceId: leagueId },
    select: { entityId: true },
  });
  const robotIdsInInstance = standingsInInstance.map(s => s.entityId);

  if (robotIdsInInstance.length === 0) {
    return [];
  }

  // Load robots by those IDs
  const robots = await prisma.robot.findMany({
    where: {
      id: { in: robotIdsInInstance },
    },
    orderBy: [
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

  // Check if robots are already scheduled for a match (via unified scheduling table)
  const alreadyScheduledIds = new Set<number>();
  for (const r of subscribedRobots) {
    const upcoming = await schedulingService.getUpcomingForRobot(r.id, [MatchType.league_1v1]);
    if (upcoming.length > 0) {
      alreadyScheduledIds.add(r.id);
    }
  }
  
  // Filter out already scheduled robots
  const availableRobots = subscribedRobots.filter(robot => !alreadyScheduledIds.has(robot.id));
  
  logger.info(`[Matchmaking] Queue for ${leagueId}: ${availableRobots.length} robots available (${robots.length} total, ${readyRobots.length} ready)`);
  
  return availableRobots;
}

/**
 * Pair robots for matches within an instance
 */
async function pairRobots(robots: Robot[], leagueId: string): Promise<MatchPair[]> {
  if (robots.length === 0) {
    return [];
  }
  
  const matches: MatchPair[] = [];
  const availableRobots = [...robots]; // Copy array
  
  // Pre-fetch recent opponents for all robots in a single batch query
  const recentOpponentsMap = await getRecentOpponentsBatch(robots.map(r => r.id));

  // Build LP lookup map from standings (source of truth)
  const standingsLPMap = new Map(
    (await prisma.standing.findMany({
      where: { mode: 'league_1v1', entityId: { in: robots.map(r => r.id) } },
      select: { entityId: true, leaguePoints: true },
    })).map(s => [s.entityId, s.leaguePoints])
  );

  // Derive tier from leagueId (e.g., 'bronze_1' → 'bronze')
  const leagueType = leagueId.split('_')[0];
  
  // Pair robots using greedy algorithm
  while (availableRobots.length > 1) {
    const robot1 = availableRobots.shift()!;
    const opponent = findBestOpponent(robot1, availableRobots, recentOpponentsMap, standingsLPMap);
    
    if (opponent) {
      // Remove opponent from available pool
      const opponentIndex = availableRobots.indexOf(opponent);
      availableRobots.splice(opponentIndex, 1);
      
      // Create match pair
      matches.push({
        robot1,
        robot2: opponent,
        isByeMatch: false,
        leagueType,
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
    const byeRobot = createByeRobot();
    
    matches.push({
      robot1: lastRobot,
      robot2: byeRobot,
      isByeMatch: true,
      leagueType,
    });
    
    logger.info(`[Matchmaking] Bye-match created for ${lastRobot.name}`);
  }
  
  return matches;
}

/**
 * Create scheduled matches using the unified SchedulingService.
 * Each match creates one row in `scheduled_matches_v2` with participant rows.
 */
async function createScheduledMatches(matches: MatchPair[], scheduledFor: Date, leagueId: string): Promise<void> {
  for (const match of matches) {
    await schedulingService.createMatch({
      matchType: MatchType.league_1v1,
      scheduledFor,
      leagueType: match.leagueType,
      leagueInstanceId: leagueId,
      isByeMatch: match.isByeMatch,
      participants: [
        { participantType: 'robot', participantId: match.robot1.id, slot: 1 },
        { participantType: 'robot', participantId: match.robot2.id, slot: 2 },
      ],
    });
  }
  
  logger.info(`[Matchmaking] Created ${matches.length} scheduled matches`);
}

/**
 * Run matchmaking for a specific league tier
 */
export async function runMatchmakingForTier(tier: LeagueTier, scheduledFor: Date): Promise<number> {
  logger.info(`[Matchmaking] Running matchmaking for ${tier.toUpperCase()} league...`);
  
  // Discover instances from Standing records (unified pattern — same as 2v2/3v3/tag team/KotH)
  const instanceRecords = await prisma.standing.findMany({
    where: { mode: 'league_1v1' as any, tier },
    select: { leagueInstanceId: true },
    distinct: ['leagueInstanceId'],
  });
  const instanceIds = instanceRecords.map(i => i.leagueInstanceId);
  let totalMatches = 0;
  
  for (const leagueId of instanceIds) {
    logger.info(`[Matchmaking] Processing ${leagueId}...`);
    
    // Build queue for this instance
    const queue = await buildMatchmakingQueue(leagueId);
    
    if (queue.length < 2) {
      logger.info(`[Matchmaking] ${leagueId}: Not enough robots for matches (${queue.length} available)`);
      continue;
    }
    
    // Pair robots
    const matches = await pairRobots(queue, leagueId);
    
    // Create scheduled matches
    await createScheduledMatches(matches, scheduledFor, leagueId);
    
    totalMatches += matches.length;
  }
  
  logger.info(`[Matchmaking] ${tier.toUpperCase()}: Created ${totalMatches} matches across ${instanceIds.length} instances`);
  return totalMatches;
}

/**
 * Run matchmaking for all league tiers
 */
export async function runMatchmaking(scheduledFor?: Date): Promise<number> {
  const matchTime = scheduledFor ?? defaultScheduledFor();
  
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
