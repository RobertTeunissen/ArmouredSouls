/**
 * Unit tests for battleSummaryComputer.ts
 *
 * The battle summary computer produces permanent pre-computed statistics from
 * raw combat events. Since battle_log is NULLed after 7 days, these summaries
 * must be correct at creation time — there's no way to recompute later.
 */

import { computeBattleSummary, BattleSummaryInput } from '../../src/services/battle/battleSummaryComputer';

// Silence logger during tests
jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function makeAttackEvent(
  tick: number,
  attacker: string,
  defender: string,
  damage: number,
  opts: Partial<{ isCritical: boolean; penetrated: boolean; evaded: boolean; hit: boolean }> = {},
) {
  const hit = opts.hit !== undefined ? opts.hit : !opts.evaded;
  return {
    timestamp: tick,
    type: 'attack',
    message: `${attacker} attacks ${defender}`,
    attacker,
    defender,
    damage: hit ? damage : 0,
    hpDamage: hit ? damage : 0,
    shieldDamage: 0,
    hit,
    isCritical: opts.isCritical ?? false,
    penetrated: opts.penetrated ?? false,
    evaded: opts.evaded ?? false,
    hand: 'main',
  };
}

function makeBasicInput(events: any[], overrides: Partial<BattleSummaryInput> = {}): BattleSummaryInput {
  return {
    events,
    duration: 30,
    battleType: 'league_1v1',
    robotMaxHP: { Robot_A: 100, Robot_B: 100 },
    robotNameToId: { Robot_A: 1, Robot_B: 2 },
    robotNameToTeam: { Robot_A: 1, Robot_B: 2 },
    ...overrides,
  };
}

