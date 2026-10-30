/**
 * Admin Weapons page (`GET /api/admin/analysis/weapons`): which weapons,
 * archetypes (main weapon range band × loadout) and matchups win, per mode
 * column, from the battle-time build records, plus what is used per league
 * tier, refinements and catalogue coverage.
 *
 * Same comparisons and loaded window as the Attributes analysis. Every effect
 * is against an equally strong opponent: the same points invested
 * (base + tuning) and stance. Method: docs/guides/ADMIN_PANEL_GUIDE.md §Weapons.
 * Results are cached per window and strength until a new build is recorded.
 */
import {
  ANALYSIS_COLUMNS,
  ARCHETYPES,
  LOADOUTS,
  MATCHUP_TOP_ARCHETYPES,
  MIN_CELL_COMPARISONS,
  MIN_COMPARISONS,
  RANGE_BANDS,
  TIER_MIN_ROBOTS,
  TIER_SEGMENTS,
  USAGE_TIERS,
  type AnalysisColumn,
  type AnalysisRange,
  type AnalysisStrength,
  type MatchupView,
  type UsageTier,
} from './analysisOptions';
import { REFINEMENT_TIERS, REFINEMENT_TIER_BITS, type LayeredBuild, type RefinementTier } from './attributeLayers';
import { fresh, getDataset, getReadiness, remember, type CacheEntry } from './analysisDataset';
import { INVESTMENT_STEP, NO_ESTIMATE, PP_PER_LOGIT, estimate, round, unitContrast, weightedContrast } from './analysisEffects';
import { fitLogistic, sigmoid, type FitResult } from './logisticFit';
import type { Appearance, Comparison, ModeColumn } from './comparisons';
import { loadWeaponCatalogue, weaponsOwnedByPlayers } from './weaponCatalogue';
import {
  ARCHETYPE_OFFSET,
  CONTROL_FEATURES,
  REFINED_FEATURE,
  WEAPON_OFFSET,
  WeaponIndex,
  archetypeKey,
  buildChoiceDesign,
  buildMatchupDesign,
  choicePenaltyMask,
  matchupPenaltyMask,
  pairIndex,
  rawTallies,
  strengthCuts,
  strongAppearances,
  strongComparisons,
  type CountedDesign,
  type RawTallies,
} from './weaponFeatures';
import type {
  ArchetypeRow,
  ChoiceResult,
  ColumnMatchups,
  CoverageSummary,
  MatchupCell,
  MatchupGrid,
  RefinementSummary,
  TierUsage,
  WeaponAnalysisReady,
  WeaponAnalysisResponse,
  WeaponColumnSummary,
  WeaponRow,
} from './weaponAnalysisTypes';

const MAX_RESULTS = 8;

export interface WeaponAnalysisParams {
  range: AnalysisRange;
  strength: AnalysisStrength;
  /** Injected for tests; defaults to now. */
  now?: Date;
}

const results = new Map<string, CacheEntry<WeaponAnalysisReady>>();
const inFlight = new Map<string, Promise<WeaponAnalysisReady>>();

/** Forget cached results (tests). The loaded window is shared; see `clearDatasetCache`. */
export function clearWeaponAnalysisCache(): void {
  results.clear();
  inFlight.clear();
}

// ── Usage ────────────────────────────────────────────────────────────

interface Counts {
  all: Int32Array;
  human: Int32Array;
}

interface Usage {
  robots: number;
  humanRobots: number;
  weapons: Counts;
  archetypes: Counts;
  refined: number;
  refinementTiers: Record<RefinementTier, number>;
  /** Per tier: robots, human robots, robots per archetype. */
  tiers: Map<UsageTier, { robots: number; human: number; archetypes: Int32Array }>;
}

function counts(size: number): Counts {
  return { all: new Int32Array(size), human: new Int32Array(size) };
}

