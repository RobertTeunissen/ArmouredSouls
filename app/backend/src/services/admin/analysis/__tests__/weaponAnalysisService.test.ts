jest.mock('../analysisData', () => ({
  __esModule: true,
  COMPARISON_CAP: 100_000,
  getRecordingBounds: jest.fn(),
  countRecordedBattles: jest.fn(),
  loadComparisons: jest.fn(),
  sampleRate: jest.fn(() => 1),
}));
jest.mock('../weaponCatalogue', () => ({
  __esModule: true,
  loadWeaponCatalogue: jest.fn(),
  weaponsOwnedByPlayers: jest.fn(),
}));

import { ROBOT_ATTRIBUTES } from '../../../../shared/utils/robotAttributes';
import * as data from '../analysisData';
import * as catalogueModule from '../weaponCatalogue';
import { clearDatasetCache } from '../analysisDataset';
import { layerBuild, type LayeredBuild } from '../attributeLayers';
import { addBattle, emptyComparisonSet, type AnalysisParticipant, type ComparisonSet } from '../comparisons';
import { clearWeaponAnalysisCache, getWeaponAnalysis } from '../weaponAnalysisService';
import type { WeaponAnalysisReady } from '../weaponAnalysisTypes';
import type { CatalogueWeapon } from '../weaponCatalogue';

const mocked = data as jest.Mocked<typeof data>;
const mockedCatalogue = catalogueModule as jest.Mocked<typeof catalogueModule>;
const NOW = new Date('2026-11-10T12:00:00Z');
const DAY = 24 * 3600 * 1000;

const CATALOGUE: CatalogueWeapon[] = [
  { id: 1, name: 'Mace', weaponType: 'melee', handsRequired: 'one', rangeBand: 'melee', cost: 300_000 },
  { id: 2, name: 'Pistol', weaponType: 'energy', handsRequired: 'one', rangeBand: 'short', cost: 100_000 },
  { id: 3, name: 'Rifle', weaponType: 'ballistic', handsRequired: 'two', rangeBand: 'long', cost: 150_000 },
  { id: 4, name: 'Buckler', weaponType: 'shield', handsRequired: 'shield', rangeBand: 'melee', cost: 80_000 },
];

/** Kits: [main, offhand, loadout, planted logit]. Mace + shield is strong, the long rifle weak. */
const KITS: Array<[number, number | null, string, number]> = [
  [1, 4, 'weapon_shield', 1],
  [2, null, 'single', 0],
  [3, null, 'two_handed', -1],
];

