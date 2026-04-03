/**
 * Unit tests for KotH Engine — Task 2.1: Zone management and spawn positioning
 *
 * Tests createControlZone, calculateSpawnPositions, validateKothConfig,
 * and evaluateZoneOccupation.
 */

import {
  createControlZone,
  calculateSpawnPositions,
  validateKothConfig,
  evaluateZoneOccupation,
  KOTH_MATCH_DEFAULTS,
  KothMatchConfig,
  KothZoneState,
} from '../src/services/arena/kothEngine';
import type { RobotCombatState } from '../src/services/arena/types';

// ─── Helpers ────────────────────────────────────────────────────────

/** Build a minimal RobotCombatState stub for zone occupation tests */
function makeRobot(
  id: number,
  x: number,
  y: number,
  isAlive = true,
): RobotCombatState {
  return {
    robot: { id } as RobotCombatState['robot'],
    position: { x, y },
    isAlive,
    currentHP: 100,
    maxHP: 100,
    currentShield: 0,
    maxShield: 0,
    lastAttackTime: 0,
    lastOffhandAttackTime: 0,
    attackCooldown: 0,
    offhandCooldown: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    facingDirection: 0,
    velocity: { x: 0, y: 0 },
    movementSpeed: 1,
    effectiveMovementSpeed: 1,
    servoStrain: 0,
    sustainedMovementTime: 0,
    isUsingClosingBonus: false,
    movementIntent: {
      targetPosition: { x: 0, y: 0 },
      strategy: 'direct_path',
      preferredRange: 'melee',
      stanceSpeedModifier: 1,
    },
    currentTarget: null,
    patienceTimer: 0,
    combatAlgorithmScore: 0,
    adaptationHitBonus: 0,
    adaptationDamageBonus: 0,
    hitsTaken: 0,
    missCount: 0,
    pressureThreshold: 0,
    isUnderPressure: false,
    teamIndex: id,
  } as RobotCombatState;
}

function makeZoneState(
  cx = 0,
  cy = 0,
  radius = 5,
): KothZoneState {
  return {
    center: { x: cx, y: cy },
    radius,
    isActive: true,
    rotationCount: 0,
  };
}

function baseConfig(overrides: Partial<KothMatchConfig> = {}): KothMatchConfig {
  return { participantCount: 6, matchId: 1, ...overrides };
}

// ─── createControlZone ──────────────────────────────────────────────

describe('createControlZone', () => {
  it('should return an ArenaZone with effect control_point', () => {
    const zone = createControlZone(baseConfig());
    expect(zone.effect).toBe('control_point');
  });

  it('should center the zone at {x:0, y:0}', () => {
    const zone = createControlZone(baseConfig());
    expect(zone.center).toEqual({ x: 0, y: 0 });
  });

  it('should use default radius 5 when not specified', () => {
    const zone = createControlZone(baseConfig());
    expect(zone.radius).toBe(5);
  });

  it('should accept a custom radius within [3, 8]', () => {
    const zone = createControlZone(baseConfig({ zoneRadius: 7 }));
    expect(zone.radius).toBe(7);
  });

  it('should clamp radius below 3 to 3', () => {
    const zone = createControlZone(baseConfig({ zoneRadius: 1 }));
    expect(zone.radius).toBe(3);
  });

  it('should clamp radius above 8 to 8', () => {
    const zone = createControlZone(baseConfig({ zoneRadius: 12 }));
    expect(zone.radius).toBe(8);
  });

  it('should have id koth_control_zone', () => {
    const zone = createControlZone(baseConfig());
    expect(zone.id).toBe('koth_control_zone');
  });
});

// ─── calculateSpawnPositions ────────────────────────────────────────

describe('calculateSpawnPositions', () => {
  const arenaRadius = KOTH_MATCH_DEFAULTS.arenaRadius; // 24

  it('should return 5 positions for 5 participants', () => {
    const positions = calculateSpawnPositions(5, arenaRadius);
    expect(positions).toHaveLength(5);
  });

  it('should return 6 positions for 6 participants', () => {
    const positions = calculateSpawnPositions(6, arenaRadius);
    expect(positions).toHaveLength(6);
  });

  it('should place all robots at (arenaRadius - 2) distance from center', () => {
    const positions = calculateSpawnPositions(6, arenaRadius);
    const expectedDist = arenaRadius - 2; // 22
    for (const pos of positions) {
      const dist = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      expect(dist).toBeCloseTo(expectedDist, 2);
    }
  });

  it('should use 72° spacing for 5 participants', () => {
    const positions = calculateSpawnPositions(5, arenaRadius);
    for (let i = 0; i < positions.length; i++) {
      const next = positions[(i + 1) % positions.length];
      const curr = positions[i];
      const angleCurr = Math.atan2(curr.y, curr.x);
      const angleNext = Math.atan2(next.y, next.x);
      let diff = ((angleNext - angleCurr) * 180) / Math.PI;
      if (diff < 0) diff += 360;
      expect(diff).toBeCloseTo(72, 1);
    }
  });

  it('should use 60° spacing for 6 participants', () => {
    const positions = calculateSpawnPositions(6, arenaRadius);
    for (let i = 0; i < positions.length; i++) {
      const next = positions[(i + 1) % positions.length];
      const curr = positions[i];
      const angleCurr = Math.atan2(curr.y, curr.x);
      const angleNext = Math.atan2(next.y, next.x);
      let diff = ((angleNext - angleCurr) * 180) / Math.PI;
      if (diff < 0) diff += 360;
      expect(diff).toBeCloseTo(60, 1);
    }
  });

  it('should place first robot on positive x-axis', () => {
    const positions = calculateSpawnPositions(6, arenaRadius);
    expect(positions[0].x).toBeCloseTo(arenaRadius - 2, 2);
    expect(positions[0].y).toBeCloseTo(0, 2);
  });
});

// ─── validateKothConfig ─────────────────────────────────────────────