function usageOf(appearances: readonly Appearance[], index: WeaponIndex): Usage {
  const usage: Usage = {
    robots: 0,
    humanRobots: 0,
    weapons: counts(index.size),
    archetypes: counts(ARCHETYPES.length),
    refined: 0,
    refinementTiers: { hone: 0, augment: 0, sharpen: 0, forge: 0 },
    tiers: new Map(),
  };
  for (const { build, human, tier } of appearances) {
    usage.robots++;
    if (human) usage.humanRobots++;
    for (const i of index.carried(build)) {
      usage.weapons.all[i]++;
      if (human) usage.weapons.human[i]++;
    }
    const k = index.archetype(build);
    if (k >= 0) {
      usage.archetypes.all[k]++;
      if (human) usage.archetypes.human[k]++;
    }
    if (build.refinementTiers !== 0) usage.refined++;
    for (const t of REFINEMENT_TIERS) if (build.refinementTiers & REFINEMENT_TIER_BITS[t]) usage.refinementTiers[t]++;
    if (tier && (USAGE_TIERS as readonly string[]).includes(tier)) {
      const key = tier as UsageTier;
      const row = usage.tiers.get(key) ?? { robots: 0, human: 0, archetypes: new Int32Array(ARCHETYPES.length) };
      row.robots++;
      if (human) row.human++;
      if (k >= 0) row.archetypes[k]++;
      usage.tiers.set(key, row);
    }
  }
  return usage;
}

function share(part: number, whole: number): number {
  return whole > 0 ? round(part / whole, 4) : 0;
}

function playersShare(part: number, humanRobots: number): number | null {
  return humanRobots > 0 ? round(part / humanRobots, 4) : null;
}

function tierUsage(usage: Usage): TierUsage {
  const rows = USAGE_TIERS.map((tier) => ({ tier, row: usage.tiers.get(tier) })).filter((r) => r.row && r.row.robots > 0);
  // Segments: the archetypes with the highest share in any tier with enough robots.
  const peak = new Float64Array(ARCHETYPES.length);
  for (const { row } of rows) {
    if (!row || row.robots < TIER_MIN_ROBOTS) continue;
    for (let k = 0; k < ARCHETYPES.length; k++) peak[k] = Math.max(peak[k], row.archetypes[k] / row.robots);
  }
  const segments = ARCHETYPES.map((_, k) => k)
    .filter((k) => peak[k] > 0)
    .sort((p, q) => peak[q] - peak[p] || usage.archetypes.all[q] - usage.archetypes.all[p])
    .slice(0, TIER_SEGMENTS);
  return {
    segments: segments.map(archetypeKey),
    rows: rows.map(({ tier, row }) => {
      const r = row as NonNullable<typeof row>;
      const shares = segments.map((k) => share(r.archetypes[k], r.robots));
      const other = Math.max(0, round(1 - shares.reduce((s, v) => s + v, 0), 4));
      return { tier, robots: r.robots, playersShare: playersShare(r.human, r.robots), shares: [...shares, other] };
    }),
  };
}

// ── Fits ─────────────────────────────────────────────────────────────

async function fit(counted: CountedDesign, penalised: boolean[]): Promise<FitResult | null> {
  return counted.design.rows > 0 ? fitLogistic(counted.design, { penalised }) : null;
}

/** Usage weights over a block (sum 1), for "vs the average robot" contrasts. */
function weights(all: Int32Array): Float64Array {
  let total = 0;
  for (const v of all) total += v;
  return Float64Array.from(all, (v) => (total > 0 ? v / total : 0));
}

function choiceResult(
  k: number,
  usageCounts: Counts,
  usage: Usage,
  tallies: RawTallies,
  model: { fit: FitResult | null; nonZero: Int32Array; d: number; offset: number; weights: Float64Array },
  enough: boolean,
): ChoiceResult {
  const cellEnough = enough && model.nonZero[model.offset + k] >= MIN_CELL_COMPARISONS;
  return {
    robots: usageCounts.all[k],
    share: share(usageCounts.all[k], usage.robots),
    playersShare: playersShare(usageCounts.human[k], usage.humanRobots),
    comparisons: tallies.comparisons[k],
    rawWinRate: tallies.weight[k] > 0 && tallies.comparisons[k] >= MIN_CELL_COMPARISONS ? round(tallies.wins[k] / tallies.weight[k], 4) : null,
    effect: estimate(model.fit, weightedContrast(model.d, model.offset, model.weights, k), PP_PER_LOGIT, cellEnough),
  };
}

const NO_CELL: MatchupCell = { winRate: null, se: null, significant: false, comparisons: 0 };

