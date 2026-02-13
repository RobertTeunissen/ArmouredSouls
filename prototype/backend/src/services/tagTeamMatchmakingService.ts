import { Robot, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { checkTeamReadiness, calculateCombinedELO, TagTeamWithRobots } from './tagTeamService';


// Matchmaking configuration
export const TAG_TEAM_ELO_MATCH_IDEAL = 300; // Ideal combined ELO difference
export const TAG_TEAM_ELO_MATCH_FALLBACK = 600; // Fallback combined ELO difference
export const TAG_TEAM_RECENT_OPPONENT_LIMIT = 5; // Number of recent opponents to track

export interface TagTeamMatchPair {
  team1: TagTeamWithRobots;
  team2: TagTeamWithRobots;
  isByeMatch: boolean;
  tagTeamLeague: string;
}

/**
 * Check if tag team matchmaking should run for the current cycle
 * Requirements 2.7, 2.8: Run on odd cycles (1, 3, 5, etc.), skip on even cycles
 */
export async function shouldRunTagTeamMatchmaking(): Promise<boolean> {
  const cycleMetadata = await prisma.cycleMetadata.findUnique({
    where: { id: 1 },
  });

  if (!cycleMetadata) {
    console.warn('[TagTeamMatchmaking] No cycle metadata found, defaulting to cycle 0');
    return false; // Even cycle, skip
  }

  const currentCycle = cycleMetadata.totalCycles;
  const shouldRun = currentCycle % 2 === 1; // Odd cycles only

  console.log(`[TagTeamMatchmaking] Current cycle: ${currentCycle}, should run: ${shouldRun}`);
  return shouldRun;
}

/**
 * Get eligible teams for matchmaking
 * Requirement 8.4: Exclude teams with unready robots and teams already scheduled
 */
export async function getEligibleTeams(
  tagTeamLeague: string,
  tagTeamLeagueId: string
): Promise<TagTeamWithRobots[]> {
  // Get all teams in this league instance
  const teams = await prisma.tagTeam.findMany({
    where: {
      tagTeamLeague,
      tagTeamLeagueId,
    },
    include: {
      activeRobot: true,
      reserveRobot: true,
    },
  });

  // Filter for ready teams
  const readyTeams: TagTeamWithRobots[] = [];
  for (const team of teams) {
    const readiness = await checkTeamReadiness(team.id);
    if (readiness.isReady) {
      readyTeams.push(team);
    }
  }

  // Get already scheduled team IDs
  const scheduledMatches = await prisma.tagTeamMatch.findMany({
    where: {
      status: 'scheduled',
      OR: [
        { team1Id: { in: readyTeams.map(t => t.id) } },
        { team2Id: { in: readyTeams.map(t => t.id) } },
      ],
    },
    select: {
      team1Id: true,
      team2Id: true,
    },
  });

  const alreadyScheduledIds = new Set<number>();
  scheduledMatches.forEach(match => {
    alreadyScheduledIds.add(match.team1Id);
    alreadyScheduledIds.add(match.team2Id);
  });

  // Filter out already scheduled teams
  const eligibleTeams = readyTeams.filter(team => !alreadyScheduledIds.has(team.id));

  console.log(
    `[TagTeamMatchmaking] ${tagTeamLeagueId}: ${eligibleTeams.length} eligible teams ` +
    `(${teams.length} total, ${readyTeams.length} ready, ${alreadyScheduledIds.size} already scheduled)`
  );

  return eligibleTeams;
}

/**
 * Get recent opponents for a team (last N matches)
 */
async function getRecentOpponents(teamId: number, limit: number = TAG_TEAM_RECENT_OPPONENT_LIMIT): Promise<number[]> {
  // Get recent tag team matches where this team participated
  const recentMatches = await prisma.tagTeamMatch.findMany({
    where: {
      status: 'completed',
      OR: [
        { team1Id: teamId },
        { team2Id: teamId },
      ],
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    select: {
      team1Id: true,
      team2Id: true,
    },
  });

  // Extract opponent IDs
  const opponentIds = recentMatches.map(match =>
    match.team1Id === teamId ? match.team2Id : match.team1Id
  );

  return opponentIds;
}

/**
 * Calculate match quality score (lower is better)
 * Requirements 2.2, 2.4, 2.6: ELO matching, recent opponent deprioritization, same-stable exclusion
 */
async function calculateMatchScore(
  team1: TagTeamWithRobots,
  team2: TagTeamWithRobots,
  team1CombinedELO: number,
  team2CombinedELO: number,
  recentOpponents1: number[],
  recentOpponents2: number[]
): Promise<number> {
  let score = 0;

  // Combined ELO difference (primary factor)
  const eloDiff = Math.abs(team1CombinedELO - team2CombinedELO);
  score += eloDiff;

  // Recent opponent penalty (Requirement 2.4: deprioritize recent opponents)
  if (recentOpponents1.includes(team2.id)) {
    score += 400; // Add penalty if they fought recently
  }
  if (recentOpponents2.includes(team1.id)) {
    score += 400;
  }

  // Same stable penalty (Requirement 2.6: exclude same-stable matchups)
  if (team1.stableId === team2.stableId) {
    score += 10000; // Heavy penalty for same-stable matches
  }

  return score;
}

/**
 * Find best opponent for a team from available pool
 */
async function findBestOpponent(
  team: TagTeamWithRobots,
  availableTeams: TagTeamWithRobots[],
  combinedELOMap: Map<number, number>,
  recentOpponentsMap: Map<number, number[]>
): Promise<TagTeamWithRobots | null> {
  if (availableTeams.length === 0) {
    return null;
  }

  const teamCombinedELO = combinedELOMap.get(team.id)!;
  const teamRecentOpponents = recentOpponentsMap.get(team.id) || [];

  // Score all potential opponents
  const scoredOpponents = await Promise.all(
    availableTeams.map(async opponent => {
      const opponentCombinedELO = combinedELOMap.get(opponent.id)!;
      const opponentRecentOpponents = recentOpponentsMap.get(opponent.id) || [];
      const score = await calculateMatchScore(
        team,
        opponent,
        teamCombinedELO,
        opponentCombinedELO,
        teamRecentOpponents,
        opponentRecentOpponents
      );
      return { opponent, score };
    })
  );

  // Sort by score (lower is better) and return best match
  scoredOpponents.sort((a, b) => a.score - b.score);
  return scoredOpponents[0].opponent;
}

/**
 * Create a bye-team for odd number of teams
 * Requirement 2.5: Match with bye-team when no suitable opponent exists
 */
function createByeTeam(league: string, leagueId: string): TagTeamWithRobots {
  // Create bye robots with ELO 1000 each (combined 2000)
  const byeRobot1: Robot = {
    id: -1,
    userId: -1,
    name: 'Bye Robot 1',
    frameId: 1,
    paintJob: null,
    // Combat Systems
    combatPower: new Prisma.Decimal(10),
    targetingSystems: new Prisma.Decimal(10),
    criticalSystems: new Prisma.Decimal(10),
    penetration: new Prisma.Decimal(10),
    weaponControl: new Prisma.Decimal(10),
    attackSpeed: new Prisma.Decimal(10),
    // Defensive Systems
    armorPlating: new Prisma.Decimal(10),
    shieldCapacity: new Prisma.Decimal(10),
    evasionThrusters: new Prisma.Decimal(10),
    damageDampeners: new Prisma.Decimal(10),
    counterProtocols: new Prisma.Decimal(10),
    // Chassis & Mobility
    hullIntegrity: new Prisma.Decimal(10),
    servoMotors: new Prisma.Decimal(10),
    gyroStabilizers: new Prisma.Decimal(10),
    hydraulicSystems: new Prisma.Decimal(10),
    powerCore: new Prisma.Decimal(10),
    // AI Processing
    combatAlgorithms: new Prisma.Decimal(10),
    threatAnalysis: new Prisma.Decimal(10),
    adaptiveAI: new Prisma.Decimal(10),
    logicCores: new Prisma.Decimal(10),
    // Team Coordination
    syncProtocols: new Prisma.Decimal(10),
    supportSystems: new Prisma.Decimal(10),
    formationTactics: new Prisma.Decimal(10),
    // Combat State
    currentHP: 100,
    maxHP: 100,
    currentShield: 20,
    maxShield: 20,
    damageTaken: 0,
    // Performance
    elo: 1000,
    totalBattles: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    damageDealtLifetime: 0,
    damageTakenLifetime: 0,
    kills: 0,
    // League & Fame
    currentLeague: 'bronze',
    leagueId: 'bronze_1',
    leaguePoints: 0,
    cyclesInCurrentLeague: 0,
    fame: 0,
    titles: null,
    // Tag Team Statistics
    totalTagTeamBattles: 0,
    totalTagTeamWins: 0,
    totalTagTeamLosses: 0,
    totalTagTeamDraws: 0,
    timesTaggedIn: 0,
    timesTaggedOut: 0,
    // Economic
    repairCost: 0,
    battleReadiness: 100,
    totalRepairsPaid: 0,
    // Configuration
    yieldThreshold: 10,
    loadoutType: 'single',
    stance: 'balanced',
    // Equipment
    mainWeaponId: null,
    offhandWeaponId: null,
    // Timestamps
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const byeRobot2: Robot = { ...byeRobot1, id: -2, name: 'Bye Robot 2' };

  const byeTeam: TagTeamWithRobots = {
    id: -1,
    stableId: -1,
    activeRobotId: -1,
    reserveRobotId: -2,
    tagTeamLeague: league,
    tagTeamLeagueId: leagueId,
    tagTeamLeaguePoints: 0,
    cyclesInTagTeamLeague: 0,
    totalTagTeamWins: 0,
    totalTagTeamLosses: 0,
    totalTagTeamDraws: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    activeRobot: byeRobot1,
    reserveRobot: byeRobot2,
  };

  return byeTeam;
}

/**
 * Pair teams for matches within a league instance
 * Requirements 2.2, 2.3, 2.4, 2.5, 2.6: ELO matching, fallback, recent opponents, bye-team, same-stable exclusion
 */
export async function pairTeams(teams: TagTeamWithRobots[]): Promise<TagTeamMatchPair[]> {
  if (teams.length === 0) {
    return [];
  }

  const matches: TagTeamMatchPair[] = [];
  const availableTeams = [...teams]; // Copy array

  // Pre-calculate combined ELO for all teams
  const combinedELOMap = new Map<number, number>();
  for (const team of teams) {
    const combinedELO = await calculateCombinedELO(team.id);
    combinedELOMap.set(team.id, combinedELO);
  }

  // Pre-fetch recent opponents for all teams
  const recentOpponentsMap = new Map<number, number[]>();
  await Promise.all(
    teams.map(async team => {
      const opponents = await getRecentOpponents(team.id);
      recentOpponentsMap.set(team.id, opponents);
    })
  );

  // Pair teams using greedy algorithm
  while (availableTeams.length > 1) {
    const team1 = availableTeams.shift()!;
    const opponent = await findBestOpponent(team1, availableTeams, combinedELOMap, recentOpponentsMap);

    if (opponent) {
      // Remove opponent from available pool
      const opponentIndex = availableTeams.indexOf(opponent);
      availableTeams.splice(opponentIndex, 1);

      // Create match pair
      matches.push({
        team1,
        team2: opponent,
        isByeMatch: false,
        tagTeamLeague: team1.tagTeamLeague,
      });
    } else {
      // No suitable opponent found, put team back for bye-match
      availableTeams.push(team1);
      break;
    }
  }

  // Handle odd team with bye-match (Requirement 2.5)
  if (availableTeams.length === 1) {
    const lastTeam = availableTeams[0];
    const byeTeam = createByeTeam(lastTeam.tagTeamLeague, lastTeam.tagTeamLeagueId);

    matches.push({
      team1: lastTeam,
      team2: byeTeam,
      isByeMatch: true,
      tagTeamLeague: lastTeam.tagTeamLeague,
    });

    console.log(`[TagTeamMatchmaking] Bye-match created for team ${lastTeam.id}`);
  }

  return matches;
}

/**
 * Schedule matches in the database
 * Requirement 2.7: Create TagTeamMatch records with scheduledFor timestamp
 */
export async function scheduleMatches(matches: TagTeamMatchPair[], scheduledFor: Date): Promise<void> {
  // Separate bye-matches from regular matches
  const regularMatches = matches.filter(m => !m.isByeMatch);
  const byeMatches = matches.filter(m => m.isByeMatch);

  // Create regular matches using createMany
  if (regularMatches.length > 0) {
    const regularMatchData = regularMatches.map(match => ({
      team1Id: match.team1.id,
      team2Id: match.team2.id,
      tagTeamLeague: match.tagTeamLeague,
      scheduledFor,
      status: 'scheduled' as const,
    }));

    await prisma.tagTeamMatch.createMany({
      data: regularMatchData,
    });
  }

  // Create bye-matches individually (team2Id = null for bye-team)
  for (const match of byeMatches) {
    await prisma.tagTeamMatch.create({
      data: {
        team1Id: match.team1.id,
        team2Id: null, // Bye-team (no actual team2)
        tagTeamLeague: match.tagTeamLeague,
        scheduledFor,
        status: 'scheduled',
      },
    });
  }

  console.log(`[TagTeamMatchmaking] Scheduled ${matches.length} tag team matches`);
}

/**
 * Run tag team matchmaking for all league tiers
 * Requirements 2.7, 2.8: Run on odd cycles only (checked by caller)
 * Requirement 11.1: Allow robots to be scheduled for both 1v1 and tag team matches
 *
 * @param scheduledFor - When the matches should be executed
 * @returns Total number of matches created
 */
export async function runTagTeamMatchmaking(scheduledFor?: Date): Promise<number> {
  const matchTime = scheduledFor || new Date(Date.now() + 24 * 60 * 60 * 1000); // Default: 24 hours from now
  const TAG_TEAM_LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];

  let totalMatches = 0;

  console.log('[TagTeamMatchmaking] Starting tag team matchmaking for all tiers...');

  for (const tier of TAG_TEAM_LEAGUE_TIERS) {
    try {
      // Get all league instances for this tier
      const instances = await prisma.tagTeam.findMany({
        where: { tagTeamLeague: tier },
        select: { tagTeamLeagueId: true },
        distinct: ['tagTeamLeagueId'],
      });

      const instanceIds = instances.map(i => i.tagTeamLeagueId);

      for (const instanceId of instanceIds) {
        // Get eligible teams for this instance
        const eligibleTeams = await getEligibleTeams(tier, instanceId);

        if (eligibleTeams.length < 1) {
          console.log(`[TagTeamMatchmaking] ${instanceId}: No eligible teams, skipping`);
          continue;
        }

        // Pair teams
        const matches = await pairTeams(eligibleTeams);

        if (matches.length > 0) {
          // Schedule matches
          await scheduleMatches(matches, matchTime);
          totalMatches += matches.length;

          console.log(`[TagTeamMatchmaking] ${instanceId}: Created ${matches.length} matches`);
        }
      }
    } catch (error) {
      console.error(`[TagTeamMatchmaking] Error in ${tier} tier:`, error);
    }
  }

  console.log(`[TagTeamMatchmaking] Complete: ${totalMatches} total matches created`);
  return totalMatches;
}

