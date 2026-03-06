/**
 * Tests for useBattleReadiness hook
 *
 * Requirements: 23.4, 23.5, 23.6
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBattleReadiness, BATTLE_READINESS_CREDIT_THRESHOLD } from '../useBattleReadiness';
import type { Robot } from '../../utils/robotApi';

/** Helper to create a minimal Robot for testing */
function makeRobot(overrides: Partial<Robot> = {}): Robot {
  return {
    id: 1,
    name: 'TestBot',
    elo: 1500,
    fame: 0,
    currentHP: 100,
    maxHP: 100,
    currentShield: 50,
    maxShield: 50,
    repairCost: 0,
    level: 1,
    currentLeague: 'Bronze',
    leagueId: null,
    leaguePoints: 0,
    userId: 1,
    createdAt: '2026-01-01T00:00:00Z',
    wins: 0,
    losses: 0,
    draws: 0,
    totalBattles: 0,
    battleReadiness: 100,
    yieldThreshold: 0,
    loadoutType: 'single',
    mainWeaponId: null,
    offhandWeaponId: null,
    combatPower: 1,
    targetingSystems: 1,
    criticalSystems: 1,
    penetration: 1,
    weaponControl: 1,
    attackSpeed: 1,
    armorPlating: 1,
    shieldCapacity: 1,
    evasionThrusters: 1,
    damageDampeners: 1,
    counterProtocols: 1,
    hullIntegrity: 1,
    servoMotors: 1,
    gyroStabilizers: 1,
    hydraulicSystems: 1,
    powerCore: 1,
    combatAlgorithms: 1,
    threatAnalysis: 1,
    adaptiveAI: 1,
    logicCores: 1,
    syncProtocols: 1,
    mainWeapon: null,
    offhandWeapon: null,
    ...overrides,
  };
}

describe('useBattleReadiness', () => {
  it('should return ready when robot exists with weapon and credits >= 100K', () => {
    const robots = [makeRobot({ mainWeapon: { id: 1, name: 'Laser Rifle' } })];
    const { result } = renderHook(() => useBattleReadiness(robots, 200_000));

    expect(result.current.isReady).toBe(true);
    expect(result.current.issues).toHaveLength(0);
  });

  it('should return not ready when no robots', () => {
    const { result } = renderHook(() => useBattleReadiness([], 200_000));

    expect(result.current.isReady).toBe(false);
    expect(result.current.issues).toHaveLength(1);
    expect(result.current.issues[0].message).toBe('Create at least one robot');
  });

  it('should return not ready when robot has no weapon', () => {
    const robots = [makeRobot({ mainWeapon: null })];
    const { result } = renderHook(() => useBattleReadiness(robots, 200_000));

    expect(result.current.isReady).toBe(false);
    expect(result.current.issues).toHaveLength(1);
    expect(result.current.issues[0].message).toBe('Equip a weapon on at least one robot');
  });

  it('should return not ready when credits < 100K', () => {
    const robots = [makeRobot({ mainWeapon: { id: 1, name: 'Laser Rifle' } })];
    const { result } = renderHook(() => useBattleReadiness(robots, 50_000));

    expect(result.current.isReady).toBe(false);
    expect(result.current.issues).toHaveLength(1);
    expect(result.current.issues[0].message).toBe('Maintain at least ₡100,000 in credits for repairs');
  });

  it('should return multiple issues when multiple conditions fail', () => {
    const { result } = renderHook(() => useBattleReadiness([], 50_000));

    expect(result.current.isReady).toBe(false);
    expect(result.current.issues).toHaveLength(2);
    expect(result.current.issues.map((i) => i.message)).toContain('Create at least one robot');
    expect(result.current.issues.map((i) => i.message)).toContain(
      'Maintain at least ₡100,000 in credits for repairs',
    );
  });

  it('should return ready with multiple robots where at least one has weapon', () => {
    const robots = [
      makeRobot({ id: 1, mainWeapon: null }),
      makeRobot({ id: 2, mainWeapon: { id: 1, name: 'Machine Gun' } }),
    ];
    const { result } = renderHook(() => useBattleReadiness(robots, 150_000));

    expect(result.current.isReady).toBe(true);
    expect(result.current.issues).toHaveLength(0);
  });

  it('should return not ready when all robots lack weapons', () => {
    const robots = [
      makeRobot({ id: 1, mainWeapon: null }),
      makeRobot({ id: 2, mainWeapon: undefined }),
    ];
    const { result } = renderHook(() => useBattleReadiness(robots, 200_000));

    expect(result.current.isReady).toBe(false);
    expect(result.current.issues).toHaveLength(1);
    expect(result.current.issues[0].message).toBe('Equip a weapon on at least one robot');
  });

  it('should return ready at exactly 100K credits', () => {
    const robots = [makeRobot({ mainWeapon: { id: 1, name: 'Laser Rifle' } })];
    const { result } = renderHook(() =>
      useBattleReadiness(robots, BATTLE_READINESS_CREDIT_THRESHOLD),
    );

    expect(result.current.isReady).toBe(true);
    expect(result.current.issues).toHaveLength(0);
  });

  it('should return not ready at 99,999 credits', () => {
    const robots = [makeRobot({ mainWeapon: { id: 1, name: 'Laser Rifle' } })];
    const { result } = renderHook(() =>
      useBattleReadiness(robots, BATTLE_READINESS_CREDIT_THRESHOLD - 1),
    );

    expect(result.current.isReady).toBe(false);
    expect(result.current.issues).toHaveLength(1);
  });

  it('should include action links in issues', () => {
    const { result } = renderHook(() => useBattleReadiness([], 0));

    for (const issue of result.current.issues) {
      expect(issue.action).toBeTruthy();
      expect(issue.link).toBeTruthy();
    }
  });

  it('should not add weapon issue when there are no robots', () => {
    const { result } = renderHook(() => useBattleReadiness([], 200_000));

    // Only the "create robot" issue, not the "equip weapon" issue
    expect(result.current.issues).toHaveLength(1);
    expect(result.current.issues[0].message).toBe('Create at least one robot');
  });
});
