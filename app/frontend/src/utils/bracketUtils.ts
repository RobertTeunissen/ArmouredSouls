/**
 * Shared bracket utility functions for tournament visualization.
 * Extracted from TournamentsPage.tsx and extended per the bracket seeding design.
 */

import type { ParticipantType } from './tournamentApi';

/** Match data with participant relations, as returned by the tournament detail API */
export interface TournamentMatchWithRobots {
  id: number;
  tournamentId: number;
  round: number;
  matchNumber: number;
  participantType: ParticipantType;
  participant1Id: number | null;
  participant2Id: number | null;
  winnerId: number | null;
  battleId: number | null;
  status: string;
  isByeMatch: boolean;
  completedAt: string | null;
  robot1: { id: number; name: string; elo: number } | null;
  robot2: { id: number; name: string; elo: number } | null;
  winner: { id: number; name: string } | null;
  /** @deprecated Use participant1Id */
  robot1Id?: number | null;
  /** @deprecated Use participant2Id */
  robot2Id?: number | null;
}

/**
 * Returns a human-readable label for a tournament round.
 *
 * - Finals when round === maxRounds
 * - Semi-finals when round === maxRounds - 1
 * - Quarter-finals when round === maxRounds - 2
 * - "Round N" otherwise
 *
 * Validates: Requirement 7.1
 */
export function getRoundLabel(round: number, maxRounds: number): string {
  if (round === maxRounds) return 'Finals';
  if (round === maxRounds - 1) return 'Semi-finals';
  if (round === maxRounds - 2) return 'Quarter-finals';
  return `Round ${round}`;
}

/**
 * Organizes a flat match array into a Map keyed by round number.
 * Each round's matches are sorted by matchNumber ascending.
 *
 * Validates: Requirement 3.1
 */
export function buildBracketTree(
  matches: TournamentMatchWithRobots[],
  maxRounds: number
): Map<number, TournamentMatchWithRobots[]> {
  const tree = new Map<number, TournamentMatchWithRobots[]>();

  // Initialize empty arrays for every round so the map is complete
  for (let r = 1; r <= maxRounds; r++) {
    tree.set(r, []);
  }

  for (const match of matches) {
    const roundMatches = tree.get(match.round);
    if (roundMatches) {
      roundMatches.push(match);
    }
  }

  // Sort each round's matches by matchNumber ascending
  for (const [, roundMatches] of tree) {
    roundMatches.sort((a, b) => a.matchNumber - b.matchNumber);
  }

  return tree;
}

/**
 * Formats a seed number + robot name for display.
 * Seeds 1–32 get a "#N" prefix; seeds > 32 show just the name.
 *
 * Validates: Requirements 4.1, 4.2
 */
export function formatSeedDisplay(seed: number, robotName: string): string {
  if (seed <= 32) return `#${seed} ${robotName}`;
  return robotName;
}

/**
 * Computes the set of future match IDs the user's participant would play
 * if it keeps winning from its current position.
 *
 * Algorithm:
 * 1. Find the user's latest (highest-round) match where they are assigned.
 * 2. From that match, walk up the bracket: the next match in round N+1
 *    has matchNumber = Math.ceil(currentMatchNumber / 2).
 * 3. Collect the IDs of those future matches.
 *
 * Validates: Requirement 6.3
 */
export function getUserFuturePath(
  matches: TournamentMatchWithRobots[],
  userParticipantIds: Set<number>,
  maxRounds: number
): Set<number> {
  const futureMatchIds = new Set<number>();

  if (userParticipantIds.size === 0 || matches.length === 0) {
    return futureMatchIds;
  }

  // Build a lookup: (round, matchNumber) → match
  const matchLookup = new Map<string, TournamentMatchWithRobots>();
  for (const match of matches) {
    matchLookup.set(`${match.round}-${match.matchNumber}`, match);
  }

  // Find all matches the user's participants are in
  const userMatches = matches.filter(
    (m) =>
      (m.participant1Id !== null && userParticipantIds.has(m.participant1Id)) ||
      (m.participant2Id !== null && userParticipantIds.has(m.participant2Id))
  );

  if (userMatches.length === 0) {
    return futureMatchIds;
  }

  // For each user participant, find their latest match and trace the future path
  for (const userMatch of userMatches) {
    // Only trace forward from matches that haven't been lost
    const userParticipantId = userParticipantIds.has(userMatch.participant1Id ?? -1)
      ? userMatch.participant1Id
      : userMatch.participant2Id;

    // If the match is completed and the user's participant lost, skip
    if (
      userMatch.status === 'completed' &&
      userMatch.winnerId !== null &&
      userMatch.winnerId !== userParticipantId
    ) {
      continue;
    }

    // Walk up the bracket from this match
    let currentRound = userMatch.round;
    let currentMatchNumber = userMatch.matchNumber;

    while (currentRound < maxRounds) {
      const nextRound = currentRound + 1;
      const nextMatchNumber = Math.ceil(currentMatchNumber / 2);
      const nextMatch = matchLookup.get(`${nextRound}-${nextMatchNumber}`);

      if (nextMatch) {
        // Only add if the user's participant isn't already assigned to this match
        // (if they are, it's a current match, not a future one)
        const alreadyAssigned =
          (nextMatch.participant1Id !== null && userParticipantIds.has(nextMatch.participant1Id)) ||
          (nextMatch.participant2Id !== null && userParticipantIds.has(nextMatch.participant2Id));

        if (!alreadyAssigned) {
          futureMatchIds.add(nextMatch.id);
        }
      }

      currentRound = nextRound;
      currentMatchNumber = nextMatchNumber;
    }
  }

  return futureMatchIds;
}
