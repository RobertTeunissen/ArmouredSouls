import { ROBOT_ATTRIBUTES } from '../../../../shared/utils/robotAttributes';
import { layerBuild, REFINEMENT_TIER_BITS, type LayeredBuild } from '../attributeLayers';
import type { Appearance, Comparison } from '../comparisons';
import { WeaponIndex, buildChoiceDesign, buildMatchupDesign, pairIndex, rawTallies, strengthCuts, strongComparisons, WEAPON_OFFSET } from '../weaponFeatures';

const CATALOGUE = [
  { id: 10, name: 'Blade', weaponType: 'melee', handsRequired: 'one', rangeBand: 'melee', cost: 1 },
  { id: 20, name: 'Gun', weaponType: 'ballistic', handsRequired: 'one', rangeBand: 'mid', cost: 1 },
];
const index = new WeaponIndex(CATALOGUE);

function build(points: number, main: number | null, offhand: number | null, loadout: string, tiers: string[] = []): LayeredBuild {
  const values = Object.fromEntries(ROBOT_ATTRIBUTES.map((a) => [a, points]));
  return layerBuild({
    baseAttributes: values,
    tuning: { combatPower: 1 },
    effectiveAttributes: values,
    mainRefinements: tiers.map((tier) => ({ tier, magnitude: 1, targetAttribute: null })),
    offhandRefinements: null,
    loadoutType: loadout,
    stance: 'balanced',
    mainWeaponId: main,
    offhandWeaponId: offhand,
  });
}

function comparison(a: LayeredBuild[], b: LayeredBuild[], y: 0 | 1, battleId = 1): Comparison {
  return { battleId, column: 'duel', a, b, y, w: 1 };
}

describe('weapon features', () => {
  it('records weapon ids, refinement tiers and points invested on the build', () => {
    const b = build(2, 10, 10, 'dual_wield', ['hone', 'forge']);
    expect(b.mainWeaponId).toBe(10);
    expect(b.refinementTiers).toBe(REFINEMENT_TIER_BITS.hone | REFINEMENT_TIER_BITS.forge);
    expect(b.invested).toBe(2 * ROBOT_ATTRIBUTES.length + 1);
    // The same weapon in both slots counts once; unknown ids are ignored.
    expect(index.carried(b)).toEqual([0]);
    expect(index.carried(build(1, 99, 20, 'dual_wield'))).toEqual([1]);
    expect(index.archetype(build(1, 20, null, 'two_handed'))).toBe(2 * 4 + 2);
    expect(index.archetype(build(1, null, null, 'single'))).toBe(-1);
  });

  it('numbers pairs of categories consecutively', () => {
    const seen = [];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) seen.push(pairIndex(i, j, 4));
    expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('writes side-share differences and counts the comparisons where a weapon differs', async () => {
    const blade = build(5, 10, null, 'single');
    const gun = build(5, 20, null, 'single');
    const { design, nonZero } = await buildChoiceDesign([comparison([blade, gun], [gun, gun], 1)], 'weapons', index);
    expect(design.rows).toBe(1);
    expect(design.x[0]).toBeCloseTo(0, 10); // same points invested
    expect(design.x[WEAPON_OFFSET]).toBeCloseTo(0.5, 10);
    expect(design.x[WEAPON_OFFSET + 1]).toBeCloseTo(-0.5, 10);
    expect(nonZero[WEAPON_OFFSET]).toBe(1);
  });

  it('builds antisymmetric matchup rows from single-robot comparisons only', async () => {
    const blade = build(5, 10, null, 'single');
    const gun = build(5, 20, null, 'single');
    const cat = (b: LayeredBuild): number => index.band(b);
    const { design, nonZero } = await buildMatchupDesign([
      comparison([blade], [gun], 1, 1),
      comparison([gun], [blade], 1, 2),
      comparison([blade], [blade], 1, 3),
      comparison([blade, gun], [gun, gun], 1, 4),
    ], cat, 4);
    expect(design.rows).toBe(2);
    const p = 3 + pairIndex(0, 2, 4);
    expect(design.x[p]).toBe(1);
    expect(design.x[design.features + p]).toBe(-1);
    expect(nonZero[p]).toBe(2);
  });

  it('tallies raw wins only where one side has the weapon', async () => {
    const blade = build(5, 10, null, 'single');
    const gun = build(5, 20, null, 'single');
    const tallies = await rawTallies([comparison([blade], [gun], 1), comparison([gun], [blade], 1), comparison([blade], [blade], 0)], (b) => index.carried(b), 2);
    expect(Array.from(tallies.comparisons)).toEqual([2, 2]);
    expect(tallies.wins[0]).toBe(1);
  });

  it('cuts the top 10% by points invested per mode column', () => {
    const appearances: Appearance[] = Array.from({ length: 20 }, (_, i) => ({ column: 'duel', build: build(i + 1, 10, null, 'single'), human: false, tier: null }));
    const cuts = strengthCuts(appearances);
    expect(cuts.duel).toBe(19 * ROBOT_ATTRIBUTES.length + 1);
    expect(cuts.team).toBeNull();
    const strong = appearances[19].build;
    const weak = appearances[0].build;
    expect(strongComparisons([comparison([strong], [weak], 1), comparison([strong], [appearances[18].build], 1)], cuts)).toHaveLength(1);
  });
});
