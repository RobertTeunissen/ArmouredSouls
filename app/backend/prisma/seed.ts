import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { generateStableName } from '../src/utils/stableNameGenerator';
import { LOADOUT_TITLES, WEAPON_CODENAMES } from '../src/utils/tierConfig';

// Load environment variables
dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

const ROBOT_CREATION_COST = 500000;

// ===== ENVIRONMENT DETECTION =====
type SeedMode = 'development' | 'acceptance' | 'production';

export function getSeedMode(): SeedMode {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') return 'production';
  if (nodeEnv === 'acceptance') return 'acceptance';
  return 'development';
}

// Default robot attributes (all set to 1.00)
const DEFAULT_ROBOT_ATTRIBUTES = {
  combatPower: 1.0,
  targetingSystems: 1.0,
  criticalSystems: 1.0,
  penetration: 1.0,
  weaponControl: 1.0,
  attackSpeed: 1.0,
  armorPlating: 1.0,
  shieldCapacity: 1.0,
  evasionThrusters: 1.0,
  damageDampeners: 1.0,
  counterProtocols: 1.0,
  hullIntegrity: 1.0,
  servoMotors: 1.0,
  gyroStabilizers: 1.0,
  hydraulicSystems: 1.0,
  powerCore: 1.0,
  combatAlgorithms: 1.0,
  threatAnalysis: 1.0,
  adaptiveAI: 1.0,
  logicCores: 1.0,
  syncProtocols: 1.0,
  supportSystems: 1.0,
  formationTactics: 1.0,
};

