/**
 * Property tests for the Bye_Reward_Calculator (Spec #49).
 *
 * The calculator is pure, so the whole suite runs on the unit tier with no
 * Postgres. That is deliberate: a property that needs a database fixture is an
 * integration test wearing a generator, and belongs in the integration tier.
 */

import * as fc from 'fast-check';
import {
  resolveByeReward,
  BYE_MODES,
  BYE_MODE_SPECS,
  TIER_SCALED_BYE_MODES,
  TOURNAMENT_BYE_MODES,
  ByeMode,
  ByeRewardInput,
} from '../../src/utils/byeRewards';
import {
  getParticipationReward,
  PARTICIPATION_REWARD_FRACTION,
  getLeagueWinReward,
} from '../../src/utils/economyFormulas';
import { calculateTournamentParticipationReward } from '../../src/utils/tournamentRewards';

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;

/** Build a valid context for whichever arm the mode reads. */
function inputFor(
  mode: ByeMode,
  tier: string,
  triple: { totalParticipants: number; currentRound: number; maxRounds: number },
): ByeRewardInput {
  return BYE_MODE_SPECS[mode].floor === 'tier_scaled'
    ? ({ mode, tier } as ByeRewardInput)
    : ({ mode, ...triple } as ByeRewardInput);
}

// Feature: bye-system-unification, Property 1: A bye pays credits and nothing else, in every mode
describe('Property 1: a bye pays credits and nothing else, in every mode', () => {
  it('should return positive credits and zero prestige, fame and streaming for every mode', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...BYE_MODES),
        fc.oneof(fc.constantFrom(...TIERS), fc.string()),
        fc.integer({ min: 1, max: 200_000 }),
        fc.integer({ min: 1, max: 20 }),
        (mode, tier, totalParticipants, maxRounds) => {
          const currentRound = fc.sample(fc.integer({ min: 1, max: maxRounds }), 1)[0];
          const reward = resolveByeReward(
            inputFor(mode, tier, { totalParticipants, currentRound, maxRounds }),
          );

          expect(reward.credits).toBeGreaterThan(0);
          expect(reward.prestige).toBe(0);
          expect(reward.fame).toBe(0);
          expect(reward.streamingRevenue).toBe(0);
          expect(reward.lpDelta).toBeDefined();
          expect(reward.teamSize).toBeDefined();
          expect(reward.perRobotCredits).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: bye-system-unification, Property 2: The Tier_Scaled_Mode floor is one number times team size
describe('Property 2: the tier-scaled floor is one number times team size', () => {
  it('should pay getParticipationReward(tier) x teamSize for every tier-scaled mode', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constantFrom(...TIERS), fc.string()),
        fc.constantFrom(...TIER_SCALED_BYE_MODES),
        (tier, mode) => {
          const reward = resolveByeReward({ mode, tier });
          const teamSize = BYE_MODE_SPECS[mode].teamSize;

          expect(reward.credits).toBe(getParticipationReward(tier) * teamSize);
          expect(reward.credits / teamSize).toBe(getParticipationReward(tier));
          expect(reward.perRobotCredits).toBe(getParticipationReward(tier));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should use the identical per-robot figure across all six tier-scaled modes', () => {
    fc.assert(
      fc.property(fc.constantFrom(...TIERS), (tier) => {
        const perRobot = TIER_SCALED_BYE_MODES.map(
          (mode) => resolveByeReward({ mode, tier }).perRobotCredits,
        );
        expect(new Set(perRobot).size).toBe(1);
      }),
      { numRuns: 100 },
    );
  });

  it('should pay a 3v3 bye exactly 1.5x a 2v2 bye at the same tier', () => {
    fc.assert(
      fc.property(fc.constantFrom(...TIERS), (tier) => {
        const twoV2 = resolveByeReward({ mode: 'league_2v2', tier }).credits;
        const threeV3 = resolveByeReward({ mode: 'league_3v3', tier }).credits;
        expect(threeV3).toBe(twoV2 * 1.5);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: bye-system-unification, Property 3: A tournament bye equals a tournament loss for the same round
describe('Property 3: a tournament bye equals a tournament loss for the same round', () => {
  it('should pay the round loss reward x teamSize for every tournament mode', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TOURNAMENT_BYE_MODES),
        fc.integer({ min: 1, max: 200_000 }),
        fc.integer({ min: 1, max: 20 }),
        (mode, totalParticipants, maxRounds) => {
          const currentRound = fc.sample(fc.integer({ min: 1, max: maxRounds }), 1)[0];
          const reward = resolveByeReward({
            mode,
            totalParticipants,
            currentRound,
            maxRounds,
          });
          const teamSize = BYE_MODE_SPECS[mode].teamSize;
          const lossReward = calculateTournamentParticipationReward(
            totalParticipants,
            currentRound,
            maxRounds,
          );

          // This is the same figure, through the same function and with the same
          // team size factor, that the losing owner is paid for that round.
          expect(reward.credits).toBe(lossReward * teamSize);
          expect(reward.perRobotCredits).toBe(lossReward);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Unit tests: the things a property cannot see ─────────────────────────────

describe('the participation fraction', () => {
  it('should be declared once, as 0.2', () => {
    expect(PARTICIPATION_REWARD_FRACTION).toBe(0.2);
  });

  it('should give a bronze participation reward of 1500', () => {
    expect(getParticipationReward('bronze')).toBe(1500);
    expect(getLeagueWinReward('bronze')).toBe(7500);
  });
});

describe('the signed-off balance decision, pinned as literals', () => {
  // These exist so a future balance change has to edit a test that names the
  // decision, rather than sliding through a formula the properties still accept.
  // Figures are Expected Contribution 2 in requirements.md.
  it.each([
    ['tag_team', 'bronze', 3000],
    ['tag_team', 'champion', 90_000],
    ['league_2v2', 'bronze', 3000],
    ['league_2v2', 'champion', 90_000],
    ['league_3v3', 'bronze', 4500],
    ['league_3v3', 'champion', 135_000],
    ['league_1v1', 'bronze', 1500],
    ['league_1v1', 'champion', 45_000],
    ['koth', 'bronze', 1500],
    ['grand_melee', 'champion', 45_000],
  ] as const)('should pay a %s bye at %s exactly %i credits', (mode, tier, expected) => {
    expect(resolveByeReward({ mode, tier }).credits).toBe(expected);
  });
});

describe('the Bye_Mode_Table', () => {
  it('should declare all nine modes', () => {
    expect(BYE_MODES).toHaveLength(9);
    expect(TIER_SCALED_BYE_MODES).toHaveLength(6);
    expect(TOURNAMENT_BYE_MODES).toHaveLength(3);
  });

  // Absorbs a rejected property: nine fixed values are a table, not an input space.
  it.each([
    ['league_1v1', 3, true, 'league_1v1'],
    ['tag_team', 3, true, 'tag_team'],
    ['league_2v2', 3, true, 'league_2v2'],
    ['league_3v3', 3, true, 'league_3v3'],
    ['koth', 0, false, null],
    ['grand_melee', 0, false, null],
    ['tournament_1v1', 0, false, null],
    ['tournament_2v2', 0, false, null],
    ['tournament_3v3', 0, false, null],
  ] as const)(
    'should declare %s with lpDelta %i, updatesElo %s and standingMode %s',
    (mode, lpDelta, updatesElo, standingMode) => {
      const spec = BYE_MODE_SPECS[mode];
      expect(spec.lpDelta).toBe(lpDelta);
      expect(spec.updatesElo).toBe(updatesElo);
      expect(spec.standingMode).toBe(standingMode);
    },
  );
});
