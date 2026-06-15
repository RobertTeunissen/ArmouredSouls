/**
 * Tag Team Standings Sort and Filter Invariant - Property-Based Test
 * Feature: tag-team-system-unification, Property 10: Tag Team Standings Sort and Filter Invariant
 *
 * Validates that tag team standings are sorted by `tagTeamLp` descending,
 * instance filter returns correct subset, and pagination returns correct slice and total.
 *
 * Pure logic test — no database needed. We generate random arrays of team objects
 * and apply the standings sort/filter/pagination logic to verify invariants.
 *
 * **Validates: Requirements 10.1, 10.2, 10.4, 11.1, 11.2**
 */

import * as fc from 'fast-check';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Represents a TeamBattle row with fields relevant to tag team standings.
 */
interface TeamBattleRow {
  id: number;
  stableId: number;
  teamSize: 2;
  teamName: string;
  tagTeamLp: number;
  tagTeamLeague: string;
  tagTeamLeagueId: string;
  totalTagTeamWins: number;
  totalTagTeamLosses: number;
  totalTagTeamDraws: number;
  createdAt: Date;
  members: { robotId: number; name: string; elo: number; slotIndex: number }[];
}

interface StandingsEntry {
  rank: number;
  teamId: number;
  teamName: string;
  stableId: number;
  tagTeamLp: number;
  tagTeamLeague: string;
  tagTeamLeagueId: string;
  totalTagTeamWins: number;
  totalTagTeamLosses: number;
  totalTagTeamDraws: number;
  combinedELO: number;
  members: { id: number; name: string; elo: number; slotIndex: number }[];
}

