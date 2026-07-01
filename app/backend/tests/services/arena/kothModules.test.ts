/**
 * Unit tests for KotH pure modules: zone, scoring, elimination, placements.
 *
 * These are pure functions extracted from the KotH orchestrator —
 * no DB access, fully testable without mocks.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  createControlZone,
  calculateSpawnPositions,
  evaluateZoneOccupation,
  trackZoneTransitions,
  generateNextZonePosition,
} from '../../../src/services/arena/koth/kothZone';

import {
  createKothScoreState,
  awardKillBonus,
} from '../../../src/services/arena/koth/kothScoring';

import {
  handleRobotYield,
  handleRobotDestruction,
  calculateFinalPlacements,
  removeFromZoneOccupants,
} from '../../../src/services/arena/koth/kothElimination';

import * as fc from 'fast-check';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeScoreState(robotIds: number[]) {
  const state = createKothScoreState(robotIds);
  // Populate nameMap
  for (const id of robotIds) {
    state.nameMap[id] = `Robot-${id}`;
  }
  return state;
}

function makeRobotState(id: number, isAlive: boolean, position = { x: 0, y: 0 }, damageDealt = 0) {
  return {
    robot: { id, name: `Robot-${id}` },
    isAlive,
    position,
    currentHP: isAlive ? 50 : 0,
    maxHP: 100,
    totalDamageDealt: damageDealt,
  } as any;
}

// ═══ kothZone ════════════════════════════════════════════════════════════════

describe('kothZone', () => {
  describe('createControlZone', () => {
    it('should create zone centered at origin with configured radius', () => {
      const zone = createControlZone({ zoneRadius: 5 } as any);

      expect(zone.center).toEqual({ x: 0, y: 0 });
      expect(zone.radius).toBe(5);
      expect(zone.effect).toBe('control_point');
    });

    it('should clamp radius to minimum 3', () => {
      const zone = createControlZone({ zoneRadius: 1 } as any);
      expect(zone.radius).toBe(3);
    });

    it('should clamp radius to maximum 8', () => {
      const zone = createControlZone({ zoneRadius: 15 } as any);
      expect(zone.radius).toBe(8);
    });
  });

  describe('calculateSpawnPositions', () => {
    it('should return correct number of positions', () => {
      const positions = calculateSpawnPositions(5, 20);
      expect(positions).toHaveLength(5);
    });

    it('should place robots at arenaRadius - 2 distance from center', () => {
      const positions = calculateSpawnPositions(6, 20);
      const expectedDist = 18; // 20 - 2

      for (const pos of positions) {
        const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2);
        expect(dist).toBeCloseTo(expectedDist, 1);
      }
    });

    it('should space robots evenly (equal angular spacing)', () => {
      const positions = calculateSpawnPositions(4, 20);
      // 4 robots → 90° apart

      // Check distances between adjacent positions are equal
      const dists: number[] = [];
      for (let i = 0; i < positions.length; i++) {
        const next = positions[(i + 1) % positions.length];
        const dist = Math.sqrt((positions[i].x - next.x) ** 2 + (positions[i].y - next.y) ** 2);
        dists.push(dist);
      }

      for (let i = 1; i < dists.length; i++) {
        expect(dists[i]).toBeCloseTo(dists[0], 1);
      }
    });

    it('property: all positions are equidistant from center', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 20 }),
          fc.integer({ min: 10, max: 30 }),
          (count, radius) => {
            const positions = calculateSpawnPositions(count, radius);
            const expectedDist = radius - 2;
            for (const pos of positions) {
              const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2);
              expect(dist).toBeCloseTo(expectedDist, 0);
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('evaluateZoneOccupation', () => {
    it('should return empty when no robots in zone', () => {
      const robots = [makeRobotState(1, true, { x: 20, y: 20 })];
      const zone = { center: { x: 0, y: 0 }, radius: 5 };

      const result = evaluateZoneOccupation(robots, zone as any);

      expect(result.state).toBe('empty');
      expect(result.occupants).toHaveLength(0);
    });

    it('should return uncontested when one robot in zone', () => {
      const robots = [
        makeRobotState(1, true, { x: 2, y: 2 }), // inside zone (dist ~2.8)
        makeRobotState(2, true, { x: 20, y: 20 }), // outside
      ];
      const zone = { center: { x: 0, y: 0 }, radius: 5 };

      const result = evaluateZoneOccupation(robots, zone as any);

      expect(result.state).toBe('uncontested');
      expect(result.occupants).toEqual([1]);
    });

    it('should return contested when multiple robots in zone', () => {
      const robots = [
        makeRobotState(1, true, { x: 1, y: 1 }),
        makeRobotState(2, true, { x: -1, y: -1 }),
      ];
      const zone = { center: { x: 0, y: 0 }, radius: 5 };

      const result = evaluateZoneOccupation(robots, zone as any);

      expect(result.state).toBe('contested');
      expect(result.occupants).toHaveLength(2);
    });

    it('should ignore dead robots', () => {
      const robots = [
        makeRobotState(1, false, { x: 0, y: 0 }), // dead, in zone
        makeRobotState(2, true, { x: 0, y: 0 }), // alive, in zone
      ];
      const zone = { center: { x: 0, y: 0 }, radius: 5 };

      const result = evaluateZoneOccupation(robots, zone as any);

      expect(result.occupants).toEqual([2]);
      expect(result.state).toBe('uncontested');
    });
  });

  describe('trackZoneTransitions', () => {
    it('should emit zone_enter when robot enters zone', () => {
      const scoreState = makeScoreState([1, 2]);
      scoreState.zoneOccupants = new Set(); // nobody was in zone

      const events = trackZoneTransitions(
        scoreState,
        { occupants: [1], state: 'uncontested' },
        100,
      );

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('zone_enter');
    });

    it('should emit zone_exit when robot leaves zone', () => {
      const scoreState = makeScoreState([1, 2]);
      scoreState.zoneOccupants = new Set([1]); // robot 1 was in zone

      const events = trackZoneTransitions(
        scoreState,
        { occupants: [], state: 'empty' },
        200,
      );

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('zone_exit');
    });

    it('should emit both enter and exit when robots swap', () => {
      const scoreState = makeScoreState([1, 2]);
      scoreState.zoneOccupants = new Set([1]); // robot 1 was in zone

      const events = trackZoneTransitions(
        scoreState,
        { occupants: [2], state: 'uncontested' }, // robot 2 entered, robot 1 left
        300,
      );

      expect(events).toHaveLength(2);
      const types = events.map(e => e.type);
      expect(types).toContain('zone_enter');
      expect(types).toContain('zone_exit');
    });
  });

  describe('generateNextZonePosition', () => {
    it('should be deterministic (same inputs → same output)', () => {
      const pos1 = generateNextZonePosition(42, 1, { x: 0, y: 0 }, 20, 5);
      const pos2 = generateNextZonePosition(42, 1, { x: 0, y: 0 }, 20, 5);
      expect(pos1).toEqual(pos2);
    });

    it('should produce different positions for different rotation counts', () => {
      const pos1 = generateNextZonePosition(42, 1, { x: 0, y: 0 }, 20, 5);
      const pos2 = generateNextZonePosition(42, 2, { x: 0, y: 0 }, 20, 5);
      expect(pos1).not.toEqual(pos2);
    });

    it('should stay within arena bounds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 0, max: 50 }),
          (matchId, rotation) => {
            const pos = generateNextZonePosition(matchId, rotation, { x: 0, y: 0 }, 20, 5);
            const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2);
            // maxDist = 20 - 6 - 5 = 9; position should be within this
            expect(dist).toBeLessThanOrEqual(9.01);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// ═══ kothScoring ═════════════════════════════════════════════════════════════

describe('kothScoring', () => {
  describe('createKothScoreState', () => {
    it('should initialize all scores to 0', () => {
      const state = createKothScoreState([1, 2, 3]);

      expect(state.zoneScores[1]).toBe(0);
      expect(state.zoneScores[2]).toBe(0);
      expect(state.zoneScores[3]).toBe(0);
    });

    it('should initialize empty zone occupants', () => {
      const state = createKothScoreState([1, 2, 3]);
      expect(state.zoneOccupants.size).toBe(0);
    });

    it('should initialize eliminated set as empty', () => {
      const state = createKothScoreState([1, 2, 3]);
      expect(state.eliminatedRobots.size).toBe(0);
    });
  });

  describe('awardKillBonus', () => {
    it('should increase killer zone score', () => {
      const state = makeScoreState([1, 2]);
      state.zoneScores[1] = 50;
      state.zoneScores[2] = 30;

      awardKillBonus(state, 1, 2);

      expect(state.zoneScores[1]).toBeGreaterThan(50);
    });

    it('should increment kill count for killer', () => {
      const state = makeScoreState([1, 2]);
      state.killCounts = { 1: 0, 2: 0 };

      awardKillBonus(state, 1, 2);

      expect(state.killCounts[1]).toBe(1);
    });
  });
});

// ═══ kothElimination ═════════════════════════════════════════════════════════

describe('kothElimination', () => {
  describe('removeFromZoneOccupants', () => {
    it('should remove robot from occupants set', () => {
      const state = makeScoreState([1, 2]);
      state.zoneOccupants = new Set([1, 2]);

      removeFromZoneOccupants(state, 1);

      expect(state.zoneOccupants.has(1)).toBe(false);
      expect(state.zoneOccupants.has(2)).toBe(true);
    });
  });

  describe('handleRobotYield', () => {
    it('should mark robot as eliminated', () => {
      const state = makeScoreState([1, 2]);
      const zone = { center: { x: 0, y: 0 }, radius: 5 };

      handleRobotYield(state, 1, zone as any);

      expect(state.eliminatedRobots.has(1)).toBe(true);
    });

    it('should record elimination score', () => {
      const state = makeScoreState([1, 2]);
      state.zoneScores[1] = 42;
      const zone = { center: { x: 0, y: 0 }, radius: 5 };

      handleRobotYield(state, 1, zone as any);

      expect(state.eliminationScores[1]).toBe(42);
    });

    it('should emit robot_eliminated event with yielded reason', () => {
      const state = makeScoreState([1, 2]);
      const zone = { center: { x: 0, y: 0 }, radius: 5 };

      const event = handleRobotYield(state, 1, zone as any);

      expect(event.type).toBe('robot_eliminated');
      expect(event.kpiData?.reason).toBe('yielded');
    });
  });

  describe('handleRobotDestruction', () => {
    it('should mark destroyed robot as eliminated', () => {
      const state = makeScoreState([1, 2]);
      const zone = { center: { x: 0, y: 0 }, radius: 5 };

      handleRobotDestruction(state, 1, 2, zone as any);

      expect(state.eliminatedRobots.has(2)).toBe(true);
      expect(state.eliminatedRobots.has(1)).toBe(false);
    });

    it('should emit both elimination and kill bonus events', () => {
      const state = makeScoreState([1, 2]);
      state.killCounts = { 1: 0, 2: 0 };
      const zone = { center: { x: 0, y: 0 }, radius: 5 };

      const events = handleRobotDestruction(state, 1, 2, zone as any);

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('robot_eliminated');
      expect(events[0].kpiData?.reason).toBe('destroyed');
    });
  });

  describe('calculateFinalPlacements', () => {
    it('should rank by zone score descending', () => {
      const state = makeScoreState([1, 2, 3]);
      state.zoneScores = { 1: 100, 2: 50, 3: 200 };
      state.zoneOccupationTime = { 1: 0, 2: 0, 3: 0 };

      const robots = [
        makeRobotState(1, true),
        makeRobotState(2, true),
        makeRobotState(3, true),
      ];

      const placements = calculateFinalPlacements(state, robots);

      expect(placements[0].robotId).toBe(3); // highest score
      expect(placements[0].placement).toBe(1);
      expect(placements[1].robotId).toBe(1);
      expect(placements[2].robotId).toBe(2);
    });

    it('should break ties with zone occupation time', () => {
      const state = makeScoreState([1, 2]);
      state.zoneScores = { 1: 100, 2: 100 }; // tied
      state.zoneOccupationTime = { 1: 30, 2: 60 }; // robot 2 has more time

      const robots = [makeRobotState(1, true), makeRobotState(2, true)];

      const placements = calculateFinalPlacements(state, robots);

      expect(placements[0].robotId).toBe(2); // more zone time wins tie
    });

    it('should rank alive robots above eliminated ones with same score', () => {
      const state = makeScoreState([1, 2]);
      state.zoneScores = { 1: 50, 2: 50 }; // tied
      state.zoneOccupationTime = { 1: 30, 2: 30 }; // tied
      state.eliminatedRobots.add(2);
      state.eliminationScores[2] = 50;

      const robots = [makeRobotState(1, true), makeRobotState(2, false)];

      const placements = calculateFinalPlacements(state, robots);

      expect(placements[0].robotId).toBe(1); // alive beats eliminated
      expect(placements[1].robotId).toBe(2);
    });

    it('property: placements are sequential 1..N', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),
          (count) => {
            const ids = Array.from({ length: count }, (_, i) => i + 1);
            const state = makeScoreState(ids);
            ids.forEach((id, i) => {
              state.zoneScores[id] = (count - i) * 10;
              state.zoneOccupationTime[id] = 0;
            });

            const robots = ids.map(id => makeRobotState(id, true));
            const placements = calculateFinalPlacements(state, robots);

            const placementNums = placements.map(p => p.placement).sort((a, b) => a - b);
            for (let i = 0; i < count; i++) {
              expect(placementNums[i]).toBe(i + 1);
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
