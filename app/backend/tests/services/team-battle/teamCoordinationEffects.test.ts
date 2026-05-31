import {
  calculateFocusFireBonus,
  calculateAllyShieldRegen,
  calculateFormationDefense,
  FORMATION_RANGE,
  ATTRIBUTE_SCALE_CAP,
  FOCUS_FIRE_MAX,
  ALLY_SHIELD_REGEN_MAX,
  FORMATION_DEFENCE_MAX,
} from '../../../src/services/team-battle/teamCoordinationEffects';

/**
 * Unit tests for team coordination effects (ally-targeted bonuses in Team Battle Mode).
 * Tests each formula at attribute values 0, 5, 15, 25, 50, verifies zero-attribute
 * produces zero bonus, max cap values, and edge cases (teamSize=2 vs 3, partial contributors).
 *
 * Validates: Requirements R6.1–R6.7
 */

describe('teamCoordinationEffects', () => {
  describe('constants', () => {
    it('should export correct constant values', () => {
      expect(FORMATION_RANGE).toBe(8);
      expect(ATTRIBUTE_SCALE_CAP).toBe(50);
      expect(FOCUS_FIRE_MAX).toBe(0.25);
      expect(ALLY_SHIELD_REGEN_MAX).toBe(0.8);
      expect(FORMATION_DEFENCE_MAX).toBe(0.20);
    });
  });

  describe('calculateFocusFireBonus', () => {
    describe('at standard attribute values (teamSize=2, all contributors)', () => {
      it('should return 0 when avgSyncProtocols = 0 (R6.7)', () => {
        expect(calculateFocusFireBonus(0, 2, 2)).toBe(0);
      });

      it('should return correct bonus at avgSyncProtocols = 5', () => {
        // 0.25 × √(5/50) × (2/2) = 0.25 × √0.1 × 1 ≈ 0.0791
        const result = calculateFocusFireBonus(5, 2, 2);
        expect(result).toBeCloseTo(0.25 * Math.sqrt(5 / 50), 10);
      });

      it('should return correct bonus at avgSyncProtocols = 15', () => {
        // 0.25 × √(15/50) × (2/2) = 0.25 × √0.3 ≈ 0.1369
        const result = calculateFocusFireBonus(15, 2, 2);
        expect(result).toBeCloseTo(0.25 * Math.sqrt(15 / 50), 10);
      });

      it('should return correct bonus at avgSyncProtocols = 25', () => {
        // 0.25 × √(25/50) × (2/2) = 0.25 × √0.5 ≈ 0.1768
        const result = calculateFocusFireBonus(25, 2, 2);
        expect(result).toBeCloseTo(0.25 * Math.sqrt(25 / 50), 10);
      });

      it('should return max bonus (25%) at avgSyncProtocols = 50', () => {
        // 0.25 × √(50/50) × (2/2) = 0.25 × 1 × 1 = 0.25
        const result = calculateFocusFireBonus(50, 2, 2);
        expect(result).toBe(0.25);
      });
    });

    describe('at standard attribute values (teamSize=3)', () => {
      it('should return 0 when avgSyncProtocols = 0 (R6.7)', () => {
        expect(calculateFocusFireBonus(0, 2, 3)).toBe(0);
      });

      it('should return correct bonus at avgSyncProtocols = 5, 2/3 contributors', () => {
        // 0.25 × √(5/50) × (2/3) ≈ 0.0527
        const result = calculateFocusFireBonus(5, 2, 3);
        expect(result).toBeCloseTo(0.25 * Math.sqrt(5 / 50) * (2 / 3), 10);
      });

      it('should return correct bonus at avgSyncProtocols = 15, 3/3 contributors', () => {
        // 0.25 × √(15/50) × (3/3) ≈ 0.1369
        const result = calculateFocusFireBonus(15, 3, 3);
        expect(result).toBeCloseTo(0.25 * Math.sqrt(15 / 50), 10);
      });

      it('should return correct bonus at avgSyncProtocols = 25, 2/3 contributors', () => {
        // 0.25 × √(25/50) × (2/3) ≈ 0.1179
        const result = calculateFocusFireBonus(25, 2, 3);
        expect(result).toBeCloseTo(0.25 * Math.sqrt(25 / 50) * (2 / 3), 10);
      });

      it('should return max bonus (25%) at avgSyncProtocols = 50, 3/3 contributors', () => {
        // 0.25 × √(50/50) × (3/3) = 0.25
        const result = calculateFocusFireBonus(50, 3, 3);
        expect(result).toBe(0.25);
      });
    });

    describe('zero-attribute produces zero bonus (R6.7)', () => {
      it('should return 0 for teamSize=2', () => {
        expect(calculateFocusFireBonus(0, 2, 2)).toBe(0);
      });

      it('should return 0 for teamSize=3', () => {
        expect(calculateFocusFireBonus(0, 3, 3)).toBe(0);
      });

      it('should return 0 for negative attribute values', () => {
        expect(calculateFocusFireBonus(-5, 2, 2)).toBe(0);
      });
    });

    describe('max cap values', () => {
      it('should not exceed 25% even with attribute > 50 (clamped)', () => {
        const result = calculateFocusFireBonus(100, 2, 2);
        expect(result).toBeLessThanOrEqual(FOCUS_FIRE_MAX);
      });

      it('should reach exactly 25% at attribute=50 with full contributors', () => {
        expect(calculateFocusFireBonus(50, 2, 2)).toBe(0.25);
        expect(calculateFocusFireBonus(50, 3, 3)).toBe(0.25);
      });
    });

    describe('edge cases — partial contributors', () => {
      it('should return 0 when contributorCount < 2 (no focus fire)', () => {
        expect(calculateFocusFireBonus(50, 1, 2)).toBe(0);
        expect(calculateFocusFireBonus(50, 0, 3)).toBe(0);
      });

      it('should scale linearly with contributor ratio (2/3 vs 3/3)', () => {
        const twoOfThree = calculateFocusFireBonus(25, 2, 3);
        const threeOfThree = calculateFocusFireBonus(25, 3, 3);
        expect(twoOfThree).toBeCloseTo(threeOfThree * (2 / 3), 10);
      });

      it('should produce higher bonus with more contributors in 3v3', () => {
        const twoOfThree = calculateFocusFireBonus(30, 2, 3);
        const threeOfThree = calculateFocusFireBonus(30, 3, 3);
        expect(threeOfThree).toBeGreaterThan(twoOfThree);
      });
    });
  });

  describe('calculateAllyShieldRegen', () => {
    describe('at standard attribute values (dt=1.0)', () => {
      it('should return 0 when supportSystems = 0 (R6.7)', () => {
        expect(calculateAllyShieldRegen(0, 1.0)).toBe(0);
      });

      it('should return correct regen at supportSystems = 5', () => {
        // 0.8 × √(5/50) × 1.0 ≈ 0.2530
        const result = calculateAllyShieldRegen(5, 1.0);
        expect(result).toBeCloseTo(0.8 * Math.sqrt(5 / 50), 10);
      });

      it('should return correct regen at supportSystems = 15', () => {
        // 0.8 × √(15/50) × 1.0 ≈ 0.4382
        const result = calculateAllyShieldRegen(15, 1.0);
        expect(result).toBeCloseTo(0.8 * Math.sqrt(15 / 50), 10);
      });

      it('should return correct regen at supportSystems = 25', () => {
        // 0.8 × √(25/50) × 1.0 ≈ 0.5657
        const result = calculateAllyShieldRegen(25, 1.0);
        expect(result).toBeCloseTo(0.8 * Math.sqrt(25 / 50), 10);
      });

      it('should return max regen (0.80 shield/sec) at supportSystems = 50', () => {
        // 0.8 × √(50/50) × 1.0 = 0.8
        const result = calculateAllyShieldRegen(50, 1.0);
        expect(result).toBe(0.8);
      });
    });

    describe('with different dt values', () => {
      it('should scale linearly with dt', () => {
        const dt05 = calculateAllyShieldRegen(25, 0.5);
        const dt10 = calculateAllyShieldRegen(25, 1.0);
        expect(dt10).toBeCloseTo(dt05 * 2, 10);
      });

      it('should return correct regen at dt=0.1 (typical tick)', () => {
        // 0.8 × √(50/50) × 0.1 = 0.08
        const result = calculateAllyShieldRegen(50, 0.1);
        expect(result).toBeCloseTo(0.08, 10);
      });

      it('should return 0 regen at dt=0', () => {
        const result = calculateAllyShieldRegen(50, 0);
        expect(result).toBe(0);
      });
    });

    describe('zero-attribute produces zero bonus (R6.7)', () => {
      it('should return 0 for supportSystems = 0', () => {
        expect(calculateAllyShieldRegen(0, 1.0)).toBe(0);
      });

      it('should return 0 for negative attribute values', () => {
        expect(calculateAllyShieldRegen(-10, 1.0)).toBe(0);
      });
    });

    describe('max cap values', () => {
      it('should not exceed 0.80 shield/sec at dt=1.0 even with attribute > 50', () => {
        const result = calculateAllyShieldRegen(100, 1.0);
        expect(result).toBeLessThanOrEqual(ALLY_SHIELD_REGEN_MAX);
      });

      it('should reach exactly 0.80 at attribute=50, dt=1.0', () => {
        expect(calculateAllyShieldRegen(50, 1.0)).toBe(0.8);
      });
    });
  });

  describe('calculateFormationDefense', () => {
    describe('at standard attribute values (teamSize=2, 1 ally in range)', () => {
      it('should return 0 when avgFormationTactics = 0 (R6.7)', () => {
        expect(calculateFormationDefense(0, 1, 2)).toBe(0);
      });

      it('should return correct reduction at avgFormationTactics = 5', () => {
        // 0.20 × √(5/50) × (1/1) ≈ 0.0632
        const result = calculateFormationDefense(5, 1, 2);
        expect(result).toBeCloseTo(0.20 * Math.sqrt(5 / 50) * (1 / 1), 10);
      });

      it('should return correct reduction at avgFormationTactics = 15', () => {
        // 0.20 × √(15/50) × (1/1) ≈ 0.1095
        const result = calculateFormationDefense(15, 1, 2);
        expect(result).toBeCloseTo(0.20 * Math.sqrt(15 / 50), 10);
      });

      it('should return correct reduction at avgFormationTactics = 25', () => {
        // 0.20 × √(25/50) × (1/1) ≈ 0.1414
        const result = calculateFormationDefense(25, 1, 2);
        expect(result).toBeCloseTo(0.20 * Math.sqrt(25 / 50), 10);
      });

      it('should return max reduction (20%) at avgFormationTactics = 50', () => {
        // 0.20 × √(50/50) × (1/1) = 0.20
        const result = calculateFormationDefense(50, 1, 2);
        expect(result).toBe(0.20);
      });
    });

    describe('at standard attribute values (teamSize=3)', () => {
      it('should return 0 when avgFormationTactics = 0 (R6.7)', () => {
        expect(calculateFormationDefense(0, 2, 3)).toBe(0);
      });

      it('should return correct reduction at avgFormationTactics = 5, 1/2 allies in range', () => {
        // 0.20 × √(5/50) × (1/2) ≈ 0.0316
        const result = calculateFormationDefense(5, 1, 3);
        expect(result).toBeCloseTo(0.20 * Math.sqrt(5 / 50) * (1 / 2), 10);
      });

      it('should return correct reduction at avgFormationTactics = 15, 2/2 allies in range', () => {
        // 0.20 × √(15/50) × (2/2) ≈ 0.1095
        const result = calculateFormationDefense(15, 2, 3);
        expect(result).toBeCloseTo(0.20 * Math.sqrt(15 / 50), 10);
      });

      it('should return correct reduction at avgFormationTactics = 25, 1/2 allies in range', () => {
        // 0.20 × √(25/50) × (1/2) ≈ 0.0707
        const result = calculateFormationDefense(25, 1, 3);
        expect(result).toBeCloseTo(0.20 * Math.sqrt(25 / 50) * (1 / 2), 10);
      });

      it('should return max reduction (20%) at avgFormationTactics = 50, 2/2 allies in range', () => {
        // 0.20 × √(50/50) × (2/2) = 0.20
        const result = calculateFormationDefense(50, 2, 3);
        expect(result).toBe(0.20);
      });
    });

    describe('zero-attribute produces zero bonus (R6.7)', () => {
      it('should return 0 for teamSize=2', () => {
        expect(calculateFormationDefense(0, 1, 2)).toBe(0);
      });

      it('should return 0 for teamSize=3', () => {
        expect(calculateFormationDefense(0, 2, 3)).toBe(0);
      });

      it('should return 0 for negative attribute values', () => {
        expect(calculateFormationDefense(-5, 1, 2)).toBe(0);
      });
    });

    describe('max cap values', () => {
      it('should not exceed 20% even with attribute > 50 (clamped)', () => {
        const result = calculateFormationDefense(100, 1, 2);
        expect(result).toBeLessThanOrEqual(FORMATION_DEFENCE_MAX);
      });

      it('should reach exactly 20% at attribute=50 with all allies in range', () => {
        expect(calculateFormationDefense(50, 1, 2)).toBe(0.20);
        expect(calculateFormationDefense(50, 2, 3)).toBe(0.20);
      });
    });

    describe('edge cases — partial allies in range', () => {
      it('should return 0 when alliesInRange = 0', () => {
        expect(calculateFormationDefense(50, 0, 2)).toBe(0);
        expect(calculateFormationDefense(50, 0, 3)).toBe(0);
      });

      it('should return 0 when teamSize ≤ 1 (no allies possible)', () => {
        expect(calculateFormationDefense(50, 1, 1)).toBe(0);
      });

      it('should scale linearly with alliesInRange ratio (1/2 vs 2/2 in 3v3)', () => {
        const oneOfTwo = calculateFormationDefense(25, 1, 3);
        const twoOfTwo = calculateFormationDefense(25, 2, 3);
        expect(twoOfTwo).toBeCloseTo(oneOfTwo * 2, 10);
      });

      it('should produce higher reduction with more allies in range', () => {
        const oneAlly = calculateFormationDefense(30, 1, 3);
        const twoAllies = calculateFormationDefense(30, 2, 3);
        expect(twoAllies).toBeGreaterThan(oneAlly);
      });
    });

    describe('teamSize=2 vs teamSize=3 comparison', () => {
      it('should produce same max bonus for both team sizes when all allies in range', () => {
        // teamSize=2: 1/(2-1) = 1/1 = 1.0
        // teamSize=3: 2/(3-1) = 2/2 = 1.0
        const twoV2 = calculateFormationDefense(50, 1, 2);
        const threeV3 = calculateFormationDefense(50, 2, 3);
        expect(twoV2).toBe(threeV3);
      });

      it('should produce lower bonus in 3v3 with only 1 ally in range vs 2v2 with 1 ally', () => {
        // teamSize=2: 1/(2-1) = 1.0
        // teamSize=3: 1/(3-1) = 0.5
        const twoV2 = calculateFormationDefense(25, 1, 2);
        const threeV3OneAlly = calculateFormationDefense(25, 1, 3);
        expect(threeV3OneAlly).toBeCloseTo(twoV2 * 0.5, 10);
      });
    });
  });
});
