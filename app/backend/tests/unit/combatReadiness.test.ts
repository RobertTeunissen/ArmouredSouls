/**
 * Battle-time combat readiness — T1, T2, T3 (PR #536).
 *
 * The battle-time check runs on the robots actually loaded for a battle. It
 * feeds the shared loadout rule IDs derived from the loaded weapon relations,
 * so a dangling `mainWeaponId` whose relation did not load counts as missing.
 *
 * - T1: `canFight` iff the main weapon relation is present; an incomplete
 *   loadout with a main weapon fights as `single`; the offhand is never
 *   promoted.
 * - T2: a two-sided match: a side forfeits if ANY of its robots cannot fight;
 *   both sides → double forfeit.
 * - T3: placement modes split the field into ready and forfeited, preserving
 *   order; the simulator backstop throws `ROBOT_NOT_BATTLE_READY`.
 */
import * as fc from 'fast-check';
import { Prisma } from '../../generated/prisma';
import type { RobotWithWeapons } from '../../src/services/battle/combatSimulator';
import {
  applyLoadoutFallbacks,
  assertAllRobotsArmed,
  evaluateCombatEntry,
  evaluateMatchEntry,
  partitionPlacementField,
} from '../../src/services/battle/combatReadiness';
import { BattleError, BattleErrorCode } from '../../src/errors/battleErrors';
import { LOADOUT_READINESS_REASONS } from '../../src/shared/utils/loadout-readiness';

// ── Fixtures ────────────────────────────────────────────────────────

type Inventory = NonNullable<RobotWithWeapons['mainWeapon']>;

function inventory(id: number): Inventory {
  return {
    id,
    userId: 1,
    weaponId: id,
    customName: null,
    weapon: { id, name: `Weapon-${id}`, baseDamage: 10 },
  } as unknown as Inventory;
}

interface RobotShape {
  id: number;
  loadoutType: string;
  /** Inventory row loaded with its weapon relation. */
  main: 'loaded' | 'dangling' | 'none';
  offhand: 'loaded' | 'dangling' | 'none';
}

function robot(shape: RobotShape): RobotWithWeapons {
  const mainId = shape.id * 10 + 1;
  const offId = shape.id * 10 + 2;
  return {
    id: shape.id,
    name: `Robot-${shape.id}`,
    loadoutType: shape.loadoutType,
    combatPower: new Prisma.Decimal(10),
    mainWeaponId: shape.main === 'none' ? null : mainId,
    offhandWeaponId: shape.offhand === 'none' ? null : offId,
    mainWeapon:
      shape.main === 'loaded'
        ? inventory(mainId)
        : shape.main === 'dangling'
          ? ({ ...inventory(mainId), weapon: null } as unknown as Inventory)
          : null,
    offhandWeapon:
      shape.offhand === 'loaded'
        ? inventory(offId)
        : shape.offhand === 'dangling'
          ? ({ ...inventory(offId), weapon: null } as unknown as Inventory)
          : null,
  } as unknown as RobotWithWeapons;
}

const COMPLETE_LOADOUTS = ['single', 'two_handed', 'dual_wield', 'weapon_shield'] as const;

const shapeArb = (id: number): fc.Arbitrary<RobotShape> =>
  fc.record({
    id: fc.constant(id),
    loadoutType: fc.oneof(fc.constantFrom(...COMPLETE_LOADOUTS), fc.constantFrom('', 'triple', 'SINGLE')),
    main: fc.constantFrom('loaded', 'dangling', 'none') as fc.Arbitrary<RobotShape['main']>,
    offhand: fc.constantFrom('loaded', 'dangling', 'none') as fc.Arbitrary<RobotShape['offhand']>,
  });

/** The rule as specified, independent of the implementation. */
function expectedReady(shape: RobotShape): boolean {
  const main = shape.main === 'loaded';
  const off = shape.offhand === 'loaded';
  switch (shape.loadoutType) {
    case 'single':
    case 'two_handed':
      return main;
    case 'dual_wield':
    case 'weapon_shield':
      return main && off;
    default:
      return false;
  }
}

// ── T1: evaluateCombatEntry ─────────────────────────────────────────

