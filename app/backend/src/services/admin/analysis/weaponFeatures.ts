/**
 * Features of the Weapons models, built from the same paired comparisons as
 * the Attributes analysis.
 *
 * "Equally strong" = the same points invested (base + tuning, summed over the
 * 23 attributes) and the same stance. Weapon bonuses, refinements and the
 * loadout multiplier are deliberately NOT in the control: they come with the
 * weapon choice, so a weapon gets the credit for its own bonuses.
 *
 * Every model has three controls: log(invested A) − log(invested B), and the
 * differences in the share of each side fighting offensive / defensive. The
 * choice features are differences of side shares (a team side is the average
 * of its robots):
 * - weapons: per catalogue weapon, the share of the side's robots carrying it
 *   in either slot, plus the share of robots with any refinement;
 * - archetypes: per main-weapon range band × loadout, the share of the side;
 * - matchups: single-robot comparisons only, one antisymmetric feature per
 *   pair of categories (+1 when A is the first, −1 when A is the second).
 */
import { ARCHETYPES, LOADOUTS, RANGE_BANDS, TOP_STRENGTH_SHARE, type ArchetypeKey } from './analysisOptions';
import type { LayeredBuild } from './attributeLayers';
import type { Appearance, Comparison, ModeColumn } from './comparisons';
import type { DesignMatrix } from './logisticFit';
import type { CatalogueWeapon } from './weaponCatalogue';

/** log points invested, offensive share, defensive share. */
export const CONTROL_FEATURES = 3;
/** Weapons model: the refined-share feature, then one feature per catalogue weapon. */
export const REFINED_FEATURE = CONTROL_FEATURES;
export const WEAPON_OFFSET = CONTROL_FEATURES + 1;
/** Archetypes model: one feature per archetype after the controls. */
export const ARCHETYPE_OFFSET = CONTROL_FEATURES;

const CHUNK = 5_000;
const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/** Catalogue lookups for builds: weapon index, range band, loadout and archetype. */
export class WeaponIndex {
  readonly weapons: readonly CatalogueWeapon[];
  private readonly indexById = new Map<number, number>();
  private readonly bandById = new Map<number, number>();

  constructor(catalogue: readonly CatalogueWeapon[]) {
    this.weapons = catalogue;
    catalogue.forEach((weapon, i) => {
      this.indexById.set(weapon.id, i);
      this.bandById.set(weapon.id, (RANGE_BANDS as readonly string[]).indexOf(weapon.rangeBand));
    });
  }

  get size(): number {
    return this.weapons.length;
  }

  /** Distinct catalogue weapons the robot carried (main and offhand slot). */
  carried(build: LayeredBuild): number[] {
    const out: number[] = [];
    for (const id of [build.mainWeaponId, build.offhandWeaponId]) {
      if (id === null) continue;
      const i = this.indexById.get(id);
      if (i !== undefined && !out.includes(i)) out.push(i);
    }
    return out;
  }

  /** `RANGE_BANDS` index of the main weapon, or −1. */
  band(build: LayeredBuild): number {
    return build.mainWeaponId === null ? -1 : this.bandById.get(build.mainWeaponId) ?? -1;
  }

  /** `LOADOUTS` index, or −1. */
  loadout(build: LayeredBuild): number {
    return (LOADOUTS as readonly string[]).indexOf(build.loadoutType);
  }

  /** `ARCHETYPES` index (band × loadout), or −1. */
  archetype(build: LayeredBuild): number {
    const band = this.band(build);
    const loadout = this.loadout(build);
    return band < 0 || loadout < 0 ? -1 : band * LOADOUTS.length + loadout;
  }
}

export function archetypeKey(index: number): ArchetypeKey {
  return ARCHETYPES[index];
}

// ── Strength ─────────────────────────────────────────────────────────

/**
 * Points invested from which a robot is in the top 10% of its mode column,
 * over the robots that fought in the window. Null for a column without robots.
 */
export function strengthCuts(appearances: readonly Appearance[]): Record<ModeColumn, number | null> {
  const values: Record<ModeColumn, number[]> = { duel: [], team: [], multi: [] };
  for (const a of appearances) values[a.column].push(a.build.invested);
  const cut = (list: number[]): number | null => {
    if (list.length === 0) return null;
    list.sort((p, q) => p - q);
    return list[Math.min(list.length - 1, Math.floor(list.length * (1 - TOP_STRENGTH_SHARE)))];
  };
  return { duel: cut(values.duel), team: cut(values.team), multi: cut(values.multi) };
}

