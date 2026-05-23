/**
 * Shared weapon refinement formulas.
 *
 * All cost, validation, and effective-stat math for the Weapon Refinement
 * system (Spec #34) lives here so the backend route handler, the combat
 * data-prep path, and the frontend modal/preview UIs all read from a single
 * source of truth. Validators return discriminated unions instead of throwing
 * — the route handler maps validator failures to its own `EconomyError`
 * codes; the frontend renders inline messages from the same shape.
 *
 * All functions are deterministic and parameter-only — no IO, no side
 * effects, no `Math.random`. Inputs are never mutated.
 */

import { ROBOT_ATTRIBUTES, type RobotAttribute } from './robotAttributes';

// ── Type definitions ────────────────────────────────────────────────

/**
 * The four refinement tiers, gated by Weapons Workshop level:
 *  - hone    (Workshop L1): boost an attribute already on the weapon
 *  - augment (Workshop L3): add a brand-new attribute bonus
 *  - sharpen (Workshop L5): -0.25s base cooldown (max 2 instances)
 *  - forge   (Workshop L8): +1.0 base damage (max 2 instances)
 */
export type RefinementTier = 'hone' | 'augment' | 'sharpen' | 'forge';

/**
 * Visual identity label derived from the count of filled refinement slots:
 *  - 0   → null      (no prefix)
 *  - 1-2 → 'Refined'
 *  - 3   → 'Crafted'
 *  - 4   → 'Mastercrafted'
 *  - 5   → 'Legendary'
 */
export type RankPrefix = 'Refined' | 'Crafted' | 'Mastercrafted' | 'Legendary' | null;

/**
 * Minimal shape of a `WeaponRefinement` row needed by the formula module.
 * The Prisma row has additional fields (id, costPaid, slotIndex, createdAt,
 * weaponInventoryId) but the formula code only needs these three.
 */
export interface RefinementRow {
  tier: RefinementTier;
  magnitude: number;
  targetAttribute: string | null;
}

/**
 * Effective combat stats produced by folding refinements onto a weapon.
 * `effectiveAttributeBonuses` is keyed by the catalog field name (e.g.
 * `combatPowerBonus`) so the combat path can write straight back onto the
 * weapon record without a second key transformation.
 */
export interface EffectiveWeaponStats {
  effectiveBaseDamage: number;
  effectiveCooldown: number;
  effectiveAttributeBonuses: Record<string, number>;
}

/**
 * Structural shape `applyRefinementsToWeapon` reads. We deliberately do not
 * import the Prisma `Weapon` type — this module is consumed by frontend code
 * too, and we want to keep imports minimal. Any object with `baseDamage`,
 * `cooldown`, and the per-attribute `<attr>Bonus` integer fields satisfies it.
 */
