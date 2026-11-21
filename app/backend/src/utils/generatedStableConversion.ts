/**
 * One-off repair (Nov 2026): turn the three-robot AverageBot and ExpertBot
 * generated stables into WimpBot stables, keeping their match results.
 *
 * From 28 Oct 2026 the generator gave every tier three robots (see
 * `TierConfig.robotCount`), so ACC Season 2 started with 50 stables of three
 * level-10 ExpertBots (and 50 of three AverageBots) in the 3v3 league, far
 * beyond what a human stable can build from the starting balance. The generator
 * is fixed; this converts the stables already in play. A three-robot stable is
 * only allowed as WimpBots, so every robot of such a stable becomes a WimpBot.
 *
 * Changed per robot: the 23 attributes, max/current HP and shield (full), damage,
 * repair quote and readiness, the equipped weapons (same inventory rows, a
 * WimpBot-band weapon of the same hands and range), the name and the portrait.
 * Changed per stable: the username (`auto_wimpbot_NNNN`). Kept: battles, wins,
 * ELO, fame, standings, teams, subscriptions, stance, loadout, yield threshold.
 *
 * The plan is deterministic (no randomness), so a dry run shows exactly what the
 * real run writes. Re-running is a no-op: converted stables carry the WimpBot
 * username prefix and are no longer selected.
 *
 * Run through `scripts/convertGeneratedStablesToWimpBot.ts`. Remove both once
 * the ACC run is done.
 */

import prisma from '../lib/prisma';
import { TIER_CONFIGS, LOADOUT_TITLES, WEAPON_CODENAMES } from './tierConfig';
import type { WeaponRecord } from './weaponSelection';
import { TIER_PREFIX, buildAttributes, generatedMaxHP, generatedMaxShield } from './userGeneration';

const WIMPBOT = TIER_CONFIGS[0];
/** Stables built with three robots under a tier that may not have three. */
const SOURCE_PREFIXES = [TIER_PREFIX.AverageBot, TIER_PREFIX.ExpertBot].map((p) => `${p}_`);
const WIMPBOT_IMAGE = `/assets/robots/${WIMPBOT.name.toLowerCase()}_512x512.webp`;

export interface WeaponSwap {
  inventoryId: number;
  from: string;
  to: string;
  toWeaponId: number;
}

export interface RobotConversion {
  robotId: number;
  oldName: string;
  newName: string;
  main: WeaponSwap;
  offhand: WeaponSwap | null;
}

export interface StableConversion {
  userId: number;
  stableName: string | null;
  oldUsername: string;
  newUsername: string;
  robots: RobotConversion[];
}

export interface ConversionPlan {
  stables: StableConversion[];
}

/** Deterministic pick: the same robot always gets the same weapon. */
function pick<T extends { id: number }>(candidates: T[], seed: number): T | undefined {
  if (candidates.length === 0) return undefined;
  const sorted = [...candidates].sort((a, b) => a.id - b.id);
  return sorted[seed % sorted.length];
}

/** WimpBot-band weapon with the same hands and range as `current`, widening the match like `selectWeapon`. */
export function wimpBotWeaponFor(weapons: WeaponRecord[], current: WeaponRecord, seed: number): WeaponRecord {
  const { min, max } = WIMPBOT.priceTier;
  const inBand = weapons.filter((w) => w.cost >= min && w.cost <= max);
  if (current.handsRequired === 'shield') {
    const shield = pick(inBand.filter((w) => w.handsRequired === 'shield'), seed);
    if (!shield) throw new Error('No WimpBot-band shield in the weapon catalogue');
    return shield;
  }
  const nonShield = inBand.filter((w) => w.weaponType !== 'shield' && w.handsRequired !== 'shield');
  const sameHands = nonShield.filter((w) => w.handsRequired === current.handsRequired);
  const chosen =
    pick(sameHands.filter((w) => w.rangeBand === current.rangeBand), seed) ??
    pick(sameHands, seed) ??
    pick(nonShield, seed);
  if (!chosen) throw new Error(`No WimpBot-band weapon for ${current.name}`);
  return chosen;
}

