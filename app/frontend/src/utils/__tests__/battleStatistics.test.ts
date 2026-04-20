import { describe, it, expect } from 'vitest';
import {
  computeBattleStatistics,
  type BattleStatistics,
  type RobotCombatStats,
} from '../battleStatistics';
import type { BattleLogEvent } from '../matchmakingApi';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<BattleLogEvent> & { type: string }): BattleLogEvent {
  return {
    timestamp: 1,
    message: '',
    ...overrides,
  } as BattleLogEvent;
}

function getRobot(stats: BattleStatistics, name: string): RobotCombatStats {
  const robot = stats.perRobot.find((r) => r.robotName === name);
  if (!robot) throw new Error(`Robot "${name}" not found in stats`);
  return robot;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('computeBattleStatistics', () => {
  // Validates: Requirements 8.4
  describe('empty events', () => {
    it('should return hasData: false for an empty events array', () => {
      const result = computeBattleStatistics([], 60);
      expect(result.hasData).toBe(false);
      expect(result.perRobot).toHaveLength(0);
      expect(result.damageFlows).toHaveLength(0);
      expect(result.perTeam).toBeNull();
      expect(result.totalEvents).toBe(0);
      expect(result.battleDuration).toBe(60);
    });
  });

  // Validates: Requirements 1.1, 1.2, 8.1, 8.2
  describe('single attack event', () => {
    it('should produce correct per-robot stats for a single hit', () => {
      const events: BattleLogEvent[] = [
        makeEvent({
          type: 'attack',
          attacker: 'Alpha',
          defender: 'Beta',
          weapon: 'Laser',
          damage: 25,
          hit: true,
          hand: 'main',
        }),
      ];

      const result = computeBattleStatistics(events, 30);

      expect(result.hasData).toBe(true);
      expect(result.totalEvents).toBe(1);
      expect(result.perRobot).toHaveLength(2);

      const alpha = getRobot(result, 'Alpha');
      expect(alpha.attacks).toBe(1);
      expect(alpha.hits).toBe(1);
      expect(alpha.misses).toBe(0);
      expect(alpha.criticals).toBe(0);
      expect(alpha.malfunctions).toBe(0);
      expect(alpha.damageDealt).toBe(25);
      expect(alpha.damageReceived).toBe(0);
      expect(alpha.hitRate).toBe(100);
      expect(alpha.mainHand.attacks).toBe(1);
      expect(alpha.mainHand.hits).toBe(1);

      const beta = getRobot(result, 'Beta');
      expect(beta.attacks).toBe(0);
      expect(beta.damageReceived).toBe(25);
      expect(beta.damageDealt).toBe(0);
    });
  });

  // Validates: Requirements 1.1, 1.2, 1.9, 1.10, 8.1
  describe('mixed event types', () => {
    it('should produce correct counts for attack, miss, critical, malfunction, counter, shield events', () => {
      const events: BattleLogEvent[] = [
        // Regular hit
        makeEvent({ type: 'attack', attacker: 'A', defender: 'B', damage: 10, hit: true, hand: 'main' }),
        // Miss
        makeEvent({ type: 'miss', attacker: 'B', defender: 'A', damage: 0, hit: false, hand: 'main' }),
        // Critical hit
        makeEvent({ type: 'critical', attacker: 'A', defender: 'B', damage: 30, hit: true, hand: 'main' }),
        // Malfunction
        makeEvent({ type: 'malfunction', attacker: 'B', defender: 'A', damage: 0, hit: false, hand: 'main' }),
        // Counter hit (role reversal: attacker = counter-attacker)
        makeEvent({ type: 'counter', attacker: 'B', defender: 'A', damage: 15, hit: true }),
        // Shield damage on a hit
        makeEvent({ type: 'attack', attacker: 'A', defender: 'B', damage: 20, hit: true, hand: 'main', shieldDamage: 8 }),
        // Shield regen tracked via robotShield deltas
        makeEvent({ type: 'attack', attacker: 'B', defender: 'A', damage: 5, hit: true, hand: 'main', robotShield: { A: 50, B: 30 } }),
        makeEvent({ type: 'attack', attacker: 'A', defender: 'B', damage: 12, hit: true, hand: 'main', robotShield: { A: 50, B: 40 } }),
      ];

      const result = computeBattleStatistics(events, 120);

      expect(result.hasData).toBe(true);

      const a = getRobot(result, 'A');
      // A's attacks: hit + critical + shield hit + last hit = 4 attack-type events
      expect(a.attacks).toBe(4);
      expect(a.hits).toBe(4); // all 4 hit
      expect(a.criticals).toBe(1);
      expect(a.misses).toBe(0);
      expect(a.malfunctions).toBe(0);
      expect(a.damageDealt).toBe(10 + 30 + 20 + 12); // 72 from attacks
      expect(a.damageReceived).toBe(5 + 15); // 5 from B's attack + 15 from B's counter

      const b = getRobot(result, 'B');
      // B's attack-type events: miss + malfunction + hit(5) = 3
      expect(b.attacks).toBe(3);
      expect(b.hits).toBe(1); // only the damage=5 hit
      expect(b.misses).toBe(1);
      expect(b.malfunctions).toBe(1);
      expect(b.damageDealt).toBe(5 + 15); // 5 from attack + 15 from counter
      expect(b.damageReceived).toBe(10 + 30 + 20 + 12); // 72

      // Counter stats for B (B is the counter-attacker)
      expect(b.counters.triggered).toBe(1);
      expect(b.counters.hits).toBe(1);
      expect(b.counters.misses).toBe(0);
      expect(b.counters.damageDealt).toBe(15);

      // A received a counter
      expect(a.countersReceived).toBe(1);

      // Shield damage absorbed by B
      expect(b.shieldDamageAbsorbed).toBe(8);

      // Shield regen: B's shield went from 30 to 40 = +10
      expect(b.shieldRecharged).toBe(10);
    });
  });

  // Validates: Requirements 1.5
  describe('tag_team with 4 robots', () => {
    it('should produce correct team grouping and aggregates', () => {
      const events: BattleLogEvent[] = [
        makeEvent({ type: 'attack', attacker: 'T1-Active', defender: 'T2-Active', damage: 20, hit: true, hand: 'main' }),
        makeEvent({ type: 'attack', attacker: 'T1-Reserve', defender: 'T2-Active', damage: 15, hit: true, hand: 'main' }),
        makeEvent({ type: 'attack', attacker: 'T2-Active', defender: 'T1-Active', damage: 10, hit: true, hand: 'main' }),
        makeEvent({ type: 'critical', attacker: 'T2-Reserve', defender: 'T1-Reserve', damage: 25, hit: true, hand: 'main' }),
        makeEvent({ type: 'miss', attacker: 'T1-Active', defender: 'T2-Reserve', damage: 0, hit: false, hand: 'main' }),
      ];

      const tagTeamInfo = {
        team1Robots: ['T1-Active', 'T1-Reserve'],
        team2Robots: ['T2-Active', 'T2-Reserve'],
      };

      const result = computeBattleStatistics(events, 90, 'tag_team', tagTeamInfo);

      expect(result.hasData).toBe(true);
      expect(result.perRobot).toHaveLength(4);
      expect(result.perTeam).not.toBeNull();
      expect(result.perTeam).toHaveLength(2);

      const team1 = result.perTeam![0];
      expect(team1.teamName).toBe('Team 1');
      expect(team1.robots).toHaveLength(2);
      expect(team1.totalDamageDealt).toBe(20 + 15); // T1-Active(20) + T1-Reserve(15)
      expect(team1.totalHits).toBe(2);
      expect(team1.totalMisses).toBe(1);
      expect(team1.totalCriticals).toBe(0);

      const team2 = result.perTeam![1];
      expect(team2.teamName).toBe('Team 2');
      expect(team2.robots).toHaveLength(2);
      expect(team2.totalDamageDealt).toBe(10 + 25); // T2-Active(10) + T2-Reserve(25)
      expect(team2.totalHits).toBe(2); // T2-Active hit + T2-Reserve critical (counts as hit)
      expect(team2.totalCriticals).toBe(1);
    });
  });

  // Validates: Requirements 1.6
  describe('koth with 6 robots', () => {
    it('should produce stats for all participants', () => {
      const robotNames = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'];
      const events: BattleLogEvent[] = robotNames.map((name, i) =>
        makeEvent({
          type: 'attack',
          attacker: name,
          defender: robotNames[(i + 1) % 6],
          damage: 10 + i,
          hit: true,
          hand: 'main',
        }),
      );

      const result = computeBattleStatistics(events, 180, 'koth');

      expect(result.hasData).toBe(true);
      expect(result.perRobot).toHaveLength(6);
      expect(result.perTeam).toBeNull(); // koth has no teams

      for (const name of robotNames) {
        const robot = getRobot(result, name);
        expect(robot.attacks).toBe(1);
        expect(robot.hits).toBe(1);
      }
    });
  });

  // Validates: Requirements 1.9
  describe('counter events role reversal', () => {
    it('should attribute counter stats to the correct robots', () => {
      const events: BattleLogEvent[] = [
        // Original attack: A attacks B
        makeEvent({ type: 'attack', attacker: 'A', defender: 'B', damage: 10, hit: true, hand: 'main' }),
        // Counter: B counters A (B is attacker in counter event, A is defender)
        makeEvent({ type: 'counter', attacker: 'B', defender: 'A', damage: 20, hit: true }),
        // Counter miss: A counters B but misses
        makeEvent({ type: 'counter', attacker: 'A', defender: 'B', damage: 0, hit: false }),
      ];

      const result = computeBattleStatistics(events, 30);

      const a = getRobot(result, 'A');
      const b = getRobot(result, 'B');

      // B's counter stats (B performed a successful counter)
      expect(b.counters.triggered).toBe(1);
      expect(b.counters.hits).toBe(1);
      expect(b.counters.misses).toBe(0);
      expect(b.counters.damageDealt).toBe(20);

      // A received B's counter
      expect(a.countersReceived).toBe(1);
      expect(a.damageReceived).toBe(20); // from B's counter

      // A's counter stats (A performed a missed counter)
      expect(a.counters.triggered).toBe(1);
      expect(a.counters.hits).toBe(0);
      expect(a.counters.misses).toBe(1);
      expect(a.counters.damageDealt).toBe(0);

      // B received A's counter attempt
      expect(b.countersReceived).toBe(1);
    });
  });

  // Validates: Requirements 1.8
  describe('main/offhand split for dual-wield events', () => {
    it('should correctly split stats between main and offhand', () => {
      const events: BattleLogEvent[] = [
        makeEvent({ type: 'attack', attacker: 'DualBot', defender: 'Target', damage: 10, hit: true, hand: 'main' }),
        makeEvent({ type: 'attack', attacker: 'DualBot', defender: 'Target', damage: 8, hit: true, hand: 'offhand' }),
        makeEvent({ type: 'critical', attacker: 'DualBot', defender: 'Target', damage: 20, hit: true, hand: 'main' }),
        makeEvent({ type: 'miss', attacker: 'DualBot', defender: 'Target', damage: 0, hit: false, hand: 'offhand' }),
        makeEvent({ type: 'malfunction', attacker: 'DualBot', defender: 'Target', damage: 0, hit: false, hand: 'offhand' }),
      ];

      const result = computeBattleStatistics(events, 60);
      const dual = getRobot(result, 'DualBot');

      // Main hand: 1 hit + 1 critical = 2 attacks, 2 hits
      expect(dual.mainHand.attacks).toBe(2);
      expect(dual.mainHand.hits).toBe(2);
      expect(dual.mainHand.criticals).toBe(1);
      expect(dual.mainHand.misses).toBe(0);
      expect(dual.mainHand.malfunctions).toBe(0);

      // Offhand: 1 hit + 1 miss + 1 malfunction = 3 attacks
      expect(dual.offhand).not.toBeNull();
      expect(dual.offhand!.attacks).toBe(3);
      expect(dual.offhand!.hits).toBe(1);
      expect(dual.offhand!.misses).toBe(1);
      expect(dual.offhand!.malfunctions).toBe(1);

      // Aggregates should be main + offhand
      expect(dual.attacks).toBe(5);
      expect(dual.hits).toBe(3);
      expect(dual.misses).toBe(1);
      expect(dual.criticals).toBe(1);
      expect(dual.malfunctions).toBe(1);
    });
  });

  // Validates: Requirements 1.7
  describe('hit severity grades at boundary values', () => {
    const maxHP: Record<string, number> = { Defender: 1000 };

    it('should classify 4.9% as glancing', () => {
      const events = [makeEvent({ type: 'attack', attacker: 'A', defender: 'Defender', damage: 49, hit: true, hand: 'main' })];
      const result = computeBattleStatistics(events, 10, undefined, undefined, maxHP);
      const a = getRobot(result, 'A');
      expect(a.hitGrades.glancing).toBe(1);
      expect(a.hitGrades.solid).toBe(0);
    });

    it('should classify exactly 5% as solid (lower boundary)', () => {
      const events = [makeEvent({ type: 'attack', attacker: 'A', defender: 'Defender', damage: 50, hit: true, hand: 'main' })];
      const result = computeBattleStatistics(events, 10, undefined, undefined, maxHP);
      const a = getRobot(result, 'A');
      expect(a.hitGrades.glancing).toBe(0);
      expect(a.hitGrades.solid).toBe(1);
    });

    it('should classify exactly 15% as solid (upper boundary)', () => {
      const events = [makeEvent({ type: 'attack', attacker: 'A', defender: 'Defender', damage: 150, hit: true, hand: 'main' })];
      const result = computeBattleStatistics(events, 10, undefined, undefined, maxHP);
      const a = getRobot(result, 'A');
      expect(a.hitGrades.solid).toBe(1);
      expect(a.hitGrades.heavy).toBe(0);
    });

    it('should classify 15.1% as heavy', () => {
      const events = [makeEvent({ type: 'attack', attacker: 'A', defender: 'Defender', damage: 151, hit: true, hand: 'main' })];
      const result = computeBattleStatistics(events, 10, undefined, undefined, maxHP);
      const a = getRobot(result, 'A');
      expect(a.hitGrades.heavy).toBe(1);
    });

    it('should classify exactly 30% as heavy (upper boundary)', () => {
      const events = [makeEvent({ type: 'attack', attacker: 'A', defender: 'Defender', damage: 300, hit: true, hand: 'main' })];
      const result = computeBattleStatistics(events, 10, undefined, undefined, maxHP);
      const a = getRobot(result, 'A');
      expect(a.hitGrades.heavy).toBe(1);
      expect(a.hitGrades.devastating).toBe(0);
    });

    it('should classify 30.1% as devastating', () => {
      const events = [makeEvent({ type: 'attack', attacker: 'A', defender: 'Defender', damage: 301, hit: true, hand: 'main' })];
      const result = computeBattleStatistics(events, 10, undefined, undefined, maxHP);
      const a = getRobot(result, 'A');
      expect(a.hitGrades.devastating).toBe(1);
    });

    it('should default to solid when robotMaxHP is not provided', () => {
      const events = [makeEvent({ type: 'attack', attacker: 'A', defender: 'Defender', damage: 999, hit: true, hand: 'main' })];
      const result = computeBattleStatistics(events, 10);
      const a = getRobot(result, 'A');
      expect(a.hitGrades.solid).toBe(1);
    });
  });

  // Validates: Requirements 8.2, 8.4
  describe('zero attacks produces hitRate=0 (not NaN)', () => {
    it('should return hitRate 0 when a robot has no attacks', () => {
      // Only counter events, no attack-type events for the defender
      const events: BattleLogEvent[] = [
        makeEvent({ type: 'counter', attacker: 'A', defender: 'B', damage: 10, hit: true }),
      ];

      const result = computeBattleStatistics(events, 30);

      const a = getRobot(result, 'A');
      // A has 0 attack-type events (counter is separate)
      expect(a.attacks).toBe(0);
      expect(a.hitRate).toBe(0);
      expect(Number.isNaN(a.hitRate)).toBe(false);
      expect(a.critRate).toBe(0);
      expect(Number.isNaN(a.critRate)).toBe(false);
      expect(a.malfunctionRate).toBe(0);
      expect(Number.isNaN(a.malfunctionRate)).toBe(false);

      const b = getRobot(result, 'B');
      expect(b.attacks).toBe(0);
      expect(b.hitRate).toBe(0);
      expect(Number.isNaN(b.hitRate)).toBe(false);
    });
  });
});