export interface WeaponLike {
  baseDamage: number;
  cooldown: number;
  // 23 `<attr>Bonus` fields. Indexed access is used to keep this open-shape
  // friendly to both Prisma `Weapon` rows and frontend partial DTOs.
  [key: string]: unknown;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Map a `RobotAttribute` (e.g. `combatPower`) to the catalog field name (`combatPowerBonus`). */
function bonusFieldName(attribute: string): string {
  return `${attribute}Bonus`;
}

/** Read a numeric `<attr>Bonus` field from a weapon-like object, defaulting to 0. */
function readCatalogBonus(weapon: WeaponLike, attribute: string): number {
  const v = weapon[bonusFieldName(attribute)];
  return typeof v === 'number' ? v : 0;
}

/** Sum all magnitudes from prior Hone+Augment refinements for `attribute`. */
function sumRefinementMagnitudes(
  refinements: readonly RefinementRow[],
  attribute: string,
): number {
  let total = 0;
  for (const r of refinements) {
    if ((r.tier === 'hone' || r.tier === 'augment') && r.targetAttribute === attribute) {
      total += r.magnitude;
    }
  }
  return total;
}

// ── Cost ────────────────────────────────────────────────────────────

/**
 * Cost (in credits) for one refinement action.
 *
 * Formulas (per design.md → Components and Interfaces → Shared Formula Module):
 *  - hone:    10_000 × magnitude²       (₡10K, ₡40K, ₡90K, ₡160K, ₡250K)
 *  - augment: 20_000 × magnitude²       (₡20K, ₡80K, ₡180K, ₡320K, ₡500K)
 *  - sharpen: 300_000 × 3^existingInstancesOfTier   (1st: ₡300K, 2nd: ₡900K)
 *  - forge:   400_000 × 3^existingInstancesOfTier   (1st: ₡400K, 2nd: ₡1.2M)
 *
 * For sharpen/forge the magnitude argument MUST be 1 — the cost formula
 * ignores `magnitude` for those tiers, but callers should still pass 1 so
 * audit log payloads are accurate.
 */
export function calculateRefinementCost(
  tier: RefinementTier,
  magnitude: number,
  existingInstancesOfTier: number,
): number {
  switch (tier) {
    case 'hone':
      return 10_000 * magnitude * magnitude;
    case 'augment':
      return 20_000 * magnitude * magnitude;
    case 'sharpen':
      return 300_000 * Math.pow(3, existingInstancesOfTier);
    case 'forge':
      return 400_000 * Math.pow(3, existingInstancesOfTier);
  }
}

/**
 * Magnitude bounds for a tier. Useful for client-side validation and for
 * building the magnitude slider in the frontend modal.
 *
 *  - hone / augment : [1, 5]
 *  - sharpen / forge: [1, 1] (fixed magnitude)
 */
export function getRefinementMagnitudeRange(tier: RefinementTier): [number, number] {
  switch (tier) {
    case 'hone':
    case 'augment':
      return [1, 5];
    case 'sharpen':
    case 'forge':
      return [1, 1];
  }
}

// ── Validators ──────────────────────────────────────────────────────

/** Discriminated-union shape returned by every validator. */
export type ValidatorResult<TOk extends object = object, TCode extends string = string> =
  | ({ ok: true } & TOk)
  | ({ ok: false; code: TCode } & Record<string, unknown>);

/**
 * Reject if the weapon is at the slot cap (5) or the tier-specific cap
 * (Sharpen/Forge limited to 2 instances each).
 */
export function validateRefinementSlotAvailable(
  refinements: readonly RefinementRow[],
  tier: RefinementTier,
):
  | { ok: true }
  | { ok: false; code: 'SLOT_CAP_EXCEEDED'; details: { currentSlotCount: number } }
  | { ok: false; code: 'TIER_CAP_EXCEEDED'; details: { tier: RefinementTier; currentInstances: number; cap: number } } {
  if (refinements.length >= 5) {
    return {
      ok: false,
      code: 'SLOT_CAP_EXCEEDED',
      details: { currentSlotCount: refinements.length },
    };
  }

  if (tier === 'sharpen' || tier === 'forge') {
    const currentInstances = refinements.filter((r) => r.tier === tier).length;
    if (currentInstances >= 2) {
      return {
        ok: false,
        code: 'TIER_CAP_EXCEEDED',
        details: { tier, currentInstances, cap: 2 },
      };
    }
  }

  return { ok: true };
}

/**
 * Reject if combining `addedMagnitude` onto the existing total for
 * `targetAttribute` (catalog bonus + prior Hone+Augment magnitudes) would
 * exceed the per-attribute stack cap of +10.
 */
export function validateAttributeStackCap(
  weaponCatalogBonus: number,
  refinements: readonly RefinementRow[],
  targetAttribute: string,
  addedMagnitude: number,
):
  | { ok: true; newTotal: number }
  | { ok: false; code: 'ATTRIBUTE_STACK_CAP_EXCEEDED'; currentTotal: number; cap: number } {
  const currentTotal = weaponCatalogBonus + sumRefinementMagnitudes(refinements, targetAttribute);
  const newTotal = currentTotal + addedMagnitude;
  if (newTotal > 10) {
    return {
      ok: false,
      code: 'ATTRIBUTE_STACK_CAP_EXCEEDED',
      currentTotal,
      cap: 10,
    };
  }
  return { ok: true, newTotal };
}

/**
 * Hone requires `targetAttribute` to be present on the weapon — either via
 * the catalog bonus (non-zero) or via a prior Augment refinement on the same
 * weapon. Augment requires `targetAttribute` to NOT be on the weapon yet.
 */
export function validateAttributeOnWeapon(
  weaponCatalogBonus: number,
  refinements: readonly RefinementRow[],
  targetAttribute: string,
  tier: 'hone' | 'augment',
):
  | { ok: true }
  | { ok: false; code: 'ATTRIBUTE_NOT_ON_WEAPON' | 'ATTRIBUTE_ALREADY_ON_WEAPON' } {
  const hasPriorAugment = refinements.some(
    (r) => r.tier === 'augment' && r.targetAttribute === targetAttribute,
  );
  const onWeapon = weaponCatalogBonus !== 0 || hasPriorAugment;

  if (tier === 'hone') {
    return onWeapon ? { ok: true } : { ok: false, code: 'ATTRIBUTE_NOT_ON_WEAPON' };
  }
  // tier === 'augment'
  return onWeapon ? { ok: false, code: 'ATTRIBUTE_ALREADY_ON_WEAPON' } : { ok: true };
}

/**
 * Reject Sharpen and Forge on shields. Shields have no `baseDamage`/cooldown
 * to refine (the catalog stores their values for the parry mechanic but the
 * DPS-tier refinements would be meaningless).
 */
export function validateShieldCompatibility(
  weaponType: string,
  tier: RefinementTier,
):
  | { ok: true }
  | { ok: false; code: 'SHIELD_CANNOT_TAKE_DPS_TIER' } {
  if (weaponType === 'shield' && (tier === 'sharpen' || tier === 'forge')) {
    return { ok: false, code: 'SHIELD_CANNOT_TAKE_DPS_TIER' };
  }
  return { ok: true };
}

// ── Effective stats ─────────────────────────────────────────────────

/**
 * Fold all refinements onto the weapon and return its effective stats.
 *
 * - Forge:   +1.0 baseDamage per instance
 * - Sharpen: -0.25 cooldown per instance (no floor — see design.md key
 *            decision #7; the engine's SIMULATION_TICK is the implicit floor)
 * - Hone:    +magnitude on `<targetAttribute>Bonus`
 * - Augment: +magnitude on `<targetAttribute>Bonus` (treated identically to
 *            Hone in the effective-stat fold; the distinction matters only
 *            for validation)
 *
 * `effectiveAttributeBonuses` is seeded with the weapon's catalog bonuses so
 * callers can use it as a complete replacement for the `<attr>Bonus` fields.
 * Pure: never mutates `weapon` or `refinements`.
 */
export function applyRefinementsToWeapon(
  weapon: WeaponLike,
  refinements: readonly RefinementRow[],
): EffectiveWeaponStats {
  let effectiveBaseDamage = weapon.baseDamage;
  let effectiveCooldown = weapon.cooldown;

  // Seed with catalog bonuses for every known attribute so callers always
  // see the full attribute map, even for attributes the weapon contributes 0 to.
  const effectiveAttributeBonuses: Record<string, number> = {};
  for (const attr of ROBOT_ATTRIBUTES) {
    const field = bonusFieldName(attr);
    effectiveAttributeBonuses[field] = readCatalogBonus(weapon, attr);
  }

  for (const r of refinements) {
    if (r.tier === 'forge') {
      effectiveBaseDamage += 1.0;
      continue;
    }
    if (r.tier === 'sharpen') {
      effectiveCooldown -= 0.25;
      continue;
    }
    if (r.tier === 'hone' || r.tier === 'augment') {
      if (!r.targetAttribute) continue;
      const field = bonusFieldName(r.targetAttribute);
      effectiveAttributeBonuses[field] = (effectiveAttributeBonuses[field] ?? 0) + r.magnitude;
    }
  }

  return { effectiveBaseDamage, effectiveCooldown, effectiveAttributeBonuses };
}

// ── Identity (rank prefix + display name) ───────────────────────────

/**
 * Map the count of filled refinement slots to the visual rank prefix.
 * Counts ≤ 0 (defensive) and 0 → `null`. 5+ saturates to `'Legendary'`.
 */
export function calculateRankPrefix(refinementCount: number): RankPrefix {
  if (refinementCount <= 0) return null;
  if (refinementCount <= 2) return 'Refined';
  if (refinementCount === 3) return 'Crafted';
  if (refinementCount === 4) return 'Mastercrafted';
  return 'Legendary'; // 5+
}

/**
 * Canonical display name used everywhere a refined weapon is rendered:
 * `<rank-prefix> <weaponName>` when the weapon has any refinements,
 * else just `<weaponName>`.
 *
 * Custom names are NOT formatted by this function — UI components handle
 * the customName layout (typically a quoted second line).
 */
export function formatWeaponDisplayName(
  weaponName: string,
  refinementCount: number,
): string {
  const prefix = calculateRankPrefix(refinementCount);
  return prefix ? `${prefix} ${weaponName}` : weaponName;
}

// ── Re-export the attribute list for convenience ────────────────────

export { ROBOT_ATTRIBUTES, type RobotAttribute };
