/**
 * Weapon pricing formula (app/shared/utils/weaponPricing.ts) — Season 2.
 *
 * 1. Legacy reproduction: the shared DPS part, the old attribute part
 *    Σ(500 × b²) and the old hand multipliers (1.0 / 1.6 / 0.9) reproduce
 *    every price of the pre-Season-2 catalogue (47/47, starters flat ₡50k).
 *    The catalogue is frozen below as a permanent record.
 * 2. New formula: signed sum, m = 500, hands 1.0 / 1.5 / 1.3, starters flat.
 * 3. Every WEAPON_DEFINITIONS cost equals calculateWeaponPrice(def).
 * 4. Refinements are deltas on the catalogue row, so they fold onto the new
 *    Fortress Shield / Aegis Bulwark base values.
 */
import { WEAPON_DEFINITIONS } from '../prisma/seed';
import { ROBOT_ATTRIBUTES } from '../src/shared/utils/robotAttributes';
import type { WeaponBonuses } from '../src/shared/utils/robotStats';
import { applyRefinementsToWeapon } from '../src/shared/utils/weaponRefinement';
import {
  ATTRIBUTE_COST_MULTIPLIER,
  HAND_MULTIPLIERS,
  STARTER_WEAPON_COST,
  WEAPON_BASE_COST,
  calculateWeaponAttributeCost,
  calculateWeaponDpsCost,
  calculateWeaponPrice,
  isStarterWeapon,
  sumWeaponBonuses,
  type WeaponHands,
  type WeaponPricingInput,
} from '../src/shared/utils/weaponPricing';

interface CatalogueSnapshotEntry extends WeaponPricingInput {
  name: string;
  cost: number;
}