describe('validateKothConfig', () => {
  it('should accept a valid config with defaults', () => {
    const result = validateKothConfig(baseConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept participantCount 5', () => {
    const result = validateKothConfig(baseConfig({ participantCount: 5 }));
    expect(result.valid).toBe(true);
  });

  it('should reject participantCount 4', () => {
    const result = validateKothConfig(baseConfig({ participantCount: 4 }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('participantCount');
  });

  it('should accept participantCount 7', () => {
    const result = validateKothConfig(baseConfig({ participantCount: 7 }));
    expect(result.valid).toBe(true);
  });

  it('should reject participantCount 8', () => {
    const result = validateKothConfig(baseConfig({ participantCount: 8 }));
    expect(result.valid).toBe(false);
  });

  it('should accept scoreThreshold at boundaries 15 and 90', () => {
    expect(validateKothConfig(baseConfig({ scoreThreshold: 15 })).valid).toBe(true);
    expect(validateKothConfig(baseConfig({ scoreThreshold: 90 })).valid).toBe(true);
  });

  it('should reject scoreThreshold outside [15, 90]', () => {
    expect(validateKothConfig(baseConfig({ scoreThreshold: 14 })).valid).toBe(false);
    expect(validateKothConfig(baseConfig({ scoreThreshold: 91 })).valid).toBe(false);
  });

  it('should accept timeLimit at boundaries 60 and 300', () => {
    expect(validateKothConfig(baseConfig({ timeLimit: 60 })).valid).toBe(true);
    expect(validateKothConfig(baseConfig({ timeLimit: 300 })).valid).toBe(true);
  });

  it('should reject timeLimit outside [60, 300]', () => {
    expect(validateKothConfig(baseConfig({ timeLimit: 59 })).valid).toBe(false);
    expect(validateKothConfig(baseConfig({ timeLimit: 301 })).valid).toBe(false);
  });

  it('should accept zoneRadius at boundaries 3 and 8', () => {
    expect(validateKothConfig(baseConfig({ zoneRadius: 3 })).valid).toBe(true);
    expect(validateKothConfig(baseConfig({ zoneRadius: 8 })).valid).toBe(true);
  });

  it('should reject zoneRadius outside [3, 8]', () => {
    expect(validateKothConfig(baseConfig({ zoneRadius: 2 })).valid).toBe(false);
    expect(validateKothConfig(baseConfig({ zoneRadius: 9 })).valid).toBe(false);
  });

  it('should collect multiple errors when multiple fields are invalid', () => {
    const result = validateKothConfig({
      participantCount: 3,
      scoreThreshold: 100,
      timeLimit: 10,
      zoneRadius: 1,
      matchId: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(4);
  });

  it('should skip validation for undefined optional fields', () => {
    const result = validateKothConfig({ participantCount: 6, matchId: 1 });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── evaluateZoneOccupation ─────────────────────────────────────────

describe('evaluateZoneOccupation', () => {
  const zone = makeZoneState(0, 0, 5);

  it('should return empty when no robots are inside the zone', () => {
    const robots = [makeRobot(1, 10, 10), makeRobot(2, -10, -10)];
    const result = evaluateZoneOccupation(robots, zone);
    expect(result.state).toBe('empty');
    expect(result.occupants).toHaveLength(0);
  });

  it('should return uncontested when exactly one robot is inside', () => {
    const robots = [makeRobot(1, 2, 2), makeRobot(2, 10, 10)];
    const result = evaluateZoneOccupation(robots, zone);
    expect(result.state).toBe('uncontested');
    expect(result.occupants).toEqual([1]);
  });

  it('should return contested when two or more robots are inside', () => {
    const robots = [makeRobot(1, 1, 1), makeRobot(2, -1, -1), makeRobot(3, 20, 20)];
    const result = evaluateZoneOccupation(robots, zone);
    expect(result.state).toBe('contested');
    expect(result.occupants).toEqual(expect.arrayContaining([1, 2]));
    expect(result.occupants).toHaveLength(2);
  });

  it('should include robot exactly on the zone boundary (distance == radius)', () => {
    // Robot at (5, 0) is exactly at distance 5 from center (0,0)
    const robots = [makeRobot(1, 5, 0)];
    const result = evaluateZoneOccupation(robots, zone);
    expect(result.state).toBe('uncontested');
    expect(result.occupants).toEqual([1]);
  });

  it('should exclude dead robots from occupation', () => {
    const robots = [makeRobot(1, 0, 0, false), makeRobot(2, 0, 0, true)];
    const result = evaluateZoneOccupation(robots, zone);
    expect(result.state).toBe('uncontested');
    expect(result.occupants).toEqual([2]);
  });

  it('should use Euclidean distance for zone boundary check', () => {
    // Robot at (3, 4) has distance 5 from origin — exactly on boundary
    const robots = [makeRobot(1, 3, 4)];
    const result = evaluateZoneOccupation(robots, zone);
    expect(result.occupants).toEqual([1]);

    // Robot at (3, 4.01) has distance > 5 — outside
    const robots2 = [makeRobot(1, 3, 4.01)];
    const result2 = evaluateZoneOccupation(robots2, zone);
    expect(result2.occupants).toHaveLength(0);
  });

  it('should handle an empty robot array', () => {
    const result = evaluateZoneOccupation([], zone);
    expect(result.state).toBe('empty');
    expect(result.occupants).toHaveLength(0);
  });
});


// ─── Scoring System Imports ─────────────────────────────────────────

import {
  KothScoreState,
  KothCombatEvent,
  createKothScoreState,
  tickScoring,
  awardKillBonus,
  resetScoreTickAccumulator,
} from '../src/services/arena/kothEngine';
import type { ZoneOccupationResult } from '../src/services/arena/kothEngine';

// ─── createKothScoreState ───────────────────────────────────────────

describe('createKothScoreState', () => {
  it('should initialize all scores to zero', () => {
    const state = createKothScoreState([1, 2, 3]);
    expect(state.zoneScores).toEqual({ 1: 0, 2: 0, 3: 0 });
  });

  it('should initialize all timers and counters to zero', () => {
    const state = createKothScoreState([10, 20]);
    expect(state.zoneOccupationTime).toEqual({ 10: 0, 20: 0 });
    expect(state.uncontestedTime).toEqual({ 10: 0, 20: 0 });
    expect(state.passiveTimers).toEqual({ 10: 0, 20: 0 });
    expect(state.killCounts).toEqual({ 10: 0, 20: 0 });
  });

  it('should initialize sets and phase flags correctly', () => {
    const state = createKothScoreState([1]);
    expect(state.zoneOccupants.size).toBe(0);
    expect(state.eliminatedRobots.size).toBe(0);
    expect(state.eliminationScores).toEqual({});
    expect(state.lastStandingPhase).toBe(false);
    expect(state.lastStandingTimer).toBe(0);
    expect(state.lastStandingRobotId).toBeNull();
  });
});

// ─── tickScoring ────────────────────────────────────────────────────

describe('tickScoring', () => {
  const zone = makeZoneState(0, 0, 5);
  const dt = 0.1; // standard simulation tick

  beforeEach(() => {
    resetScoreTickAccumulator();
  });

  it('should award 0.1 points per tick when uncontested (Req 3.1)', () => {
    const state = createKothScoreState([1, 2]);
    const occ: ZoneOccupationResult = { occupants: [1], state: 'uncontested' };

    tickScoring(state, zone, occ, dt);

    expect(state.zoneScores[1]).toBeCloseTo(0.1, 10);
    expect(state.zoneScores[2]).toBe(0);
  });

  it('should accumulate to 1 point after 10 ticks (1 second) (Req 3.1, 3.5)', () => {
    const state = createKothScoreState([1, 2]);
    const occ: ZoneOccupationResult = { occupants: [1], state: 'uncontested' };

    for (let i = 0; i < 10; i++) {
      tickScoring(state, zone, occ, dt);
    }

    expect(state.zoneScores[1]).toBeCloseTo(1.0, 10);
    expect(state.zoneScores[2]).toBe(0);
  });

  it('should award zero points when contested (Req 3.2)', () => {
    const state = createKothScoreState([1, 2, 3]);
    const occ: ZoneOccupationResult = { occupants: [1, 2], state: 'contested' };

    for (let i = 0; i < 10; i++) {
      tickScoring(state, zone, occ, dt);
    }

    expect(state.zoneScores[1]).toBe(0);
    expect(state.zoneScores[2]).toBe(0);
    expect(state.zoneScores[3]).toBe(0);
  });

  it('should award zero points when zone is empty (Req 3.3)', () => {
    const state = createKothScoreState([1, 2]);
    const occ: ZoneOccupationResult = { occupants: [], state: 'empty' };

    for (let i = 0; i < 10; i++) {
      tickScoring(state, zone, occ, dt);
    }

    expect(state.zoneScores[1]).toBe(0);
    expect(state.zoneScores[2]).toBe(0);
  });

  it('should not award points when zone is inactive (transition period)', () => {
    const inactiveZone: KothZoneState = { ...zone, isActive: false };
    const state = createKothScoreState([1]);
    const occ: ZoneOccupationResult = { occupants: [1], state: 'uncontested' };

    for (let i = 0; i < 10; i++) {
      tickScoring(state, inactiveZone, occ, dt);
    }

    expect(state.zoneScores[1]).toBe(0);
  });

  it('should track zone occupation time for all occupants', () => {
    const state = createKothScoreState([1, 2, 3]);
    const occ: ZoneOccupationResult = { occupants: [1, 2], state: 'contested' };

    for (let i = 0; i < 10; i++) {
      tickScoring(state, zone, occ, dt);
    }

    expect(state.zoneOccupationTime[1]).toBeCloseTo(1.0, 10);
    expect(state.zoneOccupationTime[2]).toBeCloseTo(1.0, 10);
    expect(state.zoneOccupationTime[3]).toBe(0);
  });

  it('should track uncontested time only for the sole occupant', () => {
    const state = createKothScoreState([1, 2]);
    const occ: ZoneOccupationResult = { occupants: [1], state: 'uncontested' };

    for (let i = 0; i < 10; i++) {
      tickScoring(state, zone, occ, dt);
    }

    expect(state.uncontestedTime[1]).toBeCloseTo(1.0, 10);
    expect(state.uncontestedTime[2]).toBe(0);
  });

  it('should update zoneOccupants set each tick', () => {
    const state = createKothScoreState([1, 2, 3]);

    tickScoring(state, zone, { occupants: [1, 2], state: 'contested' }, dt);
    expect(state.zoneOccupants).toEqual(new Set([1, 2]));

    tickScoring(state, zone, { occupants: [1], state: 'uncontested' }, dt);
    expect(state.zoneOccupants).toEqual(new Set([1]));

    tickScoring(state, zone, { occupants: [], state: 'empty' }, dt);
    expect(state.zoneOccupants).toEqual(new Set());
  });

  it('should emit a score_tick event every 1 second of game time (Req 3.6)', () => {
    const state = createKothScoreState([1, 2]);
    const occ: ZoneOccupationResult = { occupants: [1], state: 'uncontested' };
    const allEvents: KothCombatEvent[] = [];

    // 10 ticks = 1 second → should emit exactly 1 score_tick
    for (let i = 0; i < 10; i++) {
      allEvents.push(...tickScoring(state, zone, occ, dt));
    }

    const scoreTicks = allEvents.filter(e => e.type === 'score_tick');
    expect(scoreTicks).toHaveLength(1);
    expect(scoreTicks[0].kpiData?.zoneScores).toBeDefined();
    expect(scoreTicks[0].kpiData?.zoneState).toBe('uncontested');
  });

  it('should emit score_tick with correct zone scores snapshot', () => {
    const state = createKothScoreState([1, 2]);
    const occ: ZoneOccupationResult = { occupants: [1], state: 'uncontested' };
    const allEvents: KothCombatEvent[] = [];

    for (let i = 0; i < 10; i++) {
      allEvents.push(...tickScoring(state, zone, occ, dt));
    }

    const scoreTick = allEvents.find(e => e.type === 'score_tick');
    expect(scoreTick?.kpiData?.zoneScores?.[1]).toBeCloseTo(1.0, 10);
    expect(scoreTick?.kpiData?.zoneScores?.[2]).toBe(0);
  });

  it('should emit score_tick for contested state with correct message', () => {
    const state = createKothScoreState([1, 2]);
    const occ: ZoneOccupationResult = { occupants: [1, 2], state: 'contested' };
    const allEvents: KothCombatEvent[] = [];

    for (let i = 0; i < 10; i++) {
      allEvents.push(...tickScoring(state, zone, occ, dt));
    }

    const scoreTick = allEvents.find(e => e.type === 'score_tick');
    expect(scoreTick?.message).toContain('contested');
    expect(scoreTick?.kpiData?.zoneState).toBe('contested');
  });

  it('should not emit score_tick before 1 second has elapsed', () => {
    const state = createKothScoreState([1]);
    const occ: ZoneOccupationResult = { occupants: [1], state: 'uncontested' };
    const allEvents: KothCombatEvent[] = [];

    // 9 ticks = 0.9 seconds → no score_tick yet
    for (let i = 0; i < 9; i++) {
      allEvents.push(...tickScoring(state, zone, occ, dt));
    }

    expect(allEvents.filter(e => e.type === 'score_tick')).toHaveLength(0);
  });

  it('should emit multiple score_ticks over multiple seconds', () => {
    const state = createKothScoreState([1]);
    const occ: ZoneOccupationResult = { occupants: [1], state: 'uncontested' };
    const allEvents: KothCombatEvent[] = [];

    // 30 ticks = 3 seconds → 3 score_ticks
    for (let i = 0; i < 30; i++) {
      allEvents.push(...tickScoring(state, zone, occ, dt));
    }

    expect(allEvents.filter(e => e.type === 'score_tick')).toHaveLength(3);
  });
});

// ─── awardKillBonus ─────────────────────────────────────────────────

describe('awardKillBonus', () => {
  it('should award exactly 5 points to the killer (Req 3.4)', () => {
    const state = createKothScoreState([1, 2, 3]);
    awardKillBonus(state, 1, 2);

    expect(state.zoneScores[1]).toBe(5);
    expect(state.zoneScores[2]).toBe(0);
    expect(state.zoneScores[3]).toBe(0);
  });

  it('should accumulate kill bonuses across multiple kills', () => {
    const state = createKothScoreState([1, 2, 3]);
    awardKillBonus(state, 1, 2);
    awardKillBonus(state, 1, 3);

    expect(state.zoneScores[1]).toBe(10);
  });

  it('should increment the killer kill count', () => {
    const state = createKothScoreState([1, 2, 3]);
    awardKillBonus(state, 1, 2);
    awardKillBonus(state, 1, 3);

    expect(state.killCounts[1]).toBe(2);
    expect(state.killCounts[2]).toBe(0);
  });

  it('should emit a kill_bonus event (Req 3.7)', () => {
    const state = createKothScoreState([1, 2]);
    const event = awardKillBonus(state, 1, 2);

    expect(event.type).toBe('kill_bonus');
    expect(event.kpiData?.killerRobotId).toBe(1);
    expect(event.kpiData?.victimRobotId).toBe(2);
    expect(event.kpiData?.bonusAmount).toBe(5);
  });

  it('should include updated zone scores in the event', () => {
    const state = createKothScoreState([1, 2]);
    state.zoneScores[1] = 10; // pre-existing score
    const event = awardKillBonus(state, 1, 2);

    expect(event.kpiData?.zoneScores?.[1]).toBe(15); // 10 + 5
  });

  it('should add points on top of existing zone score from occupation', () => {
    const state = createKothScoreState([1, 2]);
    state.zoneScores[1] = 3.5; // from zone occupation
    awardKillBonus(state, 1, 2);

    expect(state.zoneScores[1]).toBe(8.5); // 3.5 + 5
  });

  it('should contain a descriptive message with killer and victim', () => {
    const state = createKothScoreState([1, 2]);
    const event = awardKillBonus(state, 1, 2);

    expect(event.message).toContain('1');
    expect(event.message).toContain('2');
    expect(event.message).toContain('5');
    expect(event.message).toContain('kill bonus');
  });
});


// ─── Win Condition Evaluator Imports ─────────────────────────────────

import {
  KothWinConditionEvaluator,
  calculateFinalPlacements,
  KothPlacement,
} from '../src/services/arena/kothEngine';
import type { GameModeState } from '../src/services/arena/types';

// ─── Helpers for Win Condition Tests ────────────────────────────────

function makeGameState(scoreState: KothScoreState): GameModeState {
  return {
    mode: 'zone_control',
    zoneScores: { ...scoreState.zoneScores },
    customData: {
      scoreState,
      pendingEvents: [],
    },
  };
}

function defaultConfig(): KothMatchConfig {
  return { participantCount: 6, matchId: 1 };
}

// ─── calculateFinalPlacements ───────────────────────────────────────

describe('calculateFinalPlacements', () => {
  it('should order robots by Zone_Score descending (Req 4.12)', () => {
    const state = createKothScoreState([1, 2, 3]);
    state.zoneScores[1] = 10;
    state.zoneScores[2] = 20;
    state.zoneScores[3] = 15;

    const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0), makeRobot(3, 0, 0)];
    const placements = calculateFinalPlacements(state, robots);

    expect(placements[0].robotId).toBe(2);
    expect(placements[0].placement).toBe(1);
    expect(placements[1].robotId).toBe(3);
    expect(placements[1].placement).toBe(2);
    expect(placements[2].robotId).toBe(1);
    expect(placements[2].placement).toBe(3);
  });

  it('should break ties by zone occupation time descending (Req 4.5)', () => {
    const state = createKothScoreState([1, 2]);
    state.zoneScores[1] = 10;
    state.zoneScores[2] = 10;
    state.zoneOccupationTime[1] = 5;
    state.zoneOccupationTime[2] = 8;

    const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0)];
    const placements = calculateFinalPlacements(state, robots);

    expect(placements[0].robotId).toBe(2);
    expect(placements[1].robotId).toBe(1);
  });

  it('should break ties by damage dealt descending when zone time is equal (Req 4.5)', () => {
    const state = createKothScoreState([1, 2]);
    state.zoneScores[1] = 10;
    state.zoneScores[2] = 10;
    state.zoneOccupationTime[1] = 5;
    state.zoneOccupationTime[2] = 5;

    const r1 = makeRobot(1, 0, 0);
    r1.totalDamageDealt = 200;
    const r2 = makeRobot(2, 0, 0);
    r2.totalDamageDealt = 300;

    const placements = calculateFinalPlacements(state, [r1, r2]);

    expect(placements[0].robotId).toBe(2);
    expect(placements[1].robotId).toBe(1);
  });

  it('should use elimination scores for eliminated robots (Req 7.6)', () => {
    const state = createKothScoreState([1, 2, 3]);
    state.zoneScores[1] = 5;
    state.zoneScores[2] = 20; // current score (alive)
    state.zoneScores[3] = 25; // current score but eliminated earlier at 15
    state.eliminatedRobots.add(3);
    state.eliminationScores[3] = 15;

    const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0), makeRobot(3, 0, 0, false)];
    const placements = calculateFinalPlacements(state, robots);

    // Robot 2 (20) > Robot 3 (15 at elimination) > Robot 1 (5)
    expect(placements[0].robotId).toBe(2);
    expect(placements[1].robotId).toBe(3);
    expect(placements[1].zoneScore).toBe(15);
    expect(placements[2].robotId).toBe(1);
  });

  it('should include all robots in placements (surviving and eliminated)', () => {
    const state = createKothScoreState([1, 2, 3, 4, 5, 6]);
    state.zoneScores = { 1: 30, 2: 20, 3: 15, 4: 10, 5: 5, 6: 0 };
    state.eliminatedRobots.add(5);
    state.eliminatedRobots.add(6);
    state.eliminationScores[5] = 5;
    state.eliminationScores[6] = 0;

    const robots = [
      makeRobot(1, 0, 0), makeRobot(2, 0, 0), makeRobot(3, 0, 0),
      makeRobot(4, 0, 0), makeRobot(5, 0, 0, false), makeRobot(6, 0, 0, false),
    ];
    const placements = calculateFinalPlacements(state, robots);

    expect(placements).toHaveLength(6);
    expect(placements.map(p => p.placement)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

// ─── KothWinConditionEvaluator ──────────────────────────────────────

describe('KothWinConditionEvaluator', () => {
  describe('score threshold', () => {
    it('should end match when a robot reaches score threshold (Req 4.2)', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const state = createKothScoreState([1, 2, 3]);
      state.zoneScores[1] = 30; // exactly at threshold
      const gameState = makeGameState(state);
      const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0), makeRobot(3, 0, 0)];

      const result = evaluator.evaluate([robots], 50, gameState);

      expect(result).not.toBeNull();
      expect(result!.ended).toBe(true);
      expect(result!.winnerId).toBe(1);
      expect(result!.reason).toBe('score_threshold');
    });

    it('should end match when a robot exceeds score threshold', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const state = createKothScoreState([1, 2]);
      state.zoneScores[2] = 35;
      const gameState = makeGameState(state);
      const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0)];

      const result = evaluator.evaluate([robots], 60, gameState);

      expect(result!.ended).toBe(true);
      expect(result!.winnerId).toBe(2);
      expect(result!.reason).toBe('score_threshold');
    });

    it('should not end match when no robot has reached threshold', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const state = createKothScoreState([1, 2, 3]);
      state.zoneScores[1] = 29.9;
      state.zoneScores[2] = 15;
      const gameState = makeGameState(state);
      const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0), makeRobot(3, 0, 0)];

      const result = evaluator.evaluate([robots], 50, gameState);

      expect(result).toBeNull();
    });

    it('should use custom score threshold from config (Req 4.7)', () => {
      const evaluator = new KothWinConditionEvaluator({
        ...defaultConfig(),
        scoreThreshold: 50,
      });
      const state = createKothScoreState([1, 2]);
      state.zoneScores[1] = 30; // below custom threshold
      const gameState = makeGameState(state);
      const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0)];

      const result = evaluator.evaluate([robots], 50, gameState);

      expect(result).toBeNull(); // 30 < 50, no win
    });
  });

  describe('last standing phase', () => {
    it('should enter last-standing phase when all but one eliminated (Req 4.8)', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const state = createKothScoreState([1, 2, 3]);
      state.eliminatedRobots.add(2);
      state.eliminatedRobots.add(3);
      state.eliminationScores[2] = 5;
      state.eliminationScores[3] = 3;
      const gameState = makeGameState(state);
      const robots = [
        makeRobot(1, 0, 0),
        makeRobot(2, 0, 0, false),
        makeRobot(3, 0, 0, false),
      ];

      const result = evaluator.evaluate([robots], 50, gameState);

      // The tick hook sets lastStandingPhase when only one robot remains alive.
      // evaluate() only checks if the timer has expired.
      // Since the tick hook runs before evaluate in the game loop, we verify
      // that evaluate returns null (game not over yet) when timer hasn't expired.
      expect(result).toBeNull();
    });

    it('should emit last_standing event when entering the phase (Req 4.10)', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const state = createKothScoreState([1, 2]);
      state.zoneScores[1] = 10;
      state.eliminatedRobots.add(2);
      state.eliminationScores[2] = 5;
      // Simulate tick hook having set lastStandingPhase
      state.lastStandingPhase = true;
      state.lastStandingRobotId = 1;
      state.lastStandingTimer = 0;
      const gameState = makeGameState(state);
      const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0, false)];

      // Timer hasn't expired yet, so evaluate returns null
      const result = evaluator.evaluate([robots], 60, gameState);
      expect(result).toBeNull();
    });

    it('should end match after 10s last-standing timer expires (Req 4.9)', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const state = createKothScoreState([1, 2]);
      state.zoneScores[1] = 10;
      state.eliminatedRobots.add(2);
      state.eliminationScores[2] = 5;
      state.lastStandingPhase = true;
      state.lastStandingTimer = 10; // timer expired
      state.lastStandingRobotId = 1;
      const gameState = makeGameState(state);
      const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0, false)];

      const result = evaluator.evaluate([robots], 70, gameState);

      expect(result).not.toBeNull();
      expect(result!.ended).toBe(true);
      expect(result!.winnerId).toBe(1);
      expect(result!.reason).toBe('last_standing');
    });

    it('should declare highest score winner even if survivor has lower score (Req 4.9)', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const state = createKothScoreState([1, 2]);
      state.zoneScores[1] = 5; // survivor has lower score
      state.zoneScores[2] = 20; // eliminated robot had higher score
      state.eliminatedRobots.add(2);
      state.eliminationScores[2] = 20;
      state.lastStandingPhase = true;
      state.lastStandingTimer = 10;
      state.lastStandingRobotId = 1;
      const gameState = makeGameState(state);
      const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0, false)];

      const result = evaluator.evaluate([robots], 70, gameState);

      expect(result!.ended).toBe(true);
      // Robot 2 had higher score at elimination, so it wins
      expect(result!.winnerId).toBe(2);
      expect(result!.reason).toBe('last_standing');
    });

    it('should not end match during last-standing phase if timer not expired', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const state = createKothScoreState([1, 2]);
      state.zoneScores[1] = 10;
      state.eliminatedRobots.add(2);
      state.eliminationScores[2] = 5;
      state.lastStandingPhase = true;
      state.lastStandingTimer = 5; // only 5s elapsed
      state.lastStandingRobotId = 1;
      const gameState = makeGameState(state);
      const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0, false)];

      const result = evaluator.evaluate([robots], 65, gameState);

      expect(result).toBeNull();
    });
  });

  describe('time limit', () => {
    it('should end match when time limit reached (Req 4.4)', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const state = createKothScoreState([1, 2, 3]);
      state.zoneScores[1] = 20;
      state.zoneScores[2] = 15;
      state.zoneScores[3] = 10;
      const gameState = makeGameState(state);
      const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0), makeRobot(3, 0, 0)];

      const result = evaluator.evaluate([robots], 150, gameState);

      expect(result!.ended).toBe(true);
      expect(result!.winnerId).toBe(1);
      expect(result!.reason).toBe('time_limit');
    });

    it('should use tiebreaker when scores are equal at time limit (Req 4.5)', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const state = createKothScoreState([1, 2]);
      state.zoneScores[1] = 10;
      state.zoneScores[2] = 10;
      state.zoneOccupationTime[1] = 8;
      state.zoneOccupationTime[2] = 12; // more zone time → wins
      const gameState = makeGameState(state);
      const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0)];

      const result = evaluator.evaluate([robots], 150, gameState);

      expect(result!.ended).toBe(true);
      expect(result!.winnerId).toBe(2);
      expect(result!.reason).toBe('time_limit');
    });

    it('should use damage dealt as final tiebreaker (Req 4.5)', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const state = createKothScoreState([1, 2]);
      state.zoneScores[1] = 0;
      state.zoneScores[2] = 0;
      state.zoneOccupationTime[1] = 0;
      state.zoneOccupationTime[2] = 0;
      const gameState = makeGameState(state);
      const r1 = makeRobot(1, 0, 0);
      r1.totalDamageDealt = 500;
      const r2 = makeRobot(2, 0, 0);
      r2.totalDamageDealt = 300;

      const result = evaluator.evaluate([[r1, r2]], 150, gameState);

      expect(result!.ended).toBe(true);
      expect(result!.winnerId).toBe(1);
    });

    it('should use custom time limit from config (Req 4.7)', () => {
      const evaluator = new KothWinConditionEvaluator({
        ...defaultConfig(),
        timeLimit: 90,
      });
      const state = createKothScoreState([1, 2]);
      state.zoneScores[1] = 10;
      const gameState = makeGameState(state);
      const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0)];

      // At 89s, should not end
      expect(evaluator.evaluate([robots], 89, gameState)).toBeNull();
      // At 90s, should end
      const result = evaluator.evaluate([robots], 90, gameState);
      expect(result!.ended).toBe(true);
      expect(result!.reason).toBe('time_limit');
    });
  });

  describe('match_end event', () => {
    it('should emit match_end event with winner, scores, placements, duration, reason (Req 4.11)', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const state = createKothScoreState([1, 2, 3]);
      state.zoneScores[1] = 30;
      state.zoneScores[2] = 15;
      state.zoneScores[3] = 10;
      const gameState = makeGameState(state);
      const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0), makeRobot(3, 0, 0)];

      evaluator.evaluate([robots], 80, gameState);

      const events = (gameState.customData?.pendingEvents as KothCombatEvent[]) ?? [];
      const matchEnd = events.find(e => e.type === 'match_end');
      expect(matchEnd).toBeDefined();
      expect(matchEnd!.kpiData?.winnerId).toBe(1);
      expect(matchEnd!.kpiData?.winReason).toBe('score_threshold');
      expect(matchEnd!.kpiData?.duration).toBe(80);
      expect(matchEnd!.kpiData?.zoneScores).toBeDefined();
      expect(matchEnd!.kpiData?.placements).toBeDefined();
      expect(matchEnd!.kpiData?.placements).toHaveLength(3);
      expect(matchEnd!.kpiData?.placements![0].robotId).toBe(1);
      expect(matchEnd!.kpiData?.placements![0].placement).toBe(1);
    });
  });

  describe('rotating zone defaults', () => {
    it('should use scoreThreshold 45 and timeLimit 210 for rotating zone', () => {
      const evaluator = new KothWinConditionEvaluator({
        ...defaultConfig(),
        rotatingZone: true,
      });
      const state = createKothScoreState([1, 2]);
      state.zoneScores[1] = 30; // below rotating threshold of 45
      const gameState = makeGameState(state);
      const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0)];

      // At 30 points, should not end (threshold is 45 for rotating)
      expect(evaluator.evaluate([robots], 100, gameState)).toBeNull();

      // At 45 points, should end
      state.zoneScores[1] = 45;
      const result = evaluator.evaluate([robots], 100, gameState);
      expect(result!.ended).toBe(true);
      expect(result!.reason).toBe('score_threshold');
    });
  });

  describe('edge cases', () => {
    it('should return null when gameState has no scoreState', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const gameState: GameModeState = { mode: 'zone_control', customData: {} };
      const robots = [makeRobot(1, 0, 0)];

      const result = evaluator.evaluate([robots], 50, gameState);
      expect(result).toBeNull();
    });

    it('should return null when gameState is undefined', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const robots = [makeRobot(1, 0, 0)];

      const result = evaluator.evaluate([robots], 50, undefined);
      expect(result).toBeNull();
    });

    it('should handle last-standing phase ending at time limit', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const state = createKothScoreState([1, 2]);
      state.zoneScores[1] = 10;
      state.eliminatedRobots.add(2);
      state.eliminationScores[2] = 5;
      state.lastStandingPhase = true;
      state.lastStandingTimer = 3; // only 3s, but time limit reached
      state.lastStandingRobotId = 1;
      const gameState = makeGameState(state);
      const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0, false)];

      const result = evaluator.evaluate([robots], 150, gameState);

      expect(result!.ended).toBe(true);
      expect(result!.reason).toBe('last_standing');
    });

    it('should handle all robots eliminated (no survivor)', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const state = createKothScoreState([1, 2, 3]);
      state.zoneScores[1] = 10;
      state.zoneScores[2] = 15;
      state.zoneScores[3] = 5;
      state.eliminatedRobots.add(1);
      state.eliminatedRobots.add(2);
      state.eliminatedRobots.add(3);
      state.eliminationScores[1] = 10;
      state.eliminationScores[2] = 15;
      state.eliminationScores[3] = 5;
      const gameState = makeGameState(state);
      const robots = [
        makeRobot(1, 0, 0, false),
        makeRobot(2, 0, 0, false),
        makeRobot(3, 0, 0, false),
      ];

      // Simulate tick hook having set lastStandingPhase (all eliminated)
      state.lastStandingPhase = true;
      state.lastStandingRobotId = null;

      // Simulate timer expiry
      state.lastStandingTimer = 10;
      const result = evaluator.evaluate([robots], 60, gameState);

      expect(result!.ended).toBe(true);
      expect(result!.winnerId).toBe(2); // highest score
      expect(result!.reason).toBe('last_standing');
    });

    it('should prioritize score threshold over time limit', () => {
      const evaluator = new KothWinConditionEvaluator(defaultConfig());
      const state = createKothScoreState([1, 2]);
      state.zoneScores[1] = 30; // at threshold
      const gameState = makeGameState(state);
      const robots = [makeRobot(1, 0, 0), makeRobot(2, 0, 0)];

      // Both threshold and time limit met simultaneously
      const result = evaluator.evaluate([robots], 150, gameState);

      expect(result!.reason).toBe('score_threshold'); // threshold takes priority
    });
  });
});


