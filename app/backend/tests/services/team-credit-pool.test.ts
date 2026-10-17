/**
 * Team credit pools — Season 2 #527.
 *
 * Every team-mode credit pool is multiplied by the Team_Credit_Pool_Factor
 * (0.75) exactly once, before the split: tag team and 2v2 2× → 1.5× a solo
 * reward, 3v3 3× → 2.25×, plus team tournaments and already-eligible team byes.
 * Solo rewards and byes, streaming, fame, prestige, ELO/LP and standings are
 * unchanged. Pools are rounded once and split with deterministic remainders so
 * the shares sum exactly to the recorded pool.
 *
 * Expected values are computed by hand (league win / participation per tier:
 * bronze 7,500 / 1,500, gold 30,000 / 6,000, champion 225,000 / 45,000).
 */

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';
import {
  TEAM_CREDIT_POOL_FACTOR,
  applyTeamCreditPoolFactor,
  getLeagueWinReward,
  getParticipationReward,
} from '../../src/utils/economyFormulas';
import { calculateTagTeamRewards, calculateTagTeamPrestige } from '../../src/services/tag-team/tagTeamRewards';
import { TAG_TEAM_PRESTIGE_MULTIPLIER } from '../../src/services/tag-team/tagTeamTypes';
import {
  calculateTeamBattleReward,
  calculateTeamBattleFame,
  calculateTeamBattlePrestige,
  calculateTeamBattleLPDelta,
  distributeTeamCredits,
} from '../../src/services/team-battle/teamBattleRewardService';
import { calculateTeamTournamentCreditPools } from '../../src/services/tournament/teamTournamentBattleOrchestrator';
import { resolveByeReward } from '../../src/utils/byeRewards';
import { FAME_BY_LEAGUE, PRESTIGE_BY_LEAGUE } from '../../src/utils/battleMath';
import {
  calculateTournamentParticipationReward,
  calculateTournamentWinReward,
} from '../../src/utils/tournamentRewards';

const SRC = path.join(__dirname, '../../src');
const read = (relative: string): string => fs.readFileSync(path.join(SRC, relative), 'utf8');

describe('the Team_Credit_Pool_Factor', () => {
  it('is one named constant of 0.75', () => {
    expect(TEAM_CREDIT_POOL_FACTOR).toBe(0.75);
  });

  it('rounds the reduced pool once, half up', () => {
    expect(applyTeamCreditPoolFactor(18000)).toBe(13500);
    expect(applyTeamCreditPoolFactor(13334)).toBe(10001); // 10,000.5
    expect(applyTeamCreditPoolFactor(6)).toBe(5); // 4.5
    expect(applyTeamCreditPoolFactor(5)).toBe(4); // 3.75
    expect(applyTeamCreditPoolFactor(0)).toBe(0);
  });

  it('is exact for any whole pool: |result − 0.75 × pool| ≤ 0.5', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 50_000_000 }), (pool) => {
        const result = applyTeamCreditPoolFactor(pool);
        expect(Number.isInteger(result)).toBe(true);
        expect(Math.abs(result * 4 - pool * 3)).toBeLessThanOrEqual(2);
      }),
      { numRuns: 300 },
    );
  });
});

describe('tag team pools: 1.5× a solo reward (was 2×)', () => {
  it.each([
    // tier, win pool (1.5 × (win + participation)), loss/draw pool (1.5 × participation)
    ['bronze', 13500, 2250],
    ['silver', 27000, 4500],
    ['gold', 54000, 9000],
    ['platinum', 108000, 18000],
    ['diamond', 207000, 34500],
    ['champion', 405000, 67500],
  ] as const)('%s: win %i, loss %i, draw %i', (tier, win, lossOrDraw) => {
    expect(calculateTagTeamRewards(tier, true, false)).toBe(win);
    expect(calculateTagTeamRewards(tier, false, false)).toBe(lossOrDraw);
    expect(calculateTagTeamRewards(tier, false, true)).toBe(lossOrDraw);
  });

  it('leaves tag team prestige on its own 1.6× multiplier', () => {
    expect(TAG_TEAM_PRESTIGE_MULTIPLIER).toBe(1.6);
    expect(calculateTagTeamPrestige('gold', true, false)).toBe(32); // 20 × 1.6
  });
});

