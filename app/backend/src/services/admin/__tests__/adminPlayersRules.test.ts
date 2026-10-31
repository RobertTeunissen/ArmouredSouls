/**
 * Pure rules of the Players and Economy admin pages: activity segments,
 * issues, medians, balance bands and window starts.
 */
jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: {} }));

import { playerIssues, playerSegment } from '../adminPlayersService';
import { balanceBands, median, windowStart } from '../adminEconomyService';

const NOW = new Date('2026-10-30T12:00:00Z');
const SEASON_START = new Date('2026-08-01T00:00:00Z');
const daysAgo = (days: number): Date => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

describe('playerSegment', () => {
  it('is active within 3 days of the last login', () => {
    expect(playerSegment({ lastLoginAt: daysAgo(2.9), createdAt: daysAgo(90) }, NOW, SEASON_START)).toBe('active');
  });
  it('is inactive after 3 days, while still this season', () => {
    expect(playerSegment({ lastLoginAt: daysAgo(3.1), createdAt: daysAgo(90) }, NOW, SEASON_START)).toBe('inactive');
  });
  it('is dormant without a login since the season started', () => {
    expect(playerSegment({ lastLoginAt: new Date('2026-07-31T00:00:00Z'), createdAt: daysAgo(200) }, NOW, SEASON_START)).toBe('dormant');
    expect(playerSegment({ lastLoginAt: null, createdAt: daysAgo(200) }, NOW, SEASON_START)).toBe('dormant');
  });
  it('reads the registration of an account that never logged in', () => {
    expect(playerSegment({ lastLoginAt: null, createdAt: daysAgo(1) }, NOW, SEASON_START)).toBe('active');
    expect(playerSegment({ lastLoginAt: null, createdAt: daysAgo(10) }, NOW, SEASON_START)).toBe('inactive');
  });
  it('has no dormant segment without a season start', () => {
    expect(playerSegment({ lastLoginAt: null, createdAt: daysAgo(400) }, NOW, null)).toBe('inactive');
  });
});

describe('playerIssues', () => {
  const ready = { battleReadiness: 100, mainWeaponId: 1, totalBattles: 4 };
  const base = { hasCompletedOnboarding: true, onboardingSkipped: false, onboardingStep: 9, currency: 500_000, robots: [ready] };
  const codes = (facts: Parameters<typeof playerIssues>[0]): string[] => playerIssues(facts).map((i) => i.code);

  it('is empty for a set-up stable with money', () => {
    expect(codes(base)).toEqual([]);
  });
  it('flags a stuck onboarding with its step', () => {
    const issues = playerIssues({ ...base, hasCompletedOnboarding: false, onboardingStep: 4, robots: [] });
    expect(issues.map((i) => i.code)).toEqual(['onboarding_stuck', 'no_robots']);
    expect(issues[0].label).toBe('Stuck in onboarding (step 4)');
  });
  it('does not call a skipped onboarding stuck', () => {
    expect(codes({ ...base, hasCompletedOnboarding: false, onboardingSkipped: true })).toEqual([]);
  });
  it('flags missing weapons before readiness, and no battles', () => {
    expect(codes({ ...base, robots: [{ battleReadiness: 100, mainWeaponId: null, totalBattles: 0 }] })).toEqual(['no_weapons', 'no_battles']);
    expect(codes({ ...base, robots: [{ battleReadiness: 50, mainWeaponId: 1, totalBattles: 3 }] })).toEqual(['no_battle_ready_robots']);
  });
  it('flags a balance below ₡10,000, also without robots', () => {
    expect(codes({ ...base, currency: 9_999 })).toEqual(['low_balance']);
    expect(codes({ ...base, currency: -5, robots: [] })).toEqual(['no_robots', 'low_balance']);
    expect(codes({ ...base, currency: 10_000 })).toEqual([]);
  });
});

describe('economy helpers', () => {
  it('median takes the lower middle and is 0 when empty', () => {
    expect(median([])).toBe(0);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2);
  });
  it('balance bands are lower-bound inclusive and cover negatives', () => {
    const bands = balanceBands([-1, 0, 99_999, 100_000, 3_000_000, 12_000_000]);
    expect(bands.map((b) => b.count)).toEqual([1, 2, 1, 0, 1, 0, 1]);
    expect(bands[0]).toMatchObject({ label: 'below ₡0', negative: true });
  });
  it('window start counts closed cycles and never goes below cycle 1', () => {
    expect(windowStart('7', 88)).toBe(82);
    expect(windowStart('30', 10)).toBe(1);
    expect(windowStart('season', 88)).toBe(1);
    expect(windowStart('season', 0)).toBe(0);
  });
});
