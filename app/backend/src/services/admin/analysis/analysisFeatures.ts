/**
 * Features of the "what wins" models, built from paired comparisons for one
 * set of layer toggles.
 *
 * Stance (when its toggle is on) adds two features of its own: the share of the
 * side fighting offensive and defensive (balanced is the reference). Combat
 * applies stance inside its formulas, never to attribute values, so it is
 * modelled as a separate effect rather than folded into the shares.
 *
 * Every model controls for investment: feature 0 is log(total A) − log(total B),
 * where total is the sum of the 23 layered values. The rest are differences of
 * shares (value / total), so they say how the points are spread, not how many.
 * A team side is the average of its robots.
 */
import { ROBOT_ATTRIBUTES } from '../../../shared/utils/robotAttributes';
import { ATTRIBUTE_GROUPS, ATTRIBUTE_GROUP_OF, type AnalysisColumn, type AttributeGroup, type LayerToggles } from './analysisOptions';
import { ATTRIBUTE_COUNT, layeredValues, type LayeredBuild } from './attributeLayers';
import type { Appearance, Comparison } from './comparisons';
import type { DesignMatrix } from './logisticFit';

export type ModelKind = 'attributes' | 'groups' | 'groupPairs';

export const GROUP_COUNT = ATTRIBUTE_GROUPS.length;

const GROUP_INDEX: readonly number[] = ROBOT_ATTRIBUTES.map((attr) => ATTRIBUTE_GROUPS.indexOf(ATTRIBUTE_GROUP_OF[attr]));

/** Attributes per group (6, 5, 5, 4, 3). */
export const GROUP_SIZE: readonly number[] = ATTRIBUTE_GROUPS.map((_, g) => GROUP_INDEX.filter((i) => i === g).length);

/** The 10 group pairs, in matrix order. */
export const GROUP_PAIRS: ReadonlyArray<readonly [number, number]> = ATTRIBUTE_GROUPS.flatMap((_, i) =>
  ATTRIBUTE_GROUPS.slice(i + 1).map((__, offset) => [i, i + 1 + offset] as const),
);

/** "Comparable investment": totals within about ±10%. */
export const COMPARABLE_LOG_TOTAL = 0.1;

/** Stance features (offensive, defensive) appended when the stance toggle is on. */
export const STANCE_FEATURES = 2;

function baseFeatureCount(kind: ModelKind): number {
  if (kind === 'attributes') return 1 + ATTRIBUTE_COUNT;
  if (kind === 'groups') return 1 + GROUP_COUNT;
  return 1 + GROUP_COUNT + GROUP_PAIRS.length;
}

export function featureCount(kind: ModelKind, withStance = false): number {
  return baseFeatureCount(kind) + (withStance ? STANCE_FEATURES : 0);
}

/** Index of the offensive stance feature (defensive follows it). */
export function stanceFeatureIndex(kind: ModelKind): number {
  return baseFeatureCount(kind);
}

/** Layered values per build for one toggle set, computed once per build. */
export class LayeredValueCache {
  private readonly values = new Map<LayeredBuild, Float64Array>();

  constructor(readonly toggles: LayerToggles) {}

  get(build: LayeredBuild): Float64Array {
    let v = this.values.get(build);
    if (!v) {
      v = layeredValues(build, this.toggles);
      this.values.set(build, v);
    }
    return v;
  }
}

export interface SideProfile {
  total: number;
  shares: Float64Array;
  groupShares: Float64Array;
  /** Share of the side's robots fighting offensive / defensive. */
  offensive: number;
  defensive: number;
}

function profileOfValues(values: Float64Array): SideProfile {
  let total = 0;
  for (let k = 0; k < values.length; k++) total += values[k];
  const shares = new Float64Array(ATTRIBUTE_COUNT);
  const groupShares = new Float64Array(GROUP_COUNT);
  if (total > 0) {
    for (let k = 0; k < values.length; k++) {
      shares[k] = values[k] / total;
      groupShares[GROUP_INDEX[k]] += shares[k];
    }
  }
  return { total, shares, groupShares, offensive: 0, defensive: 0 };
}