// ===== WEAPON DEFINITIONS =====
// All weapon data defined as a constant array for idempotent upsert-by-name
export const WEAPON_DEFINITIONS = [
  {
    name: 'Practice Sword',
    weaponType: 'melee',
    baseDamage: 6,
    cooldown: 3,
    cost: 50000,
    handsRequired: 'one',
    damageType: 'melee',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Basic training weapon establishing baseline cost',
    rangeBand: 'melee',
  },
  {
    name: 'Practice Blaster',
    weaponType: 'ballistic',
    baseDamage: 6,
    cooldown: 3,
    cost: 50000,
    handsRequired: 'one',
    damageType: 'ballistic',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Basic training sidearm establishing short-range baseline',
    rangeBand: 'short',
  },
  {
    name: 'Training Rifle',
    weaponType: 'ballistic',
    baseDamage: 6,
    cooldown: 3,
    cost: 50000,
    handsRequired: 'two',
    damageType: 'ballistic',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Standard-issue drill rifle establishing mid-range baseline',
    rangeBand: 'mid',
  },
  {
    name: 'Training Beam',
    weaponType: 'energy',
    baseDamage: 6,
    cooldown: 3,
    cost: 50000,
    handsRequired: 'two',
    damageType: 'energy',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Basic long-range energy trainer establishing long-range baseline',
    rangeBand: 'long',
  },
  {
    name: 'Machine Pistol',
    weaponType: 'ballistic',
    baseDamage: 5,
    cooldown: 2,
    cost: 94000,
    handsRequired: 'one',
    damageType: 'ballistic',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Rapid-fire sidearm with quick attacks',
    rangeBand: 'short',
    attackSpeedBonus: 3,
    weaponControlBonus: 2,
  },
  {
    name: 'Laser Pistol',
    weaponType: 'energy',
    baseDamage: 6,
    cooldown: 3,
    cost: 57000,
    handsRequired: 'one',
    damageType: 'energy',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Precise energy sidearm with good accuracy',
    rangeBand: 'short',
    targetingSystemsBonus: 3,
    combatPowerBonus: 2,
  },
  {
    name: 'Combat Knife',
    weaponType: 'melee',
    baseDamage: 5,
    cooldown: 2,
    cost: 93000,
    handsRequired: 'one',
    damageType: 'melee',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Fast melee weapon for close combat',
    rangeBand: 'melee',
    attackSpeedBonus: 3,
    gyroStabilizersBonus: 1,
  },
  {
    name: 'Light Shield',
    weaponType: 'shield',
    baseDamage: 0,
    cooldown: 0,
    cost: 51000,
    handsRequired: 'shield',
    damageType: 'none',
    loadoutType: 'weapon_shield',
    specialProperty: null,
    description: 'Basic defensive shield for protection',
    rangeBand: 'melee',
    armorPlatingBonus: 3,
    shieldCapacityBonus: 2,
  },
  {
    name: 'Combat Shield',
    weaponType: 'shield',
    baseDamage: 0,
    cooldown: 0,
    cost: 78000,
    handsRequired: 'shield',
    damageType: 'none',
    loadoutType: 'weapon_shield',
    specialProperty: null,
    description: 'Heavy-duty shield with counter capabilities',
    rangeBand: 'melee',
    armorPlatingBonus: 6,
    counterProtocolsBonus: 3,
    evasionThrustersBonus: -2,
    shieldCapacityBonus: 5,
  },
  {
    name: 'Reactive Shield',
    weaponType: 'shield',
    baseDamage: 0,
    cooldown: 0,
    cost: 92000,
    handsRequired: 'shield',
    damageType: 'none',
    loadoutType: 'weapon_shield',
    specialProperty: null,
    description: 'Advanced shield with energy-reactive plating',
    rangeBand: 'melee',
    shieldCapacityBonus: 7,
    counterProtocolsBonus: 6,
    powerCoreBonus: 4,
    servoMotorsBonus: -2,
  },
  {
    name: 'Machine Gun',
    weaponType: 'ballistic',
    baseDamage: 5,
    cooldown: 2,
    cost: 107000,
    handsRequired: 'one',
    damageType: 'ballistic',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Sustained fire support weapon',
    rangeBand: 'short',
    combatPowerBonus: 3,
    attackSpeedBonus: 5,
    weaponControlBonus: 2,
  },
  {
    name: 'Burst Rifle',
    weaponType: 'ballistic',
    baseDamage: 8,
    cooldown: 3,
    cost: 117000,
    handsRequired: 'one',
    damageType: 'ballistic',
    loadoutType: 'single',
    specialProperty: null,
    description: '3-round burst fire weapon with controlled recoil',
    rangeBand: 'short',
    attackSpeedBonus: 4,
    targetingSystemsBonus: 3,
    criticalSystemsBonus: 3,
  },
  {
    name: 'Assault Rifle',
    weaponType: 'ballistic',
    baseDamage: 14,
    cooldown: 3,
    cost: 293000,
    handsRequired: 'one',
    damageType: 'ballistic',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Elite military-grade firearm with enhanced targeting',
    rangeBand: 'short',
    combatPowerBonus: 6,
    targetingSystemsBonus: 5,
    weaponControlBonus: 4,
    attackSpeedBonus: 3,
  },
  {
    name: 'Energy Blade',
    weaponType: 'melee',
    baseDamage: 10,
    cooldown: 3,
    cost: 175000,
    handsRequired: 'one',
    damageType: 'melee',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Energy-infused blade for swift strikes',
    rangeBand: 'melee',
    attackSpeedBonus: 5,
    hydraulicSystemsBonus: 4,
    weaponControlBonus: 3,
  },
  {
    name: 'Laser Rifle',
    weaponType: 'energy',
    baseDamage: 9,
    cooldown: 3,
    cost: 243000,
    handsRequired: 'two',
    damageType: 'energy',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Heavy precision energy rifle reconfigured for two-handed operation',
    rangeBand: 'short',
    targetingSystemsBonus: 5,
    weaponControlBonus: 4,
    attackSpeedBonus: 3,
    combatPowerBonus: 2,
  },
  {
    name: 'Plasma Blade',
    weaponType: 'melee',
    baseDamage: 11,
    cooldown: 3,
    cost: 202000,
    handsRequired: 'one',
    damageType: 'melee',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Energy-enhanced melee blade with rapid strikes',
    rangeBand: 'melee',
    hydraulicSystemsBonus: 5,
    attackSpeedBonus: 4,
    criticalSystemsBonus: 3,
    gyroStabilizersBonus: 2,
  },
  {
    name: 'Plasma Rifle',
    weaponType: 'energy',
    baseDamage: 13,
    cooldown: 3,
    cost: 258000,
    handsRequired: 'one',
    damageType: 'energy',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Advanced energy weapon with high damage output',
    rangeBand: 'short',
    combatPowerBonus: 6,
    targetingSystemsBonus: 4,
    weaponControlBonus: 3,
    powerCoreBonus: -2,
  },
  {
    name: 'Power Sword',
    weaponType: 'melee',
    baseDamage: 15,
    cooldown: 3,
    cost: 325000,
    handsRequired: 'one',
    damageType: 'melee',
    loadoutType: 'single',
    specialProperty: null,
    description: 'High-tech melee weapon with superior handling',
    rangeBand: 'melee',
    hydraulicSystemsBonus: 7,
    counterProtocolsBonus: 5,
    gyroStabilizersBonus: 4,
    combatPowerBonus: 3,
  },
  {
    name: 'Shotgun',
    weaponType: 'ballistic',
    baseDamage: 14,
    cooldown: 4,
    cost: 283000,
    handsRequired: 'two',
    damageType: 'ballistic',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Close-range devastation with wide spread',
    rangeBand: 'mid',
    combatPowerBonus: 4,
    criticalSystemsBonus: 3,
    targetingSystemsBonus: -2,
  },
  {
    name: 'Grenade Launcher',
    weaponType: 'ballistic',
    baseDamage: 16,
    cooldown: 5,
    cost: 293000,
    handsRequired: 'two',
    damageType: 'ballistic',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Explosive area damage with arc trajectory',
    rangeBand: 'mid',
    combatPowerBonus: 6,
    penetrationBonus: 5,
    criticalSystemsBonus: 4,
    targetingSystemsBonus: -3,
  },
  {
    name: 'Sniper Rifle',
    weaponType: 'ballistic',
    baseDamage: 22,
    cooldown: 6,
    cost: 387000,
    handsRequired: 'two',
    damageType: 'ballistic',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Long-range precision weapon with high damage',
    rangeBand: 'long',
    targetingSystemsBonus: 8,
    penetrationBonus: 6,
    criticalSystemsBonus: 5,
    attackSpeedBonus: -3,
  },
  {
    name: 'Battle Axe',
    weaponType: 'melee',
    baseDamage: 17,
    cooldown: 4,
    cost: 402000,
    handsRequired: 'two',
    damageType: 'melee',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Brutal melee weapon with devastating power',
    rangeBand: 'melee',
    hydraulicSystemsBonus: 6,
    combatPowerBonus: 4,
    criticalSystemsBonus: 3,
    servoMotorsBonus: -2,
  },
  {
    name: 'Plasma Cannon',
    weaponType: 'energy',
    baseDamage: 20,
    cooldown: 5,
    cost: 408000,
    handsRequired: 'two',
    damageType: 'energy',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Heavy plasma weapon with devastating firepower',
    rangeBand: 'mid',
    combatPowerBonus: 7,
    criticalSystemsBonus: 6,
    penetrationBonus: 4,
    powerCoreBonus: -3,
  },
  {
    name: 'Heavy Hammer',
    weaponType: 'melee',
    baseDamage: 22,
    cooldown: 5,
    cost: 478000,
    handsRequired: 'two',
    damageType: 'melee',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Massive impact weapon for maximum damage',
    rangeBand: 'melee',
    hydraulicSystemsBonus: 8,
    combatPowerBonus: 7,
    criticalSystemsBonus: 4,
    servoMotorsBonus: -3,
  },
  {
    name: 'Railgun',
    weaponType: 'ballistic',
    baseDamage: 25,
    cooldown: 6,
    cost: 527000,
    handsRequired: 'two',
    damageType: 'ballistic',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Ultra-high velocity kinetic weapon with extreme penetration',
    rangeBand: 'long',
    penetrationBonus: 12,
    targetingSystemsBonus: 7,
    combatPowerBonus: 5,
    attackSpeedBonus: -4,
  },
  {
    name: 'Ion Beam',
    weaponType: 'energy',
    baseDamage: 18,
    cooldown: 4,
    cost: 544000,
    handsRequired: 'two',
    damageType: 'energy',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Focused energy beam with shield disruption',
    rangeBand: 'long',
    penetrationBonus: 10,
    combatPowerBonus: 8,
    attackSpeedBonus: 5,
    targetingSystemsBonus: 4,
  },
  {
    name: 'Vibro Mace',
    weaponType: 'melee',
    baseDamage: 18,
    cooldown: 3,
    cost: 425000,
    handsRequired: 'one',
    damageType: 'melee',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Vibration-enhanced mace that shatters armor plating on impact',
    rangeBand: 'melee',
    hydraulicSystemsBonus: 8,
    combatPowerBonus: 6,
    counterProtocolsBonus: 5,
    gyroStabilizersBonus: 4,
    attackSpeedBonus: 3,
  },
  {
    name: 'War Club',
    weaponType: 'melee',
    baseDamage: 6,
    cooldown: 3,
    cost: 84000,
    handsRequired: 'two',
    damageType: 'melee',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Crude but effective bludgeon for budget-conscious brawlers',
    rangeBand: 'melee',
    hydraulicSystemsBonus: 2,
    combatPowerBonus: 1,
  },
  {
    name: 'Shock Maul',
    weaponType: 'energy',
    baseDamage: 8,
    cooldown: 3,
    cost: 183000,
    handsRequired: 'two',
    damageType: 'energy',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Electrified maul that channels energy through hydraulic strikes',
    rangeBand: 'melee',
    hydraulicSystemsBonus: 4,
    combatPowerBonus: 3,
    powerCoreBonus: 2,
  },
  {
    name: 'Thermal Lance',
    weaponType: 'energy',
    baseDamage: 13,
    cooldown: 4,
    cost: 279000,
    handsRequired: 'two',
    damageType: 'energy',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Superheated polearm that melts through armor at close range',
    rangeBand: 'melee',
    hydraulicSystemsBonus: 5,
    combatPowerBonus: 4,
    criticalSystemsBonus: 4,
    powerCoreBonus: -2,
  },
  {
    name: 'Volt Sabre',
    weaponType: 'energy',
    baseDamage: 18,
    cooldown: 3,
    cost: 425000,
    handsRequired: 'one',
    damageType: 'energy',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Arc-charged blade pistol delivering devastating short-range energy bursts',
    rangeBand: 'short',
    combatPowerBonus: 8,
    targetingSystemsBonus: 6,
    weaponControlBonus: 5,
    attackSpeedBonus: 4,
    powerCoreBonus: -3,
  },
  {
    name: 'Scatter Cannon',
    weaponType: 'ballistic',
    baseDamage: 6,
    cooldown: 3,
    cost: 84000,
    handsRequired: 'two',
    damageType: 'ballistic',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Wide-bore scatter weapon effective at close quarters',
    rangeBand: 'short',
    combatPowerBonus: 2,
    weaponControlBonus: 1,
  },
  {
    name: 'Pulse Accelerator',
    weaponType: 'energy',
    baseDamage: 13,
    cooldown: 4,
    cost: 273000,
    handsRequired: 'two',
    damageType: 'energy',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Charged-particle accelerator delivering focused energy pulses at short range',
    rangeBand: 'short',
    combatPowerBonus: 5,
    targetingSystemsBonus: 4,
    weaponControlBonus: 3,
    attackSpeedBonus: -2,
  },
  {
    name: 'Arc Projector',
    weaponType: 'energy',
    baseDamage: 18,
    cooldown: 4,
    cost: 488000,
    handsRequired: 'two',
    damageType: 'energy',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Devastating arc-lightning projector that chains energy across short distances',
    rangeBand: 'short',
    combatPowerBonus: 7,
    targetingSystemsBonus: 6,
    criticalSystemsBonus: 5,
    penetrationBonus: 4,
    attackSpeedBonus: -3,
  },
  {
    name: 'Bolt Carbine',
    weaponType: 'ballistic',
    baseDamage: 5,
    cooldown: 2,
    cost: 93000,
    handsRequired: 'one',
    damageType: 'ballistic',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Compact carbine optimized for mid-range engagements',
    rangeBand: 'mid',
    targetingSystemsBonus: 3,
    weaponControlBonus: 1,
  },
  {
    name: 'Flux Repeater',
    weaponType: 'energy',
    baseDamage: 9,
    cooldown: 3,
    cost: 147000,
    handsRequired: 'one',
    damageType: 'energy',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Rapid-cycling energy repeater with excellent mid-range accuracy',
    rangeBand: 'mid',
    targetingSystemsBonus: 5,
    combatPowerBonus: 3,
    weaponControlBonus: 3,
  },
  {
    name: 'Disruptor Cannon',
    weaponType: 'energy',
    baseDamage: 14,
    cooldown: 3,
    cost: 293000,
    handsRequired: 'one',
    damageType: 'energy',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Heavy energy disruptor that destabilizes enemy systems at mid-range',
    rangeBand: 'mid',
    combatPowerBonus: 6,
    targetingSystemsBonus: 5,
    weaponControlBonus: 4,
    penetrationBonus: 3,
  },
  {
    name: 'Nova Caster',
    weaponType: 'energy',
    baseDamage: 18,
    cooldown: 3,
    cost: 425000,
    handsRequired: 'one',
    damageType: 'energy',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Miniaturized nova reactor unleashing devastating mid-range energy blasts',
    rangeBand: 'mid',
    combatPowerBonus: 8,
    targetingSystemsBonus: 6,
    penetrationBonus: 5,
    weaponControlBonus: 4,
    powerCoreBonus: -3,
  },
  {
    name: 'Mortar System',
    weaponType: 'ballistic',
    baseDamage: 10,
    cooldown: 4,
    cost: 163000,
    handsRequired: 'two',
    damageType: 'ballistic',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Indirect-fire ballistic system for area suppression at mid-range',
    rangeBand: 'mid',
    combatPowerBonus: 4,
    penetrationBonus: 3,
    targetingSystemsBonus: -2,
  },
  {
    name: 'Beam Pistol',
    weaponType: 'energy',
    baseDamage: 5,
    cooldown: 2,
    cost: 93000,
    handsRequired: 'one',
    damageType: 'energy',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Compact long-range energy sidearm with focused beam optics',
    rangeBand: 'long',
    targetingSystemsBonus: 3,
    penetrationBonus: 1,
  },
  {
    name: 'Photon Marksman',
    weaponType: 'energy',
    baseDamage: 9,
    cooldown: 3,
    cost: 147000,
    handsRequired: 'one',
    damageType: 'energy',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Precision photon emitter for accurate long-range fire from a one-handed platform',
    rangeBand: 'long',
    targetingSystemsBonus: 5,
    penetrationBonus: 3,
    combatPowerBonus: 3,
  },
  {
    name: 'Gauss Pistol',
    weaponType: 'ballistic',
    baseDamage: 14,
    cooldown: 3,
    cost: 291000,
    handsRequired: 'one',
    damageType: 'ballistic',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Magnetically accelerated sidearm delivering extreme long-range kinetic rounds',
    rangeBand: 'long',
    targetingSystemsBonus: 6,
    penetrationBonus: 5,
    combatPowerBonus: 4,
    attackSpeedBonus: -2,
  },
  {
    name: 'Particle Lance',
    weaponType: 'energy',
    baseDamage: 18,
    cooldown: 3,
    cost: 425000,
    handsRequired: 'one',
    damageType: 'energy',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Focused particle beam weapon capable of precision strikes at extreme range',
    rangeBand: 'long',
    targetingSystemsBonus: 8,
    penetrationBonus: 6,
    combatPowerBonus: 5,
    criticalSystemsBonus: 4,
    attackSpeedBonus: -3,
  },
  {
    name: 'Siege Cannon',
    weaponType: 'ballistic',
    baseDamage: 10,
    cooldown: 4,
    cost: 163000,
    handsRequired: 'two',
    damageType: 'ballistic',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Heavy long-range bombardment cannon for sustained siege operations',
    rangeBand: 'long',
    targetingSystemsBonus: 4,
    penetrationBonus: 3,
    combatPowerBonus: -2,
  },
  {
    name: 'Barrier Shield',
    weaponType: 'shield',
    baseDamage: 0,
    cooldown: 0,
    cost: 111000,
    handsRequired: 'shield',
    damageType: 'none',
    loadoutType: 'weapon_shield',
    specialProperty: null,
    description: 'Reinforced energy barrier providing solid mid-tier protection',
    rangeBand: 'melee',
    armorPlatingBonus: 8,
    shieldCapacityBonus: 7,
    counterProtocolsBonus: 5,
    evasionThrustersBonus: -3,
  },
  {
    name: 'Fortress Shield',
    weaponType: 'shield',
    baseDamage: 0,
    cooldown: 0,
    cost: 291000,
    handsRequired: 'shield',
    damageType: 'none',
    loadoutType: 'weapon_shield',
    specialProperty: null,
    description: 'Heavy fortress-class shield with layered defensive systems',
    rangeBand: 'melee',
    armorPlatingBonus: 15,
    shieldCapacityBonus: 14,
    counterProtocolsBonus: 10,
    evasionThrustersBonus: -4,
    servoMotorsBonus: -3,
  },
  {
    name: 'Aegis Bulwark',
    weaponType: 'shield',
    baseDamage: 0,
    cooldown: 0,
    cost: 409000,
    handsRequired: 'shield',
    damageType: 'none',
    loadoutType: 'weapon_shield',
    specialProperty: null,
    description: 'Ultimate defensive platform with multi-layered reactive shielding',
    rangeBand: 'melee',
    armorPlatingBonus: 15,
    shieldCapacityBonus: 15,
    counterProtocolsBonus: 14,
    powerCoreBonus: 11,
    evasionThrustersBonus: -5,
    servoMotorsBonus: -4,
  },
] as const;

