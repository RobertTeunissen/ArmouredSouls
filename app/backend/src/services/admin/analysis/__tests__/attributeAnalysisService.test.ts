jest.mock('../analysisData', () => ({
  __esModule: true,
  COMPARISON_CAP: 100_000,
  getRecordingBounds: jest.fn(),
  countRecordedBattles: jest.fn(),
  loadComparisons: jest.fn(),
  sampleRate: jest.fn(() => 1),
}));

import { ROBOT_ATTRIBUTES } from '../../../../shared/utils/robotAttributes';
import * as data from '../analysisData';
import { ALL_LAYERS_ON } from '../analysisOptions';
import { layerBuild, type LayeredBuild } from '../attributeLayers';
import { addBattle, emptyComparisonSet, type ComparisonSet } from '../comparisons';
import { clearAttributeAnalysisCache, getAttributeAnalysis } from '../attributeAnalysisService';
import type { AttributeAnalysisReady } from '../analysisTypes';

const mocked = data as jest.Mocked<typeof data>;
const NOW = new Date('2026-11-10T12:00:00Z');
const DAY = 24 * 3600 * 1000;

function random(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function build(values: Record<string, number>): LayeredBuild {
  return layerBuild({ baseAttributes: values, tuning: {}, effectiveAttributes: values, mainRefinements: null, offhandRefinements: null, loadoutType: 'test', stance: 'balanced' });
}

/** 1v1 battles where combat power share and total points decide the winner. */
function syntheticSet(battles: number): ComparisonSet {
  const next = random(42);
  const set = emptyComparisonSet();
  const cp = ROBOT_ATTRIBUTES.indexOf('combatPower');
  for (let id = 1; id <= battles; id++) {
    const sides = [0, 1].map(() => Object.fromEntries(ROBOT_ATTRIBUTES.map((a) => [a, 1 + Math.floor(next() * 30)])));
    const total = sides.map((s) => Object.values(s).reduce((x, y) => x + y, 0));
    const share = sides.map((s, i) => s[ROBOT_ATTRIBUTES[cp]] / total[i]);
    const logit = 3 * Math.log(total[0] / total[1]) + 40 * (share[0] - share[1]);
    const side1Won = next() < 1 / (1 + Math.exp(-logit));
    addBattle({
      battleId: id,
      battleType: 'league_1v1',
      winnerId: side1Won ? 1 : 2,
      winningSide: null,
      durationSeconds: 60,
      participants: [
        { robotId: 1, team: 1, placement: null, forfeited: false, destroyed: !side1Won, yielded: false, stableType: id % 10 === 0 ? 'human' : 'generated', build: build(sides[0]) },
        { robotId: 2, team: 2, placement: null, forfeited: false, destroyed: side1Won, yielded: false, stableType: 'generated', build: build(sides[1]) },
      ],
    }, set);
  }
  return set;
}

describe('getAttributeAnalysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAttributeAnalysisCache();
    mocked.countRecordedBattles.mockResolvedValue(new Map([['league_1v1', 4000]]));
    mocked.sampleRate.mockReturnValue(1);
  });

  it('reports "collecting" until seven days of records exist', async () => {
    mocked.getRecordingBounds.mockResolvedValue({ since: new Date(NOW.getTime() - 3 * DAY), newestId: 10 });
    const result = await getAttributeAnalysis({ range: '7d', toggles: { ...ALL_LAYERS_ON }, now: NOW });
    expect(result).toEqual({
      status: 'collecting',
      recordingSince: new Date(NOW.getTime() - 3 * DAY).toISOString(),
      availableFrom: new Date(NOW.getTime() + 4 * DAY).toISOString(),
      battlesRecorded: 4000,
    });
    expect(mocked.loadComparisons).not.toHaveBeenCalled();
  });

  it('reports "collecting" with no dates before recording started', async () => {
    mocked.getRecordingBounds.mockResolvedValue({ since: null, newestId: 0 });
    const result = await getAttributeAnalysis({ range: 'season', toggles: { ...ALL_LAYERS_ON }, now: NOW });
    expect(result).toEqual({ status: 'collecting', recordingSince: null, availableFrom: null, battlesRecorded: 0 });
  });

  it('finds the attribute that decides battles, controls for investment and caches the result', async () => {
    mocked.getRecordingBounds.mockResolvedValue({ since: new Date(NOW.getTime() - 20 * DAY), newestId: 99 });
    mocked.loadComparisons.mockResolvedValue({ set: syntheticSet(4000), battlesRead: 4000 });

    const result = await getAttributeAnalysis({ range: '7d', toggles: { ...ALL_LAYERS_ON }, now: NOW });
    expect(result.status).toBe('ready');
    const ready = result as AttributeAnalysisReady;

    expect(mocked.loadComparisons).toHaveBeenCalledWith(new Date(NOW.getTime() - 7 * DAY), 1);
    expect(ready.window).toMatchObject({ range: '7d', battlesInRange: 4000, battlesUsed: 4000, sampled: false });

    const duel = ready.columns.find((c) => c.column === 'duel');
    expect(duel).toMatchObject({ battles: 4000, comparisons: 4000, enough: true });
    expect(duel?.investmentEffect.effect).toBeGreaterThan(0);
    expect(duel?.investmentEffect.significant).toBe(true);
    expect(ready.columns.find((c) => c.column === 'team')).toMatchObject({ comparisons: 0, enough: false });

    const combatPower = ready.attributes.find((a) => a.attribute === 'combatPower');
    expect(combatPower?.effects.duel.effect).toBeGreaterThan(0);
    expect(combatPower?.effects.duel.significant).toBe(true);
    expect(combatPower?.effects.all.effect).toBeCloseTo(combatPower?.effects.duel.effect ?? 0, 6);
    expect(combatPower?.effects.team).toEqual({ effect: null, se: null, significant: false });
    const strongest = [...ready.attributes].sort((a, b) => (b.effects.duel.effect ?? 0) - (a.effects.duel.effect ?? 0))[0];
    expect(strongest.attribute).toBe('combatPower');

    // Contrasts against the other attributes sum to zero across the 23.
    const sum = ready.attributes.reduce((s, a) => s + (a.effects.duel.effect ?? 0), 0);
    expect(Math.abs(sum)).toBeLessThan(0.1);

    expect(ready.groups).toHaveLength(5);
    expect(ready.groupPairs).toHaveLength(10);
    expect(ready.groups.find((g) => g.group === 'combat')?.effects.duel.effect).toBeGreaterThan(0);
    expect(ready.profiles.length).toBeGreaterThan(0);
    expect(ready.robots).toEqual({ all: 8000, human: 400 });
    expect(ready.attributes.every((a) => a.playersAvgShare !== null)).toBe(true);

    expect(ready.layerFit?.rows.map((r) => r.layer)).toEqual(['base', 'tuning', 'weapons', 'refinements', 'loadout', 'stance']);
    expect(ready.layerFit?.rows[0].logLoss).toBeLessThan(Math.LN2);

    const again = await getAttributeAnalysis({ range: '7d', toggles: { ...ALL_LAYERS_ON }, now: NOW });
    expect(again).toBe(result);
    // Other toggles reuse the loaded battles.
    await getAttributeAnalysis({ range: '7d', toggles: { ...ALL_LAYERS_ON, stance: false }, now: NOW });
    expect(mocked.loadComparisons).toHaveBeenCalledTimes(1);
  });

  it('never reads before recording started', async () => {
    mocked.getRecordingBounds.mockResolvedValue({ since: new Date(NOW.getTime() - 9 * DAY), newestId: 5 });
    mocked.loadComparisons.mockResolvedValue({ set: emptyComparisonSet(), battlesRead: 0 });
    const result = await getAttributeAnalysis({ range: '30d', toggles: { ...ALL_LAYERS_ON }, now: NOW });
    expect(mocked.loadComparisons).toHaveBeenCalledWith(null, 1);
    expect((result as AttributeAnalysisReady).window.from).toBeNull();
    expect((result as AttributeAnalysisReady).columns.every((c) => !c.enough)).toBe(true);
    expect((result as AttributeAnalysisReady).layerFit).toBeNull();
  });
});