/** Pre-Season-2 catalogue (base 0d7e5b51), frozen: name, hands, damage, cooldown, bonuses, cost. */
const PRE_SEASON2_CATALOGUE: readonly CatalogueSnapshotEntry[] = [
  { name: 'Practice Sword', handsRequired: 'one', baseDamage: 6, cooldown: 3, cost: 50000 },
  { name: 'Practice Blaster', handsRequired: 'one', baseDamage: 6, cooldown: 3, cost: 50000 },
  { name: 'Training Rifle', handsRequired: 'two', baseDamage: 6, cooldown: 3, cost: 50000 },
  { name: 'Training Beam', handsRequired: 'two', baseDamage: 6, cooldown: 3, cost: 50000 },
  { name: 'Machine Pistol', handsRequired: 'one', baseDamage: 4.5, cooldown: 2, cost: 94000, attackSpeedBonus: 3, weaponControlBonus: 2 },
  { name: 'Laser Pistol', handsRequired: 'one', baseDamage: 6, cooldown: 3, cost: 57000, targetingSystemsBonus: 3, combatPowerBonus: 2 },
  { name: 'Combat Knife', handsRequired: 'one', baseDamage: 4.5, cooldown: 2, cost: 93000, attackSpeedBonus: 3, gyroStabilizersBonus: 1 },
  { name: 'Light Shield', handsRequired: 'shield', baseDamage: 0, cooldown: 0, cost: 51000, armorPlatingBonus: 3, shieldCapacityBonus: 2 },
  { name: 'Combat Shield', handsRequired: 'shield', baseDamage: 0, cooldown: 0, cost: 78000, armorPlatingBonus: 6, counterProtocolsBonus: 3, evasionThrustersBonus: -2, shieldCapacityBonus: 5 },
  { name: 'Reactive Shield', handsRequired: 'shield', baseDamage: 0, cooldown: 0, cost: 92000, shieldCapacityBonus: 7, counterProtocolsBonus: 6, powerCoreBonus: 4, servoMotorsBonus: -2 },
  { name: 'Machine Gun', handsRequired: 'one', baseDamage: 4.5, cooldown: 2, cost: 107000, combatPowerBonus: 3, attackSpeedBonus: 5, weaponControlBonus: 2 },
  { name: 'Burst Rifle', handsRequired: 'one', baseDamage: 7, cooldown: 3, cost: 117000, attackSpeedBonus: 4, targetingSystemsBonus: 3, criticalSystemsBonus: 3 },
  { name: 'Assault Rifle', handsRequired: 'one', baseDamage: 10, cooldown: 3, cost: 293000, combatPowerBonus: 6, targetingSystemsBonus: 5, weaponControlBonus: 4, attackSpeedBonus: 3 },
  { name: 'Energy Blade', handsRequired: 'one', baseDamage: 8, cooldown: 3, cost: 175000, attackSpeedBonus: 5, hydraulicSystemsBonus: 4, weaponControlBonus: 3 },
  { name: 'Laser Rifle', handsRequired: 'two', baseDamage: 7.5, cooldown: 3, cost: 243000, targetingSystemsBonus: 5, weaponControlBonus: 4, attackSpeedBonus: 3, combatPowerBonus: 2 },
  { name: 'Plasma Blade', handsRequired: 'one', baseDamage: 8.5, cooldown: 3, cost: 202000, hydraulicSystemsBonus: 5, attackSpeedBonus: 4, criticalSystemsBonus: 3, gyroStabilizersBonus: 2 },
  { name: 'Plasma Rifle', handsRequired: 'one', baseDamage: 9.5, cooldown: 3, cost: 258000, combatPowerBonus: 6, targetingSystemsBonus: 4, weaponControlBonus: 3, powerCoreBonus: -2 },
  { name: 'Power Sword', handsRequired: 'one', baseDamage: 10.5, cooldown: 3, cost: 325000, hydraulicSystemsBonus: 7, counterProtocolsBonus: 5, gyroStabilizersBonus: 4, combatPowerBonus: 3 },
  { name: 'Shotgun', handsRequired: 'two', baseDamage: 11, cooldown: 4, cost: 283000, combatPowerBonus: 4, criticalSystemsBonus: 3, targetingSystemsBonus: -2 },
  { name: 'Grenade Launcher', handsRequired: 'two', baseDamage: 13, cooldown: 5, cost: 293000, combatPowerBonus: 6, penetrationBonus: 5, criticalSystemsBonus: 4, targetingSystemsBonus: -3 },
  { name: 'Sniper Rifle', handsRequired: 'two', baseDamage: 17, cooldown: 6, cost: 387000, targetingSystemsBonus: 8, penetrationBonus: 6, criticalSystemsBonus: 5, attackSpeedBonus: -3 },
  { name: 'Battle Axe', handsRequired: 'two', baseDamage: 12.5, cooldown: 4, cost: 402000, hydraulicSystemsBonus: 6, combatPowerBonus: 4, criticalSystemsBonus: 3, servoMotorsBonus: -2 },
  { name: 'Plasma Cannon', handsRequired: 'two', baseDamage: 15, cooldown: 5, cost: 408000, combatPowerBonus: 7, criticalSystemsBonus: 6, penetrationBonus: 4, powerCoreBonus: -3 },
  { name: 'Heavy Hammer', handsRequired: 'two', baseDamage: 16, cooldown: 5, cost: 478000, hydraulicSystemsBonus: 8, combatPowerBonus: 7, criticalSystemsBonus: 4, servoMotorsBonus: -3 },
  { name: 'Railgun', handsRequired: 'two', baseDamage: 18.5, cooldown: 6, cost: 527000, penetrationBonus: 12, targetingSystemsBonus: 7, combatPowerBonus: 5, attackSpeedBonus: -4 },
  { name: 'Ion Beam', handsRequired: 'two', baseDamage: 13, cooldown: 4, cost: 544000, penetrationBonus: 10, combatPowerBonus: 8, attackSpeedBonus: 5, targetingSystemsBonus: 4 },
  { name: 'Vibro Mace', handsRequired: 'one', baseDamage: 8, cooldown: 2, cost: 425000, hydraulicSystemsBonus: 8, combatPowerBonus: 6, counterProtocolsBonus: 5, gyroStabilizersBonus: 4, attackSpeedBonus: 3 },
  { name: 'War Club', handsRequired: 'two', baseDamage: 6, cooldown: 3, cost: 84000, hydraulicSystemsBonus: 2, combatPowerBonus: 1 },
  { name: 'Shock Maul', handsRequired: 'two', baseDamage: 7, cooldown: 3, cost: 183000, hydraulicSystemsBonus: 4, combatPowerBonus: 3, powerCoreBonus: 2 },
  { name: 'Thermal Lance', handsRequired: 'two', baseDamage: 10.5, cooldown: 4, cost: 279000, hydraulicSystemsBonus: 5, combatPowerBonus: 4, criticalSystemsBonus: 4, powerCoreBonus: -2 },
  { name: 'Volt Sabre', handsRequired: 'one', baseDamage: 12, cooldown: 3, cost: 425000, combatPowerBonus: 8, targetingSystemsBonus: 6, weaponControlBonus: 5, attackSpeedBonus: 4, powerCoreBonus: -3 },
  { name: 'Scatter Cannon', handsRequired: 'two', baseDamage: 6, cooldown: 3, cost: 84000, combatPowerBonus: 2, weaponControlBonus: 1 },
  { name: 'Pulse Accelerator', handsRequired: 'two', baseDamage: 10.5, cooldown: 4, cost: 273000, combatPowerBonus: 5, targetingSystemsBonus: 4, weaponControlBonus: 3, attackSpeedBonus: -2 },
  { name: 'Arc Projector', handsRequired: 'two', baseDamage: 13, cooldown: 4, cost: 488000, combatPowerBonus: 7, targetingSystemsBonus: 6, criticalSystemsBonus: 5, penetrationBonus: 4, attackSpeedBonus: -3 },
  { name: 'Bolt Carbine', handsRequired: 'one', baseDamage: 4.5, cooldown: 2, cost: 93000, targetingSystemsBonus: 3, weaponControlBonus: 1 },
  { name: 'Flux Repeater', handsRequired: 'one', baseDamage: 7.5, cooldown: 3, cost: 147000, targetingSystemsBonus: 5, combatPowerBonus: 3, weaponControlBonus: 3 },
  { name: 'Disruptor Cannon', handsRequired: 'one', baseDamage: 10, cooldown: 3, cost: 293000, combatPowerBonus: 6, targetingSystemsBonus: 5, weaponControlBonus: 4, penetrationBonus: 3 },
  { name: 'Nova Caster', handsRequired: 'one', baseDamage: 14, cooldown: 3.5, cost: 425000, combatPowerBonus: 8, targetingSystemsBonus: 6, penetrationBonus: 5, weaponControlBonus: 4, powerCoreBonus: -3 },
  { name: 'Mortar System', handsRequired: 'two', baseDamage: 9, cooldown: 4, cost: 163000, combatPowerBonus: 4, penetrationBonus: 3, targetingSystemsBonus: -2 },
  { name: 'Beam Pistol', handsRequired: 'one', baseDamage: 4.5, cooldown: 2, cost: 93000, targetingSystemsBonus: 3, penetrationBonus: 1 },
  { name: 'Photon Marksman', handsRequired: 'one', baseDamage: 7.5, cooldown: 3, cost: 147000, targetingSystemsBonus: 5, penetrationBonus: 3, combatPowerBonus: 3 },
  { name: 'Gauss Pistol', handsRequired: 'one', baseDamage: 10, cooldown: 3, cost: 291000, targetingSystemsBonus: 6, penetrationBonus: 5, combatPowerBonus: 4, attackSpeedBonus: -2 },
  { name: 'Particle Lance', handsRequired: 'one', baseDamage: 16, cooldown: 4, cost: 425000, targetingSystemsBonus: 8, penetrationBonus: 6, combatPowerBonus: 5, criticalSystemsBonus: 4, attackSpeedBonus: -3 },
  { name: 'Siege Cannon', handsRequired: 'two', baseDamage: 9, cooldown: 4, cost: 163000, targetingSystemsBonus: 4, penetrationBonus: 3, combatPowerBonus: -2 },
  { name: 'Barrier Shield', handsRequired: 'shield', baseDamage: 0, cooldown: 0, cost: 111000, armorPlatingBonus: 8, shieldCapacityBonus: 7, counterProtocolsBonus: 5, evasionThrustersBonus: -3 },
  { name: 'Fortress Shield', handsRequired: 'shield', baseDamage: 0, cooldown: 0, cost: 291000, armorPlatingBonus: 15, shieldCapacityBonus: 14, counterProtocolsBonus: 10, evasionThrustersBonus: -4, servoMotorsBonus: -3 },
  { name: 'Aegis Bulwark', handsRequired: 'shield', baseDamage: 0, cooldown: 0, cost: 409000, armorPlatingBonus: 15, shieldCapacityBonus: 15, counterProtocolsBonus: 14, powerCoreBonus: 11, evasionThrustersBonus: -5, servoMotorsBonus: -4 },
];