function random(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function build(points: number, kit: number, refined = false): LayeredBuild {
  const values = Object.fromEntries(ROBOT_ATTRIBUTES.map((a) => [a, points]));
  const [main, offhand, loadout] = KITS[kit];
  return layerBuild({
    baseAttributes: values,
    tuning: {},
    effectiveAttributes: values,
    mainRefinements: refined ? [{ tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' }] : null,
    offhandRefinements: null,
    loadoutType: loadout,
    stance: 'balanced',
    mainWeaponId: main,
    offhandWeaponId: offhand,
  });
}

function robot(robotId: number, team: number, b: LayeredBuild, human: boolean, extra: Partial<AnalysisParticipant> = {}): AnalysisParticipant {
  return { robotId, team, placement: null, forfeited: false, destroyed: false, yielded: false, stableType: human ? 'human' : 'generated', build: b, ...extra };
}

/** 1v1 battles decided by points and the kit; some 2v2 battles; champion robots mostly fight mace + shield. */
function syntheticSet(battles: number): ComparisonSet {
  const next = random(7);
  const set = emptyComparisonSet();
  for (let id = 1; id <= battles; id++) {
    const champion = id % 10 === 0;
    const kits = [0, 1].map(() => (champion && next() < 0.8 ? 0 : Math.floor(next() * KITS.length)));
    const points = [0, 1].map(() => (champion ? 40 : 5) + Math.floor(next() * 10));
    const logit = 3 * Math.log(points[0] / points[1]) + KITS[kits[0]][3] - KITS[kits[1]][3];
    const side1Won = next() < 1 / (1 + Math.exp(-logit));
    addBattle({
      battleId: id,
      battleType: 'league_1v1',
      winnerId: side1Won ? 1 : 2,
      winningSide: null,
      durationSeconds: 60,
      tier: champion ? 'champion' : 'bronze',
      participants: [
        robot(1, 1, build(points[0], kits[0], id % 7 === 0), id % 5 === 0),
        robot(2, 2, build(points[1], kits[1]), false),
      ],
    }, set);
  }
  for (let id = battles + 1; id <= battles + 400; id++) {
    addBattle({
      battleId: id,
      battleType: 'league_2v2',
      winnerId: null,
      winningSide: next() < 0.5 ? 1 : 2,
      durationSeconds: 60,
      tier: 'silver',
      participants: [robot(1, 1, build(5, 0), false), robot(2, 1, build(5, 1), false), robot(3, 2, build(5, 2), false), robot(4, 2, build(5, 1), false)],
    }, set);
  }
  return set;
}

describe('getWeaponAnalysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDatasetCache();
    clearWeaponAnalysisCache();
    mocked.countRecordedBattles.mockResolvedValue(new Map([['league_1v1', 6000]]));
    mocked.sampleRate.mockReturnValue(1);
    mockedCatalogue.loadWeaponCatalogue.mockResolvedValue(CATALOGUE);
    mockedCatalogue.weaponsOwnedByPlayers.mockResolvedValue(new Set([1, 2]));
  });

  it('reports "collecting" until seven days of records exist', async () => {
    mocked.getRecordingBounds.mockResolvedValue({ since: new Date(NOW.getTime() - 2 * DAY), newestId: 3 });
    const result = await getWeaponAnalysis({ range: '7d', strength: 'all', now: NOW });
    expect(result.status).toBe('collecting');
    expect(mocked.loadComparisons).not.toHaveBeenCalled();
  });

  it('finds the planted weapon, archetype and matchup effects', async () => {
    mocked.getRecordingBounds.mockResolvedValue({ since: new Date(NOW.getTime() - 9 * DAY), newestId: 10 });
    mocked.loadComparisons.mockResolvedValue({ set: syntheticSet(6000), battlesRead: 6400 });

    const result = await getWeaponAnalysis({ range: '7d', strength: 'all', now: NOW });
    expect(result.status).toBe('ready');
    const ready = result as WeaponAnalysisReady;

    const weapon = (name: string): WeaponAnalysisReady['weapons'][number] => ready.weapons.find((w) => w.name === name)!;
    expect(weapon('Mace').results.duel.effect.effect).toBeGreaterThan(3);
    expect(weapon('Mace').results.duel.effect.significant).toBe(true);
    expect(weapon('Rifle').results.duel.effect.effect).toBeLessThan(-3);
    expect(weapon('Rifle').results.duel.effect.significant).toBe(true);
    // Raw win rates are shown for context; the mace side wins more often than not.
    expect(weapon('Mace').results.duel.rawWinRate).toBeGreaterThan(0.5);
    expect(weapon('Mace').results.duel.share).toBeGreaterThan(0.3);

    const archetype = (key: string): WeaponAnalysisReady['archetypes'][number] => ready.archetypes.find((a) => a.key === key)!;
    expect(archetype('melee+weapon_shield').results.duel.effect.effect).toBeGreaterThan(archetype('long+two_handed').results.duel.effect.effect!);
    // Archetypes nobody used get no estimate.
    expect(archetype('mid+dual_wield').results.duel.effect.effect).toBeNull();

    const bands = ready.matchups.duel!.views.bands;
    expect(bands.labels).toEqual(['melee', 'short', 'mid', 'long']);
    const melee = 0;
    const long = 3;
    expect(bands.cells[melee][long].winRate).toBeGreaterThan(0.75);
    expect(bands.cells[melee][long].significant).toBe(true);
    expect(bands.cells[melee][long].winRate! + bands.cells[long][melee].winRate!).toBeCloseTo(1, 6);
    expect(bands.cells[melee][melee].winRate).toBeNull();
    expect(bands.cells[1][2].winRate).toBeNull(); // nobody fights mid
    expect(ready.matchups.duel!.views.archetypes.labels).toHaveLength(3);
    expect(ready.matchups.team).toBeNull();

    // Tier bars: the champion tier converges on mace + shield.
    const tiers = ready.tiers.duel;
    expect(tiers.segments[0]).toBe('melee+weapon_shield');
    const champion = tiers.rows.find((r) => r.tier === 'champion')!;
    const bronze = tiers.rows.find((r) => r.tier === 'bronze')!;
    expect(champion.shares[0]).toBeGreaterThan(bronze.shares[0] + 0.3);
    expect(champion.shares.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 3);
    expect(ready.tiers.team.rows.map((r) => r.tier)).toEqual(['silver']);

    expect(ready.refinements.duel.refinedShare).toBeGreaterThan(0.05);
    expect(ready.refinements.duel.tierShares.hone).toBe(ready.refinements.duel.refinedShare);
    expect(ready.coverage.duel).toEqual({ catalogue: 4, fought: 4, foughtByPlayers: 4 });
    expect(ready.notOwnedByPlayers.map((w) => w.name)).toEqual(['Buckler', 'Rifle']);
    expect(ready.columns.find((c) => c.column === 'duel')!.investmentEffect.effect).toBeGreaterThan(0);
  });

  it('keeps only top-10% robots with strength top10 and reuses the loaded window', async () => {
    mocked.getRecordingBounds.mockResolvedValue({ since: new Date(NOW.getTime() - 9 * DAY), newestId: 11 });
    mocked.loadComparisons.mockResolvedValue({ set: syntheticSet(6000), battlesRead: 6400 });

    const all = (await getWeaponAnalysis({ range: '7d', strength: 'all', now: NOW })) as WeaponAnalysisReady;
    const top = (await getWeaponAnalysis({ range: '7d', strength: 'top10', now: NOW })) as WeaponAnalysisReady;
    expect(mocked.loadComparisons).toHaveBeenCalledTimes(1);

    const duelAll = all.columns.find((c) => c.column === 'duel')!;
    const duelTop = top.columns.find((c) => c.column === 'duel')!;
    expect(duelAll.strengthCut).toBeNull();
    expect(duelTop.strengthCut).toBeGreaterThanOrEqual(40 * ROBOT_ATTRIBUTES.length);
    expect(duelTop.comparisons).toBeLessThan(duelAll.comparisons / 5);
    expect(top.tiers.duel.rows.map((r) => r.tier)).toEqual(['champion']);
    expect(top.strength).toBe('top10');
    // Cached per strength.
    expect(await getWeaponAnalysis({ range: '7d', strength: 'top10', now: NOW })).toBe(top);
  });
});