describe('team tournament pools', () => {
  it('pays 0.75 × teamSize × the round amount, by hand', () => {
    // 100 participants → size 1.5; round 2 of 4 → 0.5: 20,000 × 1.5 × 0.5 = 15,000;
    // participation 30% = 4,500.
    expect(calculateTeamTournamentCreditPools(100, 2, 4, 2)).toEqual({ winnerPool: 22500, loserPool: 6750 });
    expect(calculateTeamTournamentCreditPools(100, 2, 4, 3)).toEqual({ winnerPool: 33750, loserPool: 10125 });
    // 10 participants, round 1 of 3: win 6,667 → 2v2 pool round(10,000.5) = 10,001.
    expect(calculateTeamTournamentCreditPools(10, 1, 3, 2)).toEqual({ winnerPool: 10001, loserPool: 3000 });
  });

  it('can never pay the N² amount again (regression for the pre-Spec #49 double multiplication)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 200_000 }),
        fc.integer({ min: 1, max: 12 }),
        fc.constantFrom(2, 3) as fc.Arbitrary<2 | 3>,
        (participants, maxRounds, teamSize) => {
          const round = Math.max(1, Math.ceil(maxRounds / 2));
          const win = calculateTournamentWinReward(participants, round, maxRounds);
          const loss = calculateTournamentParticipationReward(participants, round, maxRounds);
          const { winnerPool, loserPool } = calculateTeamTournamentCreditPools(participants, round, maxRounds, teamSize);
          // Exactly once: 0.75 × N × amount, rounded once.
          expect(Math.abs(winnerPool * 4 - win * teamSize * 3)).toBeLessThanOrEqual(2);
          expect(Math.abs(loserPool * 4 - loss * teamSize * 3)).toBeLessThanOrEqual(2);
          // Never N² × amount (nor N² × 0.75 × amount) for a non-trivial round.
          if (win > 0) {
            expect(winnerPool).toBeLessThan(win * teamSize);
            expect(winnerPool).toBeLessThan(Math.round(win * teamSize * teamSize * TEAM_CREDIT_POOL_FACTOR));
          }
          // The split sums to the pool exactly.
          const robots = Array.from({ length: teamSize }, (_, i) => ({ robotId: i + 1 }));
          expect(distributeTeamCredits(winnerPool, robots).reduce((s, a) => s + a.credits, 0)).toBe(winnerPool);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('the orchestrator multiplies credits by teamSize only inside the pool helper', () => {
    const source = read('services/tournament/teamTournamentBattleOrchestrator.ts');
    const rewardBody = source.slice(source.indexOf('async function distributeTeamTournamentRewards('));
    const creditsSection = rewardBody.slice(0, rewardBody.indexOf('// ─── Prestige'));
    expect(creditsSection).toContain('calculateTeamTournamentCreditPools(');
    expect(creditsSection).not.toMatch(/\*\s*teamSize/);
    expect(creditsSection).not.toMatch(/teamSize\s*\*/);
  });
});

describe('team byes carry the factor once; solo byes do not', () => {
  it.each([
    ['tag_team', 'gold', 9000], // 6,000 × 2 × 0.75
    ['league_2v2', 'gold', 9000],
    ['league_3v3', 'gold', 13500], // 6,000 × 3 × 0.75
    ['league_1v1', 'gold', 6000],
    ['koth', 'gold', 6000],
    ['grand_melee', 'gold', 6000],
  ] as const)('%s bye at %s pays %i', (mode, tier, expected) => {
    expect(resolveByeReward({ mode, tier }).credits).toBe(expected);
  });

  it('a team tournament bye equals that round\'s team loser pool', () => {
    for (const [mode, teamSize] of [['tournament_2v2', 2], ['tournament_3v3', 3]] as const) {
      const bye = resolveByeReward({ mode, totalParticipants: 100, currentRound: 2, maxRounds: 4 });
      expect(bye.credits).toBe(calculateTeamTournamentCreditPools(100, 2, 4, teamSize).loserPool);
    }
    // Solo tournament bye: 4,500, unchanged.
    expect(resolveByeReward({ mode: 'tournament_1v1', totalParticipants: 100, currentRound: 2, maxRounds: 4 }).credits).toBe(4500);
  });
});

describe('deterministic integer splits that sum to the recorded pool', () => {
  it('hands the remainder out one credit at a time to the first robots', () => {
    expect(distributeTeamCredits(10001, [{ robotId: 7 }, { robotId: 8 }]).map((s) => s.credits)).toEqual([5001, 5000]);
    expect(distributeTeamCredits(20251, [{ robotId: 1 }, { robotId: 2 }, { robotId: 3 }]).map((s) => s.credits))
      .toEqual([6751, 6750, 6750]);
    expect(distributeTeamCredits(20252, [{ robotId: 1 }, { robotId: 2 }, { robotId: 3 }]).map((s) => s.credits))
      .toEqual([6751, 6751, 6750]);
  });

  it('the tag team updater splits its pool with distributeTeamCredits, not a floor-only division', () => {
    const source = read('services/tag-team/tagTeamResultUpdater.ts');
    expect(source).toContain('distributeTeamCredits(');
    expect(source).not.toMatch(/Math\.floor\(team[12]Rewards \/ 2\)/);
  });
});

describe('what #527 leaves unchanged', () => {
  it('solo league rewards', () => {
    expect(getLeagueWinReward('bronze')).toBe(7500);
    expect(getParticipationReward('bronze')).toBe(1500);
    expect(getLeagueWinReward('champion')).toBe(225000);
  });

  it('team fame, prestige and LP', () => {
    expect(calculateTeamBattleFame('gold')).toBe(FAME_BY_LEAGUE.gold);
    expect(calculateTeamBattlePrestige('gold', true, false)).toBe(PRESTIGE_BY_LEAGUE.gold);
    expect(calculateTeamBattlePrestige('gold', false, false)).toBe(0);
    expect(calculateTeamBattleLPDelta(true, false)).toBe(3);
    expect(calculateTeamBattleLPDelta(false, false)).toBe(-1);
    expect(calculateTeamBattleLPDelta(false, true)).toBe(1);
  });

  it('applies the factor in exactly the four pool builders and nowhere else (not streaming)', () => {
    const callers = [
      'services/tag-team/tagTeamRewards.ts',
      'services/team-battle/teamBattleRewardService.ts',
      'services/tournament/teamTournamentBattleOrchestrator.ts',
      'utils/byeRewards.ts',
    ];
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink() || entry.name === '__tests__') return [];
        if (entry.isDirectory()) return walk(full);
        return entry.name.endsWith('.ts') ? [full] : [];
      });
    const users = walk(SRC)
      .map((file) => path.relative(SRC, file).split(path.sep).join('/'))
      .filter((relative) => relative !== 'utils/economyFormulas.ts')
      .filter((relative) => /applyTeamCreditPoolFactor|TEAM_CREDIT_POOL_FACTOR/.test(read(relative)))
      .sort();
    expect(users).toEqual([...callers].sort());

    // Streaming keeps its own team-size division and never sees the credit factor.
    expect(read('services/economy/streamingRevenueService.ts')).not.toMatch(/TEAM_CREDIT_POOL_FACTOR|applyTeamCreditPoolFactor/);
    expect(read('services/battle/battlePostCombat.ts')).not.toMatch(/TEAM_CREDIT_POOL_FACTOR|applyTeamCreditPoolFactor/);
  });

  it('the 2v2/3v3 fought pools match the decided multiples of a solo win', () => {
    // Gold: win + participation = 36,000.
    expect(calculateTeamBattleReward('gold', 2, true, false)).toBe(54000); // 1.5×
    expect(calculateTeamBattleReward('gold', 3, true, false)).toBe(81000); // 2.25×
  });
});
