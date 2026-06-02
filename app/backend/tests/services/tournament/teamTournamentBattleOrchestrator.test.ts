/**
 * Team Tournament Battle Orchestrator - Unit Tests
 * Feature: team-battle-tournaments
 *
 * Tests the draw tiebreaking logic (R4.4) in the resolveDraw function.
 * resolveDraw is a pure function that determines the winner when
 * simulateTeamBattle returns a draw.
 *
 * Requirements: R4.4
 */

import { resolveDraw, DrawResolution, calculateTeamTournamentPrestige } from '../../../src/services/tournament/teamTournamentBattleOrchestrator';
import { TeamBattleResult } from '../../../src/types/teamBattleLogTypes';

/**
 * Helper to create a minimal TeamBattleResult for testing resolveDraw.
 * Only the fields used by resolveDraw are meaningful: winningSide, isDraw, participants[].team, participants[].finalHP.
 */
function createBattleResult(overrides: Partial<TeamBattleResult> & Pick<TeamBattleResult, 'winningSide' | 'isDraw' | 'participants'>): TeamBattleResult {
  return {
    winnerRobotId: null,
    isByeMatch: false,
    durationSeconds: 120,
    battleLog: [],
    detailedCombatEvents: [],
    focusFireEvents: [],
    focusFireMetrics: { team1: 0, team2: 0 },
    allySupportMetrics: { team1: 0, team2: 0 },
    formationDefenceMetrics: { team1: 0, team2: 0 },
    arenaRadius: 100,
    startingPositions: {},
    endingPositions: {},
    ...overrides,
  };
}

