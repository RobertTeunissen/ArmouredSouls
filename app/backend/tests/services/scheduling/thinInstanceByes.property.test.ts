/**
 * Thin_Instance_Bye_Plan — property tests (Spec #49).
 *
 * A Placement_Mode instance below its Minimum_Field_Size used to be skipped in
 * silence: no scheduled row, no battle, no Standing update, no audit row. A
 * subscribed robot got nothing on a quiet day in a thin tier and could not even
 * see that nothing had happened.
 *
 * The plan is separated from its persistence precisely so these rules are
 * testable over generated pool sizes with no database.
 */

import * as fc from 'fast-check';
import { $Enums } from '../../../generated/prisma';
import { planThinInstanceByes } from '../../../src/services/scheduling/thinInstanceByes';

const KOTH_MIN = 5;
const GRAND_MELEE_MIN = 8;

function pool(n: number): Array<{ id: number }> {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1 }));
}

// Feature: bye-system-unification, Property 7: A thin instance byes everyone
describe('Property 7: a thin instance plans one bye per eligible robot', () => {
  it.each([
    ['koth', $Enums.MatchType.koth, KOTH_MIN],
    ['grand_melee', $Enums.MatchType.grand_melee, GRAND_MELEE_MIN],
  ] as const)('should plan exactly one entry per eligible robot for %s', (_name, matchType, min) => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: min - 1 }), (n) => {
        const plan = planThinInstanceByes({
          matchType,
          tier: 'bronze',
          leagueInstanceId: 'bronze_1',
          robots: pool(n),
          scheduledFor: new Date('2026-01-01T13:00:00Z'),
        });

        expect(plan).toHaveLength(n);
        for (const entry of plan) {
          expect(entry.matchType).toBe(matchType);
          expect(entry.isByeMatch).toBe(true);
          expect(entry.leagueType).toBe('bronze');
          expect(entry.leagueInstanceId).toBe('bronze_1');
          // One row per byed robot, one participant each — per-robot is what
          // makes slot accounting, the claim and resolution all work per robot.
          expect(entry.participants).toHaveLength(1);
          expect(entry.participants[0].participantType).toBe('robot');
        }

        // Every robot appears exactly once, none invented.
        const planned = plan.map((e) => e.participants[0].participantId).sort((a, b) => a - b);
        expect(planned).toEqual(pool(n).map((r) => r.id));
      }),
      { numRuns: 100 },
    );
  });

  // An empty pool plans nothing. This falls out of the rules rather than needing
  // a special branch, but it is named so the boundary is not left to a generator.
  it('should plan nothing for an empty pool', () => {
    const plan = planThinInstanceByes({
      matchType: $Enums.MatchType.koth,
      tier: 'gold',
      leagueInstanceId: 'gold_2',
      robots: [],
      scheduledFor: new Date(),
    });
    expect(plan).toEqual([]);
  });

  // The plan is a pure function of the pool, so it also plans for a viable pool
  // if handed one. The *matchmaker* is what only calls it below the minimum —
  // that gate is asserted in the integration tier, where the real control flow
  // and the real MIN_GROUP_SIZE constants are in play.
  it('should scale linearly with the pool it is handed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 60 }), (n) => {
        const plan = planThinInstanceByes({
          matchType: $Enums.MatchType.grand_melee,
          tier: 'champion',
          leagueInstanceId: 'champion_1',
          robots: pool(n),
          scheduledFor: new Date(),
        });
        expect(plan).toHaveLength(n);
      }),
      { numRuns: 100 },
    );
  });
});
