/**
 * Unit tests for tournamentRewards — tournament reward calculations.
 *
 * Validates: Requirements 7.1 (tournament rewards), critical economy logic.
 *
 * Tests multiplier formulas, reward scaling, and boundary conditions
 * for tournament reward calculations.
 */

import {
  calculateTournamentSizeMultiplier,
  calculateRoundProgressMultiplier,
  calculateExclusivityMultiplier,
  calculateTournamentWinReward,
  calculateTournamentParticipationReward,
  calculateTournamentPrestige,
  calculateTournamentFame,
  calculateTournamentBattleRewards,
  getTournamentRewardBreakdown,
} from '../../src/utils/tournamentRewards';

describe('calculateTournamentSizeMultiplier', () => {
  it('should return 1.0 for less than 1 participant', () => {
    expect(calculateTournamentSizeMultiplier(0)).toBe(1.0);
    expect(calculateTournamentSizeMultiplier(-5)).toBe(1.0);
  });

  it('should scale logarithmically with participants', () => {
    const small = calculateTournamentSizeMultiplier(15);
    const medium = calculateTournamentSizeMultiplier(100);
    const large = calculateTournamentSizeMultiplier(1000);

    expect(small).toBeGreaterThan(1.0);
    expect(medium).toBeGreaterThan(small);
    expect(large).toBeGreaterThan(medium);
  });

  it('should match documented examples', () => {
    // 100 robots: 1 + log10(10) * 0.5 = 1.5
    expect(calculateTournamentSizeMultiplier(100)).toBeCloseTo(1.5, 1);
    // 1000 robots: 1 + log10(100) * 0.5 = 2.0
    expect(calculateTournamentSizeMultiplier(1000)).toBeCloseTo(2.0, 1);
  });
});

describe('calculateRoundProgressMultiplier', () => {
  it('should return 1.0 when maxRounds is 0', () => {
    expect(calculateRoundProgressMultiplier(1, 0)).toBe(1.0);
  });

  it('should scale linearly with round progression', () => {
    expect(calculateRoundProgressMultiplier(1, 4)).toBeCloseTo(0.25);
    expect(calculateRoundProgressMultiplier(2, 4)).toBeCloseTo(0.5);
    expect(calculateRoundProgressMultiplier(3, 4)).toBeCloseTo(0.75);
    expect(calculateRoundProgressMultiplier(4, 4)).toBeCloseTo(1.0);
  });
});

describe('calculateExclusivityMultiplier', () => {
  it('should return 1.0 for edge cases', () => {
    expect(calculateExclusivityMultiplier(0, 100)).toBe(1.0);
    expect(calculateExclusivityMultiplier(100, 0)).toBe(1.0);
  });

  it('should increase as fewer robots remain', () => {
    const halfRemaining = calculateExclusivityMultiplier(50, 100);
    const quarterRemaining = calculateExclusivityMultiplier(25, 100);
    const tenPercentRemaining = calculateExclusivityMultiplier(10, 100);

    expect(quarterRemaining).toBeGreaterThan(halfRemaining);
    expect(tenPercentRemaining).toBeGreaterThan(quarterRemaining);
  });

  it('should match documented examples', () => {
    // 50% remaining: 1.41×
    expect(calculateExclusivityMultiplier(50, 100)).toBeCloseTo(1.41, 1);
    // 25% remaining: 2.0×
    expect(calculateExclusivityMultiplier(25, 100)).toBeCloseTo(2.0, 1);
  });
});

describe('calculateTournamentWinReward', () => {
  it('should produce positive rewards for valid inputs', () => {
    const reward = calculateTournamentWinReward(15, 2, 4);
    expect(reward).toBeGreaterThan(0);
  });

  it('should increase for later rounds', () => {
    const round1 = calculateTournamentWinReward(15, 1, 4);
    const round4 = calculateTournamentWinReward(15, 4, 4);
    expect(round4).toBeGreaterThan(round1);
  });

  it('should increase for larger tournaments', () => {
    const small = calculateTournamentWinReward(15, 3, 4);
    const large = calculateTournamentWinReward(100, 3, 4);
    expect(large).toBeGreaterThan(small);
  });

  it('should return integer values', () => {
    expect(Number.isInteger(calculateTournamentWinReward(32, 2, 5))).toBe(true);
  });
});

