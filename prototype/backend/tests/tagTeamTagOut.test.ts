import { Robot } from '@prisma/client';
import { shouldTagOut } from '../src/services/tagTeamBattleOrchestrator';

/**
 * Tests for the shouldTagOut function fix.
 * 
 * Bug: shouldTagOut used Math.floor on absolute HP threshold, causing a rounding
 * mismatch with the combat simulator's shouldYield (which uses percentage comparison).
 * Example: robot with maxHP=55, yieldThreshold=10, currentHP=5.45
 *   - shouldYield: (5.45/55)*100 = 9.9% <= 10% → yields ✓
 *   - old shouldTagOut: 5.45 <= Math.floor(10/100*55) = Math.floor(5.5) = 5 → false ✗
 *   - fixed shouldTagOut: (5.45/55)*100 = 9.9% <= 10% → true ✓
 */

function makeRobot(overrides: Partial<Robot> = {}): Robot {
  return {
    id: 1,
    name: 'TestBot',
    userId: 1,
    currentHP: 100,
    maxHP: 100,
    currentShield: 10,
    maxShield: 10,
    yieldThreshold: 10,
    stance: 'balanced',
    loadoutType: 'main_hand',
    mainWeaponId: null,
    offhandWeaponId: null,
    combatPower: 5,
    targetingSystems: 5,
    criticalSystems: 5,
    penetration: 5,
    weaponControl: 5,
    attackSpeed: 5,
    armorPlating: 5,
    shieldCapacity: 5,
    evasionThrusters: 5,
    damageDampeners: 5,
    counterProtocols: 5,
    hullIntegrity: 5,
    servoMotors: 5,
    gyroStabilizers: 5,
    hydraulicSystems: 5,
    powerCore: 5,
    combatAlgorithms: 5,
    threatAnalysis: 5,
    adaptiveAI: 5,
    logicCores: 5,
    syncProtocols: 5,
    supportSystems: 5,
    formationTactics: 5,
    elo: 1200,
    fame: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Robot;
}

describe('shouldTagOut', () => {
  it('should return true when robot HP is 0', () => {
    const robot = makeRobot({ currentHP: 0, maxHP: 100, yieldThreshold: 10 });
    expect(shouldTagOut(robot)).toBe(true);
  });

  it('should return true when robot HP is negative (destroyed)', () => {
    const robot = makeRobot({ currentHP: -5, maxHP: 100, yieldThreshold: 10 });
    expect(shouldTagOut(robot)).toBe(true);
  });

  it('should return true when HP percentage equals yield threshold exactly', () => {
    // 10/100 = 10% === yieldThreshold 10%
    const robot = makeRobot({ currentHP: 10, maxHP: 100, yieldThreshold: 10 });
    expect(shouldTagOut(robot)).toBe(true);
  });

  it('should return true when HP percentage is below yield threshold', () => {
    // 5/100 = 5% < 10%
    const robot = makeRobot({ currentHP: 5, maxHP: 100, yieldThreshold: 10 });
    expect(shouldTagOut(robot)).toBe(true);
  });

  it('should return false when HP percentage is above yield threshold', () => {
    // 15/100 = 15% > 10%
    const robot = makeRobot({ currentHP: 15, maxHP: 100, yieldThreshold: 10 });
    expect(shouldTagOut(robot)).toBe(false);
  });

  it('should handle the rounding edge case from battle #1736 (maxHP=55, HP=5.45, threshold=10)', () => {
    // This was the exact bug: (5.45/55)*100 = 9.9% which is <= 10% threshold
    // Old code: Math.floor(10/100 * 55) = Math.floor(5.5) = 5, and 5.45 > 5 → false (WRONG)
    // Fixed code: (5.45/55)*100 = 9.909% <= 10 → true (CORRECT)
    const robot = makeRobot({ currentHP: 5.45, maxHP: 55, yieldThreshold: 10 });
    expect(shouldTagOut(robot)).toBe(true);
  });

  it('should handle another rounding edge case (maxHP=73, threshold=15)', () => {
    // Math.floor(15/100 * 73) = Math.floor(10.95) = 10
    // HP of 10.5: old code 10.5 > 10 → false; new code (10.5/73)*100 = 14.38% <= 15% → true
    const robot = makeRobot({ currentHP: 10.5, maxHP: 73, yieldThreshold: 15 });
    expect(shouldTagOut(robot)).toBe(true);
  });

  it('should match shouldYield behavior: HP just above threshold returns false', () => {
    // 10.1/100 = 10.1% > 10% → should NOT tag out
    const robot = makeRobot({ currentHP: 10.1, maxHP: 100, yieldThreshold: 10 });
    expect(shouldTagOut(robot)).toBe(false);
  });

  it('should match shouldYield behavior: HP just below threshold returns true', () => {
    // 9.9/100 = 9.9% < 10% → should tag out
    const robot = makeRobot({ currentHP: 9.9, maxHP: 100, yieldThreshold: 10 });
    expect(shouldTagOut(robot)).toBe(true);
  });

  it('should return false when robot is at full HP', () => {
    const robot = makeRobot({ currentHP: 100, maxHP: 100, yieldThreshold: 10 });
    expect(shouldTagOut(robot)).toBe(false);
  });

  it('should handle yieldThreshold of 0 (never yields)', () => {
    const robot = makeRobot({ currentHP: 1, maxHP: 100, yieldThreshold: 0 });
    // 1% > 0% → should not tag out (only destruction triggers tag out)
    expect(shouldTagOut(robot)).toBe(false);
  });
});
