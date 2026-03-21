/**
 * Unit tests for KotH Battle Orchestrator – Edge Cases
 *
 * Tests calculateKothRewards for all placement tiers, zone dominance bonus
 * edge cases, and applyKothStatsUpdate for stat tracking correctness.
 */

import { calculateKothRewards } from '../src/services/kothBattleOrchestrator';

// ─── Pure helper replicating updateKothRobotStats logic ─────────────

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

// ─── Default stats for stat-tracking tests ──────────────────────────

const FRESH_STATS: KothRobotStats = {
  kothMatches: 0,
  kothWins: 0,
  kothTotalZoneScore: 0,
  kothTotalZoneTime: 0,
  kothKills: 0,
  kothBestPlacement: null,
  kothCurrentWinStreak: 0,
  kothBestWinStreak: 0,
};

// ─── KotH Reward Calculation Tests ──────────────────────────────────

describe('KotH reward calculation', () => {

  // ── Base reward tiers ─────────────────────────────────────────

  it('1st place base rewards: 25000 credits, 8 fame, 15 prestige', () => {
    const result = calculateKothRewards(1, 100, 50);
    expect(result.credits).toBe(25_000);
    expect(result.fame).toBe(8);
    expect(result.prestige).toBe(15);
    expect(result.zoneDominanceBonus).toBe(false);
  });

  it('2nd place base rewards: 17500 credits, 5 fame, 8 prestige', () => {
    const result = calculateKothRewards(2, 100, 50);
    expect(result.credits).toBe(17_500);
    expect(result.fame).toBe(5);
    expect(result.prestige).toBe(8);
    expect(result.zoneDominanceBonus).toBe(false);
  });

  it('3rd place base rewards: 10000 credits, 3 fame, 3 prestige', () => {
    const result = calculateKothRewards(3, 100, 50);
    expect(result.credits).toBe(10_000);
    expect(result.fame).toBe(3);
    expect(result.prestige).toBe(3);
    expect(result.zoneDominanceBonus).toBe(false);
  });

  it('4th place participation rewards: 5000 credits, 0 fame, 0 prestige', () => {
    const result = calculateKothRewards(4, 100, 50);
    expect(result.credits).toBe(5_000);
    expect(result.fame).toBe(0);
    expect(result.prestige).toBe(0);
  });

  it('5th place participation rewards: 5000 credits, 0 fame, 0 prestige', () => {
    const result = calculateKothRewards(5, 100, 50);
    expect(result.credits).toBe(5_000);
    expect(result.fame).toBe(0);
    expect(result.prestige).toBe(0);
  });

  it('6th place participation rewards: 5000 credits, 0 fame, 0 prestige', () => {
    const result = calculateKothRewards(6, 100, 50);
    expect(result.credits).toBe(5_000);
    expect(result.fame).toBe(0);
    expect(result.prestige).toBe(0);
  });

  // ── Zone dominance bonus edge cases ───────────────────────────

  it('zone dominance bonus at 76% uncontested → 1.25× rewards for 1st place', () => {
    // 76/100 = 0.76 > 0.75 → bonus active
    const result = calculateKothRewards(1, 100, 76);
    expect(result.zoneDominanceBonus).toBe(true);
    expect(result.credits).toBe(31_250);
    expect(result.fame).toBe(10);
    expect(result.prestige).toBe(18);
  });

  it('zone dominance bonus at 74% uncontested → no bonus for 1st place', () => {
    // 74/100 = 0.74 ≤ 0.75 → no bonus
    const result = calculateKothRewards(1, 100, 74);
    expect(result.zoneDominanceBonus).toBe(false);
    expect(result.credits).toBe(25_000);
    expect(result.fame).toBe(8);
    expect(result.prestige).toBe(15);
  });

  it('zone dominance bonus at exactly 75% → no bonus', () => {
    // 75/100 = 0.75, threshold is strictly > 0.75
    const result = calculateKothRewards(1, 100, 75);
    expect(result.zoneDominanceBonus).toBe(false);
  });

  it('zone dominance with zoneScore=0 → no bonus', () => {
    const result = calculateKothRewards(1, 0, 100);
    expect(result.zoneDominanceBonus).toBe(false);
  });
});

// ─── KotH Stat Tracking Tests ───────────────────────────────────────

describe('KotH stat tracking (applyKothStatsUpdate)', () => {

  it('kothBestPlacement updates null→3', () => {
    const updated = applyKothStatsUpdate(FRESH_STATS, 3, 100, 60, 2, false);
    expect(updated.kothBestPlacement).toBe(3);
  });

  it('kothBestPlacement updates 3→1 (better placement)', () => {
    const stats: KothRobotStats = { ...FRESH_STATS, kothBestPlacement: 3 };
    const updated = applyKothStatsUpdate(stats, 1, 100, 60, 2, true);
    expect(updated.kothBestPlacement).toBe(1);
  });

  it('kothBestPlacement does NOT update 1→3 (worse placement)', () => {
    const stats: KothRobotStats = { ...FRESH_STATS, kothBestPlacement: 1 };
    const updated = applyKothStatsUpdate(stats, 3, 100, 60, 2, false);
    expect(updated.kothBestPlacement).toBe(1);
  });

  it('kothCurrentWinStreak increments on wins', () => {
    let stats: KothRobotStats = { ...FRESH_STATS };
    stats = applyKothStatsUpdate(stats, 1, 100, 60, 2, true);
    expect(stats.kothCurrentWinStreak).toBe(1);
    stats = applyKothStatsUpdate(stats, 1, 100, 60, 2, true);
    expect(stats.kothCurrentWinStreak).toBe(2);
    stats = applyKothStatsUpdate(stats, 1, 100, 60, 2, true);
    expect(stats.kothCurrentWinStreak).toBe(3);
  });

  it('kothCurrentWinStreak resets on non-win', () => {
    let stats: KothRobotStats = { ...FRESH_STATS };
    stats = applyKothStatsUpdate(stats, 1, 100, 60, 2, true);
    stats = applyKothStatsUpdate(stats, 1, 100, 60, 2, true);
    expect(stats.kothCurrentWinStreak).toBe(2);
    stats = applyKothStatsUpdate(stats, 3, 100, 60, 2, false);
    expect(stats.kothCurrentWinStreak).toBe(0);
  });

  it('kothBestWinStreak tracks all-time best', () => {
    let stats: KothRobotStats = { ...FRESH_STATS };
    // Win 3 in a row
    stats = applyKothStatsUpdate(stats, 1, 100, 60, 2, true);
    stats = applyKothStatsUpdate(stats, 1, 100, 60, 2, true);
    stats = applyKothStatsUpdate(stats, 1, 100, 60, 2, true);
    expect(stats.kothBestWinStreak).toBe(3);
    // Lose one
    stats = applyKothStatsUpdate(stats, 4, 50, 30, 0, false);
    expect(stats.kothBestWinStreak).toBe(3);
    expect(stats.kothCurrentWinStreak).toBe(0);
    // Win 2 in a row — best streak stays at 3
    stats = applyKothStatsUpdate(stats, 1, 100, 60, 2, true);
    stats = applyKothStatsUpdate(stats, 1, 100, 60, 2, true);
    expect(stats.kothBestWinStreak).toBe(3);
    expect(stats.kothCurrentWinStreak).toBe(2);
  });
});
