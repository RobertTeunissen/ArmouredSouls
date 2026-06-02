import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { render } from '@testing-library/react';
import React from 'react';
import MatchCard from '../components/tournament/MatchCard';
import {
  buildBracketTree,
  TournamentMatchWithRobots,
} from '../utils/bracketUtils';

/**
 * Property-based tests for tournament bracket seeding (frontend)
 * Feature: tournament-bracket-seeding
 *
 * Uses fast-check with minimum 100 iterations per property.
 */

/** Helper to create a minimal match object for testing */
function makeMatch(
  overrides: Partial<TournamentMatchWithRobots> & {
    id: number;
    round: number;
    matchNumber: number;
  }
): TournamentMatchWithRobots {
  return {
    tournamentId: 1,
    participantType: 'robot',
    participant1Id: null,
    participant2Id: null,
    winnerId: null,
    battleId: null,
    status: 'pending',
    isByeMatch: false,
    completedAt: null,
    robot1: null,
    robot2: null,
    winner: null,
    ...overrides,
  };
}

/**
 * Feature: tournament-bracket-seeding, Property 8: User participant match highlighting
 *
 * For any tournament and any set of user-owned participant IDs, every MatchCard where
 * participant1Id or participant2Id is in the user's participant set SHALL have the border-blue-500
 * CSS class applied, and every MatchCard where neither participant belongs to the user
 * SHALL have border-white/10 instead.
 *
 * **Validates: Requirements 6.1, 6.2, 6.4**
 */
describe('Property 8: User participant match highlighting', () => {
  /** Arbitrary for a positive participant ID */
  const participantIdArb = fc.integer({ min: 1, max: 10000 });

  /** Arbitrary for a robot name */
  const robotNameArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,14}$/).filter(
    (s) => s.trim().length > 0
  );

  /** Arbitrary that generates a match with random participant IDs and a set of user participant IDs */
  const matchAndUserParticipantsArb = fc
    .tuple(
      fc.integer({ min: 1, max: 1000 }), // match id
      fc.option(participantIdArb, { nil: undefined }), // participant1Id (possibly absent)
      fc.option(participantIdArb, { nil: undefined }), // participant2Id (possibly absent)
      robotNameArb, // robot1 name
      robotNameArb, // robot2 name
      fc.uniqueArray(participantIdArb, { minLength: 0, maxLength: 5 }) // user participant IDs
    )
    .map(([matchId, p1Id, p2Id, r1Name, r2Name, userIds]) => {
      const participant1Id = p1Id ?? null;
      const participant2Id = p2Id ?? null;

      const match = makeMatch({
        id: matchId,
        round: 1,
        matchNumber: 1,
        participant1Id,
        participant2Id,
        robot1: participant1Id !== null ? { id: participant1Id, name: r1Name, elo: 1500 } : null,
        robot2: participant2Id !== null ? { id: participant2Id, name: r2Name, elo: 1400 } : null,
        status: 'pending',
      });

      const userParticipantIds = new Set(userIds);
      return { match, userParticipantIds };
    });

  it('should apply border-blue-500 if and only if the match contains a user participant', () => {
    fc.assert(
      fc.property(matchAndUserParticipantsArb, ({ match, userParticipantIds }) => {
        const { container } = render(
          React.createElement(MatchCard, {
            match,
            seedMap: new Map(),
            userParticipantIds,
            isUserFuturePath: false,
          })
        );

        const card = container.querySelector(`[data-testid="match-card-${match.id}"]`);
        expect(card).not.toBeNull();

        const classList = card!.className;

        const hasUserParticipant =
          (match.participant1Id !== null && userParticipantIds.has(match.participant1Id)) ||
          (match.participant2Id !== null && userParticipantIds.has(match.participant2Id));

        if (hasUserParticipant) {
          expect(classList).toContain('border-blue-500');
          expect(classList).not.toContain('border-white/10');
        } else {
          expect(classList).toContain('border-white/10');
          expect(classList).not.toContain('border-blue-500');
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: tournament-bracket-seeding, Property 4: Bracket renders correct structure
 *
 * For any tournament with maxRounds rounds, buildBracketTree SHALL return a map
 * with exactly maxRounds entries, and for each round r, the number of matches
 * in that round SHALL equal the number of input matches with round === r.
 *
 * **Validates: Requirements 3.1, 3.2**
 */
describe('Property 4: Bracket renders correct structure', () => {
  /**
   * Arbitrary that generates valid tournament data with 1-7 rounds.
   * For each round r, generates Math.pow(2, maxRounds - r) matches.
   */
  const tournamentDataArb = fc
    .integer({ min: 1, max: 7 })
    .chain((maxRounds) => {
      // Build all matches for a proper single-elimination bracket
      const allMatches: TournamentMatchWithRobots[] = [];
      let matchId = 1;

      for (let r = 1; r <= maxRounds; r++) {
        const matchCount = Math.pow(2, maxRounds - r);
        for (let m = 1; m <= matchCount; m++) {
          allMatches.push(
            makeMatch({
              id: matchId++,
              round: r,
              matchNumber: m,
            })
          );
        }
      }

      // Shuffle the matches to ensure buildBracketTree handles any order
      return fc.shuffledSubarray(allMatches, { minLength: allMatches.length, maxLength: allMatches.length })
        .map((shuffled) => ({ maxRounds, matches: shuffled, expectedCounts: computeExpectedCounts(maxRounds) }));
    });

  function computeExpectedCounts(maxRounds: number): Map<number, number> {
    const counts = new Map<number, number>();
    for (let r = 1; r <= maxRounds; r++) {
      counts.set(r, Math.pow(2, maxRounds - r));
    }
    return counts;
  }

  it('should produce a map with maxRounds entries, each with the correct match count', () => {
    fc.assert(
      fc.property(tournamentDataArb, ({ maxRounds, matches, expectedCounts }) => {
        const tree = buildBracketTree(matches, maxRounds);

        // The map should have exactly maxRounds entries
        expect(tree.size).toBe(maxRounds);

        // Each round should have the correct number of matches
        for (let r = 1; r <= maxRounds; r++) {
          const roundMatches = tree.get(r);
          expect(roundMatches).toBeDefined();
          expect(roundMatches!.length).toBe(expectedCounts.get(r));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should sort matches within each round by matchNumber ascending', () => {
    fc.assert(
      fc.property(tournamentDataArb, ({ maxRounds, matches }) => {
        const tree = buildBracketTree(matches, maxRounds);

        for (let r = 1; r <= maxRounds; r++) {
          const roundMatches = tree.get(r)!;
          for (let i = 1; i < roundMatches.length; i++) {
            expect(roundMatches[i].matchNumber).toBeGreaterThan(
              roundMatches[i - 1].matchNumber
            );
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
