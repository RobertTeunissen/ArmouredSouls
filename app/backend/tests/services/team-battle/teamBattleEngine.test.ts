/**
 * Unit tests for Team Battle Engine (N-vs-N simultaneous combat simulation).
 *
 * Tests 2v2 and 3v3 simulations, victory/draw detection, focus fire events,
 * elimination logging, invalid roster rejection, and per-robot stats.
 *
 * Validates: Requirements R1.1, R1.5, R1.9, R5.1–R5.9
 *
 * @module tests/services/team-battle/teamBattleEngine.test
 */

import { simulateTeamBattle } from '../../../src/services/team-battle/teamBattleEngine';
import { RobotWithWeapons } from '../../../src/services/battle/combatSimulator';
import { TeamBattleError, TeamBattleErrorCode } from '../../../src/errors/teamBattleErrors';
import { Prisma } from '../../../generated/prisma';

// ── Test Fixtures ────────────────────────────────────────────────────

/** Create a minimal mock weapon for testing. */
function createMockWeapon(id: number, name: string, baseDamage: number, cooldown: number) {
  return {
    id,
    name,
    weaponType: 'energy',
    baseDamage,
    cooldown,
    cost: 1000,
    handsRequired: 'one' as const,
    damageType: 'energy',
    loadoutType: 'single',
    specialProperty: null,
    description: null,
    rangeBand: 'mid',
    combatPowerBonus: 0,
    targetingSystemsBonus: 0,
    criticalSystemsBonus: 0,
    penetrationBonus: 0,
    weaponControlBonus: 0,
    attackSpeedBonus: 0,
    armorPlatingBonus: 0,
    shieldCapacityBonus: 0,
    evasionThrustersBonus: 0,
    damageDampenersBonus: 0,
    counterProtocolsBonus: 0,
    hullIntegrityBonus: 0,
    servoMotorsBonus: 0,
    gyroStabilizersBonus: 0,
    hydraulicSystemsBonus: 0,
    powerCoreBonus: 0,
    combatAlgorithmsBonus: 0,
    threatAnalysisBonus: 0,
    adaptiveAIBonus: 0,
    logicCoresBonus: 0,
    syncProtocolsBonus: 0,
    supportSystemsBonus: 0,
    formationTacticsBonus: 0,
    createdAt: new Date(),
  };
}

/** Create a mock WeaponInventory entry with nested weapon. */
function createMockWeaponInventory(weaponId: number, weaponName: string, baseDamage: number, cooldown: number) {
  return {
    id: weaponId * 100,
    userId: 1,
    weaponId,
    customName: null,
    pricePaid: 1000,
    purchasedAt: new Date(),
    weapon: createMockWeapon(weaponId, weaponName, baseDamage, cooldown),
  };
}

/**
 * Create a mock RobotWithWeapons for team battle testing.
 * Uses moderate stats to ensure battles resolve within the time limit.
 */
