import {
  calculateTurnSpeed,
  updateFacing,
  checkBackstab,
  checkFlanking,
  FacingState,
  OpponentState,
  PositionedRobot,
} from '../src/services/arena/positionTracker';

// ─── Helper factories ───────────────────────────────────────────────

function makeFacingState(overrides: Partial<FacingState> = {}): FacingState {
  return {
    position: { x: 0, y: 0 },
    facingDirection: 0,
    turnSpeed: 186, // gyro=1
    ...overrides,
  };
}

function makeRobot(overrides: Partial<PositionedRobot> = {}): PositionedRobot {
  return {
    position: { x: 0, y: 0 },
    facingDirection: 0,
    gyroStabilizers: 1,
    threatAnalysis: 1,
    ...overrides,
  };
}

// ─── calculateTurnSpeed ─────────────────────────────────────────────

describe('calculateTurnSpeed', () => {
  it('should return 186 for gyroStabilizers=1', () => {
    expect(calculateTurnSpeed(1)).toBeCloseTo(186, 10);
  });

  it('should return 480 for gyroStabilizers=50', () => {
    expect(calculateTurnSpeed(50)).toBeCloseTo(480, 10);
  });

  it('should return 330 for gyroStabilizers=25', () => {
    expect(calculateTurnSpeed(25)).toBeCloseTo(330, 10);
  });

  it('should increase monotonically with gyroStabilizers', () => {
    for (let g = 1; g < 50; g++) {
      expect(calculateTurnSpeed(g)).toBeLessThan(calculateTurnSpeed(g + 1));
    }
  });
});

// ─── updateFacing ───────────────────────────────────────────────────

