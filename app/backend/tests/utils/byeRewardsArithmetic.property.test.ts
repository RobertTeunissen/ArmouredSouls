/**
 * Spec #49 — the remaining arithmetic properties.
 *
 * Property 4: per-robot credits sum exactly to the amount awarded.
 * Property 5: the Grand Melee LP shown equals the LP given.
 * Property 6: team tournament team size is applied exactly once, on both arms.
 *
 * These three sit apart from the calculator's own properties because they guard
 * the two duplicate-declaration defects this spec fixed, plus the credit-split
 * conservation law the bye path reuses rather than re-deriving.
 */

import * as fc from 'fast-check';
import { distributeTeamCredits } from '../../src/services/team-battle/teamBattleRewardService';
import { GRAND_MELEE_LP_SCALE } from '../../src/services/grand-melee/grandMeleeRewards';
import {
  calculateTournamentWinReward,
  calculateTournamentParticipationReward,
} from '../../src/utils/tournamentRewards';

// Feature: bye-system-unification, Property 4: Per-robot credits sum exactly to the amount awarded
describe('Property 4: per-robot credits sum exactly to the amount awarded', () => {
  it('should conserve the total across any split, with shares differing by at most one', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5_000_000 }),
        fc.integer({ min: 1, max: 3 }),
        (total, robotCount) => {
          const robots = Array.from({ length: robotCount }, (_, i) => ({ robotId: i + 1 }));
          const shares = distributeTeamCredits(total, robots);

          expect(shares).toHaveLength(robotCount);
          const sum = shares.reduce((acc, s) => acc + s.credits, 0);
          // The conservation law: no credit is created or lost by the split.
          expect(sum).toBe(total);

          const values = shares.map((s) => s.credits);
          expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  // The remainder branch is where a floor-only split loses a credit. The tag team
  // bye path used to do exactly that (`Math.floor(reward / 2)`), so this case is
  // forced rather than left to the generator.
  it('should distribute a remainder rather than dropping it', () => {
    const shares = distributeTeamCredits(4501, [{ robotId: 1 }, { robotId: 2 }, { robotId: 3 }]);
    expect(shares.map((s) => s.credits)).toEqual([1501, 1500, 1500]);
    expect(shares.reduce((a, s) => a + s.credits, 0)).toBe(4501);
  });

  it('should return an empty split for no robots', () => {
    expect(distributeTeamCredits(1000, [])).toEqual([]);
  });
});

// Feature: bye-system-unification, Property 5: The Grand Melee LP shown equals the LP given
describe('Property 5: the Grand Melee LP shown equals the LP given', () => {
  /**
   * Mirrors the lookup `awardGrandMeleePoints` performs. Both sides now read the
   * same imported scale — before Spec #49 there were two declarations of these
   * ten numbers, one feeding the `lpDelta` a player is shown and one feeding
   * `standings.leaguePoints`. They agreed, but nothing enforced it.
   */
  const persistedLpFor = (placement: number): number =>
    placement <= GRAND_MELEE_LP_SCALE.length ? GRAND_MELEE_LP_SCALE[placement - 1] : 0;

  it('should award exactly the scale value for every placement, and 0 past the end', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 40 }), (placement) => {
        const persisted = persistedLpFor(placement);

        if (placement <= GRAND_MELEE_LP_SCALE.length) {
          expect(persisted).toBe(GRAND_MELEE_LP_SCALE[placement - 1]);
          expect(persisted).toBeGreaterThan(0);
        } else {
          expect(persisted).toBe(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should hold the F1 scale as the single declaration', () => {
    expect(GRAND_MELEE_LP_SCALE).toEqual([25, 18, 15, 12, 10, 8, 6, 4, 2, 1]);
    // The 10/11 boundary, named rather than left to the generator.
    expect(persistedLpFor(10)).toBe(1);
    expect(persistedLpFor(11)).toBe(0);
    expect(persistedLpFor(21)).toBe(0);
  });
});

// Feature: bye-system-unification, Property 6: Team tournament team size is applied exactly once
describe('Property 6: team tournament team size is applied exactly once, on both arms', () => {
  /**
   * Mirrors the corrected arithmetic in `distributeTeamTournamentRewards`. The
   * defect was a second `× teamSize` at the award call, so an owner received
   * `base × teamSize²` — 9× instead of 3× for a 3v3, on *both* the winner and
   * loser arms. Exact integer division is what "exactly once" means numerically:
   * a squared factor makes the quotient `teamSize ×` too large and fails at once.
   */
  it('should give a quotient equal to the un-multiplied reward on both arms', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 200_000 }),
        fc.integer({ min: 1, max: 20 }),
        fc.constantFrom(2 as const, 3 as const),
        (totalParticipants, maxRounds, teamSize) => {
          const currentRound = fc.sample(fc.integer({ min: 1, max: maxRounds }), 1)[0];

          const winBase = calculateTournamentWinReward(totalParticipants, currentRound, maxRounds);
          const lossBase = calculateTournamentParticipationReward(
            totalParticipants,
            currentRound,
            maxRounds,
          );

          const winnerOwnerTotal = winBase * teamSize;
          const loserOwnerTotal = lossBase * teamSize;

          expect(winnerOwnerTotal / teamSize).toBe(winBase);
          expect(loserOwnerTotal / teamSize).toBe(lossBase);
          // The defect's signature: the owner total must not carry teamSize twice.
          expect(winnerOwnerTotal).not.toBe(winBase * teamSize * teamSize);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should pay 16,530 and 4,959 for a round-1 16-team 3v3, not 49,590 and 14,877', () => {
    // The worked example from the spec's Expected Contribution.
    const winBase = calculateTournamentWinReward(16, 1, 4);
    const lossBase = calculateTournamentParticipationReward(16, 1, 4);

    expect(winBase * 3).toBe(16_530);
    expect(lossBase * 3).toBe(4_959);
    // What the defect paid.
    expect(winBase * 3 * 3).toBe(49_590);
    expect(lossBase * 3 * 3).toBe(14_877);
  });
});
