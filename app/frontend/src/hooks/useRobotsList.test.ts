/**
 * Unit tests for pure utility functions exported from useRobotsList.
 * These are pure functions with no React/API dependencies.
 */
import { describe, it, expect } from 'vitest';
import {
  getHPColor,
  calculateWinRate,
  calculateReadiness,
  isLoadoutComplete,
  getReadinessStatus,
} from './useRobotsList';

describe('getHPColor', () => {
  it('should return green for HP >= 70%', () => {
    expect(getHPColor(100, 100)).toBe('bg-green-500');
    expect(getHPColor(70, 100)).toBe('bg-green-500');
    expect(getHPColor(85, 100)).toBe('bg-green-500');
  });

  it('should return yellow for HP >= 30% and < 70%', () => {
    expect(getHPColor(69, 100)).toBe('bg-yellow-500');
    expect(getHPColor(30, 100)).toBe('bg-yellow-500');
    expect(getHPColor(50, 100)).toBe('bg-yellow-500');
  });

  it('should return red for HP < 30%', () => {
    expect(getHPColor(29, 100)).toBe('bg-red-500');
    expect(getHPColor(1, 100)).toBe('bg-red-500');
    expect(getHPColor(0, 100)).toBe('bg-red-500');
  });
});

describe('calculateWinRate', () => {
  it('should return 0.0 when no battles', () => {
    expect(calculateWinRate(0, 0)).toBe('0.0');
  });

  it('should calculate correct win rate percentage', () => {
    expect(calculateWinRate(7, 10)).toBe('70.0');
    expect(calculateWinRate(1, 3)).toBe('33.3');
    expect(calculateWinRate(10, 10)).toBe('100.0');
  });
});

describe('calculateReadiness', () => {
  it('should return 0 when maxHP is 0', () => {
    expect(calculateReadiness(50, 0)).toBe(0);
  });

  it('should cap at 100', () => {
    expect(calculateReadiness(110, 100)).toBe(100);
  });

  it('should return correct percentage', () => {
    expect(calculateReadiness(50, 100)).toBe(50);
    expect(calculateReadiness(100, 100)).toBe(100);
    expect(calculateReadiness(0, 100)).toBe(0);
  });
});

describe('isLoadoutComplete', () => {
  it('should require main weapon for all loadout types', () => {
    const result = isLoadoutComplete('single', null, null, null);
    expect(result.complete).toBe(false);
    expect(result.reason).toBe('No Main Weapon');
  });

  it('should be complete for single loadout with main weapon', () => {
    const result = isLoadoutComplete('single', 1, null, null);
    expect(result.complete).toBe(true);
  });

  it('should be complete for two_handed loadout with main weapon', () => {
    const result = isLoadoutComplete('two_handed', 1, null, null);
    expect(result.complete).toBe(true);
  });

  it('should require offhand for dual_wield', () => {
    expect(isLoadoutComplete('dual_wield', 1, null, null).complete).toBe(false);
    expect(isLoadoutComplete('dual_wield', 1, 2, null).complete).toBe(true);
  });

  it('should require shield for weapon_shield', () => {
    expect(isLoadoutComplete('weapon_shield', 1, null, null).complete).toBe(false);
    expect(isLoadoutComplete('weapon_shield', 1, 2, { weapon: { weaponType: 'shield' } }).complete).toBe(true);
    const nonShield = isLoadoutComplete('weapon_shield', 1, 2, { weapon: { weaponType: 'energy' } });
    expect(nonShield.complete).toBe(false);
    expect(nonShield.reason).toBe('Offhand Must Be Shield');
  });

  it('should return invalid for unknown loadout type', () => {
    const result = isLoadoutComplete('unknown', 1, null, null);
    expect(result.complete).toBe(false);
    expect(result.reason).toBe('Invalid Loadout Type');
  });
});

describe('getReadinessStatus', () => {
  it('should show Not Ready when loadout is incomplete', () => {
    const result = getReadinessStatus(100, 100, 'single', null, null, null);
    expect(result.text).toBe('Not Ready');
    expect(result.color).toBe('text-red-500');
  });

  it('should show Battle Ready when HP >= 80% and loadout complete', () => {
    const result = getReadinessStatus(80, 100, 'single', 1, null, null);
    expect(result.text).toBe('Battle Ready');
    expect(result.color).toBe('text-green-500');
  });

  it('should show Damaged when readiness 50-79%', () => {
    const result = getReadinessStatus(60, 100, 'single', 1, null, null);
    expect(result.text).toBe('Damaged');
    expect(result.color).toBe('text-yellow-500');
  });

  it('should show Critical when readiness < 50%', () => {
    const result = getReadinessStatus(20, 100, 'single', 1, null, null);
    expect(result.text).toBe('Critical');
    expect(result.color).toBe('text-red-500');
  });
});