describe('resolveDraw - Team Tournament Draw Tiebreaking (R4.4)', () => {
  const TEAM1_ID = 101;
  const TEAM2_ID = 202;

  describe('non-draw results pass through unchanged', () => {
    it('should return team1 as winner when winningSide is 1 and not a draw', () => {
      const result = createBattleResult({
        winningSide: 1,
        isDraw: false,
        participants: [
          { robotId: 1, team: 1, damageDealt: 100, damageTaken: 50, finalHP: 80, survivalSeconds: 120 },
          { robotId: 2, team: 2, damageDealt: 50, damageTaken: 100, finalHP: 0, survivalSeconds: 90 },
        ],
      });

      const resolution = resolveDraw(result, TEAM1_ID, TEAM2_ID);

      expect(resolution).toEqual<DrawResolution>({
        winningSide: 1,
        winningTeamId: TEAM1_ID,
      });
    });

    it('should return team2 as winner when winningSide is 2 and not a draw', () => {
      const result = createBattleResult({
        winningSide: 2,
        isDraw: false,
        participants: [
          { robotId: 1, team: 1, damageDealt: 50, damageTaken: 100, finalHP: 0, survivalSeconds: 90 },
          { robotId: 2, team: 2, damageDealt: 100, damageTaken: 50, finalHP: 80, survivalSeconds: 120 },
        ],
      });

      const resolution = resolveDraw(result, TEAM1_ID, TEAM2_ID);

      expect(resolution).toEqual<DrawResolution>({
        winningSide: 2,
        winningTeamId: TEAM2_ID,
      });
    });
  });

  describe('draw with HP tiebreaker', () => {
    it('should award win to team1 when team1 has more total HP', () => {
      const result = createBattleResult({
        winningSide: null,
        isDraw: true,
        participants: [
          { robotId: 1, team: 1, damageDealt: 80, damageTaken: 60, finalHP: 50, survivalSeconds: 300 },
          { robotId: 2, team: 1, damageDealt: 70, damageTaken: 50, finalHP: 40, survivalSeconds: 300 },
          { robotId: 3, team: 2, damageDealt: 60, damageTaken: 80, finalHP: 30, survivalSeconds: 300 },
          { robotId: 4, team: 2, damageDealt: 50, damageTaken: 70, finalHP: 20, survivalSeconds: 300 },
        ],
      });

      // Team 1 total HP: 50 + 40 = 90
      // Team 2 total HP: 30 + 20 = 50
      const resolution = resolveDraw(result, TEAM1_ID, TEAM2_ID);

      expect(resolution).toEqual<DrawResolution>({
        winningSide: 1,
        winningTeamId: TEAM1_ID,
      });
    });

    it('should award win to team2 when team2 has more total HP', () => {
      const result = createBattleResult({
        winningSide: null,
        isDraw: true,
        participants: [
          { robotId: 1, team: 1, damageDealt: 60, damageTaken: 80, finalHP: 10, survivalSeconds: 300 },
          { robotId: 2, team: 1, damageDealt: 50, damageTaken: 70, finalHP: 15, survivalSeconds: 300 },
          { robotId: 3, team: 2, damageDealt: 80, damageTaken: 60, finalHP: 45, survivalSeconds: 300 },
          { robotId: 4, team: 2, damageDealt: 70, damageTaken: 50, finalHP: 55, survivalSeconds: 300 },
        ],
      });

      // Team 1 total HP: 10 + 15 = 25
      // Team 2 total HP: 45 + 55 = 100
      const resolution = resolveDraw(result, TEAM1_ID, TEAM2_ID);

      expect(resolution).toEqual<DrawResolution>({
        winningSide: 2,
        winningTeamId: TEAM2_ID,
      });
    });
  });

  describe('draw with equal HP → higher seed (participant1) wins', () => {
    it('should award win to team1 (higher seed) when HP is exactly equal', () => {
      const result = createBattleResult({
        winningSide: null,
        isDraw: true,
        participants: [
          { robotId: 1, team: 1, damageDealt: 70, damageTaken: 70, finalHP: 30, survivalSeconds: 300 },
          { robotId: 2, team: 1, damageDealt: 60, damageTaken: 60, finalHP: 20, survivalSeconds: 300 },
          { robotId: 3, team: 2, damageDealt: 70, damageTaken: 70, finalHP: 30, survivalSeconds: 300 },
          { robotId: 4, team: 2, damageDealt: 60, damageTaken: 60, finalHP: 20, survivalSeconds: 300 },
        ],
      });

      // Team 1 total HP: 30 + 20 = 50
      // Team 2 total HP: 30 + 20 = 50
      const resolution = resolveDraw(result, TEAM1_ID, TEAM2_ID);

      expect(resolution).toEqual<DrawResolution>({
        winningSide: 1,
        winningTeamId: TEAM1_ID,
      });
    });

    it('should award win to team1 when both teams have 0 HP (mutual elimination)', () => {
      const result = createBattleResult({
        winningSide: null,
        isDraw: true,
        participants: [
          { robotId: 1, team: 1, damageDealt: 100, damageTaken: 100, finalHP: 0, survivalSeconds: 250 },
          { robotId: 2, team: 1, damageDealt: 90, damageTaken: 90, finalHP: 0, survivalSeconds: 200 },
          { robotId: 3, team: 2, damageDealt: 100, damageTaken: 100, finalHP: 0, survivalSeconds: 250 },
          { robotId: 4, team: 2, damageDealt: 90, damageTaken: 90, finalHP: 0, survivalSeconds: 200 },
        ],
      });

      // Team 1 total HP: 0 + 0 = 0
      // Team 2 total HP: 0 + 0 = 0
      const resolution = resolveDraw(result, TEAM1_ID, TEAM2_ID);

      expect(resolution).toEqual<DrawResolution>({
        winningSide: 1,
        winningTeamId: TEAM1_ID,
      });
    });
  });

  describe('3v3 draw scenarios', () => {
    it('should correctly sum HP across 3 participants per team', () => {
      const result = createBattleResult({
        winningSide: null,
        isDraw: true,
        participants: [
          { robotId: 1, team: 1, damageDealt: 50, damageTaken: 60, finalHP: 10, survivalSeconds: 300 },
          { robotId: 2, team: 1, damageDealt: 40, damageTaken: 50, finalHP: 5, survivalSeconds: 300 },
          { robotId: 3, team: 1, damageDealt: 30, damageTaken: 40, finalHP: 0, survivalSeconds: 250 },
          { robotId: 4, team: 2, damageDealt: 60, damageTaken: 50, finalHP: 20, survivalSeconds: 300 },
          { robotId: 5, team: 2, damageDealt: 50, damageTaken: 40, finalHP: 15, survivalSeconds: 300 },
          { robotId: 6, team: 2, damageDealt: 40, damageTaken: 30, finalHP: 10, survivalSeconds: 300 },
        ],
      });

      // Team 1 total HP: 10 + 5 + 0 = 15
      // Team 2 total HP: 20 + 15 + 10 = 45
      const resolution = resolveDraw(result, TEAM1_ID, TEAM2_ID);

      expect(resolution).toEqual<DrawResolution>({
        winningSide: 2,
        winningTeamId: TEAM2_ID,
      });
    });
  });
});


