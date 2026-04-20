import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import logger from '../config/logger';
import { assignLeagueInstance } from '../services/league/leagueInstanceService';
import { assignTagTeamLeagueInstance } from '../services/tag-team/tagTeamLeagueInstanceService';
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

// ── Constants ────────────────────────────────────────────────────────

const LOADOUT_TYPES = ['single', 'weapon_shield', 'dual_wield', 'two_handed'] as const;
const RANGE_BANDS = ['melee', 'short', 'mid', 'long'] as const;
const STANCES = ['balanced', 'offensive', 'defensive'] as const;

// ── Tier prefix helpers ──────────────────────────────────────────────

/** Map tier name to the username prefix used for auto-generated users. */
function tierPrefix(tierName: TierConfig['name']): string {
  const map: Record<TierConfig['name'], string> = {
    WimpBot: 'auto_wimpbot',
    AverageBot: 'auto_averagebot',
    ExpertBot: 'auto_expertbot',
  };
  return map[tierName];
}

// ── Main function ────────────────────────────────────────────────────

/**
 * Generate battle-ready users using the tiered stable system.
 *
 * Cycle N creates N stables distributed across WimpBot / AverageBot / ExpertBot.
 * Each stable is created inside a Prisma $transaction for atomicity.
 */
export async function generateBattleReadyUsers(
  cycleNumber: number,
): Promise<TieredGenerationResult> {
  // Early return for invalid cycle numbers
  if (cycleNumber <= 0) {
    logger.warn(`[UserGeneration] cycleNumber ${cycleNumber} is <= 0, skipping generation.`);
    return {
      usersCreated: 0,
      robotsCreated: 0,
      tagTeamsCreated: 0,
      usernames: [],
      tierBreakdown: { wimpBot: 0, averageBot: 0, expertBot: 0 },
    };
  }

  const startTime = Date.now();
  const tierBreakdown = distributeTiers(cycleNumber);
  logger.info(
    `[UserGeneration] Generating ${cycleNumber} stables for Cycle ${cycleNumber} ` +
    `(WimpBot: ${tierBreakdown.wimpBot}, AverageBot: ${tierBreakdown.averageBot}, ExpertBot: ${tierBreakdown.expertBot})`,
  );

  // Fetch all weapons once and cast to WeaponRecord[]
  const allWeapons = (await prisma.weapon.findMany()) as unknown as WeaponRecord[];

  // Gather existing stable names for collision avoidance
  const existingStableNames = new Set(
    (await prisma.user.findMany({
      where: { stableName: { not: null } },
      select: { stableName: true },
    })).map((u) => u.stableName as string),
  );

  // Track robot counts per tier+loadout+weapon combination for sequential numbering
  // We'll populate this lazily as we create robots
  const robotCountsByNamePrefix: Record<string, number> = {};

  // Count existing users per tier prefix for sequential username numbering
  const userCountsByTier: Record<string, number> = {};
  for (const tier of TIER_CONFIGS) {
    const prefix = tierPrefix(tier.name);
    const count = await prisma.user.count({
      where: { username: { startsWith: prefix } },
    });
    userCountsByTier[tier.name] = count;
  }

  // Build the list of stables to create: [ { tierConfig, count }, ... ]
  const stablePlan: { tier: TierConfig; count: number }[] = [
    { tier: TIER_CONFIGS[0], count: tierBreakdown.wimpBot },
    { tier: TIER_CONFIGS[1], count: tierBreakdown.averageBot },
    { tier: TIER_CONFIGS[2], count: tierBreakdown.expertBot },
  ];

  const usernames: string[] = [];
  let totalRobotsCreated = 0;
  let totalTagTeamsCreated = 0;

  for (const { tier, count } of stablePlan) {
    for (let i = 0; i < count; i++) {
      // Sequential username: auto_wimpbot_0001, auto_averagebot_0042, etc.
      userCountsByTier[tier.name]++;
      const seqNum = userCountsByTier[tier.name];
      const username = `${tierPrefix(tier.name)}_${String(seqNum).padStart(4, '0')}`;

      try {
        await prisma.$transaction(async (tx) => {
          // ── Create user ──────────────────────────────────────
          const stableName = generateStableName(existingStableNames);
          existingStableNames.add(stableName);

          const hashedPassword = await bcrypt.hash('testpass123', 10);
          const user = await tx.user.create({
            data: {
              username,
              passwordHash: hashedPassword,
              currency: 100000,
              role: 'user',
              stableName,
            },
          });

          // ── Create robots ────────────────────────────────────
          const createdRobots: { id: number }[] = [];

          for (let r = 0; r < tier.robotCount; r++) {
            const loadoutType = randomElement(LOADOUT_TYPES);
            const rangeBand = randomElement(RANGE_BANDS);
            const stance = randomElement(STANCES);
            const yieldThreshold = Math.floor(Math.random() * 21); // 0–20

            // Select main weapon via fallback chain
            const mainWeaponRecord = selectWeapon(allWeapons, {
              loadoutType,
              rangeBand,
              priceTier: tier.priceTier,
            });

            // Create weapon inventory for main weapon
            const mainInv = await tx.weaponInventory.create({
              data: { userId: user.id, weaponId: mainWeaponRecord.id },
            });

            let offhandInvId: number | null = null;

            if (loadoutType === 'weapon_shield') {
              const shieldRecord = selectShield(allWeapons, tier.priceTier);
              const shieldInv = await tx.weaponInventory.create({
                data: { userId: user.id, weaponId: shieldRecord.id },
              });
              offhandInvId = shieldInv.id;
            } else if (loadoutType === 'dual_wield') {
              // Second copy of the same weapon
              const dualInv = await tx.weaponInventory.create({
                data: { userId: user.id, weaponId: mainWeaponRecord.id },
              });
              offhandInvId = dualInv.id;
            }

            // Robot name: "{Tier} {LoadoutTitle} {WeaponCodename} {Number}"
            const loadoutTitle = LOADOUT_TITLES[loadoutType] || 'Lone';
            const weaponCodename = WEAPON_CODENAMES[mainWeaponRecord.name] || 'Unknown';
            const namePrefix = `${tier.name} ${loadoutTitle} ${weaponCodename}`;
            
            // Get or initialize count for this name prefix
            if (robotCountsByNamePrefix[namePrefix] === undefined) {
              // Query existing robots with this exact prefix to find the highest number
              const existingRobots = await tx.robot.findMany({
                where: { name: { startsWith: namePrefix } },
                select: { name: true },
              });
              // Extract numbers from existing names and find the max
              let maxNum = 0;
              for (const robot of existingRobots) {
                // eslint-disable-next-line security/detect-non-literal-regexp -- namePrefix is escaped via standard regex escape pattern
                const match = robot.name.match(new RegExp(`^${namePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`));
                if (match) {
                  const num = parseInt(match[1], 10);
                  if (num > maxNum) maxNum = num;
                }
              }
              robotCountsByNamePrefix[namePrefix] = maxNum;
            }
            
            robotCountsByNamePrefix[namePrefix]++;
            const robotNumber = robotCountsByNamePrefix[namePrefix];
            const robotName = `${namePrefix} ${robotNumber}`;

            const attributes = buildAttributes(tier.attributeLevel);
            const maxHP = 50 + Math.floor(tier.attributeLevel * 5);
            const maxShield = Math.floor(tier.attributeLevel * 4);

            const bronzeLeagueId = await assignLeagueInstance('bronze');

            const robot = await tx.robot.create({
              data: {
                userId: user.id,
                name: robotName,
                frameId: 1,
                ...attributes,
                currentHP: maxHP,
                maxHP,
                currentShield: maxShield,
                maxShield,
                elo: 1200,
                currentLeague: 'bronze',
                leagueId: bronzeLeagueId,
                leaguePoints: 0,
                loadoutType,
                mainWeaponId: mainInv.id,
                offhandWeaponId: offhandInvId,
                stance,
                battleReadiness: 100,
                yieldThreshold,
                imageUrl: `/assets/robots/${tier.name.toLowerCase()}_512x512.webp`,
              },
            });

            createdRobots.push(robot);
            totalRobotsCreated++;
          }

          // ── Tag team for multi-robot stables ─────────────────
          if (tier.createTagTeam && createdRobots.length >= 2) {
            const tagTeamLeagueId = await assignTagTeamLeagueInstance('bronze');
            await tx.tagTeam.create({
              data: {
                stableId: user.id,
                activeRobotId: createdRobots[0].id,
                reserveRobotId: createdRobots[1].id,
                tagTeamLeague: 'bronze',
                tagTeamLeagueId,
              },
            });
            totalTagTeamsCreated++;
            logger.info(`[UserGeneration] Created tag team for ${username}`);
          }
        });

        usernames.push(username);
      } catch (error) {
        logger.error(`[UserGeneration] Failed to create stable ${username}:`, error);
        // Continue to next stable — transaction rolled back automatically
      }

      // Progress logging
      if ((usernames.length) % 5 === 0 || i + 1 === count) {
        logger.info(`[UserGeneration] ${tier.name}: created ${i + 1}/${count} stables`);
      }
    }
  }

  // ── Bankruptcy logging ───────────────────────────────────────────
  const bankruptUsers = await prisma.user.findMany({
    where: { currency: { lt: 0 } },
    select: { username: true, currency: true },
  });
  for (const u of bankruptUsers) {
    logger.warn(
      `[UserGeneration] Bankruptcy: ${u.username} has ₡${u.currency} after cycle ${cycleNumber}`,
    );
  }

  const duration = Date.now() - startTime;
  logger.info(
    `[UserGeneration] ✅ Created ${usernames.length} stables, ` +
    `${totalRobotsCreated} robots, ${totalTagTeamsCreated} tag teams in ${duration}ms`,
  );

  return {
    usersCreated: usernames.length,
    robotsCreated: totalRobotsCreated,
    tagTeamsCreated: totalTagTeamsCreated,
    usernames,
    tierBreakdown,
  };
}
