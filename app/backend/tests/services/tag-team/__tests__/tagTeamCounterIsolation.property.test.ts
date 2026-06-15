/**
 * Tag Team Counter Isolation - Property-Based Test
 * Feature: tag-team-system-unification, Property 5: Tag Team Win Counter Isolation
 *
 * Validates that post-battle updates increment exactly one of
 * totalTagTeamWins/totalTagTeamLosses/totalTagTeamDraws by 1 and leave
 * totalLeagueWins/totalLeagueLosses/totalLeagueDraws unchanged.
 *
 * Also tests the reverse: a 2v2 league battle increments league counters
 * and leaves tag team counters unchanged.
 *
 * Pure logic — no database required.
 *
 * **Validates: Requirements 4.3**
 */

import * as fc from 'fast-check';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TeamBattleCounters {
  totalLeagueWins: number;
  totalLeagueLosses: number;
  totalLeagueDraws: number;
  totalTagTeamWins: number;
  totalTagTeamLosses: number;
  totalTagTeamDraws: number;
}

type BattleOutcome = 'win' | 'loss' | 'draw';

// ─── Pure counter update logic (mirrors orchestrator behavior) ──────────────

/**
 * Applies a tag team battle outcome to the team's counters.
 * This mirrors the logic in tagTeamBattleOrchestrator.ts which updates
 * totalTagTeamWins/Losses/Draws and leaves totalLeagueWins/Losses/Draws unchanged.
 */
function applyTagTeamBattleOutcome(
  counters: TeamBattleCounters,
  outcome: BattleOutcome
): TeamBattleCounters {
  return {
    // League counters remain unchanged
    totalLeagueWins: counters.totalLeagueWins,
    totalLeagueLosses: counters.totalLeagueLosses,
    totalLeagueDraws: counters.totalLeagueDraws,
    // Tag team counters: increment exactly one by 1
    totalTagTeamWins: counters.totalTagTeamWins + (outcome === 'win' ? 1 : 0),
    totalTagTeamLosses: counters.totalTagTeamLosses + (outcome === 'loss' ? 1 : 0),
    totalTagTeamDraws: counters.totalTagTeamDraws + (outcome === 'draw' ? 1 : 0),
  };
}

/**
 * Applies a 2v2 league battle outcome to the team's counters.
 * This mirrors the logic in teamBattleOrchestrator.ts which updates
 * totalLeagueWins/Losses/Draws and leaves totalTagTeamWins/Losses/Draws unchanged.
 */
