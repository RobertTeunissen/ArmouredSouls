/**
 * Property-based tests for the shared weapon refinement formula module.
 *
 * Validates Properties 1–6 from design.md → Correctness Properties:
 *   1. Slot cap is absolute (≤ 5 per weapon)
 *   2. Per-tier caps for Sharpen and Forge (≤ 2 each)
 *   3. Per-attribute stack cap (catalog + Hone + Augment ≤ +10)
 *   4. Cost formula determinism (pure function)
 *   5. applyRefinementsToWeapon is order-independent (commutative)
 *   6. Cost monotonicity over magnitude / instanceIndex
 *
 * Covers Spec #34 requirement R14.2.
 */

import fc from 'fast-check';
import {
  calculateRefinementCost,
  validateRefinementSlotAvailable,
  validateAttributeStackCap,
  validateAttributeOnWeapon,
  validateShieldCompatibility,
  applyRefinementsToWeapon,
  type RefinementTier,
  type RefinementRow,
  type WeaponLike,
} from '../../shared/utils/weaponRefinement';
import { ROBOT_ATTRIBUTES } from '../../shared/utils/robotAttributes';

// ─── Arbitraries ────────────────────────────────────────────────────

const tierArb = fc.constantFrom<RefinementTier>('hone', 'augment', 'sharpen', 'forge');
const attributeArb = fc.constantFrom(...ROBOT_ATTRIBUTES);
const magnitudeArb = fc.integer({ min: 1, max: 5 });

/**
 * Generates a "refinement attempt" — a tier + magnitude + optional attribute.
 * The validator chain decides whether each attempt is actually applied to the
 * stateful sequence used by Properties 1, 2, and 3.
 */
const attemptArb = fc.record({
  tier: tierArb,
  magnitude: magnitudeArb,
  attribute: attributeArb,
});

const attemptsArb = fc.array(attemptArb, { minLength: 0, maxLength: 30 });

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Apply an arbitrary sequence of refinement attempts through the validators.
 * Mirrors how the route handler in Task 7 will validate each request inside
 * the locked transaction. Skipped attempts produce no state change; accepted
 * attempts append a row.
 *
 * Returns the final accumulated refinement list.
 */
function simulateValidatedSequence(
  attempts: Array<{ tier: RefinementTier; magnitude: number; attribute: string }>,
  weaponType = 'energy',
  catalogBonuses: Record<string, number> = {},
): RefinementRow[] {
  const refinements: RefinementRow[] = [];

  for (const attempt of attempts) {
    const { tier, magnitude, attribute } = attempt;

    // Slot/tier cap.
    const slotCheck = validateRefinementSlotAvailable(refinements, tier);
    if (!slotCheck.ok) continue;

    // Shield compatibility.
    const shieldCheck = validateShieldCompatibility(weaponType, tier);
    if (!shieldCheck.ok) continue;

    // Hone/Augment require attribute checks.
    if (tier === 'hone' || tier === 'augment') {
      const catalogBonus = catalogBonuses[attribute] ?? 0;
      const onCheck = validateAttributeOnWeapon(catalogBonus, refinements, attribute, tier);
      if (!onCheck.ok) continue;

      const stackCheck = validateAttributeStackCap(catalogBonus, refinements, attribute, magnitude);
      if (!stackCheck.ok) continue;

      refinements.push({ tier, magnitude, targetAttribute: attribute });
    } else {
      // Sharpen / Forge: fixed magnitude 1, no attribute.
      refinements.push({ tier, magnitude: 1, targetAttribute: null });
    }
  }

  return refinements;
}

/**
 * Sum the catalog bonus + Hone/Augment magnitudes targeting a given
 * attribute on a given refinement set. Used by Property 3.
 */
function attributeTotal(
  refinements: readonly RefinementRow[],
  attribute: string,
  catalogBonus: number,
): number {
  let total = catalogBonus;
  for (const r of refinements) {
    if ((r.tier === 'hone' || r.tier === 'augment') && r.targetAttribute === attribute) {
      total += r.magnitude;
    }
  }
  return total;
}

// ─── Property 1: Slot cap is absolute ───────────────────────────────

describe('Property 1: Slot cap is absolute', () => {
  it('any sequence of validated refinement attempts produces ≤ 5 refinements', () => {
    fc.assert(
      fc.property(attemptsArb, (attempts) => {
        const refinements = simulateValidatedSequence(attempts);
        return refinements.length <= 5;
      }),
      { numRuns: 200 },
    );
  });
});

// ─── Property 2: Per-tier caps for Sharpen and Forge ────────────────

describe('Property 2: Per-tier caps (Sharpen ≤ 2, Forge ≤ 2)', () => {
  it('any validated sequence has at most 2 sharpen and at most 2 forge', () => {
    fc.assert(
      fc.property(attemptsArb, (attempts) => {
        const refinements = simulateValidatedSequence(attempts);
        const sharpen = refinements.filter((r) => r.tier === 'sharpen').length;
        const forge = refinements.filter((r) => r.tier === 'forge').length;
        return sharpen <= 2 && forge <= 2;
      }),
      { numRuns: 200 },
    );
  });
});

