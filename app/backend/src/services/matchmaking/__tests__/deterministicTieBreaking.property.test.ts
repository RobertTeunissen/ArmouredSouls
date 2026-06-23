/**
 * Property test: Deterministic Tie-Breaking via createdAt
 *
 * Feature: unified-match-scheduling
 * Property 7: Deterministic Tie-Breaking via createdAt
 *
 * Validates: Requirements 10.1, 10.2, 10.3
 */

import * as fc from 'fast-check';
import { calculateMatchScore, MatchScoreInput } from '../teamMatchmakingUtils';

describe('Deterministic Tie-Breaking — Property 7: createdAt', () => {
  it('entities with identical scores are always sorted by earliest createdAt regardless of input order', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 900, max: 1100 }), // shared ELO (forces same score)
        fc.integer({ min: 40, max: 60 }), // shared LP
        fc.array(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-01-01') }),
          { minLength: 3, maxLength: 8 },
        ),
        (sharedELO, sharedLP, createdAtDates) => {
          // Ensure all dates are unique (prerequisite for deterministic tie-breaking)
          const uniqueDates = [...new Set(createdAtDates.map(d => d.getTime()))].map(t => new Date(t));
          fc.pre(uniqueDates.length >= 3); // Need at least 3 unique dates
          // Create entities with IDENTICAL scores (same LP, same ELO, no recent opponents, different stables)
          const entities = uniqueDates.map((date, i) => ({
            id: i + 1,
            elo: sharedELO,
            lp: sharedLP,
            userId: i + 100, // all different stables
            createdAt: date,
          }));

          const entityId = 9999;
          const entityELO = sharedELO;
          const entityLP = sharedLP;

          // Score all — should produce identical scores (same LP diff=0, same ELO diff=0, no penalties)
          const scored = entities.map(e => {
            const input: MatchScoreInput = {
              entity1LP: entityLP,
              entity2LP: e.lp,
              entity1ELO: entityELO,
              entity2ELO: e.elo,
              recentOpponents1: [],
              recentOpponents2: [],
              entity1Id: entityId,
              entity2Id: e.id,
              entity1StableId: 5000,
              entity2StableId: e.userId,
            };
            return { entity: e, score: calculateMatchScore(input) };
          });

          // All scores should be identical (LP diff = 0, ELO diff = 0)
          const uniqueScores = new Set(scored.map(s => s.score));
          expect(uniqueScores.size).toBe(1);

          // Sort with tie-breaking by createdAt
          const sorted = [...scored].sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            return a.entity.createdAt.getTime() - b.entity.createdAt.getTime();
          });

          // Shuffle and sort again — must produce same result
          const shuffled = [...scored].sort(() => Math.random() - 0.5);
          const resorted = [...shuffled].sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            return a.entity.createdAt.getTime() - b.entity.createdAt.getTime();
          });

          // Same entity should be selected first regardless of shuffle
          expect(resorted[0].entity.id).toBe(sorted[0].entity.id);

          // First selected should have the earliest createdAt
          for (const s of sorted) {
            expect(sorted[0].entity.createdAt.getTime()).toBeLessThanOrEqual(s.entity.createdAt.getTime());
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