// ===== IDEMPOTENT HELPERS =====

/**
 * Upsert a weapon by name. Since Weapon.name is not a unique constraint in the schema,
 * we use findFirst + create/update pattern.
 */
export async function upsertWeapon(data: Record<string, unknown>) {
  const existing = await prisma.weapon.findFirst({ where: { name: data.name as string } });
  if (existing) {
    return prisma.weapon.update({ where: { id: existing.id }, data });
  }
  return prisma.weapon.create({ data: data as any });
}

/**
 * Upsert a user by username (unique constraint exists).
 * Note: stableName is only set on CREATE, not on UPDATE, to avoid unique constraint violations.
 */
export async function upsertUser(data: { username: string; passwordHash: string; role?: string; currency?: number; prestige?: number; hasCompletedOnboarding?: boolean; stableName?: string }) {
  const existing = await prisma.user.findUnique({ where: { username: data.username } });

  // If the user already exists, leave them untouched — don't reset their
  // currency, prestige, or any other state that has changed since the last seed.
  if (existing) {
    return existing;
  }

  return prisma.user.create({ data });
}

/**
 * Ensure a weapon inventory entry exists for a user+weapon combo.
 * Returns the existing or newly created entry.
 */
async function ensureWeaponInventory(userId: number, weaponId: number) {
  const existing = await prisma.weaponInventory.findFirst({
    where: { userId, weaponId },
  });
  if (existing) return existing;
  return prisma.weaponInventory.create({ data: { userId, weaponId } });
}