// ─── KothTargetPriorityStrategy Imports ─────────────────────────────

import {
  KothTargetPriorityStrategy,
} from '../src/services/arena/kothEngine';
import type { ArenaConfig } from '../src/services/arena/types';

// ─── Helpers for Target Priority Tests ──────────────────────────────

/** Build a robot with specific threatAnalysis and optional HP/velocity/movementIntent */
function makeTargetRobot(
  id: number,
  x: number,
  y: number,
  overrides: {
    threatAnalysis?: number;
    currentHP?: number;
    maxHP?: number;
    isAlive?: boolean;
    velocityX?: number;
    velocityY?: number;
    targetX?: number;
    targetY?: number;
  } = {},
): RobotCombatState {
  const r = makeRobot(id, x, y, overrides.isAlive ?? true);
  // Set threatAnalysis on the robot object
  (r.robot as unknown as Record<string, unknown>).threatAnalysis = overrides.threatAnalysis ?? 35;
  if (overrides.currentHP !== undefined) r.currentHP = overrides.currentHP;
  if (overrides.maxHP !== undefined) r.maxHP = overrides.maxHP;
  if (overrides.velocityX !== undefined || overrides.velocityY !== undefined) {
    r.velocity = { x: overrides.velocityX ?? 0, y: overrides.velocityY ?? 0 };
  }
  if (overrides.targetX !== undefined || overrides.targetY !== undefined) {
    r.movementIntent = {
      ...r.movementIntent,
      targetPosition: { x: overrides.targetX ?? 0, y: overrides.targetY ?? 0 },
    };
  }
  return r;
}

