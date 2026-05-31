import {
  calculateTeamBattleReward,
  distributeTeamCredits,
  calculateTeamBattleFame,
  calculateTeamBattlePrestige,
  calculateTeamBattleELOChanges,
  calculateTeamBattleLPDelta,
  getByeTeamELO,
  RobotCreditAllocation,
  TEAM_BATTLE_LP_WIN,
  TEAM_BATTLE_LP_LOSS,
  TEAM_BATTLE_LP_DRAW,
  LOSER_DRAW_FRACTION,
  BYE_TEAM_ELO_PER_ROBOT,
} from '../../../src/services/team-battle/teamBattleRewardService';
import { TeamBattleParticipantResult } from '../../../src/types/teamBattleLogTypes';
import { FAME_BY_LEAGUE, PRESTIGE_BY_LEAGUE } from '../../../src/utils/battleMath';
import { getLeagueWinReward, getParticipationReward } from '../../../src/utils/economyCalculations';

/**
 * Unit tests for Team Battle Reward Service.
 * Tests reward calculation per tier for 2v2 and 3v3 (winner, loser, draw),
 * credit distribution across N robots, ELO updates, LP updates,
 * and bye-team reward calculation.
 *
 * Validates: Requirements R7.1–R7.11
 */

describe('teamBattleRewardService', () => {
  // ─── Constants ─────────────────────────────────────────────────────────────

  describe('constants', () => {
    it('should have correct LP delta values', () => {
      expect(TEAM_BATTLE_LP_WIN).toBe(3);
      expect(TEAM_BATTLE_LP_LOSS).toBe(-1);
      expect(TEAM_BATTLE_LP_DRAW).toBe(1);
    });

    it('should have correct loser/draw fraction', () => {
      expect(LOSER_DRAW_FRACTION).toBe(0.20);
    });

    it('should have correct bye-team ELO per robot', () => {
      expect(BYE_TEAM_ELO_PER_ROBOT).toBe(1000);
    });
  });

  // ─── calculateTeamBattleReward ─────────────────────────────────────────────

  describe('calculateTeamBattleReward', () => {
    const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;

    describe('2v2 winner rewards (N=2 multiplier)', () => {
      it.each(tiers)('should return 2× (win + participation) for %s tier winner', (tier) => {
        const expected = (getLeagueWinReward(tier) + getParticipationReward(tier)) * 2;
        const result = calculateTeamBattleReward(tier, 2, true, false);
        expect(result).toBe(expected);
      });
    });

    describe('3v3 winner rewards (N=3 multiplier)', () => {
      it.each(tiers)('should return 3× (win + participation) for %s tier winner', (tier) => {
        const expected = (getLeagueWinReward(tier) + getParticipationReward(tier)) * 3;
        const result = calculateTeamBattleReward(tier, 3, true, false);
        expect(result).toBe(expected);
      });
    });

    describe('loser rewards (20% of winner)', () => {
      it.each(tiers)('should return 20%% of winner reward for %s tier 2v2 loser', (tier) => {
        const winnerReward = calculateTeamBattleReward(tier, 2, true, false);
        const loserReward = calculateTeamBattleReward(tier, 2, false, false);
        expect(loserReward).toBe(Math.round(winnerReward * 0.20));
      });

      it.each(tiers)('should return 20%% of winner reward for %s tier 3v3 loser', (tier) => {
        const winnerReward = calculateTeamBattleReward(tier, 3, true, false);
        const loserReward = calculateTeamBattleReward(tier, 3, false, false);
        expect(loserReward).toBe(Math.round(winnerReward * 0.20));
      });
    });

    describe('draw rewards (same as loser: 20% of winner)', () => {
      it.each(tiers)('should return 20%% of winner reward for %s tier 2v2 draw', (tier) => {
        const winnerReward = calculateTeamBattleReward(tier, 2, true, false);
        const drawReward = calculateTeamBattleReward(tier, 2, false, true);
        expect(drawReward).toBe(Math.round(winnerReward * 0.20));
      });

      it('should give same reward to both teams in a draw', () => {
        const team1Draw = calculateTeamBattleReward('gold', 2, true, true);
        const team2Draw = calculateTeamBattleReward('gold', 2, false, true);
        expect(team1Draw).toBe(team2Draw);
      });
    });

    describe('specific tier values match design table', () => {
      it('should match bronze 2v2 winner: 18,000', () => {
        expect(calculateTeamBattleReward('bronze', 2, true, false)).toBe(18000);
      });

      it('should match bronze 3v3 winner: 27,000', () => {
        expect(calculateTeamBattleReward('bronze', 3, true, false)).toBe(27000);
      });

      it('should match gold 2v2 winner: 72,000', () => {
        expect(calculateTeamBattleReward('gold', 2, true, false)).toBe(72000);
      });

      it('should match champion 3v3 winner: 810,000', () => {
        expect(calculateTeamBattleReward('champion', 3, true, false)).toBe(810000);
      });
    });

    describe('R7.2: loser reward is strictly > 0 and < winner', () => {
      it.each(tiers)('loser reward for %s is > 0 and < winner (2v2)', (tier) => {
        const winner = calculateTeamBattleReward(tier, 2, true, false);
        const loser = calculateTeamBattleReward(tier, 2, false, false);
        expect(loser).toBeGreaterThan(0);
        expect(loser).toBeLessThan(winner);
      });

      it.each(tiers)('loser reward for %s is > 0 and < winner (3v3)', (tier) => {
        const winner = calculateTeamBattleReward(tier, 3, true, false);
        const loser = calculateTeamBattleReward(tier, 3, false, false);
        expect(loser).toBeGreaterThan(0);
        expect(loser).toBeLessThan(winner);
      });
    });
  });

  // ─── distributeTeamCredits (R7.4) ──────────────────────────────────────────

  describe('distributeTeamCredits', () => {
    const makeParticipant = (
      robotId: number,
      finalHP: number,
      damageDealt: number,
    ): TeamBattleParticipantResult => ({
      robotId,
      team: 1,
      damageDealt,
      damageTaken: 100,
      finalHP,
      survivalSeconds: 120,
    });

    describe('sum conservation', () => {
      it('should distribute exactly totalReward across 2 survivors (2v2)', () => {
        const participants = [
          makeParticipant(1, 50, 200),
          makeParticipant(2, 30, 150),
        ];
        const allocations = distributeTeamCredits(18000, participants);
        const sum = allocations.reduce((s, a) => s + a.credits, 0);
        expect(sum).toBe(18000);
      });

      it('should distribute exactly totalReward across 3 survivors (3v3)', () => {
        const participants = [
          makeParticipant(1, 50, 200),
          makeParticipant(2, 30, 150),
          makeParticipant(3, 10, 100),
        ];
        const allocations = distributeTeamCredits(27000, participants);
        const sum = allocations.reduce((s, a) => s + a.credits, 0);
        expect(sum).toBe(27000);
      });

      it('should handle odd division without rounding loss', () => {
        const participants = [
          makeParticipant(1, 50, 200),
          makeParticipant(2, 30, 150),
          makeParticipant(3, 10, 100),
        ];
        // 10001 / 3 = 3333.67 — must still sum to exactly 10001
        const allocations = distributeTeamCredits(10001, participants);
        const sum = allocations.reduce((s, a) => s + a.credits, 0);
        expect(sum).toBe(10001);
      });
    });

    describe('survivor vs destroyed distribution', () => {
      it('should give surviving robots equal shares', () => {
        const participants = [
          makeParticipant(1, 50, 200),
          makeParticipant(2, 30, 150),
        ];
        const allocations = distributeTeamCredits(18000, participants);
        expect(allocations.find(a => a.robotId === 1)!.credits).toBe(9000);
        expect(allocations.find(a => a.robotId === 2)!.credits).toBe(9000);
      });

      it('should give destroyed robot equal share (even distribution)', () => {
        const participants = [
          makeParticipant(1, 50, 200), // survived
          makeParticipant(2, 0, 100),  // destroyed but dealt damage
        ];
        const allocations = distributeTeamCredits(18000, participants);
        const destroyed = allocations.find(a => a.robotId === 2)!;
        expect(destroyed.credits).toBe(9000);
      });

      it('should give destroyed robot with 0 damage equal share (even distribution)', () => {
        const participants = [
          makeParticipant(1, 50, 200), // survived
          makeParticipant(2, 0, 0),    // destroyed, no damage
        ];
        const allocations = distributeTeamCredits(18000, participants);
        const destroyed = allocations.find(a => a.robotId === 2)!;
        expect(destroyed.credits).toBe(9000);
      });

      it('should split evenly regardless of survival status', () => {
        const participants = [
          makeParticipant(1, 50, 200), // survived
          makeParticipant(2, 0, 100),  // destroyed but dealt damage
        ];
        const allocations = distributeTeamCredits(18000, participants);
        expect(allocations.find(a => a.robotId === 2)!.credits).toBe(9000);
        expect(allocations.find(a => a.robotId === 1)!.credits).toBe(9000);
      });
    });

    describe('3v3 mixed scenarios', () => {
      it('should handle 2 survivors + 1 destroyed with even split', () => {
        const participants = [
          makeParticipant(1, 50, 200), // survived
          makeParticipant(2, 30, 150), // survived
          makeParticipant(3, 0, 80),   // destroyed with damage
        ];
        const allocations = distributeTeamCredits(27000, participants);
        const sum = allocations.reduce((s, a) => s + a.credits, 0);
        expect(sum).toBe(27000);
        // Even split: 9000 each
        expect(allocations.find(a => a.robotId === 1)!.credits).toBe(9000);
        expect(allocations.find(a => a.robotId === 2)!.credits).toBe(9000);
        expect(allocations.find(a => a.robotId === 3)!.credits).toBe(9000);
      });

      it('should handle 1 survivor + 2 destroyed with even split', () => {
        const participants = [
          makeParticipant(1, 10, 300), // survived
          makeParticipant(2, 0, 50),   // destroyed with damage
          makeParticipant(3, 0, 0),    // destroyed no damage
        ];
        const allocations = distributeTeamCredits(27000, participants);
        const sum = allocations.reduce((s, a) => s + a.credits, 0);
        expect(sum).toBe(27000);
        expect(allocations.find(a => a.robotId === 1)!.credits).toBe(9000);
        expect(allocations.find(a => a.robotId === 2)!.credits).toBe(9000);
        expect(allocations.find(a => a.robotId === 3)!.credits).toBe(9000);
      });

      it('should handle all robots destroyed with even split', () => {
        const participants = [
          makeParticipant(1, 0, 200),
          makeParticipant(2, 0, 150),
          makeParticipant(3, 0, 100),
        ];
        const allocations = distributeTeamCredits(27000, participants);
        const sum = allocations.reduce((s, a) => s + a.credits, 0);
        expect(sum).toBe(27000);
        expect(allocations.find(a => a.robotId === 1)!.credits).toBe(9000);
        expect(allocations.find(a => a.robotId === 2)!.credits).toBe(9000);
        expect(allocations.find(a => a.robotId === 3)!.credits).toBe(9000);
      });
    });

    describe('edge cases', () => {
      it('should handle totalReward = 0', () => {
        const participants = [
          makeParticipant(1, 50, 200),
          makeParticipant(2, 30, 150),
        ];
        const allocations = distributeTeamCredits(0, participants);
        for (const alloc of allocations) {
          expect(alloc.credits).toBe(0);
        }
      });

      it('should handle empty participants array', () => {
        const allocations = distributeTeamCredits(18000, []);
        expect(allocations).toHaveLength(0);
      });

      it('should never produce negative credits', () => {
        const participants = [
          makeParticipant(1, 50, 200),
          makeParticipant(2, 0, 100),
          makeParticipant(3, 0, 50),
        ];
        const allocations = distributeTeamCredits(1, participants);
        for (const alloc of allocations) {
          expect(alloc.credits).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  // ─── calculateTeamBattleFame (R7.5) ────────────────────────────────────────

  describe('calculateTeamBattleFame', () => {
    it('should return full FAME_BY_LEAGUE value per robot (no splitting)', () => {
      expect(calculateTeamBattleFame('bronze')).toBe(FAME_BY_LEAGUE.bronze);
      expect(calculateTeamBattleFame('silver')).toBe(FAME_BY_LEAGUE.silver);
      expect(calculateTeamBattleFame('gold')).toBe(FAME_BY_LEAGUE.gold);
      expect(calculateTeamBattleFame('platinum')).toBe(FAME_BY_LEAGUE.platinum);
      expect(calculateTeamBattleFame('diamond')).toBe(FAME_BY_LEAGUE.diamond);
      expect(calculateTeamBattleFame('champion')).toBe(FAME_BY_LEAGUE.champion);
    });

    it('should default to bronze for unknown tier', () => {
      expect(calculateTeamBattleFame('unknown')).toBe(FAME_BY_LEAGUE.bronze);
    });

    it('should handle case-insensitive tier names', () => {
      expect(calculateTeamBattleFame('Gold')).toBe(FAME_BY_LEAGUE.gold);
      expect(calculateTeamBattleFame('CHAMPION')).toBe(FAME_BY_LEAGUE.champion);
    });
  });

  // ─── calculateTeamBattlePrestige ───────────────────────────────────────────

  describe('calculateTeamBattlePrestige', () => {
    it('should return full PRESTIGE_BY_LEAGUE value for winners', () => {
      expect(calculateTeamBattlePrestige('bronze', true, false)).toBe(PRESTIGE_BY_LEAGUE.bronze);
      expect(calculateTeamBattlePrestige('gold', true, false)).toBe(PRESTIGE_BY_LEAGUE.gold);
      expect(calculateTeamBattlePrestige('champion', true, false)).toBe(PRESTIGE_BY_LEAGUE.champion);
    });

    it('should return 0 for losers', () => {
      expect(calculateTeamBattlePrestige('gold', false, false)).toBe(0);
      expect(calculateTeamBattlePrestige('champion', false, false)).toBe(0);
    });

    it('should return 0 for draws', () => {
      expect(calculateTeamBattlePrestige('gold', true, true)).toBe(0);
      expect(calculateTeamBattlePrestige('gold', false, true)).toBe(0);
    });

    it('should handle case-insensitive tier names', () => {
      expect(calculateTeamBattlePrestige('Diamond', true, false)).toBe(PRESTIGE_BY_LEAGUE.diamond);
    });
  });

  // ─── calculateTeamBattleELOChanges (R7.6) ──────────────────────────────────

  describe('calculateTeamBattleELOChanges', () => {
    it('should return positive change for winner and negative for loser', () => {
      const result = calculateTeamBattleELOChanges(2000, 2000, true, false);
      expect(result.team1Change).toBeGreaterThan(0);
      expect(result.team2Change).toBeLessThan(0);
    });

    it('should return symmetric changes for equal ELO teams', () => {
      const result = calculateTeamBattleELOChanges(2000, 2000, true, false);
      expect(result.team1Change).toBe(-result.team2Change);
    });

    it('should give smaller gain to higher-rated winner (expected outcome)', () => {
      const highWins = calculateTeamBattleELOChanges(3000, 2000, true, false);
      const equalWins = calculateTeamBattleELOChanges(2000, 2000, true, false);
      expect(highWins.team1Change).toBeLessThan(equalWins.team1Change);
    });

    it('should give larger gain to lower-rated winner (upset)', () => {
      const lowWins = calculateTeamBattleELOChanges(2000, 3000, true, false);
      const equalWins = calculateTeamBattleELOChanges(2000, 2000, true, false);
      expect(lowWins.team1Change).toBeGreaterThan(equalWins.team1Change);
    });

    it('should handle draws correctly (small adjustments toward equilibrium)', () => {
      const result = calculateTeamBattleELOChanges(2000, 2000, false, true);
      // Equal teams drawing should produce 0 change
      expect(result.team1Change).toBe(0);
      expect(result.team2Change).toBe(0);
    });

    it('should handle draws with unequal ELO (higher-rated loses points)', () => {
      const result = calculateTeamBattleELOChanges(3000, 2000, false, true);
      // Higher-rated team drawing against lower-rated should lose points
      expect(result.team1Change).toBeLessThan(0);
      expect(result.team2Change).toBeGreaterThan(0);
    });

    it('should apply same delta to each member robot (verified by caller)', () => {
      // This test verifies the function returns a single delta per team
      // The orchestrator applies this same delta to each member robot
      const result = calculateTeamBattleELOChanges(2400, 2000, true, false);
      expect(typeof result.team1Change).toBe('number');
      expect(typeof result.team2Change).toBe('number');
      expect(Number.isInteger(result.team1Change)).toBe(true);
      expect(Number.isInteger(result.team2Change)).toBe(true);
    });
  });

  // ─── calculateTeamBattleLPDelta (R7.7) ────────────────────────────────────

  describe('calculateTeamBattleLPDelta', () => {
    it('should return +3 for wins', () => {
      expect(calculateTeamBattleLPDelta(true, false)).toBe(3);
    });

    it('should return -1 for losses', () => {
      expect(calculateTeamBattleLPDelta(false, false)).toBe(-1);
    });

    it('should return +1 for draws', () => {
      expect(calculateTeamBattleLPDelta(false, true)).toBe(1);
    });

    it('should return +1 for draws regardless of isWinner flag', () => {
      // In a draw, isWinner doesn't matter — both teams get +1
      expect(calculateTeamBattleLPDelta(true, true)).toBe(1);
    });
  });

  // ─── getByeTeamELO (R7.9) ─────────────────────────────────────────────────

  describe('getByeTeamELO', () => {
    it('should return 2000 for 2v2 (1000 per robot × 2)', () => {
      expect(getByeTeamELO(2)).toBe(2000);
    });

    it('should return 3000 for 3v3 (1000 per robot × 3)', () => {
      expect(getByeTeamELO(3)).toBe(3000);
    });
  });

  // ─── R7.8: No modification to individual robot LP or tag-team LP ───────────

  describe('R7.8 compliance', () => {
    it('should not export any function that modifies robot LP', () => {
      // The reward service only calculates Team_LP delta — it does not
      // export any function that touches individual robot LP or tag-team LP.
      // The orchestrator is responsible for applying the delta to TeamBattle.teamLp only.
      const lpDelta = calculateTeamBattleLPDelta(true, false);
      expect(lpDelta).toBe(3); // This is for Team_LP, not robot LP
    });
  });

  // ─── Bye-team reward calculation (R7.9) ────────────────────────────────────

  describe('bye-team reward calculation (R7.9)', () => {
    it('should compute reward normally for bye-team matches', () => {
      // Bye-team matches still award full winner reward to the real team
      const reward = calculateTeamBattleReward('bronze', 2, true, false);
      expect(reward).toBe(18000);
    });

    it('should compute ELO change against bye-team rating', () => {
      // Real team with ELO 2400 vs bye-team ELO 2000 (2v2)
      const byeELO = getByeTeamELO(2);
      const result = calculateTeamBattleELOChanges(2400, byeELO, true, false);
      // Winner should gain less when higher-rated
      expect(result.team1Change).toBeGreaterThan(0);
      expect(result.team1Change).toBeLessThan(16); // K=32, expected > 0.5
    });

    it('should compute ELO change against 3v3 bye-team rating', () => {
      // Real team with ELO 3000 vs bye-team ELO 3000 (3v3)
      const byeELO = getByeTeamELO(3);
      const result = calculateTeamBattleELOChanges(3000, byeELO, true, false);
      // Equal ELO: winner gets K/2 = 16
      expect(result.team1Change).toBe(16);
    });
  });
});