/**
 * Upsert a robot by userId+name (unique constraint exists).
 * Verifies weapon inventory FK references before creating to give clear errors.
 */
export async function upsertRobot(data: Record<string, unknown>) {
  const userId = data.userId as number;
  const name = data.name as string;
  const existing = await prisma.robot.findFirst({ where: { userId, name } });

  // If the robot already exists, leave it completely untouched.
  // The seed script should only create missing robots, never overwrite
  // state that the league cycle or players have changed since the last seed.
  if (existing) {
    return existing;
  }

  // Verify mainWeaponId exists before creating
  if (data.mainWeaponId) {
    const weaponInv = await prisma.weaponInventory.findUnique({ where: { id: data.mainWeaponId as number } });
    if (!weaponInv) {
      throw new Error(
        `Cannot create robot "${name}": mainWeaponId ${data.mainWeaponId} not found in weapon_inventory. ` +
        `Database may have stale data — try: npx prisma migrate reset`
      );
    }
  }

  return prisma.robot.create({ data: data as any });
}

// ===== SEED FUNCTIONS =====

/** Seeds weapons — required in ALL environments */
async function seedWeapons() {
  console.log('Creating weapons...');
  const weapons = [];
  for (const def of WEAPON_DEFINITIONS) {
    const weapon = await upsertWeapon({ ...def });
    weapons.push(weapon);
  }
  console.log(`✅ Upserted ${weapons.length} weapons (idempotent)`);
  return weapons;
}