const LEGACY_HAND_MULTIPLIERS: Readonly<Record<WeaponHands, number>> = { one: 1.0, two: 1.6, shield: 0.9 };

/** Pre-Season-2 price: shared DPS part + Σ(500 × b²) + old hand multipliers; starters flat. */
function legacyPrice(def: WeaponPricingInput): number {
  if (isStarterWeapon(def)) return STARTER_WEAPON_COST;
  let sumOfSquares = 0;
  for (const attr of ROBOT_ATTRIBUTES) {
    const b = def[`${attr}Bonus` as keyof WeaponBonuses] ?? 0;
    sumOfSquares += b * b;
  }
  const raw =
    (WEAPON_BASE_COST + calculateWeaponDpsCost(def) + 500 * sumOfSquares) *
    LEGACY_HAND_MULTIPLIERS[def.handsRequired];
  return Math.round(raw / 1000) * 1000;
}

const asPricingInput = (def: (typeof WEAPON_DEFINITIONS)[number]): WeaponPricingInput =>
  def as unknown as WeaponPricingInput;

describe('weaponPricing — legacy reproduction (pre-Season-2 catalogue)', () => {
  it('snapshot has all 47 weapons', () => {
    expect(PRE_SEASON2_CATALOGUE).toHaveLength(47);
  });

  it.each(PRE_SEASON2_CATALOGUE.map((e) => [e.name, e] as const))(
    '%s reproduces its pre-Season-2 price',
    (_name, entry) => {
      expect(legacyPrice(entry)).toBe(entry.cost);
    },
  );
});