async function matchupGrid(
  comparisons: readonly Comparison[],
  labels: string[],
  categoryOf: (build: LayeredBuild) => number,
): Promise<MatchupGrid> {
  const k = labels.length;
  const counted = await buildMatchupDesign(comparisons, categoryOf, k);
  const fitted = await fit(counted, matchupPenaltyMask(k));
  const d = counted.design.features;
  const cells = labels.map((_, i) => labels.map((__, j): MatchupCell => {
    if (i === j) return NO_CELL;
    const p = CONTROL_FEATURES + pairIndex(Math.min(i, j), Math.max(i, j), k);
    const n = counted.nonZero[p];
    if (!fitted || n < MIN_CELL_COMPARISONS) return { ...NO_CELL, comparisons: n };
    const beta = (i < j ? 1 : -1) * fitted.beta[p];
    const seBeta = Math.sqrt(Math.max(fitted.covariance[p * d + p], 0));
    const winRate = sigmoid(beta);
    if (!Number.isFinite(beta) || !Number.isFinite(seBeta)) return { ...NO_CELL, comparisons: n };
    return {
      winRate: round(winRate, 4),
      se: round(100 * winRate * (1 - winRate) * seBeta, 2),
      significant: seBeta > 0 && Math.abs(beta) >= 2 * seBeta,
      comparisons: n,
    };
  }));
  return { labels, cells };
}

async function columnMatchups(comparisons: readonly Comparison[], index: WeaponIndex, usage: Usage): Promise<ColumnMatchups> {
  const single = comparisons.filter((c) => c.a.length === 1 && c.b.length === 1);
  const top = ARCHETYPES.map((_, k) => k)
    .filter((k) => usage.archetypes.all[k] > 0)
    .sort((p, q) => usage.archetypes.all[q] - usage.archetypes.all[p])
    .slice(0, MATCHUP_TOP_ARCHETYPES);
  const views: Record<MatchupView, MatchupGrid> = {
    bands: await matchupGrid(single, [...RANGE_BANDS], (b) => index.band(b)),
    loadouts: await matchupGrid(single, [...LOADOUTS], (b) => index.loadout(b)),
    archetypes: await matchupGrid(single, top.map(archetypeKey), (b) => top.indexOf(index.archetype(b))),
  };
  return { comparisons: single.length, views };
}

// ── Orchestration ────────────────────────────────────────────────────

interface ColumnResult {
  summary: WeaponColumnSummary;
  weapons: ChoiceResult[];
  archetypes: ChoiceResult[];
  matchups: ColumnMatchups | null;
  tiers: TierUsage;
  refinements: RefinementSummary;
  coverage: CoverageSummary;
}

async function analyseColumn(
  column: AnalysisColumn,
  comparisons: readonly Comparison[],
  appearances: readonly Appearance[],
  index: WeaponIndex,
  cut: number | null,
): Promise<ColumnResult> {
  const usage = usageOf(appearances, index);
  const enough = comparisons.length >= MIN_COMPARISONS;
  const weaponDesign = await buildChoiceDesign(comparisons, 'weapons', index);
  const weaponFit = enough ? await fit(weaponDesign, choicePenaltyMask('weapons', index)) : null;
  const archetypeDesign = await buildChoiceDesign(comparisons, 'archetypes', index);
  const archetypeFit = enough ? await fit(archetypeDesign, choicePenaltyMask('archetypes', index)) : null;
  const weaponTallies = await rawTallies(comparisons, (b) => index.carried(b), index.size);
  const archetypeTallies = await rawTallies(comparisons, (b) => {
    const k = index.archetype(b);
    return k >= 0 ? [k] : [];
  }, ARCHETYPES.length);

  const weaponModel = { fit: weaponFit, nonZero: weaponDesign.nonZero, d: weaponDesign.design.features, offset: WEAPON_OFFSET, weights: weights(usage.weapons.all) };
  const archetypeModel = { fit: archetypeFit, nonZero: archetypeDesign.nonZero, d: archetypeDesign.design.features, offset: ARCHETYPE_OFFSET, weights: weights(usage.archetypes.all) };
  const refinedEnough = enough && weaponDesign.nonZero[REFINED_FEATURE] >= MIN_CELL_COMPARISONS;

  const tierShares = {} as Record<RefinementTier, number>;
  for (const t of REFINEMENT_TIERS) tierShares[t] = share(usage.refinementTiers[t], usage.robots);

  let fought = 0;
  let foughtByPlayers = 0;
  for (let i = 0; i < index.size; i++) {
    if (usage.weapons.all[i] > 0) fought++;
    if (usage.weapons.human[i] > 0) foughtByPlayers++;
  }

  return {
    summary: {
      column,
      battles: new Set(comparisons.map((c) => c.battleId)).size,
      comparisons: comparisons.length,
      enough,
      robots: usage.robots,
      humanRobots: usage.humanRobots,
      strengthCut: cut,
      investmentEffect: estimate(weaponFit, unitContrast(weaponModel.d, 0), INVESTMENT_STEP * PP_PER_LOGIT, enough),
    },
    weapons: index.weapons.map((_, i) => choiceResult(i, usage.weapons, usage, weaponTallies, weaponModel, enough)),
    archetypes: ARCHETYPES.map((_, k) => choiceResult(k, usage.archetypes, usage, archetypeTallies, archetypeModel, enough)),
    matchups: column === 'team' ? null : await columnMatchups(comparisons, index, usage),
    tiers: tierUsage(usage),
    refinements: {
      robots: usage.robots,
      refinedShare: share(usage.refined, usage.robots),
      tierShares,
      comparisons: weaponDesign.nonZero[REFINED_FEATURE],
      effect: refinedEnough ? estimate(weaponFit, unitContrast(weaponModel.d, REFINED_FEATURE), PP_PER_LOGIT, true) : NO_ESTIMATE,
    },
    coverage: { catalogue: index.size, fought, foughtByPlayers },
  };
}

