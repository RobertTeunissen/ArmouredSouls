/**
 * Season 2 — Refinement Lab facility (FEAT-004).
 *
 * The Lab takes over the refinement tier gates from the Weapons Workshop. Its
 * costs, prestige gates and operating cost mirror the Workshop; the gates are
 * the shared REQUIRED_REFINEMENT_LAB_LEVELS.
 */
import { FACILITY_TYPES, PRESTIGE_GATES_10, getFacilityConfig } from '../src/config/facilities';
import { calculateFacilityOperatingCost, getFacilityName } from '../src/utils/economyFormulas';
import { REQUIRED_REFINEMENT_LAB_LEVELS } from '../src/shared/utils/weaponRefinement';

describe('Refinement Lab facility config', () => {
  const lab = getFacilityConfig('refinement_lab');
  const workshop = getFacilityConfig('weapons_workshop');

  it('exists directly after the Weapons Workshop, making 14 facilities', () => {
    const types = FACILITY_TYPES.map((f) => f.type);
    expect(types).toHaveLength(14);
    expect(types.indexOf('refinement_lab')).toBe(types.indexOf('weapons_workshop') + 1);
  });

  it('has 10 levels at the Workshop costs (₡75K–₡750K) and the universal prestige gates', () => {
    expect(lab).toBeDefined();
    expect(lab?.name).toBe('Refinement Lab');
    expect(lab?.maxLevel).toBe(10);
    expect(lab?.costs).toEqual([75000, 150000, 225000, 300000, 375000, 450000, 525000, 600000, 675000, 750000]);
    expect(lab?.costs).toEqual(workshop?.costs);
    expect(lab?.prestigeRequirements).toBe(PRESTIGE_GATES_10);
    expect(lab?.implemented).toBe(true);
  });

  it('names a non-empty benefit for every level, with the unlock levels matching the shared gates', () => {
    expect(lab?.benefits).toHaveLength(10);
    for (const benefit of lab?.benefits ?? []) expect(benefit.length).toBeGreaterThan(0);
    expect(lab?.benefits[REQUIRED_REFINEMENT_LAB_LEVELS.hone - 1]).toMatch(/^Unlocks Hone/);
    expect(lab?.benefits[REQUIRED_REFINEMENT_LAB_LEVELS.augment - 1]).toMatch(/^Unlocks Augment/);
    expect(lab?.benefits[REQUIRED_REFINEMENT_LAB_LEVELS.sharpen - 1]).toMatch(/^Unlocks Sharpen/);
    expect(lab?.benefits[REQUIRED_REFINEMENT_LAB_LEVELS.forge - 1]).toBe('Unlocks Forge (all tiers available)');
    expect(lab?.benefits[8]).toMatch(/All tiers available/);
    expect(lab?.benefits[9]).toMatch(/All tiers available/);
  });

  it('gates hone L1, augment L3, sharpen L5, forge L8', () => {
    expect(REQUIRED_REFINEMENT_LAB_LEVELS).toEqual({ hone: 1, augment: 3, sharpen: 5, forge: 8 });
  });

  it('no longer describes the Workshop as a refinement facility', () => {
    expect(workshop?.description).not.toMatch(/refine/i);
    for (const benefit of workshop?.benefits ?? []) expect(benefit).not.toMatch(/refine|hone|augment|sharpen|forge/i);
  });

  it('costs ₡100 per level per day to operate and has a display name', () => {
    expect(calculateFacilityOperatingCost('refinement_lab', 1)).toBe(100);
    expect(calculateFacilityOperatingCost('refinement_lab', 10)).toBe(1000);
    expect(getFacilityName('refinement_lab')).toBe('Refinement Lab');
  });
});
