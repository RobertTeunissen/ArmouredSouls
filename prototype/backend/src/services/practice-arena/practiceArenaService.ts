/**
 * Practice Arena Service
 *
 * Stateless service that builds virtual robot objects and runs the combat engine
 * for consequence-free practice battles. Zero database writes — only reads robot
 * and weapon data, clones it, and passes it to the simulator.
 *
 * Architectural boundary:
 *   - IMPORTS from battle/: simulateBattle, CombatMessageGenerator
 *   - IMPORTS from utils/: selectWeapon, selectShield, TIER_CONFIGS, calculateMaxHP, calculateMaxShield
 *   - DOES NOT IMPORT: post-combat pipeline, battle strategy, cycle scheduler, scheduled matches
 *
 * @module services/practice-arena/practiceArenaService
 */

import { simulateBattle, type RobotWithWeapons, type CombatResult } from '../battle/combatSimulator';
import { CombatMessageGenerator } from '../battle/combatMessageGenerator';
import { selectWeapon, selectShield, type WeaponRecord } from '../../utils/weaponSelection';
import { TIER_CONFIGS } from '../../utils/tierConfig';
import { calculateMaxHP, calculateMaxShield } from '../../utils/robotCalculations';
import { verifyRobotOwnership } from '../../middleware/ownership';
import { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { practiceArenaMetrics } from './practiceArenaMetrics';
import { AppError } from '../../errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Sparring partner bot tier — player selects one of these */
export type BotTier = 'WimpBot' | 'AverageBot' | 'ExpertBot' | 'UltimateBot';

/** Sparring partner configuration from the API request */
export interface SparringPartnerConfig {
  botTier: BotTier;
  loadoutType: 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
  rangeBand: 'melee' | 'short' | 'mid' | 'long';
  stance: 'offensive' | 'defensive' | 'balanced';
  yieldThreshold: number; // 0-50
}

/** What-If overrides for an owned robot */
export interface WhatIfOverrides {
  attributes?: Partial<Record<string, number>>; // any of 23 attributes, each 1-50
  loadoutType?: 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
  stance?: 'offensive' | 'defensive' | 'balanced';
  yieldThreshold?: number;
  mainWeaponId?: number;
  offhandWeaponId?: number;
}

/** A battle slot is either an owned robot ID or a sparring partner config */
export type BattleSlot =
  | { type: 'owned'; robotId: number; overrides?: WhatIfOverrides }
  | { type: 'sparring'; config: SparringPartnerConfig };

/** Practice battle request */
export interface PracticeBattleRequest {
  robot1: BattleSlot;
  robot2: BattleSlot;
}

/** Practice battle result returned to the frontend */
export interface PracticeBattleResult {
  combatResult: CombatResult;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  battleLog: any[]; // narrative events from convertSimulatorEvents
  robot1Info: { name: string; maxHP: number; maxShield: number };
  robot2Info: { name: string; maxHP: number; maxShield: number };
}

/** Batch result returned when count > 1 */
export interface PracticeBatchResult {
  results: PracticeBattleResult[];
  aggregate: {
    totalBattles: number;
    robot1Wins: number;
    robot2Wins: number;
    draws: number;
    avgDurationSeconds: number;
    avgRobot1DamageDealt: number;
    avgRobot2DamageDealt: number;
  };
}

/** Sparring partner definition returned by GET /sparring-partners */
export interface SparringPartnerDefinition {
  botTier: BotTier;
  description: string;
  attributeLevel: number;
  priceTier: { min: number; max: number };
  loadoutOptions: string[];
  rangeBandOptions: string[];
  stanceOptions: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** UltimateBot tier — practice arena only, not added to tierConfig.ts */
export const ULTIMATE_BOT_CONFIG = {
  name: 'UltimateBot' as const,
  attributeLevel: 15,
  priceTier: { min: 400000, max: Infinity },
};

/** All 23 robot attribute names */
const ROBOT_ATTRIBUTES = [
  'combatPower', 'targetingSystems', 'criticalSystems', 'penetration', 'weaponControl', 'attackSpeed',
  'armorPlating', 'shieldCapacity', 'evasionThrusters', 'damageDampeners', 'counterProtocols',
  'hullIntegrity', 'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore',
  'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores',
  'syncProtocols', 'supportSystems', 'formationTactics',
] as const;

/** Synthetic negative ID counter for sparring partners */
let syntheticIdCounter = -1;

function nextSyntheticId(): number {
  return syntheticIdCounter--;
}

/** Reset synthetic ID counter (for testing) */
export function resetSyntheticIdCounter(): void {
  syntheticIdCounter = -1;
}

/** Reset full weapon cache (for testing) */
export function resetFullWeaponCache(): void {
  _fullWeaponCache = null;
}

// ---------------------------------------------------------------------------
// Sparring Partner Definitions
// ---------------------------------------------------------------------------

/**
 * Returns the 4 sparring partner type definitions.
 * WimpBot, AverageBot, ExpertBot reuse TIER_CONFIGS; UltimateBot is practice-only.
 */
export function getSparringPartnerDefinitions(): SparringPartnerDefinition[] {
  const loadoutOptions = ['single', 'weapon_shield', 'two_handed', 'dual_wield'];
  const rangeBandOptions = ['melee', 'short', 'mid', 'long'];
  const stanceOptions = ['offensive', 'defensive', 'balanced'];

  return [
    {
      botTier: 'WimpBot',
      description: 'Weak opponent with level 1 attributes',
      attributeLevel: TIER_CONFIGS[0].attributeLevel,
      priceTier: TIER_CONFIGS[0].priceTier,
      loadoutOptions,
      rangeBandOptions,
      stanceOptions,
    },
    {
      botTier: 'AverageBot',
      description: 'Standard opponent with level 5 attributes',
      attributeLevel: TIER_CONFIGS[1].attributeLevel,
      priceTier: TIER_CONFIGS[1].priceTier,
      loadoutOptions,
      rangeBandOptions,
      stanceOptions,
    },
    {
      botTier: 'ExpertBot',
      description: 'Tough opponent with level 10 attributes',
      attributeLevel: TIER_CONFIGS[2].attributeLevel,
      priceTier: TIER_CONFIGS[2].priceTier,
      loadoutOptions,
      rangeBandOptions,
      stanceOptions,
    },
    {
      botTier: 'UltimateBot',
      description: 'Elite opponent with level 15 attributes',
      attributeLevel: ULTIMATE_BOT_CONFIG.attributeLevel,
      priceTier: { min: ULTIMATE_BOT_CONFIG.priceTier.min, max: null as unknown as number },
      loadoutOptions,
      rangeBandOptions,
      stanceOptions,
    },
  ];
}

// ---------------------------------------------------------------------------
// Bot Tier → Config Lookup
// ---------------------------------------------------------------------------

function getBotTierConfig(botTier: BotTier): { attributeLevel: number; priceTier: { min: number; max: number } } {
  switch (botTier) {
    case 'WimpBot':
      return { attributeLevel: TIER_CONFIGS[0].attributeLevel, priceTier: TIER_CONFIGS[0].priceTier };
    case 'AverageBot':
      return { attributeLevel: TIER_CONFIGS[1].attributeLevel, priceTier: TIER_CONFIGS[1].priceTier };
    case 'ExpertBot':
      return { attributeLevel: TIER_CONFIGS[2].attributeLevel, priceTier: TIER_CONFIGS[2].priceTier };
    case 'UltimateBot':
      return { attributeLevel: ULTIMATE_BOT_CONFIG.attributeLevel, priceTier: ULTIMATE_BOT_CONFIG.priceTier };
  }
}

// ---------------------------------------------------------------------------
// Synthetic Weapon Inventory Builder
// ---------------------------------------------------------------------------

/**
 * Builds a synthetic WeaponInventory + Weapon shape from a WeaponRecord.
 * Looks up the full weapon data from the cached full weapons list.
 * Used for sparring partners and what-if weapon swaps.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSyntheticWeaponInventory(record: WeaponRecord, fullWeapons: any[]) {
  // Find the full weapon record with all fields (baseDamage, cooldown, bonuses)
  const fullWeapon = fullWeapons.find(w => w.id === record.id);
  const weapon = fullWeapon || {
    id: record.id,
    name: record.name,
    weaponType: record.weaponType,
    baseDamage: 10,
    cooldown: 3,
    cost: record.cost,
    handsRequired: record.handsRequired,
    damageType: record.weaponType === 'melee' ? 'melee' : record.weaponType === 'shield' ? 'melee' : record.weaponType,
    loadoutType: 'any',
    specialProperty: null,
    description: null,
    rangeBand: record.rangeBand ?? 'short',
    combatPowerBonus: 0, targetingSystemsBonus: 0, criticalSystemsBonus: 0,
    penetrationBonus: 0, weaponControlBonus: 0, attackSpeedBonus: 0,
    armorPlatingBonus: 0, shieldCapacityBonus: 0, evasionThrustersBonus: 0,
    damageDampenersBonus: 0, counterProtocolsBonus: 0, hullIntegrityBonus: 0,
    servoMotorsBonus: 0, gyroStabilizersBonus: 0, hydraulicSystemsBonus: 0,
    powerCoreBonus: 0, combatAlgorithmsBonus: 0, threatAnalysisBonus: 0,
    adaptiveAIBonus: 0, logicCoresBonus: 0, syncProtocolsBonus: 0,
    supportSystemsBonus: 0, formationTacticsBonus: 0, createdAt: new Date(),
  };

  return {
    id: nextSyntheticId(),
    weaponId: record.id,
    userId: -1,
    customName: null,
    purchasedAt: new Date(),
    weapon,
  };
}

// ---------------------------------------------------------------------------
// buildSparringPartner
// ---------------------------------------------------------------------------

/**
 * Constructs a virtual RobotWithWeapons from a sparring partner config.
 * All 23 attributes set to the tier's attributeLevel. Weapons auto-selected
 * via selectWeapon/selectShield. Synthetic negative IDs assigned.
 */
export async function buildSparringPartner(
  config: SparringPartnerConfig,
  allWeapons: WeaponRecord[],
): Promise<RobotWithWeapons> {
  const tierConfig = getBotTierConfig(config.botTier);
  const attrLevel = tierConfig.attributeLevel;
  const attrDecimal = new Prisma.Decimal(attrLevel);

  // Load full weapon data for building inventory objects
  const fullWeapons = await loadFullWeapons();

  // Auto-select main weapon
  const mainWeaponRecord = selectWeapon(allWeapons, {
    loadoutType: config.loadoutType,
    rangeBand: config.rangeBand,
    priceTier: tierConfig.priceTier,
  });

  // Auto-select offhand (shield for weapon_shield, second weapon for dual_wield)
  let offhandWeaponRecord: WeaponRecord | null = null;
  if (config.loadoutType === 'weapon_shield') {
    offhandWeaponRecord = selectShield(allWeapons, tierConfig.priceTier);
  } else if (config.loadoutType === 'dual_wield') {
    offhandWeaponRecord = selectWeapon(allWeapons, {
      loadoutType: config.loadoutType,
      rangeBand: config.rangeBand,
      priceTier: tierConfig.priceTier,
    });
  }

  const robotId = nextSyntheticId();

  // Build the weapon inventory shapes expected by RobotWithWeapons
  const mainWeapon = buildSyntheticWeaponInventory(mainWeaponRecord, fullWeapons);

  const offhandWeapon = offhandWeaponRecord
    ? buildSyntheticWeaponInventory(offhandWeaponRecord, fullWeapons)
    : null;

  // Build attribute object
  const attributes: Record<string, Prisma.Decimal> = {};
  for (const attr of ROBOT_ATTRIBUTES) {
    attributes[attr] = attrDecimal;
  }

  // Construct the virtual robot
  const robot: RobotWithWeapons = {
    id: robotId,
    userId: -1,
    name: config.botTier,
    frameId: 1,
    paintJob: null,

    // 23 attributes
    ...attributes,

    // Combat state — will be recalculated below
    currentHP: 0,
    maxHP: 0,
    currentShield: 0,
    maxShield: 0,
    damageTaken: 0,

    // Performance tracking (zeroed — sparring partners have no history)
    elo: 1200,
    totalBattles: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    damageDealtLifetime: 0,
    damageTakenLifetime: 0,
    kills: 0,

    // League & fame
    currentLeague: 'bronze',
    leagueId: 'bronze_1',
    leaguePoints: 0,
    cyclesInCurrentLeague: 0,
    fame: 0,
    titles: null,

    // Tag team stats
    totalTagTeamBattles: 0,
    totalTagTeamWins: 0,
    totalTagTeamLosses: 0,
    totalTagTeamDraws: 0,
    timesTaggedIn: 0,
    timesTaggedOut: 0,

    // KotH stats
    kothWins: 0,
    kothMatches: 0,
    kothTotalZoneScore: 0,
    kothTotalZoneTime: 0,
    kothKills: 0,
    kothBestPlacement: null,
    kothCurrentWinStreak: 0,
    kothBestWinStreak: 0,

    // Economic state
    repairCost: 0,
    battleReadiness: 100,
    totalRepairsPaid: 0,

    // Player configuration
    yieldThreshold: config.yieldThreshold,
    loadoutType: config.loadoutType,
    stance: config.stance,

    // Equipment IDs
    mainWeaponId: mainWeapon.id,
    offhandWeaponId: offhandWeapon?.id ?? null,

    // Appearance
    imageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),

    // Weapon relations
    mainWeapon,
    offhandWeapon: offhandWeapon,
  } as unknown as RobotWithWeapons;

  // Calculate maxHP/maxShield and set current to max (full health)
  robot.maxHP = calculateMaxHP(robot);
  robot.maxShield = calculateMaxShield(robot);
  robot.currentHP = robot.maxHP;
  robot.currentShield = robot.maxShield;

  return robot;
}


// ---------------------------------------------------------------------------
// buildOwnedRobot
// ---------------------------------------------------------------------------

/**
 * Loads an owned robot from the DB, verifies ownership, deep-clones it,
 * sets full HP/shield, and applies optional what-if overrides.
 *
 * @throws AppError 403 if robot is not owned by the user
 * @throws AppError 400 if robot has no weapon and no weapon override
 */
export async function buildOwnedRobot(
  userId: number,
  robotId: number,
  overrides?: WhatIfOverrides,
): Promise<RobotWithWeapons> {
  // Verify ownership (logs auth failures to securityMonitor)
  await verifyRobotOwnership(prisma, robotId, userId);

  // Load robot with weapon includes
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  if (!robot) {
    throw new AppError('NOT_FOUND', 'Robot not found', 404);
  }

  // Deep-clone to avoid mutating the original DB data
  // Use JSON round-trip instead of structuredClone because Prisma Decimal
  // objects are class instances that structuredClone cannot handle.
  // After cloning, Decimals become strings — convert attributes back to numbers.
  const cloned = JSON.parse(JSON.stringify(robot)) as RobotWithWeapons;

  // Convert all Decimal-serialized attributes back to proper Prisma.Decimal
  // so calculateMaxHP/calculateMaxShield and the combat simulator work correctly
  for (const attr of ROBOT_ATTRIBUTES) {
    const val = (cloned as unknown as Record<string, unknown>)[attr];
    if (val !== undefined) {
      (cloned as unknown as Record<string, unknown>)[attr] = new Prisma.Decimal(Number(val));
    }
  }
  // Also fix elo which is a Decimal
  if (cloned.elo !== undefined) {
    (cloned as unknown as Record<string, unknown>).elo = Number(cloned.elo);
  }
  // Fix weapon bonus fields that became strings after JSON round-trip
  const bonusFields = ROBOT_ATTRIBUTES.map(a => `${a}Bonus`);
  if (cloned.mainWeapon?.weapon) {
    for (const field of bonusFields) {
      const val = (cloned.mainWeapon.weapon as Record<string, unknown>)[field];
      if (val !== undefined && val !== null) {
        (cloned.mainWeapon.weapon as Record<string, unknown>)[field] = Number(val);
      }
    }
    // Also fix baseDamage and cooldown
    (cloned.mainWeapon.weapon as Record<string, unknown>).baseDamage = Number(cloned.mainWeapon.weapon.baseDamage);
    (cloned.mainWeapon.weapon as Record<string, unknown>).cooldown = Number(cloned.mainWeapon.weapon.cooldown);
    (cloned.mainWeapon.weapon as Record<string, unknown>).cost = Number(cloned.mainWeapon.weapon.cost);
  }
  if (cloned.offhandWeapon?.weapon) {
    for (const field of bonusFields) {
      const val = (cloned.offhandWeapon.weapon as Record<string, unknown>)[field];
      if (val !== undefined && val !== null) {
        (cloned.offhandWeapon.weapon as Record<string, unknown>)[field] = Number(val);
      }
    }
    (cloned.offhandWeapon.weapon as Record<string, unknown>).baseDamage = Number(cloned.offhandWeapon.weapon.baseDamage);
    (cloned.offhandWeapon.weapon as Record<string, unknown>).cooldown = Number(cloned.offhandWeapon.weapon.cooldown);
    (cloned.offhandWeapon.weapon as Record<string, unknown>).cost = Number(cloned.offhandWeapon.weapon.cost);
  }

  // Apply what-if weapon overrides (swap weapons from catalog)
  if (overrides?.mainWeaponId) {
    const weapon = await prisma.weapon.findUnique({ where: { id: overrides.mainWeaponId } });
    if (!weapon) {
      throw new AppError('VALIDATION_ERROR', `Weapon ${overrides.mainWeaponId} not found`, 400);
    }
    cloned.mainWeapon = {
      id: -1,
      weaponId: weapon.id,
      userId,
      customName: null,
      purchasedAt: new Date(),
      weapon,
    } as RobotWithWeapons['mainWeapon'];
    cloned.mainWeaponId = -1;
  }

  if (overrides?.offhandWeaponId) {
    const weapon = await prisma.weapon.findUnique({ where: { id: overrides.offhandWeaponId } });
    if (!weapon) {
      throw new AppError('VALIDATION_ERROR', `Weapon ${overrides.offhandWeaponId} not found`, 400);
    }
    cloned.offhandWeapon = {
      id: -2,
      weaponId: weapon.id,
      userId,
      customName: null,
      purchasedAt: new Date(),
      weapon,
    } as RobotWithWeapons['offhandWeapon'];
    cloned.offhandWeaponId = -2;
  }

  // Validate robot has a main weapon (either existing or overridden)
  if (!cloned.mainWeapon && !overrides?.mainWeaponId) {
    throw new AppError('VALIDATION_ERROR', 'Robot requires a main weapon to participate', 400);
  }

  // Apply what-if attribute overrides
  if (overrides?.attributes) {
    for (const [attr, value] of Object.entries(overrides.attributes)) {
      if (ROBOT_ATTRIBUTES.includes(attr as typeof ROBOT_ATTRIBUTES[number]) && value !== undefined) {
        (cloned as unknown as Record<string, unknown>)[attr] = new Prisma.Decimal(value);
      }
    }
  }

  // Apply loadout/stance/yield overrides
  if (overrides?.loadoutType) {
    cloned.loadoutType = overrides.loadoutType;
  }
  if (overrides?.stance) {
    cloned.stance = overrides.stance;
  }
  if (overrides?.yieldThreshold !== undefined) {
    cloned.yieldThreshold = overrides.yieldThreshold;
  }

  // Only recalculate maxHP/maxShield if attributes or weapons were changed.
  // Otherwise use the stored DB values — same as real battle orchestrators.
  const hasAttributeOverrides = overrides?.attributes && Object.keys(overrides.attributes).length > 0;
  const hasWeaponOverrides = overrides?.mainWeaponId || overrides?.offhandWeaponId;
  if (hasAttributeOverrides || hasWeaponOverrides) {
    cloned.maxHP = calculateMaxHP(cloned);
    cloned.maxShield = calculateMaxShield(cloned);
  } else {
    // Use stored DB values (already numbers after JSON round-trip)
    cloned.maxHP = Number(robot.maxHP);
    cloned.maxShield = Number(robot.maxShield);
  }

  // Set full HP/shield (practice battles always start fully repaired)
  cloned.currentHP = cloned.maxHP;
  cloned.currentShield = cloned.maxShield;

  return cloned;
}

// ---------------------------------------------------------------------------
// buildRobotFromSlot (internal helper)
// ---------------------------------------------------------------------------

async function buildRobotFromSlot(
  userId: number,
  slot: BattleSlot,
  allWeapons: WeaponRecord[],
): Promise<RobotWithWeapons> {
  if (slot.type === 'owned') {
    return buildOwnedRobot(userId, slot.robotId, slot.overrides);
  }
  return buildSparringPartner(slot.config, allWeapons);
}

// ---------------------------------------------------------------------------
// executePracticeBattle
// ---------------------------------------------------------------------------

/**
 * Executes a single practice battle. Builds two RobotWithWeapons from the
 * request, calls simulateBattle, generates narrative, increments metrics.
 * Zero database writes.
 */
export async function executePracticeBattle(
  userId: number,
  request: PracticeBattleRequest,
): Promise<PracticeBattleResult> {
  // Load weapon catalog for sparring partner auto-selection
  const allWeapons = await loadWeaponCatalog();

  // Build both robots
  const robot1 = await buildRobotFromSlot(userId, request.robot1, allWeapons);
  const robot2 = await buildRobotFromSlot(userId, request.robot2, allWeapons);

  // Run the combat engine (same as league 1v1, allowDraws: true)
  const combatResult = simulateBattle(robot1, robot2);

  // Generate narrative via the existing pipeline
  const battleLog = CombatMessageGenerator.convertSimulatorEvents(combatResult.events, {
    robot1Name: robot1.name,
    robot2Name: robot2.name,
    robot1Stance: robot1.stance || 'balanced',
    robot2Stance: robot2.stance || 'balanced',
    robot1MaxHP: Number(robot1.maxHP),
    robot2MaxHP: Number(robot2.maxHP),
    robot1ELO: Number(robot1.elo),
    robot2ELO: Number(robot2.elo),
    leagueType: 'practice',
  });

  // Track metrics
  practiceArenaMetrics.recordBattle(userId);

  return {
    combatResult,
    battleLog,
    robot1Info: { name: robot1.name, maxHP: Number(robot1.maxHP), maxShield: Number(robot1.maxShield) },
    robot2Info: { name: robot2.name, maxHP: Number(robot2.maxHP), maxShield: Number(robot2.maxShield) },
  };
}

// ---------------------------------------------------------------------------
// executePracticeBatch
// ---------------------------------------------------------------------------

/**
 * Runs count battles (2-10) sequentially with the same configuration.
 * Re-clones robot data each iteration. Returns all individual results
 * plus aggregate stats.
 */
export async function executePracticeBatch(
  userId: number,
  request: PracticeBattleRequest,
  count: number,
): Promise<PracticeBatchResult> {
  const results: PracticeBattleResult[] = [];

  // Load weapon catalog once for all iterations
  const allWeapons = await loadWeaponCatalog();

  for (let i = 0; i < count; i++) {
    // Re-build robots each iteration (fresh clone, fresh random seed)
    const robot1 = await buildRobotFromSlot(userId, request.robot1, allWeapons);
    const robot2 = await buildRobotFromSlot(userId, request.robot2, allWeapons);

    const combatResult = simulateBattle(robot1, robot2);

    const battleLog = CombatMessageGenerator.convertSimulatorEvents(combatResult.events, {
      robot1Name: robot1.name,
      robot2Name: robot2.name,
      robot1Stance: robot1.stance || 'balanced',
      robot2Stance: robot2.stance || 'balanced',
      robot1MaxHP: Number(robot1.maxHP),
      robot2MaxHP: Number(robot2.maxHP),
      robot1ELO: Number(robot1.elo),
      robot2ELO: Number(robot2.elo),
      leagueType: 'practice',
    });

    practiceArenaMetrics.recordBattle(userId);

    results.push({
      combatResult,
      battleLog,
      robot1Info: { name: robot1.name, maxHP: Number(robot1.maxHP), maxShield: Number(robot1.maxShield) },
      robot2Info: { name: robot2.name, maxHP: Number(robot2.maxHP), maxShield: Number(robot2.maxShield) },
    });
  }

  // Compute aggregate stats
  let robot1Wins = 0;
  let robot2Wins = 0;
  let draws = 0;
  let totalDuration = 0;
  let totalRobot1Damage = 0;
  let totalRobot2Damage = 0;

  for (const r of results) {
    const cr = r.combatResult;
    if (cr.isDraw) {
      draws++;
    } else if (cr.robot1FinalHP > r.combatResult.robot2FinalHP) {
      robot1Wins++;
    } else {
      robot2Wins++;
    }
    totalDuration += cr.durationSeconds;
    totalRobot1Damage += cr.robot1DamageDealt;
    totalRobot2Damage += cr.robot2DamageDealt;
  }

  return {
    results,
    aggregate: {
      totalBattles: count,
      robot1Wins,
      robot2Wins,
      draws,
      avgDurationSeconds: count > 0 ? totalDuration / count : 0,
      avgRobot1DamageDealt: count > 0 ? totalRobot1Damage / count : 0,
      avgRobot2DamageDealt: count > 0 ? totalRobot2Damage / count : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Weapon Catalog Loader
// ---------------------------------------------------------------------------

/**
 * Loads all weapons from the DB for selectWeapon/selectShield (minimal fields)
 * and as a full record map for building weapon inventory objects.
 */
async function loadWeaponCatalog(): Promise<WeaponRecord[]> {
  const weapons = await prisma.weapon.findMany({
    select: {
      id: true,
      name: true,
      cost: true,
      handsRequired: true,
      weaponType: true,
      rangeBand: true,
    },
  });
  return weapons;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _fullWeaponCache: any[] | null = null;

/**
 * Loads full weapon records (all fields) for building weapon inventory objects.
 * Cached after first load.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadFullWeapons(): Promise<any[]> {
  if (_fullWeaponCache) return _fullWeaponCache;
  _fullWeaponCache = await prisma.weapon.findMany();
  return _fullWeaponCache;
}
