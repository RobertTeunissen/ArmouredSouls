/**
 * Tournament Service
 * Handles tournament creation, bracket generation, and progression logic
 */

import { PrismaClient, Robot, Tournament, TournamentMatch } from '@prisma/client';
import { checkBattleReadiness } from './matchmakingService';

const prisma = new PrismaClient();

// Tournament configuration constants
const MIN_TOURNAMENT_PARTICIPANTS = 4; // Minimum robots needed to start a tournament
const AUTO_START_THRESHOLD = 8; // Minimum robots for auto-tournament creation

export interface TournamentCreationResult {
  tournament: Tournament;
  bracket: TournamentMatch[];
  participantCount: number;
}

export interface RoundExecutionSummary {
  tournamentId: number;
  round: number;
  matchesExecuted: number;
  matchesFailed: number;
  byeMatches: number;
  winners: number[];
  errors: string[];
  tournamentComplete: boolean;
  championRobotId?: number;
}

/**
 * Calculate maximum rounds needed for a tournament
 * Formula: ceil(log2(participants))
 */
function calculateMaxRounds(participants: number): number {
  return Math.ceil(Math.log2(participants));
}

/**
 * Get robots eligible for tournament participation
 * Robots CAN participate in multiple active tournaments simultaneously
 * 
 * Excludes:
 * - Bye robot
 * - Robots not battle-ready (< 75% HP, missing weapons)
 */
