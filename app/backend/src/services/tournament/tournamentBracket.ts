/**
 * Tournament Bracket and Seeding
 *
 * Pure single-elimination bracket math shared by solo and team tournaments:
 * ELO seeding, the standard seed order, round-1 bracket generation, seed
 * lookup for a participant, positional next-round planning, and the seedings
 * view. No Prisma, no I/O.
 *
 * @module services/tournament/tournamentBracket
 */

import { Robot, ScheduledTournamentMatch } from '../../../generated/prisma';
import { ParticipantType } from './tournamentParticipantResolver';
import type { TournamentParticipant } from './tournamentService';
import type { SeedEntry } from '../../shared/types';


/**
 * Seed robots by ELO rating (highest to lowest)
 * Used for fair bracket generation
 */
export function seedRobotsByELO(robots: Robot[]): Robot[] {
  return [...robots].sort((a, b) => b.elo - a.elo);
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
export function generateBracketPairsGeneric(
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

/** Match statuses that end a bracket match (design §7). */
export const TERMINAL_MATCH_STATUSES: readonly string[] = ['completed', 'forfeit', 'cancelled'];

/** A round-1 row reduced to what seeding needs: no robot objects, so team ids fit too. */
export interface Round1Slot {
  matchNumber: number;
  participant1Id: number | null;
  participant2Id: number | null;
}

/** One next-round match's participants as planned by `planNextRoundSlots`. */
export interface PlannedSlot {
  participant1Id: number | null;
  participant2Id: number | null;
}

/**
 * Inverse of `generateStandardSeedOrder`: 0-based bracket slot → 1-based seed.
 */
function buildSlotToSeed(bracketSize: number): Map<number, number> {
  // seedOrder[seedIndex] = bracketPosition (1-based)
  const seedOrder = generateStandardSeedOrder(bracketSize);
  const slotToSeed = new Map<number, number>();
  for (let seedIdx = 0; seedIdx < seedOrder.length; seedIdx++) {
    slotToSeed.set(seedOrder[seedIdx] - 1, seedIdx + 1);
  }
  return slotToSeed;
}

/**
 * Seed of a participant from the round-1 rows (any order; sorted by matchNumber
 * here). Round-1 match i (0-based) holds bracket slots 2i and 2i+1. A one-sided
 * row is a bye whose participant may have been normalised from either slot, so
 * it takes the better of the two slot seeds, exactly as `computeSeedings` does.
 *
 * @returns the 1-based seed, or null when the participant is not in round 1
 */
export function seedForParticipant(
  round1: Round1Slot[],
  bracketSize: number,
  participantId: number,
): number | null {
  const slotToSeed = buildSlotToSeed(bracketSize);
  const ordered = [...round1].sort((a, b) => a.matchNumber - b.matchNumber);
  for (let i = 0; i < ordered.length; i++) {
    const { participant1Id, participant2Id } = ordered[i];
    const slot0 = 2 * i;
    const slot1 = 2 * i + 1;
    const isBye = (participant1Id === null) !== (participant2Id === null);
    if (isBye && (participant1Id ?? participant2Id) === participantId) {
      return Math.min(slotToSeed.get(slot0) ?? bracketSize, slotToSeed.get(slot1) ?? bracketSize);
    }
    if (participant1Id === participantId) return slotToSeed.get(slot0) ?? null;
    if (participant2Id === participantId) return slotToSeed.get(slot1) ?? null;
  }
  return null;
}

/**
 * Positional next-round planning: the winner of match 2i+1 takes slot 1 and the
 * winner of match 2i+2 takes slot 2 of next-round match i+1. A match without a
 * winner leaves its slot empty, so a gap never shifts a later pairing.
 */
export function planNextRoundSlots(
  currentRound: Array<{ matchNumber: number; winnerId: number | null }>,
  nextRoundCount: number,
): PlannedSlot[] {
  const winnerByMatch = new Map<number, number | null>();
  for (const match of currentRound) winnerByMatch.set(match.matchNumber, match.winnerId);
  const plan: PlannedSlot[] = [];
  for (let i = 0; i < nextRoundCount; i++) {
    plan.push({
      participant1Id: winnerByMatch.get(2 * i + 1) ?? null,
      participant2Id: winnerByMatch.get(2 * i + 2) ?? null,
    });
  }
  return plan;
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
  const slotToSeed = buildSlotToSeed(bracketSize);

  // Build set of eliminated participant IDs. A terminal row with a winner
  // eliminates the non-winner; a cancelled row without a winner (only a
  // placeholder after R1) eliminates any participant it still holds. Queued
  // rows are ignored, so this function owns the terminal-status rule.
  const eliminatedIds = new Set<number>();
  for (const match of completedMatches) {
    if (!TERMINAL_MATCH_STATUSES.includes(match.status)) continue;
    for (const participantId of [match.participant1Id, match.participant2Id]) {
      if (participantId === null) continue;
      const lost = match.winnerId === null
        ? match.status === 'cancelled'
        : participantId !== match.winnerId;
      if (lost) eliminatedIds.add(participantId);
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
