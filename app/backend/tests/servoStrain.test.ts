import {
  calculateBaseSpeed,
  calculateEffectiveSpeed,
  updateServoStrain,
  ServoStrainState,
} from '../src/services/arena/servoStrain';

// ─── Helper factory ─────────────────────────────────────────────────

function makeState(overrides: Partial<ServoStrainState> = {}): ServoStrainState {
  return {
    servoMotors: 25,
    servoStrain: 0,
    sustainedMovementTime: 0,
    isUsingClosingBonus: false,
    stance: 'balanced',
    hasMeleeWeapon: false,
    hasRangedWeapon: false,
    weaponOptimalRangeMidpoint: 4.5, // short range default
    distanceToTarget: 10,
    currentSpeedRatio: 0,
    ...overrides,
  };
}

// ─── calculateBaseSpeed ─────────────────────────────────────────────

describe('calculateBaseSpeed', () => {
  it('should return 7.2 for servoMotors=1', () => {
    expect(calculateBaseSpeed(1)).toBeCloseTo(7.2, 10);
  });

  it('should return 17.0 for servoMotors=50', () => {
    expect(calculateBaseSpeed(50)).toBeCloseTo(17.0, 10);
  });

  it('should return 12.0 for servoMotors=25', () => {
    expect(calculateBaseSpeed(25)).toBeCloseTo(12.0, 10);
  });

  it('should increase with servoMotors', () => {
    expect(calculateBaseSpeed(10)).toBeLessThan(calculateBaseSpeed(20));
    expect(calculateBaseSpeed(20)).toBeLessThan(calculateBaseSpeed(30));
  });
});

// ─── calculateEffectiveSpeed ────────────────────────────────────────