describe('updateFacing', () => {
  const TICK = 0.1;

  it('should rotate toward target when angle diff is within max turn', () => {
    const state = makeFacingState({
      facingDirection: 0,
      turnSpeed: 480, // gyro=50 → can turn 48°/tick
    });
    // Target is at 30° — well within 48° max turn
    const target = { x: Math.cos((30 * Math.PI) / 180) * 10, y: Math.sin((30 * Math.PI) / 180) * 10 };
    updateFacing(state, target, TICK);
    expect(state.facingDirection).toBeCloseTo(30, 0);
  });

  it('should clamp rotation to max turn speed when angle diff exceeds it', () => {
    const state = makeFacingState({
      facingDirection: 0,
      turnSpeed: 186, // gyro=1 → 18.6°/tick
    });
    // Target is at 90° — exceeds 18.6° max turn
    const target = { x: 0, y: 10 };
    updateFacing(state, target, TICK);
    expect(state.facingDirection).toBeCloseTo(18.6, 1);
  });

  it('should rotate counter-clockwise for negative angle diff', () => {
    const state = makeFacingState({
      facingDirection: 0,
      turnSpeed: 186,
    });
    // Target is at -90° (below)
    const target = { x: 0, y: -10 };
    updateFacing(state, target, TICK);
    expect(state.facingDirection).toBeCloseTo(-18.6, 1);
  });

  it('should snap to desired angle when exactly at max turn', () => {
    const state = makeFacingState({
      facingDirection: 0,
      turnSpeed: 300, // 30°/tick
    });
    const target = { x: Math.cos((30 * Math.PI) / 180) * 10, y: Math.sin((30 * Math.PI) / 180) * 10 };
    updateFacing(state, target, TICK);
    expect(state.facingDirection).toBeCloseTo(30, 0);
  });

  it('should normalize facing direction to [-180, 180]', () => {
    const state = makeFacingState({
      facingDirection: 170,
      turnSpeed: 480,
    });
    // Target behind at ~-170° → should wrap around
    const target = { x: -10, y: -1 };
    updateFacing(state, target, TICK);
    expect(state.facingDirection).toBeGreaterThanOrEqual(-180);
    expect(state.facingDirection).toBeLessThanOrEqual(180);
  });

  it('should not change facing when already pointing at target', () => {
    const state = makeFacingState({
      facingDirection: 0,
      turnSpeed: 186,
    });
    const target = { x: 10, y: 0 }; // Directly ahead at 0°
    updateFacing(state, target, TICK);
    expect(state.facingDirection).toBeCloseTo(0, 5);
  });

  describe('predictive turn bias', () => {
    it('should increase max turn when threatAnalysis > 20 and opponent moving to rear', () => {
      const state = makeFacingState({
        facingDirection: 0,
        turnSpeed: 186,
      });
      const opponent: OpponentState = {
        position: { x: -5, y: 5 },
        velocity: { x: -2, y: 0 }, // Moving toward rear (180° from facing)
      };
      // Target at 90° — exceeds normal 18.6° max turn
      const target = { x: 0, y: 10 };

      // Without bias
      const stateNoBias = makeFacingState({ facingDirection: 0, turnSpeed: 186 });
      updateFacing(stateNoBias, target, TICK);
      const turnWithoutBias = Math.abs(stateNoBias.facingDirection);

      // With bias
      updateFacing(state, target, TICK, opponent, 30);
      const turnWithBias = Math.abs(state.facingDirection);

      expect(turnWithBias).toBeGreaterThan(turnWithoutBias);
    });

    it('should not apply bias when threatAnalysis <= 20', () => {
      const state = makeFacingState({ facingDirection: 0, turnSpeed: 186 });
      const opponent: OpponentState = {
        position: { x: -5, y: 5 },
        velocity: { x: -2, y: 0 },
      };
      const target = { x: 0, y: 10 };

      const stateNoBias = makeFacingState({ facingDirection: 0, turnSpeed: 186 });
      updateFacing(stateNoBias, target, TICK);

      updateFacing(state, target, TICK, opponent, 20);
      expect(state.facingDirection).toBeCloseTo(stateNoBias.facingDirection, 5);
    });

    it('should not apply bias when opponent is stationary', () => {
      const state = makeFacingState({ facingDirection: 0, turnSpeed: 186 });
      const opponent: OpponentState = {
        position: { x: -5, y: 5 },
        velocity: { x: 0, y: 0 },
      };
      const target = { x: 0, y: 10 };

      const stateNoBias = makeFacingState({ facingDirection: 0, turnSpeed: 186 });
      updateFacing(stateNoBias, target, TICK);

      updateFacing(state, target, TICK, opponent, 30);
      expect(state.facingDirection).toBeCloseTo(stateNoBias.facingDirection, 5);
    });
  });
});

// ─── checkBackstab ──────────────────────────────────────────────────