/** Highest `{prefix} N` number already used by a robot name. */
function maxNumberFor(prefix: string, names: string[]): number {
  let max = 0;
  for (const name of names) {
    if (!name.startsWith(`${prefix} `)) continue;
    const n = Number(name.slice(prefix.length + 1));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max;
}

/**
 * Read the database and work out every change. Writes nothing.
 *
 * @param options.userIds - Limit the plan to these stables (tests scope to their
 *   own fixtures); the ACC run converts every matching stable.
 */
export async function planWimpBotConversion(options: { userIds?: number[] } = {}): Promise<ConversionPlan> {
  const candidates = await prisma.user.findMany({
    where: {
      isGenerated: true,
      stableType: 'generated',
      OR: SOURCE_PREFIXES.map((prefix) => ({ username: { startsWith: prefix } })),
      ...(options.userIds ? { id: { in: options.userIds } } : {}),
    },
    include: {
      robots: {
        orderBy: { id: 'asc' },
        include: {
          mainWeapon: { include: { weapon: true } },
          offhandWeapon: { include: { weapon: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
  });
  // Only the three-robot stables break the rule; a correctly built AverageBot
  // (2) or ExpertBot (1) stable is left alone.
  const users = candidates.filter((u) => u.robots.length === 3);

  const weapons = (await prisma.weapon.findMany()) as unknown as WeaponRecord[];
  const wimpUsernames = await prisma.user.findMany({
    where: { username: { startsWith: `${TIER_PREFIX.WimpBot}_` } },
    select: { username: true },
  });
  let nextUserNumber = wimpUsernames.reduce((max, { username }) => {
    const n = Number(username.slice(TIER_PREFIX.WimpBot.length + 1));
    return Number.isInteger(n) && n > max ? n : max;
  }, 0);
  const wimpRobotNames = (await prisma.robot.findMany({
    where: { name: { startsWith: `${WIMPBOT.name} ` } },
    select: { name: true },
  })).map((r) => r.name);
  const nextRobotNumber: Record<string, number> = {};

  const stables: StableConversion[] = [];
  for (const user of users) {
    nextUserNumber++;
    const robots: RobotConversion[] = [];
    for (const robot of user.robots) {
      if (!robot.mainWeapon) throw new Error(`Robot ${robot.id} (${robot.name}) has no main weapon`);
      const mainTo = wimpBotWeaponFor(weapons, robot.mainWeapon.weapon as unknown as WeaponRecord, robot.id);
      let offhand: WeaponSwap | null = null;
      if (robot.offhandWeapon) {
        const current = robot.offhandWeapon.weapon as unknown as WeaponRecord;
        // Dual wield carries a second copy of the main weapon; keep it a copy.
        const to = robot.loadoutType === 'dual_wield' ? mainTo : wimpBotWeaponFor(weapons, current, robot.id);
        offhand = { inventoryId: robot.offhandWeapon.id, from: current.name, to: to.name, toWeaponId: to.id };
      }

      const title = LOADOUT_TITLES[robot.loadoutType] || 'Lone';
      const codename = WEAPON_CODENAMES[mainTo.name] || 'Unknown';
      const prefix = `${WIMPBOT.name} ${title} ${codename}`;
      nextRobotNumber[prefix] = (nextRobotNumber[prefix] ?? maxNumberFor(prefix, wimpRobotNames)) + 1;

      robots.push({
        robotId: robot.id,
        oldName: robot.name,
        newName: `${prefix} ${nextRobotNumber[prefix]}`,
        main: { inventoryId: robot.mainWeapon.id, from: robot.mainWeapon.weapon.name, to: mainTo.name, toWeaponId: mainTo.id },
        offhand,
      });
    }
    stables.push({
      userId: user.id,
      stableName: user.stableName,
      oldUsername: user.username,
      newUsername: `${TIER_PREFIX.WimpBot}_${String(nextUserNumber).padStart(4, '0')}`,
      robots,
    });
  }
  return { stables };
}

/** Apply a plan, one transaction per stable. Returns the number of stables converted. */
export async function applyWimpBotConversion(plan: ConversionPlan): Promise<number> {
  const level = WIMPBOT.attributeLevel;
  const maxHP = generatedMaxHP(level);
  const maxShield = generatedMaxShield(level);
  let converted = 0;

  for (const stable of plan.stables) {
    await prisma.$transaction(async (tx) => {
      // Guard against a stale plan: the stable must still be unconverted.
      const current = await tx.user.findUnique({ where: { id: stable.userId }, select: { username: true } });
      if (current?.username !== stable.oldUsername) {
        throw new Error(`Stable ${stable.userId} changed since planning (${current?.username ?? 'deleted'})`);
      }
      await tx.user.update({ where: { id: stable.userId }, data: { username: stable.newUsername } });

      for (const robot of stable.robots) {
        for (const swap of [robot.main, robot.offhand]) {
          if (swap) await tx.weaponInventory.update({ where: { id: swap.inventoryId }, data: { weaponId: swap.toWeaponId } });
        }
        await tx.robot.update({
          where: { id: robot.robotId },
          data: {
            ...buildAttributes(level),
            name: robot.newName,
            maxHP,
            currentHP: maxHP,
            maxShield,
            currentShield: maxShield,
            damageTaken: 0,
            repairQuoteCredits: 0,
            battleReadiness: 100,
            imageUrl: WIMPBOT_IMAGE,
          },
        });
      }
    });
    converted++;
  }
  return converted;
}