describe('calculateTeamTournamentPrestige - Stepped Curve (R6.7)', () => {
  describe('base prestige per round', () => {
    it('should return 20 for round 1', () => {
      expect(calculateTeamTournamentPrestige(1, 4)).toBe(20);
    });

    it('should return 30 for round 2', () => {
      expect(calculateTeamTournamentPrestige(2, 4)).toBe(30);
    });

    it('should return 40 for round 3', () => {
      expect(calculateTeamTournamentPrestige(3, 4)).toBe(40);
    });

    it('should return 50 for round 4 (non-finals)', () => {
      expect(calculateTeamTournamentPrestige(4, 5)).toBe(50);
    });

    it('should return 60 for round 5 (capped)', () => {
      expect(calculateTeamTournamentPrestige(5, 6)).toBe(60);
    });

    it('should return 60 for round 6+ (capped at 60)', () => {
      expect(calculateTeamTournamentPrestige(6, 7)).toBe(60);
      expect(calculateTeamTournamentPrestige(10, 11)).toBe(60);
    });
  });

  describe('championship bonus for finals', () => {
    it('should add +150 when currentRound equals maxRounds (finals)', () => {
      // R3 finals in a 3-round tournament: 40 + 150 = 190
      expect(calculateTeamTournamentPrestige(3, 3)).toBe(40 + 150);
    });

    it('should add +150 for R4 finals in a 4-round tournament', () => {
      // R4 finals: 50 + 150 = 200
      expect(calculateTeamTournamentPrestige(4, 4)).toBe(50 + 150);
    });

    it('should add +150 for R5 finals in a 5-round tournament', () => {
      // R5 finals: 60 + 150 = 210
      expect(calculateTeamTournamentPrestige(5, 5)).toBe(60 + 150);
    });

    it('should add +150 for R6+ finals (capped base + bonus)', () => {
      // R6 finals: 60 + 150 = 210
      expect(calculateTeamTournamentPrestige(6, 6)).toBe(60 + 150);
    });
  });

  describe('cumulative prestige for tournament champions', () => {
    it('should total 240 for 8-team (3-round) champion: 20+30+40+150', () => {
      const total = calculateTeamTournamentPrestige(1, 3)
        + calculateTeamTournamentPrestige(2, 3)
        + calculateTeamTournamentPrestige(3, 3);
      expect(total).toBe(20 + 30 + (40 + 150));
      expect(total).toBe(240);
    });

    it('should total 290 for 16-team (4-round) champion: 20+30+40+50+150', () => {
      const total = calculateTeamTournamentPrestige(1, 4)
        + calculateTeamTournamentPrestige(2, 4)
        + calculateTeamTournamentPrestige(3, 4)
        + calculateTeamTournamentPrestige(4, 4);
      expect(total).toBe(20 + 30 + 40 + (50 + 150));
      expect(total).toBe(290);
    });
  });
});
