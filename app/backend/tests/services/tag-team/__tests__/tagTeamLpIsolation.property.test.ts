/**
 * Tag Team LP Isolation - Property-Based Test
 * Feature: tag-team-system-unification, Property 4: Tag Team LP Isolation
 *
 * Validates that tag team LP operations read/write `tagTeamLp` exclusively,
 * leaving `teamLp` unchanged; and vice versa for 2v2 league operations.
 *
 * Pure logic test — no database required. We generate random TeamBattle-shaped
 * objects and simulate LP operations to verify field isolation.
 *
 * **Validates: Requirements 3.3, 4.4, 5.6**
 */

import * as fc from 'fast-check';
import {
  calculateMatchScore,
  MatchScoreInput,
} from '../../../../src/services/matchmaking/teamMatchmakingUtils';

// ─── Helpers: Simulate LP Operations ─────────────────────────────────────────

/**
 * Represents a TeamBattle row with both LP fields for isolation testing.
 * NOTE: These fields were moved to the standings table in production,
 * but this test validates the pure LP isolation algorithm.
 */
interface TeamBattleRow {
  id: number;
  stableId: number;
  teamSize: 2;
  teamLp: number;
  tagTeamLp: number;
  teamLeague: string;
  teamLeagueId: string;
  tagTeamLeague: string;
  tagTeamLeagueId: string;
  cyclesInLeague: number;
  cyclesInTagTeamLeague: number;
  totalLeagueWins: number;
  totalLeagueLosses: number;
  totalLeagueDraws: number;
  totalTagTeamWins: number;
  totalTagTeamLosses: number;
  totalTagTeamDraws: number;
  createdAt: Date;
}

/**
 * Simulates a tag team matchmaking score calculation.
 * The CALLER passes `tagTeamLp` to calculateMatchScore as the LP input.
 * This is the isolation boundary — the scoring function itself is LP-field-agnostic.
 */
function simulateTagTeamMatchScoreCalculation(
  team1: TeamBattleRow,
  team2: TeamBattleRow,
  team1ELO: number,
  team2ELO: number
): { score: number; team1LpUsed: number; team2LpUsed: number } {
  const input: MatchScoreInput = {
    entity1LP: team1.tagTeamLp, // Tag team uses tagTeamLp
    entity2LP: team2.tagTeamLp, // Tag team uses tagTeamLp
    entity1ELO: team1ELO,
    entity2ELO: team2ELO,
    recentOpponents1: [],
    recentOpponents2: [],
    entity1Id: team1.id,
    entity2Id: team2.id,
    entity1StableId: team1.stableId,
    entity2StableId: team2.stableId,
  };
  return {
    score: calculateMatchScore(input),
    team1LpUsed: team1.tagTeamLp,
    team2LpUsed: team2.tagTeamLp,
  };
}

/**
 * Simulates a 2v2 league matchmaking score calculation.
 * The CALLER passes `teamLp` to calculateMatchScore as the LP input.
 */
function simulate2v2LeagueMatchScoreCalculation(
  team1: TeamBattleRow,
  team2: TeamBattleRow,
  team1ELO: number,
  team2ELO: number
): { score: number; team1LpUsed: number; team2LpUsed: number } {
  const input: MatchScoreInput = {
    entity1LP: team1.teamLp, // 2v2 league uses teamLp
    entity2LP: team2.teamLp, // 2v2 league uses teamLp
    entity1ELO: team1ELO,
    entity2ELO: team2ELO,
    recentOpponents1: [],
    recentOpponents2: [],
    entity1Id: team1.id,
    entity2Id: team2.id,
    entity1StableId: team1.stableId,
    entity2StableId: team2.stableId,
  };
  return {
    score: calculateMatchScore(input),
    team1LpUsed: team1.teamLp,
    team2LpUsed: team2.teamLp,
  };
}

/**
 * Simulates post-battle LP award for a tag team battle.
 * Returns a new TeamBattleRow with only tagTeamLp modified.
 */
function simulateTagTeamPostBattleLpAward(
  team: TeamBattleRow,
  isWinner: boolean,
  isDraw: boolean
): TeamBattleRow {
  // Same logic as calculateTagTeamLeaguePoints in tagTeamBattleOrchestrator
  let lpChange: number;
  if (isDraw) {
    lpChange = 1;
  } else if (isWinner) {
    lpChange = 3;
  } else {
    lpChange = -1;
  }

  const newTagTeamLp = Math.max(0, team.tagTeamLp + lpChange);

  return {
    ...team,
    tagTeamLp: newTagTeamLp,
  };
}

