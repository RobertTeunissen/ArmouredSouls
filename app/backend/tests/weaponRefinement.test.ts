/**
 * Unit tests for the shared weapon refinement formula module
 * (`app/shared/utils/weaponRefinement.ts`).
 *
 * Covers Spec #34 (Weapon Refinement) requirements R2.1 through R2.11 and
 * R14.1. Property-based tests covering Properties 1–6 from design.md live
 * in the sibling file `weaponRefinement.property.test.ts`.
 */

import {
  calculateRefinementCost,
  getRefinementMagnitudeRange,
  validateRefinementSlotAvailable,
  validateAttributeStackCap,
  validateAttributeOnWeapon,
  validateShieldCompatibility,
  applyRefinementsToWeapon,
  calculateRankPrefix,
  formatWeaponDisplayName,
  type RefinementRow,
  type WeaponLike,
} from '../../shared/utils/weaponRefinement';

// ─── calculateRefinementCost ────────────────────────────────────────

describe('calculateRefinementCost', () => {
  describe('hone (10_000 × magnitude²)', () => {
    it.each([
      [1, 10_000],
      [2, 40_000],
      [3, 90_000],
      [4, 160_000],
      [5, 250_000],
    ])('magnitude %i → ₡%i', (magnitude, expected) => {
      // existingInstancesOfTier is ignored for hone, but pass 0 for clarity
      expect(calculateRefinementCost('hone', magnitude, 0)).toBe(expected);
    });

    it('ignores existingInstancesOfTier (cost depends on magnitude only)', () => {
      expect(calculateRefinementCost('hone', 3, 0)).toBe(90_000);
      expect(calculateRefinementCost('hone', 3, 4)).toBe(90_000);
    });
  });

  describe('augment (20_000 × magnitude²)', () => {
    it.each([
      [1, 20_000],
      [2, 80_000],
      [3, 180_000],
      [4, 320_000],
      [5, 500_000],
    ])('magnitude %i → ₡%i', (magnitude, expected) => {
      expect(calculateRefinementCost('augment', magnitude, 0)).toBe(expected);
    });
  });

  describe('sharpen (300_000 × 3^instanceIndex)', () => {
    it.each([
      [0, 300_000],
      [1, 900_000],
    ])('instance %i → ₡%i', (instance, expected) => {
      expect(calculateRefinementCost('sharpen', 1, instance)).toBe(expected);
    });
  });

  describe('forge (400_000 × 3^instanceIndex)', () => {
    it.each([
      [0, 400_000],
      [1, 1_200_000],
    ])('instance %i → ₡%i', (instance, expected) => {
      expect(calculateRefinementCost('forge', 1, instance)).toBe(expected);
    });
  });
});

// ─── getRefinementMagnitudeRange ────────────────────────────────────

describe('getRefinementMagnitudeRange', () => {
  it('hone → [1, 5]', () => {
    expect(getRefinementMagnitudeRange('hone')).toEqual([1, 5]);
  });
  it('augment → [1, 5]', () => {
    expect(getRefinementMagnitudeRange('augment')).toEqual([1, 5]);
  });
  it('sharpen → [1, 1] (fixed magnitude)', () => {
    expect(getRefinementMagnitudeRange('sharpen')).toEqual([1, 1]);
  });
  it('forge → [1, 1] (fixed magnitude)', () => {
    expect(getRefinementMagnitudeRange('forge')).toEqual([1, 1]);
  });
});

// ─── validateRefinementSlotAvailable ────────────────────────────────

