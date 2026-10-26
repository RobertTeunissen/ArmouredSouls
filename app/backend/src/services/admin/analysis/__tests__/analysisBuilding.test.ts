import { ROBOT_ATTRIBUTES } from '../../../../shared/utils/robotAttributes';
import { getLoadoutBonus } from '../../../../shared/utils/robotStats';
import { ALL_LAYERS_ON, type LayerToggles } from '../analysisOptions';
import { layerBuild, layerValue, layeredValues, type LayeredBuild, type RawBuild } from '../attributeLayers';
import { addBattle, emptyComparisonSet, PLACEMENT_PAIR_CAP, type AnalysisBattle, type AnalysisParticipant } from '../comparisons';
import { GROUP_PAIRS, GROUP_SIZE, LayeredValueCache, buildDesign, penaltyMask, profileKey, profileTallies, robotProfile } from '../analysisFeatures';

const OFF: LayerToggles = { tuning: false, weapons: false, refinements: false, loadout: false, stance: false };

function attrs(value: number | ((attr: string, k: number) => number)): Record<string, number> {
  return Object.fromEntries(ROBOT_ATTRIBUTES.map((a, k) => [a, typeof value === 'number' ? value : value(a, k)]));
}

/** A build with no weapons, tuning or loadout bonuses (unknown loadout → 0). */
function plain(values: Record<string, number>): LayeredBuild {
  return layerBuild({
    baseAttributes: values,
    tuning: {},
    effectiveAttributes: values,
    mainRefinements: null,
    offhandRefinements: null,
    loadoutType: 'test',
    stance: 'balanced',
  });
}

function participant(robotId: number, team: number, build: LayeredBuild | null, extra: Partial<AnalysisParticipant> = {}): AnalysisParticipant {
  return { robotId, team, placement: null, forfeited: false, destroyed: false, yielded: false, stableType: 'generated', build, ...extra };
}

describe('attribute layers', () => {
  // Combat formula: effective = round2((base + catalog + refinements + tuning) × (1 + loadout)).
  const catalog: Record<string, number> = { combatPower: 4, attackSpeed: -2, penetration: 3 };
  const tuning: Record<string, number> = { combatPower: 2, armorPlating: 1 };
  const refinements = [
    { tier: 'hone', magnitude: 2, targetAttribute: 'combatPower' },
    { tier: 'augment', magnitude: 1, targetAttribute: 'servoMotors' },
    { tier: 'sharpen', magnitude: 1, targetAttribute: null },
  ];
  const loadoutType = 'dual_wield';
  const base = attrs((_, k) => 5 + k);
  const effective = Object.fromEntries(ROBOT_ATTRIBUTES.map((a) => {
    const refine = refinements.filter((r) => r.targetAttribute === a && r.tier !== 'sharpen').reduce((s, r) => s + r.magnitude, 0);
    const raw = (base[a] + (catalog[a] ?? 0) + refine + (tuning[a] ?? 0)) * (1 + getLoadoutBonus(loadoutType, a));
    return [a, Math.round(raw * 100) / 100];
  }));
  const raw: RawBuild = { baseAttributes: base, tuning, effectiveAttributes: effective, mainRefinements: refinements, offhandRefinements: null, loadoutType, stance: 'offensive' };

  it('derives the catalog weapon bonus from the stored effective value', () => {
    const built = layerBuild(raw);
    ROBOT_ATTRIBUTES.forEach((a, k) => {
      expect(layerValue(built, 'catalog', k)).toBeCloseTo(catalog[a] ?? 0, 1);
    });
    expect(layerValue(built, 'refinements', ROBOT_ATTRIBUTES.indexOf('combatPower'))).toBe(2);
    expect(layerValue(built, 'refinements', ROBOT_ATTRIBUTES.indexOf('servoMotors'))).toBe(1);
  });

  it('rebuilds the stored effective values with every layer but stance on', () => {
    const values = layeredValues(layerBuild(raw), { ...ALL_LAYERS_ON, stance: false });
    ROBOT_ATTRIBUTES.forEach((a, k) => expect(Math.abs(values[k] - effective[a])).toBeLessThanOrEqual(0.011));
  });

  it('never changes attribute values by stance (combat applies it in its formulas), and shows only base with everything off', () => {
    const built = layerBuild(raw);
    expect(built.stance).toBe('offensive');
    const on = layeredValues(built, ALL_LAYERS_ON);
    ROBOT_ATTRIBUTES.forEach((a, k) => expect(Math.abs(on[k] - effective[a])).toBeLessThanOrEqual(0.011));
    const off = layeredValues(built, OFF);
    ROBOT_ATTRIBUTES.forEach((a, i) => expect(off[i]).toBe(base[a]));
    expect(layerBuild({ ...raw, stance: 'unknown' }).stance).toBe('balanced');
  });

  it('adds tuning alone when only tuning is on', () => {
    const values = layeredValues(layerBuild(raw), { ...OFF, tuning: true });
    expect(values[ROBOT_ATTRIBUTES.indexOf('combatPower')]).toBe(base.combatPower + 2);
    expect(values[ROBOT_ATTRIBUTES.indexOf('armorPlating')]).toBe(base.armorPlating + 1);
  });
});