function applyLeagueBattleOutcome(
  counters: TeamBattleCounters,
  outcome: BattleOutcome
): TeamBattleCounters {
  return {
    // League counters: increment exactly one by 1
    totalLeagueWins: counters.totalLeagueWins + (outcome === 'win' ? 1 : 0),
    totalLeagueLosses: counters.totalLeagueLosses + (outcome === 'loss' ? 1 : 0),
    totalLeagueDraws: counters.totalLeagueDraws + (outcome === 'draw' ? 1 : 0),
    // Tag team counters remain unchanged
    totalTagTeamWins: counters.totalTagTeamWins,
    totalTagTeamLosses: counters.totalTagTeamLosses,
    totalTagTeamDraws: counters.totalTagTeamDraws,
  };
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

const arbCounters: fc.Arbitrary<TeamBattleCounters> = fc.record({
  totalLeagueWins: fc.integer({ min: 0, max: 1000 }),
  totalLeagueLosses: fc.integer({ min: 0, max: 1000 }),
  totalLeagueDraws: fc.integer({ min: 0, max: 1000 }),
  totalTagTeamWins: fc.integer({ min: 0, max: 1000 }),
  totalTagTeamLosses: fc.integer({ min: 0, max: 1000 }),
  totalTagTeamDraws: fc.integer({ min: 0, max: 1000 }),
});

const arbOutcome: fc.Arbitrary<BattleOutcome> = fc.constantFrom('win', 'loss', 'draw');

// ─── Property Tests ─────────────────────────────────────────────────────────

describe('Feature: tag-team-system-unification, Property 5: Tag Team Win Counter Isolation', () => {
  describe('Tag team battle updates tag team counters only', () => {
    /**
     * **Validates: Requirements 4.3**
     *
     * For any tag team battle result (win, loss, or draw), the post-battle update
     * SHALL increment exactly one of totalTagTeamWins, totalTagTeamLosses, or
     * totalTagTeamDraws by 1, and SHALL leave totalLeagueWins, totalLeagueLosses,
     * and totalLeagueDraws unchanged.
     */

    it('should increment exactly one tag team counter by 1', () => {
      fc.assert(
        fc.property(arbCounters, arbOutcome, (before, outcome) => {
          const after = applyTagTeamBattleOutcome(before, outcome);

          // Compute deltas for tag team counters
          const tagTeamWinDelta = after.totalTagTeamWins - before.totalTagTeamWins;
          const tagTeamLossDelta = after.totalTagTeamLosses - before.totalTagTeamLosses;
          const tagTeamDrawDelta = after.totalTagTeamDraws - before.totalTagTeamDraws;

          // Exactly one counter should have incremented by 1
          const totalDelta = tagTeamWinDelta + tagTeamLossDelta + tagTeamDrawDelta;
          expect(totalDelta).toBe(1);

          // Each individual delta must be either 0 or 1
          expect(tagTeamWinDelta).toBeGreaterThanOrEqual(0);
          expect(tagTeamWinDelta).toBeLessThanOrEqual(1);
          expect(tagTeamLossDelta).toBeGreaterThanOrEqual(0);
          expect(tagTeamLossDelta).toBeLessThanOrEqual(1);
          expect(tagTeamDrawDelta).toBeGreaterThanOrEqual(0);
          expect(tagTeamDrawDelta).toBeLessThanOrEqual(1);
        }),
        { numRuns: 200 }
      );
    });

    it('should leave all three league counters unchanged after a tag team battle', () => {
      fc.assert(
        fc.property(arbCounters, arbOutcome, (before, outcome) => {
          const after = applyTagTeamBattleOutcome(before, outcome);

          // All league counters must remain exactly the same
          expect(after.totalLeagueWins).toBe(before.totalLeagueWins);
          expect(after.totalLeagueLosses).toBe(before.totalLeagueLosses);
          expect(after.totalLeagueDraws).toBe(before.totalLeagueDraws);
        }),
        { numRuns: 200 }
      );
    });

    it('should increment the correct counter based on outcome', () => {
      fc.assert(
        fc.property(arbCounters, arbOutcome, (before, outcome) => {
          const after = applyTagTeamBattleOutcome(before, outcome);

          if (outcome === 'win') {
            expect(after.totalTagTeamWins).toBe(before.totalTagTeamWins + 1);
            expect(after.totalTagTeamLosses).toBe(before.totalTagTeamLosses);
            expect(after.totalTagTeamDraws).toBe(before.totalTagTeamDraws);
          } else if (outcome === 'loss') {
            expect(after.totalTagTeamWins).toBe(before.totalTagTeamWins);
            expect(after.totalTagTeamLosses).toBe(before.totalTagTeamLosses + 1);
            expect(after.totalTagTeamDraws).toBe(before.totalTagTeamDraws);
          } else {
            expect(after.totalTagTeamWins).toBe(before.totalTagTeamWins);
            expect(after.totalTagTeamLosses).toBe(before.totalTagTeamLosses);
            expect(after.totalTagTeamDraws).toBe(before.totalTagTeamDraws + 1);
          }
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('League battle updates league counters only (reverse isolation)', () => {
    /**
     * **Validates: Requirements 4.3**
     *
     * For any 2v2 league battle result, the post-battle update SHALL increment
     * exactly one of totalLeagueWins, totalLeagueLosses, or totalLeagueDraws by 1,
     * and SHALL leave totalTagTeamWins, totalTagTeamLosses, and totalTagTeamDraws
     * unchanged.
     */

    it('should increment exactly one league counter by 1', () => {
      fc.assert(
        fc.property(arbCounters, arbOutcome, (before, outcome) => {
          const after = applyLeagueBattleOutcome(before, outcome);

          // Compute deltas for league counters
          const leagueWinDelta = after.totalLeagueWins - before.totalLeagueWins;
          const leagueLossDelta = after.totalLeagueLosses - before.totalLeagueLosses;
          const leagueDrawDelta = after.totalLeagueDraws - before.totalLeagueDraws;

          // Exactly one counter should have incremented by 1
          const totalDelta = leagueWinDelta + leagueLossDelta + leagueDrawDelta;
          expect(totalDelta).toBe(1);

          // Each individual delta must be either 0 or 1
          expect(leagueWinDelta).toBeGreaterThanOrEqual(0);
          expect(leagueWinDelta).toBeLessThanOrEqual(1);
          expect(leagueLossDelta).toBeGreaterThanOrEqual(0);
          expect(leagueLossDelta).toBeLessThanOrEqual(1);
          expect(leagueDrawDelta).toBeGreaterThanOrEqual(0);
          expect(leagueDrawDelta).toBeLessThanOrEqual(1);
        }),
        { numRuns: 200 }
      );
    });

    it('should leave all three tag team counters unchanged after a league battle', () => {
      fc.assert(
        fc.property(arbCounters, arbOutcome, (before, outcome) => {
          const after = applyLeagueBattleOutcome(before, outcome);

          // All tag team counters must remain exactly the same
          expect(after.totalTagTeamWins).toBe(before.totalTagTeamWins);
          expect(after.totalTagTeamLosses).toBe(before.totalTagTeamLosses);
          expect(after.totalTagTeamDraws).toBe(before.totalTagTeamDraws);
        }),
        { numRuns: 200 }
      );
    });

    it('should increment the correct counter based on outcome', () => {
      fc.assert(
        fc.property(arbCounters, arbOutcome, (before, outcome) => {
          const after = applyLeagueBattleOutcome(before, outcome);

          if (outcome === 'win') {
            expect(after.totalLeagueWins).toBe(before.totalLeagueWins + 1);
            expect(after.totalLeagueLosses).toBe(before.totalLeagueLosses);
            expect(after.totalLeagueDraws).toBe(before.totalLeagueDraws);
          } else if (outcome === 'loss') {
            expect(after.totalLeagueWins).toBe(before.totalLeagueWins);
            expect(after.totalLeagueLosses).toBe(before.totalLeagueLosses + 1);
            expect(after.totalLeagueDraws).toBe(before.totalLeagueDraws);
          } else {
            expect(after.totalLeagueWins).toBe(before.totalLeagueWins);
            expect(after.totalLeagueLosses).toBe(before.totalLeagueLosses);
            expect(after.totalLeagueDraws).toBe(before.totalLeagueDraws + 1);
          }
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('Sequential battles preserve isolation', () => {
    /**
     * **Validates: Requirements 4.3**
     *
     * After a sequence of mixed tag team and league battles, the counters for each
     * mode are incremented independently and do not interfere.
     */

    it('should maintain isolation across multiple sequential battles of mixed modes', () => {
      const arbBattleSequence = fc.array(
        fc.record({
          mode: fc.constantFrom('tag_team', 'league') as fc.Arbitrary<'tag_team' | 'league'>,
          outcome: arbOutcome,
        }),
        { minLength: 1, maxLength: 20 }
      );

      fc.assert(
        fc.property(arbCounters, arbBattleSequence, (initial, battles) => {
          let current = { ...initial };

          let expectedTagTeamWins = initial.totalTagTeamWins;
          let expectedTagTeamLosses = initial.totalTagTeamLosses;
          let expectedTagTeamDraws = initial.totalTagTeamDraws;
          let expectedLeagueWins = initial.totalLeagueWins;
          let expectedLeagueLosses = initial.totalLeagueLosses;
          let expectedLeagueDraws = initial.totalLeagueDraws;

          for (const battle of battles) {
            if (battle.mode === 'tag_team') {
              current = applyTagTeamBattleOutcome(current, battle.outcome);
              if (battle.outcome === 'win') expectedTagTeamWins++;
              else if (battle.outcome === 'loss') expectedTagTeamLosses++;
              else expectedTagTeamDraws++;
            } else {
              current = applyLeagueBattleOutcome(current, battle.outcome);
              if (battle.outcome === 'win') expectedLeagueWins++;
              else if (battle.outcome === 'loss') expectedLeagueLosses++;
              else expectedLeagueDraws++;
            }
          }

          // Final counters should match independently accumulated expectations
          expect(current.totalTagTeamWins).toBe(expectedTagTeamWins);
          expect(current.totalTagTeamLosses).toBe(expectedTagTeamLosses);
          expect(current.totalTagTeamDraws).toBe(expectedTagTeamDraws);
          expect(current.totalLeagueWins).toBe(expectedLeagueWins);
          expect(current.totalLeagueLosses).toBe(expectedLeagueLosses);
          expect(current.totalLeagueDraws).toBe(expectedLeagueDraws);
        }),
        { numRuns: 200 }
      );
    });
  });
});
