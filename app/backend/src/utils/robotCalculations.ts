/**
 * Robot stat calculations for the backend (combat simulation, HP/shield derivation).
 *
 * Constants (LOADOUT_BONUSES, STANCE_MODIFIERS, BASE_HP, HP_MULTIPLIER) and the
 * canonical effective-attribute formula (`calculateCombatEffectiveStats`) live in the
 * shared module — single source of truth for both frontend and backend (#517).
 *
 * Canonical formula, 2-decimal combat precision:
 *   effective = round2((base + mainWeaponBonus + offhandWeaponBonus + tuning) × (1 + loadoutBonus))
 *
 * `calculateEffectiveStats` and `prepareRobotForCombat` both use it, so the values the
 * simulator reads equal the values the stat screens show (the frontend's integer display
 * is `Math.floor` of the same combat value).
 */

import { Robot, WeaponInventory, Weapon, Prisma } from '../../generated/prisma';
import { toNumber } from '../lib/prismaHelpers';
import { ROBOT_ATTRIBUTES } from '../shared/utils/robotAttributes';
import type { TuningAttributeMap } from '../services/tuning-pool';
import type { CombatBuildSnapshot, CombatWeaponSnapshot } from '../types/combatBuildTypes';
import {
  applyRefinementsToWeapon,
  type RefinementRow,
  type RefinementTier,
} from '../shared/utils/weaponRefinement';

// Re-export shared constants so existing consumers don't need to change import paths
export {
  LOADOUT_BONUSES,
  STANCE_MODIFIERS,
  BASE_HP,
  HP_MULTIPLIER,
  SHIELD_MULTIPLIER,
  getLoadoutBonus,
  getLoadoutModifiedAttributes,
  getStanceModifier,
  isValidStance,
  isValidYieldThreshold,
} from '../shared/utils/robotStats';

import {
  STANCE_MODIFIERS,
  maxHPFromHullIntegrity,
  SHIELD_MULTIPLIER,
  calculateCombatEffectiveStats,
  roundToCombatPrecision,
  type RobotStatsInput,
  type WeaponInventoryLike,
} from '../shared/utils/robotStats';

type RobotWithWeapons = Robot & {
  mainWeapon?: (WeaponInventory & { weapon: Weapon }) | null;
  offhandWeapon?: (WeaponInventory & { weapon: Weapon }) | null;
};

/**
 * Non-enumerable marker set on a robot object once `prepareRobotForCombat` has written
 * effective values onto it. Invisible to JSON, object spread, Prisma and Jest equality.
 */
const COMBAT_PREPARED = Symbol('combatPrepared');

/**
 * Non-enumerable marker set on a weapon-inventory row once its refinements have been
 * folded into its `weapon` object. Set on the inventory row (not the weapon object) so
 * a catalog weapon object shared between rows is never mistaken for folded.
 */
const REFINEMENTS_FOLDED = Symbol('refinementsFolded');

function markNonEnumerable(target: object, marker: symbol): void {
  Object.defineProperty(target, marker, { value: true, enumerable: false, configurable: true });
}

/**
 * Whether `prepareRobotForCombat` has already run on this robot object.
 */
export function isPreparedForCombat(robot: object): boolean {
  return (robot as Record<symbol, unknown>)[COMBAT_PREPARED] === true;
}

/**
 * Convert a Prisma robot (Decimal attributes) to the shared calculation input shape.
 * Weapons are passed through; their bonus fields are already plain numbers.
 */
function toStatsInput(robot: RobotWithWeapons): RobotStatsInput {
  const input: Record<string, unknown> = {
    loadoutType: robot.loadoutType,
    mainWeapon: (robot.mainWeapon ?? null) as WeaponInventoryLike | null,
    offhandWeapon: (robot.offhandWeapon ?? null) as WeaponInventoryLike | null,
  };
  for (const attr of ROBOT_ATTRIBUTES) {
    input[attr] = toNumber(robot[attr as keyof Robot] as number | Prisma.Decimal);
  }
  return input as unknown as RobotStatsInput;
}

/**
 * Calculate effective stats for a robot including base attributes,
 * weapon bonuses (main + offhand), optional tuning bonuses, and loadout modifiers.
 *
 * Delegates to the shared canonical `calculateCombatEffectiveStats`:
 *   round2((base + weaponBonus + tuningBonus) × (1 + loadoutBonus))
 *
 * Reads the weapon objects as they are: on a raw robot that is the catalog bonus;
 * after `prepareRobotForCombat` it includes folded refinements.
 *
 * @param robot - Robot with optional weapon includes
 * @param tuningBonuses - Optional sparse map of attribute → tuning bonus value
 */
export function calculateEffectiveStats(robot: RobotWithWeapons, tuningBonuses?: TuningAttributeMap): Record<string, number> {
  return calculateCombatEffectiveStats(toStatsInput(robot), tuningBonuses);
}

