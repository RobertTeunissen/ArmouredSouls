import { describe, it, expect } from 'vitest';
import { calculateDPS } from '../weaponConstants';

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
});
