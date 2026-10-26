/**
 * Admin Attributes page (`GET /api/admin/analysis/attributes`): which
 * attributes, attribute groups and build profiles win, per mode column, from
 * the battle-time build records.
 *
 * Method (docs/guides/ADMIN_PANEL_GUIDE.md §Attributes): paired comparisons
 * (side vs side; KotH/GM pairs by placement), a logistic model on differences
 * of attribute shares that controls for total investment, cluster-robust
 * standard errors by battle. Results are cached per window and layer toggles
 * until a new build is recorded.
 */
import { ROBOT_ATTRIBUTES } from '../../../shared/utils/robotAttributes';
import {
  ANALYSIS_COLUMNS,
  ANALYSIS_RANGE_DAYS,
  ATTRIBUTE_GROUPS,
  ATTRIBUTE_GROUP_OF,
  LAYER_KEYS,
  MIN_COMPARISONS,
  MIN_RECORDING_DAYS,
  type AnalysisColumn,
  type AnalysisRange,
  type AttributeGroup,
  type LayerToggles,
} from './analysisOptions';
import { ATTRIBUTE_COUNT } from './attributeLayers';
import {
  GROUP_COUNT,
  GROUP_PAIRS,
  LayeredValueCache,
  buildDesign,
  featureCount,
  penaltyMask,
  stanceFeatureIndex,
  profileTallies,
  usageSummary,
  type ModelKind,
  type ProfileKey,
} from './analysisFeatures';
import { combinationVariance, evaluate, fitLogistic, type FitResult } from './logisticFit';
import { countRecordedBattles, getRecordingBounds, loadComparisons, sampleRate } from './analysisData';
import type { Comparison, ComparisonSet } from './comparisons';
import type {
  AnalysisColumnSummary,
  AttributeAnalysisResponse,
  AttributeEffectRow,
  BuildProfileRow,
  EffectEstimate,
  EffectsByColumn,
  GroupEffectRow,
  GroupPairRow,
  LayerFitRow,
  LayerFitSummary,
  LayerStep,
  ProfileResult,
} from './analysisTypes';

const DAY_MS = 24 * 3600 * 1000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_RESULTS = 32;
/** Loaded battles are ~70 MB at the comparison cap, so only the last window is kept. */
const MAX_DATASETS = 1;
/** Profiles need this many comparisons in a column before a win rate is shown. */
export const MIN_PROFILE_COMPARISONS = 50;
/** Comparisons the layer-fit table trains on at most. */
const LAYER_FIT_TRAIN_CAP = 60_000;

/** Percentage points of win chance per unit of logit at even odds (slope of the logistic at p = 0.5). */
const PP_PER_LOGIT = 100 / 4;
export const SHARE_STEP = 0.05;
export const PAIR_STEP = 0.1;
export const INVESTMENT_STEP = Math.log(1.1);

export interface AttributeAnalysisParams {
  range: AnalysisRange;
  toggles: LayerToggles;
  /** Injected for tests; defaults to now. */
  now?: Date;
}

interface Dataset {
  set: ComparisonSet;
  from: Date | null;
  battlesInRange: number;
  battlesUsed: number;
  sampled: boolean;
  createdAt: number;
}

interface CacheEntry<T> {
  value: T;
  createdAt: number;
}

const datasets = new Map<string, Dataset>();
const results = new Map<string, CacheEntry<AttributeAnalysisResponse>>();
const layerFits = new Map<string, CacheEntry<LayerFitSummary | null>>();
const inFlight = new Map<string, Promise<AttributeAnalysisResponse>>();

/** Forget cached results (tests). */
export function clearAttributeAnalysisCache(): void {
  datasets.clear();
  results.clear();
  layerFits.clear();
  inFlight.clear();
}

function remember<K, V>(map: Map<K, V>, key: K, value: V, max: number): void {
  map.delete(key);
  map.set(key, value);
  while (map.size > max) {
    const oldest = map.keys().next().value as K;
    map.delete(oldest);
  }
}

function fresh(createdAt: number, now: number): boolean {
  return now - createdAt < CACHE_TTL_MS;
}

function togglesKey(toggles: LayerToggles): string {
  return LAYER_KEYS.map((k) => (toggles[k] ? '1' : '0')).join('');
}