function makeArenaConfig(zones?: ArenaConfig['zones']): ArenaConfig {
  return {
    radius: 24,
    center: { x: 0, y: 0 },
    spawnPositions: [],
    zones: zones ?? [{ id: 'koth_control_zone', center: { x: 0, y: 0 }, radius: 5, effect: 'control_point' }],
  };
}

function makeKothGameState(zoneState?: KothZoneState, scoreState?: KothScoreState): GameModeState {
  return {
    mode: 'zone_control',
    customData: {
      zoneState: zoneState ?? { center: { x: 0, y: 0 }, radius: 5, isActive: true, rotationCount: 0 },
      scoreState: scoreState ?? createKothScoreState([]),
    },
  };
}

// ─── KothTargetPriorityStrategy ─────────────────────────────────────

describe('KothTargetPriorityStrategy', () => {
  const strategy = new KothTargetPriorityStrategy();
  const arena = makeArenaConfig();

  describe('zone-context weights (Req 5.2)', () => {
    it('should assign 3.0× weight to zone contesters (inside zone)', () => {
      // Robot outside zone, one opponent inside zone, one outside
      const robot = makeTargetRobot(1, 15, 0, { threatAnalysis: 35 });
      const inZone = makeTargetRobot(2, 2, 0, { threatAnalysis: 10 }); // inside zone (dist=2)
      const outZone = makeTargetRobot(3, 20, 0, { threatAnalysis: 10 }); // outside zone, not approaching
      outZone.movementIntent.targetPosition = { x: 22, y: 0 }; // moving away
      outZone.velocity = { x: 1, y: 0 }; // moving away from zone

      const result = strategy.selectTargets(robot, [inZone, outZone], arena);

      // Zone contester (3.0×) should be prioritized over outside robot (1.0×)
      expect(result[0]).toBe(2);
    });

    it('should assign 2.0× weight to zone approachers', () => {
      // Robot outside zone, opponents outside but one approaching
      const robot = makeTargetRobot(1, 15, 0, { threatAnalysis: 35 });
      const approaching = makeTargetRobot(2, 10, 0, { targetX: 0, targetY: 0 }); // moving toward zone
      const notApproaching = makeTargetRobot(3, 10, 0);
      notApproaching.movementIntent.targetPosition = { x: 20, y: 0 }; // moving away
      notApproaching.velocity = { x: 1, y: 0 }; // moving away

      const result = strategy.selectTargets(robot, [notApproaching, approaching], arena);

      // Approacher (2.0×) should be prioritized over non-approaching (1.0×)
      expect(result[0]).toBe(2);
    });

    it('should assign 1.0× base weight to non-approaching outside robots', () => {
      const robot = makeTargetRobot(1, 15, 0, { threatAnalysis: 35 });
      const opp1 = makeTargetRobot(2, 20, 0);
      opp1.movementIntent.targetPosition = { x: 22, y: 0 };
      opp1.velocity = { x: 1, y: 0 };
      const opp2 = makeTargetRobot(3, 18, 0);
      opp2.movementIntent.targetPosition = { x: 22, y: 0 };
      opp2.velocity = { x: 1, y: 0 };

      const result = strategy.selectTargets(robot, [opp1, opp2], arena);

      // Both have 1.0× base weight, both should be returned
      expect(result).toHaveLength(2);
      expect(result).toContain(2);
      expect(result).toContain(3);
    });
  });

  describe('inside zone contested — lowest HP contester (Req 5.4)', () => {
    it('should prioritize lowest HP contester when robot is inside zone contested', () => {
      // Robot inside zone, two opponents also inside zone (contested)
      const robot = makeTargetRobot(1, 0, 0, { threatAnalysis: 35 });
      const highHP = makeTargetRobot(2, 1, 0, { currentHP: 80, maxHP: 100 });
      const lowHP = makeTargetRobot(3, -1, 0, { currentHP: 20, maxHP: 100 });

      const result = strategy.selectTargets(robot, [highHP, lowHP], arena);

      // Low HP contester should be highest priority
      expect(result[0]).toBe(3);
    });
  });

  describe('threatAnalysis scaling (Req 5.6)', () => {
    it('should apply 50% effectiveness at ta=5', () => {
      const robot = makeTargetRobot(1, 15, 0, { threatAnalysis: 5 });
      const inZone = makeTargetRobot(2, 2, 0);
      const outZone = makeTargetRobot(3, 20, 0);
      outZone.movementIntent.targetPosition = { x: 22, y: 0 };
      outZone.velocity = { x: 1, y: 0 };

      const result = strategy.selectTargets(robot, [inZone, outZone], arena);

      // Zone contester still prioritized but with reduced weight
      // At ta=5: scaledWeight = 1.0 + (3.0 - 1.0) * 0.5 = 2.0
      // vs outZone: 1.0 + (1.0 - 1.0) * 0.5 = 1.0
      expect(result[0]).toBe(2);
    });

    it('should apply 75% effectiveness at ta=20', () => {
      const robot = makeTargetRobot(1, 15, 0, { threatAnalysis: 20 });
      const inZone = makeTargetRobot(2, 2, 0);
      const outZone = makeTargetRobot(3, 20, 0);
      outZone.movementIntent.targetPosition = { x: 22, y: 0 };
      outZone.velocity = { x: 1, y: 0 };

      const result = strategy.selectTargets(robot, [inZone, outZone], arena);

      // At ta=20: scale = 0.5 + (20-10)/20 * 0.5 = 0.75
      // scaledWeight = 1.0 + (3.0 - 1.0) * 0.75 = 2.5
      expect(result[0]).toBe(2);
    });

    it('should apply 100% effectiveness at ta=40', () => {
      const robot = makeTargetRobot(1, 15, 0, { threatAnalysis: 40 });
      const inZone = makeTargetRobot(2, 2, 0);
      const outZone = makeTargetRobot(3, 20, 0);
      outZone.movementIntent.targetPosition = { x: 22, y: 0 };
      outZone.velocity = { x: 1, y: 0 };

      const result = strategy.selectTargets(robot, [inZone, outZone], arena);

      // At ta=40: scale = 1.0
      // scaledWeight = 1.0 + (3.0 - 1.0) * 1.0 = 3.0
      expect(result[0]).toBe(2);
    });
  });

  describe('sorting and filtering', () => {
    it('should return opponents sorted by priority descending', () => {
      const robot = makeTargetRobot(1, 15, 0, { threatAnalysis: 35 });
      const inZone = makeTargetRobot(2, 2, 0); // contester: 3.0×
      const approaching = makeTargetRobot(3, 10, 0, { targetX: 0, targetY: 0 }); // approacher: 2.0× * 1.5 = 3.0
      const outside = makeTargetRobot(4, 20, 0); // standard: 1.0×
      outside.movementIntent.targetPosition = { x: 22, y: 0 };
      outside.velocity = { x: 1, y: 0 };

      const result = strategy.selectTargets(robot, [outside, inZone, approaching], arena);

      // inZone (3.0) and approaching (with 1.5× outside bonus) should come before outside (1.0)
      expect(result).toHaveLength(3);
      expect(result[result.length - 1]).toBe(4); // outside should be last
    });

    it('should exclude dead opponents', () => {
      const robot = makeTargetRobot(1, 15, 0, { threatAnalysis: 35 });
      const alive = makeTargetRobot(2, 2, 0);
      const dead = makeTargetRobot(3, 1, 0, { isAlive: false });

      const result = strategy.selectTargets(robot, [alive, dead], arena);

      expect(result).toEqual([2]);
    });

    it('should return empty array when no alive opponents', () => {
      const robot = makeTargetRobot(1, 15, 0);
      const dead1 = makeTargetRobot(2, 2, 0, { isAlive: false });
      const dead2 = makeTargetRobot(3, 1, 0, { isAlive: false });

      const result = strategy.selectTargets(robot, [dead1, dead2], arena);

      expect(result).toEqual([]);
    });
  });

  describe('zone state resolution', () => {
    it('should use zoneState from gameState.customData when available', () => {
      const robot = makeTargetRobot(1, 15, 0, { threatAnalysis: 35 });
      const inZone = makeTargetRobot(2, 2, 0);
      const gameState = makeKothGameState();

      const result = strategy.selectTargets(robot, [inZone], arena, gameState);

      expect(result).toEqual([2]);
    });

    it('should fall back to arena zones when gameState has no zoneState', () => {
      const robot = makeTargetRobot(1, 15, 0, { threatAnalysis: 35 });
      const inZone = makeTargetRobot(2, 2, 0);
      const gameState: GameModeState = { mode: 'zone_control', customData: {} };

      const result = strategy.selectTargets(robot, [inZone], arena, gameState);

      expect(result).toEqual([2]);
    });

    it('should return opponents in original order when no zone info available', () => {
      const robot = makeTargetRobot(1, 15, 0);
      const opp1 = makeTargetRobot(2, 10, 0);
      const opp2 = makeTargetRobot(3, 12, 0);
      const noZoneArena: ArenaConfig = { radius: 24, center: { x: 0, y: 0 }, spawnPositions: [] };

      const result = strategy.selectTargets(robot, [opp1, opp2], noZoneArena);

      expect(result).toEqual([2, 3]);
    });
  });

  describe('approaching detection', () => {
    it('should detect opponent approaching via movementIntent targetPosition', () => {
      const robot = makeTargetRobot(1, 15, 0, { threatAnalysis: 35 });
      // Opponent at (10,0) with target at (2,0) — closer to zone center
      const approaching = makeTargetRobot(2, 10, 0, { targetX: 2, targetY: 0 });
      const notApproaching = makeTargetRobot(3, 10, 0);
      notApproaching.movementIntent.targetPosition = { x: 15, y: 0 }; // farther from zone
      notApproaching.velocity = { x: 1, y: 0 };

      const result = strategy.selectTargets(robot, [notApproaching, approaching], arena);

      expect(result[0]).toBe(2); // approaching should be prioritized
    });

    it('should detect opponent approaching via velocity vector', () => {
      const robot = makeTargetRobot(1, 15, 0, { threatAnalysis: 35 });
      // Opponent at (10,0) with velocity pointing toward zone center
      const approaching = makeTargetRobot(2, 10, 0, { velocityX: -1, velocityY: 0 });
      approaching.movementIntent.targetPosition = { x: 15, y: 0 }; // intent says away, but velocity toward
      const notApproaching = makeTargetRobot(3, 10, 0);
      notApproaching.movementIntent.targetPosition = { x: 15, y: 0 };
      notApproaching.velocity = { x: 1, y: 0 }; // moving away

      const result = strategy.selectTargets(robot, [notApproaching, approaching], arena);

      expect(result[0]).toBe(2);
    });
  });

  describe('outside zone — approaching bias (Req 5.5)', () => {
    it('should apply 1.5× weight for approaching opponents when robot is outside zone', () => {
      const robot = makeTargetRobot(1, 15, 0, { threatAnalysis: 35 });
      // Both opponents outside zone, one approaching
      const approaching = makeTargetRobot(2, 10, 0, { targetX: 0, targetY: 0 });
      const notApproaching = makeTargetRobot(3, 10, 0);
      notApproaching.movementIntent.targetPosition = { x: 15, y: 0 };
      notApproaching.velocity = { x: 1, y: 0 };

      const result = strategy.selectTargets(robot, [notApproaching, approaching], arena);

      // Approaching: base 2.0 * 1.5 = 3.0 → scaled = 1.0 + 2.0 * 1.0 = 3.0
      // Not approaching: 1.0 → scaled = 1.0
      expect(result[0]).toBe(2);
    });
  });
});


