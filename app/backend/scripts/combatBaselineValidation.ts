/**
 * Combat balance validation harness (#516 step 2: #517/#518 baseline; Season 2 package #519–#522).
 *
 *   pnpm exec tsx scripts/combatBaselineValidation.ts \
 *     --arms main=<backendDir>,521=<backendDir>,…,combined=<backendDir> \
 *     --suite range|loadout|mobility|grand-melee|koth \
 *     [--builds uniform|invest] [--level 10] [--budget early|mid|late] \
 *     [--koth-radii 5,7] [--trials 2000] [--seed 516] [--out <file.md>]
 *
 * Each `--arms` entry points at an `app/backend` directory of a checkout (git worktree) of one
 * code revision. The first arm is the baseline. The script `require`s that arm's own
 * `prepareRobotForCombat`, `simulateBattleMulti`, weapon catalogue (`WEAPON_DEFINITIONS` from its
 * `prisma/seed`) and, for `koth`, its own KotH engine (`src/services/arena/kothEngine`), so every
 * arm runs its real code and its real catalogue in one process; nothing is re-implemented or
 * patched. Weapons are sampled by name from the FIRST arm's catalogue; each arm then uses its own
 * definition of that name (stats and price), and the run fails if an arm lacks the name. No
 * database is used: each arm's seed Prisma client is created on import, never queried, and
 * disconnected at the end.
 *
 * Pairing: trial t of a cell uses the same setup (loadouts, weapon names, spawn side/permutation)
 * and the same battle seed in every arm. `Math.random` is replaced by a seeded mulberry32 for the
 * duration of each battle. Arms diverge after their first differing random draw, so pairing
 * shares the starting conditions, not the whole trajectory. Deltas are per-trial paired
 * differences (column − baseline column) with a normal-approximation 95% CI (±1.96·sd/√n).
 *
 * Builds (balanced stance, yield threshold 10, no tuning, no refinements, no Workshop discount):
 *   - uniform (default)  all 23 attributes at --level; weapons sampled uniformly from each
 *                        range/hands category of the first arm's catalogue.
 *   - invest             #516 equal-investment builds at --budget early | mid | late: a per-robot
 *                        budget of ₡1,500,000 / ₡5,000,000 / ₡15,000,000 with attribute caps
 *                        15 / 30 / 45 (academies are outside the budget). Weapons are bought at the
 *                        arm's catalogue price (Dual Wield buys two copies, Weapon+Shield a weapon
 *                        plus a shield). Weapon candidates are the category entries whose loadout
 *                        cost (at the first arm's prices) is ≤ 40% of the budget, sampled uniformly
 *                        (Weapon+Shield: uniformly among weapon × shield pairs); if none qualifies
 *                        the cheapest entry/pair is used. The rest of the budget (budget − loadout
 *                        cost at the arm's own prices) is spent greedily one level at a time on the
 *                        cheapest next level (`calculateBaseCost`; ties in list order), all attributes
 *                        starting at 1: first the focus attributes until they are capped or the
 *                        cheapest next focus level is unaffordable, then the remaining attributes
 *                        (`ROBOT_ATTRIBUTES` order) the same way. Focus: every build combatPower,
 *                        targetingSystems, attackSpeed, hullIntegrity, armorPlating; melee
 *                        + hydraulicSystems, servoMotors, gyroStabilizers; short + hydraulicSystems,
 *                        servoMotors, evasionThrusters; mid/long + logicCores, servoMotors,
 *                        evasionThrusters; Weapon+Shield + shieldCapacity. The rule is identical in
 *                        every arm; only the prices differ.
 *
 * Suites:
 *   - range        1v1, one cell per range-class pair (melee/short/mid/long, mirrors included);
 *                  each side's loadout is sampled independently and uniformly.
 *   - loadout      1v1, one cell per loadout pair (single/weapon_shield/two_handed/dual_wield);
 *                  both sides share one uniformly sampled range class per trial.
 *   - mobility     1v1 (uniform builds only), uniform melee vs a short/mid/long "kiter" that
 *                  moved its Hydraulic Systems points into Servo Motors (same attribute total:
 *                  servo 2L − 1, hydraulics 1). Identical to `range` at level 1.
 *   - grand-melee  16-robot Grand Melee (one robot per range class × loadout, spawn order
 *                  shuffled per trial), production config: allowDraws false,
 *                  arenaRadius 16 + (N − 2) × 3, placements as grandMeleeBattleOrchestrator.
 *   - koth         6-robot King of the Hill fields (range class × loadout sampled uniformly per
 *                  robot, spawn order as sampled), orchestration as
 *                  kothBattleOrchestrator.processKothBattle with the arm's own KotH engine
 *                  (buildKothGameModeConfig, buildKothInitialState, buildKothTickHook,
 *                  buildEnrichedPlacements): allowDraws false, arenaRadius 14, maxDuration 150,
 *                  scoreThreshold 30, zone radius per --koth-radii. Columns are arm × radius; the
 *                  baseline column is the first arm at the first radius.
 * Sides alternate every trial in the 1v1 suites (A moves in slot 0 on even trials). 1v1 uses
 * league rules (draws allowed). 1v1 metrics include "melee-reach entries" (side A's
 * `range_transition` events into the melee band per battle) and "slot-0 score" (score of the
 * robot in the first simulator slot; 50% when robot order has no effect).
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ROBOT_ATTRIBUTES } from '../src/shared/utils/robotAttributes';
import { calculateBaseCost } from '../src/shared/utils/upgradeCosts';
import type {
  RobotWithWeapons,
  BattleConfig,
  SpatialCombatResult,
  SpatialCombatEvent,
  SpatialRobotCombatState,
} from '../src/services/battle/combatSimulator';
import type * as KothEngine from '../src/services/arena/kothEngine';

type Loadout = 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
type RangeClass = 'melee' | 'short' | 'mid' | 'long';
type Suite = 'range' | 'loadout' | 'mobility' | 'grand-melee' | 'koth';
type DuelSuite = Exclude<Suite, 'grand-melee' | 'koth'>;
type BuildMode = 'uniform' | 'invest';
type Budget = 'early' | 'mid' | 'late';
type Attribute = (typeof ROBOT_ATTRIBUTES)[number];

/** The catalogue fields the harness reads; every other field is copied onto the weapon row as is. */
interface WeaponDefinition {
  name: string;
  cost: number;
  rangeBand: string;
  handsRequired: string;
  [field: string]: unknown;
}