interface PaginatedStandings {
  standings: StandingsEntry[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  tier: string;
}

// ─── Pure Logic: Standings Sort, Filter, Pagination ──────────────────────────

/**
 * Implements the same logic as the tag-team-standings endpoint:
 * 1. Filter by tier (tagTeamLeague) and optionally by instance (tagTeamLeagueId)
 * 2. Sort by tagTeamLp descending, then totalTagTeamWins descending, then createdAt ascending
 * 3. Paginate with page/perPage
 */
function getTagTeamStandings(
  teams: TeamBattleRow[],
  tier: string,
  options: { instance?: string; page?: number; perPage?: number } = {}
): PaginatedStandings {
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(100, Math.max(1, options.perPage ?? 50));

  // Filter by tier and optionally by instance
  let filtered = teams.filter(
    (t) => t.teamSize === 2 && t.tagTeamLeague === tier
  );
  if (options.instance) {
    filtered = filtered.filter((t) => t.tagTeamLeagueId === options.instance);
  }

  // Sort: tagTeamLp desc, totalTagTeamWins desc, createdAt asc
  const sorted = [...filtered].sort((a, b) => {
    if (b.tagTeamLp !== a.tagTeamLp) return b.tagTeamLp - a.tagTeamLp;
    if (b.totalTagTeamWins !== a.totalTagTeamWins) return b.totalTagTeamWins - a.totalTagTeamWins;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Pagination
  const total = sorted.length;
  const totalPages = Math.ceil(total / perPage);
  const skip = (page - 1) * perPage;
  const slice = sorted.slice(skip, skip + perPage);

  // Map to standings entries
  const standings: StandingsEntry[] = slice.map((team, index) => {
    const combinedELO = team.members.reduce((sum, m) => sum + m.elo, 0);
    return {
      rank: skip + index + 1,
      teamId: team.id,
      teamName: team.teamName,
      stableId: team.stableId,
      tagTeamLp: team.tagTeamLp,
      tagTeamLeague: team.tagTeamLeague,
      tagTeamLeagueId: team.tagTeamLeagueId,
      totalTagTeamWins: team.totalTagTeamWins,
      totalTagTeamLosses: team.totalTagTeamLosses,
      totalTagTeamDraws: team.totalTagTeamDraws,
      combinedELO,
      members: team.members.map((m) => ({
        id: m.robotId,
        name: m.name,
        elo: m.elo,
        slotIndex: m.slotIndex,
      })),
    };
  });

  return {
    standings,
    pagination: { page, pageSize: perPage, total, totalPages },
    tier,
  };
}

/**
 * Implements the tag-team-instances logic:
 * Group teams by tagTeamLeagueId where teamSize=2 and tagTeamLeague matches tier.
 */
function getTagTeamInstances(
  teams: TeamBattleRow[],
  tier: string
): { leagueId: string; leagueTier: string; currentTeams: number; maxTeams: number }[] {
  const MAX_TEAMS_PER_INSTANCE = 50;
  const filtered = teams.filter((t) => t.teamSize === 2 && t.tagTeamLeague === tier);

  const instanceMap = new Map<string, number>();
  for (const team of filtered) {
    instanceMap.set(team.tagTeamLeagueId, (instanceMap.get(team.tagTeamLeagueId) || 0) + 1);
  }

  return Array.from(instanceMap.entries()).map(([leagueId, count]) => ({
    leagueId,
    leagueTier: tier,
    currentTeams: count,
    maxTeams: MAX_TEAMS_PER_INSTANCE,
  }));
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;

const memberArb = fc.record({
  robotId: fc.integer({ min: 1, max: 100000 }),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  elo: fc.integer({ min: 500, max: 3000 }),
  slotIndex: fc.constantFrom(0, 1),
});

const teamBattleRowArb: fc.Arbitrary<TeamBattleRow> = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  stableId: fc.integer({ min: 1, max: 50000 }),
  teamSize: fc.constant(2 as const),
  teamName: fc.string({ minLength: 1, maxLength: 32 }),
  tagTeamLp: fc.integer({ min: 0, max: 5000 }),
  tagTeamLeague: fc.constantFrom(...TIERS),
  tagTeamLeagueId: fc.constantFrom(
    'bronze_1', 'bronze_2', 'silver_1', 'silver_2',
    'gold_1', 'gold_2', 'platinum_1', 'diamond_1', 'champion_1'
  ),
  totalTagTeamWins: fc.integer({ min: 0, max: 500 }),
  totalTagTeamLosses: fc.integer({ min: 0, max: 500 }),
  totalTagTeamDraws: fc.integer({ min: 0, max: 200 }),
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
  members: fc.tuple(
    memberArb.map((m) => ({ ...m, slotIndex: 0 })),
    memberArb.map((m) => ({ ...m, slotIndex: 1 }))
  ).map(([active, reserve]) => [active, reserve]),
});

// Generate arrays of teams with unique IDs
const teamArrayArb = fc.array(teamBattleRowArb, { minLength: 0, maxLength: 60 }).map((teams) => {
  // Ensure unique team IDs
  const seen = new Set<number>();
  return teams.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
});

const paginationArb = fc.record({
  page: fc.integer({ min: 1, max: 10 }),
  perPage: fc.integer({ min: 1, max: 100 }),
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Feature: tag-team-system-unification, Property 10: Tag Team Standings Sort and Filter Invariant', () => {
  /**
   * **Validates: Requirements 10.1, 10.2, 10.4, 11.1, 11.2**
   */

  describe('Sort invariant: standings sorted by tagTeamLp descending', () => {
    it('results are always sorted by tagTeamLp descending (primary sort)', () => {
      fc.assert(
        fc.property(
          teamArrayArb,
          fc.constantFrom(...TIERS),
          (teams, tier) => {
            const result = getTagTeamStandings(teams, tier);

            // Verify descending LP order
            for (let i = 1; i < result.standings.length; i++) {
              const prev = result.standings[i - 1];
              const curr = result.standings[i];
              // Primary sort: tagTeamLp descending
              expect(prev.tagTeamLp).toBeGreaterThanOrEqual(curr.tagTeamLp);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('tiebreaker: when tagTeamLp is equal, sort by totalTagTeamWins descending', () => {
      fc.assert(
        fc.property(
          teamArrayArb,
          fc.constantFrom(...TIERS),
          (teams, tier) => {
            const result = getTagTeamStandings(teams, tier);

            for (let i = 1; i < result.standings.length; i++) {
              const prev = result.standings[i - 1];
              const curr = result.standings[i];
              if (prev.tagTeamLp === curr.tagTeamLp) {
                // Secondary sort: totalTagTeamWins descending
                expect(prev.totalTagTeamWins).toBeGreaterThanOrEqual(curr.totalTagTeamWins);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rank values are sequential starting from 1', () => {
      fc.assert(
        fc.property(
          teamArrayArb,
          fc.constantFrom(...TIERS),
          (teams, tier) => {
            const result = getTagTeamStandings(teams, tier);

            for (let i = 0; i < result.standings.length; i++) {
              expect(result.standings[i].rank).toBe(i + 1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Filter invariant: instance filter returns correct subset', () => {
    it('when instance filter is provided, only teams with matching tagTeamLeagueId appear', () => {
      fc.assert(
        fc.property(
          teamArrayArb,
          fc.constantFrom(...TIERS),
          fc.constantFrom(
            'bronze_1', 'bronze_2', 'silver_1', 'silver_2',
            'gold_1', 'gold_2', 'platinum_1', 'diamond_1', 'champion_1'
          ),
          (teams, tier, instance) => {
            const result = getTagTeamStandings(teams, tier, { instance });

            // Every entry must have the filtered instance
            for (const entry of result.standings) {
              expect(entry.tagTeamLeagueId).toBe(instance);
            }

            // Total count matches filtered count
            const expectedCount = teams.filter(
              (t) => t.teamSize === 2 && t.tagTeamLeague === tier && t.tagTeamLeagueId === instance
            ).length;
            expect(result.pagination.total).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('without instance filter, all teams in the tier appear', () => {
      fc.assert(
        fc.property(
          teamArrayArb,
          fc.constantFrom(...TIERS),
          (teams, tier) => {
            const result = getTagTeamStandings(teams, tier);

            // Every entry must be in the requested tier
            for (const entry of result.standings) {
              expect(entry.tagTeamLeague).toBe(tier);
            }

            // Total matches all teams in that tier (considering pagination)
            const expectedTotal = teams.filter(
              (t) => t.teamSize === 2 && t.tagTeamLeague === tier
            ).length;
            expect(result.pagination.total).toBe(expectedTotal);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('non-matching instance returns empty standings with zero total', () => {
      fc.assert(
        fc.property(
          teamArrayArb,
          fc.constantFrom(...TIERS),
          (teams, tier) => {
            // Use a non-existent instance ID
            const result = getTagTeamStandings(teams, tier, { instance: 'nonexistent_999' });

            expect(result.standings).toHaveLength(0);
            expect(result.pagination.total).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Pagination invariant: correct slice and total', () => {
    it('pagination returns the correct slice of sorted results', () => {
      fc.assert(
        fc.property(
          teamArrayArb,
          fc.constantFrom(...TIERS),
          paginationArb,
          (teams, tier, pagination) => {
            const { page, perPage } = pagination;
            const result = getTagTeamStandings(teams, tier, { page, perPage });

            // Get all results (unpaginated) to compare
            const allResults = getTagTeamStandings(teams, tier, { page: 1, perPage: 100 });
            const expectedTotal = allResults.pagination.total;

            // Total must be consistent
            expect(result.pagination.total).toBe(expectedTotal);

            // Page size must match requested perPage
            expect(result.pagination.pageSize).toBe(perPage);

            // Returned items must not exceed perPage
            expect(result.standings.length).toBeLessThanOrEqual(perPage);

            // Calculate expected slice
            const skip = (page - 1) * perPage;
            const expectedSliceLength = Math.max(0, Math.min(perPage, expectedTotal - skip));
            expect(result.standings.length).toBe(expectedSliceLength);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('pagination rank is offset-based (not restarted per page)', () => {
      fc.assert(
        fc.property(
          teamArrayArb,
          fc.constantFrom(...TIERS),
          paginationArb,
          (teams, tier, pagination) => {
            const { page, perPage } = pagination;
            const result = getTagTeamStandings(teams, tier, { page, perPage });

            if (result.standings.length > 0) {
              // First rank on this page should be (page-1)*perPage + 1
              const expectedFirstRank = (page - 1) * perPage + 1;
              expect(result.standings[0].rank).toBe(expectedFirstRank);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('totalPages is correctly computed as ceil(total / perPage)', () => {
      fc.assert(
        fc.property(
          teamArrayArb,
          fc.constantFrom(...TIERS),
          paginationArb,
          (teams, tier, pagination) => {
            const { page, perPage } = pagination;
            const result = getTagTeamStandings(teams, tier, { page, perPage });

            const expectedTotalPages = Math.ceil(result.pagination.total / perPage);
            expect(result.pagination.totalPages).toBe(expectedTotalPages);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('page beyond total returns empty standings', () => {
      fc.assert(
        fc.property(
          teamArrayArb,
          fc.constantFrom(...TIERS),
          fc.integer({ min: 1, max: 100 }),
          (teams, tier, perPage) => {
            // Request a page that is definitely beyond the end
            const totalInTier = teams.filter(
              (t) => t.teamSize === 2 && t.tagTeamLeague === tier
            ).length;
            const beyondPage = Math.floor(totalInTier / perPage) + 2;
            const result = getTagTeamStandings(teams, tier, { page: beyondPage, perPage });

            if (totalInTier > 0 && beyondPage > Math.ceil(totalInTier / perPage)) {
              expect(result.standings).toHaveLength(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('perPage is clamped between 1 and 100', () => {
      fc.assert(
        fc.property(
          teamArrayArb,
          fc.constantFrom(...TIERS),
          fc.integer({ min: -50, max: 200 }),
          (teams, tier, rawPerPage) => {
            const result = getTagTeamStandings(teams, tier, { page: 1, perPage: rawPerPage });

            // perPage is clamped: min 1, max 100
            const expectedPerPage = Math.min(100, Math.max(1, rawPerPage));
            expect(result.pagination.pageSize).toBe(expectedPerPage);
            expect(result.standings.length).toBeLessThanOrEqual(expectedPerPage);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Instances invariant: correct grouping by tagTeamLeagueId', () => {
    it('instances returns one entry per distinct tagTeamLeagueId in the tier', () => {
      fc.assert(
        fc.property(
          teamArrayArb,
          fc.constantFrom(...TIERS),
          (teams, tier) => {
            const instances = getTagTeamInstances(teams, tier);

            // Expected distinct league IDs in this tier
            const teamsInTier = teams.filter(
              (t) => t.teamSize === 2 && t.tagTeamLeague === tier
            );
            const expectedIds = new Set(teamsInTier.map((t) => t.tagTeamLeagueId));

            expect(instances.length).toBe(expectedIds.size);
            for (const inst of instances) {
              expect(expectedIds.has(inst.leagueId)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('instances currentTeams count matches actual team count per instance', () => {
      fc.assert(
        fc.property(
          teamArrayArb,
          fc.constantFrom(...TIERS),
          (teams, tier) => {
            const instances = getTagTeamInstances(teams, tier);
            const teamsInTier = teams.filter(
              (t) => t.teamSize === 2 && t.tagTeamLeague === tier
            );

            for (const inst of instances) {
              const actualCount = teamsInTier.filter(
                (t) => t.tagTeamLeagueId === inst.leagueId
              ).length;
              expect(inst.currentTeams).toBe(actualCount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('instances maxTeams is always 50', () => {
      fc.assert(
        fc.property(
          teamArrayArb,
          fc.constantFrom(...TIERS),
          (teams, tier) => {
            const instances = getTagTeamInstances(teams, tier);

            for (const inst of instances) {
              expect(inst.maxTeams).toBe(50);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('instances leagueTier matches the requested tier', () => {
      fc.assert(
        fc.property(
          teamArrayArb,
          fc.constantFrom(...TIERS),
          (teams, tier) => {
            const instances = getTagTeamInstances(teams, tier);

            for (const inst of instances) {
              expect(inst.leagueTier).toBe(tier);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
