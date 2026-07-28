/**
 * Property tests for Instance_Rank (Spec #45 design Property 4).
 *
 * Instance_Rank is the archive's claim about where an entity finished. If it
 * can produce a gap, a duplicate, or a non-deterministic order under ties, the
 * archived history is wrong in a way nobody would notice.
 */

import fc from 'fast-check';
import {
  computeRanks,
  orderStandings,
  rankKey,
  groupKey,
  type RankableStanding,
} from '../instanceRank';

const MODES = ['league_1v1', 'league_2v2', 'koth', 'grand_melee'] as const;
const TIERS = ['bronze', 'silver', 'gold', 'champion'] as const;

/** Arbitrary standing. entityId is unique per generated array via index offset. */
const standingArb = (entityId: number) =>
  fc.record({
    entityType: fc.constantFrom('robot', 'team'),
    entityId: fc.constant(entityId),
    mode: fc.constantFrom(...MODES),
    tier: fc.constantFrom(...TIERS),
    leagueInstanceId: fc.constantFrom('bronze_1', 'gold_1', 'gold_2'),
    leaguePoints: fc.integer({ min: -50, max: 500 }),
    wins: fc.integer({ min: 0, max: 100 }),
    losses: fc.integer({ min: 0, max: 100 }),
    draws: fc.integer({ min: 0, max: 20 }),
    bestWinStreak: fc.integer({ min: 0, max: 30 }),
  });