/** Seeds cycle metadata — required in ALL environments */
async function seedCycleMetadata() {
  console.log('Initializing cycle metadata...');
  await prisma.cycleMetadata.upsert({
    where: { id: 1 },
    update: {}, // Preserve existing cycle count on reseed
    create: { id: 1, totalCycles: 0 },
  });
  const meta = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  console.log(`✅ Cycle metadata initialized (current cycle: ${meta?.totalCycles ?? 0})\n`);
}

/** Seeds the bye-robot user and robot — required in ALL environments */
async function seedByeRobot(practiceSword: { id: number }) {
  console.log('Creating Bye-Robot...');
  const byeUser = await upsertUser({
    username: 'bye_robot_user',
    passwordHash: await bcrypt.hash('testpass123', 10),
    currency: 0,
    prestige: 0,
  });

  const byeWeaponInv = await ensureWeaponInventory(byeUser.id, practiceSword.id);

  const byeRobot = await upsertRobot({
    userId: byeUser.id,
    name: 'Bye Robot',
    frameId: 1,
    ...DEFAULT_ROBOT_ATTRIBUTES,
    currentHP: 55,
    maxHP: 55,
    currentShield: 4,
    maxShield: 4,
    elo: 1000,
    currentLeague: 'bronze',
    leagueId: 'bronze_bye',
    leaguePoints: 0,
    loadoutType: 'single',
    mainWeaponId: byeWeaponInv.id,
    stance: 'balanced',
    battleReadiness: 100,
    yieldThreshold: 0,
  });

  console.log(`✅ Bye-Robot upserted (ELO: 1000, ID: ${byeRobot.id})`);
  return { byeUser, byeRobot };
}

