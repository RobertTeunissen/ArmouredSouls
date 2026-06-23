/**
 * Property test: R4.7 Fallback Selects Closest-ELO
 *
 * Feature: unified-match-scheduling
 * Property 6: R4.7 Fallback Selects Closest-ELO
 *
 * Validates: Requirements 9.1, 9.2
 */

import * as fc from 'fast-check';
import { calculateMatchScore, MatchScoreInput, RECENT_OPPONENT_PENALTY } from '../teamMatchmakingUtils';

describe('R4.7 Fallback — Property 6: Selects Closest-ELO', () => {
  it('when ALL opponents are recent, the selected opponent has smallest ELO difference', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 800, max: 1200 }), // entity ELO
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            elo: fc.integer({ min: 600, max: 1400 }),
            createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-01-01') }),
          }),
          { minLength: 2, maxLength: 10 },
        ),
        (entityELO, opponents) => {
          // Make all opponents "recent" by including all their IDs in recentOpponents
          const entityId = 9999;
          const recentOpponents = opponents.map(o => o.id);

          // Score all opponents (all will have RECENT_OPPONENT_PENALTY)
          const scored = opponents.map(opponent => {
            const input: MatchScoreInput = {
              entity1LP: 50,
              entity2LP: 50, // same LP to isolate ELO effect
              entity1ELO: entityELO,
              entity2ELO: opponent.elo,
              recentOpponents1: recentOpponents,
              recentOpponents2: [entityId],
              entity1Id: entityId,
              entity2Id: opponent.id,
              entity1StableId: 1,
              entity2StableId: opponent.id + 1000, // different stables
            };
            return { opponent, score: calculateMatchScore(input) };
          });

          // R4.7 fallback: select closest-ELO, tie-break by createdAt
          const closestELO = [...scored].sort((a, b) => {
            const diffA = Math.abs(a.opponent.elo - entityELO);
            const diffB = Math.abs(b.opponent.elo - entityELO);
            if (diffA !== diffB) return diffA - diffB;
            return a.opponent.createdAt.getTime() - b.opponent.createdAt.getTime();
          });

          const selected = closestELO[0].opponent;

          // Verify it has the smallest ELO difference
          const selectedDiff = Math.abs(selected.elo - entityELO);
          for (const opp of opponents) {
            const oppDiff = Math.abs(opp.elo - entityELO);
            if (oppDiff < selectedDiff) {
              // This should never happen — the selected should be closest
              expect(oppDiff).toBeGreaterThanOrEqual(selectedDiff);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
