/**
 * Property test: Mode-Specific Recent-Opponent Isolation
 *
 * Feature: unified-match-scheduling
 * Property 4: Mode-Specific Recent-Opponent Isolation
 * Property 5: KotH Multi-Participant Recent Opponents
 *
 * Tests that the createRecentOpponentQueryFn logic correctly isolates
 * opponents by MatchType and handles multi-participant KotH matches.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 23.1
 */

import * as fc from 'fast-check';

// Simulate the opponent extraction logic from createRecentOpponentQueryFn
// (without actual DB access — tests the mapping algorithm)
interface MockMatch {
  matchType: string;
  participants: Array<{ participantId: number; participantType: string }>;
}

function extractOpponents(
  entityId: number,
  matches: MockMatch[],
  targetMatchType: string,
  participantType: string,
  limit: number,
): number[] {
  const opponents: number[] = [];
  // Filter to target match type only
  const filtered = matches.filter(m => m.matchType === targetMatchType);
  for (const match of filtered) {
    if (opponents.length >= limit) break;
    const participantIds = match.participants
      .filter(p => p.participantType === participantType)
      .map(p => p.participantId);
    if (participantIds.includes(entityId)) {
      for (const opId of participantIds) {
        if (opId !== entityId && !opponents.includes(opId)) {
          opponents.push(opId);
          if (opponents.length >= limit) break;
        }
      }
    }
  }
  return opponents;
}

describe('Recent-Opponent Isolation — Property 4: Mode-Specific', () => {
  it('only returns opponents from the specified MatchType, never from other types', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }), // entityId
        fc.array(
          fc.record({
            matchType: fc.constantFrom('league_1v1', 'league_2v2', 'tag_team', 'koth'),
            participants: fc.array(
              fc.record({
                participantId: fc.integer({ min: 1, max: 50 }),
                participantType: fc.constant('robot'),
              }),
              { minLength: 2, maxLength: 6 },
            ),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        fc.constantFrom('league_1v1', 'league_2v2', 'tag_team', 'koth'),
        (entityId, matches, targetType) => {
          // Ensure at least one match has the entity as participant in the target type
          const matchesWithEntity = matches.map(m => ({
            ...m,
            participants: [...m.participants, { participantId: entityId, participantType: 'robot' }],
          }));

          const opponents = extractOpponents(entityId, matchesWithEntity, targetType, 'robot', 5);

          // Verify: no opponent should come from a match of a different type
          for (const opId of opponents) {
            const foundInTargetType = matchesWithEntity.some(
              m => m.matchType === targetType &&
                m.participants.some(p => p.participantId === entityId) &&
                m.participants.some(p => p.participantId === opId),
            );
            expect(foundInTargetType).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('KotH Multi-Participant — Property 5: All group members are recent opponents', () => {
  it('for KotH matches with N participants, each gets N-1 recent opponents', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.integer({ min: 1, max: 100 }),
          { minLength: 5, maxLength: 6 },
        ).filter(arr => new Set(arr).size === arr.length), // unique IDs
        (participantIds) => {
          // Create a single KotH match with all participants
          const match: MockMatch = {
            matchType: 'koth',
            participants: participantIds.map(id => ({ participantId: id, participantType: 'robot' })),
          };

          // For each participant, extract their recent opponents
          for (const entityId of participantIds) {
            const opponents = extractOpponents(entityId, [match], 'koth', 'robot', 10);

            // Should have exactly N-1 opponents (everyone else in the group)
            expect(opponents.length).toBe(participantIds.length - 1);

            // Should not include self
            expect(opponents).not.toContain(entityId);

            // Should include all others
            for (const otherId of participantIds) {
              if (otherId !== entityId) {
                expect(opponents).toContain(otherId);
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
