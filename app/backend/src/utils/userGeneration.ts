import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import logger from '../config/logger';
import { registerTeam } from '../services/team-battle/teamBattleService';
import { STANDING_BACKED_EVENTS, ensureStanding } from '../services/standings/standingPlacement';
import {
  TIER_CONFIGS,
  TierConfig,
  TieredGenerationResult,
  LOADOUT_TITLES,
  WEAPON_CODENAMES,
  distributeTiers,
} from './tierConfig';
import { generateStableName } from './stableNameGenerator';
import { selectWeapon, selectShield, WeaponRecord } from './weaponSelection';
import { stableTypeForCreation } from './stableType';

/*
 * Generated_Stables: filler stables that keep every battle type populated.
 *
 * Since Oct 2026 the population is a fixed target (`GENERATED_STABLE_TARGET`,
 * default 150) instead of N new stables on cycle N. Automatons fill the 1v1,
 * 2v2, Tag Team and KotH leagues; generated stables fill what they leave
 * short: the 3v3 league, Grand Melee and all three tournaments, so every
 * tournament opens the season with at least 128 entrants. Tournaments are the
 * cheapest events to fill (one bracket costs entrants − 1 battles in total),
 * leagues the dearest (about half a battle per entry every cycle), so the
 * filler stables enter no other league. Sizing: PRD_AUTO_USER_GENERATION.md.
 */

// ── Constants ────────────────────────────────────────────────────────

/** Default size of the generated-stable population (`GENERATED_STABLE_TARGET`). */
export const GENERATED_STABLE_TARGET_DEFAULT = 150;

/** Every filler stable has three robots: one 3v3 team, one 2v2 team. */
export const FILLER_ROBOTS_PER_STABLE = 3;

/** Events every robot of a filler stable holds. */
const FILLER_SHARED_EVENTS = ['league_3v3', 'tournament_3v3', 'tournament_1v1'] as const;
/** Fourth event per robot slot: slots 0–1 form the 2v2 tournament team, slot 2 enters Grand Melee. */
const FILLER_SLOT_EVENT = ['tournament_2v2', 'tournament_2v2', 'grand_melee'] as const;

const LOADOUT_TYPES = ['single', 'weapon_shield', 'dual_wield', 'two_handed'] as const;
const RANGE_BANDS = ['melee', 'short', 'mid', 'long'] as const;
const STANCES = ['balanced', 'offensive', 'defensive'] as const;