describe('validateRefinementSlotAvailable', () => {
  const empty: RefinementRow[] = [];

  it('empty inventory + any tier → ok', () => {
    expect(validateRefinementSlotAvailable(empty, 'hone')).toEqual({ ok: true });
    expect(validateRefinementSlotAvailable(empty, 'augment')).toEqual({ ok: true });
    expect(validateRefinementSlotAvailable(empty, 'sharpen')).toEqual({ ok: true });
    expect(validateRefinementSlotAvailable(empty, 'forge')).toEqual({ ok: true });
  });

  it('5 refinements + any tier → SLOT_CAP_EXCEEDED', () => {
    const full: RefinementRow[] = [
      { tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' },
      { tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' },
      { tier: 'augment', magnitude: 1, targetAttribute: 'attackSpeed' },
      { tier: 'sharpen', magnitude: 1, targetAttribute: null },
      { tier: 'forge', magnitude: 1, targetAttribute: null },
    ];
    const result = validateRefinementSlotAvailable(full, 'hone');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SLOT_CAP_EXCEEDED');
    }
  });

  it('2 sharpen + sharpen → TIER_CAP_EXCEEDED', () => {
    const refs: RefinementRow[] = [
      { tier: 'sharpen', magnitude: 1, targetAttribute: null },
      { tier: 'sharpen', magnitude: 1, targetAttribute: null },
    ];
    const result = validateRefinementSlotAvailable(refs, 'sharpen');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('TIER_CAP_EXCEEDED');
    }
  });

  it('2 forge + forge → TIER_CAP_EXCEEDED', () => {
    const refs: RefinementRow[] = [
      { tier: 'forge', magnitude: 1, targetAttribute: null },
      { tier: 'forge', magnitude: 1, targetAttribute: null },
    ];
    const result = validateRefinementSlotAvailable(refs, 'forge');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('TIER_CAP_EXCEEDED');
    }
  });

  it('2 sharpen + hone → ok (hone has no per-tier cap)', () => {
    const refs: RefinementRow[] = [
      { tier: 'sharpen', magnitude: 1, targetAttribute: null },
      { tier: 'sharpen', magnitude: 1, targetAttribute: null },
    ];
    expect(validateRefinementSlotAvailable(refs, 'hone')).toEqual({ ok: true });
  });

  it('2 forge + augment → ok (augment has no per-tier cap)', () => {
    const refs: RefinementRow[] = [
      { tier: 'forge', magnitude: 1, targetAttribute: null },
      { tier: 'forge', magnitude: 1, targetAttribute: null },
    ];
    expect(validateRefinementSlotAvailable(refs, 'augment')).toEqual({ ok: true });
  });
});

// ─── validateAttributeStackCap ──────────────────────────────────────

describe('validateAttributeStackCap', () => {
  const noRefs: RefinementRow[] = [];

  it('under-cap (catalog +5, no refinements, +3) → ok, newTotal=8', () => {
    const result = validateAttributeStackCap(5, noRefs, 'combatPower', 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newTotal).toBe(8);
    }
  });

  it('exactly-at-cap (catalog +5, no refinements, +5) → ok, newTotal=10', () => {
    const result = validateAttributeStackCap(5, noRefs, 'combatPower', 5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newTotal).toBe(10);
    }
  });

  it('over-cap (catalog +5, no refinements, +6) → not ok, currentTotal=5', () => {
    const result = validateAttributeStackCap(5, noRefs, 'combatPower', 6);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('ATTRIBUTE_STACK_CAP_EXCEEDED');
      expect(result.currentTotal).toBe(5);
    }
  });

  it('mixed contributions (catalog +3, hone +2, augment +3, +3) → not ok, currentTotal=8', () => {
    const refs: RefinementRow[] = [
      { tier: 'hone', magnitude: 2, targetAttribute: 'combatPower' },
      { tier: 'augment', magnitude: 3, targetAttribute: 'combatPower' },
    ];
    const result = validateAttributeStackCap(3, refs, 'combatPower', 3);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('ATTRIBUTE_STACK_CAP_EXCEEDED');
      expect(result.currentTotal).toBe(8);
    }
  });

  it('only counts refinements matching the targetAttribute', () => {
    const refs: RefinementRow[] = [
      { tier: 'hone', magnitude: 5, targetAttribute: 'attackSpeed' }, // unrelated
      { tier: 'augment', magnitude: 4, targetAttribute: 'combatPower' },
    ];
    const result = validateAttributeStackCap(2, refs, 'combatPower', 3);
    // total = 2 (catalog) + 4 (augment) + 3 (added) = 9 → ok
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newTotal).toBe(9);
    }
  });
});

// ─── validateAttributeOnWeapon ──────────────────────────────────────

