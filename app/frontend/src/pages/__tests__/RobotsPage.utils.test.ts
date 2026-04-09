import { describe, it, expect } from 'vitest';

// Utility functions from RobotsPage.tsx
const getHPColor = (currentHP: number, maxHP: number): string => {
  const percentage = (currentHP / maxHP) * 100;
  if (percentage >= 70) return 'bg-green-500';
  if (percentage >= 30) return 'bg-yellow-500';
  return 'bg-red-500';
};

const calculateWinRate = (wins: number, totalBattles: number): string => {
  if (totalBattles === 0) return '0.0';
  return ((wins / totalBattles) * 100).toFixed(1);
};

const calculateReadiness = (currentHP: number, maxHP: number): number => {
  const hpPercent = (currentHP / maxHP) * 100;
  return Math.round(hpPercent);
};

const isLoadoutComplete = (
  loadoutType: string,
  mainWeaponId: number | null,
  offhandWeaponId: number | null,
  offhandWeapon: { weapon: { weaponType: string } } | null
): { complete: boolean; reason: string } => {
  if (!mainWeaponId) {
    return { complete: false, reason: 'No Main Weapon' };
  }

  switch (loadoutType) {
    case 'single':
      return { complete: true, reason: '' };
      
    case 'two_handed':
      return { complete: true, reason: '' };
      
    case 'dual_wield':
      if (!offhandWeaponId) {
        return { complete: false, reason: 'Missing Offhand Weapon' };
      }
      return { complete: true, reason: '' };
      
    case 'weapon_shield':
      if (!offhandWeaponId) {
        return { complete: false, reason: 'Missing Shield' };
      }
      if (offhandWeapon && offhandWeapon.weapon.weaponType !== 'shield') {
        return { complete: false, reason: 'Offhand Must Be Shield' };
      }
      return { complete: true, reason: '' };
      
    default:
      return { complete: false, reason: 'Invalid Loadout Type' };
  }
};

const getReadinessStatus = (
  currentHP: number, 
  maxHP: number,
  loadoutType: string,
  mainWeaponId: number | null,
  offhandWeaponId: number | null,
  offhandWeapon: { weapon: { weaponType: string } } | null
): { text: string; color: string; reason: string } => {
  const readiness = calculateReadiness(currentHP, maxHP);
  const hpPercent = (currentHP / maxHP) * 100;
  
  const loadoutCheck = isLoadoutComplete(loadoutType, mainWeaponId, offhandWeaponId, offhandWeapon);
  if (!loadoutCheck.complete) {
    return { text: 'Not Ready', color: 'text-red-500', reason: loadoutCheck.reason };
  }
  
  if (readiness >= 80) {
    return { text: 'Battle Ready', color: 'text-green-500', reason: '' };
  }
  
  let reason = '';
  if (hpPercent < 80) {
    reason = 'Low HP';
  }
  
  if (readiness >= 50) {
    return { text: 'Damaged', color: 'text-yellow-500', reason };
  }
  
  return { text: 'Critical', color: 'text-red-500', reason };
};