export function sideProfile(builds: readonly LayeredBuild[], cache: LayeredValueCache): SideProfile {
  const mean = new Float64Array(ATTRIBUTE_COUNT);
  for (const build of builds) {
    const v = cache.get(build);
    for (let k = 0; k < ATTRIBUTE_COUNT; k++) mean[k] += v[k] / builds.length;
  }
  const profile = profileOfValues(mean);
  profile.offensive = builds.filter((b) => b.stance === 'offensive').length / builds.length;
  profile.defensive = builds.filter((b) => b.stance === 'defensive').length / builds.length;
  return profile;
}

export function robotProfile(build: LayeredBuild, cache: LayeredValueCache): SideProfile {
  const profile = profileOfValues(cache.get(build));
  profile.offensive = build.stance === 'offensive' ? 1 : 0;
  profile.defensive = build.stance === 'defensive' ? 1 : 0;
  return profile;
}

function writeFeatures(kind: ModelKind, withStance: boolean, a: SideProfile, b: SideProfile, x: Float64Array, o: number): void {
  x[o] = Math.log(a.total) - Math.log(b.total);
  if (withStance) {
    const s = o + stanceFeatureIndex(kind);
    x[s] = a.offensive - b.offensive;
    x[s + 1] = a.defensive - b.defensive;
  }
  if (kind === 'attributes') {
    for (let k = 0; k < ATTRIBUTE_COUNT; k++) x[o + 1 + k] = a.shares[k] - b.shares[k];
    return;
  }
  for (let g = 0; g < GROUP_COUNT; g++) x[o + 1 + g] = a.groupShares[g] - b.groupShares[g];
  if (kind === 'groupPairs') {
    GROUP_PAIRS.forEach(([g, h], p) => {
      x[o + 1 + GROUP_COUNT + p] = a.groupShares[g] * a.groupShares[h] - b.groupShares[g] * b.groupShares[h];
    });
  }
}

const CHUNK = 5_000;
const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/** Design matrix for `comparisons` (kept in battle order, so clusters stay contiguous). */
export async function buildDesign(comparisons: readonly Comparison[], cache: LayeredValueCache, kind: ModelKind): Promise<DesignMatrix> {
  const withStance = cache.toggles.stance;
  const d = featureCount(kind, withStance);
  const n = comparisons.length;
  const x = new Float64Array(n * d);
  const y = new Float64Array(n);
  const w = new Float64Array(n);
  const cluster = new Int32Array(n);
  let rows = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0 && i % CHUNK === 0) await yieldToEventLoop();
    const c = comparisons[i];
    if (c.a.length === 0 || c.b.length === 0) continue;
    const a = sideProfile(c.a, cache);
    const b = sideProfile(c.b, cache);
    if (!(a.total > 0) || !(b.total > 0)) continue;
    writeFeatures(kind, withStance, a, b, x, rows * d);
    y[rows] = c.y;
    w[rows] = c.w;
    cluster[rows] = c.battleId;
    rows++;
  }
  return {
    rows,
    features: d,
    x: x.subarray(0, rows * d),
    y: y.subarray(0, rows),
    w: w.subarray(0, rows),
    cluster: cluster.subarray(0, rows),
  };
}

/** Penalise every share feature, never the investment control or the stance effects. */
export function penaltyMask(kind: ModelKind, withStance = false): boolean[] {
  const stanceAt = stanceFeatureIndex(kind);
  return Array.from({ length: featureCount(kind, withStance) }, (_, j) => j > 0 && j < stanceAt);
}

// ── Build profiles ───────────────────────────────────────────────────

/** A group is "heavy" at ≥ 1.5× the share an even spread gives it; a pair needs both ≥ 1.25×. */
export const HEAVY_RATIO = 1.5;
export const PAIR_RATIO = 1.25;

export type ProfileKey = 'balanced' | AttributeGroup | `${AttributeGroup}+${AttributeGroup}`;