/**
 * Prepare a robot for combat by computing all 23 effective attribute values
 * and writing them directly onto the robot object. The combat simulator reads
 * them with `Number(robot.attackSpeed)` etc. and never re-derives them.
 *
 * Steps:
 * 1. Fold weapon refinements (Spec #34) into each equipped weapon's stats.
 * 2. Compute every attribute with the canonical shared formula (#517), from the
 *    raw base values: round2((base + both weapons' bonuses + tuning) × (1 + loadout)).
 *    The loadout multiplier is applied exactly once. Stance modifiers are NOT applied
 *    here — stance effects are formula-level in the simulator.
 * 3. Write the effective values onto the robot, then derive
 *    `maxHP = BASE_HP + hullIntegrity × HP_MULTIPLIER` and
 *    `maxShield = shieldCapacity × SHIELD_MULTIPLIER` from them.
 * 4. Set `currentHP = maxHP` and `currentShield = maxShield` — every battle mode
 *    enters combat at full health. Tag-team carry-over between phases is handled
 *    by the tag-team simulation after preparation.
 *
 * Input contract: a raw robot freshly loaded from the database or freshly
 * constructed (e.g. a sparring partner). Never pass a spread copy of a prepared
 * robot: the copy loses the marker and its effective values would be treated as base.
 *
 * Idempotent: calling it again on the same robot object is a no-op — attributes are
 * not compounded, refinements are not re-folded, `currentHP`/`currentShield` are left
 * untouched, and the `tuningBonuses` argument is ignored.
 *
 * @param robot - Robot with optional weapon includes (mutated in place)
 * @param tuningBonuses - Optional sparse map of attribute → tuning bonus value
 */
export function prepareRobotForCombat(
  robot: RobotWithWeapons,
  tuningBonuses?: TuningAttributeMap,
): void {
  if (isPreparedForCombat(robot)) return;

  // Battle-time build (admin "what wins" analysis): base levels before they are
  // overwritten below, and the weapons with their refinements before folding.
  const baseAttributes: Record<string, number> = {};
  for (const attr of ROBOT_ATTRIBUTES) {
    baseAttributes[attr] = toNumber(robot[attr as keyof Robot] as number | Prisma.Decimal);
  }
  const mainWeapon = weaponSnapshot(robot.mainWeapon ?? null);
  const offhandWeapon = weaponSnapshot(robot.offhandWeapon ?? null);

  // Spec #34: Fold weapon refinements into the weapon's effective stats here.
  foldWeaponRefinements(robot.mainWeapon ?? null);
  foldWeaponRefinements(robot.offhandWeapon ?? null);

  // Store tuning bonuses on the robot for downstream access
  (robot as RobotWithWeapons & { tuningBonuses?: TuningAttributeMap }).tuningBonuses = tuningBonuses ?? {};

  // Compute ALL effective values from the raw base values before writing any of them.
  const effective = calculateEffectiveStats(robot, tuningBonuses);

  // Write effective values back — combat simulator reads with Number()
  for (const attr of ROBOT_ATTRIBUTES) {
    (robot as Record<string, unknown>)[attr] = effective[attr];
  }

  robot.maxHP = maxHPFromHullIntegrity(effective.hullIntegrity);
  robot.maxShield = effective.shieldCapacity * SHIELD_MULTIPLIER;

  // Robots enter combat at full health
  robot.currentHP = robot.maxHP;
  robot.currentShield = robot.maxShield;

  combatBuilds.set(robot, {
    baseAttributes,
    tuning: { ...(tuningBonuses ?? {}) } as Record<string, number>,
    effectiveAttributes: Object.fromEntries(ROBOT_ATTRIBUTES.map((attr) => [attr, Number(effective[attr])])),
    mainWeapon,
    offhandWeapon,
    loadoutType: robot.loadoutType,
    stance: robot.stance,
    yieldThreshold: robot.yieldThreshold,
  });

  markNonEnumerable(robot, COMBAT_PREPARED);
}

/**
 * Battle-time builds of prepared robots, keyed by the robot object. A WeakMap so
 * a robot object that is dropped takes its build with it; a spread copy has no
 * entry (the same contract as the prepared marker).
 */
const combatBuilds = new WeakMap<object, CombatBuildSnapshot>();

/** The battle-time build `prepareRobotForCombat` captured for this robot object, if any. */
export function getCombatBuild(robot: object): CombatBuildSnapshot | null {
  return combatBuilds.get(robot) ?? null;
}

function weaponSnapshot(
  inventory: (WeaponInventory & { refinements?: Array<{ tier: string; magnitude: number; targetAttribute: string | null }> }) | null,
): CombatWeaponSnapshot | null {
  if (!inventory) return null;
  return {
    weaponId: inventory.weaponId,
    refinements: (inventory.refinements ?? []).map((r) => ({
      tier: r.tier,
      magnitude: Number(r.magnitude),
      targetAttribute: r.targetAttribute,
    })),
  };
}