/** A set of standings with distinct entityType:entityId keys. */
const standingsArb = fc
  .integer({ min: 0, max: 40 })
  .chain((n) =>
    fc.tuple(...Array.from({ length: n }, (_, i) => standingArb(i + 1))),
  )
  .map((arr) => {
    // Deduplicate on the composite key the rank map uses.
    const seen = new Set<string>();
    return (arr as RankableStanding[]).filter((s) => {
      const key = rankKey(s.entityType, s.entityId, s.mode);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

describe('Instance_Rank — Property 4: ranks are a permutation of 1..N per group', () => {
  it('should assign exactly 1..N within every mode/tier/instance group', () => {
    fc.assert(
      fc.property(standingsArb, (standings) => {
        const ranks = computeRanks(standings);

        const groups = new Map<string, RankableStanding[]>();
        for (const s of standings) {
          const key = groupKey(s.mode, s.tier, s.leagueInstanceId);
          const bucket = groups.get(key);
          if (bucket) bucket.push(s);
          else groups.set(key, [s]);
        }

        for (const group of groups.values()) {
          const assigned = group
            .map((s) => ranks.get(rankKey(s.entityType, s.entityId, s.mode)))
            .sort((a, b) => (a ?? 0) - (b ?? 0));
          const expected = Array.from({ length: group.length }, (_, i) => i + 1);
          expect(assigned).toEqual(expected);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('should order by leaguePoints desc, then wins desc, then entityId asc', () => {
    fc.assert(
      fc.property(standingsArb, (standings) => {
        const ordered = orderStandings(standings);
        for (let i = 1; i < ordered.length; i++) {
          const prev = ordered[i - 1];
          const curr = ordered[i];
          if (prev.leaguePoints !== curr.leaguePoints) {
            expect(prev.leaguePoints).toBeGreaterThan(curr.leaguePoints);
          } else if (prev.wins !== curr.wins) {
            expect(prev.wins).toBeGreaterThan(curr.wins);
          } else {
            expect(prev.entityId).toBeLessThan(curr.entityId);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('should be deterministic under full ties', () => {
    // Every entity identical except its id — the id tiebreak must decide.
    const tied: RankableStanding[] = [5, 3, 1, 4, 2].map((id) => ({
      entityType: 'robot',
      entityId: id,
      mode: 'league_1v1',
      tier: 'gold',
      leagueInstanceId: 'gold_1',
      leaguePoints: 42,
      wins: 7,
      losses: 3,
      draws: 0,
      bestWinStreak: 4,
    }));

    const ranks = computeRanks(tied);
    expect(ranks.get(rankKey('robot', 1, 'league_1v1'))).toBe(1);
    expect(ranks.get(rankKey('robot', 2, 'league_1v1'))).toBe(2);
    expect(ranks.get(rankKey('robot', 3, 'league_1v1'))).toBe(3);
    expect(ranks.get(rankKey('robot', 4, 'league_1v1'))).toBe(4);
    expect(ranks.get(rankKey('robot', 5, 'league_1v1'))).toBe(5);
  });

  it('should give one entity a distinct rank in every mode it competes in', () => {
    // Regression: the rank map was originally keyed on entityType:entityId, so
    // a robot in several modes had one rank overwritten by the next group
    // processed — the archive then reported that single rank for every mode.
    const standings: RankableStanding[] = [
      // 1v1: our robot is 2nd of 2.
      { entityType: 'robot', entityId: 1, mode: 'league_1v1', tier: 'gold',
        leagueInstanceId: 'gold_1', leaguePoints: 50, wins: 5, losses: 5, draws: 0, bestWinStreak: 2 },
      { entityType: 'robot', entityId: 9, mode: 'league_1v1', tier: 'gold',
        leagueInstanceId: 'gold_1', leaguePoints: 99, wins: 9, losses: 1, draws: 0, bestWinStreak: 9 },
      // KotH: our robot is 1st of 2.
      { entityType: 'robot', entityId: 1, mode: 'koth', tier: 'gold',
        leagueInstanceId: 'gold_1', leaguePoints: 80, wins: 8, losses: 2, draws: 0, bestWinStreak: 4 },
      { entityType: 'robot', entityId: 9, mode: 'koth', tier: 'gold',
        leagueInstanceId: 'gold_1', leaguePoints: 20, wins: 2, losses: 8, draws: 0, bestWinStreak: 1 },
      // Grand Melee: our robot is 3rd of 3.
      { entityType: 'robot', entityId: 1, mode: 'grand_melee', tier: 'gold',
        leagueInstanceId: 'gold_1', leaguePoints: 10, wins: 1, losses: 9, draws: 0, bestWinStreak: 1 },
      { entityType: 'robot', entityId: 9, mode: 'grand_melee', tier: 'gold',
        leagueInstanceId: 'gold_1', leaguePoints: 60, wins: 6, losses: 4, draws: 0, bestWinStreak: 3 },
      { entityType: 'robot', entityId: 12, mode: 'grand_melee', tier: 'gold',
        leagueInstanceId: 'gold_1', leaguePoints: 30, wins: 3, losses: 7, draws: 0, bestWinStreak: 2 },
    ];

    const ranks = computeRanks(standings);

    expect(ranks.get(rankKey('robot', 1, 'league_1v1'))).toBe(2);
    expect(ranks.get(rankKey('robot', 1, 'koth'))).toBe(1);
    expect(ranks.get(rankKey('robot', 1, 'grand_melee'))).toBe(3);
  });

  it('should keep ranks distinct per mode for arbitrary multi-mode populations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 12 }),
        fc.uniqueArray(fc.constantFrom(...MODES), { minLength: 2, maxLength: 4 }),
        (entityCount, modes) => {
          const standings: RankableStanding[] = [];
          for (const mode of modes) {
            for (let id = 1; id <= entityCount; id++) {
              standings.push({
                entityType: 'robot',
                entityId: id,
                mode,
                tier: 'gold',
                leagueInstanceId: 'gold_1',
                // Reverse the ordering per mode so a shared key would be visible.
                leaguePoints: mode === modes[0] ? id : entityCount - id,
                wins: 0,
                losses: 0,
                draws: 0,
                bestWinStreak: 0,
              });
            }
          }

          const ranks = computeRanks(standings);

          // Every (entity, mode) pair must have its own rank entry.
          for (const mode of modes) {
            const seen = new Set<number>();
            for (let id = 1; id <= entityCount; id++) {
              const rank = ranks.get(rankKey('robot', id, mode));
              expect(rank).toBeDefined();
              expect(seen.has(rank!)).toBe(false);
              seen.add(rank!);
            }
            expect(seen.size).toBe(entityCount);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should rank a robot behind a higher-scoring generated entity', () => {
    // Generated_Stable entities are counted in the ordering, so a player robot
    // that finished third overall is archived as rank 3, not rank 1.
    const standings: RankableStanding[] = [
      { entityType: 'robot', entityId: 100, mode: 'league_1v1', tier: 'gold',
        leagueInstanceId: 'gold_1', leaguePoints: 90, wins: 9, losses: 1, draws: 0, bestWinStreak: 5 },
      { entityType: 'robot', entityId: 200, mode: 'league_1v1', tier: 'gold',
        leagueInstanceId: 'gold_1', leaguePoints: 80, wins: 8, losses: 2, draws: 0, bestWinStreak: 4 },
      { entityType: 'robot', entityId: 300, mode: 'league_1v1', tier: 'gold',
        leagueInstanceId: 'gold_1', leaguePoints: 70, wins: 7, losses: 3, draws: 0, bestWinStreak: 3 },
    ];
    const ranks = computeRanks(standings);
    expect(ranks.get(rankKey('robot', 300, 'league_1v1'))).toBe(3);
  });
});