export function profileKey(groupShares: Float64Array): ProfileKey {
  const ratios = ATTRIBUTE_GROUPS.map((group, g) => ({ group, g, ratio: groupShares[g] / (GROUP_SIZE[g] / ATTRIBUTE_COUNT) }));
  const sorted = [...ratios].sort((p, q) => q.ratio - p.ratio || p.g - q.g);
  const [top, second] = sorted;
  if (top.ratio >= PAIR_RATIO && second.ratio >= PAIR_RATIO) {
    const [first, last] = top.g < second.g ? [top, second] : [second, top];
    return `${first.group}+${last.group}`;
  }
  if (top.ratio >= HEAVY_RATIO) return top.group;
  return 'balanced';
}

export interface ProfileTally {
  /** Weighted wins and weight against a different profile at comparable investment. */
  wins: number;
  weight: number;
  comparisons: number;
}

/** Win tallies per mode column ('all' included) and profile. */
export async function profileTallies(
  comparisons: readonly Comparison[],
  cache: LayeredValueCache,
): Promise<Map<AnalysisColumn, Map<ProfileKey, ProfileTally>>> {
  const out = new Map<AnalysisColumn, Map<ProfileKey, ProfileTally>>();
  const add = (column: AnalysisColumn, key: ProfileKey, won: boolean, w: number): void => {
    let byProfile = out.get(column);
    if (!byProfile) {
      byProfile = new Map();
      out.set(column, byProfile);
    }
    const tally = byProfile.get(key) ?? { wins: 0, weight: 0, comparisons: 0 };
    tally.wins += won ? w : 0;
    tally.weight += w;
    tally.comparisons++;
    byProfile.set(key, tally);
  };
  for (let i = 0; i < comparisons.length; i++) {
    if (i > 0 && i % CHUNK === 0) await yieldToEventLoop();
    const c = comparisons[i];
    const a = sideProfile(c.a, cache);
    const b = sideProfile(c.b, cache);
    if (!(a.total > 0) || !(b.total > 0)) continue;
    if (Math.abs(Math.log(a.total) - Math.log(b.total)) >= COMPARABLE_LOG_TOTAL) continue;
    const pa = profileKey(a.groupShares);
    const pb = profileKey(b.groupShares);
    if (pa === pb) continue;
    for (const column of ['all', c.column] as const) {
      add(column, pa, c.y === 1, c.w);
      add(column, pb, c.y === 0, c.w);
    }
  }
  return out;
}

export interface UsageSummary {
  robots: number;
  humanRobots: number;
  byProfile: Map<ProfileKey, { all: number; human: number }>;
  /** Average share per attribute over all appearances / human appearances. */
  avgShare: Float64Array;
  humanAvgShare: Float64Array;
}

export async function usageSummary(appearances: readonly Appearance[], cache: LayeredValueCache): Promise<UsageSummary> {
  const avgShare = new Float64Array(ATTRIBUTE_COUNT);
  const humanAvgShare = new Float64Array(ATTRIBUTE_COUNT);
  const byProfile = new Map<ProfileKey, { all: number; human: number }>();
  let robots = 0;
  let humanRobots = 0;
  for (let i = 0; i < appearances.length; i++) {
    if (i > 0 && i % CHUNK === 0) await yieldToEventLoop();
    const appearance = appearances[i];
    const profile = robotProfile(appearance.build, cache);
    if (!(profile.total > 0)) continue;
    robots++;
    for (let k = 0; k < ATTRIBUTE_COUNT; k++) avgShare[k] += profile.shares[k];
    const key = profileKey(profile.groupShares);
    const entry = byProfile.get(key) ?? { all: 0, human: 0 };
    entry.all++;
    if (appearance.human) {
      humanRobots++;
      entry.human++;
      for (let k = 0; k < ATTRIBUTE_COUNT; k++) humanAvgShare[k] += profile.shares[k];
    }
    byProfile.set(key, entry);
  }
  for (let k = 0; k < ATTRIBUTE_COUNT; k++) {
    avgShare[k] = robots > 0 ? avgShare[k] / robots : 0;
    humanAvgShare[k] = humanRobots > 0 ? humanAvgShare[k] / humanRobots : 0;
  }
  return { robots, humanRobots, byProfile, avgShare, humanAvgShare };
}