/** 32-bit mix of a battle id, for deterministic splits. */
function mix(id: number): number {
  let h = Math.imul(id ^ (id >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

// ── Effects ──────────────────────────────────────────────────────────

const NO_ESTIMATE: EffectEstimate = { effect: null, se: null, significant: false };

function estimate(fit: FitResult | null, contrast: Float64Array, scale: number, enough: boolean): EffectEstimate {
  if (!fit || !enough) return NO_ESTIMATE;
  let value = 0;
  for (let j = 0; j < contrast.length; j++) value += contrast[j] * fit.beta[j];
  const se = Math.sqrt(combinationVariance(fit.covariance, contrast.length, contrast)) * scale;
  const effect = value * scale;
  if (!Number.isFinite(effect) || !Number.isFinite(se)) return NO_ESTIMATE;
  return { effect: round(effect, 2), se: round(se, 2), significant: Math.abs(effect) >= 2 * se && se > 0 };
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** Contrast "+1 on member k of a block, −1/(n−1) on the others". */
function blockContrast(d: number, offset: number, size: number, k: number): Float64Array {
  const c = new Float64Array(d);
  for (let j = 0; j < size; j++) c[offset + j] = j === k ? 1 : -1 / (size - 1);
  return c;
}

function unitContrast(d: number, index: number): Float64Array {
  const c = new Float64Array(d);
  c[index] = 1;
  return c;
}

interface ColumnFits {
  column: AnalysisColumn;
  comparisons: number;
  enough: boolean;
  fits: Record<ModelKind, FitResult | null>;
}

function subset(comparisons: readonly Comparison[], column: AnalysisColumn): Comparison[] {
  return column === 'all' ? [...comparisons] : comparisons.filter((c) => c.column === column);
}

async function fitColumn(comparisons: Comparison[], column: AnalysisColumn, cache: LayeredValueCache): Promise<ColumnFits> {
  const enough = comparisons.length >= MIN_COMPARISONS;
  const fits: Record<ModelKind, FitResult | null> = { attributes: null, groups: null, groupPairs: null };
  if (enough) {
    for (const kind of ['attributes', 'groups', 'groupPairs'] as const) {
      fits[kind] = await fitLogistic(await buildDesign(comparisons, cache, kind), { penalised: penaltyMask(kind, cache.toggles.stance) });
    }
  }
  return { column, comparisons: comparisons.length, enough, fits };
}

function byColumn(columns: readonly ColumnFits[], pick: (c: ColumnFits) => EffectEstimate): EffectsByColumn {
  const out = {} as EffectsByColumn;
  for (const c of columns) out[c.column] = pick(c);
  return out;
}

// ── Layer fit table ──────────────────────────────────────────────────

const LAYER_STEPS: readonly LayerStep[] = ['base', ...LAYER_KEYS];

function cumulativeToggles(step: number): LayerToggles {
  const toggles = {} as LayerToggles;
  LAYER_KEYS.forEach((key, i) => { toggles[key] = i < step; });
  return toggles;
}

async function computeLayerFit(comparisons: readonly Comparison[]): Promise<LayerFitSummary | null> {
  const test = comparisons.filter((c) => mix(c.battleId) % 5 === 0);
  let train = comparisons.filter((c) => mix(c.battleId) % 5 !== 0);
  if (train.length > LAYER_FIT_TRAIN_CAP) {
    const keep = LAYER_FIT_TRAIN_CAP / train.length;
    train = train.filter((c) => (mix(c.battleId ^ 0x5bd1e995) / 4_294_967_296) < keep);
  }
  if (train.length < MIN_COMPARISONS || test.length < MIN_COMPARISONS / 3) return null;
  const rows: LayerFitRow[] = [];
  for (let step = 0; step < LAYER_STEPS.length; step++) {
    const cache = new LayeredValueCache(cumulativeToggles(step));
    const fit = await fitLogistic(await buildDesign(train, cache, 'attributes'), { penalised: penaltyMask('attributes', cache.toggles.stance) });
    if (!fit) return null;
    const scored = await evaluate(await buildDesign(test, cache, 'attributes'), fit.beta);
    rows.push({ layer: LAYER_STEPS[step], logLoss: round(scored.logLoss, 4), accuracy: round(scored.accuracy, 4) });
  }
  return { trainComparisons: train.length, testComparisons: test.length, rows };
}

// ── Profiles ─────────────────────────────────────────────────────────

function profileGroups(key: ProfileKey): AttributeGroup[] {
  return key === 'balanced' ? [] : (key.split('+') as AttributeGroup[]);
}

async function buildProfiles(comparisons: readonly Comparison[], set: ComparisonSet, cache: LayeredValueCache): Promise<{
  rows: BuildProfileRow[];
  robots: { all: number; human: number };
  avgShare: Float64Array;
  humanAvgShare: Float64Array;
}> {
  const tallies = await profileTallies(comparisons, cache);
  const usage = await usageSummary(set.appearances, cache);
  const keys = new Set<ProfileKey>(usage.byProfile.keys());
  for (const byProfile of tallies.values()) for (const key of byProfile.keys()) keys.add(key);
  const rows: BuildProfileRow[] = [...keys].map((key) => {
    const resultsByColumn = {} as Record<AnalysisColumn, ProfileResult>;
    for (const column of ANALYSIS_COLUMNS) {
      const tally = tallies.get(column)?.get(key);
      const count = tally?.comparisons ?? 0;
      resultsByColumn[column] = {
        winRate: tally && count >= MIN_PROFILE_COMPARISONS && tally.weight > 0 ? round(tally.wins / tally.weight, 4) : null,
        comparisons: count,
      };
    }
    const used = usage.byProfile.get(key) ?? { all: 0, human: 0 };
    return {
      profile: key,
      groups: profileGroups(key),
      results: resultsByColumn,
      shareAll: usage.robots > 0 ? round(used.all / usage.robots, 4) : 0,
      sharePlayers: usage.humanRobots > 0 ? round(used.human / usage.humanRobots, 4) : null,
    };
  });
  rows.sort((a, b) => b.shareAll - a.shareAll || b.results.all.comparisons - a.results.all.comparisons || a.profile.localeCompare(b.profile));
  return {
    rows,
    robots: { all: usage.robots, human: usage.humanRobots },
    avgShare: usage.avgShare,
    humanAvgShare: usage.humanAvgShare,
  };
}

// ── Orchestration ────────────────────────────────────────────────────

async function getDataset(range: AnalysisRange, since: Date, newestId: number, now: Date): Promise<Dataset> {
  const key = `${range}|${newestId}`;
  const cached = datasets.get(key);
  if (cached && fresh(cached.createdAt, now.getTime())) return cached;
  const start = range === 'season' ? null : new Date(now.getTime() - ANALYSIS_RANGE_DAYS[range] * DAY_MS);
  const from = start && start > since ? start : null;
  const counts = await countRecordedBattles(from);
  let battlesInRange = 0;
  for (const count of counts.values()) battlesInRange += count;
  const rate = sampleRate(counts);
  const { set, battlesRead } = await loadComparisons(from, rate);
  const dataset: Dataset = { set, from, battlesInRange, battlesUsed: battlesRead, sampled: rate < 1, createdAt: now.getTime() };
  remember(datasets, key, dataset, MAX_DATASETS);
  return dataset;
}

async function getLayerFit(range: AnalysisRange, newestId: number, dataset: Dataset, now: number): Promise<LayerFitSummary | null> {
  const key = `${range}|${newestId}`;
  const cached = layerFits.get(key);
  if (cached && fresh(cached.createdAt, now)) return cached.value;
  const value = await computeLayerFit(dataset.set.comparisons);
  remember(layerFits, key, { value, createdAt: now }, MAX_RESULTS);
  return value;
}

async function compute(params: AttributeAnalysisParams, since: Date, newestId: number, now: Date): Promise<AttributeAnalysisResponse> {
  const started = Date.now();
  const dataset = await getDataset(params.range, since, newestId, now);
  const { comparisons } = dataset.set;
  const cache = new LayeredValueCache(params.toggles);

  const columns: ColumnFits[] = [];
  for (const column of ANALYSIS_COLUMNS) columns.push(await fitColumn(subset(comparisons, column), column, cache));

  const withStance = params.toggles.stance;
  const attributeD = featureCount('attributes', withStance);
  const groupD = featureCount('groups', withStance);
  const pairD = featureCount('groupPairs', withStance);
  const stanceAt = stanceFeatureIndex('attributes');
  const shareScale = SHARE_STEP * PP_PER_LOGIT;

  const profiles = await buildProfiles(comparisons, dataset.set, cache);

  const attributes: AttributeEffectRow[] = ROBOT_ATTRIBUTES.map((attribute, k) => ({
    attribute,
    group: ATTRIBUTE_GROUP_OF[attribute],
    effects: byColumn(columns, (c) => estimate(c.fits.attributes, blockContrast(attributeD, 1, ATTRIBUTE_COUNT, k), shareScale, c.enough)),
    avgShare: round(profiles.avgShare[k], 4),
    playersAvgShare: profiles.robots.human > 0 ? round(profiles.humanAvgShare[k], 4) : null,
  }));

  const groups: GroupEffectRow[] = ATTRIBUTE_GROUPS.map((group, g) => ({
    group,
    effects: byColumn(columns, (c) => estimate(c.fits.groups, blockContrast(groupD, 1, GROUP_COUNT, g), shareScale, c.enough)),
  }));

  const groupPairs: GroupPairRow[] = GROUP_PAIRS.map(([g, h], p) => ({
    groups: [ATTRIBUTE_GROUPS[g], ATTRIBUTE_GROUPS[h]],
    effects: byColumn(columns, (c) => estimate(c.fits.groupPairs, unitContrast(pairD, 1 + GROUP_COUNT + p), PAIR_STEP * PAIR_STEP * PP_PER_LOGIT, c.enough)),
  }));

  const summaries: AnalysisColumnSummary[] = columns.map((c) => ({
    column: c.column,
    battles: c.column === 'all'
      ? dataset.set.battles.duel + dataset.set.battles.team + dataset.set.battles.multi
      : dataset.set.battles[c.column],
    comparisons: c.comparisons,
    enough: c.enough,
    investmentEffect: estimate(c.fits.attributes, unitContrast(attributeD, 0), INVESTMENT_STEP * PP_PER_LOGIT, c.enough),
    stanceEffects: withStance
      ? {
        offensive: estimate(c.fits.attributes, unitContrast(attributeD, stanceAt), PP_PER_LOGIT, c.enough),
        defensive: estimate(c.fits.attributes, unitContrast(attributeD, stanceAt + 1), PP_PER_LOGIT, c.enough),
      }
      : null,
  }));

  const layerFit = await getLayerFit(params.range, newestId, dataset, now.getTime());

  return {
    status: 'ready',
    recordingSince: since.toISOString(),
    window: {
      range: params.range,
      from: dataset.from ? dataset.from.toISOString() : null,
      to: now.toISOString(),
      battlesInRange: dataset.battlesInRange,
      battlesUsed: dataset.battlesUsed,
      sampled: dataset.sampled,
    },
    toggles: { ...params.toggles },
    columns: summaries,
    attributes,
    groups,
    groupPairs,
    profiles: profiles.rows,
    layerFit,
    skipped: { ...dataset.set.skipped },
    robots: profiles.robots,
    generatedAt: now.toISOString(),
    computeMs: Date.now() - started,
  };
}

export async function getAttributeAnalysis(params: AttributeAnalysisParams): Promise<AttributeAnalysisResponse> {
  const now = params.now ?? new Date();
  const bounds = await getRecordingBounds();
  if (!bounds.since || now.getTime() - bounds.since.getTime() < MIN_RECORDING_DAYS * DAY_MS) {
    let battlesRecorded = 0;
    if (bounds.since) for (const count of (await countRecordedBattles(null)).values()) battlesRecorded += count;
    return {
      status: 'collecting',
      recordingSince: bounds.since ? bounds.since.toISOString() : null,
      availableFrom: bounds.since ? new Date(bounds.since.getTime() + MIN_RECORDING_DAYS * DAY_MS).toISOString() : null,
      battlesRecorded,
    };
  }
  const since = bounds.since;
  const key = `${params.range}|${togglesKey(params.toggles)}|${bounds.newestId}`;
  const cached = results.get(key);
  if (cached && fresh(cached.createdAt, now.getTime())) return cached.value;
  const running = inFlight.get(key);
  if (running) return running;
  const promise = compute(params, since, bounds.newestId, now)
    .then((value) => {
      remember(results, key, { value, createdAt: now.getTime() }, MAX_RESULTS);
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