describe('calculateEffectiveSpeed', () => {
  describe('stance modifiers', () => {
    it('should reduce speed by 20% in defensive stance', () => {
      const state = makeState({ stance: 'defensive', servoMotors: 25 });
      const { effectiveSpeed } = calculateEffectiveSpeed(state, 10, false);
      const baseSpeed = calculateBaseSpeed(25);
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * 0.80, 10);
    });

    it('should increase speed by 10% in offensive stance', () => {
      const state = makeState({ stance: 'offensive', servoMotors: 25 });
      const { effectiveSpeed } = calculateEffectiveSpeed(state, 10, false);
      const baseSpeed = calculateBaseSpeed(25);
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * 1.10, 10);
    });

    it('should not modify speed in balanced stance', () => {
      const state = makeState({ stance: 'balanced', servoMotors: 25 });
      const { effectiveSpeed } = calculateEffectiveSpeed(state, 10, false);
      const baseSpeed = calculateBaseSpeed(25);
      expect(effectiveSpeed).toBeCloseTo(baseSpeed, 10);
    });
  });

  describe('servo strain reduction', () => {
    it('should reduce speed proportionally to strain', () => {
      const state = makeState({ servoStrain: 15 });
      const { effectiveSpeed } = calculateEffectiveSpeed(state, 10, false);
      const baseSpeed = calculateBaseSpeed(25);
      // strainReduction = 1.0 - (15 / 100) = 0.85
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * 0.85, 10);
    });

    it('should apply max strain reduction at 30%', () => {
      const state = makeState({ servoStrain: 30 });
      const { effectiveSpeed } = calculateEffectiveSpeed(state, 10, false);
      const baseSpeed = calculateBaseSpeed(25);
      // strainReduction = 1.0 - (30 / 100) = 0.70
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * 0.70, 10);
    });

    it('should not reduce speed when strain is 0', () => {
      const state = makeState({ servoStrain: 0 });
      const { effectiveSpeed } = calculateEffectiveSpeed(state, 10, false);
      const baseSpeed = calculateBaseSpeed(25);
      expect(effectiveSpeed).toBeCloseTo(baseSpeed, 10);
    });
  });

  describe('melee closing bonus', () => {
    it('should apply closing bonus when melee vs ranged at distance > 2', () => {
      const state = makeState({
        hasMeleeWeapon: true,
        distanceToTarget: 10,
        servoMotors: 10,
      });
      const opponentSpeed = 15;
      const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(state, opponentSpeed, true);
      expect(isClosingBonus).toBe(true);

      const baseSpeed = calculateBaseSpeed(10); // 9.0
      const stanceModifier = 1.0; // balanced
      const speedGap = Math.max(0, opponentSpeed - baseSpeed * stanceModifier); // 6.0
      const bonus = 1.30 + speedGap * 0.02; // 1.42
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * stanceModifier * bonus, 10);
    });

    it('should NOT apply closing bonus when distance <= 2', () => {
      const state = makeState({
        hasMeleeWeapon: true,
        distanceToTarget: 2,
      });
      const { isClosingBonus } = calculateEffectiveSpeed(state, 15, true);
      expect(isClosingBonus).toBe(false);
    });

    it('should NOT apply closing bonus when opponent has no ranged weapon', () => {
      const state = makeState({
        hasMeleeWeapon: true,
        distanceToTarget: 10,
      });
      const { isClosingBonus } = calculateEffectiveSpeed(state, 15, false);
      expect(isClosingBonus).toBe(false);
    });

    it('should NOT apply closing bonus when robot has no melee weapon', () => {
      const state = makeState({
        hasMeleeWeapon: false,
        distanceToTarget: 10,
      });
      const { isClosingBonus } = calculateEffectiveSpeed(state, 15, true);
      expect(isClosingBonus).toBe(false);
    });

    it('should use base +25% when opponent speed equals base speed (no gap)', () => {
      const state = makeState({
        hasMeleeWeapon: true,
        distanceToTarget: 10,
        servoMotors: 25,
      });
      const baseSpeed = calculateBaseSpeed(25); // 12.0
      const { effectiveSpeed } = calculateEffectiveSpeed(state, baseSpeed, true);
      // speedGap = max(0, 12 - 12*1.0) = 0, closingBonus = 1.30
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * 1.30, 10);
    });

    it('should NOT apply strain reduction when closing bonus is active', () => {
      const state = makeState({
        hasMeleeWeapon: true,
        distanceToTarget: 10,
        servoMotors: 10,
        servoStrain: 20, // Would reduce speed if applied
      });
      const opponentSpeed = 15;
      const { effectiveSpeed } = calculateEffectiveSpeed(state, opponentSpeed, true);

      const baseSpeed = calculateBaseSpeed(10);
      const stanceModifier = 1.0; // balanced
      const speedGap = Math.max(0, opponentSpeed - baseSpeed * stanceModifier);
      const bonus = 1.30 + speedGap * 0.02;
      // Strain should NOT be applied — closing bonus is exempt
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * stanceModifier * bonus, 10);
    });

    it('should produce speed >= base speed (closing bonus never reduces)', () => {
      const state = makeState({
        hasMeleeWeapon: true,
        distanceToTarget: 10,
        servoMotors: 50,
      });
      const baseSpeed = calculateBaseSpeed(50);
      // Opponent slower than us — speedGap = 0, bonus = 1.15
      const { effectiveSpeed } = calculateEffectiveSpeed(state, 5, true);
      expect(effectiveSpeed).toBeGreaterThanOrEqual(baseSpeed);
    });

    it('should relax defensive stance penalty to 5% while closing', () => {
      const state = makeState({
        hasMeleeWeapon: true,
        distanceToTarget: 10,
        servoMotors: 10,
        stance: 'defensive',
      });
      const baseSpeed = calculateBaseSpeed(10); // 9.0
      const closingStanceModifier = 0.95; // Relaxed from 0.80 during closing
      const opponentSpeed = 10;
      const speedGap = Math.max(0, opponentSpeed - baseSpeed * closingStanceModifier); // 1.45
      const bonus = 1.30 + speedGap * 0.02;
      const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(state, opponentSpeed, true);
      expect(isClosingBonus).toBe(true);
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * closingStanceModifier * bonus, 10);
      // Should be much faster than full defensive penalty would give
      const fullPenaltySpeed = baseSpeed * 0.80 * bonus;
      expect(effectiveSpeed).toBeGreaterThan(fullPenaltySpeed);
    });
  });

  describe('ranged kiting bonus', () => {
    it('should apply kiting bonus when ranged vs melee at distance < optimal range', () => {
      const state = makeState({
        hasRangedWeapon: true,
        weaponOptimalRangeMidpoint: 9.5, // mid range
        distanceToTarget: 3, // inside optimal range
        servoMotors: 10,
      });
      const opponentSpeed = 15;
      const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(state, opponentSpeed, false, true);
      expect(isClosingBonus).toBe(true); // reused flag means "exempt from strain"

      const baseSpeed = calculateBaseSpeed(10); // 9.0
      const speedGap = Math.max(0, opponentSpeed - baseSpeed); // 6.0
      const bonus = 1.10 + speedGap * 0.008; // 1.148
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * 1.0 * bonus, 10);
    });

    it('should NOT apply kiting bonus when distance >= optimal range', () => {
      const state = makeState({
        hasRangedWeapon: true,
        weaponOptimalRangeMidpoint: 4.5, // short range
        distanceToTarget: 5, // at or beyond optimal range
      });
      const { isClosingBonus } = calculateEffectiveSpeed(state, 15, false, true);
      expect(isClosingBonus).toBe(false);
    });

    it('should NOT apply kiting bonus when opponent has no melee weapon', () => {
      const state = makeState({
        hasRangedWeapon: true,
        weaponOptimalRangeMidpoint: 9.5,
        distanceToTarget: 3,
      });
      const { isClosingBonus } = calculateEffectiveSpeed(state, 15, false, false);
      expect(isClosingBonus).toBe(false);
    });

    it('should NOT apply kiting bonus when robot has no ranged weapon', () => {
      const state = makeState({
        hasRangedWeapon: false,
        weaponOptimalRangeMidpoint: 9.5,
        distanceToTarget: 3,
      });
      const { isClosingBonus } = calculateEffectiveSpeed(state, 15, false, true);
      expect(isClosingBonus).toBe(false);
    });

    it('should use base +10% when opponent speed equals base speed (no gap)', () => {
      const state = makeState({
        hasRangedWeapon: true,
        weaponOptimalRangeMidpoint: 9.5,
        distanceToTarget: 3,
        servoMotors: 25,
      });
      const baseSpeed = calculateBaseSpeed(25); // 12.0
      const { effectiveSpeed } = calculateEffectiveSpeed(state, baseSpeed, false, true);
      // speedGap = 0, kitingBonus = 1.10
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * 1.10, 10);
    });

    it('should NOT apply strain reduction when kiting bonus is active', () => {
      const state = makeState({
        hasRangedWeapon: true,
        weaponOptimalRangeMidpoint: 9.5,
        distanceToTarget: 3,
        servoMotors: 10,
        servoStrain: 20, // Would reduce speed if applied
      });
      const opponentSpeed = 15;
      const { effectiveSpeed } = calculateEffectiveSpeed(state, opponentSpeed, false, true);

      const baseSpeed = calculateBaseSpeed(10);
      const speedGap = Math.max(0, opponentSpeed - baseSpeed);
      const bonus = 1.10 + speedGap * 0.008;
      // Strain should NOT be applied — kiting bonus is exempt
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * 1.0 * bonus, 10);
    });

    it('should be weaker than closing bonus (10% vs 15% base)', () => {
      const meleeState = makeState({
        hasMeleeWeapon: true,
        distanceToTarget: 10,
        servoMotors: 25,
      });
      const rangedState = makeState({
        hasRangedWeapon: true,
        weaponOptimalRangeMidpoint: 16, // long range
        distanceToTarget: 3,
        servoMotors: 25,
      });
      const baseSpeed = calculateBaseSpeed(25);
      const { effectiveSpeed: meleeSpeed } = calculateEffectiveSpeed(meleeState, baseSpeed, true);
      const { effectiveSpeed: rangedSpeed } = calculateEffectiveSpeed(rangedState, baseSpeed, false, true);
      
      // Melee closing: 1.30, Ranged kiting: 1.10
      expect(meleeSpeed).toBeCloseTo(baseSpeed * 1.30, 10);
      expect(rangedSpeed).toBeCloseTo(baseSpeed * 1.10, 10);
      expect(meleeSpeed).toBeGreaterThan(rangedSpeed);
    });

    it('should prioritize melee closing bonus over kiting bonus if both could apply', () => {
      // Edge case: robot has both melee and ranged weapons (dual wield)
      const state = makeState({
        hasMeleeWeapon: true,
        hasRangedWeapon: true,
        weaponOptimalRangeMidpoint: 9.5,
        distanceToTarget: 5, // > 2 (melee closing) and < 9.5 (kiting)
        servoMotors: 25,
      });
      const baseSpeed = calculateBaseSpeed(25);
      // hasRangedOpponent=true triggers melee closing, hasMeleeOpponent=true would trigger kiting
      // Melee closing is checked first, so it should win
      const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(state, baseSpeed, true, true);
      expect(isClosingBonus).toBe(true);
      // Should use melee closing bonus (1.30), not kiting (1.10)
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * 1.30, 10);
    });
  });

  describe('combined stance + strain', () => {
    it('should apply both stance modifier and strain reduction', () => {
      const state = makeState({
        stance: 'defensive',
        servoStrain: 10,
        servoMotors: 20,
      });
      const { effectiveSpeed } = calculateEffectiveSpeed(state, 10, false);
      const baseSpeed = calculateBaseSpeed(20); // 11.0
      // defensive: 0.80, strain: 1.0 - 0.10 = 0.90
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * 0.80 * 0.90, 10);
    });
  });
});