describe('validateAttributeOnWeapon', () => {
  const noRefs: RefinementRow[] = [];

  describe('hone', () => {
    it('catalog attribute (catalogBonus !== 0) → ok', () => {
      expect(validateAttributeOnWeapon(3, noRefs, 'combatPower', 'hone')).toEqual({ ok: true });
    });

    it('Augmented attribute (catalog 0, prior augment) → ok', () => {
      const refs: RefinementRow[] = [
        { tier: 'augment', magnitude: 2, targetAttribute: 'combatPower' },
      ];
      expect(validateAttributeOnWeapon(0, refs, 'combatPower', 'hone')).toEqual({ ok: true });
    });

    it('absent attribute (catalog 0, no augment) → ATTRIBUTE_NOT_ON_WEAPON', () => {
      const result = validateAttributeOnWeapon(0, noRefs, 'combatPower', 'hone');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('ATTRIBUTE_NOT_ON_WEAPON');
      }
    });
  });

  describe('augment', () => {
    it('absent attribute → ok', () => {
      expect(validateAttributeOnWeapon(0, noRefs, 'attackSpeed', 'augment')).toEqual({ ok: true });
    });

    it('catalog attribute → ATTRIBUTE_ALREADY_ON_WEAPON', () => {
      const result = validateAttributeOnWeapon(3, noRefs, 'combatPower', 'augment');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('ATTRIBUTE_ALREADY_ON_WEAPON');
      }
    });

    it('already-Augmented attribute → ATTRIBUTE_ALREADY_ON_WEAPON', () => {
      const refs: RefinementRow[] = [
        { tier: 'augment', magnitude: 2, targetAttribute: 'attackSpeed' },
      ];
      const result = validateAttributeOnWeapon(0, refs, 'attackSpeed', 'augment');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('ATTRIBUTE_ALREADY_ON_WEAPON');
      }
    });
  });
});

// ─── validateShieldCompatibility ────────────────────────────────────

describe('validateShieldCompatibility', () => {
  it('shield + sharpen → SHIELD_CANNOT_TAKE_DPS_TIER', () => {
    const result = validateShieldCompatibility('shield', 'sharpen');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SHIELD_CANNOT_TAKE_DPS_TIER');
    }
  });

  it('shield + forge → SHIELD_CANNOT_TAKE_DPS_TIER', () => {
    const result = validateShieldCompatibility('shield', 'forge');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SHIELD_CANNOT_TAKE_DPS_TIER');
    }
  });

  it('shield + hone → ok', () => {
    expect(validateShieldCompatibility('shield', 'hone')).toEqual({ ok: true });
  });

  it('shield + augment → ok', () => {
    expect(validateShieldCompatibility('shield', 'augment')).toEqual({ ok: true });
  });

  it('non-shield + each tier → ok', () => {
    for (const wt of ['energy', 'ballistic', 'melee']) {
      for (const tier of ['hone', 'augment', 'sharpen', 'forge'] as const) {
        expect(validateShieldCompatibility(wt, tier)).toEqual({ ok: true });
      }
    }
  });
});

// ─── applyRefinementsToWeapon ───────────────────────────────────────