describe('comparisons', () => {
  const even = plain(attrs(10));

  it('takes the winner of a two-sided battle from winning_side and averages team sides', () => {
    const set = emptyComparisonSet();
    const battle: AnalysisBattle = {
      battleId: 1,
      battleType: 'league_2v2',
      winnerId: 99,
      winningSide: 2,
      durationSeconds: 60,
      participants: [participant(1, 1, even), participant(2, 1, even), participant(3, 2, even), participant(4, 2, null)],
    };
    addBattle(battle, set);
    expect(set.comparisons).toHaveLength(1);
    expect(set.comparisons[0]).toMatchObject({ column: 'team', y: 0, w: 1 });
    expect(set.comparisons[0].a).toHaveLength(2);
    expect(set.comparisons[0].b).toHaveLength(1);
    expect(set.battles.team).toBe(1);
    expect(set.appearances).toHaveLength(3);
  });

  it('skips draws, forfeits and sides without a build', () => {
    const set = emptyComparisonSet();
    addBattle({ battleId: 2, battleType: 'league_1v1', winnerId: null, winningSide: null, durationSeconds: 120, participants: [participant(1, 1, even), participant(2, 2, even)] }, set);
    addBattle({ battleId: 3, battleType: 'league_1v1', winnerId: 1, winningSide: null, durationSeconds: 1, participants: [participant(1, 1, even), participant(2, 2, null, { forfeited: true })] }, set);
    addBattle({ battleId: 4, battleType: 'league_1v1', winnerId: 1, winningSide: null, durationSeconds: 50, participants: [participant(1, 1, even), participant(2, 2, null)] }, set);
    expect(set.comparisons).toHaveLength(0);
    expect(set.skipped).toEqual({ draws: 1, forfeits: 1, missingBuilds: 1, tiedPlacements: 0 });
  });

  it('pairs King of the Hill robots by placement and weighs each battle n/2', () => {
    const set = emptyComparisonSet();
    const field = [1, 2, 3, 4, 5, 6].map((place) => participant(place, 1, plain(attrs(place)), { placement: place }));
    addBattle({ battleId: 5, battleType: 'koth', winnerId: 1, winningSide: null, durationSeconds: 150, participants: field }, set);
    expect(set.comparisons).toHaveLength(15);
    const total = set.comparisons.reduce((s, c) => s + c.w, 0);
    expect(total).toBeCloseTo(3, 10);
    for (const c of set.comparisons) {
      const placeOf = (b: LayeredBuild): number => layerValue(b, 'base', 0);
      const aBetter = placeOf(c.a[0]) < placeOf(c.b[0]);
      expect(c.y).toBe(aBetter ? 1 : 0);
    }
    expect(new Set(set.comparisons.map((c) => c.y)).size).toBe(2);
  });

  it('samples Grand Melee pairs, keeps the battle weight and skips tied placements', () => {
    const set = emptyComparisonSet();
    const field = Array.from({ length: 20 }, (_, i) => participant(i + 1, 1, even, { placement: i + 1 }));
    addBattle({ battleId: 6, battleType: 'grand_melee', winnerId: 1, winningSide: null, durationSeconds: 120, participants: field }, set);
    expect(set.comparisons).toHaveLength(PLACEMENT_PAIR_CAP);
    expect(set.comparisons.reduce((s, c) => s + c.w, 0)).toBeCloseTo(10, 10);

    const tied = emptyComparisonSet();
    addBattle({ battleId: 7, battleType: 'koth', winnerId: 1, winningSide: null, durationSeconds: 150, participants: [
      participant(1, 1, even, { placement: 1 }), participant(2, 1, even, { placement: 2 }), participant(3, 1, even, { placement: 2 }),
    ] }, tied);
    expect(tied.comparisons).toHaveLength(2);
    expect(tied.skipped.tiedPlacements).toBe(1);
  });
});