export async function getEligibleRobotsForTournament(): Promise<Robot[]> {
  // Get all robots except bye robot
  const allRobots = await prisma.robot.findMany({
    where: {
      NOT: {
        name: 'Bye Robot',
      },
    },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  // Filter for battle-ready robots
  const battleReadyRobots = allRobots.filter(robot => {
    const readiness = checkBattleReadiness(robot);
    return readiness.isReady;
  });

  return battleReadyRobots;
}

/**
 * Seed robots by ELO rating (highest to lowest)
 * Used for fair bracket generation
 */
function seedRobotsByELO(robots: Robot[]): Robot[] {
  return [...robots].sort((a, b) => b.elo - a.elo);
}

/**
 * Generate bracket pairs for single elimination tournament
 * Uses traditional seeding: #1 vs #last, #2 vs #second-to-last, etc.
 * Handles odd participant counts with bye matches for highest seeds
 */
function generateBracketPairs(seededRobots: Robot[], maxRounds: number): TournamentMatch[] {
  const matches: TournamentMatch[] = [];
  const bracketSize = Math.pow(2, maxRounds); // Next power of 2
  const byeCount = bracketSize - seededRobots.length;
  
  let matchNumber = 1;
  let robot1Index = 0;
  let robot2Index = seededRobots.length - 1;

  // Create first round matches
  while (robot1Index <= robot2Index) {
    const robot1 = seededRobots[robot1Index];
    
    // Check if this seed gets a bye
    const isByeMatch = robot1Index < byeCount;
    
    if (isByeMatch) {
      // Bye match: robot advances without opponent
      matches.push({
        id: 0, // Will be set by database
        tournamentId: 0, // Will be set when creating
        round: 1,
        matchNumber: matchNumber++,
        robot1Id: robot1.id,
        robot2Id: null,
        winnerId: null, // Will be set to robot1Id immediately
        battleId: null,
        status: 'pending',
        isByeMatch: true,
        createdAt: new Date(),
        completedAt: null,
      });
      robot1Index++;
    } else {
      // Normal match: robot1 vs robot2
      const robot2 = seededRobots[robot2Index];
      matches.push({
        id: 0,
        tournamentId: 0,
        round: 1,
        matchNumber: matchNumber++,
        robot1Id: robot1.id,
        robot2Id: robot2.id,
        winnerId: null,
        battleId: null,
        status: 'pending',
        isByeMatch: false,
        createdAt: new Date(),
        completedAt: null,
      });
      robot1Index++;
      robot2Index--;
    }
  }

  // Create placeholder matches for future rounds
  for (let round = 2; round <= maxRounds; round++) {
    const matchesInRound = Math.pow(2, maxRounds - round);
    
    for (let i = 1; i <= matchesInRound; i++) {
      matches.push({
        id: 0,
        tournamentId: 0,
        round,
        matchNumber: i,
        robot1Id: null, // Will be populated when previous round completes
        robot2Id: null,
        winnerId: null,
        battleId: null,
        status: 'pending',
        isByeMatch: false,
        createdAt: new Date(),
        completedAt: null,
      });
    }
  }

  return matches;
}

/**
 * Create a new single elimination tournament
 * Returns tournament with generated bracket
 * All eligible robots participate (can be in multiple tournaments)
 */
export async function createSingleEliminationTournament(): Promise<TournamentCreationResult> {
  // Get eligible robots
  const eligibleRobots = await getEligibleRobotsForTournament();

  if (eligibleRobots.length < MIN_TOURNAMENT_PARTICIPANTS) {
    throw new Error(
      `Insufficient participants for tournament. Need at least ${MIN_TOURNAMENT_PARTICIPANTS}, found ${eligibleRobots.length}`
    );
  }

  // Seed robots by ELO
  const seededRobots = seedRobotsByELO(eligibleRobots);
  
  // Calculate rounds
  const maxRounds = calculateMaxRounds(seededRobots.length);
  
  // Generate bracket
  const bracketTemplate = generateBracketPairs(seededRobots, maxRounds);
  
  // Get tournament count for naming
  const tournamentCount = await prisma.tournament.count();
  const tournamentName = `Tournament #${tournamentCount + 1}`;

  // Create tournament record
  const tournament = await prisma.tournament.create({
    data: {
      name: tournamentName,
      tournamentType: 'single_elimination',
      status: 'pending',
      currentRound: 1,
      maxRounds,
      totalParticipants: seededRobots.length,
      startedAt: null,
      completedAt: null,
      winnerId: null,
    },
  });

  // Create tournament matches with tournament ID
  const bracketData = bracketTemplate.map(match => ({
    tournamentId: tournament.id,
    round: match.round,
    matchNumber: match.matchNumber,
    robot1Id: match.robot1Id,
    robot2Id: match.robot2Id,
    winnerId: match.winnerId,
    battleId: match.battleId,
    status: match.status,
    isByeMatch: match.isByeMatch,
  }));

  await prisma.tournamentMatch.createMany({
    data: bracketData,
  });

  // Fetch created matches for return
  const bracket = await prisma.tournamentMatch.findMany({
    where: { tournamentId: tournament.id },
    orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
  });

  // Automatically complete bye matches
  const byeMatches = bracket.filter(match => match.isByeMatch && match.round === 1);
  for (const byeMatch of byeMatches) {
    await prisma.tournamentMatch.update({
      where: { id: byeMatch.id },
      data: {
        winnerId: byeMatch.robot1Id,
        status: 'completed',
        completedAt: new Date(),
      },
    });
  }

  // Set tournament to active
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: {
      status: 'active',
      startedAt: new Date(),
    },
  });

  console.log(`[Tournament] Created ${tournamentName} with ${seededRobots.length} participants (${maxRounds} rounds)`);

  return {
    tournament,
    bracket,
    participantCount: seededRobots.length,
  };
}

/**
 * Get active tournaments
 */
export async function getActiveTournaments(): Promise<Tournament[]> {
  return prisma.tournament.findMany({
    where: {
      status: { in: ['pending', 'active'] },
    },
    include: {
      winner: true,
      matches: {
        orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
      },
    },
  });
}

/**
 * Get tournament by ID with all matches
 */
export async function getTournamentById(tournamentId: number): Promise<Tournament | null> {
  return prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      winner: true,
      matches: {
        orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
        include: {
          robot1: true,
          robot2: true,
          winner: true,
          battle: true,
        },
      },
    },
  });
}

/**
 * Get current round matches for a tournament
 */