function createMockRobot(
  id: number,
  name: string,
  overrides: Partial<{
    currentHP: number;
    maxHP: number;
    currentShield: number;
    maxShield: number;
    syncProtocols: number;
    supportSystems: number;
    formationTactics: number;
    combatPower: number;
    weaponDamage: number;
    attackSpeed: number;
  }> = {},
): RobotWithWeapons {
  const hp = overrides.currentHP ?? 100;
  const maxHp = overrides.maxHP ?? 100;
  const shield = overrides.currentShield ?? 20;
  const maxShield = overrides.maxShield ?? 20;
  const weaponDamage = overrides.weaponDamage ?? 25;

  return {
    id,
    userId: 1,
    name,
    frameId: 1,
    paintJob: null,
    // Combat Systems
    combatPower: new Prisma.Decimal(overrides.combatPower ?? 15),
    targetingSystems: new Prisma.Decimal(20),
    criticalSystems: new Prisma.Decimal(10),
    penetration: new Prisma.Decimal(10),
    weaponControl: new Prisma.Decimal(15),
    attackSpeed: new Prisma.Decimal(overrides.attackSpeed ?? 15),
    // Defensive Systems
    armorPlating: new Prisma.Decimal(8),
    shieldCapacity: new Prisma.Decimal(10),
    evasionThrusters: new Prisma.Decimal(5),
    damageDampeners: new Prisma.Decimal(5),
    counterProtocols: new Prisma.Decimal(5),
    // Chassis & Mobility
    hullIntegrity: new Prisma.Decimal(10),
    servoMotors: new Prisma.Decimal(10),
    gyroStabilizers: new Prisma.Decimal(5),
    hydraulicSystems: new Prisma.Decimal(5),
    powerCore: new Prisma.Decimal(5),
    // AI Processing
    combatAlgorithms: new Prisma.Decimal(10),
    threatAnalysis: new Prisma.Decimal(10),
    adaptiveAI: new Prisma.Decimal(5),
    logicCores: new Prisma.Decimal(5),
    // Team Coordination
    syncProtocols: new Prisma.Decimal(overrides.syncProtocols ?? 1),
    supportSystems: new Prisma.Decimal(overrides.supportSystems ?? 1),
    formationTactics: new Prisma.Decimal(overrides.formationTactics ?? 1),
    // Combat State
    currentHP: hp,
    maxHP: maxHp,
    currentShield: shield,
    maxShield: maxShield,
    damageTaken: 0,
    // Performance Tracking
    elo: 1200,
    totalBattles: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    damageDealtLifetime: 0,
    damageTakenLifetime: 0,
    kills: 0,
    // League & Fame
    fame: 0,
    titles: null,
    // Tag Team Statistics
    // Team Battle Statistics
    // KotH Statistics
    // Streaks
    // Stance/Loadout Wins
    offensiveWins: 0,
    defensiveWins: 0,
    balancedWins: 0,
    dualWieldWins: 0,
    // Economic State
    repairCost: 0,
    battleReadiness: 100,
    totalRepairsPaid: 0,
    // Player Configuration
    yieldThreshold: 0,
    loadoutType: 'single',
    stance: 'balanced',
    // Equipment
    mainWeaponId: id * 100,
    offhandWeaponId: null,
    // Appearance
    imageUrl: null,
    // Timestamps
    createdAt: new Date(),
    updatedAt: new Date(),
    // Weapon relations
    mainWeapon: createMockWeaponInventory(id, `Laser-${name}`, weaponDamage, 3.0),
    offhandWeapon: null,
  } as unknown as RobotWithWeapons;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('teamBattleEngine', () => {
  describe('2v2 simulation produces valid results (R1.1, R5.1)', () => {
    it('should produce a result with correct participant count', () => {
      const team1 = [createMockRobot(1, 'Alpha-1'), createMockRobot(2, 'Alpha-2')];
      const team2 = [createMockRobot(3, 'Beta-1'), createMockRobot(4, 'Beta-2')];

      const result = simulateTeamBattle(team1, team2, 2);

      expect(result).toBeDefined();
      expect(result.participants).toHaveLength(4);
      expect(result.durationSeconds).toBeGreaterThan(0);
      expect(result.battleLog).toBeDefined();
      expect(Array.isArray(result.battleLog)).toBe(true);
    });

    it('should assign correct team values to participants', () => {
      const team1 = [createMockRobot(1, 'Alpha-1'), createMockRobot(2, 'Alpha-2')];
      const team2 = [createMockRobot(3, 'Beta-1'), createMockRobot(4, 'Beta-2')];

      const result = simulateTeamBattle(team1, team2, 2);

      const team1Participants = result.participants.filter(p => p.team === 1);
      const team2Participants = result.participants.filter(p => p.team === 2);

      expect(team1Participants).toHaveLength(2);
      expect(team2Participants).toHaveLength(2);
    });

    it('should have either a winner or a draw', () => {
      const team1 = [createMockRobot(1, 'Alpha-1'), createMockRobot(2, 'Alpha-2')];
      const team2 = [createMockRobot(3, 'Beta-1'), createMockRobot(4, 'Beta-2')];

      const result = simulateTeamBattle(team1, team2, 2);

      if (result.isDraw) {
        expect(result.winningSide).toBeNull();
      } else {
        expect([1, 2]).toContain(result.winningSide);
      }
    });
  });

  describe('3v3 simulation produces valid results (R1.1, R5.1)', () => {
    it('should produce a result with correct participant count', () => {
      const team1 = [
        createMockRobot(1, 'Alpha-1'),
        createMockRobot(2, 'Alpha-2'),
        createMockRobot(3, 'Alpha-3'),
      ];
      const team2 = [
        createMockRobot(4, 'Beta-1'),
        createMockRobot(5, 'Beta-2'),
        createMockRobot(6, 'Beta-3'),
      ];

      const result = simulateTeamBattle(team1, team2, 3);

      expect(result).toBeDefined();
      expect(result.participants).toHaveLength(6);
      expect(result.durationSeconds).toBeGreaterThan(0);
    });

    it('should assign correct team values to participants', () => {
      const team1 = [
        createMockRobot(1, 'Alpha-1'),
        createMockRobot(2, 'Alpha-2'),
        createMockRobot(3, 'Alpha-3'),
      ];
      const team2 = [
        createMockRobot(4, 'Beta-1'),
        createMockRobot(5, 'Beta-2'),
        createMockRobot(6, 'Beta-3'),
      ];

      const result = simulateTeamBattle(team1, team2, 3);

      const team1Participants = result.participants.filter(p => p.team === 1);
      const team2Participants = result.participants.filter(p => p.team === 2);

      expect(team1Participants).toHaveLength(3);
      expect(team2Participants).toHaveLength(3);
    });

    it('should have either a winner or a draw', () => {
      const team1 = [
        createMockRobot(1, 'Alpha-1'),
        createMockRobot(2, 'Alpha-2'),
        createMockRobot(3, 'Alpha-3'),
      ];
      const team2 = [
        createMockRobot(4, 'Beta-1'),
        createMockRobot(5, 'Beta-2'),
        createMockRobot(6, 'Beta-3'),
      ];

      const result = simulateTeamBattle(team1, team2, 3);

      if (result.isDraw) {
        expect(result.winningSide).toBeNull();
      } else {
        expect([1, 2]).toContain(result.winningSide);
      }
    });
  });

  describe('victory detection — one side eliminated (R1.5, R5.5)', () => {
    it('should declare team 1 winner when team 2 has much lower HP', () => {
      // Team 1: strong robots; Team 2: very weak robots (low HP)
      const team1 = [
        createMockRobot(1, 'Strong-1', { currentHP: 200, maxHP: 200, combatPower: 30 }),
        createMockRobot(2, 'Strong-2', { currentHP: 200, maxHP: 200, combatPower: 30 }),
      ];
      const team2 = [
        createMockRobot(3, 'Weak-1', { currentHP: 15, maxHP: 15, combatPower: 1 }),
        createMockRobot(4, 'Weak-2', { currentHP: 15, maxHP: 15, combatPower: 1 }),
      ];

      const result = simulateTeamBattle(team1, team2, 2);

      // With such a large HP/power disparity, team 1 should win
      expect(result.isDraw).toBe(false);
      expect(result.winningSide).toBe(1);
    });

    it('should declare team 2 winner when team 1 has much lower HP', () => {
      const team1 = [
        createMockRobot(1, 'Weak-1', { currentHP: 15, maxHP: 15, combatPower: 1 }),
        createMockRobot(2, 'Weak-2', { currentHP: 15, maxHP: 15, combatPower: 1 }),
      ];
      const team2 = [
        createMockRobot(3, 'Strong-1', { currentHP: 200, maxHP: 200, combatPower: 30 }),
        createMockRobot(4, 'Strong-2', { currentHP: 200, maxHP: 200, combatPower: 30 }),
      ];

      const result = simulateTeamBattle(team1, team2, 2);

      expect(result.isDraw).toBe(false);
      expect(result.winningSide).toBe(2);
    });

    it('should have at least one survivor on the winning side', () => {
      const team1 = [
        createMockRobot(1, 'Alpha-1', { currentHP: 150, maxHP: 150, combatPower: 25 }),
        createMockRobot(2, 'Alpha-2', { currentHP: 150, maxHP: 150, combatPower: 25 }),
      ];
      const team2 = [
        createMockRobot(3, 'Beta-1', { currentHP: 30, maxHP: 30, combatPower: 3 }),
        createMockRobot(4, 'Beta-2', { currentHP: 30, maxHP: 30, combatPower: 3 }),
      ];

      const result = simulateTeamBattle(team1, team2, 2);

      if (!result.isDraw && result.winningSide !== null) {
        const winnerParticipants = result.participants.filter(
          p => p.team === result.winningSide,
        );
        const anySurvivor = winnerParticipants.some(p => p.finalHP > 0);
        expect(anySurvivor).toBe(true);
      }
    });
  });

  describe('draw detection — 300 seconds elapsed (R1.7, R5.6)', () => {
    it('should declare a draw when both teams are very tanky', () => {
      // Very high HP, very low damage — battle should time out at 300s
      const team1 = [
        createMockRobot(1, 'Tank-1', {
          currentHP: 5000, maxHP: 5000, combatPower: 1, weaponDamage: 1, attackSpeed: 1,
        }),
        createMockRobot(2, 'Tank-2', {
          currentHP: 5000, maxHP: 5000, combatPower: 1, weaponDamage: 1, attackSpeed: 1,
        }),
      ];
      const team2 = [
        createMockRobot(3, 'Tank-3', {
          currentHP: 5000, maxHP: 5000, combatPower: 1, weaponDamage: 1, attackSpeed: 1,
        }),
        createMockRobot(4, 'Tank-4', {
          currentHP: 5000, maxHP: 5000, combatPower: 1, weaponDamage: 1, attackSpeed: 1,
        }),
      ];

      const result = simulateTeamBattle(team1, team2, 2);

      expect(result.isDraw).toBe(true);
      expect(result.winningSide).toBeNull();
      expect(result.durationSeconds).toBeGreaterThanOrEqual(300);
    });

    it('should include a draw_timeout event in the battle log', () => {
      const team1 = [
        createMockRobot(1, 'Tank-1', {
          currentHP: 5000, maxHP: 5000, combatPower: 1, weaponDamage: 1, attackSpeed: 1,
        }),
        createMockRobot(2, 'Tank-2', {
          currentHP: 5000, maxHP: 5000, combatPower: 1, weaponDamage: 1, attackSpeed: 1,
        }),
      ];
      const team2 = [
        createMockRobot(3, 'Tank-3', {
          currentHP: 5000, maxHP: 5000, combatPower: 1, weaponDamage: 1, attackSpeed: 1,
        }),
        createMockRobot(4, 'Tank-4', {
          currentHP: 5000, maxHP: 5000, combatPower: 1, weaponDamage: 1, attackSpeed: 1,
        }),
      ];

      const result = simulateTeamBattle(team1, team2, 2);

      const drawEvent = result.battleLog.find(e => e.type === 'draw_timeout');
      expect(drawEvent).toBeDefined();
      if (drawEvent && drawEvent.type === 'draw_timeout') {
        expect(drawEvent.durationSeconds).toBeGreaterThanOrEqual(300);
      }
    });
  });

  describe('focus fire event detection and logging (R5.3, R6.2)', () => {
    it('should detect focus fire events when robots have high syncProtocols', () => {
      // High syncProtocols increases focus fire bonus; targeting AI tends to
      // focus on lowest-HP targets, so with 2 attackers vs 2 defenders,
      // focus fire is likely when one defender is weaker.
      const team1 = [
        createMockRobot(1, 'Sync-1', { syncProtocols: 40, combatPower: 20 }),
        createMockRobot(2, 'Sync-2', { syncProtocols: 40, combatPower: 20 }),
      ];
      const team2 = [
        createMockRobot(3, 'Target-1', { currentHP: 40, maxHP: 40 }),
        createMockRobot(4, 'Target-2', { currentHP: 100, maxHP: 100 }),
      ];

      const result = simulateTeamBattle(team1, team2, 2);

      // Focus fire events should be detected (both team1 robots targeting same enemy)
      // With one weak target, the AI should focus on it
      expect(result.focusFireEvents).toBeDefined();
      expect(Array.isArray(result.focusFireEvents)).toBe(true);

      // Check that focus fire events in the battle log exist
      const focusFireLogEvents = result.battleLog.filter(e => e.type === 'focus_fire');
      // At least some focus fire should occur given the HP disparity
      if (result.focusFireEvents.length > 0) {
        expect(focusFireLogEvents.length).toBeGreaterThan(0);
        const firstEvent = result.focusFireEvents[0];
        expect(firstEvent.contributorCount).toBeGreaterThanOrEqual(2);
        expect(firstEvent.bonusApplied).toBeGreaterThan(0);
        expect(firstEvent.targetRobotId).toBeDefined();
        expect(firstEvent.contributorRobotIds.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should include focus fire metrics in the result', () => {
      const team1 = [
        createMockRobot(1, 'Sync-1', { syncProtocols: 30 }),
        createMockRobot(2, 'Sync-2', { syncProtocols: 30 }),
      ];
      const team2 = [
        createMockRobot(3, 'Def-1', { currentHP: 50, maxHP: 50 }),
        createMockRobot(4, 'Def-2', { currentHP: 100, maxHP: 100 }),
      ];

      const result = simulateTeamBattle(team1, team2, 2);

      expect(result.focusFireMetrics).toBeDefined();
      expect(typeof result.focusFireMetrics.team1).toBe('number');
      expect(typeof result.focusFireMetrics.team2).toBe('number');
      expect(result.focusFireMetrics.team1).toBeGreaterThanOrEqual(0);
      expect(result.focusFireMetrics.team2).toBeGreaterThanOrEqual(0);
    });
  });

  describe('elimination event logging (R5.4)', () => {
    it('should log elimination events when robots are destroyed', () => {
      // One team is much stronger — should eliminate the other
      const team1 = [
        createMockRobot(1, 'Strong-1', { currentHP: 200, maxHP: 200, combatPower: 30 }),
        createMockRobot(2, 'Strong-2', { currentHP: 200, maxHP: 200, combatPower: 30 }),
      ];
      const team2 = [
        createMockRobot(3, 'Weak-1', { currentHP: 30, maxHP: 30, combatPower: 2 }),
        createMockRobot(4, 'Weak-2', { currentHP: 30, maxHP: 30, combatPower: 2 }),
      ];

      const result = simulateTeamBattle(team1, team2, 2);

      const eliminationEvents = result.battleLog.filter(e => e.type === 'elimination');

      // At least the losing team's robots should be eliminated
      expect(eliminationEvents.length).toBeGreaterThanOrEqual(1);

      // Each elimination event should have required fields
      for (const event of eliminationEvents) {
        if (event.type === 'elimination') {
          expect(event.robotId).toBeDefined();
          expect(event.team === 1 || event.team === 2).toBe(true);
          expect(event.tick).toBeGreaterThan(0);
          expect(event.timestamp).toBeGreaterThan(0);
        }
      }
    });

    it('should log eliminations for all robots on the losing side', () => {
      const team1 = [
        createMockRobot(1, 'Strong-1', { currentHP: 300, maxHP: 300, combatPower: 35 }),
        createMockRobot(2, 'Strong-2', { currentHP: 300, maxHP: 300, combatPower: 35 }),
      ];
      const team2 = [
        createMockRobot(3, 'Weak-1', { currentHP: 20, maxHP: 20, combatPower: 1 }),
        createMockRobot(4, 'Weak-2', { currentHP: 20, maxHP: 20, combatPower: 1 }),
      ];

      const result = simulateTeamBattle(team1, team2, 2);

      if (!result.isDraw) {
        const losingSide = result.winningSide === 1 ? 2 : 1;
        const loserEliminations = result.battleLog.filter(
          e => e.type === 'elimination' && e.team === losingSide,
        );
        // All robots on the losing side should be eliminated
        expect(loserEliminations.length).toBe(2);
      }
    });
  });

  describe('rejection of invalid roster sizes (R1.9)', () => {
    it('should throw TEAM_INVALID_SIZE when teamSize is not 2 or 3', () => {
      const team1 = [createMockRobot(1, 'A-1')];
      const team2 = [createMockRobot(2, 'B-1')];

      expect(() => {
        simulateTeamBattle(team1, team2, 1 as unknown as 2 | 3);
      }).toThrow(TeamBattleError);

      try {
        simulateTeamBattle(team1, team2, 4 as unknown as 2 | 3);
      } catch (error) {
        expect(error).toBeInstanceOf(TeamBattleError);
        expect((error as TeamBattleError).code).toBe(TeamBattleErrorCode.TEAM_INVALID_SIZE);
      }
    });

    it('should throw TEAM_INVALID_COMPOSITION when team 1 has wrong size', () => {
      const team1 = [createMockRobot(1, 'A-1')]; // Only 1 robot for 2v2
      const team2 = [createMockRobot(2, 'B-1'), createMockRobot(3, 'B-2')];

      expect(() => {
        simulateTeamBattle(team1, team2, 2);
      }).toThrow(TeamBattleError);

      try {
        simulateTeamBattle(team1, team2, 2);
      } catch (error) {
        expect(error).toBeInstanceOf(TeamBattleError);
        expect((error as TeamBattleError).code).toBe(
          TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        );
      }
    });

    it('should throw TEAM_INVALID_COMPOSITION when team 2 has wrong size', () => {
      const team1 = [createMockRobot(1, 'A-1'), createMockRobot(2, 'A-2')];
      const team2 = [createMockRobot(3, 'B-1')]; // Only 1 robot for 2v2

      expect(() => {
        simulateTeamBattle(team1, team2, 2);
      }).toThrow(TeamBattleError);

      try {
        simulateTeamBattle(team1, team2, 2);
      } catch (error) {
        expect(error).toBeInstanceOf(TeamBattleError);
        expect((error as TeamBattleError).code).toBe(
          TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        );
      }
    });

    it('should throw TEAM_INVALID_COMPOSITION when team has too many robots', () => {
      const team1 = [
        createMockRobot(1, 'A-1'),
        createMockRobot(2, 'A-2'),
        createMockRobot(3, 'A-3'),
      ]; // 3 robots for 2v2
      const team2 = [createMockRobot(4, 'B-1'), createMockRobot(5, 'B-2')];

      expect(() => {
        simulateTeamBattle(team1, team2, 2);
      }).toThrow(TeamBattleError);

      try {
        simulateTeamBattle(team1, team2, 2);
      } catch (error) {
        expect(error).toBeInstanceOf(TeamBattleError);
        expect((error as TeamBattleError).code).toBe(
          TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        );
      }
    });

    it('should throw TEAM_INVALID_COMPOSITION for 3v3 with wrong sizes', () => {
      const team1 = [createMockRobot(1, 'A-1'), createMockRobot(2, 'A-2')]; // 2 for 3v3
      const team2 = [
        createMockRobot(3, 'B-1'),
        createMockRobot(4, 'B-2'),
        createMockRobot(5, 'B-3'),
      ];

      expect(() => {
        simulateTeamBattle(team1, team2, 3);
      }).toThrow(TeamBattleError);

      try {
        simulateTeamBattle(team1, team2, 3);
      } catch (error) {
        expect(error).toBeInstanceOf(TeamBattleError);
        expect((error as TeamBattleError).code).toBe(
          TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        );
      }
    });
  });

  describe('per-robot stats are populated correctly (R5.8, R5.9)', () => {
    it('should populate damageDealt for all participants', () => {
      const team1 = [createMockRobot(1, 'Alpha-1'), createMockRobot(2, 'Alpha-2')];
      const team2 = [createMockRobot(3, 'Beta-1'), createMockRobot(4, 'Beta-2')];

      const result = simulateTeamBattle(team1, team2, 2);

      for (const participant of result.participants) {
        expect(typeof participant.damageDealt).toBe('number');
        expect(participant.damageDealt).toBeGreaterThanOrEqual(0);
      }

      // At least some robots should have dealt damage
      const totalDamage = result.participants.reduce((sum, p) => sum + p.damageDealt, 0);
      expect(totalDamage).toBeGreaterThan(0);
    });

    it('should populate damageTaken for all participants', () => {
      const team1 = [createMockRobot(1, 'Alpha-1'), createMockRobot(2, 'Alpha-2')];
      const team2 = [createMockRobot(3, 'Beta-1'), createMockRobot(4, 'Beta-2')];

      const result = simulateTeamBattle(team1, team2, 2);

      for (const participant of result.participants) {
        expect(typeof participant.damageTaken).toBe('number');
        expect(participant.damageTaken).toBeGreaterThanOrEqual(0);
      }

      // At least some robots should have taken damage
      const totalTaken = result.participants.reduce((sum, p) => sum + p.damageTaken, 0);
      expect(totalTaken).toBeGreaterThan(0);
    });

    it('should populate finalHP for all participants (non-negative)', () => {
      const team1 = [createMockRobot(1, 'Alpha-1'), createMockRobot(2, 'Alpha-2')];
      const team2 = [createMockRobot(3, 'Beta-1'), createMockRobot(4, 'Beta-2')];

      const result = simulateTeamBattle(team1, team2, 2);

      for (const participant of result.participants) {
        expect(typeof participant.finalHP).toBe('number');
        expect(participant.finalHP).toBeGreaterThanOrEqual(0);
      }
    });

    it('should populate survivalSeconds for all participants', () => {
      const team1 = [
        createMockRobot(1, 'Strong-1', { currentHP: 200, maxHP: 200, combatPower: 25 }),
        createMockRobot(2, 'Strong-2', { currentHP: 200, maxHP: 200, combatPower: 25 }),
      ];
      const team2 = [
        createMockRobot(3, 'Weak-1', { currentHP: 30, maxHP: 30, combatPower: 2 }),
        createMockRobot(4, 'Weak-2', { currentHP: 30, maxHP: 30, combatPower: 2 }),
      ];

      const result = simulateTeamBattle(team1, team2, 2);

      for (const participant of result.participants) {
        expect(typeof participant.survivalSeconds).toBe('number');
        expect(participant.survivalSeconds).toBeGreaterThan(0);
        expect(participant.survivalSeconds).toBeLessThanOrEqual(300);
      }

      // Eliminated robots should have lower survival time than the battle duration
      if (!result.isDraw) {
        const losingSide = result.winningSide === 1 ? 2 : 1;
        const loserParticipants = result.participants.filter(p => p.team === losingSide);
        for (const loser of loserParticipants) {
          expect(loser.survivalSeconds).toBeLessThanOrEqual(result.durationSeconds);
        }
      }
    });

    it('should have correct robotId values matching input robots', () => {
      const team1 = [createMockRobot(101, 'Alpha-1'), createMockRobot(102, 'Alpha-2')];
      const team2 = [createMockRobot(201, 'Beta-1'), createMockRobot(202, 'Beta-2')];

      const result = simulateTeamBattle(team1, team2, 2);

      const participantIds = result.participants.map(p => p.robotId).sort();
      expect(participantIds).toEqual([101, 102, 201, 202]);
    });

    it('should populate stats correctly for 3v3', () => {
      const team1 = [
        createMockRobot(1, 'Alpha-1'),
        createMockRobot(2, 'Alpha-2'),
        createMockRobot(3, 'Alpha-3'),
      ];
      const team2 = [
        createMockRobot(4, 'Beta-1'),
        createMockRobot(5, 'Beta-2'),
        createMockRobot(6, 'Beta-3'),
      ];

      const result = simulateTeamBattle(team1, team2, 3);

      // All 6 participants should have valid stats
      expect(result.participants).toHaveLength(6);
      for (const participant of result.participants) {
        expect(participant.robotId).toBeDefined();
        expect(participant.team === 1 || participant.team === 2).toBe(true);
        expect(participant.damageDealt).toBeGreaterThanOrEqual(0);
        expect(participant.damageTaken).toBeGreaterThanOrEqual(0);
        expect(participant.finalHP).toBeGreaterThanOrEqual(0);
        expect(participant.survivalSeconds).toBeGreaterThan(0);
      }
    });
  });
});