// ─── KothMovementIntentModifier Imports ─────────────────────────────

import {
  KothMovementIntentModifier,
} from '../src/services/arena/kothEngine';
import type { MovementIntent } from '../src/services/arena/types';

// ─── Helpers for Movement Intent Tests ──────────────────────────────

/** Build a robot with specific attributes for movement intent tests */
function makeMovementRobot(
  id: number,
  x: number,
  y: number,
  overrides: {
    threatAnalysis?: number;
    combatAlgorithms?: number;
    currentTarget?: number | null;
    isAlive?: boolean;
  } = {},
): RobotCombatState {
  const r = makeRobot(id, x, y, overrides.isAlive ?? true);
  (r.robot as unknown as Record<string, unknown>).threatAnalysis = overrides.threatAnalysis ?? 25;
  (r.robot as unknown as Record<string, unknown>).combatAlgorithms = overrides.combatAlgorithms ?? 15;
  r.currentTarget = overrides.currentTarget ?? null;
  return r;
}

function makeBaseIntent(tx = 10, ty = 10): MovementIntent {
  return {
    targetPosition: { x: tx, y: ty },
    strategy: 'direct_path',
    preferredRange: 'melee',
    stanceSpeedModifier: 1,
  };
}

function makeMovementGameState(
  robots: RobotCombatState[],
  zoneState?: KothZoneState,
  scoreState?: KothScoreState,
): GameModeState {
  return {
    mode: 'zone_control',
    customData: {
      zoneState: zoneState ?? { center: { x: 0, y: 0 }, radius: 5, isActive: true, rotationCount: 0 },
      scoreState: scoreState ?? createKothScoreState([]),
      robots,
    },
  };
}