describe('features and profiles', () => {
  it('controls for investment and uses share differences', async () => {
    const strong = plain(attrs(20));
    const weak = plain(attrs(10));
    const cache = new LayeredValueCache(ALL_LAYERS_ON);
    const m = await buildDesign([{ battleId: 1, column: 'duel', a: [strong], b: [weak], y: 1, w: 1 }], cache, 'attributes');
    expect(m.rows).toBe(1);
    expect(m.x[0]).toBeCloseTo(Math.log(2), 10);
    for (let j = 1; j < m.features; j++) expect(m.x[j]).toBeCloseTo(0, 12);
  });

  it('adds offensive/defensive stance features only with the stance toggle, unpenalised', async () => {
    const offensive = layerBuild({ baseAttributes: attrs(10), tuning: {}, effectiveAttributes: attrs(10), mainRefinements: null, offhandRefinements: null, loadoutType: 'test', stance: 'offensive' });
    const defensive = layerBuild({ baseAttributes: attrs(10), tuning: {}, effectiveAttributes: attrs(10), mainRefinements: null, offhandRefinements: null, loadoutType: 'test', stance: 'defensive' });
    const comparison = { battleId: 1, column: 'team' as const, a: [offensive, defensive], b: [defensive, defensive], y: 1 as const, w: 1 };
    const withStance = await buildDesign([comparison], new LayeredValueCache(ALL_LAYERS_ON), 'attributes');
    expect(withStance.features).toBe(26);
    expect(withStance.x[24]).toBeCloseTo(0.5, 12); // offensive share: 0.5 vs 0
    expect(withStance.x[25]).toBeCloseTo(-0.5, 12); // defensive share: 0.5 vs 1
    const without = await buildDesign([comparison], new LayeredValueCache({ ...ALL_LAYERS_ON, stance: false }), 'attributes');
    expect(without.features).toBe(24);
    expect(penaltyMask('attributes', true)).toEqual([false, ...Array(23).fill(true), false, false]);
  });

  it('has 10 group pairs and group sizes 6/5/5/4/3', () => {
    expect(GROUP_PAIRS).toHaveLength(10);
    expect(GROUP_SIZE).toEqual([6, 5, 5, 4, 3]);
  });

  it('labels balanced, heavy and hybrid builds', () => {
    const cache = new LayeredValueCache(ALL_LAYERS_ON);
    const shares = (b: LayeredBuild): Float64Array => robotProfile(b, cache).groupShares;
    expect(profileKey(shares(plain(attrs(10))))).toBe('balanced');
    expect(profileKey(shares(plain(attrs((a) => (['combatPower', 'targetingSystems', 'criticalSystems', 'penetration', 'weaponControl', 'attackSpeed'].includes(a) ? 40 : 10)))))).toBe('combat');
    expect(profileKey(shares(plain(attrs((a, k) => (k < 11 ? 30 : 5)))))).toBe('combat+defence');
  });

  it('tallies profile win rates only at comparable investment and between different profiles', async () => {
    const cache = new LayeredValueCache(ALL_LAYERS_ON);
    // Totals 253 and 256: comparable investment.
    const balanced = plain(attrs(11));
    const combat = plain(attrs((_, k) => (k < 6 ? 20 : 8)));
    const rich = plain(attrs(30));
    const tallies = await profileTallies([
      { battleId: 1, column: 'duel', a: [combat], b: [balanced], y: 1, w: 1 },
      { battleId: 2, column: 'duel', a: [balanced], b: [balanced], y: 1, w: 1 },
      { battleId: 3, column: 'duel', a: [rich], b: [combat], y: 1, w: 1 },
    ], cache);
    const all = tallies.get('all');
    expect(all?.get('combat')).toEqual({ wins: 1, weight: 1, comparisons: 1 });
    expect(all?.get('balanced')).toEqual({ wins: 0, weight: 1, comparisons: 1 });
    expect(tallies.get('duel')?.get('combat')?.comparisons).toBe(1);
  });
});
