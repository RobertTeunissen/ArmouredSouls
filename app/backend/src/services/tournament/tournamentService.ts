/**
 * Tournament Service
 * Handles tournament creation, bracket generation, and progression logic
 */

import { Robot, Tournament, ScheduledTournamentMatch } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { checkSchedulingReadiness } from '../analytics/matchmakingService';
import { TournamentError, TournamentErrorCode } from '../../errors/tournamentErrors';
import { ParticipantType } from './tournamentParticipantResolver';

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

  // Activate pending subscriptions for robots that have room under cap
  const { batchActivatePendingSubscriptions } = await import('../subscription/subscriptionService');
  await batchActivatePendingSubscriptions(battleReadyRobots.map(r => r.id), 'tournament_1v1');

  // Filter by tournament subscription — only active subscriptions (batch query for efficiency)
  const subscribedRobotIds = await prisma.subscription.findMany({
    where: { eventType: 'tournament_1v1', robotId: { in: battleReadyRobots.map(r => r.id) }, status: 'active' },
    select: { robotId: true },
  });
  const subscribedSet = new Set(subscribedRobotIds.map(s => s.robotId));
  const eligibleRobots = battleReadyRobots.filter(r => subscribedSet.has(r.id));

  const excludedBySubscription = battleReadyRobots.length - eligibleRobots.length;
  if (excludedBySubscription > 0) {
    logger.info(`[Tournament] Excluded ${excludedBySubscription} robots without tournament subscription`);
  }

  return eligibleRobots;
}

/**
 * Seed robots by ELO rating (highest to lowest)
 * Used for fair bracket generation
 */
export function seedRobotsByELO(robots: Robot[]): Robot[] {
  return [...robots].sort((a, b) => b.elo - a.elo);
}

// ─── Entity-Agnostic Tournament Interfaces ───────────────────────────────────

/**
 * Generic tournament participant used for entity-agnostic bracket generation.
 * Both robots and teams can be represented as TournamentParticipant.
 */
export interface TournamentParticipant {
  id: number;
  displayName: string;
  elo: number;
  createdAt: Date;
}

/**
 * Options for creating an entity-agnostic tournament.
 */
export interface CreateTournamentOptions {
  participantType: ParticipantType;
  participants: TournamentParticipant[];
  namePrefix?: string; // "Tournament", "2v2 Tournament", "3v3 Tournament"
}

/**
 * Seed participants by ELO rating (highest to lowest).
 * Tie-break: older participant first (earlier createdAt).
 */
export function seedParticipantsByELO(participants: TournamentParticipant[]): TournamentParticipant[] {
  return [...participants].sort((a, b) => {
    if (b.elo !== a.elo) return b.elo - a.elo;
    return a.createdAt.getTime() - b.createdAt.getTime(); // Older first as tie-breaker
  });
}

/**
 * Generate bracket pairs for single elimination tournament (entity-agnostic).
 * Same algorithm as generateBracketPairs but accepts TournamentParticipant[]
 * and sets participantType on all match records.
 */