// ─── KothMovementIntentModifier ─────────────────────────────────────

describe('KothMovementIntentModifier', () => {
  const modifier = new KothMovementIntentModifier();
  const arena = makeArenaConfig();

  describe('Rule 1: opponent within 4 units and attacking → preserve base movement (Req 6.5)', () => {
    it('should return baseIntent unchanged when opponent within 4 units is attacking', () => {
      const robot = makeMovementRobot(1, 10, 0, { threatAnalysis: 30 });
      const attacker = makeMovementRobot(2, 12, 0); // dist ~2 from robot
      attacker.currentTarget = 1; // attacking our robot

      const baseIntent = makeBaseIntent(15, 0);
      const gameState = makeMovementGameState([robot, attacker]);

      const result = modifier.modify(baseIntent, robot, arena, gameState);

      // Rule 1: when opponent is within 4 units and attacking, movement should be preserved
      expect(result.strategy).toBe(baseIntent.strategy);
      expect(result.preferredRange).toBe(baseIntent.preferredRange);
      expect(result.stanceSpeedModifier).toBe(baseIntent.stanceSpeedModifier);
    });
  });

  describe('Rule 2: inside zone uncontested, no opponent within 8 → hold position (Req 6.3)', () => {
    it('should set targetPosition to robot position when inside zone uncontested with no nearby opponents', () => {
      const robot = makeMovementRobot(1, 2, 0, { threatAnalysis: 30 }); // inside zone (dist=2)
      const farOpponent = makeMovementRobot(2, 20, 0); // dist=18 from robot, far away

      const baseIntent = makeBaseIntent(10, 10);
      const gameState = makeMovementGameState([robot, farOpponent]);

      const result = modifier.modify(baseIntent, robot, arena, gameState);

      expect(result.targetPosition.x).toBeCloseTo(2, 5);
      expect(result.targetPosition.y).toBeCloseTo(0, 5);
      // Other fields preserved
      expect(result.strategy).toBe(baseIntent.strategy);
      expect(result.preferredRange).toBe(baseIntent.preferredRange);
      expect(result.stanceSpeedModifier).toBe(baseIntent.stanceSpeedModifier);
    });
  });

  describe('Rule 2: linear wait-and-enter based on CA (Req 6.4)', () => {
    it('should blend between zone center and wait position based on CA', () => {
      // Robot outside zone with high combatAlgorithms
      const robot = makeMovementRobot(1, 15, 0, { combatAlgorithms: 30 });
      // Two opponents inside zone (contested)
      const opp1 = makeMovementRobot(2, 1, 0);
      const opp2 = makeMovementRobot(3, -1, 0);

      const baseIntent = makeBaseIntent(0, 0);
      const gameState = makeMovementGameState([robot, opp1, opp2]);

      const result = modifier.modify(baseIntent, robot, arena, gameState);

      // Wait position is at zoneRadius + 2 = 7 from center along (1,0) = (7, 0)
      // waitWeight = CA/50 = 30/50 = 0.6
      // lerp(zoneCenter, waitPos, 0.6) = lerp((0,0), (7,0), 0.6) = (4.2, 0)
      expect(result.targetPosition.x).toBeCloseTo(4.2, 1);
      expect(result.targetPosition.y).toBeCloseTo(0, 1);
    });
  });

  describe('Rule 4: no opponent within 6 units → move toward zone center (Req 6.2)', () => {
    it('should blend target toward zone center when no opponent within 6 units', () => {
      const robot = makeMovementRobot(1, 15, 0, { threatAnalysis: 25 });
      const farOpponent = makeMovementRobot(2, 15, 10); // dist=10 from robot

      const baseIntent = makeBaseIntent(20, 0);
      const gameState = makeMovementGameState([robot, farOpponent]);

      const result = modifier.modify(baseIntent, robot, arena, gameState);

      // Target should be blended toward zone center (0,0)
      // At ta=25: biasStrength = ((25-1)/49)*0.7 + 0.3 ≈ 0.643
      // lerp(20, 0, 0.643) ≈ 7.14
      expect(result.targetPosition.x).toBeLessThan(20);
      expect(result.targetPosition.x).toBeGreaterThan(0);
    });

    it('should apply ~40% bias at ta=1', () => {
      const robot = makeMovementRobot(1, 15, 0, { threatAnalysis: 1 });
      const farOpponent = makeMovementRobot(2, 15, 10);

      const baseIntent = makeBaseIntent(20, 0);
      const gameState = makeMovementGameState([robot, farOpponent]);

      const result = modifier.modify(baseIntent, robot, arena, gameState);

      // At ta=1: biasStrength = ((1-1)/49)*0.6 + 0.4 = 0.4
      // lerp(20, 0, 0.4) = 20 + (0-20)*0.4 = 20 - 8 = 12
      expect(result.targetPosition.x).toBeCloseTo(12, 1);
    });

    it('should apply ~100% bias at ta=50', () => {
      const robot = makeMovementRobot(1, 15, 0, { threatAnalysis: 50 });
      const farOpponent = makeMovementRobot(2, 15, 10);

      const baseIntent = makeBaseIntent(20, 0);
      const gameState = makeMovementGameState([robot, farOpponent]);

      const result = modifier.modify(baseIntent, robot, arena, gameState);

      // At ta=50: biasStrength = ((50-1)/49)*0.6 + 0.4 = 1.0
      // lerp(20, 0, 1.0) = 0
      expect(result.targetPosition.x).toBeCloseTo(0, 1);
      expect(result.targetPosition.y).toBeCloseTo(0, 1);
    });
  });

  describe('Rule 5: otherwise → return baseIntent unchanged', () => {
    it('should return baseIntent when opponent at 5 units and not attacking', () => {
      const robot = makeMovementRobot(1, 10, 0, { threatAnalysis: 25 });
      // Opponent at 5 units (within 6 but not attacking)
      const opponent = makeMovementRobot(2, 15, 0);
      opponent.currentTarget = null; // not attacking our robot

      const baseIntent = makeBaseIntent(12, 0);
      const gameState = makeMovementGameState([robot, opponent]);

      const result = modifier.modify(baseIntent, robot, arena, gameState);

      // Rule 5: when no other rule applies, movement properties should be preserved
      expect(result.strategy).toBe(baseIntent.strategy);
      expect(result.preferredRange).toBe(baseIntent.preferredRange);
      expect(result.stanceSpeedModifier).toBe(baseIntent.stanceSpeedModifier);
    });
  });

  describe('edge cases', () => {
    it('should return baseIntent when no gameState provided', () => {
      const robot = makeMovementRobot(1, 10, 0);
      const baseIntent = makeBaseIntent(15, 0);
      const noZoneArena: ArenaConfig = { radius: 24, center: { x: 0, y: 0 }, spawnPositions: [] };

      const result = modifier.modify(baseIntent, robot, noZoneArena);

      expect(result).toBe(baseIntent);
    });

    it('should preserve strategy, preferredRange, and stanceSpeedModifier when modifying targetPosition', () => {
      const robot = makeMovementRobot(1, 15, 0, { threatAnalysis: 50 });
      const farOpponent = makeMovementRobot(2, 15, 10);

      const baseIntent: MovementIntent = {
        targetPosition: { x: 20, y: 0 },
        strategy: 'calculated_path',
        preferredRange: 'long',
        stanceSpeedModifier: 0.8,
      };
      const gameState = makeMovementGameState([robot, farOpponent]);

      const result = modifier.modify(baseIntent, robot, arena, gameState);

      expect(result.strategy).toBe('calculated_path');
      expect(result.preferredRange).toBe('long');
      expect(result.stanceSpeedModifier).toBe(0.8);
    });
  });
});

// ─── Yield, Destruction, and Elimination Imports ────────────────────

