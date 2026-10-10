import { facilityChain, planStorageRoom, takeReusable } from '../../goals/goalSupport';
import { blueprint, facilities, item, refinements, stable } from '../helpers/automatonFixtures';

describe('Goal_Chain and storage helpers (design §8.5–§8.6)', () => {
  it('chains facility levels and stops at the first gated level', () => {
    expect(facilityChain(stable(), 'roster_expansion', 3)).toEqual({
      kind: 'ok',
      cost: 900_000,
      steps: [
        { kind: 'facility_upgrade', facilityType: 'roster_expansion', toLevel: 1, cost: 150_000 },
        { kind: 'facility_upgrade', facilityType: 'roster_expansion', toLevel: 2, cost: 300_000 },
        { kind: 'facility_upgrade', facilityType: 'roster_expansion', toLevel: 3, cost: 450_000 },
      ],
    });
    expect(facilityChain(stable({ prestige: 999 }), 'roster_expansion', 5)).toMatchObject({
      kind: 'blocked', reason: 'prestige_gate', detail: { level: 4 },
    });
  });

  it('maps a level above the maximum to the given reason', () => {
    const facts = stable({ facilities: facilities({ roster_expansion: 10 }), prestige: 100_000 });
    expect(facilityChain(facts, 'roster_expansion', 11, 'roster_limit')).toMatchObject({ kind: 'blocked', reason: 'roster_limit' });
  });

  it('reuses the item with the most refinements, then the lowest id', () => {
    const pool = [item(3, 'Volt Sabre'), item(2, 'Volt Sabre'), item(4, 'Volt Sabre', { refinements: refinements('sharpen') })];
    expect(takeReusable(pool, 'Volt Sabre')?.inventoryId).toBe(4);
    expect(takeReusable(pool, 'Volt Sabre')?.inventoryId).toBe(2);
    expect(takeReusable(pool, 'Laser Pistol')).toBeNull();
    expect(pool.map((i) => i.inventoryId)).toEqual([3]);
  });

  describe('Storage_Overflow_Rule', () => {
    const full = (storageLevel: number) => stable({
      facilities: facilities({ storage_facility: storageLevel }),
      inventory: Array.from({ length: 5 + 5 * storageLevel }, (_, i) => item(i + 1, 'Practice Blade')),
    });
    const everything = (storageLevel: number) => new Set(Array.from({ length: 5 + 5 * storageLevel }, (_, i) => i + 1));

    it('needs nothing when storage has room', () => {
      expect(planStorageRoom(stable(), [blueprint(1)], 2, new Set())).toEqual({ kind: 'ok', steps: [], cost: 0 });
    });

    it('plans one Storage Facility level for up to 5 slots when nothing can be sold', () => {
      expect(planStorageRoom(full(0), [blueprint(1)], 2, everything(0))).toEqual({
        kind: 'ok',
        cost: 75_000,
        steps: [{ kind: 'facility_upgrade', facilityType: 'storage_facility', toLevel: 1, cost: 75_000 }],
      });
    });

    it('is Blocked with prestige_gate when the needed storage level is gated', () => {
      expect(planStorageRoom(full(3), [blueprint(1)], 1, everything(3))).toMatchObject({
        kind: 'blocked', reason: 'prestige_gate', detail: { facilityType: 'storage_facility', level: 4 },
      });
    });

    it('is Blocked with storage_limit at Storage Facility L10 with nothing to sell', () => {
      const facts = { ...full(10), prestige: 100_000 };
      expect(planStorageRoom(facts, [blueprint(1)], 1, everything(10))).toMatchObject({ kind: 'blocked', reason: 'storage_limit' });
    });

    it('never sells a reserved (about to be reused) item', () => {
      const result = planStorageRoom(full(0), [blueprint(1)], 1, new Set([1, 2, 3, 4]));
      expect(result).toMatchObject({ kind: 'ok', steps: [{ kind: 'weapon_sale', inventoryId: 5 }] });
    });
  });
});