describe('evaluateCombatEntry (T1)', () => {
  it('canFight iff the main weapon relation is loaded; fallback iff canFight and the loadout is incomplete', () => {
    fc.assert(
      fc.property(shapeArb(1), (shape) => {
        const r = robot(shape);
        const decision = evaluateCombatEntry(r);

        expect(decision.robotId).toBe(1);
        expect(decision.canFight).toBe(r.mainWeapon?.weapon != null);
        if (decision.canFight && !expectedReady(shape)) {
          expect(decision.loadoutFallback).toEqual({ storedLoadout: shape.loadoutType, battleLoadout: 'single' });
        } else {
          expect(decision.loadoutFallback).toBeNull();
        }
        if (expectedReady(shape)) expect(decision.reasons).toEqual([]);
      }),
      { numRuns: 300 },
    );
  });

  it('a complete loadout fights unchanged', () => {
    for (const loadoutType of COMPLETE_LOADOUTS) {
      const decision = evaluateCombatEntry(robot({ id: 2, loadoutType, main: 'loaded', offhand: 'loaded' }));
      expect(decision).toEqual({ robotId: 2, canFight: true, reasons: [], loadoutFallback: null });
    }
  });

  it.each(['dual_wield', 'weapon_shield'])('%s without an offhand falls back to single', (loadoutType) => {
    const decision = evaluateCombatEntry(robot({ id: 3, loadoutType, main: 'loaded', offhand: 'none' }));
    expect(decision.canFight).toBe(true);
    expect(decision.loadoutFallback).toEqual({ storedLoadout: loadoutType, battleLoadout: 'single' });
  });

  it('an unknown loadout string with a main weapon falls back to single', () => {
    const decision = evaluateCombatEntry(robot({ id: 4, loadoutType: 'triple', main: 'loaded', offhand: 'loaded' }));
    expect(decision.canFight).toBe(true);
    expect(decision.reasons).toEqual([LOADOUT_READINESS_REASONS.INVALID_LOADOUT]);
    expect(decision.loadoutFallback).toEqual({ storedLoadout: 'triple', battleLoadout: 'single' });
  });

  it('a dangling mainWeaponId with a null relation cannot fight', () => {
    const decision = evaluateCombatEntry(robot({ id: 5, loadoutType: 'single', main: 'dangling', offhand: 'none' }));
    expect(decision.canFight).toBe(false);
    expect(decision.reasons).toEqual([LOADOUT_READINESS_REASONS.NO_MAIN_WEAPON]);
    expect(decision.loadoutFallback).toBeNull();
  });

  it('never promotes the offhand: a robot with only an offhand cannot fight', () => {
    const decision = evaluateCombatEntry(robot({ id: 6, loadoutType: 'dual_wield', main: 'none', offhand: 'loaded' }));
    expect(decision.canFight).toBe(false);
    expect(decision.reasons).toContain(LOADOUT_READINESS_REASONS.NO_MAIN_WEAPON);
    expect(decision.loadoutFallback).toBeNull();
  });
});

// ── T2: evaluateMatchEntry ──────────────────────────────────────────

