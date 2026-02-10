import { describe, it, expect } from 'vitest';
import { calculateWeaponCooldown, WEAPON_COOLDOWN_BASES, WEAPON_DAMAGE_SCALING } from '../weaponConstants';

describe('weaponConstants', () => {
  describe('calculateWeaponCooldown', () => {
    it('should calculate cooldown for melee weapons correctly', () => {
      const result = calculateWeaponCooldown('melee', 30);
      expect(result).toBe('4.0'); // 2.0 + (30/15) = 4.0
    });

    it('should calculate cooldown for ballistic weapons correctly', () => {
      const result = calculateWeaponCooldown('ballistic', 40);
      expect(result).toBe('5.0'); // 3.0 + (40/20) = 5.0
    });

    it('should calculate cooldown for energy weapons correctly', () => {
      const result = calculateWeaponCooldown('energy', 36);
      expect(result).toBe('4.5'); // 2.5 + (36/18) = 4.5
    });

    it('should calculate cooldown for explosive weapons correctly', () => {
      const result = calculateWeaponCooldown('explosive', 50);
      expect(result).toBe('6.0'); // 4.0 + (50/25) = 6.0
    });

    it('should use default values for unknown weapon types', () => {
      const result = calculateWeaponCooldown('unknown', 40);
      expect(result).toBe('5.0'); // 3.0 + (40/20) = 5.0
    });

    it('should handle zero damage', () => {
      const result = calculateWeaponCooldown('melee', 0);
      expect(result).toBe('2.0'); // 2.0 + (0/15) = 2.0
    });

    it('should format result to one decimal place', () => {
      const result = calculateWeaponCooldown('melee', 17);
      expect(result).toBe('3.1'); // 2.0 + (17/15) = 3.133... -> 3.1
    });
  });

  describe('WEAPON_COOLDOWN_BASES', () => {
    it('should have correct base cooldowns for all weapon types', () => {
      expect(WEAPON_COOLDOWN_BASES.melee).toBe(2.0);
      expect(WEAPON_COOLDOWN_BASES.ballistic).toBe(3.0);
      expect(WEAPON_COOLDOWN_BASES.energy).toBe(2.5);
      expect(WEAPON_COOLDOWN_BASES.explosive).toBe(4.0);
    });
  });

  describe('WEAPON_DAMAGE_SCALING', () => {
    it('should have correct damage scaling for all weapon types', () => {
      expect(WEAPON_DAMAGE_SCALING.melee).toBe(15);
      expect(WEAPON_DAMAGE_SCALING.ballistic).toBe(20);
      expect(WEAPON_DAMAGE_SCALING.energy).toBe(18);
      expect(WEAPON_DAMAGE_SCALING.explosive).toBe(25);
    });
  });
});
