/**
 * Property tests for Season_Standing_Snapshot boundedness (Spec #45 design Property 13).
 *
 * This is the property the whole snapshot design rests on. Generated_Stables are
 * created at a rate of N per cycle N, so on a long season the standings table
 * holds thousands of bot rows. If the snapshot captured all of them, the archive
 * tables would become the new unbounded growth problem — the exact thing
 * Expected Contribution 4 promises to fix.
 *
 * The bound is Accolade_Depth entries per (mode, tier, leagueInstanceId) triple,
 * independent of how many entities compete.
 */

import fc from 'fast-check';
import { orderStandings, groupKey, type RankableStanding } from '../instanceRank';

/**
 * The selection the snapshot writer performs: order each group, keep the top
 * `depth`. Extracted here so the bound can be property-tested without a
 * database — the writer applies exactly this to each group.
 */
function selectSnapshotRows(
  standings: RankableStanding[],
  depth: number,
): RankableStanding[] {
  const groups = new Map<string, RankableStanding[]>();
  for (const s of standings) {
    const key = groupKey(s.mode, s.tier, s.leagueInstanceId);
    const bucket = groups.get(key);
    if (bucket) bucket.push(s);
    else groups.set(key, [s]);
  }

  const selected: RankableStanding[] = [];
  for (const group of groups.values()) {
    selected.push(...orderStandings(group).slice(0, depth));
  }
  return selected;
}

const MODES = ['league_1v1', 'league_2v2', 'league_3v3', 'koth', 'grand_melee'] as const;
const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;
const INSTANCES = ['bronze_1', 'gold_1', 'gold_2', 'champion_1'] as const;

/** A population of standings with unique entity ids. */
const populationArb = fc
  .array(
    fc.record({
      mode: fc.constantFrom(...MODES),
      tier: fc.constantFrom(...TIERS),
      leagueInstanceId: fc.constantFrom(...INSTANCES),
      leaguePoints: fc.integer({ min: -20, max: 400 }),
      wins: fc.integer({ min: 0, max: 90 }),
      losses: fc.integer({ min: 0, max: 90 }),
      draws: fc.integer({ min: 0, max: 20 }),
      bestWinStreak: fc.integer({ min: 0, max: 25 }),
    }),
    { minLength: 0, maxLength: 400 },
  )
  .map((rows) =>
    rows.map((r, i) => ({ ...r, entityType: 'robot', entityId: i + 1 }) as RankableStanding),
  );

describe('Season_Standing_Snapshot — Property 13: bounded per group', () => {
  it('should never keep more than Accolade_Depth entries per mode/tier/instance', () => {
    fc.assert(
      fc.property(populationArb, fc.integer({ min: 1, max: 20 }), (standings, depth) => {
        const selected = selectSnapshotRows(standings, depth);

        const perGroup = new Map<string, number>();
        for (const row of selected) {
          const key = groupKey(row.mode, row.tier, row.leagueInstanceId);
          perGroup.set(key, (perGroup.get(key) ?? 0) + 1);
        }
        for (const count of perGroup.values()) {
          expect(count).toBeLessThanOrEqual(depth);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('should not grow the row count as the entity population grows', () => {
    // The point of the bound: doubling the field must not double the archive.
    const build = (n: number): RankableStanding[] =>
      Array.from({ length: n }, (_, i) => ({
        entityType: 'robot',
        entityId: i + 1,
        mode: 'league_1v1',
        tier: 'gold',
        leagueInstanceId: 'gold_1',
        leaguePoints: i,
        wins: i % 10,
        losses: 0,
        draws: 0,
        bestWinStreak: 0,
      }));

    const depth = 10;
    expect(selectSnapshotRows(build(20), depth).length).toBe(depth);
    expect(selectSnapshotRows(build(200), depth).length).toBe(depth);
    expect(selectSnapshotRows(build(5000), depth).length).toBe(depth);
  });

  it('should stay within the theoretical ceiling of depth × groups', () => {
    fc.assert(
      fc.property(populationArb, fc.integer({ min: 1, max: 20 }), (standings, depth) => {
        const groupCount = new Set(
          standings.map((s) => groupKey(s.mode, s.tier, s.leagueInstanceId)),
        ).size;

        expect(selectSnapshotRows(standings, depth).length).toBeLessThanOrEqual(
          depth * groupCount,
        );
      }),
      { numRuns: 200 },
    );
  });

  it('should keep the strongest entities, whoever they belong to', () => {
    // Bots are included in the ordering, so a bot that outscored every player
    // must appear — otherwise the archived champion of a tier would be wrong.
    const standings: RankableStanding[] = [
      { entityType: 'robot', entityId: 1, mode: 'league_1v1', tier: 'gold',
        leagueInstanceId: 'gold_1', leaguePoints: 10, wins: 1, losses: 9, draws: 0, bestWinStreak: 1 },
      { entityType: 'robot', entityId: 2, mode: 'league_1v1', tier: 'gold',
        leagueInstanceId: 'gold_1', leaguePoints: 300, wins: 30, losses: 0, draws: 0, bestWinStreak: 30 },
      { entityType: 'robot', entityId: 3, mode: 'league_1v1', tier: 'gold',
        leagueInstanceId: 'gold_1', leaguePoints: 150, wins: 15, losses: 5, draws: 0, bestWinStreak: 8 },
    ];

    const top = selectSnapshotRows(standings, 1);
    expect(top).toHaveLength(1);
    expect(top[0].entityId).toBe(2);
  });

  it('should keep every entity when the field is smaller than the depth', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 8 }), (n) => {
        const standings: RankableStanding[] = Array.from({ length: n }, (_, i) => ({
          entityType: 'robot',
          entityId: i + 1,
          mode: 'koth',
          tier: 'silver',
          leagueInstanceId: 'bronze_1',
          leaguePoints: i * 3,
          wins: i,
          losses: 0,
          draws: 0,
          bestWinStreak: 0,
        }));

        expect(selectSnapshotRows(standings, 10).length).toBe(n);
      }),
      { numRuns: 50 },
    );
  });
});
