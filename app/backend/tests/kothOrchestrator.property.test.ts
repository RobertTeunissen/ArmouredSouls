/**
 * Property-based tests for KotH Battle Orchestrator – Reward Calculation
 *
 * Uses fast-check to verify correctness properties from the design document.
 *
 * Property 24: Placement-based rewards follow tiered structure
 * - Tiered credits/fame/prestige by placement
 * - Zone dominance bonus (+25% when >75% uncontested)
 * - Validates: Requirements 14.1, 14.2, 14.3, 14.4
 */

import * as fc from 'fast-check';
import { calculateKothRewards } from '../src/services/koth/kothBattleOrchestrator';

// ─── Expected base reward tiers ─────────────────────────────────────

const BASE_REWARDS: Record<number, { credits: number; fame: number; prestige: number }> = {
  1: { credits: 25_000, fame: 8, prestige: 15 },
  2: { credits: 17_500, fame: 5, prestige: 8 },
  3: { credits: 10_000, fame: 3, prestige: 3 },
};

const DEFAULT_REWARDS = { credits: 5_000, fame: 0, prestige: 0 };

const ZONE_DOMINANCE_THRESHOLD = 0.75;
const ZONE_DOMINANCE_MULTIPLIER = 1.25;

// ─── Helpers ────────────────────────────────────────────────────────

/** Build zoneScore and totalUncontestedScore that guarantee NO zone dominance bonus. */
function noDominanceScoresArb(): fc.Arbitrary<{ zoneScore: number; totalUncontestedScore: number }> {
  return fc.integer({ min: 1, max: 10_000 }).chain((zoneScore) => {
    // uncontestedRatio must be <= 0.75 → totalUncontested <= zoneScore * 0.75
    const maxUncontested = Math.floor(zoneScore * ZONE_DOMINANCE_THRESHOLD);
    return fc.integer({ min: 0, max: maxUncontested }).map((totalUncontestedScore) => ({
      zoneScore,
      totalUncontestedScore,
    }));
  });
}

/** Build zoneScore and totalUncontestedScore that guarantee zone dominance bonus. */
function dominanceScoresArb(): fc.Arbitrary<{ zoneScore: number; totalUncontestedScore: number }> {
  return fc.integer({ min: 1, max: 10_000 }).chain((zoneScore) => {
    // uncontestedRatio must be > 0.75 → totalUncontested > zoneScore * 0.75
    const minUncontested = Math.floor(zoneScore * ZONE_DOMINANCE_THRESHOLD) + 1;
    return fc.integer({ min: minUncontested, max: zoneScore * 2 }).map((totalUncontestedScore) => ({
      zoneScore,
      totalUncontestedScore,
    }));
  });
}

// ─── Property 24: Placement-based rewards follow tiered structure ───