const LOADOUTS: Loadout[] = ['single', 'weapon_shield', 'two_handed', 'dual_wield'];
const RANGES: RangeClass[] = ['melee', 'short', 'mid', 'long'];
/** Order is part of the seed derivation: append new suites at the end. */
const SUITES: Suite[] = ['range', 'loadout', 'grand-melee', 'mobility', 'koth'];
const BUDGETS: Record<Budget, { credits: number; cap: number; index: number }> = {
  early: { credits: 1_500_000, cap: 15, index: 0 },
  mid: { credits: 5_000_000, cap: 30, index: 1 },
  late: { credits: 15_000_000, cap: 45, index: 2 },
};
/** Share of the budget a loadout may cost to be a weapon candidate (invest builds). */
const WEAPON_BUDGET_SHARE = 0.4;
const FOCUS_ALL: Attribute[] = ['combatPower', 'targetingSystems', 'attackSpeed', 'hullIntegrity', 'armorPlating'];
const FOCUS_RANGE: Record<RangeClass, Attribute[]> = {
  melee: ['hydraulicSystems', 'servoMotors', 'gyroStabilizers'],
  short: ['hydraulicSystems', 'servoMotors', 'evasionThrusters'],
  mid: ['logicCores', 'servoMotors', 'evasionThrusters'],
  long: ['logicCores', 'servoMotors', 'evasionThrusters'],
};
/** Melee reach (rangeBands.ts: melee band max). */
const MELEE_REACH = 2;
/** Resolved-attack event types (counters are excluded: they have their own reach rules). */
const RESOLVED_ATTACK_TYPES = new Set(['attack', 'critical', 'miss']);
const ELIMINATION_TYPES = new Set(['destroyed', 'robot_eliminated', 'yield']);
const DUEL_MAX_DURATION = 120;
/** KotH production values (KOTH_MATCH_DEFAULTS: arena 14, time limit 150 s, score threshold 30). */
const KOTH_FIELD_SIZE = 6;
const KOTH_ARENA_RADIUS = 14;
const KOTH_MAX_DURATION = 150;
const KOTH_SCORE_THRESHOLD = 30;
const KOTH_WIN_REASONS = ['score_threshold', 'time_limit', 'last_standing'] as const;
const Z = 1.96;

// ─── Arms ───────────────────────────────────────────────────────────

type KothEngineModule = Pick<
  typeof KothEngine,
  'buildKothGameModeConfig' | 'buildKothInitialState' | 'buildKothTickHook' | 'buildEnrichedPlacements'
>;

interface Arm {
  label: string;
  src: string;
  revision: string;
  simulateBattleMulti: (robots: RobotWithWeapons[], config: BattleConfig) => SpatialCombatResult;
  prepareRobotForCombat: (robot: RobotWithWeapons) => void;
  catalogue: Map<string, WeaponDefinition>;
  disconnectSeedClient: () => Promise<void>;
  koth: KothEngineModule | null;
}

function gitDescribe(src: string): string {
  const git = (args: string[]): string =>
    execFileSync('git', ['-C', src, ...args], { encoding: 'utf8' }).trim();
  const sha = git(['rev-parse', '--short', 'HEAD']);
  const dirty = git(['diff', '--shortstat', 'HEAD', '--', 'src', '../shared', 'prisma/seed.ts']);
  return dirty ? `${sha} + uncommitted patch (${dirty})` : sha;
}

/** Local operator tool: each arm's own code is loaded from the checkout path given on the command line. */
function requireFrom<T>(src: string, modulePath: string): T {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, security/detect-non-literal-require
  return require(path.join(src, modulePath)) as T;
}

function loadArm(label: string, dir: string, withKoth: boolean): Arm {
  const src = path.resolve(dir);
  const sim = requireFrom<Pick<Arm, 'simulateBattleMulti'>>(src, 'src/services/battle/combatSimulator');
  const calc = requireFrom<Pick<Arm, 'prepareRobotForCombat'>>(src, 'src/utils/robotCalculations');
  const seed = requireFrom<{ WEAPON_DEFINITIONS: WeaponDefinition[]; disconnectSeedClient: () => Promise<void> }>(src, 'prisma/seed');
  return {
    label,
    src,
    revision: gitDescribe(src),
    simulateBattleMulti: sim.simulateBattleMulti,
    prepareRobotForCombat: calc.prepareRobotForCombat,
    catalogue: new Map(seed.WEAPON_DEFINITIONS.map((w) => [w.name, w])),
    disconnectSeedClient: seed.disconnectSeedClient,
    koth: withKoth ? requireFrom<KothEngineModule>(src, 'src/services/arena/kothEngine') : null,
  };
}

function weaponDef(arm: Arm, name: string): WeaponDefinition {
  const def = arm.catalogue.get(name);
  if (!def) throw new Error(`Weapon "${name}" not found in WEAPON_DEFINITIONS of arm ${arm.label}`);
  return def;
}

// ─── Seeded randomness ──────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h ^= p >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
    h ^= h >>> 15;
  }
  return h >>> 0;
}

