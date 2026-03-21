import { describe, it, expect } from 'vitest';
import { calculateDPS, calculateWeaponCooldown, WEAPON_COOLDOWN_BASES, WEAPON_DAMAGE_SCALING } from '../weaponConstants';

describe('weaponConstants', () => {
  describe('calculateDPS', () => {
    it('should calculate DPS with one decimal place', () => {
      expect(calculateDPS(8, 3)).toBe('2.7');   // Practice Sword: 8/3 = 2.667
    });

    it('should calculate DPS for fast weapons', () => {
      expect(calculateDPS(6, 2)).toBe('3.0');   // Machine Pistol: 6/2 = 3.0
    });

    it('should calculate DPS for high-damage slow weapons', () => {
      expect(calculateDPS(33, 6)).toBe('5.5');  // Railgun: 33/6 = 5.5
    });

    it('should return 0.0 for zero cooldown', () => {
      expect(calculateDPS(10, 0)).toBe('0.0');
    });

    it('should return 0.0 for negative cooldown', () => {
      expect(calculateDPS(10, -1)).toBe('0.0');
    });

    it('should return 0.0 for shields (zero damage)', () => {
      expect(calculateDPS(0, 0)).toBe('0.0');
    });
  });

  describe('calculateWeaponCooldown (deprecated)', () => {
    it('should still work for backward compatibility', () => {
      const result = calculateWeaponCooldown('melee', 30);
      expect(result).toBe('4.0');
    });
  });

  describe('WEAPON_COOLDOWN_BASES (deprecated)', () => {
    it('should have correct base cooldowns for all weapon types', () => {
      expect(WEAPON_COOLDOWN_BASES.melee).toBe(2.0);
      expect(WEAPON_COOLDOWN_BASES.ballistic).toBe(3.0);
      expect(WEAPON_COOLDOWN_BASES.energy).toBe(2.5);
      expect(WEAPON_COOLDOWN_BASES.explosive).toBe(4.0);
    });
  });

  describe('WEAPON_DAMAGE_SCALING (deprecated)', () => {
    it('should have correct damage scaling for all weapon types', () => {
      expect(WEAPON_DAMAGE_SCALING.melee).toBe(15);
      expect(WEAPON_DAMAGE_SCALING.ballistic).toBe(20);
      expect(WEAPON_DAMAGE_SCALING.energy).toBe(18);
      expect(WEAPON_DAMAGE_SCALING.explosive).toBe(25);
    });
  });
});