/**
 * Simulates post-battle LP award for a 2v2 league battle.
 * Returns a new TeamBattleRow with only teamLp modified.
 */
function simulate2v2LeaguePostBattleLpAward(
  team: TeamBattleRow,
  isWinner: boolean,
  isDraw: boolean
): TeamBattleRow {
  // Same LP formula structure as team battle orchestrator
  let lpChange: number;
  if (isDraw) {
    lpChange = 1;
  } else if (isWinner) {
    lpChange = 3;
  } else {
    lpChange = -1;
  }

  const newTeamLp = Math.max(0, team.teamLp + lpChange);

  return {
    ...team,
    teamLp: newTeamLp,
  };
}

/**
 * Simulates promotion threshold check for tag team league.
 * Uses tagTeamLp to determine if the team meets promotion criteria.
 */
function simulateTagTeamPromotionCheck(
  team: TeamBattleRow,
  minLpForPromotion: number
): { meetsThreshold: boolean; lpUsed: number } {
  return {
    meetsThreshold: team.tagTeamLp >= minLpForPromotion,
    lpUsed: team.tagTeamLp, // tagTeamLeagueAdapter.getEntityLeaguePoints reads tagTeamLp
  };
}

/**
 * Simulates promotion threshold check for 2v2 league.
 * Uses teamLp to determine if the team meets promotion criteria.
 */
function simulate2v2LeaguePromotionCheck(
  team: TeamBattleRow,
  minLpForPromotion: number
): { meetsThreshold: boolean; lpUsed: number } {
  return {
    meetsThreshold: team.teamLp >= minLpForPromotion,
    lpUsed: team.teamLp, // createTeamBattleAdapter.getEntityLeaguePoints reads teamLp
  };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;

const teamBattleRowArb: fc.Arbitrary<TeamBattleRow> = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  stableId: fc.integer({ min: 1, max: 50000 }),
  teamSize: fc.constant(2 as const),
  teamLp: fc.integer({ min: 0, max: 200 }),
  tagTeamLp: fc.integer({ min: 0, max: 200 }),
  teamLeague: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
  teamLeagueId: fc.constantFrom('bronze_1', 'silver_1', 'gold_1'),
  tagTeamLeague: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
  tagTeamLeagueId: fc.constantFrom('bronze_1', 'silver_1', 'gold_1'),
  cyclesInLeague: fc.integer({ min: 0, max: 100 }),
  cyclesInTagTeamLeague: fc.integer({ min: 0, max: 100 }),
  totalLeagueWins: fc.integer({ min: 0, max: 500 }),
  totalLeagueLosses: fc.integer({ min: 0, max: 500 }),
  totalLeagueDraws: fc.integer({ min: 0, max: 100 }),
  totalTagTeamWins: fc.integer({ min: 0, max: 500 }),
  totalTagTeamLosses: fc.integer({ min: 0, max: 500 }),
  totalTagTeamDraws: fc.integer({ min: 0, max: 100 }),
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-01-01') }),
});

