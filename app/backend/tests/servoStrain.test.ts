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
    role: 'ranged',
    engagementRangeMidpoint: 4.5, // short range default
    speedBurst: 'none',
    distanceToTarget: 10,
    currentSpeedRatio: 0,
    opponentEngagementMidpoint: null,
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
      const { effectiveSpeed } = calculateEffectiveSpeed(state, null);
      const baseSpeed = calculateBaseSpeed(25);
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * 0.80, 10);
    });

    it('should increase speed by 10% in offensive stance', () => {
      const state = makeState({ stance: 'offensive', servoMotors: 25 });
      const { effectiveSpeed } = calculateEffectiveSpeed(state, null);
      const baseSpeed = calculateBaseSpeed(25);
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * 1.10, 10);
    });

    it('should not modify speed in balanced stance', () => {
      const state = makeState({ stance: 'balanced', servoMotors: 25 });
      const { effectiveSpeed } = calculateEffectiveSpeed(state, null);
      const baseSpeed = calculateBaseSpeed(25);
      expect(effectiveSpeed).toBeCloseTo(baseSpeed, 10);
    });
  });

  describe('servo strain reduction', () => {
    it('should reduce speed proportionally to strain', () => {
      const state = makeState({ servoStrain: 15 });
      const { effectiveSpeed } = calculateEffectiveSpeed(state, null);
      const baseSpeed = calculateBaseSpeed(25);
      // strainReduction = 1.0 - (15 / 100) = 0.85
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * 0.85, 10);
    });

    it('should apply max strain reduction at 30%', () => {
      const state = makeState({ servoStrain: 30 });
      const { effectiveSpeed } = calculateEffectiveSpeed(state, null);
      const baseSpeed = calculateBaseSpeed(25);
      // strainReduction = 1.0 - (30 / 100) = 0.70
      expect(effectiveSpeed).toBeCloseTo(baseSpeed * 0.70, 10);
    });

    it('should not reduce speed when strain is 0', () => {
      const state = makeState({ servoStrain: 0 });
      const { effectiveSpeed } = calculateEffectiveSpeed(state, null);
      const baseSpeed = calculateBaseSpeed(25);
      expect(effectiveSpeed).toBeCloseTo(baseSpeed, 10);
    });
  });

  describe('melee pursuit (#520)', () => {
    it('should pursue at base × 1.15 when melee role vs ranged role at distance > 2', () => {
      const state = makeState({ role: 'melee', distanceToTarget: 10, servoMotors: 10 });
      const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(state, 'ranged');
      expect(isClosingBonus).toBe(true);
      expect(effectiveSpeed).toBeCloseTo(calculateBaseSpeed(10) * 1.15, 10);
    });

    it('should NOT pursue when distance <= 2', () => {
      const state = makeState({ role: 'melee', distanceToTarget: 2 });
      const { isClosingBonus } = calculateEffectiveSpeed(state, 'ranged');
      expect(isClosingBonus).toBe(false);
    });

    it('should NOT pursue when the opponent has the melee role (beyond the final approach)', () => {
      const state = makeState({ role: 'melee', distanceToTarget: 10 });
      const { isClosingBonus } = calculateEffectiveSpeed(state, 'melee');
      expect(isClosingBonus).toBe(false);
    });

    it('should NOT pursue when the robot has the ranged role', () => {
      const state = makeState({ role: 'ranged', distanceToTarget: 10 });
      const { isClosingBonus } = calculateEffectiveSpeed(state, 'ranged');
      expect(isClosingBonus).toBe(false);
    });

    it('should NOT apply strain reduction while pursuing', () => {
      const state = makeState({ role: 'melee', distanceToTarget: 10, servoMotors: 10, servoStrain: 20 });
      const { effectiveSpeed } = calculateEffectiveSpeed(state, 'ranged');
      expect(effectiveSpeed).toBeCloseTo(calculateBaseSpeed(10) * 1.15, 10);
    });

    it('should keep the full 0.80 defensive factor while pursuing', () => {
      const state = makeState({ role: 'melee', distanceToTarget: 10, servoMotors: 10, stance: 'defensive' });
      const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(state, 'ranged');
      expect(isClosingBonus).toBe(true);
      expect(effectiveSpeed).toBeCloseTo(calculateBaseSpeed(10) * 0.80 * 1.15, 10);
    });
  });

  describe('mutual-melee final approach', () => {
    it('should apply 1.15 between 2 and 4 units in a melee mirror', () => {
      const state = makeState({ role: 'melee', distanceToTarget: 3, servoMotors: 25 });
      const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(state, 'melee');
      expect(isClosingBonus).toBe(true);
      expect(effectiveSpeed).toBeCloseTo(calculateBaseSpeed(25) * 1.15, 10);
    });
  });

  describe('ranged kiting (#520)', () => {
    it('should kite at base × 1.10 when ranged role vs melee role inside the engagement midpoint', () => {
      const state = makeState({ role: 'ranged', engagementRangeMidpoint: 9.5, distanceToTarget: 3, servoMotors: 10 });
      const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(state, 'melee');
      expect(isClosingBonus).toBe(true); // flag means "exempt from strain"
      expect(effectiveSpeed).toBeCloseTo(calculateBaseSpeed(10) * 1.10, 10);
    });

    it('should NOT kite when distance >= the engagement midpoint', () => {
      const state = makeState({ role: 'ranged', engagementRangeMidpoint: 4.5, distanceToTarget: 5 });
      const { isClosingBonus } = calculateEffectiveSpeed(state, 'melee');
      expect(isClosingBonus).toBe(false);
    });

    it('should NOT kite when the opponent has the ranged role', () => {
      const state = makeState({ role: 'ranged', engagementRangeMidpoint: 9.5, distanceToTarget: 3 });
      const { isClosingBonus } = calculateEffectiveSpeed(state, 'ranged');
      expect(isClosingBonus).toBe(false);
    });

    it('should NOT apply strain reduction while kiting', () => {
      const state = makeState({
        role: 'ranged', engagementRangeMidpoint: 9.5, distanceToTarget: 3, servoMotors: 10, servoStrain: 20,
      });
      const { effectiveSpeed } = calculateEffectiveSpeed(state, 'melee');
      expect(effectiveSpeed).toBeCloseTo(calculateBaseSpeed(10) * 1.10, 10);
    });

    it('pursuit is 1.15× and kiting 1.10× at equal Servo Motors', () => {
      const pursuer = makeState({ role: 'melee', distanceToTarget: 10, servoMotors: 25 });
      const kiter = makeState({ role: 'ranged', engagementRangeMidpoint: 16, distanceToTarget: 3, servoMotors: 25 });
      const baseSpeed = calculateBaseSpeed(25);
      expect(calculateEffectiveSpeed(pursuer, 'ranged').effectiveSpeed).toBeCloseTo(baseSpeed * 1.15, 10);
      expect(calculateEffectiveSpeed(kiter, 'melee').effectiveSpeed).toBeCloseTo(baseSpeed * 1.10, 10);
    });
  });

  describe('ranged vs ranged (Season 2 round 3)', () => {
    // Long kiter (midpoint 16) vs a short opponent (midpoint 4.5), and the reverse
    const longKiter = (overrides: Partial<ServoStrainState> = {}): ServoStrainState =>
      makeState({ role: 'ranged', engagementRangeMidpoint: 16, opponentEngagementMidpoint: 4.5, ...overrides });
    const shortPursuer = (overrides: Partial<ServoStrainState> = {}): ServoStrainState =>
      makeState({ role: 'ranged', engagementRangeMidpoint: 4.5, opponentEngagementMidpoint: 16, ...overrides });

    it('a long robot kites a short robot at base × 1.10, strain-free, inside its own midpoint', () => {
      const result = calculateEffectiveSpeed(longKiter({ distanceToTarget: 10, servoMotors: 10, servoStrain: 20 }), 'ranged');
      expect(result.isClosingBonus).toBe(true);
      expect(result.mode).toBe('ranged_kiting');
      expect(result.effectiveSpeed).toBeCloseTo(calculateBaseSpeed(10) * 1.10, 10);
    });

    it('stops kiting at and beyond its own midpoint (normal speed with strain)', () => {
      for (const distanceToTarget of [16, 20]) {
        const result = calculateEffectiveSpeed(longKiter({ distanceToTarget, servoStrain: 20 }), 'ranged');
        expect(result.isClosingBonus).toBe(false);
        expect(result.mode).toBe('normal');
        expect(result.effectiveSpeed).toBeCloseTo(calculateBaseSpeed(25) * 0.80, 10);
      }
    });

    it('a short robot follows a long robot at base × 1.05, strain-free, beyond its own midpoint', () => {
      const result = calculateEffectiveSpeed(shortPursuer({ distanceToTarget: 10, servoMotors: 10, servoStrain: 20 }), 'ranged');
      expect(result.isClosingBonus).toBe(true);
      expect(result.mode).toBe('ranged_pursuit');
      expect(result.effectiveSpeed).toBeCloseTo(calculateBaseSpeed(10) * 1.05, 10);
    });

    it('stops the ranged pursuit at and inside its own midpoint', () => {
      for (const distanceToTarget of [4.5, 3]) {
        const result = calculateEffectiveSpeed(shortPursuer({ distanceToTarget }), 'ranged');
        expect(result.isClosingBonus).toBe(false);
        expect(result.mode).toBe('normal');
      }
    });

    it('equal midpoints stay normal movement', () => {
      for (const distanceToTarget of [3, 9.5, 20]) {
        const result = calculateEffectiveSpeed(
          makeState({ role: 'ranged', engagementRangeMidpoint: 9.5, opponentEngagementMidpoint: 9.5, distanceToTarget }), 'ranged',
        );
        expect(result.isClosingBonus).toBe(false);
        expect(result.mode).toBe('normal');
      }
    });

    it('no opponent midpoint stays normal movement', () => {
      const result = calculateEffectiveSpeed(longKiter({ opponentEngagementMidpoint: null, distanceToTarget: 10 }), 'ranged');
      expect(result.isClosingBonus).toBe(false);
      expect(result.mode).toBe('normal');
    });

    it('the defensive 0.80 factor applies to both new modes', () => {
      const kite = calculateEffectiveSpeed(longKiter({ distanceToTarget: 10, stance: 'defensive' }), 'ranged');
      const follow = calculateEffectiveSpeed(shortPursuer({ distanceToTarget: 10, stance: 'defensive' }), 'ranged');
      expect(kite.effectiveSpeed).toBeCloseTo(calculateBaseSpeed(25) * 0.80 * 1.10, 10);
      expect(follow.effectiveSpeed).toBeCloseTo(calculateBaseSpeed(25) * 0.80 * 1.05, 10);
    });

    it('a speed burst still wins over the new modes', () => {
      const result = calculateEffectiveSpeed(longKiter({ distanceToTarget: 10, speedBurst: 'ranged_disengage' }), 'ranged');
      expect(result.mode).toBe('ranged_disengage');
      expect(result.effectiveSpeed).toBeCloseTo(calculateBaseSpeed(25) * 1.30, 10);
    });

    it('melee-vs-ranged rules are unchanged by the opponent midpoint (1.15 / 1.10 / 1.30)', () => {
      const pursuit = calculateEffectiveSpeed(
        makeState({ role: 'melee', engagementRangeMidpoint: 1, opponentEngagementMidpoint: 16, distanceToTarget: 10 }), 'ranged',
      );
      expect(pursuit.mode).toBe('pursuit');
      expect(pursuit.effectiveSpeed).toBeCloseTo(calculateBaseSpeed(25) * 1.15, 10);
      const kite = calculateEffectiveSpeed(
        makeState({ role: 'ranged', engagementRangeMidpoint: 16, opponentEngagementMidpoint: 1, distanceToTarget: 10 }), 'melee',
      );
      expect(kite.mode).toBe('kiting');
      expect(kite.effectiveSpeed).toBeCloseTo(calculateBaseSpeed(25) * 1.10, 10);
      const commit = calculateEffectiveSpeed(
        makeState({ role: 'melee', engagementRangeMidpoint: 1, opponentEngagementMidpoint: 16, distanceToTarget: 10, speedBurst: 'melee_commit' }),
        'ranged',
      );
      expect(commit.mode).toBe('melee_commit');
      expect(commit.effectiveSpeed).toBeCloseTo(calculateBaseSpeed(25) * 1.30, 10);
    });
  });

  describe('speed bursts (#520)', () => {
    it('should move a committing melee robot at base × 1.30, strain-free', () => {
      const state = makeState({ role: 'melee', speedBurst: 'melee_commit', distanceToTarget: 10, servoStrain: 20 });
      const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(state, 'ranged');
      expect(isClosingBonus).toBe(true);
      expect(effectiveSpeed).toBeCloseTo(calculateBaseSpeed(25) * 1.30, 10);
    });

    it('should move a disengaging ranged robot at base × stance × 1.30, strain-free', () => {
      const state = makeState({
        role: 'ranged', speedBurst: 'ranged_disengage', distanceToTarget: 1, stance: 'defensive', servoStrain: 20,
      });
      const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(state, 'melee');
      expect(isClosingBonus).toBe(true);
      expect(effectiveSpeed).toBeCloseTo(calculateBaseSpeed(25) * 0.80 * 1.30, 10);
    });
  });

  describe('combined stance + strain', () => {
    it('should apply both stance modifier and strain reduction', () => {
      const state = makeState({
        stance: 'defensive',
        servoStrain: 10,
        servoMotors: 20,
      });
      const { effectiveSpeed } = calculateEffectiveSpeed(state, null);
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