/** Every generated username starts with one of these (`auto_wimpbot_0001`, …). */
const TIER_PREFIX: Record<TierConfig['name'], string> = {
  WimpBot: 'auto_wimpbot',
  AverageBot: 'auto_averagebot',
  ExpertBot: 'auto_expertbot',
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Build an attributes object with all 23 robot attributes set to `level`. */
function buildAttributes(level: number): Record<string, number> {
  return {
    combatPower: level,
    targetingSystems: level,
    criticalSystems: level,
    penetration: level,
    weaponControl: level,
    attackSpeed: level,
    armorPlating: level,
    shieldCapacity: level,
    evasionThrusters: level,
    damageDampeners: level,
    counterProtocols: level,
    hullIntegrity: level,
    servoMotors: level,
    gyroStabilizers: level,
    hydraulicSystems: level,
    powerCore: level,
    combatAlgorithms: level,
    threatAnalysis: level,
    adaptiveAI: level,
    logicCores: level,
    syncProtocols: level,
    supportSystems: level,
    formationTactics: level,
  };
}

/** Pick a random element from a readonly array. */
function randomElement<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Target size of the generated-stable population: `GENERATED_STABLE_TARGET`
 * when it is a non-negative integer (0 turns generation off), else the default.
 */
export function getGeneratedStableTarget(): number {
  const raw = process.env.GENERATED_STABLE_TARGET;
  if (raw === undefined || raw.trim() === '') return GENERATED_STABLE_TARGET_DEFAULT;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : GENERATED_STABLE_TARGET_DEFAULT;
}

/** The four events (the Booking Office L1 cap) the filler robot in `slot` (0–2) holds. */
export function fillerSubscriptionsFor(slot: number): string[] {
  return [...FILLER_SHARED_EVENTS, FILLER_SLOT_EVENT[slot]];
}

function emptyResult(): TieredGenerationResult {
  return {
    usersCreated: 0,
    robotsCreated: 0,
    tagTeamsCreated: 0,
    league2v2TeamsCreated: 0,
    league3v3TeamsCreated: 0,
    usernames: [],
    tierBreakdown: { wimpBot: 0, averageBot: 0, expertBot: 0 },
  };
}

/** Generated filler stables that exist now (the `auto_*` bot stables). */
export async function countGeneratedStables(): Promise<number> {
  return prisma.user.count({
    where: {
      isGenerated: true,
      OR: Object.values(TIER_PREFIX).map((prefix) => ({ username: { startsWith: `${prefix}_` } })),
    },
  });
}

// ── Creation ─────────────────────────────────────────────────────────

/**
 * Create `count` filler stables, split evenly over the WimpBot / AverageBot /
 * ExpertBot attribute levels (1 / 5 / 10). Each stable: three armed robots,
 * Booking Office L1, the filler subscriptions, a 3v3 team (3v3 league and
 * tournament) and a 2v2 team of robots 1–2 (2v2 tournament only).
 *
 * Each stable is created in its own transaction; a failed stable is logged and
 * skipped. Teams are registered afterwards through `registerTeam`, which places
 * them in every standing-backed mode all members hold.
 */
export async function createGeneratedStables(count: number): Promise<TieredGenerationResult> {
  if (count <= 0) return emptyResult();

  const startTime = Date.now();
  const tierBreakdown = distributeTiers(count);
  logger.info(
    `[UserGeneration] Creating ${count} generated stables ` +
    `(WimpBot: ${tierBreakdown.wimpBot}, AverageBot: ${tierBreakdown.averageBot}, ExpertBot: ${tierBreakdown.expertBot})`,
  );

  const allWeapons = (await prisma.weapon.findMany()) as unknown as WeaponRecord[];
  const existingStableNames = new Set(
    (await prisma.user.findMany({
      where: { stableName: { not: null } },
      select: { stableName: true },
    })).map((u) => u.stableName as string),
  );

  // Sequential numbering per robot name prefix and per username prefix.
  const robotCountsByNamePrefix: Record<string, number> = {};
  const userCountsByTier: Record<string, number> = {};
  for (const tier of TIER_CONFIGS) {
    userCountsByTier[tier.name] = await prisma.user.count({
      where: { username: { startsWith: TIER_PREFIX[tier.name] } },
    });
  }

  const stablePlan: { tier: TierConfig; count: number }[] = [
    { tier: TIER_CONFIGS[0], count: tierBreakdown.wimpBot },
    { tier: TIER_CONFIGS[1], count: tierBreakdown.averageBot },
    { tier: TIER_CONFIGS[2], count: tierBreakdown.expertBot },
  ];

  // One hash for the whole run: these accounts never log in.
  const passwordHash = await bcrypt.hash('testpass123', 10);
  const usernames: string[] = [];
  let totalRobotsCreated = 0;
  let totalLeague2v2TeamsCreated = 0;
  let totalLeague3v3TeamsCreated = 0;

  for (const { tier, count: tierCount } of stablePlan) {
    for (let i = 0; i < tierCount; i++) {
      userCountsByTier[tier.name]++;
      const username = `${TIER_PREFIX[tier.name]}_${String(userCountsByTier[tier.name]).padStart(4, '0')}`;

      let created: { userId: number; stableName: string; robotIds: number[] };
      try {
        created = await prisma.$transaction(async (tx) => {
          const stableName = generateStableName(existingStableNames);
          existingStableNames.add(stableName);

          const user = await tx.user.create({
            data: {
              username,
              passwordHash,
              currency: 100000,
              role: 'user',
              stableName,
              // Spec #45: a Generated_Stable is deleted, not reset, at each Season_Rollover.
              isGenerated: true,
              // Spec #55 I1: Stable_Type follows isGenerated.
              stableType: stableTypeForCreation(true),
            },
          });

          // Booking Office L1: four subscriptions per robot.
          await tx.facility.create({ data: { userId: user.id, facilityType: 'booking_office', level: 1 } });

          const robotIds: number[] = [];
          for (let slot = 0; slot < FILLER_ROBOTS_PER_STABLE; slot++) {
            const loadoutType = randomElement(LOADOUT_TYPES);
            const rangeBand = randomElement(RANGE_BANDS);
            const stance = randomElement(STANCES);
            const yieldThreshold = Math.floor(Math.random() * 21); // 0–20

            const mainWeaponRecord = selectWeapon(allWeapons, { loadoutType, rangeBand, priceTier: tier.priceTier });
            // pricePaid: 0 because starter weapons are granted free during generation
            const mainInv = await tx.weaponInventory.create({
              data: { userId: user.id, weaponId: mainWeaponRecord.id, pricePaid: 0 },
            });

            let offhandInvId: number | null = null;
            if (loadoutType === 'weapon_shield') {
              const shieldRecord = selectShield(allWeapons, tier.priceTier);
              offhandInvId = (await tx.weaponInventory.create({
                data: { userId: user.id, weaponId: shieldRecord.id, pricePaid: 0 },
              })).id;
            } else if (loadoutType === 'dual_wield') {
              offhandInvId = (await tx.weaponInventory.create({
                data: { userId: user.id, weaponId: mainWeaponRecord.id, pricePaid: 0 },
              })).id;
            }

            // Robot name: "{Tier} {LoadoutTitle} {WeaponCodename} {Number}"
            const loadoutTitle = LOADOUT_TITLES[loadoutType] || 'Lone';
            const weaponCodename = WEAPON_CODENAMES[mainWeaponRecord.name] || 'Unknown';
            const namePrefix = `${tier.name} ${loadoutTitle} ${weaponCodename}`;
            if (robotCountsByNamePrefix[namePrefix] === undefined) {
              const existingRobots = await tx.robot.findMany({
                where: { name: { startsWith: namePrefix } },
                select: { name: true },
              });
              let maxNum = 0;
              for (const robot of existingRobots) {
                // eslint-disable-next-line security/detect-non-literal-regexp -- namePrefix is escaped via standard regex escape pattern
                const match = robot.name.match(new RegExp(`^${namePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`));
                if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
              }
              robotCountsByNamePrefix[namePrefix] = maxNum;
            }
            robotCountsByNamePrefix[namePrefix]++;

            const maxHP = 50 + Math.floor(tier.attributeLevel * 5);
            const maxShield = Math.floor(tier.attributeLevel * 4);
            const robot = await tx.robot.create({
              data: {
                userId: user.id,
                name: `${namePrefix} ${robotCountsByNamePrefix[namePrefix]}`,
                frameId: 1,
                ...buildAttributes(tier.attributeLevel),
                currentHP: maxHP,
                maxHP,
                currentShield: maxShield,
                maxShield,
                elo: 1200,
                loadoutType,
                mainWeaponId: mainInv.id,
                offhandWeaponId: offhandInvId,
                stance,
                battleReadiness: 100,
                yieldThreshold,
                imageUrl: `/assets/robots/${tier.name.toLowerCase()}_512x512.webp`,
              },
            });

            const subscriptions = fillerSubscriptionsFor(slot);
            await tx.subscription.createMany({
              data: subscriptions.map((eventType) => ({ robotId: robot.id, eventType, status: 'active' })),
              skipDuplicates: true,
            });
            // Robot standings only for subscribed robot modes (Grand Melee for slot 2).
            for (const definition of STANDING_BACKED_EVENTS) {
              if (definition.entityType === 'robot' && subscriptions.includes(definition.event)) {
                await ensureStanding(tx, 'robot', robot.id, definition.event);
              }
            }
            robotIds.push(robot.id);
          }

          return { userId: user.id, stableName, robotIds };
        });
      } catch (error) {
        logger.error(`[UserGeneration] Failed to create stable ${username}:`, error);
        continue; // transaction rolled back
      }

      usernames.push(username);
      totalRobotsCreated += created.robotIds.length;

      // Teams after the transaction (registerTeam runs its own, R15.5). A failed
      // team is logged and skipped; the stable keeps its robots.
      try {
        await registerTeam(created.userId, created.robotIds, `${created.stableName} 3v3`, 3, created.userId);
        totalLeague3v3TeamsCreated++;
      } catch (teamError) {
        const errorCode = (teamError as { code?: string }).code || 'UNKNOWN';
        logger.warn(`[UserGeneration] Failed to create 3v3 team for ${username}: ${errorCode} - ${teamError}`);
      }
      try {
        await registerTeam(created.userId, created.robotIds.slice(0, 2), `${created.stableName} 2v2`, 2, created.userId);
        totalLeague2v2TeamsCreated++;
      } catch (teamError) {
        const errorCode = (teamError as { code?: string }).code || 'UNKNOWN';
        logger.warn(`[UserGeneration] Failed to create 2v2 team for ${username}: ${errorCode} - ${teamError}`);
      }

      if (usernames.length % 25 === 0) {
        logger.info(`[UserGeneration] ${usernames.length}/${count} stables created`);
      }
    }
  }

  logger.info(
    `[UserGeneration] ✅ Created ${usernames.length} stables, ${totalRobotsCreated} robots, ` +
    `${totalLeague2v2TeamsCreated} 2v2 teams, ${totalLeague3v3TeamsCreated} 3v3 teams in ${Date.now() - startTime}ms`,
  );

  return {
    usersCreated: usernames.length,
    robotsCreated: totalRobotsCreated,
    tagTeamsCreated: 0,
    league2v2TeamsCreated: totalLeague2v2TeamsCreated,
    league3v3TeamsCreated: totalLeague3v3TeamsCreated,
    usernames,
    tierBreakdown,
  };
}

/** Result of a top-up: what was created, and the target and count it worked from. */
export interface GeneratedStableTopUpResult extends TieredGenerationResult {
  target: number;
  existingBefore: number;
}

/**
 * Create the generated stables missing from the target population. Runs in
 * every settlement, preparation days included, so the first preparation day
 * after a rollover (which deleted every generated stable) builds the whole
 * population before competitive cycle 1 creates the first tournaments. Later
 * runs normally create nothing.
 */
export async function topUpGeneratedStables(): Promise<GeneratedStableTopUpResult> {
  const target = getGeneratedStableTarget();
  const existingBefore = await countGeneratedStables();
  const missing = Math.max(0, target - existingBefore);
  if (missing === 0) {
    logger.info(`[UserGeneration] ${existingBefore} generated stables, target ${target}: nothing to create`);
    return { ...emptyResult(), target, existingBefore };
  }
  const result = await createGeneratedStables(missing);
  return { ...result, target, existingBefore };
}
