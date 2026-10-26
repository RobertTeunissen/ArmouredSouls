/**
 * KotH / Grand Melee log storage: formula breakdowns are kept on the detailed
 * events (admin calculation checks), never duplicated onto the narrative
 * events, and the log records how it was stored.
 */
import { buildKothBattleLog, KOTH_LOG_STORAGE } from '../../../src/services/battle/combat-messages/kothEventConverter';
import type { CombatEvent } from '../../../src/services/battle/combatSimulator';

const formula = { calculation: 'Hit: 70 base = 80% (rolled 41.0, result: HIT)', components: { hitRoll: 41 }, result: 12 };

const events = (): CombatEvent[] => {
  const list: CombatEvent[] = [];
  for (let t = 0; t < 4; t += 0.1) {
    list.push({ timestamp: Math.round(t * 10) / 10, type: 'movement', attacker: 'A', message: 'A moves', positions: { A: { x: t, y: 0 } } } as CombatEvent);
  }
  list.push({
    timestamp: 1.2, type: 'attack', attacker: 'A', defender: 'B', weapon: 'Rifle', damage: 12, hit: true,
    message: 'A hits B', formulaBreakdown: formula, rangePenalty: 1.1, attackAngle: 40,
    positions: { A: { x: 0, y: 0 }, B: { x: 1, y: 1 } },
  } as CombatEvent);
  return list.sort((a, b) => a.timestamp - b.timestamp);
};

const build = (storage = KOTH_LOG_STORAGE) => buildKothBattleLog({
  events: events(),
  participantCount: 2,
  arenaRadius: 14,
  startingPositions: {},
  endingPositions: {},
  scoreThreshold: 30,
  zoneRadius: 7,
  placements: [],
}, storage);

describe('buildKothBattleLog storage', () => {
  it('keeps every event with its formula breakdown and records the storage marker by default', () => {
    const log = build();
    expect(log.storage).toEqual({ formulas: true, sampled: false });
    expect((log.detailedCombatEvents as CombatEvent[]).filter(e => e.type === 'movement')).toHaveLength(40);
    const attack = (log.detailedCombatEvents as CombatEvent[]).find(e => e.type === 'attack');
    expect(attack?.formulaBreakdown).toEqual(formula);
  });

  it('never stores formulas on the narrative events', () => {
    const log = build();
    expect(log.events.every(e => !('formulaBreakdown' in e))).toBe(true);
  });

  it('thins movement when sampling is on', () => {
    const sampled = (build({ formulas: true, sampled: true }).detailedCombatEvents as CombatEvent[]).filter(e => e.type === 'movement').length;
    const full = (build({ formulas: true, sampled: false }).detailedCombatEvents as CombatEvent[]).filter(e => e.type === 'movement').length;
    expect(full).toBe(40);
    expect(sampled).toBeLessThan(full);
  });

  it('strips the debug fields when formulas are off (the old storage)', () => {
    const attack = (build({ formulas: false, sampled: true }).detailedCombatEvents as CombatEvent[]).find(e => e.type === 'attack');
    expect(attack?.formulaBreakdown).toBeUndefined();
    expect(attack?.rangePenalty).toBeUndefined();
  });
});