describe('evaluateMatchEntry (T2)', () => {
  const sideArb = (firstId: number): fc.Arbitrary<RobotShape[]> =>
    fc.integer({ min: 1, max: 3 }).chain((n) =>
      fc.tuple(...Array.from({ length: n }, (_, i) => shapeArb(firstId + i))),
    );

  it('a side forfeits iff any of its robots cannot fight; both sides → double_forfeit', () => {
    fc.assert(
      fc.property(sideArb(1), sideArb(10), (s1, s2) => {
        const side1 = s1.map(robot);
        const side2 = s2.map(robot);
        const outcome = evaluateMatchEntry(side1, side2);

        const side1Forfeits = s1.some((s) => s.main !== 'loaded');
        const side2Forfeits = s2.some((s) => s.main !== 'loaded');

        expect(outcome.decisions.map((d) => d.robotId)).toEqual([...s1, ...s2].map((s) => s.id));
        if (side1Forfeits && side2Forfeits) {
          expect(outcome).toMatchObject({ kind: 'double_forfeit', forfeitingSides: [1, 2] });
        } else if (side1Forfeits) {
          expect(outcome).toMatchObject({ kind: 'forfeit', forfeitingSides: [1] });
        } else if (side2Forfeits) {
          expect(outcome).toMatchObject({ kind: 'forfeit', forfeitingSides: [2] });
        } else {
          expect(outcome.kind).toBe('fight');
        }
      }),
      { numRuns: 300 },
    );
  });

  it('one unarmed robot forfeits its whole team, even when its teammates are armed (tag team included)', () => {
    const outcome = evaluateMatchEntry(
      [
        robot({ id: 1, loadoutType: 'single', main: 'loaded', offhand: 'none' }),
        robot({ id: 2, loadoutType: 'single', main: 'none', offhand: 'none' }),
      ],
      [
        robot({ id: 3, loadoutType: 'single', main: 'loaded', offhand: 'none' }),
        robot({ id: 4, loadoutType: 'single', main: 'loaded', offhand: 'none' }),
      ],
    );
    expect(outcome.kind).toBe('forfeit');
    if (outcome.kind === 'forfeit') expect(outcome.forfeitingSides).toEqual([1]);
  });

  it('an incomplete loadout is not a forfeit', () => {
    const outcome = evaluateMatchEntry(
      [robot({ id: 1, loadoutType: 'dual_wield', main: 'loaded', offhand: 'none' })],
      [robot({ id: 2, loadoutType: 'single', main: 'loaded', offhand: 'none' })],
    );
    expect(outcome.kind).toBe('fight');
    expect(outcome.decisions[0].loadoutFallback).not.toBeNull();
  });
});

// ── T3: partitionPlacementField and assertAllRobotsArmed ────────────

describe('partitionPlacementField (T3)', () => {
  it('is an exact, order-preserving partition by canFight', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }).chain((n) =>
          fc.tuple(...Array.from({ length: n }, (_, i) => shapeArb(i + 1))),
        ),
        (shapes: RobotShape[]) => {
          const field = shapes.map(robot);
          const { ready, forfeited, decisions } = partitionPlacementField(field);

          expect(ready).toEqual(field.filter((r) => r.mainWeapon?.weapon != null));
          expect(forfeited).toEqual(field.filter((r) => r.mainWeapon?.weapon == null));
          expect(ready.length + forfeited.length).toBe(field.length);
          // Same object identities: callers keep working on the loaded robots.
          for (const r of [...ready, ...forfeited]) expect(field).toContain(r);
          expect(decisions.map((d) => d.robotId)).toEqual(field.map((r) => r.id));
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('applyLoadoutFallbacks', () => {
  it('sets single in memory only for robots with a fallback and returns their ids', () => {
    const incomplete = robot({ id: 1, loadoutType: 'weapon_shield', main: 'loaded', offhand: 'none' });
    const complete = robot({ id: 2, loadoutType: 'dual_wield', main: 'loaded', offhand: 'loaded' });
    const robots = [incomplete, complete];
    const decisions = robots.map(evaluateCombatEntry);

    expect(applyLoadoutFallbacks(robots, decisions)).toEqual([1]);
    expect(incomplete.loadoutType).toBe('single');
    expect(complete.loadoutType).toBe('dual_wield');
  });
});

describe('assertAllRobotsArmed (T3 backstop)', () => {
  it('passes when every robot has a main weapon', () => {
    expect(() =>
      assertAllRobotsArmed([
        robot({ id: 1, loadoutType: 'single', main: 'loaded', offhand: 'none' }),
        robot({ id: 2, loadoutType: 'dual_wield', main: 'loaded', offhand: 'none' }),
      ]),
    ).not.toThrow();
  });

  it('throws BattleError ROBOT_NOT_BATTLE_READY (500) naming every weaponless robot', () => {
    let caught: unknown;
    try {
      assertAllRobotsArmed([
        robot({ id: 1, loadoutType: 'single', main: 'loaded', offhand: 'none' }),
        robot({ id: 2, loadoutType: 'single', main: 'none', offhand: 'none' }),
        robot({ id: 3, loadoutType: 'single', main: 'dangling', offhand: 'none' }),
      ]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BattleError);
    const err = caught as BattleError;
    expect(err.code).toBe(BattleErrorCode.ROBOT_NOT_BATTLE_READY);
    expect(err.statusCode).toBe(500);
    expect(err.details).toEqual({ robotIds: [2, 3] });
  });
});