function generateBracketPairsGeneric(
  seededParticipants: TournamentParticipant[],
  maxRounds: number,
  participantType: ParticipantType,
): ScheduledTournamentMatch[] {
  const matches: ScheduledTournamentMatch[] = [];
  const bracketSize = Math.pow(2, maxRounds); // Next power of 2

  // Create bracket slots (some will be byes)
  const bracketSlots: (TournamentParticipant | null)[] = new Array(bracketSize).fill(null);

  // Fill bracket using standard tournament seeding order
  const seedOrder = generateStandardSeedOrder(bracketSize);

  for (let i = 0; i < seededParticipants.length; i++) {
    const bracketPosition = seedOrder[i] - 1; // Convert 1-based seed to 0-based position
    bracketSlots[bracketPosition] = seededParticipants[i];
  }

  // Create first round matches from bracket slots
  let matchNumber = 1;
  for (let i = 0; i < bracketSize; i += 2) {
    let p1 = bracketSlots[i];
    let p2 = bracketSlots[i + 1];

    if (p1 === null && p2 === null) {
      // Both slots empty - shouldn't happen but skip if it does
      continue;
    }

    // Normalize bye matches: ensure the actual participant is always in participant1
    if (p1 === null && p2 !== null) {
      p1 = p2;
      p2 = null;
    }

    const isByeMatch = p1 !== null && p2 === null;

    matches.push({
      id: 0, // Will be set by database
      tournamentId: 0, // Will be set when creating
      round: 1,
      matchNumber: matchNumber++,
      participantType,
      participant1Id: p1?.id || null,
      participant2Id: p2?.id || null,
      winnerId: null,
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
        participantType,
        participant1Id: null,
        participant2Id: null,
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
 * Create a new entity-agnostic single-elimination tournament.
 * Handles bracket generation, bye-match auto-completion, sequential naming per type,
 * and sets the tournament to 'active' with startedAt.
 *
 * @param options - participantType, participants array, optional namePrefix
 * @returns Created tournament with bracket and participant count
 */
export async function createTournament(options: CreateTournamentOptions): Promise<TournamentCreationResult> {
  const { participantType, participants, namePrefix } = options;

  if (participants.length < MIN_TOURNAMENT_PARTICIPANTS) {
    throw new TournamentError(
      TournamentErrorCode.INSUFFICIENT_PARTICIPANTS,
      `Insufficient participants for tournament. Need at least ${MIN_TOURNAMENT_PARTICIPANTS}, found ${participants.length}`,
      400,
      { required: MIN_TOURNAMENT_PARTICIPANTS, found: participants.length }
    );
  }

  // Seed by ELO (tie-break by createdAt)
  const seeded = seedParticipantsByELO(participants);

  // Calculate rounds
  const maxRounds = calculateMaxRounds(seeded.length);

  // Generate bracket with participantType
  const bracketTemplate = generateBracketPairsGeneric(seeded, maxRounds, participantType);

  // Sequential naming per type: count existing tournaments of same participantType + 1
  const prefix = namePrefix ?? 'Tournament';
  const tournamentCountForType = await prisma.tournament.count({
    where: { participantType },
  });
  const tournamentName = `${prefix} #${tournamentCountForType + 1}`;

  // Create tournament record with participantType
  const tournament = await prisma.tournament.create({
    data: {
      name: tournamentName,
      tournamentType: 'single_elimination',
      participantType,
      status: 'pending',
      currentRound: 1,
      maxRounds,
      totalParticipants: seeded.length,
      startedAt: null,
      completedAt: null,
      winnerId: null,
    },
  });

  // Create match records — all use same participantType as parent Tournament (R1.10)
  const bracketData = bracketTemplate.map(match => ({
    tournamentId: tournament.id,
    round: match.round,
    matchNumber: match.matchNumber,
    participantType,
    participant1Id: match.participant1Id,
    participant2Id: match.participant2Id,
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

  // Auto-complete bye matches
  const byeMatches = bracket.filter(match => match.isByeMatch && match.round === 1);
  for (const byeMatch of byeMatches) {
    await prisma.scheduledTournamentMatch.update({
      where: { id: byeMatch.id },
      data: {
        winnerId: byeMatch.participant1Id,
        status: 'completed',
        completedAt: new Date(),
      },
    });
  }

  // Set status to 'active', record startedAt
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: {
      status: 'active',
      startedAt: new Date(),
    },
  });

  logger.info(`[Tournament] Created ${tournamentName} with ${seeded.length} participants (${maxRounds} rounds, type: ${participantType})`);

  return {
    tournament,
    bracket,
    participantCount: seeded.length,
  };
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
 *
 * @deprecated Superseded by generateBracketPairsGeneric — retained for reference.
 */
function _generateBracketPairs(seededRobots: Robot[], maxRounds: number): ScheduledTournamentMatch[] {
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
      participantType: 'robot',
      participant1Id: robot1?.id || null,
      participant2Id: robot2?.id || null,
      winnerId: null, // Will be set to participant1Id for bye matches
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
        participantType: 'robot',
        participant1Id: null, // Will be populated when previous round completes
        participant2Id: null,
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
  
  for (let i = 0; i < prevBracket.length; i++) {
    const seed = prevBracket[i];
    const complement = bracketSize + 1 - seed;
    
    // At odd indices, swap seed and complement to maintain proper bracket topology
    // This ensures seed 1 faces seed N, seed 2 faces seed N-1, etc.
    if (i % 2 === 1) {
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
  participant1Id: number | null;
  participant2Id: number | null;
  robot1: { id: number; name: string; elo: number } | null;
  robot2: { id: number; name: string; elo: number } | null;
}

/**
 * A completed match used to determine elimination status.
 */
export interface CompletedMatch {
  winnerId: number | null;
  participant1Id: number | null;
  participant2Id: number | null;
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
      if (match.participant1Id !== null && match.participant1Id !== match.winnerId) {
        eliminatedIds.add(match.participant1Id);
      }
      if (match.participant2Id !== null && match.participant2Id !== match.winnerId) {
        eliminatedIds.add(match.participant2Id);
      }
    }
  }

  const seedings: SeedEntry[] = [];

  for (let i = 0; i < round1Matches.length; i++) {
    const match = round1Matches[i];
    const slot0 = 2 * i;     // bracket slot for participant1
    const slot1 = 2 * i + 1; // bracket slot for participant2

    const isByeMatch = match.robot1 !== null && match.robot2 === null;

    if (isByeMatch && match.robot1 !== null && match.participant1Id !== null) {
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
      if (match.robot1 !== null && match.participant1Id !== null) {
        seedings.push({
          seed: slotToSeed.get(slot0) ?? 0,
          robotId: match.robot1.id,
          robotName: match.robot1.name,
          elo: match.robot1.elo,
          eliminated: eliminatedIds.has(match.robot1.id),
        });
      }

      if (match.robot2 !== null && match.participant2Id !== null) {
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
 * Create a new single elimination tournament (1v1 robots)
 * Thin wrapper around createTournament for backward compatibility.
 * All eligible robots participate (can be in multiple tournaments)
 */
export async function createSingleEliminationTournament(): Promise<TournamentCreationResult> {
  // Get eligible robots
  const eligibleRobots = await getEligibleRobotsForTournament();

  if (eligibleRobots.length < MIN_TOURNAMENT_PARTICIPANTS) {
    throw new TournamentError(
      TournamentErrorCode.INSUFFICIENT_PARTICIPANTS,
      `Insufficient participants for tournament. Need at least ${MIN_TOURNAMENT_PARTICIPANTS}, found ${eligibleRobots.length}`,
      400,
      { required: MIN_TOURNAMENT_PARTICIPANTS, found: eligibleRobots.length }
    );
  }

  // Map robots to generic TournamentParticipant interface
  const participants: TournamentParticipant[] = eligibleRobots.map(r => ({
    id: r.id,
    displayName: r.name,
    elo: r.elo,
    createdAt: r.createdAt,
  }));

  return createTournament({ participantType: 'robot', participants, namePrefix: '1v1 Tournament' });
}

/**
 * Get active tournaments (1v1 robot tournaments only).
 * Team tournaments are handled by their own dedicated handlers.
 */
export async function getActiveTournaments(): Promise<Tournament[]> {
  return prisma.tournament.findMany({
    where: {
      participantType: 'robot',
      status: { in: ['pending', 'active'] },
    },
    include: {
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
      matches: {
        orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
        include: {
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
    throw new TournamentError(
      TournamentErrorCode.TOURNAMENT_NOT_FOUND,
      `Tournament ${tournamentId} not found`,
      404,
      { tournamentId }
    );
  }

  return prisma.scheduledTournamentMatch.findMany({
    where: {
      tournamentId,
      round: tournament.currentRound,
      status: { in: ['pending', 'scheduled'] },
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          participantType: true,
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
    throw new TournamentError(
      TournamentErrorCode.TOURNAMENT_NOT_FOUND,
      `Tournament ${tournamentId} not found`,
      404,
      { tournamentId }
    );
  }

  // Get completed matches from current round
  const currentRoundMatches = await prisma.scheduledTournamentMatch.findMany({
    where: {
      tournamentId,
      round: tournament.currentRound,
      status: { in: ['completed', 'forfeit'] },
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

  const allCompleted = allMatches.every(match => match.status === 'completed' || match.status === 'forfeit');
  if (!allCompleted) {
    logger.info(`[Tournament] Round ${tournament.currentRound} not yet complete. Waiting for all matches.`);
    return;
  }

  // Extract winners
  const winners = currentRoundMatches
    .filter(match => match.winnerId !== null)
    .map(match => match.winnerId as number);

  if (winners.length === 0) {
    throw new TournamentError(
      TournamentErrorCode.ROUND_NOT_READY,
      `No winners found in round ${tournament.currentRound}`,
      400,
      { tournamentId, round: tournament.currentRound }
    );
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
    const participant1Id = winners[i * 2] ?? null;
    const participant2Id = winners[i * 2 + 1] ?? null;

    await prisma.scheduledTournamentMatch.update({
      where: { id: nextRoundMatches[i].id },
      data: {
        participant1Id,
        participant2Id,
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
    if (match.participant1Id !== null && match.participant2Id === null) {
      await prisma.scheduledTournamentMatch.update({
        where: { id: match.id },
        data: {
          winnerId: match.participant1Id,
          status: 'completed',
          isByeMatch: true,
          completedAt: new Date(),
        },
      });
      logger.info(`[Tournament] Auto-completed bye match ${match.id} in round ${nextRound} (winner: participant ${match.participant1Id})`);
    } else if (match.participant1Id === null && match.participant2Id !== null) {
      // Reverse bye: participant2 has no opponent due to missing winner upstream
      await prisma.scheduledTournamentMatch.update({
        where: { id: match.id },
        data: {
          winnerId: match.participant2Id,
          status: 'completed',
          isByeMatch: true,
          completedAt: new Date(),
        },
      });
      logger.info(`[Tournament] Auto-completed reverse bye match ${match.id} in round ${nextRound} (winner: participant ${match.participant2Id})`);
    } else if (match.participant1Id === null && match.participant2Id === null) {
      // Both slots empty — no winners fed into this match; mark completed with no winner
      await prisma.scheduledTournamentMatch.update({
        where: { id: match.id },
        data: {
          status: 'completed',
          isByeMatch: true,
          completedAt: new Date(),
        },
      });
      logger.warn(`[Tournament] Empty match ${match.id} in round ${nextRound} — no participants assigned, auto-completed`);
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
 * Complete tournament and award championship based on participantType.
 * Awards both the unified championshipTitles counter and the per-type counter.
 */
async function completeTournament(tournamentId: number, winnerId: number): Promise<void> {
  // Fetch tournament to determine participantType
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) {
    throw new TournamentError(
      TournamentErrorCode.TOURNAMENT_NOT_FOUND,
      `Tournament ${tournamentId} not found`,
      404,
      { tournamentId }
    );
  }

  // Update tournament status
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      status: 'completed',
      winnerId,
      completedAt: new Date(),
    },
  });

  // Award championship title based on participantType
  if (tournament.participantType === 'robot') {
    // 1v1 robot tournament — award to robot's owner
    const robot = await prisma.robot.findUnique({
      where: { id: winnerId },
      include: { user: true },
    });

    if (robot) {
      await prisma.user.update({
        where: { id: robot.userId },
        data: {
          championshipTitles: { increment: 1 },
          championshipTitles1v1: { increment: 1 },
        },
      });

      // Fire tournament_complete achievement event for the winner's owner
      try {
        const { achievementService } = await import('../achievement');
        await achievementService.checkAndAward(robot.userId, robot.id, {
          type: 'tournament_complete',
          data: { battleType: 'tournament_1v1' },
        });
      } catch (achievementError) {
        logger.error(`[Tournament] Achievement check failed for tournament ${tournamentId} winner: ${achievementError}`);
      }

      logger.info(`[Tournament] Tournament ${tournamentId} completed! Winner: ${robot.name} (User: ${robot.user.username})`);
      logger.info(`[Tournament] Championship title (1v1) awarded to ${robot.user.username}`);
    }
  } else {
    // Team tournament — award to team's stable owner
    const team = await prisma.teamBattle.findUnique({
      where: { id: winnerId },
      include: { stable: true },
    });

    if (team) {
      const field = tournament.participantType === 'team_2v2' ? 'championshipTitles2v2' : 'championshipTitles3v3';
      await prisma.user.update({
        where: { id: team.stableId },
        data: {
          championshipTitles: { increment: 1 },
          [field]: { increment: 1 },
        },
      });

      // Fire tournament_complete achievement event for the team owner
      try {
        const { achievementService } = await import('../achievement');
        await achievementService.checkAndAward(team.stableId, null, {
          type: 'tournament_complete',
          data: { battleType: tournament.participantType === 'team_2v2' ? 'tournament_2v2' : 'tournament_3v3' },
        });
      } catch (achievementError) {
        logger.error(`[Tournament] Achievement check failed for tournament ${tournamentId} winner: ${achievementError}`);
      }

      logger.info(`[Tournament] Tournament ${tournamentId} completed! Winner: ${team.teamName} (Stable: ${team.stable.stableName || team.stable.username})`);
      logger.info(`[Tournament] Championship title (${tournament.participantType}) awarded to ${team.stable.stableName || team.stable.username}`);
    }
  }

  // Dispatch Discord notification for tournament completion (team tournaments)
  if (tournament.participantType === 'team_2v2' || tournament.participantType === 'team_3v3') {
    try {
      const { dispatchNotification, getActiveIntegrations } = await import('../notifications/notification-service');
      const { getConfig } = await import('../../config/env');
      const appUrl = getConfig().appBaseUrl || 'http://localhost:5173';

      const typeLabel = tournament.participantType === 'team_2v2' ? '2v2' : '3v3';

      // Resolve champion name and owner
      const team = await prisma.teamBattle.findUnique({
        where: { id: winnerId },
        include: { stable: true },
      });
      const robot = await prisma.robot.findUnique({
        where: { id: winnerId },
        include: { user: true },
      });

      const championName = team ? team.teamName : robot ? robot.name : 'Unknown';
      const ownerName = team ? (team.stable.stableName || team.stable.username) : (robot ? robot.user.username : 'Unknown');

      const message = `🏆 ${typeLabel} Tournament Champion: "${championName}" (${ownerName})! [View results](${appUrl}/tournaments/${tournamentId})`;
      await dispatchNotification(message, getActiveIntegrations());
    } catch (notificationError) {
      // R12.4: Log error, don't interrupt tournament completion
      logger.error(`[Tournament] Discord notification failed for tournament ${tournamentId}: ${notificationError}`);
    }
  }
}

/**
 * Check if a new 1v1 tournament should be auto-created
 * Creates tournament if:
 * - No active 1v1 tournaments exist (scoped by participantType: 'robot')
 * - Sufficient eligible robots (≥ AUTO_START_THRESHOLD)
 */
export async function autoCreateNextTournament(): Promise<Tournament | null> {
  // Check for active 1v1 tournaments only (team tournaments have their own handlers)
  const activeTournament = await prisma.tournament.findFirst({
    where: {
      participantType: 'robot',
      status: { in: ['pending', 'active'] },
    },
  });

  if (activeTournament) {
    logger.info(`[Tournament] Active 1v1 tournament exists (${activeTournament.name}). Skipping auto-creation.`);
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