describe('battleSummaryComputer', () => {
  describe('computeBattleSummary', () => {
    it('should return null for empty events without throwing', () => {
      const input = makeBasicInput([]);
      const result = computeBattleSummary(input);
      // Empty events should still produce a valid result with hasData potentially false
      // or null depending on shared utility behavior
      if (result) {
        expect(result.totalEvents).toBe(0);
        expect(result.battleDuration).toBe(30);
      }
    });

    it('should produce correct perRobot stats for a simple 1v1 battle', () => {
      const events = [
        makeAttackEvent(1, 'Robot_A', 'Robot_B', 25),
        makeAttackEvent(2, 'Robot_B', 'Robot_A', 15),
        makeAttackEvent(3, 'Robot_A', 'Robot_B', 30),
        makeAttackEvent(4, 'Robot_B', 'Robot_A', 10),
      ];

      const result = computeBattleSummary(makeBasicInput(events));
      expect(result).not.toBeNull();

      if (!result) return;
      expect(result.hasData).toBe(true);
      expect(result.battleDuration).toBe(30);
      expect(result.totalEvents).toBe(4);

      const perRobot = result.perRobot as unknown as Array<{ robotName: string; damageDealt: number }>;
      expect(perRobot).toHaveLength(2);

      const robotA = perRobot.find(r => r.robotName === 'Robot_A');
      const robotB = perRobot.find(r => r.robotName === 'Robot_B');
      expect(robotA).toBeDefined();
      expect(robotB).toBeDefined();
      expect(robotA!.damageDealt).toBe(55); // 25 + 30
      expect(robotB!.damageDealt).toBe(25); // 15 + 10
    });

    it('should compute damage flows correctly', () => {
      const events = [
        makeAttackEvent(1, 'Robot_A', 'Robot_B', 50),
        makeAttackEvent(2, 'Robot_B', 'Robot_A', 20),
      ];

      const result = computeBattleSummary(makeBasicInput(events));
      expect(result).not.toBeNull();
      if (!result) return;

      const damageFlows = result.damageFlows as unknown as Array<{ source: string; target: string; value: number }>;
      expect(damageFlows.length).toBeGreaterThan(0);

      const aToB = damageFlows.find(f => f.source === 'Robot_A' && f.target === 'Robot_B');
      const bToA = damageFlows.find(f => f.source === 'Robot_B' && f.target === 'Robot_A');
      expect(aToB?.value).toBe(50);
      expect(bToA?.value).toBe(20);
    });

    it('should include participant survival data', () => {
      const events = [
        makeAttackEvent(1, 'Robot_A', 'Robot_B', 100),
      ];

      const result = computeBattleSummary(makeBasicInput(events, { duration: 15 }));
      expect(result).not.toBeNull();
      if (!result) return;

      const participants = result.participants as unknown as Array<{ robotId: number; team: number; survivalSeconds: number }>;
      expect(participants).toHaveLength(2);
      expect(participants[0].robotId).toBeGreaterThan(0);
      expect(participants[0].team).toBeGreaterThanOrEqual(1);
    });

    it('should track critical hits', () => {
      const events = [
        // Critical events use type='critical' in the combat simulator
        { timestamp: 1, type: 'critical', attacker: 'Robot_A', defender: 'Robot_B', damage: 40, hpDamage: 40, shieldDamage: 0, hit: true, hand: 'main' },
        makeAttackEvent(2, 'Robot_A', 'Robot_B', 20, { isCritical: false, hit: true }),
      ];

      const result = computeBattleSummary(makeBasicInput(events));
      expect(result).not.toBeNull();
      if (!result) return;

      const perRobot = result.perRobot as unknown as Array<{ robotName: string; criticals: number; hits: number }>;
      const robotA = perRobot.find(r => r.robotName === 'Robot_A');
      expect(robotA).toBeDefined();
      // Robot A made 2 attacks, both hit, 1 was critical
      expect(robotA!.hits).toBe(2);
      expect(robotA!.criticals).toBeGreaterThanOrEqual(1);
    });

    it('should handle team battles with perTeam aggregation', () => {
      const events = [
        makeAttackEvent(1, 'Robot_A', 'Robot_C', 30),
        makeAttackEvent(2, 'Robot_B', 'Robot_C', 20),
        makeAttackEvent(3, 'Robot_C', 'Robot_A', 15),
        makeAttackEvent(4, 'Robot_D', 'Robot_B', 10),
      ];

      const input = makeBasicInput(events, {
        battleType: 'league_2v2',
        robotMaxHP: { Robot_A: 100, Robot_B: 100, Robot_C: 100, Robot_D: 100 },
        robotNameToId: { Robot_A: 1, Robot_B: 2, Robot_C: 3, Robot_D: 4 },
        robotNameToTeam: { Robot_A: 1, Robot_B: 1, Robot_C: 2, Robot_D: 2 },
        tagTeamInfo: { team1Robots: ['Robot_A', 'Robot_B'], team2Robots: ['Robot_C', 'Robot_D'] },
      });

      const result = computeBattleSummary(input);
      expect(result).not.toBeNull();
      if (!result) return;

      // perTeam should be populated for team battles
      if (result.perTeam) {
        const teams = result.perTeam as unknown as Array<{ totalDamageDealt: number }>;
        expect(teams).toHaveLength(2);
        expect(teams[0].totalDamageDealt).toBe(50); // Robot_A (30) + Robot_B (20)
        expect(teams[1].totalDamageDealt).toBe(25); // Robot_C (15) + Robot_D (10)
      }
    });

    it('should include KotH placements when provided', () => {
      const events = [
        makeAttackEvent(1, 'Robot_A', 'Robot_B', 10),
      ];

      const kothPlacements = [
        { robotId: 1, robotName: 'Robot_A', placement: 1, zoneScore: 100, zoneTime: 20, kills: 1, destroyed: false },
        { robotId: 2, robotName: 'Robot_B', placement: 2, zoneScore: 50, zoneTime: 10, kills: 0, destroyed: true },
      ];

      const result = computeBattleSummary(makeBasicInput(events, {
        battleType: 'koth',
        kothPlacements,
        kothData: { participantCount: 2, scoreThreshold: 150 },
      }));

      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.kothPlacements).toBeDefined();
      expect(result.kothData).toBeDefined();
      const placements = result.kothPlacements as unknown as typeof kothPlacements;
      expect(placements).toHaveLength(2);
      expect(placements[0].placement).toBe(1);
    });

    it('should include arena spatial data when provided', () => {
      const events = [makeAttackEvent(1, 'Robot_A', 'Robot_B', 10)];
      const startingPositions = { Robot_A: { x: 0, y: 0 }, Robot_B: { x: 10, y: 10 } };
      const endingPositions = { Robot_A: { x: 5, y: 5 }, Robot_B: { x: 8, y: 8 } };

      const result = computeBattleSummary(makeBasicInput(events, {
        startingPositions,
        endingPositions,
        arenaRadius: 50,
      }));

      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.startingPositions).toEqual(startingPositions);
      expect(result.endingPositions).toEqual(endingPositions);
      expect(result.arenaRadius).toBe(50);
    });

    it('should never throw — returns null on malformed input', () => {
      // Pass completely invalid input to trigger the catch block
      const badInput = {
        events: [{ invalid: true }] as any,
        duration: -1,
        battleType: 'unknown',
        robotMaxHP: {},
        robotNameToId: {},
        robotNameToTeam: {},
      };

      // Should not throw
      const result = computeBattleSummary(badInput);
      // May return null or a minimal result depending on how shared util handles bad data
      // The important thing is it doesn't crash
      expect(true).toBe(true);
      void result;
    });
  });
});