/** Seeds admin account — acceptance & development only */
async function seedAdminAccount() {
  console.log('Creating admin account...');

  // Gather existing stable names to ensure uniqueness
  const existingStableNames = await prisma.user.findMany({
    where: { stableName: { not: null } },
    select: { stableName: true },
  });
  const existingNames = new Set<string>(
    existingStableNames.map((u) => u.stableName).filter((n): n is string => n !== null)
  );

  const stableName = generateStableName(existingNames);

  const adminUser = await upsertUser({
    username: 'admin',
    passwordHash: await bcrypt.hash('admin123', 10),
    role: 'admin',
    currency: 3000000,
    prestige: 0,
    hasCompletedOnboarding: true,
    stableName,
  });
  console.log(`✅ Admin user upserted (currency: ₡3,000,000, stableName: "${stableName}")`);

  return { adminUser };
}

/** Seeds 200 WimpBot test users — development & acceptance */
async function seedWimpBotUsers(weapons: { id: number; name: string }[]) {
  console.log('Creating 200 test users with WimpBot robots...');
  const testHashedPassword = await bcrypt.hash('testpass123', 10);

  const weaponGroups = [
    { weapon: weapons.find((w) => w.name === 'Practice Sword')!, loadoutType: 'single' as const },
    { weapon: weapons.find((w) => w.name === 'Practice Blaster')!, loadoutType: 'single' as const },
    { weapon: weapons.find((w) => w.name === 'Training Rifle')!, loadoutType: 'two_handed' as const },
    { weapon: weapons.find((w) => w.name === 'Training Beam')!, loadoutType: 'two_handed' as const },
  ];

  for (const group of weaponGroups) {
    if (!group.weapon) {
      throw new Error(`Weapon "${group.weapon}" not found in seeded weapons array`);
    }
  }

  // Pre-populate with existing stable names from database to avoid collisions
  const existingStableNames = await prisma.user.findMany({
    where: { stableName: { not: null } },
    select: { stableName: true },
  });
  const existingNames = new Set<string>(
    existingStableNames.map((u) => u.stableName).filter((n): n is string => n !== null)
  );

  // 200 robots → 2 league instances (max 100 per instance)
  // Each league gets 100 robots with 25 of each weapon type for variety
  const MAX_ROBOTS_PER_LEAGUE = 100;
  const TOTAL_ROBOTS = 200;
  const LEAGUES_COUNT = Math.ceil(TOTAL_ROBOTS / MAX_ROBOTS_PER_LEAGUE); // 2

  // Track per-weapon counters for naming (1-50 per weapon type)
  const weaponCounters = new Map<string, number>();
  for (const group of weaponGroups) {
    weaponCounters.set(group.weapon.name, 0);
  }

  let userIndex = 0;
  for (let leagueNum = 1; leagueNum <= LEAGUES_COUNT; leagueNum++) {
    // Distribute weapons evenly within each league using round-robin
    for (let robotInLeague = 0; robotInLeague < MAX_ROBOTS_PER_LEAGUE; robotInLeague++) {
      userIndex++;
      const username = `test_user_${String(userIndex).padStart(3, '0')}`;

      // Round-robin weapon assignment for variety within each league
      const weaponSlot = robotInLeague % weaponGroups.length;
      const { weapon, loadoutType } = weaponGroups[weaponSlot];

      // Increment weapon-specific counter for naming
      const weaponNum = weaponCounters.get(weapon.name)! + 1;
      weaponCounters.set(weapon.name, weaponNum);

      const loadoutTitle = LOADOUT_TITLES[loadoutType];
      const weaponCodename = WEAPON_CODENAMES[weapon.name];
      const robotName = `WimpBot ${loadoutTitle} ${weaponCodename} ${weaponNum}`;

      const stableName = generateStableName(existingNames);
      existingNames.add(stableName);

      const user = await upsertUser({
        username,
        passwordHash: testHashedPassword,
        currency: 100000,
        stableName,
      });

      const weaponInv = await ensureWeaponInventory(user.id, weapon.id);

      await upsertRobot({
        userId: user.id,
        name: robotName,
        frameId: 1,
        ...DEFAULT_ROBOT_ATTRIBUTES,
        currentHP: 55,
        maxHP: 55,
        currentShield: 4,
        maxShield: 4,
        elo: 1200,
        currentLeague: 'bronze',
        leagueId: `bronze_${leagueNum}`,
        leaguePoints: 0,
        loadoutType,
        mainWeaponId: weaponInv.id,
        stance: 'balanced',
        battleReadiness: 100,
        yieldThreshold: 10,
      });
    }
    console.log(`   Created league bronze_${leagueNum} (${MAX_ROBOTS_PER_LEAGUE} robots, mixed weapons)`);
  }

  console.log('✅ 200 WimpBot test users upserted (2 leagues × 100 robots, 25 per weapon type per league)');
}