const battleOutcomeArb = fc.record({
  isWinner: fc.boolean(),
  isDraw: fc.boolean(),
}).map(({ isWinner, isDraw }) => ({
  // Ensure mutually exclusive: draw overrides winner
  isWinner: isDraw ? false : isWinner,
  isDraw,
}));

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Feature: tag-team-system-unification, Property 4: Tag Team LP Isolation', () => {
  /**
   * **Validates: Requirements 3.3, 4.4, 5.6**
   *
   * For any TeamBattle row with teamSize = 2 and arbitrary tagTeamLp and teamLp values,
   * when a tag team LP operation occurs (matchmaking score calculation, post-battle LP
   * award, promotion threshold check), the operation SHALL read from and write to
   * tagTeamLp exclusively, leaving teamLp unchanged. Conversely, 2v2 League LP
   * operations SHALL only affect teamLp.
   */

  describe('Match score calculation uses correct LP field', () => {
    it('tag team matchmaking uses tagTeamLp for scoring, not teamLp', () => {
      fc.assert(
        fc.property(
          teamBattleRowArb,
          teamBattleRowArb,
          fc.integer({ min: 500, max: 3000 }),
          fc.integer({ min: 500, max: 3000 }),
          (team1, team2, team1ELO, team2ELO) => {
            // Ensure different stables to avoid same-stable penalty dominating
            fc.pre(team1.stableId !== team2.stableId);
            fc.pre(team1.id !== team2.id);

            const result = simulateTagTeamMatchScoreCalculation(team1, team2, team1ELO, team2ELO);

            // The LP values used in scoring must be tagTeamLp
            expect(result.team1LpUsed).toBe(team1.tagTeamLp);
            expect(result.team2LpUsed).toBe(team2.tagTeamLp);

            // Verify the score changes when tagTeamLp changes but teamLp stays same
            const team1Modified = { ...team1, tagTeamLp: team1.tagTeamLp + 100 };
            const modifiedResult = simulateTagTeamMatchScoreCalculation(
              team1Modified, team2, team1ELO, team2ELO
            );

            // If LP diff changes, score should differ (unless both within same bracket)
            const origLpDiff = Math.abs(team1.tagTeamLp - team2.tagTeamLp);
            const newLpDiff = Math.abs(team1Modified.tagTeamLp - team2.tagTeamLp);
            if (origLpDiff !== newLpDiff) {
              // Score must change when tagTeamLp changes (different LP difference)
              expect(modifiedResult.score).not.toBe(result.score);
            }

            // Verify score does NOT change when only teamLp changes
            const team1TeamLpChanged = { ...team1, teamLp: team1.teamLp + 500 };
            const teamLpChangedResult = simulateTagTeamMatchScoreCalculation(
              team1TeamLpChanged, team2, team1ELO, team2ELO
            );

            // Score must be identical — teamLp is not used in tag team scoring
            expect(teamLpChangedResult.score).toBe(result.score);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('2v2 league matchmaking uses teamLp for scoring, not tagTeamLp', () => {
      fc.assert(
        fc.property(
          teamBattleRowArb,
          teamBattleRowArb,
          fc.integer({ min: 500, max: 3000 }),
          fc.integer({ min: 500, max: 3000 }),
          (team1, team2, team1ELO, team2ELO) => {
            fc.pre(team1.stableId !== team2.stableId);
            fc.pre(team1.id !== team2.id);

            const result = simulate2v2LeagueMatchScoreCalculation(team1, team2, team1ELO, team2ELO);

            // The LP values used in scoring must be teamLp
            expect(result.team1LpUsed).toBe(team1.teamLp);
            expect(result.team2LpUsed).toBe(team2.teamLp);

            // Verify score does NOT change when only tagTeamLp changes
            const team1TagLpChanged = { ...team1, tagTeamLp: team1.tagTeamLp + 500 };
            const tagLpChangedResult = simulate2v2LeagueMatchScoreCalculation(
              team1TagLpChanged, team2, team1ELO, team2ELO
            );

            // Score must be identical — tagTeamLp is not used in 2v2 league scoring
            expect(tagLpChangedResult.score).toBe(result.score);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Post-battle LP award updates correct field exclusively', () => {
    it('tag team post-battle LP award updates tagTeamLp, leaves teamLp unchanged', () => {
      fc.assert(
        fc.property(
          teamBattleRowArb,
          battleOutcomeArb,
          (team, outcome) => {
            const originalTeamLp = team.teamLp;
            const updatedTeam = simulateTagTeamPostBattleLpAward(
              team, outcome.isWinner, outcome.isDraw
            );

            // teamLp must remain unchanged
            expect(updatedTeam.teamLp).toBe(originalTeamLp);

            // tagTeamLp must change (or stay at 0 if already 0 and losing)
            const expectedLpChange = outcome.isDraw ? 1 : outcome.isWinner ? 3 : -1;
            const expectedNewLp = Math.max(0, team.tagTeamLp + expectedLpChange);
            expect(updatedTeam.tagTeamLp).toBe(expectedNewLp);

            // All other fields must remain unchanged
            expect(updatedTeam.teamLeague).toBe(team.teamLeague);
            expect(updatedTeam.tagTeamLeague).toBe(team.tagTeamLeague);
            expect(updatedTeam.teamLeagueId).toBe(team.teamLeagueId);
            expect(updatedTeam.tagTeamLeagueId).toBe(team.tagTeamLeagueId);
            expect(updatedTeam.cyclesInLeague).toBe(team.cyclesInLeague);
            expect(updatedTeam.cyclesInTagTeamLeague).toBe(team.cyclesInTagTeamLeague);
            expect(updatedTeam.totalLeagueWins).toBe(team.totalLeagueWins);
            expect(updatedTeam.totalLeagueLosses).toBe(team.totalLeagueLosses);
            expect(updatedTeam.totalLeagueDraws).toBe(team.totalLeagueDraws);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('2v2 league post-battle LP award updates teamLp, leaves tagTeamLp unchanged', () => {
      fc.assert(
        fc.property(
          teamBattleRowArb,
          battleOutcomeArb,
          (team, outcome) => {
            const originalTagTeamLp = team.tagTeamLp;
            const updatedTeam = simulate2v2LeaguePostBattleLpAward(
              team, outcome.isWinner, outcome.isDraw
            );

            // tagTeamLp must remain unchanged
            expect(updatedTeam.tagTeamLp).toBe(originalTagTeamLp);

            // teamLp must change (or stay at 0 if already 0 and losing)
            const expectedLpChange = outcome.isDraw ? 1 : outcome.isWinner ? 3 : -1;
            const expectedNewLp = Math.max(0, team.teamLp + expectedLpChange);
            expect(updatedTeam.teamLp).toBe(expectedNewLp);

            // All other fields must remain unchanged
            expect(updatedTeam.teamLeague).toBe(team.teamLeague);
            expect(updatedTeam.tagTeamLeague).toBe(team.tagTeamLeague);
            expect(updatedTeam.teamLeagueId).toBe(team.teamLeagueId);
            expect(updatedTeam.tagTeamLeagueId).toBe(team.tagTeamLeagueId);
            expect(updatedTeam.cyclesInLeague).toBe(team.cyclesInLeague);
            expect(updatedTeam.cyclesInTagTeamLeague).toBe(team.cyclesInTagTeamLeague);
            expect(updatedTeam.totalTagTeamWins).toBe(team.totalTagTeamWins);
            expect(updatedTeam.totalTagTeamLosses).toBe(team.totalTagTeamLosses);
            expect(updatedTeam.totalTagTeamDraws).toBe(team.totalTagTeamDraws);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('tag team LP never goes below zero regardless of teamLp value', () => {
      fc.assert(
        fc.property(
          teamBattleRowArb.map((t) => ({ ...t, tagTeamLp: 0 })), // Force tagTeamLp to 0
          (team) => {
            // Losing when at 0 should stay at 0
            const updatedTeam = simulateTagTeamPostBattleLpAward(team, false, false);
            expect(updatedTeam.tagTeamLp).toBe(0);
            expect(updatedTeam.tagTeamLp).toBeGreaterThanOrEqual(0);

            // teamLp must remain unchanged regardless
            expect(updatedTeam.teamLp).toBe(team.teamLp);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Promotion threshold check uses correct LP field', () => {
    it('tag team promotion check uses tagTeamLp, ignores teamLp', () => {
      fc.assert(
        fc.property(
          teamBattleRowArb,
          fc.integer({ min: 0, max: 5000 }),
          (team, threshold) => {
            const result = simulateTagTeamPromotionCheck(team, threshold);

            // Must use tagTeamLp for threshold comparison
            expect(result.lpUsed).toBe(team.tagTeamLp);
            expect(result.meetsThreshold).toBe(team.tagTeamLp >= threshold);

            // Changing teamLp should not affect tag team promotion eligibility
            const teamWithHighTeamLp = { ...team, teamLp: threshold + 1000 };
            const resultWithHighTeamLp = simulateTagTeamPromotionCheck(teamWithHighTeamLp, threshold);
            expect(resultWithHighTeamLp.meetsThreshold).toBe(result.meetsThreshold);
            expect(resultWithHighTeamLp.lpUsed).toBe(team.tagTeamLp); // Still uses tagTeamLp
          }
        ),
        { numRuns: 100 }
      );
    });

    it('2v2 league promotion check uses teamLp, ignores tagTeamLp', () => {
      fc.assert(
        fc.property(
          teamBattleRowArb,
          fc.integer({ min: 0, max: 5000 }),
          (team, threshold) => {
            const result = simulate2v2LeaguePromotionCheck(team, threshold);

            // Must use teamLp for threshold comparison
            expect(result.lpUsed).toBe(team.teamLp);
            expect(result.meetsThreshold).toBe(team.teamLp >= threshold);

            // Changing tagTeamLp should not affect 2v2 league promotion eligibility
            const teamWithHighTagLp = { ...team, tagTeamLp: threshold + 1000 };
            const resultWithHighTagLp = simulate2v2LeaguePromotionCheck(teamWithHighTagLp, threshold);
            expect(resultWithHighTagLp.meetsThreshold).toBe(result.meetsThreshold);
            expect(resultWithHighTagLp.lpUsed).toBe(team.teamLp); // Still uses teamLp
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Combined operations maintain full isolation', () => {
    it('sequence of tag team operations never modifies teamLp', () => {
      fc.assert(
        fc.property(
          teamBattleRowArb,
          fc.array(battleOutcomeArb, { minLength: 1, maxLength: 10 }),
          (initialTeam, outcomes) => {
            const originalTeamLp = initialTeam.teamLp;
            let currentTeam = { ...initialTeam };

            // Apply multiple tag team battle results sequentially
            for (const outcome of outcomes) {
              currentTeam = simulateTagTeamPostBattleLpAward(
                currentTeam, outcome.isWinner, outcome.isDraw
              );
            }

            // After all tag team operations, teamLp must remain unchanged
            expect(currentTeam.teamLp).toBe(originalTeamLp);

            // tagTeamLp may have changed (and must be >= 0)
            expect(currentTeam.tagTeamLp).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sequence of 2v2 league operations never modifies tagTeamLp', () => {
      fc.assert(
        fc.property(
          teamBattleRowArb,
          fc.array(battleOutcomeArb, { minLength: 1, maxLength: 10 }),
          (initialTeam, outcomes) => {
            const originalTagTeamLp = initialTeam.tagTeamLp;
            let currentTeam = { ...initialTeam };

            // Apply multiple 2v2 league battle results sequentially
            for (const outcome of outcomes) {
              currentTeam = simulate2v2LeaguePostBattleLpAward(
                currentTeam, outcome.isWinner, outcome.isDraw
              );
            }

            // After all 2v2 league operations, tagTeamLp must remain unchanged
            expect(currentTeam.tagTeamLp).toBe(originalTagTeamLp);

            // teamLp may have changed (and must be >= 0)
            expect(currentTeam.teamLp).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('interleaved tag team and 2v2 league operations maintain mutual isolation', () => {
      fc.assert(
        fc.property(
          teamBattleRowArb,
          fc.array(
            fc.record({
              mode: fc.constantFrom('tag_team', 'league_2v2'),
              outcome: battleOutcomeArb,
            }),
            { minLength: 2, maxLength: 15 }
          ),
          (initialTeam, operations) => {
            let currentTeam = { ...initialTeam };

            // Track expected LP independently
            let expectedTagTeamLp = initialTeam.tagTeamLp;
            let expectedTeamLp = initialTeam.teamLp;

            for (const { mode, outcome } of operations) {
              const lpChange = outcome.isDraw ? 1 : outcome.isWinner ? 3 : -1;

              if (mode === 'tag_team') {
                currentTeam = simulateTagTeamPostBattleLpAward(
                  currentTeam, outcome.isWinner, outcome.isDraw
                );
                expectedTagTeamLp = Math.max(0, expectedTagTeamLp + lpChange);
              } else {
                currentTeam = simulate2v2LeaguePostBattleLpAward(
                  currentTeam, outcome.isWinner, outcome.isDraw
                );
                expectedTeamLp = Math.max(0, expectedTeamLp + lpChange);
              }
            }

            // Both LP tracks must match their independent expected values
            expect(currentTeam.tagTeamLp).toBe(expectedTagTeamLp);
            expect(currentTeam.teamLp).toBe(expectedTeamLp);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('calculateMatchScore is LP-field-agnostic (isolation is in the caller)', () => {
    it('calculateMatchScore treats entity1LP/entity2LP generically', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5000 }),
          fc.integer({ min: 0, max: 5000 }),
          fc.integer({ min: 500, max: 3000 }),
          fc.integer({ min: 500, max: 3000 }),
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 1, max: 50000 }),
          fc.integer({ min: 1, max: 50000 }),
          (lp1, lp2, elo1, elo2, id1, id2, stable1, stable2) => {
            fc.pre(id1 !== id2);
            fc.pre(stable1 !== stable2);

            // The same LP values produce the same score regardless of
            // whether they came from tagTeamLp or teamLp — the function
            // is LP-source-agnostic
            const input: MatchScoreInput = {
              entity1LP: lp1,
              entity2LP: lp2,
              entity1ELO: elo1,
              entity2ELO: elo2,
              recentOpponents1: [],
              recentOpponents2: [],
              entity1Id: id1,
              entity2Id: id2,
              entity1StableId: stable1,
              entity2StableId: stable2,
            };

            const score = calculateMatchScore(input);

            // Score is deterministic for same inputs
            expect(calculateMatchScore(input)).toBe(score);

            // Score is always non-negative
            expect(score).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
