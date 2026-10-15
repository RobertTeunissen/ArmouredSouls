/**
 * Loadout parity baseline (#517, parent #516).
 *
 *   pnpm exec tsx scripts/loadoutParityBaseline.ts [--trials 2000] [--out <file.md>]
 *
 * Compares 1v1 outcomes for every loadout pairing under two combat-preparation
 * variants on identical synthetic robots:
 *
 *   - `legacy`    — the pre-#517 preparation (base + both weapons + tuning, NO loadout
 *                   modifier). Inlined below FOR COMPARISON ONLY; never use it in game code.
 *   - `corrected` — the real `prepareRobotForCombat` (canonical loadout-adjusted attributes).
 *
 * Builds: uniform attribute level (1, 10, 25) for all 23 attributes, balanced stance,
 * yield threshold 10, no tuning, no refinements. Weapons come from the seed catalogue
 * (`WEAPON_DEFINITIONS`); no database is used. Sides are swapped every other trial.
 *
 * Output per cell: side-A win rate with a 95% Wilson interval, draw rate, mean damage
 * dealt per side, timeout rate (duration >= MAX_BATTLE_DURATION) and mean duration.
 */
import fs from 'fs';
import { WEAPON_DEFINITIONS, disconnectSeedClient } from '../prisma/seed';
import { simulateBattle, MAX_BATTLE_DURATION, type RobotWithWeapons } from '../src/services/battle/combatSimulator';
import { prepareRobotForCombat, BASE_HP, HP_MULTIPLIER, SHIELD_MULTIPLIER } from '../src/utils/robotCalculations';
import { ROBOT_ATTRIBUTES } from '../src/shared/utils/robotAttributes';

type Loadout = 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
type Variant = 'legacy' | 'corrected';
type WeaponDefinition = (typeof WEAPON_DEFINITIONS)[number];

const LOADOUTS: Loadout[] = ['single', 'weapon_shield', 'two_handed', 'dual_wield'];
const LEVELS = [1, 10, 25];
const VARIANTS: Variant[] = ['legacy', 'corrected'];

/** Weapon names per family and loadout: [main, offhand?]. */
const FAMILIES: Record<string, Record<Loadout, [string, string?]>> = {
  melee: {
    single: ['Energy Blade'],
    dual_wield: ['Energy Blade', 'Energy Blade'],
    weapon_shield: ['Energy Blade', 'Combat Shield'],
    two_handed: ['Battle Axe'],
  },
  short: {
    single: ['Laser Pistol'],
    dual_wield: ['Laser Pistol', 'Laser Pistol'],
    weapon_shield: ['Laser Pistol', 'Combat Shield'],
    two_handed: ['Laser Rifle'],
  },
};

interface CellResult {
  family: string;
  level: number;
  loadoutA: Loadout;
  loadoutB: Loadout;
  variant: Variant;
  trials: number;
  winsA: number;
  draws: number;
  damageA: number;
  damageB: number;
  timeouts: number;
  duration: number;
}

function parseArgs(argv: string[]): { trials: number; out: string | null } {
  let trials = 2000;
  let out: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--trials') {
      trials = Number(argv[++i]);
    } else if (argv[i] === '--out') {
      out = argv[++i] ?? null;
    }
  }
  if (!Number.isInteger(trials) || trials < 1) {
    throw new Error(`--trials must be a positive integer, got ${trials}`);
  }
  return { trials, out };
}

function findWeapon(name: string): WeaponDefinition {
  const weapon = WEAPON_DEFINITIONS.find((w) => w.name === name);
  if (!weapon) throw new Error(`Weapon not found in WEAPON_DEFINITIONS: ${name}`);
  return weapon;
}

/** Fresh inventory row around a seed weapon (every bonus field defaults to 0). */
function inventoryRow(name: string, id: number): NonNullable<RobotWithWeapons['mainWeapon']> {
  const def = findWeapon(name) as Record<string, unknown>;
  const weapon: Record<string, unknown> = { id, createdAt: new Date(0) };
  for (const attr of ROBOT_ATTRIBUTES) weapon[`${attr}Bonus`] = 0;
  Object.assign(weapon, def);
  return {
    id,
    userId: 1,
    weaponId: id,
    customName: null,
    pricePaid: 0,
    purchasedAt: new Date(0),
    weapon,
    refinements: [],
  } as unknown as NonNullable<RobotWithWeapons['mainWeapon']>;
}

function buildRobot(id: number, loadout: Loadout, family: string, level: number): RobotWithWeapons {
  const [mainName, offName] = FAMILIES[family][loadout];
  const attributes = Object.fromEntries(ROBOT_ATTRIBUTES.map((attr) => [attr, level]));
  return {
    id,
    userId: id,
    name: `${loadout}-${id}`,
    ...attributes,
    currentHP: 0,
    maxHP: 0,
    currentShield: 0,
    maxShield: 0,
    yieldThreshold: 10,
    loadoutType: loadout,
    stance: 'balanced',
    mainWeaponId: id * 10,
    offhandWeaponId: offName ? id * 10 + 1 : null,
    mainWeapon: inventoryRow(mainName, id * 10),
    offhandWeapon: offName ? inventoryRow(offName, id * 10 + 1) : null,
  } as unknown as RobotWithWeapons;
}