// ─── Property 3: Per-attribute stack cap ────────────────────────────

describe('Property 3: Per-attribute stack cap (catalog + refinements ≤ +10)', () => {
  it('any validated Hone/Augment sequence keeps every attribute total ≤ 10', () => {
    fc.assert(
      fc.property(
        // Pair the attempt list with a random catalog bonus map so the property
        // also exercises non-zero catalog bonuses (more realistic).
        fc.tuple(
          attemptsArb,
          fc.dictionary(attributeArb, fc.integer({ min: 0, max: 5 })),
        ),
        ([attempts, catalogBonuses]) => {
          const refinements = simulateValidatedSequence(attempts, 'energy', catalogBonuses);
          for (const attr of ROBOT_ATTRIBUTES) {
            const total = attributeTotal(refinements, attr, catalogBonuses[attr] ?? 0);
            if (total > 10) return false;
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ─── Property 4: Cost formula determinism ───────────────────────────

describe('Property 4: calculateRefinementCost is a pure function', () => {
  it('same inputs always return the same cost', () => {
    fc.assert(
      fc.property(
        tierArb,
        magnitudeArb,
        fc.integer({ min: 0, max: 1 }),
        (tier, magnitude, instanceIndex) => {
          // Sharpen / Forge ignore magnitude — pass 1.
          const m = tier === 'sharpen' || tier === 'forge' ? 1 : magnitude;
          const a = calculateRefinementCost(tier, m, instanceIndex);
          const b = calculateRefinementCost(tier, m, instanceIndex);
          return a === b && a > 0;
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ─── Property 5: applyRefinementsToWeapon is order-independent ──────

describe('Property 5: applyRefinementsToWeapon is commutative', () => {
  it('any permutation of the refinement set produces identical effective stats', () => {
    // Use a fixed weapon so we focus on the order-independence property.
    const weapon: WeaponLike = {
      baseDamage: 10,
      cooldown: 3,
      combatPowerBonus: 2,
      attackSpeedBonus: 0,
    };

    fc.assert(
      fc.property(
        // Generate a small set of valid refinements through the same simulator
        // we use elsewhere — keeps inputs realistic.
        attemptsArb,
        // A second permutation seed.
        fc.array(fc.integer(), { minLength: 0, maxLength: 30 }),
        (attempts, permutationSeed) => {
          const refinements = simulateValidatedSequence(attempts);
          if (refinements.length < 2) return true; // single-element trivially commutes

          // Build a deterministic permutation from the seed.
          const indices = refinements.map((_, i) => i);
          for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.abs(permutationSeed[i % permutationSeed.length] ?? 0) % (i + 1);
            [indices[i], indices[j]] = [indices[j], indices[i]];
          }
          const permuted = indices.map((i) => refinements[i]);

          const a = applyRefinementsToWeapon(weapon, refinements);
          const b = applyRefinementsToWeapon(weapon, permuted);

          if (a.effectiveBaseDamage !== b.effectiveBaseDamage) return false;
          if (Math.abs(a.effectiveCooldown - b.effectiveCooldown) > 1e-9) return false;

          // Compare attribute maps (ignore floating-point order in serialization).
          const aKeys = Object.keys(a.effectiveAttributeBonuses).sort();
          const bKeys = Object.keys(b.effectiveAttributeBonuses).sort();
          if (aKeys.length !== bKeys.length) return false;
          for (const k of aKeys) {
            if (a.effectiveAttributeBonuses[k] !== b.effectiveAttributeBonuses[k]) return false;
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ─── Property 6: Cost monotonicity ──────────────────────────────────

describe('Property 6: Cost monotonicity', () => {
  it('hone cost(magnitude+1) > cost(magnitude) for magnitude in [1, 4]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), (magnitude) => {
        return calculateRefinementCost('hone', magnitude + 1, 0) >
               calculateRefinementCost('hone', magnitude, 0);
      }),
      { numRuns: 100 },
    );
  });

  it('augment cost(magnitude+1) > cost(magnitude) for magnitude in [1, 4]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), (magnitude) => {
        return calculateRefinementCost('augment', magnitude + 1, 0) >
               calculateRefinementCost('augment', magnitude, 0);
      }),
      { numRuns: 100 },
    );
  });

  it('sharpen cost(instance+1) > cost(instance) for instance 0', () => {
    expect(calculateRefinementCost('sharpen', 1, 1)).toBeGreaterThan(
      calculateRefinementCost('sharpen', 1, 0),
    );
  });

  it('forge cost(instance+1) > cost(instance) for instance 0', () => {
    expect(calculateRefinementCost('forge', 1, 1)).toBeGreaterThan(
      calculateRefinementCost('forge', 1, 0),
    );
  });
});
