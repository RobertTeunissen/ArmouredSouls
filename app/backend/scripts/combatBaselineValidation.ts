/**
 * Corrected combat baseline validation (#516 step 2: #517 loadout parity + #518 melee reach).
 *
 *   pnpm exec tsx scripts/combatBaselineValidation.ts \
 *     --arms main=<backendDir>,517=<backendDir>,518=<backendDir>,combined=<backendDir> \
 *     --suite range|loadout|mobility|grand-melee --level 10 [--trials 2000] [--seed 516] [--out <file.md>]
 *
 * Each `--arms` entry points at an `app/backend` directory of a checkout (git worktree) of one
 * code revision. The first arm is the baseline. The script `require`s that arm's own
 * `prepareRobotForCombat` and `simulateBattleMulti`, so every arm runs its real code in one
 * process; nothing is re-implemented or patched. The weapon catalogue (`WEAPON_DEFINITIONS`) is
 * read from this checkout (the fixes do not change it).
 *
 * Pairing: trial t of a cell uses the same setup (loadouts, weapons, spawn side/permutation) and
 * the same battle seed in every arm. `Math.random` is replaced by a seeded mulberry32 for the
 * duration of each battle. Arms diverge after their first differing random draw, so pairing
 * shares the starting conditions, not the whole trajectory. Deltas are per-trial paired
 * differences (arm − baseline) with a normal-approximation 95% CI (±1.96·sd/√n).
 *
 * Suites (synthetic builds: all 23 attributes at --level, balanced stance, yield threshold 10,
 * no tuning, no refinements, weapons sampled uniformly from the seed catalogue):
 *   - range        1v1, one cell per range-class pair (melee/short/mid/long, mirrors included);
 *                  each side's loadout is sampled independently and uniformly.
 *   - loadout      1v1, one cell per loadout pair (single/weapon_shield/two_handed/dual_wield);
 *                  both sides share one uniformly sampled range class per trial.
 *   - mobility     1v1, uniform melee vs a short/mid/long "kiter" that moved its Hydraulic
 *                  Systems points (melee-only damage) into Servo Motors (same attribute total:
 *                  servo 2L − 1, hydraulics 1). Identical to `range` at level 1.
 *   - grand-melee  16-robot Grand Melee (one robot per range class × loadout, spawn order
 *                  shuffled per trial), production config: allowDraws false,
 *                  arenaRadius 16 + (N − 2) × 3, placements as grandMeleeBattleOrchestrator.
 * Sides alternate every trial in the 1v1 suites. 1v1 uses league rules (draws allowed).
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { WEAPON_DEFINITIONS, disconnectSeedClient } from '../prisma/seed';
import { ROBOT_ATTRIBUTES } from '../src/shared/utils/robotAttributes';
import type {
  RobotWithWeapons,
  BattleConfig,
  SpatialCombatResult,
  SpatialCombatEvent,
  SpatialRobotCombatState,
} from '../src/services/battle/combatSimulator';

type Loadout = 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
type RangeClass = 'melee' | 'short' | 'mid' | 'long';
type Suite = 'range' | 'loadout' | 'mobility' | 'grand-melee';
type DuelSuite = Exclude<Suite, 'grand-melee'>;
type WeaponDefinition = (typeof WEAPON_DEFINITIONS)[number];

const LOADOUTS: Loadout[] = ['single', 'weapon_shield', 'two_handed', 'dual_wield'];
const RANGES: RangeClass[] = ['melee', 'short', 'mid', 'long'];
const SUITES: Suite[] = ['range', 'loadout', 'grand-melee', 'mobility'];
/** Melee reach (rangeBands.ts: melee band max). */
const MELEE_REACH = 2;
/** Resolved-attack event types (counters are excluded: they have their own reach rules). */
const RESOLVED_ATTACK_TYPES = new Set(['attack', 'critical', 'miss']);
const ELIMINATION_TYPES = new Set(['destroyed', 'robot_eliminated', 'yield']);
const Z = 1.96;

