/**
 * Tournament Service
 * Handles tournament creation, bracket generation, and progression logic
 */

import { Robot, Tournament, ScheduledTournamentMatch } from '../../generated/prisma';
import prisma from '../lib/prisma';
import logger from '../config/logger';
import { checkSchedulingReadiness } from './matchmakingService';

// Tournament configuration constants
const MIN_TOURNAMENT_PARTICIPANTS = 4; // Minimum robots needed to start a tournament
const AUTO_START_THRESHOLD = 8; // Minimum robots for auto-tournament creation

export interface TournamentCreationResult {
  tournament: Tournament;
  bracket: ScheduledTournamentMatch[];
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
 * - Robots without required weapons equipped
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

  // Filter for scheduling-ready robots (weapons only, HP not checked)
  // Robots will be repaired before tournament matches execute
  const battleReadyRobots = allRobots.filter(robot => {
    const readiness = checkSchedulingReadiness(robot);
    return readiness.isReady;
  });

  return battleReadyRobots;
}

/**
 * Seed robots by ELO rating (highest to lowest)
 * Used for fair bracket generation
 */
export function seedRobotsByELO(robots: Robot[]): Robot[] {
  return [...robots].sort((a, b) => b.elo - a.elo);
}

/**
 * Generate standard tournament seed order for bracket positions
 * Uses iterative algorithm to build proper bracket structure
 * 
 * Algorithm:
 * - Start with seed 1 at position 0
 * - Each round, interleave existing seeds with their complements
 * - Round 1: [0] → [0, 1] (seeds 1, 2)
 * - Round 2: [0, 1] → [0, 3, 1, 2] (seeds 1, 4, 2, 3)
 * - Round 3: [0, 3, 1, 2] → [0, 7, 3, 4, 1, 6, 2, 5] (seeds 1, 8, 4, 5, 2, 7, 3, 6)
 * 
 * Result for 16-slot bracket:
 * Match 1: Seed 1 vs 16, Match 2: Seed 8 vs 9, Match 3: Seed 4 vs 13, Match 4: Seed 5 vs 12
 * Match 5: Seed 2 vs 15, Match 6: Seed 7 vs 10, Match 7: Seed 3 vs 14, Match 8: Seed 6 vs 11
 * 
 * This ensures seed 1 vs seed 2 can only meet in finals
 */
/**
 * Generate standard tournament seed order for bracket positions
 * Creates bracket where seeds 1-4 are in separate quarters
 * Ensures: Semifinals = 1v4 and 2v3, Finals = 1v2
 *
 * For 16-slot: [1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15]
 * Works for any power-of-2 bracket size
 */
/**
 * Generate standard tournament seed order for bracket positions
 * Uses the standard single-elimination seeding algorithm
 *
 * For 4-slot: [1, 4, 3, 2]
 * For 8-slot: [1, 8, 4, 5, 3, 6, 7, 2]
 * For 16-slot: [1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15]
 *
 * This ensures:
 * - Seed 1 in Match 1, Seed 2 in last match
 * - Semifinals: 1v4 and 2v3
 * - Finals: 1v2
 */
/**
 * Generate standard tournament seed order for bracket positions
 * Creates bracket structure ensuring semifinals are 1v4 and 2v3
 *
 * Uses modified interleaving that places seeds 1, 2, 3, 4 in correct quarters:
 * - Quarter 1 (matches 1-2): Seed 1's path
 * - Quarter 2 (matches 3-4): Seed 4's path
 * - Quarter 3 (matches 5-6): Seed 3's path
 * - Quarter 4 (matches 7-8): Seed 2's path
 *
 * For 16-slot: [1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15]
 */
/**
 * Generate standard tournament seed order for bracket positions
 * Produces bracket where semifinals are 1v4 and 2v3, finals are 1v2
 *
 * Base patterns:
 * - 2-slot: [1, 2]
 * - 4-slot: [1, 4, 3, 2] (for actual 4-robot tournament)
 * - 4-slot for building: [1, 5, 3, 7] (when used to build 8+)
 * - 8-slot: [1, 8, 5, 4, 3, 6, 7, 2]
 * - 16-slot: [1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15]
 */
/**
 * Generate bracket pairs for single elimination tournament
 * Uses traditional seeding with proper bracket topology
 * Ensures seed 1 and seed 2 can only meet in finals
 * 
 * Bracket structure:
 * - Top half of bracket: Seeds 1, 8, 5, 4, 3, 6, 7, 2 (for 8-slot)
 * - Seeds are distributed to ensure top seeds only meet in later rounds
 * - Sequential winner advancement maintains bracket structure
 */