describe('weaponPricing — formula', () => {
  const oneHanded: WeaponPricingInput = { handsRequired: 'one', baseDamage: 6, cooldown: 3 };

  it('sums bonuses with their sign', () => {
    expect(sumWeaponBonuses({ combatPowerBonus: 6, targetingSystemsBonus: 4, powerCoreBonus: -3 })).toBe(7);
    expect(sumWeaponBonuses({})).toBe(0);
  });

  it('a negative bonus lowers the price (bug fix: penalties used to raise it)', () => {
    const withoutPenalty = calculateWeaponPrice({ ...oneHanded, combatPowerBonus: 6, targetingSystemsBonus: 4 });
    const withPenalty = calculateWeaponPrice({ ...oneHanded, combatPowerBonus: 6, targetingSystemsBonus: 4, powerCoreBonus: -3 });
    expect(withPenalty).toBeLessThan(withoutPenalty);
    expect(calculateWeaponAttributeCost({ combatPowerBonus: 6, targetingSystemsBonus: 4, powerCoreBonus: -3 })).toBe(
      ATTRIBUTE_COST_MULTIPLIER * 7 * 7,
    );
  });

  it('shields have no DPS part', () => {
    const shield: WeaponPricingInput = { handsRequired: 'shield', baseDamage: 0, cooldown: 0, armorPlatingBonus: 3, shieldCapacityBonus: 2 };
    expect(calculateWeaponDpsCost(shield)).toBe(0);
    // (50,000 + 0 + 500 × 25) × 1.3 = 81,250 → 81,000
    expect(calculateWeaponPrice(shield)).toBe(81000);
  });

  it('DPS part is 50,000 × (ratio − 1) × 6 with a 2.0 DPS baseline', () => {
    // 8 / 2 = 4 DPS → ratio 2 → 300,000
    expect(calculateWeaponDpsCost({ handsRequired: 'one', baseDamage: 8, cooldown: 2 })).toBe(300000);
  });

  it('rounds to the nearest ₡1,000', () => {
    // (50,000 + 0 + 500 × 25) × 1.0 = 62,500 → 63,000 (Laser Pistol)
    expect(calculateWeaponPrice({ ...oneHanded, targetingSystemsBonus: 3, combatPowerBonus: 2 })).toBe(63000);
    // (50,000 + 0 + 500 × 9) × 1.5 = 81,750 → 82,000 (War Club)
    expect(calculateWeaponPrice({ ...oneHanded, handsRequired: 'two', hydraulicSystemsBonus: 2, combatPowerBonus: 1 })).toBe(82000);
  });

  it('starters are a flat ₡50,000 for one- and two-handed weapons', () => {
    expect(isStarterWeapon(oneHanded)).toBe(true);
    expect(calculateWeaponPrice(oneHanded)).toBe(STARTER_WEAPON_COST);
    expect(calculateWeaponPrice({ ...oneHanded, handsRequired: 'two' })).toBe(STARTER_WEAPON_COST);
  });

  it('a shield, a bonus or a non-baseline DPS disqualifies the starter rule', () => {
    expect(isStarterWeapon({ handsRequired: 'shield', baseDamage: 0, cooldown: 0 })).toBe(false);
    expect(isStarterWeapon({ ...oneHanded, combatPowerBonus: 1 })).toBe(false);
    expect(isStarterWeapon({ ...oneHanded, baseDamage: 7 })).toBe(false);
  });

  it('applies the hand multipliers 1.0 / 1.5 / 1.3', () => {
    expect(HAND_MULTIPLIERS).toEqual({ one: 1.0, two: 1.5, shield: 1.3 });
    const bonuses = { combatPowerBonus: 4 };
    // (50,000 + 0 + 500 × 16) = 58,000
    expect(calculateWeaponPrice({ ...oneHanded, ...bonuses })).toBe(58000);
    expect(calculateWeaponPrice({ ...oneHanded, ...bonuses, handsRequired: 'two' })).toBe(87000);
    expect(calculateWeaponPrice({ handsRequired: 'shield', baseDamage: 0, cooldown: 0, ...bonuses })).toBe(75000);
  });
});