/**
 * Spec #34 — Fold a weapon-inventory row's refinements into the weapon record's
 * effective stats. Mutates the inventory's `weapon` object in place so downstream
 * readers see the post-refinement values. Folds at most once per inventory row.
 */
function foldWeaponRefinements(
  inventory:
    | (WeaponInventory & {
        weapon?: Weapon;
        refinements?: Array<{ tier: string; magnitude: number; targetAttribute: string | null }>;
      })
    | null,
): void {
  if (!inventory?.weapon) return;
  if ((inventory as unknown as Record<symbol, unknown>)[REFINEMENTS_FOLDED] === true) return;
  markNonEnumerable(inventory, REFINEMENTS_FOLDED);

  const refinements: RefinementRow[] = (inventory.refinements ?? []).map((r) => ({
    tier: r.tier as RefinementTier,
    magnitude: r.magnitude,
    targetAttribute: r.targetAttribute,
  }));

  // Always attach markers so consumers can rely on them being present.
  const markerTarget = inventory.weapon as unknown as Record<string, unknown>;
  markerTarget.__refinementCount = refinements.length;
  markerTarget.__customName = inventory.customName ?? null;

  if (refinements.length === 0) return;

  const effective = applyRefinementsToWeapon(inventory.weapon, refinements);

  // Overwrite catalog values with effective ones.
  const writable = inventory.weapon as unknown as Record<string, unknown>;
  writable.baseDamage = effective.effectiveBaseDamage;
  writable.cooldown = effective.effectiveCooldown;

  for (const [field, value] of Object.entries(effective.effectiveAttributeBonuses)) {
    writable[field] = value;
  }
}

/**
 * Calculate maximum HP based on hull integrity, weapon bonuses, tuning bonuses, and loadout.
 * Formula: BASE_HP + (hullIntegrity × HP_MULTIPLIER)
 */
export function calculateMaxHP(robot: RobotWithWeapons, tuningBonuses?: TuningAttributeMap): number {
  const effectiveStats = calculateEffectiveStats(robot, tuningBonuses);
  return maxHPFromHullIntegrity(effectiveStats.hullIntegrity);
}

/**
 * Calculate maximum Shield based on shield capacity, weapon bonuses, tuning bonuses, and loadout.
 */
export function calculateMaxShield(robot: RobotWithWeapons, tuningBonuses?: TuningAttributeMap): number {
  const effectiveStats = calculateEffectiveStats(robot, tuningBonuses);
  return effectiveStats.shieldCapacity * SHIELD_MULTIPLIER;
}

/**
 * Calculate effective stats including stance modifiers.
 * Stance modifiers are applied after loadout modifiers.
 */
export function calculateEffectiveStatsWithStance(robot: RobotWithWeapons, tuningBonuses?: TuningAttributeMap): Record<string, number> {
  // First get base effective stats with weapons, tuning, and loadout
  const baseEffectiveStats = calculateEffectiveStats(robot, tuningBonuses);

  // Apply stance modifiers
  const stance = robot.stance as keyof typeof STANCE_MODIFIERS;
  const stanceModifiers = STANCE_MODIFIERS[stance] || STANCE_MODIFIERS.balanced;

  const effectiveStatsWithStance: Record<string, number> = { ...baseEffectiveStats };

  // Apply stance modifiers to relevant attributes
  for (const [attr, modifier] of Object.entries(stanceModifiers)) {
    if (attr === 'shieldRegen') {
      // shieldRegen is a special case — modifies powerCore for regeneration calculations only
      continue;
    }

    if (effectiveStatsWithStance[attr] !== undefined && typeof modifier === 'number') {
      const multiplier = 1 + modifier;
      effectiveStatsWithStance[attr] = roundToCombatPrecision(effectiveStatsWithStance[attr] * multiplier);
    }
  }

  return effectiveStatsWithStance;
}

/**
 * Repair pricing used to live here, alongside a second
 * declaration in `app/shared/utils/repairCost.ts` and a third inline in the
 * frontend's `YieldThresholdSlider.tsx`. Spec #48 Requirement 15 consolidated all
 * three into the shared module.
 *
 * Import `calculateRepairQuote` and `applyManualRepairDiscount` from
 * `../shared/utils/repairCost` instead. It is deliberately NOT re-exported under
 * the old name: that would keep the six-argument positional signature — including
 * a dead `_medicalBayLevel` placeholder — alive in the backend, and that shape is
 * what made the double-discount bug in `routes/robots.ts` easy to write.
 *
 * `calculateAttributeSum` below stays: it sums attributes rather than performing
 * arithmetic on the sum, so it is not part of the repair formula.
 */

/**
 * Calculate sum of all 23 robot attributes.
 */
export function calculateAttributeSum(robot: Robot): number {
  let sum = 0;
  for (const attr of ROBOT_ATTRIBUTES) {
    sum += toNumber(robot[attr as keyof Robot] as number | Prisma.Decimal);
  }
  return roundToCombatPrecision(sum);
}
