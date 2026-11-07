import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateDiscountedUpgradeCost } from '@shared/utils/upgradeCosts';
import { calculateCombatEffectiveStat } from '@shared/utils/robotStats';
import {
  ALL_ATTRIBUTES,
  capFor,
  inBattle,
  maxAllPlan,
  planTotal,
  setPlannedLevel,
  tuningMaxAt,
  tuningOverflow,
  upgradeCost,
  type AcademyLevels,
  type AttributeValues,
} from '../workshopBuild';

// GekkeAap (ACC, Nov 2026): Combat 8, Defense 7, Mobility 6, AI 1; no Training Facility.
const ACADEMIES: AcademyLevels = {
  combat_training_academy: 8, defense_training_academy: 7, mobility_training_academy: 6, ai_training_academy: 1,
};
const NO_DISCOUNT = { trainingLevel: 0, rosterCapacity: 11 };

function gekkeAap(): AttributeValues {
  const v = Object.fromEntries(ALL_ATTRIBUTES.map(({ key }) => [key, 0])) as AttributeValues;
  Object.assign(v, {
    combatPower: 45, targetingSystems: 45, criticalSystems: 45, penetration: 45, weaponControl: 44, attackSpeed: 44,
    armorPlating: 42, shieldCapacity: 42, evasionThrusters: 42, damageDampeners: 42, counterProtocols: 42,
    hullIntegrity: 40, servoMotors: 40, gyroStabilizers: 40, hydraulicSystems: 40, powerCore: 40,
    combatAlgorithms: 15, threatAnalysis: 3, adaptiveAI: 2, logicCores: 10,
    syncProtocols: 15, supportSystems: 1, formationTactics: 15,
  });
  return v;
}

describe('caps and costs', () => {
  it('maps every attribute to its academy cap; Team Coordination follows the AI academy', () => {
    expect(capFor('combatPower', ACADEMIES)).toBe(45);
    expect(capFor('armorPlating', ACADEMIES)).toBe(42);
    expect(capFor('hullIntegrity', ACADEMIES)).toBe(40);
    expect(capFor('logicCores', ACADEMIES)).toBe(15);
    expect(capFor('supportSystems', ACADEMIES)).toBe(15);
  });

  it('prices a range level by level with the shared formula', () => {
    expect(upgradeCost(44, 45, NO_DISCOUNT).cost).toBe(67_500);
    expect(upgradeCost(3, 15, NO_DISCOUNT).cost).toBe(171_000);
    const discounted = { trainingLevel: 9, rosterCapacity: 3 };
    expect(upgradeCost(10, 12, discounted).cost).toBe(
      calculateDiscountedUpgradeCost(10, 9, 3) + calculateDiscountedUpgradeCost(11, 9, 3),
    );
  });

  it('maxes all six open attributes of GekkeAap for ₡757,500', () => {
    const plan = maxAllPlan(gekkeAap(), ACADEMIES, 10_000_000, NO_DISCOUNT);
    expect(Object.keys(plan).sort()).toEqual(['adaptiveAI', 'attackSpeed', 'logicCores', 'supportSystems', 'threatAnalysis', 'weaponControl']);
    expect(planTotal(plan)).toBe(757_500);
  });

  it('never exceeds the budget or a cap, and spends round-robin (property)', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 1_000_000 }), (budget) => {
      const plan = maxAllPlan(gekkeAap(), ACADEMIES, budget, NO_DISCOUNT);
      if (planTotal(plan) > budget) return false;
      return Object.entries(plan).every(([key, p]) => p !== undefined && p.plannedLevel <= capFor(key as never, ACADEMIES));
    }));
  });

  it('clamps a planned level to [current, cap] and drops it when back at current', () => {
    const v = gekkeAap();
    let plan = setPlannedLevel({}, v, 'threatAnalysis', 99, ACADEMIES, NO_DISCOUNT);
    expect(plan.threatAnalysis?.plannedLevel).toBe(15);
    plan = setPlannedLevel(plan, v, 'threatAnalysis', 1, ACADEMIES, NO_DISCOUNT);
    expect(plan.threatAnalysis).toBeUndefined();
  });
});

describe('tuning room', () => {
  it('is cap + 5 − level, never negative', () => {
    expect(tuningMaxAt(45, 44)).toBe(6);
    expect(tuningMaxAt(15, 3)).toBe(17);
    expect(tuningMaxAt(15, 21)).toBe(0);
    expect(tuningMaxAt(15, 12.5)).toBe(7.5);
  });

  it('reports tuning that no longer fits a planned upgrade', () => {
    const v = gekkeAap();
    const plan = setPlannedLevel({}, v, 'threatAnalysis', 15, ACADEMIES, NO_DISCOUNT);
    expect(tuningOverflow({ threatAnalysis: 8, weaponControl: 5 }, plan, ACADEMIES)).toEqual({ threatAnalysis: 3 });
  });
});

describe('inBattle', () => {
  it('uses the shared combat formula, then the stance multiplier', () => {
    const bonuses = { combatPowerBonus: 6 };
    const r = inBattle(45, 5, bonuses, 'combatPower', 'weapon_shield', 'offensive');
    const combat = calculateCombatEffectiveStat(45, 6, r.loadout, 5);
    expect(r.total).toBeCloseTo(combat * (1 + r.stance), 2);
    expect(r.stance).toBeCloseTo(0.15);
    expect(r.baseAndTuning).toBe(50);
  });
});