function isStrong(build: LayeredBuild, cut: number | null): boolean {
  return cut !== null && build.invested >= cut;
}

/** Comparisons in which every robot on both sides is in the top 10% of its column. */
export function strongComparisons(comparisons: readonly Comparison[], cuts: Record<ModeColumn, number | null>): Comparison[] {
  return comparisons.filter((c) => c.a.every((b) => isStrong(b, cuts[c.column])) && c.b.every((b) => isStrong(b, cuts[c.column])));
}

export function strongAppearances(appearances: readonly Appearance[], cuts: Record<ModeColumn, number | null>): Appearance[] {
  return appearances.filter((a) => isStrong(a.build, cuts[a.column]));
}

// ── Designs ──────────────────────────────────────────────────────────

export type ChoiceModel = 'weapons' | 'archetypes';

export function choiceFeatureCount(model: ChoiceModel, index: WeaponIndex): number {
  return model === 'weapons' ? WEAPON_OFFSET + index.size : ARCHETYPE_OFFSET + ARCHETYPES.length;
}

/** Penalise the choice features (and the refined share), never the controls. */
export function choicePenaltyMask(model: ChoiceModel, index: WeaponIndex): boolean[] {
  return Array.from({ length: choiceFeatureCount(model, index) }, (_, j) => j >= CONTROL_FEATURES);
}

interface SideControls {
  logInvested: number;
  offensive: number;
  defensive: number;
}

function sideControls(builds: readonly LayeredBuild[]): SideControls | null {
  let invested = 0;
  let offensive = 0;
  let defensive = 0;
  for (const b of builds) {
    invested += b.invested / builds.length;
    if (b.stance === 'offensive') offensive++;
    if (b.stance === 'defensive') defensive++;
  }
  if (!(invested > 0)) return null;
  return { logInvested: Math.log(invested), offensive: offensive / builds.length, defensive: defensive / builds.length };
}

function writeControls(a: SideControls, b: SideControls, x: Float64Array, o: number): void {
  x[o] = a.logInvested - b.logInvested;
  x[o + 1] = a.offensive - b.offensive;
  x[o + 2] = a.defensive - b.defensive;
}

/** Add the side's choice shares (sign +1 for side A, −1 for side B). */
function writeChoices(model: ChoiceModel, index: WeaponIndex, builds: readonly LayeredBuild[], sign: number, x: Float64Array, o: number): void {
  const unit = sign / builds.length;
  for (const build of builds) {
    if (model === 'weapons') {
      if (build.refinementTiers !== 0) x[o + REFINED_FEATURE] += unit;
      for (const i of index.carried(build)) x[o + WEAPON_OFFSET + i] += unit;
    } else {
      const k = index.archetype(build);
      if (k >= 0) x[o + ARCHETYPE_OFFSET + k] += unit;
    }
  }
}

export interface CountedDesign {
  design: DesignMatrix;
  /** Rows with a non-zero value, per feature ("comparisons where it differs"). */
  nonZero: Int32Array;
}

function emptyDesign(rows: number, d: number): { x: Float64Array; y: Float64Array; w: Float64Array; cluster: Int32Array } {
  return { x: new Float64Array(rows * d), y: new Float64Array(rows), w: new Float64Array(rows), cluster: new Int32Array(rows) };
}

function finish(rows: number, d: number, parts: ReturnType<typeof emptyDesign>, nonZero: Int32Array): CountedDesign {
  return {
    design: {
      rows,
      features: d,
      x: parts.x.subarray(0, rows * d),
      y: parts.y.subarray(0, rows),
      w: parts.w.subarray(0, rows),
      cluster: parts.cluster.subarray(0, rows),
    },
    nonZero,
  };
}