describe('applyRefinementsToWeapon', () => {
  // Use a simple weapon-like fixture. The shared module reads `<attr>Bonus`
  // fields generically so we don't need a full Prisma Weapon shape.
  function makeWeapon(overrides: Partial<WeaponLike> = {}): WeaponLike {
    return {
      baseDamage: 10,
      cooldown: 3,
      combatPowerBonus: 2,
      attackSpeedBonus: 0,
      criticalSystemsBonus: 0,
      ...overrides,
    };
  }

  it('empty refinements: returns weapon stats unchanged', () => {
    const weapon = makeWeapon();
    const result = applyRefinementsToWeapon(weapon, []);
    expect(result.effectiveBaseDamage).toBe(10);
    expect(result.effectiveCooldown).toBe(3);
    expect(result.effectiveAttributeBonuses.combatPowerBonus).toBe(2);
    expect(result.effectiveAttributeBonuses.attackSpeedBonus).toBe(0);
  });

  it('1× forge: baseDamage +1.0, cooldown unchanged', () => {
    const result = applyRefinementsToWeapon(makeWeapon(), [
      { tier: 'forge', magnitude: 1, targetAttribute: null },
    ]);
    expect(result.effectiveBaseDamage).toBe(11);
    expect(result.effectiveCooldown).toBe(3);
  });

  it('1× sharpen: cooldown -0.25, baseDamage unchanged', () => {
    const result = applyRefinementsToWeapon(makeWeapon(), [
      { tier: 'sharpen', magnitude: 1, targetAttribute: null },
    ]);
    expect(result.effectiveBaseDamage).toBe(10);
    expect(result.effectiveCooldown).toBeCloseTo(2.75, 5);
  });

  it('1× hone +3 combatPower: combatPowerBonus = 5', () => {
    const result = applyRefinementsToWeapon(makeWeapon(), [
      { tier: 'hone', magnitude: 3, targetAttribute: 'combatPower' },
    ]);
    expect(result.effectiveAttributeBonuses.combatPowerBonus).toBe(5);
  });

  it('1× augment +5 attackSpeed (catalog 0): attackSpeedBonus = 5', () => {
    const result = applyRefinementsToWeapon(makeWeapon(), [
      { tier: 'augment', magnitude: 5, targetAttribute: 'attackSpeed' },
    ]);
    expect(result.effectiveAttributeBonuses.attackSpeedBonus).toBe(5);
  });

  it('combination: 2× forge + 2× sharpen + 1× hone +5 combatPower', () => {
    const result = applyRefinementsToWeapon(makeWeapon(), [
      { tier: 'forge', magnitude: 1, targetAttribute: null },
      { tier: 'forge', magnitude: 1, targetAttribute: null },
      { tier: 'sharpen', magnitude: 1, targetAttribute: null },
      { tier: 'sharpen', magnitude: 1, targetAttribute: null },
      { tier: 'hone', magnitude: 5, targetAttribute: 'combatPower' },
    ]);
    expect(result.effectiveBaseDamage).toBe(12); // 10 + 2
    expect(result.effectiveCooldown).toBeCloseTo(2.5, 5); // 3 - 0.5
    expect(result.effectiveAttributeBonuses.combatPowerBonus).toBe(7); // 2 + 5
  });

  it('does not mutate inputs (frozen weapon and refinements)', () => {
    const weapon = Object.freeze(makeWeapon()) as WeaponLike;
    const refinements = Object.freeze([
      Object.freeze({ tier: 'forge' as const, magnitude: 1, targetAttribute: null }),
      Object.freeze({ tier: 'hone' as const, magnitude: 2, targetAttribute: 'combatPower' }),
    ]) as readonly RefinementRow[];

    expect(() => applyRefinementsToWeapon(weapon, refinements)).not.toThrow();
    // Frozen inputs would throw if mutated. Verify catalog values still intact.
    expect(weapon.baseDamage).toBe(10);
    expect(weapon.cooldown).toBe(3);
  });

  it('order independence: any permutation produces identical effective stats', () => {
    const weapon = makeWeapon();
    const refs: RefinementRow[] = [
      { tier: 'forge', magnitude: 1, targetAttribute: null },
      { tier: 'sharpen', magnitude: 1, targetAttribute: null },
      { tier: 'hone', magnitude: 4, targetAttribute: 'combatPower' },
    ];
    const reversed = [...refs].reverse();
    const a = applyRefinementsToWeapon(weapon, refs);
    const b = applyRefinementsToWeapon(weapon, reversed);
    expect(a.effectiveBaseDamage).toBe(b.effectiveBaseDamage);
    expect(a.effectiveCooldown).toBe(b.effectiveCooldown);
    expect(a.effectiveAttributeBonuses).toEqual(b.effectiveAttributeBonuses);
  });
});

// ─── calculateRankPrefix ────────────────────────────────────────────

describe('calculateRankPrefix', () => {
  it.each([
    [0, null],
    [1, 'Refined'],
    [2, 'Refined'],
    [3, 'Crafted'],
    [4, 'Mastercrafted'],
    [5, 'Legendary'],
  ])('count %i → %s', (count, expected) => {
    expect(calculateRankPrefix(count)).toBe(expected);
  });

  it('count 6 saturates to Legendary', () => {
    expect(calculateRankPrefix(6)).toBe('Legendary');
  });

  it('count -1 (defensive) → null', () => {
    expect(calculateRankPrefix(-1)).toBeNull();
  });
});

// ─── formatWeaponDisplayName ────────────────────────────────────────

describe('formatWeaponDisplayName', () => {
  it('0 refinements: returns name unchanged', () => {
    expect(formatWeaponDisplayName('Volt Sabre', 0)).toBe('Volt Sabre');
  });

  it('1-2 refinements: "Refined Volt Sabre"', () => {
    expect(formatWeaponDisplayName('Volt Sabre', 1)).toBe('Refined Volt Sabre');
    expect(formatWeaponDisplayName('Volt Sabre', 2)).toBe('Refined Volt Sabre');
  });

  it('3 refinements: "Crafted Volt Sabre"', () => {
    expect(formatWeaponDisplayName('Volt Sabre', 3)).toBe('Crafted Volt Sabre');
  });

  it('4 refinements: "Mastercrafted Volt Sabre"', () => {
    expect(formatWeaponDisplayName('Volt Sabre', 4)).toBe('Mastercrafted Volt Sabre');
  });

  it('5 refinements: "Legendary Volt Sabre"', () => {
    expect(formatWeaponDisplayName('Volt Sabre', 5)).toBe('Legendary Volt Sabre');
  });
});