// ===== MAIN =====

async function main() {
  const seedMode = getSeedMode();
  console.log(`🌱 Seeding database in ${seedMode.toUpperCase()} mode...`);
  console.log(`   NODE_ENV=${process.env.NODE_ENV || '(not set, defaulting to development)'}\n`);

  // --- Essential data (ALL environments) ---
  await seedCycleMetadata();
  const weapons = await seedWeapons();

  const practiceSword = weapons.find((w) => w.name === 'Practice Sword');
  if (!practiceSword) {
    throw new Error('Practice Sword weapon not found in seeded weapons array');
  }

  // Bye-Robot is essential game data (needed for odd-number matchmaking)
  await seedByeRobot(practiceSword);

  // --- Acceptance + development data ---
  if (seedMode === 'acceptance' || seedMode === 'development') {
    await seedAdminAccount();
    await seedWimpBotUsers(weapons);
  }

  // --- Summary ---
  console.log('');
  console.log(`✅ Database seeded successfully in ${seedMode.toUpperCase()} mode!`);
  console.log('');

  if (seedMode === 'production') {
    console.log('📊 Production seed summary:');
    console.log(`   ⚔️  ${weapons.length} weapons`);
    console.log('   🔄 Cycle metadata initialized');
    console.log('   🤖 Bye-Robot for matchmaking');
    console.log('   ❌ No test users seeded');
  } else {
    console.log(`📊 ${seedMode === 'acceptance' ? 'Acceptance' : 'Development'} seed summary:`);
    console.log(`   ⚔️  ${weapons.length} weapons`);
    console.log('   🔄 Cycle metadata initialized');
    console.log('   🤖 Bye-Robot for matchmaking');
    console.log('   👤 Admin account (₡3,000,000)');
    console.log('   👤 200 WimpBot test users (50 per weapon type)');
  }

  console.log('');
  console.log('🔐 Login Credentials (if seeded):');
  if (seedMode !== 'production') {
    console.log('   - Admin: admin / admin123');
    console.log('   - Test users: test_user_001-200 / testpass123');
  }
  console.log('');
}

// Only run main() when executed directly (not when imported for testing)
if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ Error seeding database:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