describe('checkBackstab', () => {
  it('should detect backstab when attacker is >120° from defender facing', () => {
    const defender = makeRobot({ position: { x: 0, y: 0 }, facingDirection: 0 });
    // Attacker directly behind at 180°
    const attacker = makeRobot({ position: { x: -10, y: 0 } });
    const result = checkBackstab(attacker, defender);
    expect(result.isBackstab).toBe(true);
    expect(result.angle).toBeCloseTo(180, 0);
  });

  it('should not detect backstab when attacker is within 120° of facing', () => {
    const defender = makeRobot({ position: { x: 0, y: 0 }, facingDirection: 0 });
    // Attacker at 90° (side) — not > 120°
    const attacker = makeRobot({ position: { x: 0, y: 10 } });
    const result = checkBackstab(attacker, defender);
    expect(result.isBackstab).toBe(false);
    expect(result.bonus).toBe(0);
  });

  it('should not detect backstab at 119° (just below threshold)', () => {
    const defender = makeRobot({ position: { x: 0, y: 0 }, facingDirection: 0 });
    // Place attacker at 119° from facing — just below the >120° threshold
    const angle = 119 * (Math.PI / 180);
    const attacker = makeRobot({
      position: { x: Math.cos(angle) * 10, y: Math.sin(angle) * 10 },
    });
    const result = checkBackstab(attacker, defender);
    expect(result.isBackstab).toBe(false);
    expect(result.angle).toBeCloseTo(119, 0);
  });

  it('should apply +10% base bonus for backstab', () => {
    const defender = makeRobot({
      position: { x: 0, y: 0 },
      facingDirection: 0,
      gyroStabilizers: 0,
      threatAnalysis: 0,
    });
    const attacker = makeRobot({ position: { x: -10, y: 0 } });
    const result = checkBackstab(attacker, defender);
    expect(result.bonus).toBeCloseTo(0.10, 10);
  });

  it('should reduce backstab bonus by gyroStabilizers × 0.25%', () => {
    const defender = makeRobot({
      position: { x: 0, y: 0 },
      facingDirection: 0,
      gyroStabilizers: 20, // 20 × 0.0025 = 0.05 reduction
      threatAnalysis: 0,
    });
    const attacker = makeRobot({ position: { x: -10, y: 0 } });
    const result = checkBackstab(attacker, defender);
    expect(result.bonus).toBeCloseTo(0.10 - 0.05, 10);
  });

  it('should reduce backstab bonus by threatAnalysis when > 25', () => {
    const defender = makeRobot({
      position: { x: 0, y: 0 },
      facingDirection: 0,
      gyroStabilizers: 0,
      threatAnalysis: 35, // (35 - 25) × 0.01 = 0.10 reduction
    });
    const attacker = makeRobot({ position: { x: -10, y: 0 } });
    const result = checkBackstab(attacker, defender);
    expect(result.bonus).toBeCloseTo(0.0, 10);
  });

  it('should not apply threatAnalysis reduction when <= 25', () => {
    const defender = makeRobot({
      position: { x: 0, y: 0 },
      facingDirection: 0,
      gyroStabilizers: 0,
      threatAnalysis: 25,
    });
    const attacker = makeRobot({ position: { x: -10, y: 0 } });
    const result = checkBackstab(attacker, defender);
    expect(result.bonus).toBeCloseTo(0.10, 10);
  });

  it('should clamp bonus to 0 when reductions exceed base', () => {
    const defender = makeRobot({
      position: { x: 0, y: 0 },
      facingDirection: 0,
      gyroStabilizers: 50, // 50 × 0.0025 = 0.125 > 0.10
      threatAnalysis: 50,
    });
    const attacker = makeRobot({ position: { x: -10, y: 0 } });
    const result = checkBackstab(attacker, defender);
    expect(result.isBackstab).toBe(true);
    expect(result.bonus).toBe(0);
  });

  it('should return the angle regardless of backstab status', () => {
    const defender = makeRobot({ position: { x: 0, y: 0 }, facingDirection: 0 });
    const attacker = makeRobot({ position: { x: 10, y: 0 } }); // Directly in front
    const result = checkBackstab(attacker, defender);
    expect(result.isBackstab).toBe(false);
    expect(result.angle).toBeCloseTo(0, 0);
  });
});

// ─── checkFlanking ──────────────────────────────────────────────────