async function compute(params: WeaponAnalysisParams, since: Date, newestId: number, now: Date): Promise<WeaponAnalysisReady> {
  const started = Date.now();
  const dataset = await getDataset(params.range, since, newestId, now);
  const [catalogue, owned] = await Promise.all([loadWeaponCatalogue(), weaponsOwnedByPlayers()]);
  const index = new WeaponIndex(catalogue);

  const cuts = params.strength === 'top10' ? strengthCuts(dataset.set.appearances) : null;
  const comparisons = cuts ? strongComparisons(dataset.set.comparisons, cuts) : dataset.set.comparisons;
  const appearances = cuts ? strongAppearances(dataset.set.appearances, cuts) : dataset.set.appearances;

  const byColumn = {} as Record<AnalysisColumn, ColumnResult>;
  for (const column of ANALYSIS_COLUMNS) {
    const columnComparisons = column === 'all' ? comparisons : comparisons.filter((c) => c.column === column);
    const columnAppearances = column === 'all' ? appearances : appearances.filter((a) => a.column === column);
    const cut = cuts && column !== 'all' ? cuts[column as ModeColumn] : null;
    byColumn[column] = await analyseColumn(column, columnComparisons, columnAppearances, index, cut);
  }

  const perColumn = <T>(pick: (r: ColumnResult) => T): Record<AnalysisColumn, T> => {
    const out = {} as Record<AnalysisColumn, T>;
    for (const column of ANALYSIS_COLUMNS) out[column] = pick(byColumn[column]);
    return out;
  };

  const weapons: WeaponRow[] = catalogue.map((w, i) => ({
    weaponId: w.id,
    name: w.name,
    weaponType: w.weaponType,
    handsRequired: w.handsRequired,
    rangeBand: w.rangeBand,
    cost: w.cost,
    results: perColumn((r) => r.weapons[i]),
  }));
  const archetypes: ArchetypeRow[] = ARCHETYPES.map((key, k) => {
    const [rangeBand, loadout] = key.split('+') as [ArchetypeRow['rangeBand'], ArchetypeRow['loadout']];
    return { key, rangeBand, loadout, results: perColumn((r) => r.archetypes[k]) };
  });

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
    strength: params.strength,
    columns: ANALYSIS_COLUMNS.map((column) => byColumn[column].summary),
    weapons,
    archetypes,
    matchups: perColumn((r) => r.matchups),
    tiers: perColumn((r) => r.tiers),
    refinements: perColumn((r) => r.refinements),
    coverage: perColumn((r) => r.coverage),
    notOwnedByPlayers: catalogue
      .filter((w) => !owned.has(w.id))
      .map((w) => ({ weaponId: w.id, name: w.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    skipped: { ...dataset.set.skipped },
    generatedAt: now.toISOString(),
    computeMs: Date.now() - started,
  };
}

export async function getWeaponAnalysis(params: WeaponAnalysisParams): Promise<WeaponAnalysisResponse> {
  const now = params.now ?? new Date();
  const readiness = await getReadiness(now);
  if (!readiness.ready) return readiness.collecting;
  const { since, newestId } = readiness;
  const key = `${params.range}|${params.strength}|${newestId}`;
  const cached = results.get(key);
  if (cached && fresh(cached.createdAt, now.getTime())) return cached.value;
  const running = inFlight.get(key);
  if (running) return running;
  const promise = compute(params, since, newestId, now)
    .then((value) => {
      remember(results, key, { value, createdAt: now.getTime() }, MAX_RESULTS);
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