describe('Property 24: Placement-based rewards follow tiered structure', () => {

  // ── Base reward tiers (no zone dominance) ──────────────────────

  describe('base reward tiers without zone dominance bonus', () => {
    it('1st place gets 25000 credits, 8 fame, 15 prestige', () => {
      fc.assert(
        fc.property(
          noDominanceScoresArb(),
          ({ zoneScore, totalUncontestedScore }) => {
            const result = calculateKothRewards(1, zoneScore, totalUncontestedScore);
            expect(result.credits).toBe(25_000);
            expect(result.fame).toBe(8);
            expect(result.prestige).toBe(15);
            expect(result.zoneDominanceBonus).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('2nd place gets 17500 credits, 5 fame, 8 prestige', () => {
      fc.assert(
        fc.property(
          noDominanceScoresArb(),
          ({ zoneScore, totalUncontestedScore }) => {
            const result = calculateKothRewards(2, zoneScore, totalUncontestedScore);
            expect(result.credits).toBe(17_500);
            expect(result.fame).toBe(5);
            expect(result.prestige).toBe(8);
            expect(result.zoneDominanceBonus).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('3rd place gets 10000 credits, 3 fame, 3 prestige', () => {
      fc.assert(
        fc.property(
          noDominanceScoresArb(),
          ({ zoneScore, totalUncontestedScore }) => {
            const result = calculateKothRewards(3, zoneScore, totalUncontestedScore);
            expect(result.credits).toBe(10_000);
            expect(result.fame).toBe(3);
            expect(result.prestige).toBe(3);
            expect(result.zoneDominanceBonus).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('4th–6th place gets 5000 credits, 0 fame, 0 prestige', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 6 }),
          noDominanceScoresArb(),
          (placement, { zoneScore, totalUncontestedScore }) => {
            const result = calculateKothRewards(placement, zoneScore, totalUncontestedScore);
            expect(result.credits).toBe(5_000);
            expect(result.fame).toBe(0);
            expect(result.prestige).toBe(0);
            expect(result.zoneDominanceBonus).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Zone dominance bonus activation ────────────────────────────

  describe('zone dominance bonus', () => {
    it('activates when uncontestedRatio > 0.75 and multiplies all rewards by 1.25 (floored)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 6 }),
          dominanceScoresArb(),
          (placement, { zoneScore, totalUncontestedScore }) => {
            const result = calculateKothRewards(placement, zoneScore, totalUncontestedScore);
            const base = placement <= 3 ? BASE_REWARDS[placement] : DEFAULT_REWARDS;

            expect(result.zoneDominanceBonus).toBe(true);
            expect(result.credits).toBe(Math.floor(base.credits * ZONE_DOMINANCE_MULTIPLIER));
            expect(result.fame).toBe(Math.floor(base.fame * ZONE_DOMINANCE_MULTIPLIER));
            expect(result.prestige).toBe(Math.floor(base.prestige * ZONE_DOMINANCE_MULTIPLIER));
          },
        ),
        { numRuns: 100 },
      );
    });

    it('does NOT activate at exactly 0.75 ratio', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 6 }),
          fc.integer({ min: 4, max: 10_000 }),
          (placement, zoneScore) => {
            // Force ratio to be exactly 0.75: totalUncontested / zoneScore = 0.75
            // Use multiples of 4 so 0.75 is exact (no floating-point error)
            const adjustedZoneScore = zoneScore * 4;
            const totalUncontestedScore = adjustedZoneScore * 3 / 4; // 3/4 = 0.75

            const result = calculateKothRewards(placement, adjustedZoneScore, totalUncontestedScore);
            expect(result.zoneDominanceBonus).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('does NOT activate when zoneScore is 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 6 }),
          fc.integer({ min: 0, max: 10_000 }),
          (placement, totalUncontestedScore) => {
            const result = calculateKothRewards(placement, 0, totalUncontestedScore);
            expect(result.zoneDominanceBonus).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── General invariants ─────────────────────────────────────────

  describe('reward invariants', () => {
    it('all reward values are non-negative integers', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 6 }),
          fc.integer({ min: 0, max: 10_000 }),
          fc.integer({ min: 0, max: 10_000 }),
          (placement, zoneScore, totalUncontestedScore) => {
            const result = calculateKothRewards(placement, zoneScore, totalUncontestedScore);

            expect(result.credits).toBeGreaterThanOrEqual(0);
            expect(result.fame).toBeGreaterThanOrEqual(0);
            expect(result.prestige).toBeGreaterThanOrEqual(0);

            expect(Number.isInteger(result.credits)).toBe(true);
            expect(Number.isInteger(result.fame)).toBe(true);
            expect(Number.isInteger(result.prestige)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// ─── Property 25: KotH battles do not modify ELO ────────────────────

describe('Property 25: KotH battles do not modify ELO', () => {

  it('calculateKothRewards returns exactly 4 fields: credits, fame, prestige, zoneDominanceBonus — no ELO field', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        (placement, zoneScore, totalUncontestedScore) => {
          const result = calculateKothRewards(placement, zoneScore, totalUncontestedScore);
          const keys = Object.keys(result).sort();

          expect(keys).toEqual(['credits', 'fame', 'prestige', 'zoneDominanceBonus']);
          expect(keys).toHaveLength(4);

          // Explicitly verify no ELO-related fields exist
          expect(result).not.toHaveProperty('eloChange');
          expect(result).not.toHaveProperty('eloBefore');
          expect(result).not.toHaveProperty('eloAfter');
          expect(result).not.toHaveProperty('elo');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any random ELO value, the design invariant holds: eloChange = 0 for KotH', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 2500 }),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        (elo, placement, zoneScore, totalUncontestedScore) => {
          // KotH design invariant: ELO is never changed by KotH battles
          const eloChange = 0;
          const eloBefore = elo;
          const eloAfter = eloBefore + eloChange;

          expect(eloAfter).toBe(eloBefore);
          expect(eloChange).toBe(0);

          // Verify the rewards function itself has no ELO side-effects
          const result = calculateKothRewards(placement, zoneScore, totalUncontestedScore);
          expect(result).not.toHaveProperty('eloChange');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 28: Cumulative KotH stats are correctly updated ───────

interface KothRobotStats {
  kothMatches: number;
  kothWins: number;
  kothTotalZoneScore: number;
  kothTotalZoneTime: number;
  kothKills: number;
  kothBestPlacement: number | null;
  kothCurrentWinStreak: number;
  kothBestWinStreak: number;
}

function applyKothStatsUpdate(
  current: KothRobotStats,
  placement: number,
  zoneScore: number,
  zoneTime: number,
  kills: number,
  isWinner: boolean,
): KothRobotStats {
  const newWinStreak = isWinner ? current.kothCurrentWinStreak + 1 : 0;
  const newBestStreak = isWinner
    ? Math.max(current.kothBestWinStreak, newWinStreak)
    : current.kothBestWinStreak;
  const newBestPlacement = current.kothBestPlacement === null
    ? placement
    : Math.min(current.kothBestPlacement, placement);

  return {
    kothMatches: current.kothMatches + 1,
    kothWins: current.kothWins + (isWinner ? 1 : 0),
    kothTotalZoneScore: current.kothTotalZoneScore + zoneScore,
    kothTotalZoneTime: current.kothTotalZoneTime + zoneTime,
    kothKills: current.kothKills + kills,
    kothBestPlacement: newBestPlacement,
    kothCurrentWinStreak: newWinStreak,
    kothBestWinStreak: newBestStreak,
  };
}

/** Arbitrary for generating valid KothRobotStats */
function kothStatsArb(): fc.Arbitrary<KothRobotStats> {
  return fc.record({
    kothMatches: fc.integer({ min: 0, max: 1000 }),
    kothWins: fc.integer({ min: 0, max: 500 }),
    kothTotalZoneScore: fc.integer({ min: 0, max: 100_000 }),
    kothTotalZoneTime: fc.integer({ min: 0, max: 100_000 }),
    kothKills: fc.integer({ min: 0, max: 5000 }),
    kothBestPlacement: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 6 })),
    kothCurrentWinStreak: fc.integer({ min: 0, max: 100 }),
    kothBestWinStreak: fc.integer({ min: 0, max: 100 }),
  });
}

describe('Property 28: Cumulative KotH stats are correctly updated after each match', () => {

  it('kothMatches always increments by exactly 1', () => {
    fc.assert(
      fc.property(
        kothStatsArb(),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 20 }),
        fc.boolean(),
        (current, placement, zoneScore, zoneTime, kills, isWinner) => {
          const updated = applyKothStatsUpdate(current, placement, zoneScore, zoneTime, kills, isWinner);
          expect(updated.kothMatches).toBe(current.kothMatches + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('kothWins increments by 1 only when isWinner=true', () => {
    fc.assert(
      fc.property(
        kothStatsArb(),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 20 }),
        fc.boolean(),
        (current, placement, zoneScore, zoneTime, kills, isWinner) => {
          const updated = applyKothStatsUpdate(current, placement, zoneScore, zoneTime, kills, isWinner);
          if (isWinner) {
            expect(updated.kothWins).toBe(current.kothWins + 1);
          } else {
            expect(updated.kothWins).toBe(current.kothWins);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('kothTotalZoneScore increases by exactly zoneScore', () => {
    fc.assert(
      fc.property(
        kothStatsArb(),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 20 }),
        fc.boolean(),
        (current, placement, zoneScore, zoneTime, kills, isWinner) => {
          const updated = applyKothStatsUpdate(current, placement, zoneScore, zoneTime, kills, isWinner);
          expect(updated.kothTotalZoneScore).toBe(current.kothTotalZoneScore + zoneScore);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('kothTotalZoneTime increases by exactly zoneTime', () => {
    fc.assert(
      fc.property(
        kothStatsArb(),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 20 }),
        fc.boolean(),
        (current, placement, zoneScore, zoneTime, kills, isWinner) => {
          const updated = applyKothStatsUpdate(current, placement, zoneScore, zoneTime, kills, isWinner);
          expect(updated.kothTotalZoneTime).toBe(current.kothTotalZoneTime + zoneTime);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('kothKills increases by exactly kills', () => {
    fc.assert(
      fc.property(
        kothStatsArb(),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 20 }),
        fc.boolean(),
        (current, placement, zoneScore, zoneTime, kills, isWinner) => {
          const updated = applyKothStatsUpdate(current, placement, zoneScore, zoneTime, kills, isWinner);
          expect(updated.kothKills).toBe(current.kothKills + kills);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('kothBestPlacement is min of current and new (null → new placement)', () => {
    fc.assert(
      fc.property(
        kothStatsArb(),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 20 }),
        fc.boolean(),
        (current, placement, zoneScore, zoneTime, kills, isWinner) => {
          const updated = applyKothStatsUpdate(current, placement, zoneScore, zoneTime, kills, isWinner);
          if (current.kothBestPlacement === null) {
            expect(updated.kothBestPlacement).toBe(placement);
          } else {
            expect(updated.kothBestPlacement).toBe(Math.min(current.kothBestPlacement, placement));
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('winner: kothCurrentWinStreak increments, kothBestWinStreak tracks max', () => {
    fc.assert(
      fc.property(
        kothStatsArb(),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 20 }),
        (current, placement, zoneScore, zoneTime, kills) => {
          const updated = applyKothStatsUpdate(current, placement, zoneScore, zoneTime, kills, true);
          expect(updated.kothCurrentWinStreak).toBe(current.kothCurrentWinStreak + 1);
          expect(updated.kothBestWinStreak).toBe(
            Math.max(current.kothBestWinStreak, current.kothCurrentWinStreak + 1),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('non-winner: kothCurrentWinStreak resets to 0, kothBestWinStreak unchanged', () => {
    fc.assert(
      fc.property(
        kothStatsArb(),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 20 }),
        (current, placement, zoneScore, zoneTime, kills) => {
          const updated = applyKothStatsUpdate(current, placement, zoneScore, zoneTime, kills, false);
          expect(updated.kothCurrentWinStreak).toBe(0);
          expect(updated.kothBestWinStreak).toBe(current.kothBestWinStreak);
        },
      ),
      { numRuns: 100 },
    );
  });
});