describe('checkFlanking', () => {
  it('should not detect flanking with fewer than 2 attackers', () => {
    const defender = makeRobot({ position: { x: 0, y: 0 } });
    const attacker = makeRobot({ position: { x: 10, y: 0 } });
    const result = checkFlanking([attacker], defender);
    expect(result.isFlanking).toBe(false);
  });

  it('should not detect flanking with 0 attackers', () => {
    const defender = makeRobot({ position: { x: 0, y: 0 } });
    const result = checkFlanking([], defender);
    expect(result.isFlanking).toBe(false);
  });

  it('should detect flanking when 2 attackers are >90° apart', () => {
    const defender = makeRobot({
      position: { x: 0, y: 0 },
      gyroStabilizers: 0,
      threatAnalysis: 0,
    });
    // Attacker 1 at 0° (right), Attacker 2 at 180° (left) — 180° apart
    const a1 = makeRobot({ position: { x: 10, y: 0 } });
    const a2 = makeRobot({ position: { x: -10, y: 0 } });
    const result = checkFlanking([a1, a2], defender);
    expect(result.isFlanking).toBe(true);
    expect(result.bonus).toBeCloseTo(0.20, 10);
  });

  it('should not detect flanking when attackers are <= 90° apart', () => {
    const defender = makeRobot({ position: { x: 0, y: 0 } });
    // Both attackers roughly in front — 45° apart
    const a1 = makeRobot({ position: { x: 10, y: 0 } });
    const a2 = makeRobot({ position: { x: 10, y: 10 } }); // ~45° from a1
    const result = checkFlanking([a1, a2], defender);
    expect(result.isFlanking).toBe(false);
  });

  it('should not detect flanking at exactly 90°', () => {
    const defender = makeRobot({ position: { x: 0, y: 0 } });
    // Attacker 1 at 0°, Attacker 2 at 90° — exactly 90°, not > 90°
    const a1 = makeRobot({ position: { x: 10, y: 0 } });
    const a2 = makeRobot({ position: { x: 0, y: 10 } });
    const result = checkFlanking([a1, a2], defender);
    expect(result.isFlanking).toBe(false);
  });

  it('should reduce flanking bonus by gyroStabilizers × 0.3%', () => {
    const defender = makeRobot({
      position: { x: 0, y: 0 },
      gyroStabilizers: 20, // 20 × 0.003 = 0.06 reduction
      threatAnalysis: 0,
    });
    const a1 = makeRobot({ position: { x: 10, y: 0 } });
    const a2 = makeRobot({ position: { x: -10, y: 0 } });
    const result = checkFlanking([a1, a2], defender);
    expect(result.bonus).toBeCloseTo(0.20 - 0.06, 10);
  });

  it('should reduce flanking bonus by threatAnalysis when > 25', () => {
    const defender = makeRobot({
      position: { x: 0, y: 0 },
      gyroStabilizers: 0,
      threatAnalysis: 35, // (35 - 25) × 0.01 = 0.10 reduction
    });
    const a1 = makeRobot({ position: { x: 10, y: 0 } });
    const a2 = makeRobot({ position: { x: -10, y: 0 } });
    const result = checkFlanking([a1, a2], defender);
    expect(result.bonus).toBeCloseTo(0.20 - 0.10, 10);
  });

  it('should clamp flanking bonus to 0 when reductions exceed base', () => {
    const defender = makeRobot({
      position: { x: 0, y: 0 },
      gyroStabilizers: 50, // 50 × 0.003 = 0.15
      threatAnalysis: 50,  // (50 - 25) × 0.01 = 0.25
    });
    const a1 = makeRobot({ position: { x: 10, y: 0 } });
    const a2 = makeRobot({ position: { x: -10, y: 0 } });
    const result = checkFlanking([a1, a2], defender);
    expect(result.isFlanking).toBe(true);
    expect(result.bonus).toBe(0);
  });

  it('should return flanking attacker indices', () => {
    const defender = makeRobot({ position: { x: 0, y: 0 } });
    const a1 = makeRobot({ position: { x: 10, y: 0 } });
    const a2 = makeRobot({ position: { x: -10, y: 0 } });
    const result = checkFlanking([a1, a2], defender);
    expect(result.flankingAttackers).toEqual([0, 1]);
  });

  it('should detect flanking among 3+ attackers when any pair qualifies', () => {
    const defender = makeRobot({
      position: { x: 0, y: 0 },
      gyroStabilizers: 0,
      threatAnalysis: 0,
    });
    // a1 and a2 are close together, a3 is on the opposite side
    const a1 = makeRobot({ position: { x: 10, y: 1 } });
    const a2 = makeRobot({ position: { x: 10, y: -1 } });
    const a3 = makeRobot({ position: { x: -10, y: 0 } });
    const result = checkFlanking([a1, a2, a3], defender);
    expect(result.isFlanking).toBe(true);
    // First qualifying pair found: a1 (index 0) and a3 (index 2)
    expect(result.flankingAttackers).toEqual([0, 2]);
  });
});