function withSeed<T>(seed: number, fn: () => T): T {
  const original = Math.random;
  Math.random = mulberry32(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

// ─── Builds ─────────────────────────────────────────────────────────

type BuildPlan = { mode: 'uniform'; level: number } | { mode: 'invest'; budget: Budget };

interface BuildSpec {
  range: RangeClass;
  loadout: Loadout;
  main: string;
  offhand: string | null;
  /** Equal-points kiter: Hydraulic Systems (melee-only damage) moved into Servo Motors. */
  kiter?: boolean;
}

/** Weapon sampler over the first arm's catalogue (weapon names are shared by every arm). */
class WeaponSampler {
  private readonly defs: WeaponDefinition[];

  constructor(arm: Arm, private readonly plan: BuildPlan) {
    this.defs = [...arm.catalogue.values()];
  }

  private byHands(range: RangeClass, hands: string): WeaponDefinition[] {
    return this.defs.filter((w) => w.rangeBand === range && w.handsRequired === hands);
  }

  /** Invest builds: entries whose loadout cost fits the weapon share of the budget, else the cheapest. */
  private affordable<T>(items: T[], cost: (item: T) => number): T[] {
    if (this.plan.mode === 'uniform') return items;
    const limit = BUDGETS[this.plan.budget].credits * WEAPON_BUDGET_SHARE;
    const fits = items.filter((item) => cost(item) <= limit);
    if (fits.length > 0) return fits;
    return [items.reduce((best, item) => (cost(item) < cost(best) ? item : best))];
  }

  /** Weapons follow the equip rules in shared/utils/weaponSlots.ts; Dual Wield uses two copies. */
  sample(rng: () => number, range: RangeClass, loadout: Loadout): BuildSpec {
    if (loadout === 'two_handed') {
      return { range, loadout, main: pick(rng, this.affordable(this.byHands(range, 'two'), (w) => w.cost)).name, offhand: null };
    }
    const oneHanded = this.byHands(range, 'one');
    if (loadout === 'weapon_shield') {
      const shields = this.defs.filter((w) => w.handsRequired === 'shield');
      const pairs = oneHanded.flatMap((w) => shields.map((s): [WeaponDefinition, WeaponDefinition] => [w, s]));
      const [w, s] = pick(rng, this.affordable(pairs, ([a, b]) => a.cost + b.cost));
      return { range, loadout, main: w.name, offhand: s.name };
    }
    if (loadout === 'dual_wield') {
      const main = pick(rng, this.affordable(oneHanded, (w) => 2 * w.cost)).name;
      return { range, loadout, main, offhand: main };
    }
    return { range, loadout, main: pick(rng, this.affordable(oneHanded, (w) => w.cost)).name, offhand: null };
  }
}

/** Greedy allocation (invest builds): cheapest next level first, focus attributes before the rest. */
function investAttributes(spec: BuildSpec, credits: number, cap: number): Record<string, number> {
  const levels: Record<string, number> = Object.fromEntries(ROBOT_ATTRIBUTES.map((attr) => [attr, 1]));
  const focus = [...FOCUS_ALL, ...FOCUS_RANGE[spec.range], ...(spec.loadout === 'weapon_shield' ? ['shieldCapacity' as Attribute] : [])];
  const rest = ROBOT_ATTRIBUTES.filter((attr) => !focus.includes(attr));
  let remaining = credits;
  for (const group of [focus, rest]) {
    for (;;) {
      let next: Attribute | null = null;
      for (const attr of group) {
        if (levels[attr] < cap && (next === null || calculateBaseCost(levels[attr]) < calculateBaseCost(levels[next]))) next = attr;
      }
      if (next === null) break;
      const cost = calculateBaseCost(levels[next]);
      if (cost > remaining) break;
      remaining -= cost;
      levels[next]++;
    }
  }
  return levels;
}

function loadoutCost(arm: Arm, spec: BuildSpec): number {
  return weaponDef(arm, spec.main).cost + (spec.offhand ? weaponDef(arm, spec.offhand).cost : 0);
}

function inventoryRow(arm: Arm, name: string, id: number): NonNullable<RobotWithWeapons['mainWeapon']> {
  const weapon: Record<string, unknown> = { id, createdAt: new Date(0) };
  for (const attr of ROBOT_ATTRIBUTES) weapon[`${attr}Bonus`] = 0;
  Object.assign(weapon, weaponDef(arm, name));
  return {
    id, userId: 1, weaponId: id, customName: null, pricePaid: 0, purchasedAt: new Date(0), weapon, refinements: [],
  } as unknown as NonNullable<RobotWithWeapons['mainWeapon']>;
}

function buildAttributes(arm: Arm, spec: BuildSpec, plan: BuildPlan): Record<string, number> {
  if (plan.mode === 'invest') {
    const { credits, cap } = BUDGETS[plan.budget];
    return investAttributes(spec, Math.max(0, credits - loadoutCost(arm, spec)), cap);
  }
  const attributes: Record<string, number> = Object.fromEntries(ROBOT_ATTRIBUTES.map((attr) => [attr, plan.level]));
  if (spec.kiter) {
    attributes.servoMotors = 2 * plan.level - 1;
    attributes.hydraulicSystems = 1;
  }
  return attributes;
}

/** A fresh, prepared robot (preparation mutates, so every arm gets its own object). */
function buildRobot(arm: Arm, id: number, name: string, spec: BuildSpec, plan: BuildPlan): RobotWithWeapons {
  const robot = {
    id, userId: id, name, ...buildAttributes(arm, spec, plan),
    currentHP: 0, maxHP: 0, currentShield: 0, maxShield: 0,
    yieldThreshold: 10, loadoutType: spec.loadout, stance: 'balanced',
    mainWeaponId: id * 10, offhandWeaponId: spec.offhand ? id * 10 + 1 : null,
    mainWeapon: inventoryRow(arm, spec.main, id * 10),
    offhandWeapon: spec.offhand ? inventoryRow(arm, spec.offhand, id * 10 + 1) : null,
  } as unknown as RobotWithWeapons;
  arm.prepareRobotForCombat(robot);
  return robot;
}

function attributeTotal(arm: Arm, spec: BuildSpec, plan: BuildPlan): number {
  return Object.values(buildAttributes(arm, spec, plan)).reduce((a, b) => a + b, 0);
}

// ─── Event-derived measurements ─────────────────────────────────────

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Seconds `name` spent within melee reach (≤ 2) of its current target, reconstructed from the
 * simulator's per-tick `range_transition` events, and the number of transitions into the melee
 * band. The band before the first transition is the distance to the nearest opponent at spawn
 * (always beyond reach in these arenas).
 */
function meleeReach(result: SpatialCombatResult, name: string, endTime: number): { seconds: number; entries: number } {
  const start = result.startingPositions ?? {};
  const own = start[name];
  let nearest = Infinity;
  for (const [other, pos] of Object.entries(start)) if (other !== name && own) nearest = Math.min(nearest, dist(own, pos));
  let inMelee = nearest <= MELEE_REACH;
  let since = 0;
  let total = 0;
  let entries = 0;
  for (const e of result.events) {
    if (e.timestamp > endTime) break;
    if (e.type !== 'range_transition' || e.attacker !== name) continue;
    const now = e.rangeBand === 'melee';
    if (inMelee && !now) total += e.timestamp - since;
    if (!inMelee && now) {
      since = e.timestamp;
      entries++;
    }
    inMelee = now;
  }
  if (inMelee) total += endTime - since;
  return { seconds: total, entries };
}

/** Resolved main/offhand attacks with a melee-band weapon at distance > 2 (#518 invariant), and their damage. */
function outOfReachMeleeAttacks(events: SpatialCombatEvent[], robots: RobotWithWeapons[]): { count: number; damage: number } {
  const byName = new Map(robots.map((r) => [r.name, r]));
  let count = 0;
  let damage = 0;
  for (const e of events) {
    if (!RESOLVED_ATTACK_TYPES.has(e.type) || e.counter || !e.attacker || e.distance === undefined) continue;
    const robot = byName.get(e.attacker);
    const weapon = e.hand === 'offhand' ? robot?.offhandWeapon?.weapon : robot?.mainWeapon?.weapon;
    if (weapon?.rangeBand === 'melee' && e.distance > MELEE_REACH + 1e-9) {
      count++;
      damage += e.damage ?? 0;
    }
  }
  return { count, damage };
}

function isTimeout(result: SpatialCombatResult, maxDuration: number): boolean {
  return result.durationSeconds >= maxDuration - 0.05;
}

// ─── Paired accumulators ────────────────────────────────────────────

/** Running sums for one metric: per-column values and per-column paired deltas vs the baseline column. */
class PairedStat {
  n = 0;
  private sum: number[];
  private dSum: number[];
  private dSq: number[];

  constructor(columns: number) {
    this.sum = new Array<number>(columns).fill(0);
    this.dSum = new Array<number>(columns).fill(0);
    this.dSq = new Array<number>(columns).fill(0);
  }

  add(values: number[]): void {
    this.n++;
    for (let i = 0; i < values.length; i++) {
      const d = values[i] - values[0];
      this.sum[i] += values[i];
      this.dSum[i] += d;
      this.dSq[i] += d * d;
    }
  }

  mean(column: number): number {
    return this.n ? this.sum[column] / this.n : NaN;
  }

  /** Mean paired delta and 95% CI half-width. */
  delta(column: number): [number, number] {
    if (this.n < 2) return [NaN, NaN];
    const m = this.dSum[column] / this.n;
    const variance = Math.max(0, (this.dSq[column] - this.n * m * m) / (this.n - 1));
    return [m, (Z * Math.sqrt(variance)) / Math.sqrt(this.n)];
  }
}

type StatTable = Map<string, Map<string, PairedStat>>;

function stat(table: StatTable, row: string, metric: string, columns: number): PairedStat {
  let rowMap = table.get(row);
  if (!rowMap) table.set(row, (rowMap = new Map()));
  let s = rowMap.get(metric);
  if (!s) rowMap.set(metric, (s = new PairedStat(columns)));
  return s;
}

// ─── 1v1 suites ─────────────────────────────────────────────────────

interface DuelMetrics {
  scoreA: number;
  slot0Score: number;
  draw: number;
  timeout: number;
  noContact: number;
  meleeShare: number;
  meleeEntries: number;
  dmgA: number;
  dmgB: number;
  oorMelee: number;
  oorMeleeDamage: number;
  duration: number;
  loadoutCostA: number;
  attrTotalA: number;
}

function runDuel(arm: Arm, a: BuildSpec, b: BuildSpec, plan: BuildPlan, aFirst: boolean, seed: number): DuelMetrics {
  const ra = buildRobot(arm, 1, 'A', a, plan);
  const rb = buildRobot(arm, 2, 'B', b, plan);
  const order = aFirst ? [ra, rb] : [rb, ra];
  const config: BattleConfig = { allowDraws: true };
  const result = withSeed(seed, () => arm.simulateBattleMulti(order, config));
  const states = result.finalStates ?? [];
  const dmg = (name: string): number => states.find((s) => s.robot.name === name)?.totalDamageDealt ?? 0;
  const dmgA = dmg('A');
  const dmgB = dmg('B');
  const draw = result.winnerId === null ? 1 : 0;
  const duration = result.durationSeconds;
  const oor = outOfReachMeleeAttacks(result.events, order);
  const reach = meleeReach(result, 'A', duration);
  const scoreA = result.winnerId === ra.id ? 1 : draw ? 0.5 : 0;
  return {
    scoreA,
    slot0Score: aFirst ? scoreA : 1 - scoreA,
    draw,
    timeout: isTimeout(result, DUEL_MAX_DURATION) ? 1 : 0,
    noContact: dmgA + dmgB === 0 ? 1 : 0,
    meleeShare: duration > 0 ? reach.seconds / duration : 0,
    meleeEntries: reach.entries,
    dmgA,
    dmgB,
    oorMelee: oor.count,
    oorMeleeDamage: oor.damage,
    duration,
    loadoutCostA: loadoutCost(arm, a),
    attrTotalA: attributeTotal(arm, a, plan),
  };
}

const DUEL_METRICS: Array<keyof DuelMetrics> = [
  'scoreA', 'slot0Score', 'draw', 'timeout', 'noContact', 'meleeShare', 'meleeEntries', 'dmgA', 'dmgB', 'oorMelee',
  'oorMeleeDamage', 'duration', 'loadoutCostA', 'attrTotalA',
];

interface DuelResults {
  cells: StatTable;
  /** Marginal: score of class X against a different class (mirrors excluded). */
  marginal: StatTable;
  overall: StatTable;
}

/** Cell pairs [A, B] per 1v1 suite; `mobility` pits uniform melee against a ranged kiter. */
function duelCells(suite: DuelSuite): Array<[string, string]> {
  if (suite === 'mobility') return RANGES.filter((r) => r !== 'melee').map((r) => ['melee', r]);
  const classes: readonly string[] = suite === 'range' ? RANGES : LOADOUTS;
  const cells: Array<[string, string]> = [];
  for (let i = 0; i < classes.length; i++) for (let j = i; j < classes.length; j++) cells.push([classes[i], classes[j]]);
  return cells;
}

/** Seed component for the build plan: uniform keeps the pre-Season 2 derivation (the level). */
function planKey(plan: BuildPlan): number {
  return plan.mode === 'uniform' ? plan.level : 1000 + BUDGETS[plan.budget].index;
}

function runDuelSuite(arms: Arm[], suite: DuelSuite, plan: BuildPlan, trials: number, seed: number): DuelResults {
  const res: DuelResults = { cells: new Map(), marginal: new Map(), overall: new Map() };
  const suiteId = SUITES.indexOf(suite);
  const sampler = new WeaponSampler(arms[0], plan);
  const key = planKey(plan);
  for (const [cellIdx, [classA, classB]] of duelCells(suite).entries()) {
    const cell = suite === 'mobility' ? `${classA} vs ${classB} kiter` : `${classA} vs ${classB}`;
    for (let t = 0; t < trials; t++) {
      const rng = mulberry32(mix(seed, suiteId, key, cellIdx, t));
      let a: BuildSpec;
      let b: BuildSpec;
      if (suite === 'loadout') {
        const range = pick(rng, RANGES);
        a = sampler.sample(rng, range, classA as Loadout);
        b = sampler.sample(rng, range, classB as Loadout);
      } else {
        a = sampler.sample(rng, classA as RangeClass, pick(rng, LOADOUTS));
        b = { ...sampler.sample(rng, classB as RangeClass, pick(rng, LOADOUTS)), kiter: suite === 'mobility' };
      }
      const battleSeed = mix(seed, 0xba771e, suiteId, key, cellIdx, t);
      const perArm = arms.map((arm) => runDuel(arm, a, b, plan, t % 2 === 0, battleSeed));
      for (const m of DUEL_METRICS) {
        const values = perArm.map((r) => r[m]);
        stat(res.cells, cell, m, arms.length).add(values);
        stat(res.overall, 'all cells', m, arms.length).add(values);
      }
      if (suite !== 'mobility' && classA !== classB) {
        stat(res.marginal, classA, 'score', arms.length).add(perArm.map((r) => r.scoreA));
        stat(res.marginal, classB, 'score', arms.length).add(perArm.map((r) => 1 - r.scoreA));
      }
    }
  }
  return res;
}

// ─── Grand Melee suite ──────────────────────────────────────────────

interface MeleeRobotMetrics {
  normRank: number;
  podium: number;
  win: number;
  zeroDamage: number;
  damage: number;
  meleeShare: number;
}

const GM_ROBOT_METRICS: Array<keyof MeleeRobotMetrics> = ['normRank', 'podium', 'win', 'zeroDamage', 'damage', 'meleeShare'];
const GM_BATTLE_METRICS = ['timeout', 'duration', 'survivors', 'oorMelee', 'oorMeleeDamage', 'noContact'] as const;
type GmBattleMetric = (typeof GM_BATTLE_METRICS)[number];

function firstEliminations(events: SpatialCombatEvent[]): Map<string, number> {
  const eliminatedAt = new Map<string, number>();
  for (const e of events) {
    if (ELIMINATION_TYPES.has(e.type) && e.defender && !eliminatedAt.has(e.defender)) eliminatedAt.set(e.defender, e.timestamp);
  }
  return eliminatedAt;
}

/** Same ordering as grandMeleeBattleOrchestrator.computePlacements (not exported; that module needs a DB client). */
function placementOrder(states: SpatialRobotCombatState[], events: SpatialCombatEvent[]): string[] {
  const eliminatedAt = firstEliminations(events);
  const hpPct = (s: SpatialRobotCombatState): number => (s.maxHP > 0 ? s.currentHP / s.maxHP : 0);
  const survivors = states.filter((s) => s.isAlive)
    .sort((a, b) => hpPct(b) - hpPct(a) || b.totalDamageDealt - a.totalDamageDealt);
  const eliminated = states.filter((s) => !s.isAlive).sort((a, b) =>
    (eliminatedAt.get(b.robot.name) ?? 0) - (eliminatedAt.get(a.robot.name) ?? 0) || b.totalDamageDealt - a.totalDamageDealt);
  return [...survivors, ...eliminated].map((s) => s.robot.name);
}

interface GrandMeleeTrial {
  robots: Array<{ spec: BuildSpec; metrics: MeleeRobotMetrics }>;
  battle: Record<GmBattleMetric, number>;
}

function runGrandMelee(arm: Arm, specs: BuildSpec[], plan: BuildPlan, seed: number): GrandMeleeTrial {
  const robots = specs.map((spec, k) => buildRobot(arm, k + 1, `G${k + 1}`, spec, plan));
  const n = robots.length;
  const config: BattleConfig = { allowDraws: false, arenaRadius: 16 + (n - 2) * 3 };
  const result = withSeed(seed, () => arm.simulateBattleMulti(robots, config));
  const states = result.finalStates ?? [];
  const order = placementOrder(states, result.events);
  const end = result.durationSeconds;
  const eliminatedAt = firstEliminations(result.events);
  let totalDamage = 0;
  const oor = outOfReachMeleeAttacks(result.events, robots);
  const perRobot = robots.map((robot, k) => {
    const state = states.find((s) => s.robot.name === robot.name);
    const damage = state?.totalDamageDealt ?? 0;
    totalDamage += damage;
    const placement = order.indexOf(robot.name) + 1;
    const alive = eliminatedAt.get(robot.name) ?? end;
    return {
      spec: specs[k],
      metrics: {
        normRank: (placement - 1) / (n - 1),
        podium: placement <= 3 ? 1 : 0,
        win: placement === 1 ? 1 : 0,
        zeroDamage: damage === 0 ? 1 : 0,
        damage,
        meleeShare: alive > 0 ? meleeReach(result, robot.name, alive).seconds / alive : 0,
      },
    };
  });
  return {
    robots: perRobot,
    battle: {
      timeout: isTimeout(result, DUEL_MAX_DURATION) ? 1 : 0,
      duration: end,
      survivors: states.filter((s) => s.isAlive).length,
      oorMelee: oor.count,
      oorMeleeDamage: oor.damage,
      noContact: totalDamage === 0 ? 1 : 0,
    },
  };
}

interface GroupResults {
  byRange: StatTable;
  byLoadout: StatTable;
  battle: StatTable;
}

/**
 * Per-group means (the per-trial unit is the group mean, so robots of one battle are not independent
 * samples). KotH fields are sampled per robot, so a group can be absent from a trial; that trial is
 * then skipped for the group (every column has the same specs, so the pairing holds).
 */
function addGroupStats<M extends string>(
  res: GroupResults,
  perColumn: Array<Array<{ spec: BuildSpec; metrics: Record<M, number> }>>,
  metrics: readonly M[],
): void {
  for (const [table, key] of [[res.byRange, 'range'], [res.byLoadout, 'loadout']] as const) {
    const groups: readonly string[] = key === 'range' ? RANGES : LOADOUTS;
    for (const g of groups) {
      if (!perColumn[0].some((r) => r.spec[key] === g)) continue;
      for (const m of metrics) {
        const values = perColumn.map((robots) => {
          const members = robots.filter((r) => r.spec[key] === g);
          return members.reduce((acc, r) => acc + r.metrics[m], 0) / members.length;
        });
        stat(table, g, m, perColumn.length).add(values);
      }
    }
  }
}

function runGrandMeleeSuite(arms: Arm[], plan: BuildPlan, trials: number, seed: number): GroupResults {
  const res: GroupResults = { byRange: new Map(), byLoadout: new Map(), battle: new Map() };
  const suiteId = SUITES.indexOf('grand-melee');
  const sampler = new WeaponSampler(arms[0], plan);
  const key = planKey(plan);
  for (let t = 0; t < trials; t++) {
    const rng = mulberry32(mix(seed, suiteId, key, 0, t));
    const specs: BuildSpec[] = [];
    for (const range of RANGES) for (const loadout of LOADOUTS) specs.push(sampler.sample(rng, range, loadout));
    for (let k = specs.length - 1; k > 0; k--) {
      const r = Math.floor(rng() * (k + 1));
      [specs[k], specs[r]] = [specs[r], specs[k]];
    }
    const battleSeed = mix(seed, 0xba771e, suiteId, key, 0, t);
    const perArm = arms.map((arm) => runGrandMelee(arm, specs, plan, battleSeed));
    for (const m of GM_BATTLE_METRICS) stat(res.battle, 'all battles', m, arms.length).add(perArm.map((r) => r.battle[m]));
    addGroupStats(res, perArm.map((trial) => trial.robots), GM_ROBOT_METRICS);
  }
  return res;
}

// ─── King of the Hill suite ─────────────────────────────────────────

interface KothColumn {
  label: string;
  arm: Arm;
  radius: number;
}

interface KothRobotMetrics {
  kothRank: number;
  kothPodium: number;
  kothWin: number;
  zoneTime: number;
  kills: number;
}

const KOTH_ROBOT_METRICS: Array<keyof KothRobotMetrics> = ['kothRank', 'kothPodium', 'kothWin', 'zoneTime', 'kills'];
const KOTH_BATTLE_METRICS = ['winScore', 'winTime', 'winLast', 'kothDuration', 'killsPerRobot'] as const;
type KothBattleMetric = (typeof KOTH_BATTLE_METRICS)[number];

interface KothTrial {
  robots: Array<{ spec: BuildSpec; metrics: KothRobotMetrics }>;
  battle: Record<KothBattleMetric, number>;
}

/** Mirrors kothBattleOrchestrator.processKothBattle steps 2–5 (synthetic robots are always battle-ready). */
function runKoth(column: KothColumn, specs: BuildSpec[], plan: BuildPlan, matchId: number, seed: number): KothTrial {
  const { arm, radius } = column;
  const koth = arm.koth;
  if (!koth) throw new Error(`Arm ${arm.label} was loaded without its KotH engine`);
  const robots = specs.map((spec, k) => buildRobot(arm, k + 1, `K${k + 1}`, spec, plan));
  const kothConfig: KothEngine.KothMatchConfig = {
    scoreThreshold: KOTH_SCORE_THRESHOLD,
    timeLimit: KOTH_MAX_DURATION,
    zoneRadius: radius,
    participantCount: robots.length,
    matchId,
  };
  const gameModeConfig = koth.buildKothGameModeConfig(kothConfig);
  const gameModeState = koth.buildKothInitialState(kothConfig, robots.map((r) => r.id));
  const customData = gameModeState.customData as Record<string, unknown>;
  const scoreState = customData.scoreState as KothEngine.KothScoreState;
  const zoneState = customData.zoneState as KothEngine.KothZoneState;
  customData.tickHook = koth.buildKothTickHook(kothConfig, scoreState, zoneState, gameModeState);
  const config: BattleConfig = {
    allowDraws: false,
    maxDuration: KOTH_MAX_DURATION,
    gameModeConfig,
    gameModeState,
    arenaRadius: KOTH_ARENA_RADIUS,
  };
  const result = withSeed(seed, () => arm.simulateBattleMulti(robots, config));
  const placements = koth.buildEnrichedPlacements(scoreState, result.finalStates ?? []);
  const winReason = result.kothMetadata?.winReason ?? 'time_limit';
  if (!(KOTH_WIN_REASONS as readonly string[]).includes(winReason)) throw new Error(`Unknown KotH win reason: ${winReason}`);
  const n = robots.length;
  let kills = 0;
  const perRobot = robots.map((robot, k) => {
    const p = placements.find((pl) => pl.robotId === robot.id);
    if (!p) throw new Error(`No KotH placement for robot ${robot.name}`);
    kills += p.kills;
    return {
      spec: specs[k],
      metrics: {
        kothRank: (p.placement - 1) / (n - 1),
        kothPodium: p.placement <= 3 ? 1 : 0,
        kothWin: p.placement === 1 ? 1 : 0,
        zoneTime: p.zoneTime,
        kills: p.kills,
      },
    };
  });
  return {
    robots: perRobot,
    battle: {
      winScore: winReason === 'score_threshold' ? 1 : 0,
      winTime: winReason === 'time_limit' ? 1 : 0,
      winLast: winReason === 'last_standing' ? 1 : 0,
      kothDuration: result.durationSeconds,
      killsPerRobot: kills / n,
    },
  };
}

function runKothSuite(columns: KothColumn[], plan: BuildPlan, trials: number, seed: number): GroupResults {
  const res: GroupResults = { byRange: new Map(), byLoadout: new Map(), battle: new Map() };
  const suiteId = SUITES.indexOf('koth');
  const sampler = new WeaponSampler(columns[0].arm, plan);
  const key = planKey(plan);
  for (let t = 0; t < trials; t++) {
    const rng = mulberry32(mix(seed, suiteId, key, 0, t));
    const specs: BuildSpec[] = [];
    for (let k = 0; k < KOTH_FIELD_SIZE; k++) specs.push(sampler.sample(rng, pick(rng, RANGES), pick(rng, LOADOUTS)));
    const battleSeed = mix(seed, 0xba771e, suiteId, key, 0, t);
    const perColumn = columns.map((column) => runKoth(column, specs, plan, t + 1, battleSeed));
    for (const m of KOTH_BATTLE_METRICS) stat(res.battle, 'all battles', m, columns.length).add(perColumn.map((r) => r.battle[m]));
    addGroupStats(res, perColumn.map((trial) => trial.robots), KOTH_ROBOT_METRICS);
  }
  return res;
}

// ─── Markdown ───────────────────────────────────────────────────────

interface MetricFormat {
  label: string;
  /** Multiplier applied before printing (100 for rates shown in percent / percentage points). */
  scale: number;
  digits: number;
  unit: string;
}

const FORMATS: Record<string, MetricFormat> = {
  scoreA: { label: 'score A (win + ½ draw)', scale: 100, digits: 1, unit: '%' },
  slot0Score: { label: 'slot-0 score (robot moving first in the simulator; 50% = no order effect)', scale: 100, digits: 1, unit: '%' },
  score: { label: 'score vs other classes (win + ½ draw)', scale: 100, digits: 1, unit: '%' },
  draw: { label: 'draw rate', scale: 100, digits: 1, unit: '%' },
  timeout: { label: 'timeout rate (120 s)', scale: 100, digits: 1, unit: '%' },
  noContact: { label: 'no-contact rate (0 damage dealt by anyone)', scale: 100, digits: 2, unit: '%' },
  meleeShare: { label: 'time within melee reach (≤ 2 units) of target', scale: 100, digits: 1, unit: '%' },
  meleeEntries: { label: 'melee-reach entries per battle (range_transition into the melee band)', scale: 1, digits: 2, unit: '' },
  dmgA: { label: 'damage dealt by A', scale: 1, digits: 1, unit: '' },
  dmgB: { label: 'damage dealt by B', scale: 1, digits: 1, unit: '' },
  oorMelee: { label: 'melee attacks resolved beyond reach / battle', scale: 1, digits: 2, unit: '' },
  oorMeleeDamage: { label: 'damage from melee attacks beyond reach / battle', scale: 1, digits: 1, unit: '' },
  duration: { label: 'mean duration (s)', scale: 1, digits: 1, unit: '' },
  loadoutCostA: { label: 'loadout cost of A (credits, arm catalogue price)', scale: 1, digits: 0, unit: '' },
  attrTotalA: { label: 'attribute level total of A (23 attributes)', scale: 1, digits: 1, unit: '' },
  normRank: { label: 'normalized rank (0 = 1st, 1 = last; parity 0.500)', scale: 1, digits: 3, unit: '' },
  podium: { label: 'podium rate (top 3 of 16; parity 18.8%)', scale: 100, digits: 1, unit: '%' },
  win: { label: 'win rate (1st of 16; parity 6.3%)', scale: 100, digits: 1, unit: '%' },
  zeroDamage: { label: 'zero-damage participant rate', scale: 100, digits: 1, unit: '%' },
  damage: { label: 'damage dealt per robot', scale: 1, digits: 1, unit: '' },
  survivors: { label: 'survivors at end', scale: 1, digits: 2, unit: '' },
  winScore: { label: 'win reason: score threshold (30)', scale: 100, digits: 1, unit: '%' },
  winTime: { label: 'win reason: time limit (150 s)', scale: 100, digits: 1, unit: '%' },
  winLast: { label: 'win reason: last standing', scale: 100, digits: 1, unit: '%' },
  kothDuration: { label: 'mean duration (s)', scale: 1, digits: 1, unit: '' },
  killsPerRobot: { label: 'kills per robot', scale: 1, digits: 3, unit: '' },
  kothRank: { label: 'normalized rank (0 = 1st, 1 = 6th; parity 0.500)', scale: 1, digits: 3, unit: '' },
  kothPodium: { label: 'podium rate (top 3 of 6; parity 50.0%)', scale: 100, digits: 1, unit: '%' },
  kothWin: { label: 'win rate (1st of 6; parity 16.7%)', scale: 100, digits: 1, unit: '%' },
  zoneTime: { label: 'zone occupation time per robot (s)', scale: 1, digits: 1, unit: '' },
  kills: { label: 'kills per robot', scale: 1, digits: 3, unit: '' },
};

function fmtValue(v: number, f: MetricFormat): string {
  return `${(v * f.scale).toFixed(f.digits)}${f.unit}`;
}

function fmtDelta([d, hw]: [number, number], f: MetricFormat): string {
  if (Number.isNaN(d)) return 'n/a';
  const sign = d * f.scale >= 0 ? '+' : '';
  return `${sign}${(d * f.scale).toFixed(f.digits)} ±${(hw * f.scale).toFixed(f.digits)}`;
}

/** Rows × one metric: baseline value, each other column's paired delta (95% CI), each other column's value. */
function metricTable(labels: string[], table: StatTable, metric: string, rowLabel: string): string[] {
  const f = FORMATS[metric];
  const others = labels.slice(1);
  const lines = [
    `**${f.label}**${f.unit === '%' ? ' — deltas in percentage points' : ''}`,
    '',
    `| ${rowLabel} | n | ${labels[0]} | ${others.map((a) => `Δ ${a} (95% CI)`).join(' | ')} | ${others.join(' | ')} |`,
    `|---|---|---|${others.map(() => '---').join('|')}|${others.map(() => '---').join('|')}|`,
  ];
  for (const [row, metrics] of table) {
    const s = metrics.get(metric);
    if (!s) continue;
    lines.push(`| ${row} | ${s.n} | ${fmtValue(s.mean(0), f)} | ${others.map((_, k) => fmtDelta(s.delta(k + 1), f)).join(' | ')} | ${others.map((_, k) => fmtValue(s.mean(k + 1), f)).join(' | ')} |`);
  }
  lines.push('');
  return lines;
}

function describePlan(plan: BuildPlan): string {
  if (plan.mode === 'uniform') return `uniform builds, attribute level ${plan.level}`;
  const { credits, cap } = BUDGETS[plan.budget];
  return `invest builds, budget ${plan.budget} (₡${credits.toLocaleString('en-US')} per robot, attribute cap ${cap})`;
}

function renderHeader(arms: Arm[], suite: Suite, plan: BuildPlan, trials: number, seed: number, extra: string[]): string[] {
  const unit = suite === 'grand-melee' || suite === 'koth' ? 'column' : 'cell';
  return [
    `### Suite \`${suite}\`, ${describePlan(plan)} (${trials} paired trials per ${unit}, seed ${seed})`,
    '',
    ...arms.map((a, i) => `- arm \`${a.label}\`${i === 0 ? ' (baseline)' : ''}: ${a.revision}`),
    ...extra,
    '',
  ];
}

function renderDuel(labels: string[], res: DuelResults): string[] {
  const lines: string[] = [];
  if (res.marginal.size > 0) lines.push(...metricTable(labels, res.marginal, 'score', 'class'));
  for (const m of ['timeout', 'noContact', 'meleeShare', 'meleeEntries', 'slot0Score', 'oorMelee', 'oorMeleeDamage', 'duration', 'draw', 'loadoutCostA', 'attrTotalA']) {
    lines.push(...metricTable(labels, res.overall, m, 'scope'));
  }
  for (const m of ['scoreA', 'slot0Score', 'timeout', 'meleeShare', 'meleeEntries', 'noContact', 'dmgA', 'dmgB', 'oorMelee', 'oorMeleeDamage', 'duration']) {
    lines.push(...metricTable(labels, res.cells, m, 'A vs B'));
  }
  return lines;
}

function renderGroups(labels: string[], res: GroupResults, battleMetrics: readonly string[], robotMetrics: readonly string[]): string[] {
  const lines: string[] = [];
  for (const m of battleMetrics) lines.push(...metricTable(labels, res.battle, m, 'scope'));
  for (const [table, label] of [[res.byRange, 'range class'], [res.byLoadout, 'loadout']] as const) {
    for (const m of robotMetrics) lines.push(...metricTable(labels, table, m, label));
  }
  return lines;
}

// ─── CLI ────────────────────────────────────────────────────────────

interface Options {
  arms: Array<[string, string]>;
  suite: Suite;
  builds: BuildMode;
  level: number;
  budget: Budget;
  kothRadii: number[];
  trials: number;
  seed: number;
  out: string | null;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    arms: [], suite: 'range', builds: 'uniform', level: 10, budget: 'mid', kothRadii: [7], trials: 2000, seed: 516, out: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1];
    switch (argv[i]) {
      case '--arms':
        opts.arms = (value ?? '').split(',').map((pair) => {
          const eq = pair.indexOf('=');
          if (eq < 1) throw new Error(`--arms entries must be label=dir, got "${pair}"`);
          return [pair.slice(0, eq), pair.slice(eq + 1)] as [string, string];
        });
        i++;
        break;
      case '--suite':
        if (!SUITES.includes(value as Suite)) throw new Error(`--suite must be one of ${SUITES.join(', ')}`);
        opts.suite = value as Suite;
        i++;
        break;
      case '--builds':
        if (value !== 'uniform' && value !== 'invest') throw new Error('--builds must be uniform or invest');
        opts.builds = value;
        i++;
        break;
      case '--budget':
        if (value !== 'early' && value !== 'mid' && value !== 'late') throw new Error('--budget must be early, mid or late');
        opts.budget = value;
        i++;
        break;
      case '--koth-radii':
        opts.kothRadii = (value ?? '').split(',').map(Number);
        i++;
        break;
      case '--level': opts.level = Number(value); i++; break;
      case '--trials': opts.trials = Number(value); i++; break;
      case '--seed': opts.seed = Number(value); i++; break;
      case '--out': opts.out = value ?? null; i++; break;
      default: throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  const columns = opts.suite === 'koth' ? opts.arms.length * opts.kothRadii.length : opts.arms.length;
  if (opts.arms.length < 1 || columns < 2) throw new Error('need at least two columns (arms, or arm × --koth-radii for koth)');
  for (const [k, v] of [['level', opts.level], ['trials', opts.trials], ['seed', opts.seed]] as const) {
    if (!Number.isInteger(v) || v < (k === 'seed' ? 0 : 1)) throw new Error(`--${k} must be a positive integer, got ${v}`);
  }
  if (opts.kothRadii.some((r) => !Number.isFinite(r) || r < 3 || r > 8)) throw new Error('--koth-radii values must be within 3–8');
  if (opts.suite === 'mobility' && opts.builds !== 'uniform') throw new Error('--suite mobility uses uniform builds only');
  return opts;
}

function main(arms: Arm[], opts: Options): void {
  const plan: BuildPlan = opts.builds === 'invest' ? { mode: 'invest', budget: opts.budget } : { mode: 'uniform', level: opts.level };
  const started = Date.now();
  let lines: string[];
  if (opts.suite === 'koth') {
    const columns: KothColumn[] = arms.flatMap((arm) => opts.kothRadii.map((radius) => ({ label: `${arm.label} r${radius}`, arm, radius })));
    const labels = columns.map((c) => c.label);
    const extra = [`- columns: ${labels.map((l) => `\`${l}\``).join(', ')} (zone radius per column; baseline \`${labels[0]}\`)`];
    lines = [
      ...renderHeader(arms, opts.suite, plan, opts.trials, opts.seed, extra),
      ...renderGroups(labels, runKothSuite(columns, plan, opts.trials, opts.seed), KOTH_BATTLE_METRICS, KOTH_ROBOT_METRICS),
    ];
  } else if (opts.suite === 'grand-melee') {
    lines = [
      ...renderHeader(arms, opts.suite, plan, opts.trials, opts.seed, []),
      ...renderGroups(arms.map((a) => a.label), runGrandMeleeSuite(arms, plan, opts.trials, opts.seed), GM_BATTLE_METRICS, GM_ROBOT_METRICS),
    ];
  } else {
    lines = [
      ...renderHeader(arms, opts.suite, plan, opts.trials, opts.seed, []),
      ...renderDuel(arms.map((a) => a.label), runDuelSuite(arms, opts.suite, plan, opts.trials, opts.seed)),
    ];
  }
  const markdown = `${lines.join('\n')}\n`;
  process.stdout.write(markdown);
  if (opts.out) fs.writeFileSync(opts.out, markdown);
  process.stderr.write(`combatBaselineValidation: ${opts.suite} ${describePlan(plan)} done in ${((Date.now() - started) / 1000).toFixed(0)} s\n`);
}

const loaded: Arm[] = [];
try {
  const opts = parseArgs(process.argv.slice(2));
  for (const [label, dir] of opts.arms) loaded.push(loadArm(label, dir, opts.suite === 'koth'));
  main(loaded, opts);
} catch (error) {
  process.stderr.write(`combatBaselineValidation failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  void Promise.all(loaded.map((arm) => arm.disconnectSeedClient()));
}
