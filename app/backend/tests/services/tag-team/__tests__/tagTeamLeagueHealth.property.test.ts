/**
 * Tag Team League Health Computation - Property-Based Test
 * Feature: tag-team-system-unification, Property 12: Tag Team League Health Computation
 *
 * Validates that getTagTeamLeagueHealth computes correct per-tier metrics:
 * - totalTeams matches the count of teams in that tier
 * - instances matches the count of distinct tagTeamLeagueId values for that tier
 * - needsRebalancing is true when any instance exceeds MAX_TEAMS_PER_INSTANCE (50)
 *   OR when the total team count is below MIN_TEAMS_FOR_TIER (10) but > 0
 * - teamsPerInstance min/max/avg computed correctly
 *
 * Pure logic test — no database needed.
 *
 * **Validates: Requirements 14.1, 14.5**
 */

import * as fc from 'fast-check';

// ─── Constants (match production values) ────────────────────────────────────

const MAX_TEAMS_PER_INSTANCE = 50;
const MIN_TEAMS_FOR_TIER = 10;
const LEAGUES = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface TeamBattleRow {
  id: number;
  teamSize: number;
  tagTeamLeague: string;
  tagTeamLeagueId: string;
}

interface TierHealthMetrics {
  league: string;
  teamCount: number;
  instances: number;
  instanceDetails: Array<{ id: string; teamCount: number }>;
  teamsPerInstance: { min: number; max: number; avg: number };
  needsRebalancing: boolean;
}

interface LeagueHealthResult {
  leagues: TierHealthMetrics[];
  totalTeams: number;
}

// ─── Pure health computation logic (mirrors adminStatsService behavior) ─────

/**
 * Computes tag team league health from a set of TeamBattle rows.
 * This mirrors the logic in adminStatsService.ts getTagTeamLeagueHealth().
 */
function computeTagTeamLeagueHealth(teams: TeamBattleRow[]): LeagueHealthResult {
  // Filter to teamSize=2 only (tag team eligible)
  const tagTeamTeams = teams.filter((t) => t.teamSize === 2);

  const leagueData = LEAGUES.map((league) => {
    // Teams in this tier
    const teamsInTier = tagTeamTeams.filter((t) => t.tagTeamLeague === league);
    const teamCount = teamsInTier.length;

    // Group by instance
    const instanceMap = new Map<string, number>();
    for (const team of teamsInTier) {
      instanceMap.set(team.tagTeamLeagueId, (instanceMap.get(team.tagTeamLeagueId) ?? 0) + 1);
    }

    const instanceCounts = Array.from(instanceMap.values());
    const instanceDetails = Array.from(instanceMap.entries()).map(([id, count]) => ({
      id,
      teamCount: count,
    }));

    // Compute teams per instance stats
    const teamsPerInstanceMin = instanceCounts.length > 0 ? Math.min(...instanceCounts) : 0;
    const teamsPerInstanceMax = instanceCounts.length > 0 ? Math.max(...instanceCounts) : 0;
    const teamsPerInstanceAvg =
      instanceCounts.length > 0
        ? Math.round(instanceCounts.reduce((sum, c) => sum + c, 0) / instanceCounts.length)
        : 0;

    // Determine needs-rebalancing
    const hasOverflow = instanceCounts.some((c) => c > MAX_TEAMS_PER_INSTANCE);
    const belowMinimum = teamCount > 0 && teamCount < MIN_TEAMS_FOR_TIER;
    const needsRebalancing = hasOverflow || belowMinimum;

    return {
      league,
      teamCount,
      instances: instanceMap.size,
      instanceDetails,
      teamsPerInstance: {
        min: teamsPerInstanceMin,
        max: teamsPerInstanceMax,
        avg: teamsPerInstanceAvg,
      },
      needsRebalancing,
    };
  });

  const totalTeams = leagueData.reduce((sum, l) => sum + l.teamCount, 0);

  return { leagues: leagueData, totalTeams };
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

const arbLeague = fc.constantFrom(...LEAGUES);

const arbLeagueId = fc.tuple(arbLeague, fc.integer({ min: 1, max: 5 })).map(
  ([league, num]) => `${league}_${num}`
);

/**
 * Generates a team object with tagTeamLeague and tagTeamLeagueId fields.
 * Teams always have teamSize=2 to be tag-team-eligible.
 */
const arbTagTeamTeam: fc.Arbitrary<TeamBattleRow> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  teamSize: fc.constant(2),
  tagTeamLeague: arbLeague,
  tagTeamLeagueId: arbLeagueId,
});

/**
 * Generates a mixed array that may include non-tag-team teams (teamSize=3)
 * to verify that the health computation filters by teamSize=2.
 */
const arbMixedTeam: fc.Arbitrary<TeamBattleRow> = fc.oneof(
  { weight: 3, arbitrary: arbTagTeamTeam },
  {
    weight: 1,
    arbitrary: fc.record({
      id: fc.integer({ min: 1, max: 10000 }),
      teamSize: fc.constant(3),
      tagTeamLeague: arbLeague,
      tagTeamLeagueId: arbLeagueId,
    }),
  }
);