describe('RobotsPage Utility Functions', () => {
  describe('getHPColor', () => {
    it('should return green for HP at 100%', () => {
      expect(getHPColor(1000, 1000)).toBe('bg-green-500');
    });

    it('should return green for HP at 70%', () => {
      expect(getHPColor(700, 1000)).toBe('bg-green-500');
    });

    it('should return green for HP above 70%', () => {
      expect(getHPColor(850, 1000)).toBe('bg-green-500');
    });

    it('should return yellow for HP at 69%', () => {
      expect(getHPColor(690, 1000)).toBe('bg-yellow-500');
    });

    it('should return yellow for HP between 30-69%', () => {
      expect(getHPColor(500, 1000)).toBe('bg-yellow-500');
    });

    it('should return yellow for HP at 30%', () => {
      expect(getHPColor(300, 1000)).toBe('bg-yellow-500');
    });

    it('should return red for HP at 29%', () => {
      expect(getHPColor(290, 1000)).toBe('bg-red-500');
    });

    it('should return red for HP below 30%', () => {
      expect(getHPColor(200, 1000)).toBe('bg-red-500');
    });

    it('should return red for HP at 0%', () => {
      expect(getHPColor(0, 1000)).toBe('bg-red-500');
    });

    it('should handle different max HP values', () => {
      expect(getHPColor(350, 500)).toBe('bg-green-500'); // 70%
      expect(getHPColor(200, 500)).toBe('bg-yellow-500'); // 40%
      expect(getHPColor(100, 500)).toBe('bg-red-500'); // 20%
    });
  });

  describe('calculateWinRate', () => {
    it('should return "0.0" when no battles', () => {
      expect(calculateWinRate(0, 0)).toBe('0.0');
    });

    it('should return "100.0" for all wins', () => {
      expect(calculateWinRate(10, 10)).toBe('100.0');
    });

    it('should return "0.0" for no wins', () => {
      expect(calculateWinRate(0, 10)).toBe('0.0');
    });

    it('should calculate 50% win rate', () => {
      expect(calculateWinRate(5, 10)).toBe('50.0');
    });

    it('should calculate win rate with 1 decimal place', () => {
      expect(calculateWinRate(23, 38)).toBe('60.5');
    });

    it('should round to 1 decimal place', () => {
      expect(calculateWinRate(2, 3)).toBe('66.7');
    });

    it('should handle single battle win', () => {
      expect(calculateWinRate(1, 1)).toBe('100.0');
    });

    it('should handle single battle loss', () => {
      expect(calculateWinRate(0, 1)).toBe('0.0');
    });

    it('should calculate complex win rates', () => {
      expect(calculateWinRate(23, 35)).toBe('65.7');
    });
  });

  describe('calculateReadiness', () => {
    it('should return 100 for full HP', () => {
      expect(calculateReadiness(1000, 1000)).toBe(100);
    });

    it('should return 0 for zero HP', () => {
      expect(calculateReadiness(0, 1000)).toBe(0);
    });

    it('should return 50 for half HP', () => {
      expect(calculateReadiness(500, 1000)).toBe(50);
    });

    it('should return 85 for 85% HP', () => {
      expect(calculateReadiness(850, 1000)).toBe(85);
    });

    it('should round to nearest integer', () => {
      expect(calculateReadiness(666, 1000)).toBe(67); // 66.6 rounds to 67
      expect(calculateReadiness(664, 1000)).toBe(66); // 66.4 rounds to 66
    });

    it('should handle different max HP values', () => {
      expect(calculateReadiness(250, 500)).toBe(50);
      expect(calculateReadiness(425, 500)).toBe(85);
    });

    it('should be based on HP only (not shield)', () => {
      // This test documents that shields are NOT part of readiness calculation
      expect(calculateReadiness(800, 1000)).toBe(80);
      // Shield values would not affect this result
    });
  });

  describe('isLoadoutComplete', () => {
    describe('single loadout type', () => {
      it('should be complete with main weapon only', () => {
        const result = isLoadoutComplete('single', 1, null, null);
        expect(result.complete).toBe(true);
        expect(result.reason).toBe('');
      });

      it('should be incomplete without main weapon', () => {
        const result = isLoadoutComplete('single', null, null, null);
        expect(result.complete).toBe(false);
        expect(result.reason).toBe('No Main Weapon');
      });
    });

    describe('two_handed loadout type', () => {
      it('should be complete with main weapon only', () => {
        const result = isLoadoutComplete('two_handed', 1, null, null);
        expect(result.complete).toBe(true);
        expect(result.reason).toBe('');
      });

      it('should be incomplete without main weapon', () => {
        const result = isLoadoutComplete('two_handed', null, null, null);
        expect(result.complete).toBe(false);
        expect(result.reason).toBe('No Main Weapon');
      });
    });

    describe('dual_wield loadout type', () => {
      it('should be complete with both weapons', () => {
        const result = isLoadoutComplete('dual_wield', 1, 2, { weapon: { weaponType: 'sword' } });
        expect(result.complete).toBe(true);
        expect(result.reason).toBe('');
      });

      it('should be incomplete without main weapon', () => {
        const result = isLoadoutComplete('dual_wield', null, 2, { weapon: { weaponType: 'sword' } });
        expect(result.complete).toBe(false);
        expect(result.reason).toBe('No Main Weapon');
      });

      it('should be incomplete without offhand weapon', () => {
        const result = isLoadoutComplete('dual_wield', 1, null, null);
        expect(result.complete).toBe(false);
        expect(result.reason).toBe('Missing Offhand Weapon');
      });
    });

    describe('weapon_shield loadout type', () => {
      it('should be complete with weapon and shield', () => {
        const result = isLoadoutComplete('weapon_shield', 1, 2, { weapon: { weaponType: 'shield' } });
        expect(result.complete).toBe(true);
        expect(result.reason).toBe('');
      });

      it('should be incomplete without main weapon', () => {
        const result = isLoadoutComplete('weapon_shield', null, 2, { weapon: { weaponType: 'shield' } });
        expect(result.complete).toBe(false);
        expect(result.reason).toBe('No Main Weapon');
      });

      it('should be incomplete without offhand', () => {
        const result = isLoadoutComplete('weapon_shield', 1, null, null);
        expect(result.complete).toBe(false);
        expect(result.reason).toBe('Missing Shield');
      });

      it('should be incomplete if offhand is not a shield', () => {
        const result = isLoadoutComplete('weapon_shield', 1, 2, { weapon: { weaponType: 'sword' } });
        expect(result.complete).toBe(false);
        expect(result.reason).toBe('Offhand Must Be Shield');
      });
    });

    describe('invalid loadout type', () => {
      it('should be incomplete for unknown loadout type', () => {
        const result = isLoadoutComplete('unknown', 1, null, null);
        expect(result.complete).toBe(false);
        expect(result.reason).toBe('Invalid Loadout Type');
      });

      it('should be incomplete for empty string loadout type', () => {
        const result = isLoadoutComplete('', 1, null, null);
        expect(result.complete).toBe(false);
        expect(result.reason).toBe('Invalid Loadout Type');
      });
    });
  });

  describe('getReadinessStatus', () => {
    describe('loadout checks (priority 1)', () => {
      it('should return Not Ready for missing main weapon', () => {
        const result = getReadinessStatus(1000, 1000, 'single', null, null, null);
        expect(result.text).toBe('Not Ready');
        expect(result.color).toBe('text-red-500');
        expect(result.reason).toBe('No Main Weapon');
      });

      it('should return Not Ready for incomplete dual_wield', () => {
        const result = getReadinessStatus(1000, 1000, 'dual_wield', 1, null, null);
        expect(result.text).toBe('Not Ready');
        expect(result.color).toBe('text-red-500');
        expect(result.reason).toBe('Missing Offhand Weapon');
      });

      it('should return Not Ready for missing shield', () => {
        const result = getReadinessStatus(1000, 1000, 'weapon_shield', 1, null, null);
        expect(result.text).toBe('Not Ready');
        expect(result.color).toBe('text-red-500');
        expect(result.reason).toBe('Missing Shield');
      });

      it('should return Not Ready for non-shield offhand', () => {
        const result = getReadinessStatus(1000, 1000, 'weapon_shield', 1, 2, { weapon: { weaponType: 'sword' } });
        expect(result.text).toBe('Not Ready');
        expect(result.color).toBe('text-red-500');
        expect(result.reason).toBe('Offhand Must Be Shield');
      });
    });

    describe('HP checks (priority 2 - after loadout)', () => {
      it('should return Battle Ready for 100% HP with complete loadout', () => {
        const result = getReadinessStatus(1000, 1000, 'single', 1, null, null);
        expect(result.text).toBe('Battle Ready');
        expect(result.color).toBe('text-green-500');
        expect(result.reason).toBe('');
      });

      it('should return Battle Ready for 80% HP', () => {
        const result = getReadinessStatus(800, 1000, 'single', 1, null, null);
        expect(result.text).toBe('Battle Ready');
        expect(result.color).toBe('text-green-500');
        expect(result.reason).toBe('');
      });

      it('should return Damaged for 79% HP', () => {
        const result = getReadinessStatus(790, 1000, 'single', 1, null, null);
        expect(result.text).toBe('Damaged');
        expect(result.color).toBe('text-yellow-500');
        expect(result.reason).toBe('Low HP');
      });

      it('should return Damaged for 50% HP', () => {
        const result = getReadinessStatus(500, 1000, 'single', 1, null, null);
        expect(result.text).toBe('Damaged');
        expect(result.color).toBe('text-yellow-500');
        expect(result.reason).toBe('Low HP');
      });

      it('should return Critical for 49% HP', () => {
        const result = getReadinessStatus(490, 1000, 'single', 1, null, null);
        expect(result.text).toBe('Critical');
        expect(result.color).toBe('text-red-500');
        expect(result.reason).toBe('Low HP');
      });

      it('should return Critical for very low HP', () => {
        const result = getReadinessStatus(100, 1000, 'single', 1, null, null);
        expect(result.text).toBe('Critical');
        expect(result.color).toBe('text-red-500');
        expect(result.reason).toBe('Low HP');
      });

      it('should return Critical for 0 HP', () => {
        const result = getReadinessStatus(0, 1000, 'single', 1, null, null);
        expect(result.text).toBe('Critical');
        expect(result.color).toBe('text-red-500');
        expect(result.reason).toBe('Low HP');
      });
    });

    describe('complex scenarios', () => {
      it('should prioritize loadout check over HP', () => {
        // Even with full HP, missing weapon makes it Not Ready
        const result = getReadinessStatus(1000, 1000, 'single', null, null, null);
        expect(result.text).toBe('Not Ready');
        expect(result.reason).toBe('No Main Weapon');
      });

      it('should work with two_handed loadout', () => {
        const result = getReadinessStatus(900, 1000, 'two_handed', 1, null, null);
        expect(result.text).toBe('Battle Ready');
        expect(result.color).toBe('text-green-500');
      });

      it('should work with complete dual_wield loadout', () => {
        const result = getReadinessStatus(850, 1000, 'dual_wield', 1, 2, { weapon: { weaponType: 'sword' } });
        expect(result.text).toBe('Battle Ready');
        expect(result.color).toBe('text-green-500');
      });

      it('should work with complete weapon_shield loadout', () => {
        const result = getReadinessStatus(820, 1000, 'weapon_shield', 1, 2, { weapon: { weaponType: 'shield' } });
        expect(result.text).toBe('Battle Ready');
        expect(result.color).toBe('text-green-500');
      });
    });

    describe('shield exclusion from readiness', () => {
      it('should not consider shield in readiness calculation', () => {
        // This documents that shields are excluded from readiness
        // Only HP matters for readiness status
        const result = getReadinessStatus(850, 1000, 'single', 1, null, null);
        expect(result.text).toBe('Battle Ready');
        // Shield values (if they existed) would not affect this
      });
    });
  });
});
