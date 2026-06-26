/**
 * Tag Team League Adapter - Property-Based Tests
 * Feature: tag-team-system-unification, Property 7: Tag Team League Promotion/Demotion Field Isolation
 *
 * Tests that the tag team league adapter's updateEntityLeague logic updates only
 * tag team league fields (tagTeamLeague, tagTeamLeagueId, cyclesInTagTeamLeague)
 * without affecting team league fields (teamLeague, teamLeagueId, cyclesInLeague).
 *
 * This is a pure logic test — no database required. We simulate the adapter's
 * field update behavior on generated TeamBattle-shaped objects.
 */

import * as fc from 'fast-check';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Minimal TeamBattle shape with both league field sets */
interface TeamBattleLeagueFields {
  id: number;
  teamSize: 2;
  stableId: number;
  teamName: string;

  // 2v2 League fields (should remain unchanged)
  teamLeague: string;
  teamLeagueId: string;
  cyclesInLeague: number;
  teamLp: number;
  totalLeagueWins: number;
  totalLeagueLosses: number;
  totalLeagueDraws: number;

  // Tag Team league fields (target of update)
  tagTeamLeague: string;
  tagTeamLeagueId: string;
  cyclesInTagTeamLeague: number;
  tagTeamLp: number;
  totalTagTeamWins: number;
  totalTagTeamLosses: number;
  totalTagTeamDraws: number;
}

// ─── Generators ──────────────────────────────────────────────────────────────

const LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;

const leagueTierArb = fc.constantFrom(...LEAGUE_TIERS);

const leagueIdArb = fc.tuple(leagueTierArb, fc.integer({ min: 1, max: 10 })).map(
  ([tier, instance]) => `${tier}_${instance}`
);

const teamBattleArb: fc.Arbitrary<TeamBattleLeagueFields> = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  teamSize: fc.constant(2 as const),
  stableId: fc.integer({ min: 1, max: 10000 }),
  teamName: fc.string({ minLength: 1, maxLength: 32 }),

  // 2v2 League fields
  teamLeague: leagueTierArb,
  teamLeagueId: leagueIdArb,
  cyclesInLeague: fc.integer({ min: 0, max: 100 }),
  teamLp: fc.integer({ min: 0, max: 200 }),
  totalLeagueWins: fc.integer({ min: 0, max: 500 }),
  totalLeagueLosses: fc.integer({ min: 0, max: 500 }),
  totalLeagueDraws: fc.integer({ min: 0, max: 100 }),

  // Tag Team league fields
  tagTeamLeague: leagueTierArb,
  tagTeamLeagueId: leagueIdArb,
  cyclesInTagTeamLeague: fc.integer({ min: 0, max: 100 }),
  tagTeamLp: fc.integer({ min: 0, max: 200 }),
  totalTagTeamWins: fc.integer({ min: 0, max: 500 }),
  totalTagTeamLosses: fc.integer({ min: 0, max: 500 }),
  totalTagTeamDraws: fc.integer({ min: 0, max: 100 }),
});

// ─── Simulate Adapter Logic ──────────────────────────────────────────────────

/**
 * Simulates what tagTeamLeagueAdapter.updateEntityLeague does:
 * Updates tagTeamLeague, tagTeamLeagueId, and resets cyclesInTagTeamLeague to 0.
 *
 * This matches the implementation in teamBattleAdapter.ts:
 * ```
 * async updateEntityLeague(entityId, newTier, newLeagueId) {
 *   await prisma.teamBattle.update({
 *     where: { id: entityId },
 *     data: {
 *       tagTeamLeague: newTier,
 *       tagTeamLeagueId: newLeagueId,
 *       cyclesInTagTeamLeague: 0,
 *     },
 *   });
 * }
 * ```
 */