describe('calculateTournamentParticipationReward', () => {
  it('should be 30% of winner reward', () => {
    const winnerReward = calculateTournamentWinReward(50, 3, 4);
    const participationReward = calculateTournamentParticipationReward(50, 3, 4);
    expect(participationReward).toBe(Math.round(winnerReward * 0.3));
  });

  it('should be positive', () => {
    expect(calculateTournamentParticipationReward(15, 1, 4)).toBeGreaterThan(0);
  });
});

describe('calculateTournamentPrestige', () => {
  it('should add championship bonus for finals', () => {
    const semiFinals = calculateTournamentPrestige(50, 3, 4);
    const finals = calculateTournamentPrestige(50, 4, 4);
    // Finals has +500 championship bonus
    expect(finals - semiFinals).toBeGreaterThanOrEqual(400);
  });

  it('should increase with round progression', () => {
    const round1 = calculateTournamentPrestige(50, 1, 4);
    const round3 = calculateTournamentPrestige(50, 3, 4);
    expect(round3).toBeGreaterThan(round1);
  });
});

describe('calculateTournamentFame', () => {
  it('should give performance bonus for perfect victory', () => {
    const normal = calculateTournamentFame(50, 10, 50, 100); // 50% HP
    const perfect = calculateTournamentFame(50, 10, 100, 100); // 100% HP
    expect(perfect).toBeGreaterThan(normal);
  });

  it('should give dominating bonus for >80% HP', () => {
    const normal = calculateTournamentFame(50, 10, 50, 100); // 50% HP
    const dominating = calculateTournamentFame(50, 10, 85, 100); // 85% HP
    expect(dominating).toBeGreaterThan(normal);
  });

  it('should give comeback bonus for <20% HP', () => {
    const normal = calculateTournamentFame(50, 10, 50, 100); // 50% HP
    const comeback = calculateTournamentFame(50, 10, 15, 100); // 15% HP
    expect(comeback).toBeGreaterThan(normal);
  });

  it('should increase with exclusivity (fewer remaining)', () => {
    const manyRemaining = calculateTournamentFame(100, 50, 60, 100);
    const fewRemaining = calculateTournamentFame(100, 5, 60, 100);
    expect(fewRemaining).toBeGreaterThan(manyRemaining);
  });
});

describe('calculateTournamentBattleRewards', () => {
  it('should produce complete reward object', async () => {
    const rewards = await calculateTournamentBattleRewards(32, 3, 5, 8, 75, 100);
    expect(rewards.winnerReward).toBeGreaterThan(0);
    expect(rewards.loserReward).toBeGreaterThan(0);
    expect(rewards.winnerPrestige).toBeGreaterThan(0);
    expect(rewards.loserPrestige).toBe(0);
    expect(rewards.winnerFame).toBeGreaterThan(0);
    expect(rewards.loserFame).toBe(0);
    expect(rewards.isFinals).toBe(false);
  });

  it('should mark finals correctly', async () => {
    const rewards = await calculateTournamentBattleRewards(32, 5, 5, 2, 50, 100);
    expect(rewards.isFinals).toBe(true);
  });

  it('should include multiplier values', async () => {
    const rewards = await calculateTournamentBattleRewards(100, 3, 4, 10, 80, 100);
    expect(rewards.tournamentSizeMultiplier).toBeGreaterThan(1);
    expect(rewards.roundProgressMultiplier).toBe(0.75);
  });
});

describe('getTournamentRewardBreakdown', () => {
  it('should produce a non-empty breakdown array', () => {
    const rewards = {
      winnerReward: 15000,
      loserReward: 4500,
      winnerPrestige: 25,
      loserPrestige: 0,
      winnerFame: 12,
      loserFame: 0,
      isFinals: false,
      tournamentSizeMultiplier: 1.5,
      roundProgressMultiplier: 0.75,
    };
    const breakdown = getTournamentRewardBreakdown(rewards, 'IronFist', 'SteelClaw', 100, 3, 4);
    expect(breakdown.length).toBeGreaterThan(5);
    expect(breakdown[0]).toContain('Tournament Financial Rewards');
  });

  it('should include championship label for finals', () => {
    const rewards = {
      winnerReward: 30000,
      loserReward: 9000,
      winnerPrestige: 525,
      loserPrestige: 0,
      winnerFame: 20,
      loserFame: 0,
      isFinals: true,
      tournamentSizeMultiplier: 1.5,
      roundProgressMultiplier: 1.0,
    };
    const breakdown = getTournamentRewardBreakdown(rewards, 'ChampBot', 'LoserBot', 100, 4, 4);
    expect(breakdown.some(line => line.includes('CHAMPIONSHIP'))).toBe(true);
  });
});