/** Design of the weapons or archetypes model (rows in battle order, so clusters stay contiguous). */
export async function buildChoiceDesign(comparisons: readonly Comparison[], model: ChoiceModel, index: WeaponIndex): Promise<CountedDesign> {
  const d = choiceFeatureCount(model, index);
  const parts = emptyDesign(comparisons.length, d);
  const nonZero = new Int32Array(d);
  let rows = 0;
  for (let i = 0; i < comparisons.length; i++) {
    if (i > 0 && i % CHUNK === 0) await yieldToEventLoop();
    const c = comparisons[i];
    if (c.a.length === 0 || c.b.length === 0) continue;
    const a = sideControls(c.a);
    const b = sideControls(c.b);
    if (!a || !b) continue;
    const o = rows * d;
    writeControls(a, b, parts.x, o);
    writeChoices(model, index, c.a, 1, parts.x, o);
    writeChoices(model, index, c.b, -1, parts.x, o);
    for (let j = 0; j < d; j++) {
      // Shares of identical sides cancel to float noise; treat that as no difference.
      if (Math.abs(parts.x[o + j]) < 1e-9) parts.x[o + j] = 0;
      else nonZero[j]++;
    }
    parts.y[rows] = c.y;
    parts.w[rows] = c.w;
    parts.cluster[rows] = c.battleId;
    rows++;
  }
  return finish(rows, d, parts, nonZero);
}

/** Index of the pair (i < j) among the K·(K−1)/2 pairs of K categories. */
export function pairIndex(i: number, j: number, k: number): number {
  return i * k - (i * (i + 1)) / 2 + (j - i - 1);
}

/**
 * Design of a matchup grid over `k` categories: single-robot comparisons whose
 * robots are in different categories (`categoryOf` −1 = not in the grid).
 */
export async function buildMatchupDesign(
  comparisons: readonly Comparison[],
  categoryOf: (build: LayeredBuild) => number,
  k: number,
): Promise<CountedDesign> {
  const pairs = (k * (k - 1)) / 2;
  const d = CONTROL_FEATURES + pairs;
  const parts = emptyDesign(comparisons.length, d);
  const nonZero = new Int32Array(d);
  let rows = 0;
  for (let i = 0; i < comparisons.length; i++) {
    if (i > 0 && i % CHUNK === 0) await yieldToEventLoop();
    const c = comparisons[i];
    if (c.a.length !== 1 || c.b.length !== 1) continue;
    const ca = categoryOf(c.a[0]);
    const cb = categoryOf(c.b[0]);
    if (ca < 0 || cb < 0 || ca === cb) continue;
    const a = sideControls(c.a);
    const b = sideControls(c.b);
    if (!a || !b) continue;
    const o = rows * d;
    writeControls(a, b, parts.x, o);
    const p = CONTROL_FEATURES + pairIndex(Math.min(ca, cb), Math.max(ca, cb), k);
    parts.x[o + p] = ca < cb ? 1 : -1;
    nonZero[p]++;
    parts.y[rows] = c.y;
    parts.w[rows] = c.w;
    parts.cluster[rows] = c.battleId;
    rows++;
  }
  return finish(rows, d, parts, nonZero);
}

/** Matchup features are penalised lightly; the controls never. */
export function matchupPenaltyMask(k: number): boolean[] {
  return Array.from({ length: CONTROL_FEATURES + (k * (k - 1)) / 2 }, (_, j) => j >= CONTROL_FEATURES);
}

// ── Raw win rates ────────────────────────────────────────────────────

export interface RawTallies {
  wins: Float64Array;
  weight: Float64Array;
  comparisons: Int32Array;
}

/**
 * For each choice: comparisons where only one side had it (any of its robots),
 * and the weighted share that side won.
 */
export async function rawTallies(
  comparisons: readonly Comparison[],
  membersOf: (build: LayeredBuild) => readonly number[],
  size: number,
): Promise<RawTallies> {
  const wins = new Float64Array(size);
  const weight = new Float64Array(size);
  const counts = new Int32Array(size);
  const side = (builds: readonly LayeredBuild[]): Set<number> => {
    const out = new Set<number>();
    for (const b of builds) for (const m of membersOf(b)) out.add(m);
    return out;
  };
  for (let i = 0; i < comparisons.length; i++) {
    if (i > 0 && i % CHUNK === 0) await yieldToEventLoop();
    const c = comparisons[i];
    const a = side(c.a);
    const b = side(c.b);
    for (const m of a) {
      if (b.has(m)) continue;
      counts[m]++;
      weight[m] += c.w;
      if (c.y === 1) wins[m] += c.w;
    }
    for (const m of b) {
      if (a.has(m)) continue;
      counts[m]++;
      weight[m] += c.w;
      if (c.y === 0) wins[m] += c.w;
    }
  }
  return { wins, weight, comparisons: counts };
}