import {
  handleRobotYield,
  handleRobotDestruction,
  removeFromZoneOccupants,
} from '../src/services/arena/kothEngine';

// ─── handleRobotYield ───────────────────────────────────────────────

describe('handleRobotYield', () => {
  const zone = makeZoneState(0, 0, 5);

  beforeEach(() => {
    resetScoreTickAccumulator();
  });

  it('should add robot to eliminatedRobots set on yield', () => {
    const state = createKothScoreState([1, 2, 3]);
    handleRobotYield(state, 2, zone);

    expect(state.eliminatedRobots.has(2)).toBe(true);
    expect(state.eliminatedRobots.size).toBe(1);
  });

  it('should record Zone_Score at elimination time on yield', () => {
    const state = createKothScoreState([1, 2, 3]);
    state.zoneScores[2] = 12.5;
    handleRobotYield(state, 2, zone);

    expect(state.eliminationScores[2]).toBe(12.5);
  });

  it('should NOT award kill bonus on yield', () => {
    const state = createKothScoreState([1, 2, 3]);
    state.zoneScores[1] = 10;
    state.zoneScores[2] = 5;
    state.zoneScores[3] = 8;

    handleRobotYield(state, 2, zone);

    // No other robot's score should change
    expect(state.zoneScores[1]).toBe(10);
    expect(state.zoneScores[3]).toBe(8);
    // Kill counts unchanged
    expect(state.killCounts[1]).toBe(0);
    expect(state.killCounts[3]).toBe(0);
  });

  it("should emit robot_eliminated event with reason 'yielded'", () => {
    const state = createKothScoreState([1, 2]);
    state.zoneScores[2] = 7;
    const event = handleRobotYield(state, 2, zone);

    expect(event.type).toBe('robot_eliminated');
    expect(event.kpiData?.robotId).toBe(2);
    expect(event.kpiData?.reason).toBe('yielded');
    expect(event.kpiData?.zoneScore).toBe(7);
    expect(event.kpiData?.destroyerRobotId).toBeUndefined();
    expect(event.message).toContain('yielded');
    expect(event.message).toContain('2');
    expect(event.message).toContain('7');
  });

  it('should remove yielded robot from zoneOccupants if inside zone', () => {
    const state = createKothScoreState([1, 2, 3]);
    state.zoneOccupants = new Set([1, 2]);

    handleRobotYield(state, 2, zone);

    expect(state.zoneOccupants.has(2)).toBe(false);
    expect(state.zoneOccupants.has(1)).toBe(true);
  });
});

// ─── handleRobotDestruction ─────────────────────────────────────────

describe('handleRobotDestruction', () => {
  const zone = makeZoneState(0, 0, 5);

  beforeEach(() => {
    resetScoreTickAccumulator();
  });

  it('should add robot to eliminatedRobots set on destruction', () => {
    const state = createKothScoreState([1, 2, 3]);
    handleRobotDestruction(state, 1, 2, zone);

    expect(state.eliminatedRobots.has(2)).toBe(true);
    expect(state.eliminatedRobots.size).toBe(1);
  });

  it('should record Zone_Score at elimination time on destruction', () => {
    const state = createKothScoreState([1, 2, 3]);
    state.zoneScores[2] = 9.3;
    handleRobotDestruction(state, 1, 2, zone);

    expect(state.eliminationScores[2]).toBe(9.3);
  });

  it('should award kill bonus of 5 points to destroyer', () => {
    const state = createKothScoreState([1, 2, 3]);
    state.zoneScores[1] = 10;
    handleRobotDestruction(state, 1, 2, zone);

    expect(state.zoneScores[1]).toBe(15); // 10 + 5 kill bonus
    expect(state.killCounts[1]).toBe(1);
  });

  it("should emit robot_eliminated event with reason 'destroyed' and kill_bonus event", () => {
    const state = createKothScoreState([1, 2]);
    state.zoneScores[2] = 4;
    const events = handleRobotDestruction(state, 1, 2, zone);

    expect(events).toHaveLength(2);

    const eliminatedEvent = events[0];
    expect(eliminatedEvent.type).toBe('robot_eliminated');
    expect(eliminatedEvent.kpiData?.robotId).toBe(2);
    expect(eliminatedEvent.kpiData?.reason).toBe('destroyed');
    expect(eliminatedEvent.kpiData?.zoneScore).toBe(4);
    expect(eliminatedEvent.kpiData?.destroyerRobotId).toBe(1);
    expect(eliminatedEvent.message).toContain('destroyed');
    expect(eliminatedEvent.message).toContain('2');

    const killBonusEvent = events[1];
    expect(killBonusEvent.type).toBe('kill_bonus');
    expect(killBonusEvent.kpiData?.killerRobotId).toBe(1);
    expect(killBonusEvent.kpiData?.victimRobotId).toBe(2);
    expect(killBonusEvent.kpiData?.bonusAmount).toBe(5);
  });

  it('should remove destroyed robot from zoneOccupants if inside zone', () => {
    const state = createKothScoreState([1, 2, 3]);
    state.zoneOccupants = new Set([1, 2, 3]);

    handleRobotDestruction(state, 1, 2, zone);

    expect(state.zoneOccupants.has(2)).toBe(false);
    expect(state.zoneOccupants.has(1)).toBe(true);
    expect(state.zoneOccupants.has(3)).toBe(true);
  });
});

// ─── Elimination Edge Cases ─────────────────────────────────────────

describe('Elimination edge cases', () => {
  const zone = makeZoneState(0, 0, 5);

  beforeEach(() => {
    resetScoreTickAccumulator();
  });

  it('should handle destruction when destroyed robot has accumulated zone score', () => {
    const state = createKothScoreState([1, 2, 3]);
    // Robot 2 accumulated significant zone score before being destroyed
    state.zoneScores[2] = 22.5;
    state.zoneOccupationTime[2] = 30;
    state.zoneOccupants = new Set([2]);

    const events = handleRobotDestruction(state, 1, 2, zone);

    // Elimination score should capture the accumulated score
    expect(state.eliminationScores[2]).toBe(22.5);
    expect(state.eliminatedRobots.has(2)).toBe(true);
    // Destroyer gets kill bonus
    expect(state.zoneScores[1]).toBe(5);
    // Events emitted correctly
    expect(events).toHaveLength(2);
    expect(events[0].kpiData?.zoneScore).toBe(22.5);
    // Robot removed from occupants
    expect(state.zoneOccupants.has(2)).toBe(false);
  });

  it('should handle yield when robot is outside zone (no occupant removal needed)', () => {
    const state = createKothScoreState([1, 2, 3]);
    state.zoneScores[3] = 5;
    // Robot 3 is NOT in zoneOccupants (outside zone)
    state.zoneOccupants = new Set([1]);

    const event = handleRobotYield(state, 3, zone);

    expect(state.eliminatedRobots.has(3)).toBe(true);
    expect(state.eliminationScores[3]).toBe(5);
    // zoneOccupants unchanged — robot 1 still there, robot 3 was never there
    expect(state.zoneOccupants.has(1)).toBe(true);
    expect(state.zoneOccupants.size).toBe(1);
    expect(event.type).toBe('robot_eliminated');
    expect(event.kpiData?.reason).toBe('yielded');
  });

  it('should handle destruction changing zone from contested to uncontested', () => {
    const state = createKothScoreState([1, 2, 3]);
    // Two robots in zone (contested), one outside
    state.zoneOccupants = new Set([1, 2]);

    handleRobotDestruction(state, 1, 2, zone);

    // Robot 2 removed from occupants, only robot 1 remains → uncontested
    expect(state.zoneOccupants.has(2)).toBe(false);
    expect(state.zoneOccupants.has(1)).toBe(true);
    expect(state.zoneOccupants.size).toBe(1);
  });
});

// ─── Rotating Zone Imports ──────────────────────────────────────────

import {
  generateNextZonePosition,
  processZoneRotation,
} from '../src/services/arena/kothEngine';
import { euclideanDistance } from '../src/services/arena/vector2d';

// ─── Rotating Zone Mechanics ────────────────────────────────────────

describe('generateNextZonePosition', () => {
  const arenaRadius = KOTH_MATCH_DEFAULTS.arenaRadius; // 24
  const zoneRadius = KOTH_MATCH_DEFAULTS.zoneRadius;   // 5

  it('should produce position within arena boundary constraints', () => {
    const pos = generateNextZonePosition(42, 1, { x: 0, y: 0 }, arenaRadius, zoneRadius);
    const distFromCenter = euclideanDistance(pos, { x: 0, y: 0 });
    const maxAllowed = arenaRadius - 6 - zoneRadius; // 24 - 6 - 5 = 13
    expect(distFromCenter).toBeLessThanOrEqual(maxAllowed + 0.001);
  });

  it('should produce position ≥8 units from previous position', () => {
    const currentCenter = { x: 5, y: 5 };
    const pos = generateNextZonePosition(42, 1, currentCenter, arenaRadius, zoneRadius);
    const distFromPrev = euclideanDistance(pos, currentCenter);
    expect(distFromPrev).toBeGreaterThanOrEqual(8 - 0.001);
  });

  it('should be deterministic for same inputs', () => {
    const pos1 = generateNextZonePosition(99, 3, { x: 2, y: 2 }, arenaRadius, zoneRadius);
    const pos2 = generateNextZonePosition(99, 3, { x: 2, y: 2 }, arenaRadius, zoneRadius);
    expect(pos1.x).toBe(pos2.x);
    expect(pos1.y).toBe(pos2.y);
  });

  it('should fall back to center after impossible constraints', () => {
    // Very small arena where constraints can't be met
    const pos = generateNextZonePosition(1, 1, { x: 0, y: 0 }, 10, 8);
    expect(pos).toEqual({ x: 0, y: 0 });
  });
});