// ─── Arms ───────────────────────────────────────────────────────────

interface Arm {
  label: string;
  src: string;
  revision: string;
  simulateBattleMulti: (robots: RobotWithWeapons[], config: BattleConfig) => SpatialCombatResult;
  prepareRobotForCombat: (robot: RobotWithWeapons) => void;
}

function gitDescribe(src: string): string {
  const git = (args: string[]): string =>
    execFileSync('git', ['-C', src, ...args], { encoding: 'utf8' }).trim();
  const sha = git(['rev-parse', '--short', 'HEAD']);
  const dirty = git(['diff', '--shortstat', 'HEAD', '--', 'src', '../shared']);
  return dirty ? `${sha} + uncommitted patch (${dirty})` : sha;
}

function loadArm(label: string, dir: string): Arm {
  const src = path.resolve(dir);
  // Local operator tool: each arm's own code is loaded from the checkout path given on the command line.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, security/detect-non-literal-require
  const sim = require(path.join(src, 'src/services/battle/combatSimulator')) as Pick<Arm, 'simulateBattleMulti'>;
  // eslint-disable-next-line @typescript-eslint/no-require-imports, security/detect-non-literal-require
  const calc = require(path.join(src, 'src/utils/robotCalculations')) as Pick<Arm, 'prepareRobotForCombat'>;
  return {
    label,
    src,
    revision: gitDescribe(src),
    simulateBattleMulti: sim.simulateBattleMulti,
    prepareRobotForCombat: calc.prepareRobotForCombat,
  };
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

interface BuildSpec {
  range: RangeClass;
  loadout: Loadout;
  main: string;
  offhand: string | null;
  /** Equal-points kiter: Hydraulic Systems (melee-only damage) moved into Servo Motors. */
  kiter?: boolean;
}

const byHands = (range: RangeClass, hands: string): WeaponDefinition[] =>
  WEAPON_DEFINITIONS.filter((w) => w.rangeBand === range && w.handsRequired === hands);
const SHIELDS = WEAPON_DEFINITIONS.filter((w) => w.handsRequired === 'shield');

/** Weapons follow the equip rules in shared/utils/weaponSlots.ts; Dual Wield uses two copies. */
function sampleBuild(rng: () => number, range: RangeClass, loadout: Loadout): BuildSpec {
  if (loadout === 'two_handed') return { range, loadout, main: pick(rng, byHands(range, 'two')).name, offhand: null };
  const main = pick(rng, byHands(range, 'one')).name;
  if (loadout === 'dual_wield') return { range, loadout, main, offhand: main };
  if (loadout === 'weapon_shield') return { range, loadout, main, offhand: pick(rng, SHIELDS).name };
  return { range, loadout, main, offhand: null };
}

function inventoryRow(name: string, id: number): NonNullable<RobotWithWeapons['mainWeapon']> {
  const def = WEAPON_DEFINITIONS.find((w) => w.name === name);
  if (!def) throw new Error(`Weapon not found in WEAPON_DEFINITIONS: ${name}`);
  const weapon: Record<string, unknown> = { id, createdAt: new Date(0) };
  for (const attr of ROBOT_ATTRIBUTES) weapon[`${attr}Bonus`] = 0;
  Object.assign(weapon, def);
  return {
    id, userId: 1, weaponId: id, customName: null, pricePaid: 0, purchasedAt: new Date(0), weapon, refinements: [],
  } as unknown as NonNullable<RobotWithWeapons['mainWeapon']>;
}

/** A fresh, prepared robot (preparation mutates, so every arm gets its own object). */
function buildRobot(arm: Arm, id: number, name: string, spec: BuildSpec, level: number): RobotWithWeapons {
  const attributes: Record<string, number> = Object.fromEntries(ROBOT_ATTRIBUTES.map((attr) => [attr, level]));
  if (spec.kiter) {
    attributes.servoMotors = 2 * level - 1;
    attributes.hydraulicSystems = 1;
  }
  const robot = {
    id, userId: id, name, ...attributes,
    currentHP: 0, maxHP: 0, currentShield: 0, maxShield: 0,
    yieldThreshold: 10, loadoutType: spec.loadout, stance: 'balanced',
    mainWeaponId: id * 10, offhandWeaponId: spec.offhand ? id * 10 + 1 : null,
    mainWeapon: inventoryRow(spec.main, id * 10),
    offhandWeapon: spec.offhand ? inventoryRow(spec.offhand, id * 10 + 1) : null,
  } as unknown as RobotWithWeapons;
  arm.prepareRobotForCombat(robot);
  return robot;
}

// ─── Event-derived measurements ─────────────────────────────────────

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Seconds `name` spent within melee reach (≤ 2) of its current target, reconstructed from the
 * simulator's per-tick `range_transition` events. The band before the first transition is the
 * distance to the nearest opponent at spawn (always beyond reach in these arenas).
 */
function meleeSeconds(result: SpatialCombatResult, name: string, endTime: number): number {
  const start = result.startingPositions ?? {};
  const own = start[name];
  let nearest = Infinity;
  for (const [other, pos] of Object.entries(start)) if (other !== name && own) nearest = Math.min(nearest, dist(own, pos));
  let inMelee = nearest <= MELEE_REACH;
  let since = 0;
  let total = 0;
  for (const e of result.events) {
    if (e.timestamp > endTime) break;
    if (e.type !== 'range_transition' || e.attacker !== name) continue;
    const now = e.rangeBand === 'melee';
    if (inMelee && !now) total += e.timestamp - since;
    if (!inMelee && now) since = e.timestamp;
    inMelee = now;
  }
  if (inMelee) total += endTime - since;
  return total;
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

/** Running sums for one metric: per-arm values and per-arm paired deltas vs the baseline arm. */
class PairedStat {
  n = 0;
  private sum: number[];
  private dSum: number[];
  private dSq: number[];

  constructor(arms: number) {
    this.sum = new Array<number>(arms).fill(0);
    this.dSum = new Array<number>(arms).fill(0);
    this.dSq = new Array<number>(arms).fill(0);
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

  mean(arm: number): number {
    return this.n ? this.sum[arm] / this.n : NaN;
  }

  /** Mean paired delta and 95% CI half-width. */
  delta(arm: number): [number, number] {
    if (this.n < 2) return [NaN, NaN];
    const m = this.dSum[arm] / this.n;
    const variance = Math.max(0, (this.dSq[arm] - this.n * m * m) / (this.n - 1));
    return [m, (Z * Math.sqrt(variance)) / Math.sqrt(this.n)];
  }
}

type StatTable = Map<string, Map<string, PairedStat>>;

function stat(table: StatTable, row: string, metric: string, arms: number): PairedStat {
  let rowMap = table.get(row);
  if (!rowMap) table.set(row, (rowMap = new Map()));
  let s = rowMap.get(metric);
  if (!s) rowMap.set(metric, (s = new PairedStat(arms)));
  return s;
}

// ─── 1v1 suites ─────────────────────────────────────────────────────

interface DuelMetrics {
  scoreA: number;
  draw: number;
  timeout: number;
  noContact: number;
  meleeShare: number;
  dmgA: number;
  dmgB: number;
  oorMelee: number;
  oorMeleeDamage: number;
  duration: number;
}

function runDuel(arm: Arm, a: BuildSpec, b: BuildSpec, level: number, aFirst: boolean, seed: number): DuelMetrics {
  const ra = buildRobot(arm, 1, 'A', a, level);
  const rb = buildRobot(arm, 2, 'B', b, level);
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
  return {
    scoreA: result.winnerId === ra.id ? 1 : draw ? 0.5 : 0,
    draw,
    timeout: isTimeout(result, 120) ? 1 : 0,
    noContact: dmgA + dmgB === 0 ? 1 : 0,
    meleeShare: duration > 0 ? meleeSeconds(result, 'A', duration) / duration : 0,
    dmgA,
    dmgB,
    oorMelee: oor.count,
    oorMeleeDamage: oor.damage,
    duration,
  };
}

const DUEL_METRICS: Array<keyof DuelMetrics> = [
  'scoreA', 'draw', 'timeout', 'noContact', 'meleeShare', 'dmgA', 'dmgB', 'oorMelee', 'oorMeleeDamage', 'duration',
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

function runDuelSuite(arms: Arm[], suite: DuelSuite, level: number, trials: number, seed: number): DuelResults {
  const res: DuelResults = { cells: new Map(), marginal: new Map(), overall: new Map() };
  const suiteId = SUITES.indexOf(suite);
  for (const [cellIdx, [classA, classB]] of duelCells(suite).entries()) {
    const cell = suite === 'mobility' ? `${classA} vs ${classB} kiter` : `${classA} vs ${classB}`;
    for (let t = 0; t < trials; t++) {
      const rng = mulberry32(mix(seed, suiteId, level, cellIdx, t));
      let a: BuildSpec;
      let b: BuildSpec;
      if (suite === 'loadout') {
        const range = pick(rng, RANGES);
        a = sampleBuild(rng, range, classA as Loadout);
        b = sampleBuild(rng, range, classB as Loadout);
      } else {
        a = sampleBuild(rng, classA as RangeClass, pick(rng, LOADOUTS));
        b = { ...sampleBuild(rng, classB as RangeClass, pick(rng, LOADOUTS)), kiter: suite === 'mobility' };
      }
      const battleSeed = mix(seed, 0xba771e, suiteId, level, cellIdx, t);
      const perArm = arms.map((arm) => runDuel(arm, a, b, level, t % 2 === 0, battleSeed));
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

/** Same ordering as grandMeleeBattleOrchestrator.computePlacements (not exported; that module needs a DB client). */
function placementOrder(states: SpatialRobotCombatState[], events: SpatialCombatEvent[]): string[] {
  const eliminatedAt = new Map<string, number>();
  for (const e of events) {
    if (ELIMINATION_TYPES.has(e.type) && e.defender && !eliminatedAt.has(e.defender)) eliminatedAt.set(e.defender, e.timestamp);
  }
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

function runGrandMelee(arm: Arm, specs: BuildSpec[], level: number, seed: number): GrandMeleeTrial {
  const robots = specs.map((spec, k) => buildRobot(arm, k + 1, `G${k + 1}`, spec, level));
  const n = robots.length;
  const config: BattleConfig = { allowDraws: false, arenaRadius: 16 + (n - 2) * 3 };
  const result = withSeed(seed, () => arm.simulateBattleMulti(robots, config));
  const states = result.finalStates ?? [];
  const order = placementOrder(states, result.events);
  const end = result.durationSeconds;
  const eliminatedAt = new Map<string, number>();
  for (const e of result.events) {
    if (ELIMINATION_TYPES.has(e.type) && e.defender && !eliminatedAt.has(e.defender)) eliminatedAt.set(e.defender, e.timestamp);
  }
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
        meleeShare: alive > 0 ? meleeSeconds(result, robot.name, alive) / alive : 0,
      },
    };
  });
  return {
    robots: perRobot,
    battle: {
      timeout: isTimeout(result, 120) ? 1 : 0,
      duration: end,
      survivors: states.filter((s) => s.isAlive).length,
      oorMelee: oor.count,
      oorMeleeDamage: oor.damage,
      noContact: totalDamage === 0 ? 1 : 0,
    },
  };
}

interface GrandMeleeResults {
  byRange: StatTable;
  byLoadout: StatTable;
  battle: StatTable;
}

function runGrandMeleeSuite(arms: Arm[], level: number, trials: number, seed: number): GrandMeleeResults {
  const res: GrandMeleeResults = { byRange: new Map(), byLoadout: new Map(), battle: new Map() };
  const suiteId = SUITES.indexOf('grand-melee');
  for (let t = 0; t < trials; t++) {
    const rng = mulberry32(mix(seed, suiteId, level, 0, t));
    const specs: BuildSpec[] = [];
    for (const range of RANGES) for (const loadout of LOADOUTS) specs.push(sampleBuild(rng, range, loadout));
    for (let k = specs.length - 1; k > 0; k--) {
      const r = Math.floor(rng() * (k + 1));
      [specs[k], specs[r]] = [specs[r], specs[k]];
    }
    const battleSeed = mix(seed, 0xba771e, suiteId, level, 0, t);
    const perArm = arms.map((arm) => runGrandMelee(arm, specs, level, battleSeed));
    for (const m of GM_BATTLE_METRICS) stat(res.battle, 'all battles', m, arms.length).add(perArm.map((r) => r.battle[m]));
    for (const [table, key] of [[res.byRange, 'range'], [res.byLoadout, 'loadout']] as const) {
      const groups = key === 'range' ? RANGES : LOADOUTS;
      for (const g of groups) {
        for (const m of GM_ROBOT_METRICS) {
          const values = perArm.map((trial) => {
            const members = trial.robots.filter((r) => r.spec[key] === g);
            return members.reduce((acc, r) => acc + r.metrics[m], 0) / members.length;
          });
          stat(table, g, m, arms.length).add(values);
        }
      }
    }
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
  score: { label: 'score vs other classes (win + ½ draw)', scale: 100, digits: 1, unit: '%' },
  draw: { label: 'draw rate', scale: 100, digits: 1, unit: '%' },
  timeout: { label: 'timeout rate (120 s)', scale: 100, digits: 1, unit: '%' },
  noContact: { label: 'no-contact rate (0 damage dealt by anyone)', scale: 100, digits: 2, unit: '%' },
  meleeShare: { label: 'time within melee reach (≤ 2 units) of target', scale: 100, digits: 1, unit: '%' },
  dmgA: { label: 'damage dealt by A', scale: 1, digits: 1, unit: '' },
  dmgB: { label: 'damage dealt by B', scale: 1, digits: 1, unit: '' },
  oorMelee: { label: 'melee attacks resolved beyond reach / battle', scale: 1, digits: 2, unit: '' },
  oorMeleeDamage: { label: 'damage from melee attacks beyond reach / battle', scale: 1, digits: 1, unit: '' },
  duration: { label: 'mean duration (s)', scale: 1, digits: 1, unit: '' },
  normRank: { label: 'normalized rank (0 = 1st, 1 = last; parity 0.500)', scale: 1, digits: 3, unit: '' },
  podium: { label: 'podium rate (top 3 of 16; parity 18.8%)', scale: 100, digits: 1, unit: '%' },
  win: { label: 'win rate (1st of 16; parity 6.3%)', scale: 100, digits: 1, unit: '%' },
  zeroDamage: { label: 'zero-damage participant rate', scale: 100, digits: 1, unit: '%' },
  damage: { label: 'damage dealt per robot', scale: 1, digits: 1, unit: '' },
  survivors: { label: 'survivors at end', scale: 1, digits: 2, unit: '' },
};

function fmtValue(v: number, f: MetricFormat): string {
  return `${(v * f.scale).toFixed(f.digits)}${f.unit}`;
}

function fmtDelta([d, hw]: [number, number], f: MetricFormat): string {
  if (Number.isNaN(d)) return 'n/a';
  const sign = d * f.scale >= 0 ? '+' : '';
  return `${sign}${(d * f.scale).toFixed(f.digits)} ±${(hw * f.scale).toFixed(f.digits)}`;
}

/** Rows × one metric: baseline value, each other arm's paired delta (95% CI), each other arm's value. */
function metricTable(arms: Arm[], table: StatTable, metric: string, rowLabel: string): string[] {
  const f = FORMATS[metric];
  const others = arms.slice(1);
  const lines = [
    `**${f.label}**${f.unit === '%' ? ' — deltas in percentage points' : ''}`,
    '',
    `| ${rowLabel} | n | ${arms[0].label} | ${others.map((a) => `Δ ${a.label} (95% CI)`).join(' | ')} | ${others.map((a) => a.label).join(' | ')} |`,
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

function renderHeader(arms: Arm[], suite: Suite, level: number, trials: number, seed: number): string[] {
  return [
    `### Suite \`${suite}\`, attribute level ${level} (${trials} paired trials per ${suite === 'grand-melee' ? 'arm' : 'cell'}, seed ${seed})`,
    '',
    ...arms.map((a, i) => `- arm \`${a.label}\`${i === 0 ? ' (baseline)' : ''}: ${a.revision}`),
    '',
  ];
}

function renderDuel(arms: Arm[], res: DuelResults): string[] {
  const lines: string[] = [];
  if (res.marginal.size > 0) lines.push(...metricTable(arms, res.marginal, 'score', 'class'));
  for (const m of ['timeout', 'noContact', 'meleeShare', 'oorMelee', 'oorMeleeDamage', 'duration', 'draw']) lines.push(...metricTable(arms, res.overall, m, 'scope'));
  for (const m of ['scoreA', 'timeout', 'meleeShare', 'noContact', 'dmgA', 'dmgB', 'oorMelee', 'oorMeleeDamage']) lines.push(...metricTable(arms, res.cells, m, 'A vs B'));
  return lines;
}

function renderGrandMelee(arms: Arm[], res: GrandMeleeResults): string[] {
  const lines: string[] = [];
  for (const m of GM_BATTLE_METRICS) lines.push(...metricTable(arms, res.battle, m, 'scope'));
  for (const [table, label] of [[res.byRange, 'range class'], [res.byLoadout, 'loadout']] as const) {
    for (const m of GM_ROBOT_METRICS) lines.push(...metricTable(arms, table, m, label));
  }
  return lines;
}

// ─── CLI ────────────────────────────────────────────────────────────

interface Options {
  arms: Array<[string, string]>;
  suite: Suite;
  level: number;
  trials: number;
  seed: number;
  out: string | null;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { arms: [], suite: 'range', level: 10, trials: 2000, seed: 516, out: null };
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
      case '--level': opts.level = Number(value); i++; break;
      case '--trials': opts.trials = Number(value); i++; break;
      case '--seed': opts.seed = Number(value); i++; break;
      case '--out': opts.out = value ?? null; i++; break;
      default: throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  if (opts.arms.length < 2) throw new Error('--arms needs at least a baseline and one comparison arm');
  for (const [k, v] of [['level', opts.level], ['trials', opts.trials], ['seed', opts.seed]] as const) {
    if (!Number.isInteger(v) || v < (k === 'seed' ? 0 : 1)) throw new Error(`--${k} must be a positive integer, got ${v}`);
  }
  return opts;
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const arms = opts.arms.map(([label, dir]) => loadArm(label, dir));
  const started = Date.now();
  const lines = renderHeader(arms, opts.suite, opts.level, opts.trials, opts.seed);
  if (opts.suite === 'grand-melee') {
    lines.push(...renderGrandMelee(arms, runGrandMeleeSuite(arms, opts.level, opts.trials, opts.seed)));
  } else {
    lines.push(...renderDuel(arms, runDuelSuite(arms, opts.suite as DuelSuite, opts.level, opts.trials, opts.seed)));
  }
  const markdown = `${lines.join('\n')}\n`;
  process.stdout.write(markdown);
  if (opts.out) fs.writeFileSync(opts.out, markdown);
  process.stderr.write(`combatBaselineValidation: ${opts.suite} level ${opts.level} done in ${((Date.now() - started) / 1000).toFixed(0)} s\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`combatBaselineValidation failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  void disconnectSeedClient();
}