// ─── updateServoStrain ──────────────────────────────────────────────

describe('updateServoStrain', () => {
  const TICK = 0.1;

  describe('strain accumulation', () => {
    it('should not accumulate strain before 3s of sustained movement', () => {
      const state = makeState({
        currentSpeedRatio: 0.9,
        sustainedMovementTime: 2.5,
      });
      updateServoStrain(state, TICK);
      expect(state.sustainedMovementTime).toBeCloseTo(2.6, 10);
      expect(state.servoStrain).toBe(0);
    });

    it('should accumulate strain after 3s of sustained movement at >80% speed', () => {
      const state = makeState({
        currentSpeedRatio: 0.9,
        sustainedMovementTime: 3.5,
      });
      updateServoStrain(state, TICK);
      // +2.0 * 0.1 = +0.2%
      expect(state.servoStrain).toBeCloseTo(0.2, 10);
    });

    it('should cap strain at 30%', () => {
      const state = makeState({
        currentSpeedRatio: 0.9,
        sustainedMovementTime: 10,
        servoStrain: 29.95,
      });
      updateServoStrain(state, TICK);
      expect(state.servoStrain).toBe(30);
    });

    it('should NOT accumulate strain when using closing bonus', () => {
      const state = makeState({
        currentSpeedRatio: 0.95,
        sustainedMovementTime: 5,
        isUsingClosingBonus: true,
      });
      updateServoStrain(state, TICK);
      expect(state.servoStrain).toBe(0);
      // sustainedMovementTime should decay instead
      expect(state.sustainedMovementTime).toBeCloseTo(4.9, 10);
    });

    it('should NOT accumulate strain at exactly 80% speed ratio', () => {
      const state = makeState({
        currentSpeedRatio: 0.80,
        sustainedMovementTime: 5,
      });
      updateServoStrain(state, TICK);
      // 0.80 is NOT > 0.80, so no accumulation
      expect(state.servoStrain).toBe(0);
      // Timer should decay
      expect(state.sustainedMovementTime).toBeCloseTo(4.9, 10);
    });
  });

  describe('strain decay', () => {
    it('should decay strain when speed ratio < 50%', () => {
      const state = makeState({
        currentSpeedRatio: 0.3,
        servoStrain: 10,
      });
      updateServoStrain(state, TICK);
      // -5.0 * 0.1 = -0.5%
      expect(state.servoStrain).toBeCloseTo(9.5, 10);
    });

    it('should not decay strain below 0', () => {
      const state = makeState({
        currentSpeedRatio: 0.0,
        servoStrain: 0.1,
      });
      updateServoStrain(state, TICK);
      expect(state.servoStrain).toBeGreaterThanOrEqual(0);
    });

    it('should decay strain when stationary (speed ratio = 0)', () => {
      const state = makeState({
        currentSpeedRatio: 0,
        servoStrain: 20,
      });
      updateServoStrain(state, TICK);
      expect(state.servoStrain).toBeCloseTo(19.5, 10);
    });

    it('should NOT decay strain at exactly 50% speed ratio', () => {
      const state = makeState({
        currentSpeedRatio: 0.50,
        servoStrain: 10,
      });
      updateServoStrain(state, TICK);
      // 0.50 is NOT < 0.50, so no decay
      expect(state.servoStrain).toBe(10);
    });
  });

  describe('sustained movement timer', () => {
    it('should increment timer when moving at >80% speed', () => {
      const state = makeState({
        currentSpeedRatio: 0.85,
        sustainedMovementTime: 1.0,
      });
      updateServoStrain(state, TICK);
      expect(state.sustainedMovementTime).toBeCloseTo(1.1, 10);
    });

    it('should decay timer when not at high speed', () => {
      const state = makeState({
        currentSpeedRatio: 0.5,
        sustainedMovementTime: 2.0,
      });
      updateServoStrain(state, TICK);
      expect(state.sustainedMovementTime).toBeCloseTo(1.9, 10);
    });

    it('should not decay timer below 0', () => {
      const state = makeState({
        currentSpeedRatio: 0.3,
        sustainedMovementTime: 0.05,
      });
      updateServoStrain(state, TICK);
      expect(state.sustainedMovementTime).toBe(0);
    });
  });

  describe('combined scenarios', () => {
    it('should accumulate strain and then decay over multiple ticks', () => {
      const state = makeState({
        currentSpeedRatio: 0.9,
        sustainedMovementTime: 4.0,
        servoStrain: 0,
      });

      // Accumulate for 5 ticks (0.5s)
      for (let i = 0; i < 5; i++) {
        updateServoStrain(state, TICK);
      }
      // +2.0 * 0.5 = +1.0%
      expect(state.servoStrain).toBeCloseTo(1.0, 5);

      // Now slow down and decay
      state.currentSpeedRatio = 0.2;
      for (let i = 0; i < 10; i++) {
        updateServoStrain(state, TICK);
      }
      // -5.0 * 1.0 = -5.0%, but started at 1.0 so clamped to 0
      expect(state.servoStrain).toBe(0);
    });
  });
});