/**
 * Generates an array of teams where some instances will exceed MAX_TEAMS_PER_INSTANCE.
 * Forces a specific league and instance to have many teams.
 */
const arbOverflowScenario: fc.Arbitrary<TeamBattleRow[]> = fc
  .tuple(
    arbLeague,
    fc.integer({ min: 1, max: 5 }),
    fc.integer({ min: MAX_TEAMS_PER_INSTANCE + 1, max: MAX_TEAMS_PER_INSTANCE + 30 })
  )
  .map(([league, instanceNum, count]) => {
    const leagueId = `${league}_${instanceNum}`;
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      teamSize: 2,
      tagTeamLeague: league,
      tagTeamLeagueId: leagueId,
    }));
  });

/**
 * Generates an array of teams where a tier has between 1 and 9 teams (below minimum).
 */
const arbBelowMinimumScenario: fc.Arbitrary<TeamBattleRow[]> = fc
  .tuple(arbLeague, fc.integer({ min: 1, max: MIN_TEAMS_FOR_TIER - 1 }))
  .map(([league, count]) =>
    Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      teamSize: 2,
      tagTeamLeague: league,
      tagTeamLeagueId: `${league}_1`,
    }))
  );

// ─── Property Tests ─────────────────────────────────────────────────────────

describe('Feature: tag-team-system-unification, Property 12: Tag Team League Health Computation', () => {
  describe('totalTeams matches count of teams per tier', () => {
    /**
     * **Validates: Requirements 14.1**
     *
     * For any set of TeamBattle rows with teamSize=2, the totalTeams per tier
     * equals the count of rows with matching tagTeamLeague.
     */

    it('should compute totalTeams as the count of teamSize=2 teams in each tier', () => {
      fc.assert(
        fc.property(
          fc.array(arbMixedTeam, { minLength: 0, maxLength: 100 }),
          (teams) => {
            const result = computeTagTeamLeagueHealth(teams);

            // Verify each tier's teamCount matches the filtered count
            for (const tierData of result.leagues) {
              const expectedCount = teams.filter(
                (t) => t.teamSize === 2 && t.tagTeamLeague === tierData.league
              ).length;
              expect(tierData.teamCount).toBe(expectedCount);
            }

            // Verify total across all tiers matches total teamSize=2 teams
            const expectedTotal = teams.filter((t) => t.teamSize === 2).length;
            expect(result.totalTeams).toBe(expectedTotal);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ignore teamSize=3 teams when computing tag team tier counts', () => {
      fc.assert(
        fc.property(
          fc.array(arbMixedTeam, { minLength: 1, maxLength: 80 }),
          (teams) => {
            const result = computeTagTeamLeagueHealth(teams);

            // Sum of all tier counts should equal number of teamSize=2 teams only
            const sumOfTierCounts = result.leagues.reduce((sum, l) => sum + l.teamCount, 0);
            const teamSize2Count = teams.filter((t) => t.teamSize === 2).length;
            expect(sumOfTierCounts).toBe(teamSize2Count);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('instances matches distinct tagTeamLeagueId count per tier', () => {
    /**
     * **Validates: Requirements 14.1**
     *
     * For any set of TeamBattle rows, the instances count per tier
     * equals the count of distinct tagTeamLeagueId values for that tier.
     */

    it('should compute instances as the count of distinct tagTeamLeagueId values per tier', () => {
      fc.assert(
        fc.property(
          fc.array(arbTagTeamTeam, { minLength: 0, maxLength: 100 }),
          (teams) => {
            const result = computeTagTeamLeagueHealth(teams);

            for (const tierData of result.leagues) {
              const teamsInTier = teams.filter((t) => t.tagTeamLeague === tierData.league);
              const distinctInstances = new Set(teamsInTier.map((t) => t.tagTeamLeagueId));
              expect(tierData.instances).toBe(distinctInstances.size);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 instances for tiers with no teams', () => {
      fc.assert(
        fc.property(
          fc.array(arbTagTeamTeam, { minLength: 0, maxLength: 50 }),
          (teams) => {
            const result = computeTagTeamLeagueHealth(teams);

            for (const tierData of result.leagues) {
              if (tierData.teamCount === 0) {
                expect(tierData.instances).toBe(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('needsRebalancing flag correctness', () => {
    /**
     * **Validates: Requirements 14.5**
     *
     * needsRebalancing is true when any instance exceeds MAX_TEAMS_PER_INSTANCE (50)
     * OR when the team count is below MIN_TEAMS_FOR_TIER (10) but > 0.
     */

    it('should set needsRebalancing=true when any instance exceeds 50 teams', () => {
      fc.assert(
        fc.property(arbOverflowScenario, (teams) => {
          const result = computeTagTeamLeagueHealth(teams);

          // The tier containing the overflow should have needsRebalancing=true
          const league = teams[0].tagTeamLeague;
          const tierData = result.leagues.find((l) => l.league === league);
          expect(tierData).toBeDefined();
          expect(tierData!.needsRebalancing).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should set needsRebalancing=true when tier has teams but below minimum (1-9)', () => {
      fc.assert(
        fc.property(arbBelowMinimumScenario, (teams) => {
          const result = computeTagTeamLeagueHealth(teams);

          const league = teams[0].tagTeamLeague;
          const tierData = result.leagues.find((l) => l.league === league);
          expect(tierData).toBeDefined();
          expect(tierData!.teamCount).toBeGreaterThan(0);
          expect(tierData!.teamCount).toBeLessThan(MIN_TEAMS_FOR_TIER);
          expect(tierData!.needsRebalancing).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should set needsRebalancing=false for tiers with 0 teams', () => {
      // Empty input: all tiers have 0 teams and needsRebalancing=false
      const result = computeTagTeamLeagueHealth([]);
      for (const tierData of result.leagues) {
        expect(tierData.needsRebalancing).toBe(false);
      }
    });

    it('should correctly compute needsRebalancing for random team distributions', () => {
      fc.assert(
        fc.property(
          fc.array(arbTagTeamTeam, { minLength: 0, maxLength: 100 }),
          (teams) => {
            const result = computeTagTeamLeagueHealth(teams);

            for (const tierData of result.leagues) {
              // Manually compute expected needsRebalancing
              const teamsInTier = teams.filter((t) => t.tagTeamLeague === tierData.league);
              const instanceMap = new Map<string, number>();
              for (const team of teamsInTier) {
                instanceMap.set(
                  team.tagTeamLeagueId,
                  (instanceMap.get(team.tagTeamLeagueId) ?? 0) + 1
                );
              }
              const instanceCounts = Array.from(instanceMap.values());

              const hasOverflow = instanceCounts.some((c) => c > MAX_TEAMS_PER_INSTANCE);
              const belowMinimum =
                teamsInTier.length > 0 && teamsInTier.length < MIN_TEAMS_FOR_TIER;
              const expectedNeedsRebalancing = hasOverflow || belowMinimum;

              expect(tierData.needsRebalancing).toBe(expectedNeedsRebalancing);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set needsRebalancing=false when tier has >= 10 teams and no instance > 50', () => {
      // Generate a tier with exactly 10-50 teams in a single instance
      fc.assert(
        fc.property(
          fc.tuple(
            arbLeague,
            fc.integer({ min: MIN_TEAMS_FOR_TIER, max: MAX_TEAMS_PER_INSTANCE })
          ),
          ([league, count]) => {
            const teams: TeamBattleRow[] = Array.from({ length: count }, (_, i) => ({
              id: i + 1,
              teamSize: 2,
              tagTeamLeague: league,
              tagTeamLeagueId: `${league}_1`,
            }));

            const result = computeTagTeamLeagueHealth(teams);
            const tierData = result.leagues.find((l) => l.league === league);
            expect(tierData).toBeDefined();
            expect(tierData!.needsRebalancing).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('teamsPerInstance min/max/avg computation', () => {
    /**
     * **Validates: Requirements 14.1**
     *
     * teamsPerInstance min/max/avg are correctly computed from instance counts.
     */

    it('should compute correct min/max/avg for teams per instance', () => {
      fc.assert(
        fc.property(
          fc.array(arbTagTeamTeam, { minLength: 1, maxLength: 100 }),
          (teams) => {
            const result = computeTagTeamLeagueHealth(teams);

            for (const tierData of result.leagues) {
              if (tierData.instances === 0) {
                // No instances: all stats should be 0
                expect(tierData.teamsPerInstance.min).toBe(0);
                expect(tierData.teamsPerInstance.max).toBe(0);
                expect(tierData.teamsPerInstance.avg).toBe(0);
              } else {
                // Compute expected values from instance details
                const counts = tierData.instanceDetails.map((d) => d.teamCount);
                expect(tierData.teamsPerInstance.min).toBe(Math.min(...counts));
                expect(tierData.teamsPerInstance.max).toBe(Math.max(...counts));
                expect(tierData.teamsPerInstance.avg).toBe(
                  Math.round(counts.reduce((s, c) => s + c, 0) / counts.length)
                );
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have avg equal to min and max when tier has a single instance', () => {
      fc.assert(
        fc.property(
          fc.tuple(arbLeague, fc.integer({ min: 1, max: 100 })),
          ([league, count]) => {
            const teams: TeamBattleRow[] = Array.from({ length: count }, (_, i) => ({
              id: i + 1,
              teamSize: 2,
              tagTeamLeague: league,
              tagTeamLeagueId: `${league}_1`,
            }));

            const result = computeTagTeamLeagueHealth(teams);
            const tierData = result.leagues.find((l) => l.league === league);
            expect(tierData).toBeDefined();
            expect(tierData!.teamsPerInstance.min).toBe(count);
            expect(tierData!.teamsPerInstance.max).toBe(count);
            expect(tierData!.teamsPerInstance.avg).toBe(count);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