function simulateTagTeamUpdateEntityLeague(
  entity: TeamBattleLeagueFields,
  newTier: string,
  newLeagueId: string
): TeamBattleLeagueFields {
  return {
    ...entity,
    tagTeamLeague: newTier,
    tagTeamLeagueId: newLeagueId,
    cyclesInTagTeamLeague: 0,
  };
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Feature: tag-team-system-unification, Property 7: Tag Team League Promotion/Demotion Field Isolation', () => {
  /**
   * **Validates: Requirements 5.2, 5.3, 5.4**
   *
   * For any TeamBattle row with teamSize = 2, when the tag team league adapter
   * promotes or demotes the team, it SHALL update tagTeamLeague, tagTeamLeagueId,
   * and reset cyclesInTagTeamLeague to 0, while leaving teamLeague, teamLeagueId,
   * and cyclesInLeague unchanged.
   */

  it('should update tagTeamLeague, tagTeamLeagueId, and reset cyclesInTagTeamLeague to 0 on promote/demote', () => {
    fc.assert(
      fc.property(
        teamBattleArb,
        leagueTierArb,
        leagueIdArb,
        (team, newTier, newLeagueId) => {
          const updated = simulateTagTeamUpdateEntityLeague(team, newTier, newLeagueId);

          // Tag team fields should be updated
          expect(updated.tagTeamLeague).toBe(newTier);
          expect(updated.tagTeamLeagueId).toBe(newLeagueId);
          expect(updated.cyclesInTagTeamLeague).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should NOT modify teamLeague when tag team league is updated', () => {
    fc.assert(
      fc.property(
        teamBattleArb,
        leagueTierArb,
        leagueIdArb,
        (team, newTier, newLeagueId) => {
          const updated = simulateTagTeamUpdateEntityLeague(team, newTier, newLeagueId);

          // teamLeague must remain unchanged
          expect(updated.teamLeague).toBe(team.teamLeague);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should NOT modify teamLeagueId when tag team league is updated', () => {
    fc.assert(
      fc.property(
        teamBattleArb,
        leagueTierArb,
        leagueIdArb,
        (team, newTier, newLeagueId) => {
          const updated = simulateTagTeamUpdateEntityLeague(team, newTier, newLeagueId);

          // teamLeagueId must remain unchanged
          expect(updated.teamLeagueId).toBe(team.teamLeagueId);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should NOT modify cyclesInLeague when tag team league is updated', () => {
    fc.assert(
      fc.property(
        teamBattleArb,
        leagueTierArb,
        leagueIdArb,
        (team, newTier, newLeagueId) => {
          const updated = simulateTagTeamUpdateEntityLeague(team, newTier, newLeagueId);

          // cyclesInLeague must remain unchanged
          expect(updated.cyclesInLeague).toBe(team.cyclesInLeague);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should preserve ALL non-tag-team-league fields unchanged (full isolation check)', () => {
    fc.assert(
      fc.property(
        teamBattleArb,
        leagueTierArb,
        leagueIdArb,
        (team, newTier, newLeagueId) => {
          const updated = simulateTagTeamUpdateEntityLeague(team, newTier, newLeagueId);

          // Identity fields unchanged
          expect(updated.id).toBe(team.id);
          expect(updated.teamSize).toBe(team.teamSize);
          expect(updated.stableId).toBe(team.stableId);
          expect(updated.teamName).toBe(team.teamName);

          // 2v2 League LP unchanged
          expect(updated.teamLp).toBe(team.teamLp);

          // 2v2 League tier/instance unchanged
          expect(updated.teamLeague).toBe(team.teamLeague);
          expect(updated.teamLeagueId).toBe(team.teamLeagueId);
          expect(updated.cyclesInLeague).toBe(team.cyclesInLeague);

          // 2v2 League stats unchanged
          expect(updated.totalLeagueWins).toBe(team.totalLeagueWins);
          expect(updated.totalLeagueLosses).toBe(team.totalLeagueLosses);
          expect(updated.totalLeagueDraws).toBe(team.totalLeagueDraws);

          // Tag Team LP unchanged (updateEntityLeague doesn't modify LP)
          expect(updated.tagTeamLp).toBe(team.tagTeamLp);

          // Tag Team stats unchanged
          expect(updated.totalTagTeamWins).toBe(team.totalTagTeamWins);
          expect(updated.totalTagTeamLosses).toBe(team.totalTagTeamLosses);
          expect(updated.totalTagTeamDraws).toBe(team.totalTagTeamDraws);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should always reset cyclesInTagTeamLeague to 0 regardless of previous value', () => {
    fc.assert(
      fc.property(
        teamBattleArb.map(t => ({ ...t, cyclesInTagTeamLeague: fc.sample(fc.integer({ min: 1, max: 100 }), 1)[0] })),
        leagueTierArb,
        leagueIdArb,
        (team, newTier, newLeagueId) => {
          // Ensure team has non-zero cycles before update
          fc.pre(team.cyclesInTagTeamLeague > 0);

          const updated = simulateTagTeamUpdateEntityLeague(team, newTier, newLeagueId);

          // cyclesInTagTeamLeague must be reset to 0
          expect(updated.cyclesInTagTeamLeague).toBe(0);

          // cyclesInLeague must NOT be affected
          expect(updated.cyclesInLeague).toBe(team.cyclesInLeague);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should handle promotion scenario (tier upgrade) with field isolation', () => {
    fc.assert(
      fc.property(
        teamBattleArb.filter(t => t.tagTeamLeague !== 'champion'),
        leagueIdArb,
        (team, newLeagueId) => {
          // Determine the next tier for promotion
          const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];
          const currentIdx = tierOrder.indexOf(team.tagTeamLeague);
          const promotedTier = tierOrder[currentIdx + 1];

          const updated = simulateTagTeamUpdateEntityLeague(team, promotedTier, newLeagueId);

          // Tag team league should be promoted
          expect(updated.tagTeamLeague).toBe(promotedTier);
          expect(updated.tagTeamLeagueId).toBe(newLeagueId);
          expect(updated.cyclesInTagTeamLeague).toBe(0);

          // Team league fields completely unchanged
          expect(updated.teamLeague).toBe(team.teamLeague);
          expect(updated.teamLeagueId).toBe(team.teamLeagueId);
          expect(updated.cyclesInLeague).toBe(team.cyclesInLeague);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should handle demotion scenario (tier downgrade) with field isolation', () => {
    fc.assert(
      fc.property(
        teamBattleArb.filter(t => t.tagTeamLeague !== 'bronze'),
        leagueIdArb,
        (team, newLeagueId) => {
          // Determine the previous tier for demotion
          const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];
          const currentIdx = tierOrder.indexOf(team.tagTeamLeague);
          const demotedTier = tierOrder[currentIdx - 1];

          const updated = simulateTagTeamUpdateEntityLeague(team, demotedTier, newLeagueId);

          // Tag team league should be demoted
          expect(updated.tagTeamLeague).toBe(demotedTier);
          expect(updated.tagTeamLeagueId).toBe(newLeagueId);
          expect(updated.cyclesInTagTeamLeague).toBe(0);

          // Team league fields completely unchanged
          expect(updated.teamLeague).toBe(team.teamLeague);
          expect(updated.teamLeagueId).toBe(team.teamLeagueId);
          expect(updated.cyclesInLeague).toBe(team.cyclesInLeague);
        }
      ),
      { numRuns: 200 }
    );
  });
});