describe('weaponPricing — catalogue (WEAPON_DEFINITIONS)', () => {
  it('has 47 weapons', () => {
    expect(WEAPON_DEFINITIONS).toHaveLength(47);
  });

  it.each(WEAPON_DEFINITIONS.map((d) => [d.name, d] as const))(
    '%s cost equals calculateWeaponPrice',
    (name, def) => {
      const expected = calculateWeaponPrice(asPricingInput(def));
      if (def.cost !== expected) {
        throw new Error(`${name}: catalogue cost ${def.cost} ≠ calculateWeaponPrice ${expected}`);
      }
      expect(def.cost).toBe(expected);
    },
  );

  it('Fortress Shield ₡380,000 and Aegis Bulwark ₡690,000 with the Season 2 bonuses', () => {
    const fortress = WEAPON_DEFINITIONS.find((d) => d.name === 'Fortress Shield');
    const aegis = WEAPON_DEFINITIONS.find((d) => d.name === 'Aegis Bulwark');
    expect(fortress).toMatchObject({
      cost: 380000,
      armorPlatingBonus: 11,
      shieldCapacityBonus: 10,
      counterProtocolsBonus: 8,
      evasionThrustersBonus: -4,
      servoMotorsBonus: -3,
    });
    expect(aegis).toMatchObject({
      cost: 690000,
      armorPlatingBonus: 11,
      shieldCapacityBonus: 11,
      counterProtocolsBonus: 10,
      powerCoreBonus: 8,
      evasionThrustersBonus: -5,
      servoMotorsBonus: -4,
    });
  });
});

describe('weaponPricing — refinements fold onto the new shield base', () => {
  it.each([
    ['Fortress Shield', 11, 10],
    ['Aegis Bulwark', 11, 11],
  ] as const)('%s + Hone armorPlating +2 → base + 2', (name, base, shieldCapacity) => {
    const def = WEAPON_DEFINITIONS.find((d) => d.name === name);
    expect(def).toBeDefined();
    const result = applyRefinementsToWeapon(
      def as unknown as Parameters<typeof applyRefinementsToWeapon>[0],
      [{ tier: 'hone', magnitude: 2, targetAttribute: 'armorPlating' }],
    );
    expect(result.effectiveAttributeBonuses.armorPlatingBonus).toBe(base + 2);
    expect(result.effectiveAttributeBonuses.shieldCapacityBonus).toBe(shieldCapacity);
  });
});