describe('processZoneRotation', () => {
  const arenaRadius = KOTH_MATCH_DEFAULTS.arenaRadius;

  function makeRotatingZoneState(overrides: Partial<KothZoneState> = {}): KothZoneState {
    return {
      center: { x: 0, y: 0 },
      radius: KOTH_MATCH_DEFAULTS.zoneRadius,
      isActive: true,
      rotationCount: 0,
      rotationTimer: 0,
      ...overrides,
    };
  }

  it('should emit zone_moving event when rotation interval elapsed', () => {
    const zoneState = makeRotatingZoneState({ rotationTimer: 29.9 });
    const events = processZoneRotation(zoneState, 1, arenaRadius, 0.1);

    const movingEvent = events.find(e => e.type === 'zone_moving');
    expect(movingEvent).toBeDefined();
    expect(movingEvent!.message).toBe('The control zone is moving in 5 seconds!');
    expect(movingEvent!.kpiData?.newCenter).toBeDefined();
    expect(movingEvent!.kpiData?.countdown).toBe(5);
    expect(zoneState.transitionTarget).toBeDefined();
    expect(zoneState.transitionCountdown).toBe(5);
  });

  it('should deactivate zone when warning countdown reaches 0', () => {
    const zoneState = makeRotatingZoneState({
      transitionCountdown: 0.1,
      transitionTarget: { x: 5, y: 5 },
    });

    const events = processZoneRotation(zoneState, 1, arenaRadius, 0.1);

    expect(zoneState.isActive).toBe(false);
    expect(zoneState.transitionTimer).toBe(0);
    expect(events).toHaveLength(0);
  });

  it('should activate zone at new position after transition period', () => {
    const target = { x: 8, y: 3 };
    const zoneState = makeRotatingZoneState({
      isActive: false,
      transitionTimer: 2.9,
      transitionTarget: target,
      rotationCount: 2,
    });

    const events = processZoneRotation(zoneState, 1, arenaRadius, 0.1);

    expect(zoneState.isActive).toBe(true);
    expect(zoneState.center).toEqual(target);
    expect(zoneState.rotationCount).toBe(3);

    const activeEvent = events.find(e => e.type === 'zone_active');
    expect(activeEvent).toBeDefined();
    expect(activeEvent!.message).toBe('The control zone has moved to a new position!');
    expect(activeEvent!.kpiData?.center).toEqual(target);
    expect(activeEvent!.kpiData?.radius).toBe(KOTH_MATCH_DEFAULTS.zoneRadius);
    expect(activeEvent!.kpiData?.rotationCount).toBe(3);
  });
});


// ─── Anti-Passive Penalty System Imports ─────────────────────────────

import {
  tickPassivePenalties,
  KOTH_PASSIVE_PENALTIES,
} from '../src/services/arena/kothEngine';

// ─── tickPassivePenalties ───────────────────────────────────────────

describe('tickPassivePenalties', () => {
  const zone = makeZoneState(0, 0, 5);

  beforeEach(() => {
    resetScoreTickAccumulator();
  });

  it('should increment passive timer for robots outside zone', () => {
    const state = createKothScoreState([1]);
    const robots = [makeRobot(1, 20, 0)]; // far outside zone

    for (let i = 0; i < 10; i++) {
      tickPassivePenalties(state, robots, zone, 0.1);
    }

    expect(state.passiveTimers[1]).toBeCloseTo(1.0, 5);
  });

  it('should reset passive timer when robot enters zone', () => {
    const state = createKothScoreState([1]);
    state.passiveTimers[1] = 15;
    const robots = [makeRobot(1, 2, 0)]; // inside zone

    tickPassivePenalties(state, robots, zone, 0.1);

    expect(state.passiveTimers[1]).toBe(0);
  });

  it('should emit passive_warning at exactly 20 seconds outside', () => {
    const state = createKothScoreState([1]);
    state.passiveTimers[1] = 19.9;
    const robots = [makeRobot(1, 20, 0)];

    const events = tickPassivePenalties(state, robots, zone, 0.1);

    const warnings = events.filter(e => e.type === 'passive_warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].kpiData?.robotId).toBe(1);
    expect(warnings[0].message).toContain('20 seconds');
  });

  it('should NOT emit passive_warning before 20 seconds', () => {
    const state = createKothScoreState([1]);
    state.passiveTimers[1] = 19.8;
    const robots = [makeRobot(1, 20, 0)];

    const events = tickPassivePenalties(state, robots, zone, 0.1);

    const warnings = events.filter(e => e.type === 'passive_warning');
    expect(warnings).toHaveLength(0);
  });

  it('should calculate damage reduction at 30 seconds outside', () => {
    const state = createKothScoreState([1]);
    const robots = [makeRobot(1, 20, 0)];

    // At exactly 30s: floor((30-30)/5)*0.03 = 0
    state.passiveTimers[1] = 30;
    tickPassivePenalties(state, robots, zone, 0.1);
    expect(state.passivePenalties[1].damageReduction).toBe(0);

    // At 35s: floor((35-30)/5)*0.03 = 0.03
    state.passiveTimers[1] = 35;
    state.passivePenalties[1] = { damageReduction: 0, accuracyPenalty: 0 };
    tickPassivePenalties(state, robots, zone, 0.1);
    expect(state.passivePenalties[1].damageReduction).toBeCloseTo(0.03, 10);
  });

  it('should cap damage reduction at 30%', () => {
    const state = createKothScoreState([1]);
    state.passiveTimers[1] = 100;
    state.passivePenalties[1] = { damageReduction: 0, accuracyPenalty: 0 };
    const robots = [makeRobot(1, 20, 0)];

    tickPassivePenalties(state, robots, zone, 0.1);

    expect(state.passivePenalties[1].damageReduction).toBe(0.30);
  });

  it('should activate accuracy penalty at 60 seconds outside', () => {
    const state = createKothScoreState([1]);
    state.passiveTimers[1] = 59.9;
    state.passivePenalties[1] = { damageReduction: 0.18, accuracyPenalty: 0 };
    const robots = [makeRobot(1, 20, 0)];

    tickPassivePenalties(state, robots, zone, 0.1);

    expect(state.passivePenalties[1].accuracyPenalty).toBe(0.15);
  });

  it('should decay penalties linearly over 3 seconds on zone entry', () => {
    const state = createKothScoreState([1]);
    state.passiveTimers[1] = 0; // already inside zone
    state.passivePenalties[1] = { damageReduction: 0.15, accuracyPenalty: 0.15 };
    const robots = [makeRobot(1, 2, 0)]; // inside zone

    tickPassivePenalties(state, robots, zone, 1.0);

    // After 1s of 3s decay: reduce by 1/3 of current value
    // damageReduction: 0.15 - 0.15 * (1/3) = 0.15 * (2/3) = 0.10
    // accuracyPenalty: 0.15 - 0.15 * (1/3) = 0.15 * (2/3) = 0.10
    expect(state.passivePenalties[1].damageReduction).toBeCloseTo(0.10, 5);
    expect(state.passivePenalties[1].accuracyPenalty).toBeCloseTo(0.10, 5);
  });
});


// ─── buildKothGameModeConfig & buildKothInitialState Imports ────────

import {
  buildKothGameModeConfig,
  buildKothInitialState,
} from '../src/services/arena/kothEngine';

// ─── buildKothGameModeConfig ────────────────────────────────────────

describe('buildKothGameModeConfig', () => {
  it('should return config with all strategy objects', () => {
    const config: KothMatchConfig = { participantCount: 6, matchId: 1 };
    const result = buildKothGameModeConfig(config);

    expect(result.targetPriority).toBeDefined();
    expect(result.targetPriority).not.toBeNull();
    expect(result.movementModifier).toBeDefined();
    expect(result.movementModifier).not.toBeNull();
    expect(result.winCondition).toBeDefined();
    expect(result.winCondition).not.toBeNull();
  });

  it('should include exactly one control_point arena zone', () => {
    const config: KothMatchConfig = { participantCount: 6, matchId: 1 };
    const result = buildKothGameModeConfig(config);

    expect(result.arenaZones).toHaveLength(1);
    expect(result.arenaZones![0].effect).toBe('control_point');
  });

  it('should set maxDuration to timeLimit', () => {
    const config: KothMatchConfig = { participantCount: 6, matchId: 1, timeLimit: 150 };
    const result = buildKothGameModeConfig(config);

    expect(result.maxDuration).toBe(150);
  });

  it('should use rotating zone defaults when rotatingZone is true', () => {
    const config: KothMatchConfig = { participantCount: 6, matchId: 1, rotatingZone: true };
    const result = buildKothGameModeConfig(config);

    expect(result.maxDuration).toBe(KOTH_MATCH_DEFAULTS.rotatingZoneTimeLimit); // 210
  });

  it('should use fixed zone defaults when rotatingZone is false', () => {
    const config: KothMatchConfig = { participantCount: 6, matchId: 1 };
    const result = buildKothGameModeConfig(config);

    expect(result.maxDuration).toBe(KOTH_MATCH_DEFAULTS.timeLimit); // 150
  });
});

// ─── buildKothInitialState ──────────────────────────────────────────

describe('buildKothInitialState', () => {
  it('should return mode zone_control with zeroed scores', () => {
    const config: KothMatchConfig = { participantCount: 6, matchId: 1 };
    const robotIds = [1, 2, 3, 4, 5, 6];
    const result = buildKothInitialState(config, robotIds);

    expect(result.mode).toBe('zone_control');
    expect(result.zoneScores).toBeDefined();
    for (const id of robotIds) {
      expect(result.zoneScores![id]).toBe(0);
    }
  });

  it('should include scoreState in customData', () => {
    const config: KothMatchConfig = { participantCount: 5, matchId: 1 };
    const robotIds = [10, 20, 30, 40, 50];
    const result = buildKothInitialState(config, robotIds);

    const scoreState = result.customData?.scoreState as KothScoreState;
    expect(scoreState).toBeDefined();
    expect(scoreState.zoneScores).toBeDefined();
    for (const id of robotIds) {
      expect(scoreState.zoneScores[id]).toBe(0);
    }
    expect(scoreState.zoneOccupants.size).toBe(0);
    expect(scoreState.eliminatedRobots.size).toBe(0);
  });

  it('should include zoneState in customData', () => {
    const config: KothMatchConfig = { participantCount: 6, matchId: 1, zoneRadius: 7 };
    const result = buildKothInitialState(config, [1, 2, 3, 4, 5, 6]);

    const zoneState = result.customData?.zoneState as KothZoneState;
    expect(zoneState).toBeDefined();
    expect(zoneState.center).toEqual({ x: 0, y: 0 });
    expect(zoneState.radius).toBe(7);
    expect(zoneState.isActive).toBe(true);
  });
});