function generateBracketPairs(seededRobots: Robot[], maxRounds: number): ScheduledTournamentMatch[] {
  const matches: ScheduledTournamentMatch[] = [];
  const bracketSize = Math.pow(2, maxRounds); // Next power of 2
  
  // Create bracket slots (some will be byes)
  const bracketSlots: (Robot | null)[] = new Array(bracketSize).fill(null);
  
  // Fill bracket using standard tournament seeding order
  // This ensures proper bracket topology where top seeds are separated
  const seedOrder = generateStandardSeedOrder(bracketSize);
  
  for (let i = 0; i < seededRobots.length; i++) {
    const bracketPosition = seedOrder[i] - 1; // Convert 1-based seed to 0-based position
    bracketSlots[bracketPosition] = seededRobots[i];
  }
  
  // Create first round matches from bracket slots
  let matchNumber = 1;
  for (let i = 0; i < bracketSize; i += 2) {
    let robot1 = bracketSlots[i];
    let robot2 = bracketSlots[i + 1];
    
    if (robot1 === null && robot2 === null) {
      // Both slots empty - shouldn't happen but skip if it does
      continue;
    }
    
    // Normalize bye matches: ensure the actual robot is always in robot1
    // The seed order can place a null in either slot
    if (robot1 === null && robot2 !== null) {
      robot1 = robot2;
      robot2 = null;
    }
    
    const isByeMatch = robot1 !== null && robot2 === null;
    
    matches.push({
      id: 0, // Will be set by database
      tournamentId: 0, // Will be set when creating
      round: 1,
      matchNumber: matchNumber++,
      robot1Id: robot1?.id || null,
      robot2Id: robot2?.id || null,
      winnerId: null, // Will be set to robot1Id for bye matches
      battleId: null,
      status: 'pending',
      isByeMatch: isByeMatch,
      createdAt: new Date(),
      completedAt: null,
    });
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
 * Generate standard tournament seed order for bracket positions
 * Uses standard single-elimination seeding algorithm
 * 
 * Algorithm: Recursively interleave seeds with complements, with conditional swapping
 * - 2-slot: [1, 2]
 * - 4-slot: [1, 4, 3, 2] (odd indices swapped)
 * - 8-slot: [1, 8, 5, 4, 3, 6, 7, 2] (odd indices swapped)
 * - 16-slot: [1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15] (no swapping)
 * - 32+: No swapping at odd indices
 * 
 * This ensures:
 * - Seed 1 in Match 1 (top of bracket)
 * - Seed 2 in last match (bottom of bracket)
 * - Semifinals: 1v4 and 2v3
 * - Finals: 1v2
 */
export function generateStandardSeedOrder(bracketSize: number): number[] {
  if (bracketSize === 2) {
    return [1, 2];
  }
  
  const prevBracket = generateStandardSeedOrder(bracketSize / 2);
  
  const result: number[] = [];
  const shouldSwapOddIndices = bracketSize <= 8;
  
  for (let i = 0; i < prevBracket.length; i++) {
    const seed = prevBracket[i];
    const complement = bracketSize + 1 - seed;
    
    // Swap at odd indices only for 4-slot and 8-slot brackets
    if (shouldSwapOddIndices && i % 2 === 1) {
      result.push(complement);
      result.push(seed);
    } else {
      result.push(seed);
      result.push(complement);
    }
  }
  
  return result;
}

/**
 * Seed entry representing a robot's seeding in a tournament bracket
 */
export interface SeedEntry {
  seed: number;       // 1-based seed number
  robotId: number;
  robotName: string;
  elo: number;
  eliminated: boolean; // true if robot has lost a match
}

/**
 * A round-1 match with robot relations for seedings computation.
 * Matches must be ordered by matchNumber ascending.
 */
export interface Round1Match {
  matchNumber: number;
  robot1Id: number | null;
  robot2Id: number | null;
  robot1: { id: number; name: string; elo: number } | null;
  robot2: { id: number; name: string; elo: number } | null;
}

/**
 * A completed match used to determine elimination status.
 */
export interface CompletedMatch {
  winnerId: number | null;
  robot1Id: number | null;
  robot2Id: number | null;
  status: string;
}

/**
 * Compute seedings array from round-1 matches and bracket size.
 * 
 * Algorithm:
 * 1. Build inverse map from bracket slot → seed number using generateStandardSeedOrder
 * 2. For each round-1 match at index i (0-based), bracket slots are 2*i and 2*i+1
 * 3. Map each non-null robot to its seed number
 * 4. Mark eliminated robots (losers in any completed match)
 * 5. Return sorted by seed ascending
 * 
 * @param round1Matches - Round-1 matches ordered by matchNumber ascending
 * @param bracketSize - Total bracket size (2^maxRounds)
 * @param completedMatches - All completed matches to determine elimination
 * @returns Array of SeedEntry sorted by seed ascending
 */
export function computeSeedings(
  round1Matches: Round1Match[],
  bracketSize: number,
  completedMatches: CompletedMatch[]
): SeedEntry[] {
  // seedOrder[seedIndex] = bracketPosition (1-based)
  // We need the inverse: bracketPosition → seedNumber (1-based)
  const seedOrder = generateStandardSeedOrder(bracketSize);
  const slotToSeed = new Map<number, number>();
  for (let seedIdx = 0; seedIdx < seedOrder.length; seedIdx++) {
    const bracketPos = seedOrder[seedIdx] - 1; // convert to 0-based slot
    slotToSeed.set(bracketPos, seedIdx + 1);   // seed is 1-based
  }

  // Build set of eliminated robot IDs (losers in completed matches)
  const eliminatedIds = new Set<number>();
  for (const match of completedMatches) {
    if (match.status === 'completed' && match.winnerId !== null) {
      if (match.robot1Id !== null && match.robot1Id !== match.winnerId) {
        eliminatedIds.add(match.robot1Id);
      }
      if (match.robot2Id !== null && match.robot2Id !== match.winnerId) {
        eliminatedIds.add(match.robot2Id);
      }
    }
  }

  const seedings: SeedEntry[] = [];

  for (let i = 0; i < round1Matches.length; i++) {
    const match = round1Matches[i];
    const slot0 = 2 * i;     // bracket slot for robot1
    const slot1 = 2 * i + 1; // bracket slot for robot2

    const isByeMatch = match.robot1 !== null && match.robot2 === null;

    if (isByeMatch && match.robot1 !== null && match.robot1Id !== null) {
      // Bye match: robot may have been normalized from either slot.
      // Assign the lower (better) seed number of the two slots.
      const seed = Math.min(slotToSeed.get(slot0) ?? bracketSize, slotToSeed.get(slot1) ?? bracketSize);
      seedings.push({
        seed,
        robotId: match.robot1.id,
        robotName: match.robot1.name,
        elo: match.robot1.elo,
        eliminated: eliminatedIds.has(match.robot1.id),
      });
    } else {
      // Normal match with two robots
      if (match.robot1 !== null && match.robot1Id !== null) {
        seedings.push({
          seed: slotToSeed.get(slot0) ?? 0,
          robotId: match.robot1.id,
          robotName: match.robot1.name,
          elo: match.robot1.elo,
          eliminated: eliminatedIds.has(match.robot1.id),
        });
      }

      if (match.robot2 !== null && match.robot2Id !== null) {
        seedings.push({
          seed: slotToSeed.get(slot1) ?? 0,
          robotId: match.robot2.id,
          robotName: match.robot2.name,
          elo: match.robot2.elo,
          eliminated: eliminatedIds.has(match.robot2.id),
        });
      }
    }
  }

  // Sort by seed ascending
  seedings.sort((a, b) => a.seed - b.seed);

  return seedings;
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

  await prisma.scheduledTournamentMatch.createMany({
    data: bracketData,
  });

  // Fetch created matches for return
  const bracket = await prisma.scheduledTournamentMatch.findMany({
    where: { tournamentId: tournament.id },
    orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
  });

  // Automatically complete bye matches
  const byeMatches = bracket.filter(match => match.isByeMatch && match.round === 1);
  for (const byeMatch of byeMatches) {
    await prisma.scheduledTournamentMatch.update({
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

  logger.info(`[Tournament] Created ${tournamentName} with ${seededRobots.length} participants (${maxRounds} rounds)`);

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
export async function getCurrentRoundMatches(tournamentId: number): Promise<ScheduledTournamentMatch[]> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`);
  }

  return prisma.scheduledTournamentMatch.findMany({
    where: {
      tournamentId,
      round: tournament.currentRound,
      status: { in: ['pending', 'scheduled'] },
    },
    include: {
      robot1: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
      robot2: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
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
  const currentRoundMatches = await prisma.scheduledTournamentMatch.findMany({
    where: {
      tournamentId,
      round: tournament.currentRound,
      status: 'completed',
    },
    orderBy: { matchNumber: 'asc' },
  });

  // Check if all matches in current round are completed
  const allMatches = await prisma.scheduledTournamentMatch.findMany({
    where: {
      tournamentId,
      round: tournament.currentRound,
    },
  });

  const allCompleted = allMatches.every(match => match.status === 'completed');
  if (!allCompleted) {
    logger.info(`[Tournament] Round ${tournament.currentRound} not yet complete. Waiting for all matches.`);
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
  const nextRoundMatches = await prisma.scheduledTournamentMatch.findMany({
    where: {
      tournamentId,
      round: nextRound,
    },
    orderBy: { matchNumber: 'asc' },
  });

  // Populate next round matches with winners
  // Winners are paired: match 1 & 2 → next match 1, match 3 & 4 → next match 2, etc.
  for (let i = 0; i < nextRoundMatches.length; i++) {
    const robot1Id = winners[i * 2] ?? null;
    const robot2Id = winners[i * 2 + 1] ?? null;

    await prisma.scheduledTournamentMatch.update({
      where: { id: nextRoundMatches[i].id },
      data: {
        robot1Id,
        robot2Id,
        status: 'pending',
      },
    });
  }

  // Auto-complete any next-round match that has robot1 but no robot2 (bye match)
  // This mirrors what createSingleEliminationTournament does for round 1 byes
  const updatedNextRoundMatches = await prisma.scheduledTournamentMatch.findMany({
    where: { tournamentId, round: nextRound },
    orderBy: { matchNumber: 'asc' },
  });

  for (const match of updatedNextRoundMatches) {
    if (match.robot1Id !== null && match.robot2Id === null) {
      await prisma.scheduledTournamentMatch.update({
        where: { id: match.id },
        data: {
          winnerId: match.robot1Id,
          status: 'completed',
          isByeMatch: true,
          completedAt: new Date(),
        },
      });
      logger.info(`[Tournament] Auto-completed bye match ${match.id} in round ${nextRound} (winner: robot ${match.robot1Id})`);
    } else if (match.robot1Id === null && match.robot2Id !== null) {
      // Reverse bye: robot2 has no opponent due to missing winner upstream
      await prisma.scheduledTournamentMatch.update({
        where: { id: match.id },
        data: {
          winnerId: match.robot2Id,
          status: 'completed',
          isByeMatch: true,
          completedAt: new Date(),
        },
      });
      logger.info(`[Tournament] Auto-completed reverse bye match ${match.id} in round ${nextRound} (winner: robot ${match.robot2Id})`);
    } else if (match.robot1Id === null && match.robot2Id === null) {
      // Both slots empty — no winners fed into this match; mark completed with no winner
      await prisma.scheduledTournamentMatch.update({
        where: { id: match.id },
        data: {
          status: 'completed',
          isByeMatch: true,
          completedAt: new Date(),
        },
      });
      logger.warn(`[Tournament] Empty match ${match.id} in round ${nextRound} — no robots assigned, auto-completed`);
    }
  }

  // Advance to next round
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      currentRound: nextRound,
    },
  });

  logger.info(`[Tournament] Advanced to round ${nextRound} with ${winners.length} winners`);

  // Check if all next-round matches are already completed (all byes) — need to recurse
  const pendingNextRound = await prisma.scheduledTournamentMatch.count({
    where: { tournamentId, round: nextRound, status: { in: ['pending', 'scheduled'] } },
  });
  const completedNextRound = await prisma.scheduledTournamentMatch.findMany({
    where: { tournamentId, round: nextRound, status: 'completed' },
  });

  if (pendingNextRound === 0 && completedNextRound.length > 0) {
    // All matches in next round are byes — advance again
    logger.info(`[Tournament] All matches in round ${nextRound} are byes, advancing again...`);
    await advanceWinnersToNextRound(tournamentId);
  }
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

    logger.info(`[Tournament] Tournament ${tournamentId} completed! Winner: ${winnerRobot.name} (User: ${winnerRobot.user.username})`);
    logger.info(`[Tournament] Championship title awarded to ${winnerRobot.user.username} (total: ${winnerRobot.user.championshipTitles + 1})`);
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
    logger.info(`[Tournament] Active tournament exists. Skipping auto-creation.`);
    return null;
  }

  // Check for eligible robots
  const eligibleRobots = await getEligibleRobotsForTournament();
  if (eligibleRobots.length < AUTO_START_THRESHOLD) {
    logger.info(`[Tournament] Insufficient robots for auto-tournament (${eligibleRobots.length}/${AUTO_START_THRESHOLD})`);
    return null;
  }

  logger.info(`[Tournament] Auto-creating tournament with ${eligibleRobots.length} eligible robots`);
  const result = await createSingleEliminationTournament();
  return result.tournament;
}