/**
 * COMPARISON ONLY — the pre-#517 preparation: base + both weapons' bonuses, no loadout
 * modifier. No tuning or refinements are used by this script, so those steps are omitted.
 */
function legacyPrepare(robot: RobotWithWeapons): void {
  for (const attr of ROBOT_ATTRIBUTES) {
    const field = `${attr}Bonus`;
    const main = Number((robot.mainWeapon?.weapon as unknown as Record<string, unknown> | undefined)?.[field] ?? 0);
    const off = Number((robot.offhandWeapon?.weapon as unknown as Record<string, unknown> | undefined)?.[field] ?? 0);
    (robot as unknown as Record<string, unknown>)[attr] = Number(robot[attr as keyof RobotWithWeapons]) + main + off;
  }
  robot.maxHP = BASE_HP + Number(robot.hullIntegrity) * HP_MULTIPLIER;
  robot.maxShield = Number(robot.shieldCapacity) * SHIELD_MULTIPLIER;
  robot.currentHP = robot.maxHP;
  robot.currentShield = robot.maxShield;
}

function prepared(id: number, loadout: Loadout, family: string, level: number, variant: Variant): RobotWithWeapons {
  const robot = buildRobot(id, loadout, family, level);
  if (variant === 'legacy') legacyPrepare(robot);
  else prepareRobotForCombat(robot);
  return robot;
}

function runCell(family: string, level: number, loadoutA: Loadout, loadoutB: Loadout, variant: Variant, trials: number): CellResult {
  const cell: CellResult = {
    family, level, loadoutA, loadoutB, variant, trials,
    winsA: 0, draws: 0, damageA: 0, damageB: 0, timeouts: 0, duration: 0,
  };
  for (let t = 0; t < trials; t++) {
    const a = prepared(1, loadoutA, family, level, variant);
    const b = prepared(2, loadoutB, family, level, variant);
    const aFirst = t % 2 === 0;
    const result = aFirst ? simulateBattle(a, b) : simulateBattle(b, a);
    if (result.isDraw || result.winnerId === null) cell.draws++;
    else if (result.winnerId === a.id) cell.winsA++;
    cell.damageA += aFirst ? result.robot1DamageDealt : result.robot2DamageDealt;
    cell.damageB += aFirst ? result.robot2DamageDealt : result.robot1DamageDealt;
    if (result.durationSeconds >= MAX_BATTLE_DURATION) cell.timeouts++;
    cell.duration += result.durationSeconds;
  }
  return cell;
}

/** 95% Wilson score interval for k successes in n trials. */
function wilson(k: number, n: number): [number, number] {
  const z = 1.96;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

function renderMarkdown(cells: CellResult[], trials: number): string {
  const lines: string[] = [];
  lines.push(`Trials per cell: ${trials}. Win A = side-A wins / trials; draws counted separately.`);
  lines.push('');
  for (const family of Object.keys(FAMILIES)) {
    for (const level of LEVELS) {
      lines.push(`### ${family} weapons, attribute level ${level}`);
      lines.push('');
      lines.push('| A vs B | variant | win A (95% CI) | draws | dmg A | dmg B | timeouts | mean s |');
      lines.push('|---|---|---|---|---|---|---|---|');
      for (const c of cells.filter((x) => x.family === family && x.level === level)) {
        const [lo, hi] = wilson(c.winsA, c.trials);
        lines.push(
          `| ${c.loadoutA} vs ${c.loadoutB} | ${c.variant} | ${pct(c.winsA / c.trials)} (${pct(lo)}–${pct(hi)}) | ` +
          `${pct(c.draws / c.trials)} | ${(c.damageA / c.trials).toFixed(1)} | ${(c.damageB / c.trials).toFixed(1)} | ` +
          `${pct(c.timeouts / c.trials)} | ${(c.duration / c.trials).toFixed(1)} |`,
        );
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

function main(): void {
  const { trials, out } = parseArgs(process.argv.slice(2));
  const cells: CellResult[] = [];
  for (const family of Object.keys(FAMILIES)) {
    for (const level of LEVELS) {
      for (let i = 0; i < LOADOUTS.length; i++) {
        for (let j = i; j < LOADOUTS.length; j++) {
          for (const variant of VARIANTS) {
            cells.push(runCell(family, level, LOADOUTS[i], LOADOUTS[j], variant, trials));
          }
        }
      }
    }
  }
  const markdown = renderMarkdown(cells, trials);
  process.stdout.write(`${markdown}\n`);
  if (out) fs.writeFileSync(out, `${markdown}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`loadoutParityBaseline failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  void disconnectSeedClient();
}