export async function getCurrentRoundMatches(tournamentId: number): Promise<TournamentMatch[]> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`);
  }

  return prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      round: tournament.currentRound,
      status: { in: ['pending', 'scheduled'] },
    },
    include: {
      robot1: true,
      robot2: true,
    },
  });
}

/**
 * Advance winners to next round
 * Populates next round matches with winners from current round
 */
export async function advanceWinnersToNextRound(tournamentId: number): Promise<void> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`);
  }

  // Get completed matches from current round
  const currentRoundMatches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      round: tournament.currentRound,
      status: 'completed',
    },
    orderBy: { matchNumber: 'asc' },
  });

  // Check if all matches in current round are completed
  const allMatches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      round: tournament.currentRound,
    },
  });

  const allCompleted = allMatches.every(match => match.status === 'completed');
  if (!allCompleted) {
    console.log(`[Tournament] Round ${tournament.currentRound} not yet complete. Waiting for all matches.`);
    return;
  }

  // Extract winners
  const winners = currentRoundMatches
    .filter(match => match.winnerId !== null)
    .map(match => match.winnerId as number);

  if (winners.length === 0) {
    throw new Error(`No winners found in round ${tournament.currentRound}`);
  }

  // If only one winner, tournament is complete
  if (winners.length === 1) {
    await completeTournament(tournamentId, winners[0]);
    return;
  }

  // Get next round placeholder matches
  const nextRound = tournament.currentRound + 1;
  const nextRoundMatches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      round: nextRound,
    },
    orderBy: { matchNumber: 'asc' },
  });

  // Populate next round matches with winners
  // Winners are paired: match 1 & 2 → next match 1, match 3 & 4 → next match 2, etc.
  for (let i = 0; i < nextRoundMatches.length; i++) {
    const robot1Id = winners[i * 2];
    const robot2Id = winners[i * 2 + 1] || null; // Handle odd number of winners (shouldn't happen in single elimination)

    await prisma.tournamentMatch.update({
      where: { id: nextRoundMatches[i].id },
      data: {
        robot1Id,
        robot2Id,
        status: 'pending',
      },
    });
  }

  // Advance to next round
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      currentRound: nextRound,
    },
  });

  console.log(`[Tournament] Advanced to round ${nextRound} with ${winners.length} winners`);
}

/**
 * Complete tournament and award championship
 */
async function completeTournament(tournamentId: number, winnerId: number): Promise<void> {
  // Update tournament status
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      status: 'completed',
      winnerId,
      completedAt: new Date(),
    },
  });

  // Award championship title to winner's user
  const winnerRobot = await prisma.robot.findUnique({
    where: { id: winnerId },
    include: { user: true },
  });

  if (winnerRobot) {
    await prisma.user.update({
      where: { id: winnerRobot.userId },
      data: {
        championshipTitles: { increment: 1 },
      },
    });

    console.log(`[Tournament] Tournament ${tournamentId} completed! Winner: ${winnerRobot.name} (User: ${winnerRobot.user.username})`);
    console.log(`[Tournament] Championship title awarded to ${winnerRobot.user.username} (total: ${winnerRobot.user.championshipTitles + 1})`);
  }
}

/**
 * Check if a new tournament should be auto-created
 * Creates tournament if:
 * - No active tournaments exist
 * - Sufficient eligible robots (≥ AUTO_START_THRESHOLD)
 */
export async function autoCreateNextTournament(): Promise<Tournament | null> {
  // Check for active tournaments
  const activeTournaments = await getActiveTournaments();
  if (activeTournaments.length > 0) {
    console.log(`[Tournament] Active tournament exists. Skipping auto-creation.`);
    return null;
  }

  // Check for eligible robots
  const eligibleRobots = await getEligibleRobotsForTournament();
  if (eligibleRobots.length < AUTO_START_THRESHOLD) {
    console.log(`[Tournament] Insufficient robots for auto-tournament (${eligibleRobots.length}/${AUTO_START_THRESHOLD})`);
    return null;
  }

  console.log(`[Tournament] Auto-creating tournament with ${eligibleRobots.length} eligible robots`);
  const result = await createSingleEliminationTournament();
  return result.tournament;
}
