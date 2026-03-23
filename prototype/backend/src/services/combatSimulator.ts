import { Robot, Weapon, WeaponInventory } from '@prisma/client';

// Spatial subsystem imports
import { Position, euclideanDistance, angleBetween } from './arena/vector2d';
import { createArena } from './arena/arenaLayout';
import { classifyRangeBand, getRangePenalty, getWeaponOptimalRange, canAttack, WeaponLike } from './arena/rangeBands';
import { calculateHydraulicBonus } from './arena/hydraulicBonus';
import { checkBackstab, updateFacing, calculateTurnSpeed } from './arena/positionTracker';
import { updateAdaptation, getEffectiveAdaptation } from './arena/adaptationTracker';
import { calculatePressureEffects } from './arena/pressureSystem';
import { calculateBaseSpeed, calculateEffectiveSpeed, updateServoStrain } from './arena/servoStrain';
import { calculateMovementIntent, applyMovement, getPatienceLimit } from './arena/movementAI';
import { checkSyncVolley, getSupportShieldBoost, getFormationDefenseBonus } from './arena/teamCoordination';
import { resolveCounter } from './arena/counterAttack';
import { selectTarget } from './arena/threatScoring';
import {
  RobotCombatState as SpatialRobotCombatState,
  CombatEvent as SpatialCombatEvent,
  CombatResult as SpatialCombatResult,
  RangeBand,
  ArenaConfig,
  GameModeConfig,
  GameModeState,
} from './arena/types';

/**
 * Combat Simulator - Implements time-based combat formulas from ROBOT_ATTRIBUTES.md
 * Enhanced with 2D spatial arena mechanics.
 *
 * This simulator uses ALL 23 robot attributes to determine battle outcomes.
 * ELO is NOT used in combat calculations - it's only for matchmaking.
 */

export interface RobotWithWeapons extends Robot {
  mainWeapon?: (WeaponInventory & { weapon: Weapon }) | null;
  offhandWeapon?: (WeaponInventory & { weapon: Weapon }) | null;
}

export interface CombatEvent {
  timestamp: number;
  type: 'attack' | 'miss' | 'critical' | 'counter' | 'shield_break' | 'shield_regen' | 'yield' | 'destroyed' | 'malfunction'
    | 'movement' | 'range_transition' | 'out_of_range' | 'counter_out_of_range' | 'backstab' | 'flanking'
    | 'zone_defined' | 'zone_enter' | 'zone_exit' | 'score_tick'
    | 'kill_bonus' | 'zone_moving' | 'zone_active' | 'robot_eliminated'
    | 'passive_warning' | 'passive_penalty' | 'last_standing' | 'match_end';
  attacker?: string;
  defender?: string;
  weapon?: string;
  hand?: 'main' | 'offhand';
  damage?: number;
  shieldDamage?: number;
  hpDamage?: number;
  hit?: boolean;
  critical?: boolean;
  counter?: boolean;
  malfunction?: boolean;
  robot1HP?: number;
  robot2HP?: number;
  robot1Shield?: number;
  robot2Shield?: number;
  message: string;
  formulaBreakdown?: FormulaBreakdown;
  // Optional spatial fields
  positions?: Record<string, Position>;
  facingDirections?: Record<string, number>;
  distance?: number;
  rangeBand?: RangeBand;
  rangePenalty?: number;
  backstab?: boolean;
  flanking?: boolean;
  attackAngle?: number;
  // KotH-specific fields
  kpiData?: {
    robotId?: number;
    killerRobotId?: number;
    victimRobotId?: number;
    bonus?: number;
    bonusAmount?: number;
    zoneScores?: Record<number, number>;
    zoneScore?: number;
    zoneState?: string;
    center?: { x: number; y: number };
    radius?: number;
    newCenter?: { x: number; y: number };
    countdown?: number;
    survivorId?: number;
    winnerId?: number | null;
    placements?: Array<{ robotId: number; placement: number; zoneScore: number }>;
    reason?: string;
    damageReduction?: number;
    accuracyPenalty?: number;
    timeOutside?: number;
    duration?: number;
    occupants?: number[];
    rotationCount?: number;
    destroyerRobotId?: number;
    winReason?: string;
  };
}

export interface FormulaBreakdown {
  calculation: string;
  components: Record<string, number>;
  result: number;
}

export interface CombatResult {
  winnerId: number | null;
  robot1FinalHP: number;
  robot2FinalHP: number;
  robot1FinalShield: number;
  robot2FinalShield: number;
  robot1Damage: number;
  robot2Damage: number;
  robot1DamageDealt: number;
  robot2DamageDealt: number;
  durationSeconds: number;
  isDraw: boolean;
  events: CombatEvent[];
  // Optional arena metadata
  arenaRadius?: number;
  startingPositions?: Record<string, Position>;
  endingPositions?: Record<string, Position>;
  // KotH metadata
  kothMetadata?: {
    finalZoneScores?: Record<number, number>;
    placementOrder?: Array<{ robotId: number; placement: number; zoneScore: number }>;
    zoneOccupationTimes?: Record<number, number>;
    uncontestedTimes?: Record<number, number>;
    zoneEntries?: Record<number, number>;
    zoneExits?: Record<number, number>;
    killCounts?: Record<number, number>;
    eliminationStatuses?: Record<number, 'destroyed' | 'yielded' | 'survived'>;
    matchDuration?: number;
    winReason?: string;
    zoneVariant?: 'fixed' | 'rotating';
  };
}

export const BASE_WEAPON_COOLDOWN = 4; // seconds
const MAX_BATTLE_DURATION = 120; // seconds
const SIMULATION_TICK = 0.1; // 100ms per tick

// Armor and penetration constants for new damage formula (Feb 2026)
export const ARMOR_EFFECTIVENESS = 1.5;
export const PENETRATION_BONUS = 2.0;

// Movement event throttling
const MOVEMENT_EVENT_THRESHOLD = 1.0; // grid units
const MOVEMENT_EVENT_MIN_INTERVAL = 0.5; // seconds

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get random value between min and max
 */
export function random(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Get effective attribute value including weapon bonuses
 */
export function getEffectiveAttribute(
  robot: RobotWithWeapons,
  baseAttribute: number | string | { toNumber(): number },
  hand: 'main' | 'offhand',
  bonusField: keyof Weapon
): number {
  const baseValue = typeof baseAttribute === 'object' && 'toNumber' in baseAttribute
    ? baseAttribute.toNumber()
    : Number(baseAttribute);
  const weapon = hand === 'main' ? robot.mainWeapon?.weapon : robot.offhandWeapon?.weapon;

  if (!weapon || !(bonusField in weapon)) {
    return baseValue;
  }

  const bonus = weapon[bonusField];
  return baseValue + Number(bonus);
}


/**
 * Calculate hit chance based on attacker and defender attributes
 */
export function calculateHitChance(
  attacker: RobotWithWeapons,
  defender: RobotWithWeapons,
  attackerHand: 'main' | 'offhand' = 'main',
  spatialBonuses?: { adaptationHitBonus: number; pressureAccuracyMod: number; combatAlgorithmScore: number }
): { hitChance: number; breakdown: FormulaBreakdown } {
  const baseHitChance = attackerHand === 'offhand' ? 50 : 70;
  const effectiveTargeting = getEffectiveAttribute(attacker, attacker.targetingSystems, attackerHand, 'targetingSystemsBonus');
  const targetingBonus = effectiveTargeting / 2;
  const stanceBonus = attacker.stance === 'offensive' ? 5 : 0;
  const evasionPenalty = Number(defender.evasionThrusters) / 3;
  const gyroPenalty = Number(defender.gyroStabilizers) / 5;

  let adaptBonus = 0;
  let pressureMod = 0;
  let algoBonus = 0;
  if (spatialBonuses) {
    adaptBonus = spatialBonuses.adaptationHitBonus;
    pressureMod = spatialBonuses.pressureAccuracyMod;
    // Combat algorithm hit bonus: score > 0.5 grants 1-5% (Req 5.5)
    if (spatialBonuses.combatAlgorithmScore > 0.5) {
      algoBonus = (spatialBonuses.combatAlgorithmScore - 0.5) * 10; // 0-5%
    }
  }

  const calculated = baseHitChance + targetingBonus + stanceBonus - evasionPenalty - gyroPenalty + adaptBonus + pressureMod + algoBonus;
  const randomVariance = random(-10, 10);
  const final = clamp(calculated + randomVariance, 10, 95);

  return {
    hitChance: final,
    breakdown: {
      calculation: `${baseHitChance} base + ${targetingBonus.toFixed(1)} targeting + ${stanceBonus} stance - ${evasionPenalty.toFixed(1)} evasion - ${gyroPenalty.toFixed(1)} gyro${adaptBonus ? ` + ${adaptBonus.toFixed(1)} adapt` : ''}${pressureMod ? ` + ${pressureMod.toFixed(1)} pressure` : ''}${algoBonus ? ` + ${algoBonus.toFixed(1)} algo` : ''} + ${randomVariance.toFixed(1)} variance = ${final.toFixed(1)}%`,
      components: {
        base: baseHitChance,
        targeting: targetingBonus,
        stance: stanceBonus,
        evasion: -evasionPenalty,
        gyro: -gyroPenalty,
        adaptation: adaptBonus,
        pressure: pressureMod,
        algorithmBonus: algoBonus,
        variance: randomVariance,
      },
      result: final,
    },
  };
}

/**
 * Calculate critical hit chance
 */
export function calculateCritChance(attacker: RobotWithWeapons, attackerHand: 'main' | 'offhand' = 'main'): { critChance: number; breakdown: FormulaBreakdown } {
  const baseCrit = 5;
  const effectiveCritSystems = getEffectiveAttribute(attacker, attacker.criticalSystems, attackerHand, 'criticalSystemsBonus');
  const critBonus = effectiveCritSystems / 8;
  const effectiveTargeting = getEffectiveAttribute(attacker, attacker.targetingSystems, attackerHand, 'targetingSystemsBonus');
  const targetingBonus = effectiveTargeting / 25;
  const loadoutBonus = attacker.loadoutType === 'two_handed' ? 10 : 0;

  const calculated = baseCrit + critBonus + targetingBonus + loadoutBonus;
  const randomVariance = random(-10, 10);
  const final = clamp(calculated + randomVariance, 0, 50);

  return {
    critChance: final,
    breakdown: {
      calculation: `${baseCrit} base + ${critBonus.toFixed(1)} crit_systems + ${targetingBonus.toFixed(1)} targeting + ${loadoutBonus} loadout + ${randomVariance.toFixed(1)} variance = ${final.toFixed(1)}%`,
      components: {
        base: baseCrit,
        critSystems: critBonus,
        targeting: targetingBonus,
        loadout: loadoutBonus,
        variance: randomVariance,
      },
      result: final,
    },
  };
}

/**
 * Calculate weapon malfunction chance based on weapon control
 */
export function calculateMalfunctionChance(attacker: RobotWithWeapons, attackerHand: 'main' | 'offhand' = 'main'): { malfunctionChance: number; breakdown: FormulaBreakdown } {
  const effectiveWeaponControl = getEffectiveAttribute(attacker, attacker.weaponControl, attackerHand, 'weaponControlBonus');
  const baseMalfunction = 20;
  const reductionPerPoint = 0.4;
  const calculated = baseMalfunction - (effectiveWeaponControl * reductionPerPoint);
  const finalChance = Math.max(0, calculated);

  return {
    malfunctionChance: finalChance,
    breakdown: {
      calculation: `${baseMalfunction} base - (${effectiveWeaponControl.toFixed(1)} weapon_control × ${reductionPerPoint}) = ${finalChance.toFixed(1)}%`,
      components: {
        base: baseMalfunction,
        weaponControl: effectiveWeaponControl,
        reductionPerPoint,
      },
      result: finalChance,
    },
  };
}

/**
 * Calculate base damage before defense
 */
export function calculateBaseDamage(
  attacker: RobotWithWeapons,
  weaponBaseDamage: number,
  attackerHand: 'main' | 'offhand' = 'main',
  spatialMultipliers?: { rangePenalty: number; hydraulicBonus: number; backstabBonus: number; adaptationDamageBonus: number; pressureDamageMod: number; syncVolleyBonus: number }
): { damage: number; breakdown: FormulaBreakdown } {
  const effectiveCombatPower = getEffectiveAttribute(attacker, attacker.combatPower, attackerHand, 'combatPowerBonus');
  const combatPowerMult = 1 + (effectiveCombatPower * 1.5) / 100;
  let damage = weaponBaseDamage * combatPowerMult;

  const loadoutMult = attacker.loadoutType === 'two_handed' ? 1.10 :
                      attacker.loadoutType === 'dual_wield' ? 0.90 : 1.0;
  damage *= loadoutMult;

  const effectiveWeaponControl = getEffectiveAttribute(attacker, attacker.weaponControl, attackerHand, 'weaponControlBonus');
  const controlMult = 1 + effectiveWeaponControl / 150;
  damage *= controlMult;

  const stanceMult = attacker.stance === 'offensive' ? 1.15 :
                     attacker.stance === 'defensive' ? 0.90 : 1.0;
  damage *= stanceMult;

  // Apply spatial multipliers
  let rangePenaltyVal = 1;
  let hydraulicVal = 1;
  let backstabVal = 0;
  let adaptDmg = 0;
  let pressureDmg = 0;
  let syncBonus = 0;
  if (spatialMultipliers) {
    rangePenaltyVal = spatialMultipliers.rangePenalty;
    hydraulicVal = spatialMultipliers.hydraulicBonus;
    backstabVal = spatialMultipliers.backstabBonus;
    adaptDmg = spatialMultipliers.adaptationDamageBonus;
    pressureDmg = spatialMultipliers.pressureDamageMod;
    syncBonus = spatialMultipliers.syncVolleyBonus;
    damage *= rangePenaltyVal;
    damage *= hydraulicVal;
    damage *= (1 + backstabVal);
    damage *= (1 + adaptDmg / 100);
    damage *= (1 + pressureDmg / 100);
    damage *= (1 + syncBonus);
  }

  const spatialParts = spatialMultipliers
    ? ` × ${rangePenaltyVal.toFixed(2)} range × ${hydraulicVal.toFixed(2)} hydraulic${backstabVal > 0 ? ` × ${(1 + backstabVal).toFixed(2)} backstab` : ''}${adaptDmg ? ` × ${(1 + adaptDmg / 100).toFixed(3)} adapt` : ''}${pressureDmg ? ` × ${(1 + pressureDmg / 100).toFixed(3)} pressure` : ''}${syncBonus ? ` × ${(1 + syncBonus).toFixed(3)} sync` : ''}`
    : '';

  return {
    damage,
    breakdown: {
      calculation: `${weaponBaseDamage} base × ${combatPowerMult.toFixed(2)} combat_power × ${loadoutMult.toFixed(2)} loadout × ${controlMult.toFixed(2)} weapon_control × ${stanceMult.toFixed(2)} stance${spatialParts} = ${damage.toFixed(1)}`,
      components: {
        weaponBase: weaponBaseDamage,
        combatPower: combatPowerMult,
        loadout: loadoutMult,
        weaponControl: controlMult,
        stance: stanceMult,
        rangePenalty: rangePenaltyVal,
        hydraulicBonus: hydraulicVal,
        backstabBonus: backstabVal,
        adaptationDamage: adaptDmg,
        pressureDamage: pressureDmg,
        syncVolley: syncBonus,
      },
      result: damage,
    },
  };
}


/**
 * Apply damage through Energy Shields and armor
 */
export function applyDamage(
  baseDamage: number,
  attacker: RobotWithWeapons,
  defender: RobotWithWeapons,
  defenderState: SpatialRobotCombatState,
  isCritical: boolean,
  attackerHand: 'main' | 'offhand' = 'main',
  formationDefenseBonus: number = 0
): { hpDamage: number; shieldDamage: number; breakdown: FormulaBreakdown } {
  let damage = baseDamage;

  let critMultiplier = 1.0;
  if (isCritical) {
    critMultiplier = attacker.loadoutType === 'two_handed' ? 2.5 : 2.0;
    critMultiplier -= Number(defender.damageDampeners) / 100;
    critMultiplier = Math.max(critMultiplier, 1.2);
    damage *= critMultiplier;
  }

  const dampenersValue = Number(defender.damageDampeners);
  const preShieldMitigationPercent = clamp(dampenersValue * 0.2, 0, 15);
  const preShieldDamageMultiplier = 1 - (preShieldMitigationPercent / 100);
  damage *= preShieldDamageMultiplier;

  // Apply formation defense bonus (wall-bracing, Req 13.3)
  if (formationDefenseBonus > 0) {
    damage *= (1 - formationDefenseBonus);
  }

  const effectivePenetration = getEffectiveAttribute(attacker, attacker.penetration, attackerHand, 'penetrationBonus');
  const effectiveArmorPlating = Number(defender.armorPlating);

  let shieldDamage = 0;
  let hpDamage = 0;
  let remainingDamage = damage;
  let detailedFormula = '';

  const damageAfterDampeners = damage;

  if (defenderState.currentShield > 0) {
    shieldDamage = Math.min(damage, defenderState.currentShield);
    defenderState.currentShield -= shieldDamage;
    remainingDamage = damage - shieldDamage;
  }

  if (remainingDamage > 0) {
    let damageMultiplier = 1.0;

    if (effectivePenetration <= effectiveArmorPlating) {
      const armorReductionPercent = (effectiveArmorPlating - effectivePenetration) * ARMOR_EFFECTIVENESS;
      damageMultiplier = 1 - (armorReductionPercent / 100);
      hpDamage = Math.max(1, remainingDamage * damageMultiplier);

      if (shieldDamage > 0) {
        detailedFormula = `${baseDamage.toFixed(1)} base × ${critMultiplier.toFixed(2)} crit × ${preShieldDamageMultiplier.toFixed(2)} dampen${formationDefenseBonus > 0 ? ` × ${(1 - formationDefenseBonus).toFixed(3)} formation` : ''} = ${damageAfterDampeners.toFixed(1)} | Energy Shield: ${shieldDamage.toFixed(1)} absorbed | Overflow: ${remainingDamage.toFixed(1)} × ${damageMultiplier.toFixed(2)} armor = ${hpDamage.toFixed(1)} HP`;
      } else {
        detailedFormula = `${baseDamage.toFixed(1)} base × ${critMultiplier.toFixed(2)} crit × ${preShieldDamageMultiplier.toFixed(2)} dampen${formationDefenseBonus > 0 ? ` × ${(1 - formationDefenseBonus).toFixed(3)} formation` : ''} = ${damageAfterDampeners.toFixed(1)} | No Energy Shield | ${damageAfterDampeners.toFixed(1)} × ${damageMultiplier.toFixed(2)} armor = ${hpDamage.toFixed(1)} HP`;
      }
    } else {
      const penetrationBonusPercent = (effectivePenetration - effectiveArmorPlating) * PENETRATION_BONUS;
      damageMultiplier = 1 + (penetrationBonusPercent / 100);
      hpDamage = Math.max(1, remainingDamage * damageMultiplier);

      if (shieldDamage > 0) {
        detailedFormula = `${baseDamage.toFixed(1)} base × ${critMultiplier.toFixed(2)} crit × ${preShieldDamageMultiplier.toFixed(2)} dampen${formationDefenseBonus > 0 ? ` × ${(1 - formationDefenseBonus).toFixed(3)} formation` : ''} = ${damageAfterDampeners.toFixed(1)} | Energy Shield: ${shieldDamage.toFixed(1)} absorbed | Overflow: ${remainingDamage.toFixed(1)} × ${damageMultiplier.toFixed(2)} pen bonus = ${hpDamage.toFixed(1)} HP`;
      } else {
        detailedFormula = `${baseDamage.toFixed(1)} base × ${critMultiplier.toFixed(2)} crit × ${preShieldDamageMultiplier.toFixed(2)} dampen${formationDefenseBonus > 0 ? ` × ${(1 - formationDefenseBonus).toFixed(3)} formation` : ''} = ${damageAfterDampeners.toFixed(1)} | No Energy Shield | ${damageAfterDampeners.toFixed(1)} × ${damageMultiplier.toFixed(2)} pen bonus = ${hpDamage.toFixed(1)} HP`;
      }
    }
  } else if (shieldDamage > 0) {
    detailedFormula = `${baseDamage.toFixed(1)} base × ${critMultiplier.toFixed(2)} crit × ${preShieldDamageMultiplier.toFixed(2)} dampen${formationDefenseBonus > 0 ? ` × ${(1 - formationDefenseBonus).toFixed(3)} formation` : ''} = ${damageAfterDampeners.toFixed(1)} | Energy Shield: ${shieldDamage.toFixed(1)} absorbed, 0 HP`;
  }

  defenderState.currentHP = Math.max(0, defenderState.currentHP - hpDamage);

  return {
    hpDamage,
    shieldDamage,
    breakdown: {
      calculation: detailedFormula,
      components: {
        baseDamage,
        critMultiplier,
        dampenersValue,
        preShieldMitigationPercent,
        preShieldDamageMultiplier,
        formationDefenseBonus,
        damageAfterDampeners,
        penetration: effectivePenetration,
        armorPlating: effectiveArmorPlating,
        shieldDamage,
        hpDamage,
      },
      result: hpDamage + shieldDamage,
    },
  };
}

/**
 * Calculate counter-attack chance
 */
function calculateCounterChance(defender: RobotWithWeapons): { counterChance: number; breakdown: FormulaBreakdown } {
  let baseCounter = Number(defender.counterProtocols) / 100;

  if (defender.stance === 'defensive') {
    baseCounter *= 1.15;
  }

  if (defender.loadoutType === 'weapon_shield') {
    baseCounter *= 1.10;
  }

  const finalChance = clamp(baseCounter * 100, 0, 40);

  return {
    counterChance: finalChance,
    breakdown: {
      calculation: `${Number(defender.counterProtocols).toFixed(2)} counter_protocols / 100 × ${defender.stance === 'defensive' ? '1.15 defensive' : '1.0'} × ${defender.loadoutType === 'weapon_shield' ? '1.10 shield' : '1.0'} = ${finalChance.toFixed(1)}%`,
      components: {
        counterProtocols: Number(defender.counterProtocols),
        stanceBonus: defender.stance === 'defensive' ? 1.15 : 1.0,
        shieldBonus: defender.loadoutType === 'weapon_shield' ? 1.10 : 1.0,
      },
      result: finalChance,
    },
  };
}

/**
 * Regenerate shields based on power core
 */
function regenerateShields(state: SpatialRobotCombatState, deltaTime: number, supportBoost: number = 0): number {
  const regenPerSecond = Number(state.robot.powerCore) * 0.15;
  const stanceBonus = state.robot.stance === 'defensive' ? 1.20 : 1.0;
  let effectiveRegen = regenPerSecond * stanceBonus * deltaTime;

  // Support systems shield boost (Req 13.2)
  if (supportBoost > 0) {
    effectiveRegen += supportBoost * state.maxShield * deltaTime;
  }

  const oldShield = state.currentShield;
  state.currentShield = Math.min(state.currentShield + effectiveRegen, state.maxShield);

  return state.currentShield - oldShield;
}

/**
 * Check if robot should yield based on threshold
 */
function shouldYield(state: SpatialRobotCombatState): boolean {
  const hpPercent = (state.currentHP / state.maxHP) * 100;
  return hpPercent <= state.robot.yieldThreshold && hpPercent > 0;
}

/**
 * Get weapon info for display
 */
export function getWeaponInfo(robot: RobotWithWeapons, hand: 'main' | 'offhand'): { name: string; baseDamage: number } {
  const weaponInventory = hand === 'main' ? robot.mainWeapon : robot.offhandWeapon;
  if (weaponInventory?.weapon) {
    return {
      name: weaponInventory.weapon.name,
      baseDamage: weaponInventory.weapon.baseDamage,
    };
  }
  return {
    name: 'Fists',
    baseDamage: 10,
  };
}

/**
 * Get weapon stats summary for robot
 */
function getWeaponStatsSummary(robot: RobotWithWeapons): string {
  const parts: string[] = [];
  if (robot.mainWeapon?.weapon) {
    const w = robot.mainWeapon.weapon;
    parts.push(`Main: ${w.name} (${w.baseDamage} dmg, ${w.cooldown}s CD)`);
  }
  if (robot.offhandWeapon?.weapon) {
    const w = robot.offhandWeapon.weapon;
    parts.push(`Offhand: ${w.name} (${w.baseDamage} dmg, ${w.cooldown}s CD)`);
  }
  return parts.length > 0 ? parts.join(', ') : 'Unarmed';
}


/**
 * Get weapon attribute bonuses summary for robot
 */
function _getWeaponBonusesSummary(robot: RobotWithWeapons): string {
  const parts: string[] = [];

  const summarizeWeapon = (w: Weapon, label: string): void => {
    const bonuses: string[] = [];
    if (w.combatPowerBonus !== 0) bonuses.push(`CombatPower ${w.combatPowerBonus > 0 ? '+' : ''}${w.combatPowerBonus}`);
    if (w.targetingSystemsBonus !== 0) bonuses.push(`Targeting ${w.targetingSystemsBonus > 0 ? '+' : ''}${w.targetingSystemsBonus}`);
    if (w.criticalSystemsBonus !== 0) bonuses.push(`Crit ${w.criticalSystemsBonus > 0 ? '+' : ''}${w.criticalSystemsBonus}`);
    if (w.penetrationBonus !== 0) bonuses.push(`Pen ${w.penetrationBonus > 0 ? '+' : ''}${w.penetrationBonus}`);
    if (w.weaponControlBonus !== 0) bonuses.push(`Control ${w.weaponControlBonus > 0 ? '+' : ''}${w.weaponControlBonus}`);
    if (w.attackSpeedBonus !== 0) bonuses.push(`Speed ${w.attackSpeedBonus > 0 ? '+' : ''}${w.attackSpeedBonus}`);
    parts.push(bonuses.length > 0 ? `${label} (${w.name}): ${bonuses.join(', ')}` : `${label} (${w.name}): No bonuses`);
  };

  if (robot.mainWeapon?.weapon) summarizeWeapon(robot.mainWeapon.weapon, 'Main');
  if (robot.offhandWeapon?.weapon) summarizeWeapon(robot.offhandWeapon.weapon, 'Offhand');

  return parts.length > 0 ? parts.join('\n') : 'No weapons equipped';
}

/**
 * Build position snapshot for events
 */
function buildPositionSnapshot(
  ...states: SpatialRobotCombatState[]
): { positions: Record<string, Position>; facingDirections: Record<string, number> } {
  const positions: Record<string, Position> = {};
  const facingDirections: Record<string, number> = {};
  for (const s of states) {
    positions[s.robot.name] = { x: s.position.x, y: s.position.y };
    facingDirections[s.robot.name] = s.facingDirection;
  }
  return { positions, facingDirections };
}

/**
 * Build per-robot HP and shield maps for N-robot battles (KotH/FFA).
 * Returns robotHP and robotShield keyed by robot name.
 */
function buildHPShieldSnapshot(
  states: SpatialRobotCombatState[],
): { robotHP: Record<string, number>; robotShield: Record<string, number> } {
  const robotHP: Record<string, number> = {};
  const robotShield: Record<string, number> = {};
  for (const s of states) {
    robotHP[s.robot.name] = Math.max(0, s.currentHP);
    robotShield[s.robot.name] = Math.max(0, s.currentShield);
  }
  return { robotHP, robotShield };
}

/**
 * Perform a single attack from attacker to defender with spatial modifiers
 */
function performAttack(
  attackerState: SpatialRobotCombatState,
  defenderState: SpatialRobotCombatState,
  attackerName: string,
  defenderName: string,
  currentTime: number,
  hand: 'main' | 'offhand',
  events: CombatEvent[],
  spatialContext: {
    distance: number;
    rangeBand: RangeBand;
    rangePenaltyMult: number;
    hydraulicMult: number;
    backstabBonus: number;
    adaptationHit: number;
    adaptationDmg: number;
    pressureAccuracy: number;
    pressureDamage: number;
    combatAlgorithmScore: number;
    syncVolleyBonus: number;
    formationDefenseBonus: number;
    positionSnapshot: { positions: Record<string, Position>; facingDirections: Record<string, number> };
    isBackstab: boolean;
    attackAngle: number;
  }
): void {
  const weaponInfo = getWeaponInfo(attackerState.robot, hand);
  const handLabel = hand === 'offhand' ? ' [OFFHAND]' : '';

  // Check for weapon malfunction
  const { malfunctionChance, breakdown: malfunctionBreakdown } = calculateMalfunctionChance(attackerState.robot, hand);
  const malfunctionRoll = random(0, 100);
  const weaponMalfunctions = malfunctionRoll < malfunctionChance;

  if (weaponMalfunctions) {
    events.push({
      timestamp: Number(currentTime.toFixed(1)),
      type: 'malfunction',
      attacker: attackerName,
      defender: defenderName,
      weapon: weaponInfo.name,
      hand,
      hit: false,
      malfunction: true,
      robot1HP: attackerState.currentHP,
      robot2HP: defenderState.currentHP,
      robot1Shield: attackerState.currentShield,
      robot2Shield: defenderState.currentShield,
      message: `⚠️${handLabel} ${attackerName}'s ${weaponInfo.name} malfunctions! (Weapon Control failure)`,
      formulaBreakdown: {
        calculation: `Malfunction: ${malfunctionBreakdown.calculation} (rolled ${malfunctionRoll.toFixed(1)}, result: MALFUNCTION)`,
        components: { ...malfunctionBreakdown.components, malfunctionRoll },
        result: 0,
      },
      ...spatialContext.positionSnapshot,
      distance: spatialContext.distance,
      rangeBand: spatialContext.rangeBand,
    });
    // Update adaptation on miss (malfunction counts as miss for adaptation)
    const malfAdaptState = {
      adaptiveAI: Number(attackerState.robot.adaptiveAI ?? 1),
      adaptationHitBonus: attackerState.adaptationHitBonus,
      adaptationDamageBonus: attackerState.adaptationDamageBonus,
      currentHP: attackerState.currentHP,
      maxHP: attackerState.maxHP,
    };
    updateAdaptation(malfAdaptState, 'miss');
    attackerState.adaptationHitBonus = malfAdaptState.adaptationHitBonus;
    attackerState.adaptationDamageBonus = malfAdaptState.adaptationDamageBonus;
    attackerState.missCount++;
    return;
  }

  // Hit calculation with spatial bonuses
  const { hitChance, breakdown: hitBreakdown } = calculateHitChance(
    attackerState.robot, defenderState.robot, hand,
    { adaptationHitBonus: spatialContext.adaptationHit, pressureAccuracyMod: spatialContext.pressureAccuracy, combatAlgorithmScore: spatialContext.combatAlgorithmScore }
  );
  const hitRoll = random(0, 100);
  const hit = hitRoll < hitChance;

  const { critChance, breakdown: critBreakdown } = calculateCritChance(attackerState.robot, hand);
  const critRoll = random(0, 100);
  const isCritical = hit && (critRoll < critChance);

  const weaponDamage = weaponInfo.baseDamage;

  if (hit) {
    const { damage: baseDamage, breakdown: damageBreakdown } = calculateBaseDamage(
      attackerState.robot, weaponDamage, hand,
      {
        rangePenalty: spatialContext.rangePenaltyMult,
        hydraulicBonus: spatialContext.hydraulicMult,
        backstabBonus: spatialContext.backstabBonus,
        adaptationDamageBonus: spatialContext.adaptationDmg,
        pressureDamageMod: spatialContext.pressureDamage,
        syncVolleyBonus: spatialContext.syncVolleyBonus,
      }
    );
    const { hpDamage, shieldDamage, breakdown: applyBreakdown } = applyDamage(
      baseDamage, attackerState.robot, defenderState.robot, defenderState, isCritical, hand,
      spatialContext.formationDefenseBonus
    );

    attackerState.totalDamageDealt += hpDamage + shieldDamage;
    defenderState.totalDamageTaken += hpDamage + shieldDamage;

    const totalDamage = hpDamage + shieldDamage;

    const formulaParts = [
      `Malfunction: ${malfunctionBreakdown.calculation} (rolled ${malfunctionRoll.toFixed(1)}, result: weapon reliable)`,
      `Hit: ${hitBreakdown.calculation} (rolled ${hitRoll.toFixed(1)}, result: HIT)`,
      `Crit: ${critBreakdown.calculation} (rolled ${critRoll.toFixed(1)}, result: ${isCritical ? 'CRITICAL HIT' : 'normal'})`,
      `Damage: ${damageBreakdown.calculation}`,
      `Apply: ${applyBreakdown.calculation}`,
    ];

    const backstabLabel = spatialContext.isBackstab ? ' 🗡️BACKSTAB!' : '';

    events.push({
      timestamp: Number(currentTime.toFixed(1)),
      type: isCritical ? 'critical' : 'attack',
      attacker: attackerName,
      defender: defenderName,
      weapon: weaponInfo.name,
      hand,
      damage: totalDamage,
      shieldDamage,
      hpDamage,
      hit: true,
      critical: isCritical,
      robot1HP: attackerState.currentHP,
      robot2HP: defenderState.currentHP,
      robot1Shield: attackerState.currentShield,
      robot2Shield: defenderState.currentShield,
      message: isCritical
        ? `💢 CRITICAL!${handLabel}${backstabLabel} ${attackerName} deals ${totalDamage.toFixed(0)} damage with ${weaponInfo.name} (${shieldDamage.toFixed(0)} shield, ${hpDamage.toFixed(0)} HP)`
        : `💥${handLabel}${backstabLabel} ${attackerName} hits for ${totalDamage.toFixed(0)} damage with ${weaponInfo.name} (${shieldDamage.toFixed(0)} shield, ${hpDamage.toFixed(0)} HP)`,
      formulaBreakdown: {
        calculation: formulaParts.join('\n'),
        components: {
          ...malfunctionBreakdown.components, malfunctionRoll,
          ...hitBreakdown.components, hitRoll,
          ...critBreakdown.components, critRoll,
          ...damageBreakdown.components,
          ...applyBreakdown.components,
        },
        result: totalDamage,
      },
      ...spatialContext.positionSnapshot,
      distance: spatialContext.distance,
      rangeBand: spatialContext.rangeBand,
      rangePenalty: spatialContext.rangePenaltyMult,
      backstab: spatialContext.isBackstab,
      attackAngle: spatialContext.attackAngle,
    });

    // Update adaptation for defender (damage taken)
    const defAdaptState = {
      adaptiveAI: Number(defenderState.robot.adaptiveAI ?? 1),
      adaptationHitBonus: defenderState.adaptationHitBonus,
      adaptationDamageBonus: defenderState.adaptationDamageBonus,
      currentHP: defenderState.currentHP,
      maxHP: defenderState.maxHP,
    };
    updateAdaptation(defAdaptState, 'damage_taken');
    defenderState.adaptationHitBonus = defAdaptState.adaptationHitBonus;
    defenderState.adaptationDamageBonus = defAdaptState.adaptationDamageBonus;
    defenderState.hitsTaken++;
  } else {
    // Miss
    const formulaParts = [
      `Malfunction: ${malfunctionBreakdown.calculation} (rolled ${malfunctionRoll.toFixed(1)}, result: weapon reliable)`,
      `Hit: ${hitBreakdown.calculation} (rolled ${hitRoll.toFixed(1)}, result: MISS)`,
      `Crit: ${critBreakdown.calculation} (rolled ${critRoll.toFixed(1)}, would be: ${critRoll < critChance ? 'CRITICAL' : 'normal'})`,
    ];

    events.push({
      timestamp: Number(currentTime.toFixed(1)),
      type: 'miss',
      attacker: attackerName,
      defender: defenderName,
      weapon: weaponInfo.name,
      hand,
      hit: false,
      robot1HP: attackerState.currentHP,
      robot2HP: defenderState.currentHP,
      robot1Shield: attackerState.currentShield,
      robot2Shield: defenderState.currentShield,
      message: `❌${handLabel} ${attackerName} misses ${defenderName} with ${weaponInfo.name}`,
      formulaBreakdown: {
        calculation: formulaParts.join('\n'),
        components: {
          ...malfunctionBreakdown.components, malfunctionRoll,
          ...hitBreakdown.components, hitRoll,
          ...critBreakdown.components, critRoll,
        },
        result: 0,
      },
      ...spatialContext.positionSnapshot,
      distance: spatialContext.distance,
      rangeBand: spatialContext.rangeBand,
    });

    // Update adaptation for attacker (miss)
    const atkAdaptState = {
      adaptiveAI: Number(attackerState.robot.adaptiveAI ?? 1),
      adaptationHitBonus: attackerState.adaptationHitBonus,
      adaptationDamageBonus: attackerState.adaptationDamageBonus,
      currentHP: attackerState.currentHP,
      maxHP: attackerState.maxHP,
    };
    updateAdaptation(atkAdaptState, 'miss');
    attackerState.adaptationHitBonus = atkAdaptState.adaptationHitBonus;
    attackerState.adaptationDamageBonus = atkAdaptState.adaptationDamageBonus;
    attackerState.missCount++;
  }

  // Counter-attack check (range-aware, Req 19)
  if (defenderState.currentHP <= 0) return;

  const { counterChance, breakdown: counterBreakdown } = calculateCounterChance(defenderState.robot);
  const counterRoll = random(0, 100);
  const counterTriggered = counterRoll < counterChance;

  if (!counterTriggered) return;

  // Resolve counter with range checking
  const counterResult = resolveCounter(defenderState, attackerState, spatialContext.distance);

  if (!counterResult.canCounter) {
    // Counter blocked by range
    events.push({
      timestamp: Number(currentTime.toFixed(1)),
      type: 'counter_out_of_range',
      attacker: defenderName,
      defender: attackerName,
      weapon: counterResult.weapon?.name ?? 'Fists',
      robot1HP: attackerState.currentHP,
      robot2HP: defenderState.currentHP,
      robot1Shield: attackerState.currentShield,
      robot2Shield: defenderState.currentShield,
      message: `🔄🚫 ${defenderName} tries to counter but ${counterResult.weapon?.name ?? 'weapon'} can't reach at ${spatialContext.distance.toFixed(1)} units!`,
      ...spatialContext.positionSnapshot,
      distance: spatialContext.distance,
      rangeBand: spatialContext.rangeBand,
    });
    return;
  }

  // Counter can proceed — perform counter attack
  const counterWeaponInfo = counterResult.weapon
    ? { name: counterResult.weapon.name, baseDamage: (counterResult.weapon as WeaponLike & { baseDamage: number }).baseDamage || 10 }
    : getWeaponInfo(defenderState.robot, 'main');

  const { damage: counterBaseDamage, breakdown: counterDamageBreakdown } = calculateBaseDamage(defenderState.robot, counterWeaponInfo.baseDamage, counterResult.hand);
  // Apply 70% counter multiplier, range penalty, and hydraulic bonus
  const counterDamage = counterBaseDamage * 0.7 * counterResult.rangePenaltyMultiplier * counterResult.hydraulicMultiplier;

  const { hitChance: counterHitChance, breakdown: counterHitBreakdown } = calculateHitChance(defenderState.robot, attackerState.robot, counterResult.hand);
  const counterHitRoll = random(0, 100);
  const counterHits = counterHitRoll < counterHitChance;

  if (counterHits) {
    const { hpDamage: counterHP, shieldDamage: counterShield, breakdown: counterApplyBreakdown } = applyDamage(
      counterDamage, defenderState.robot, attackerState.robot, attackerState, false, counterResult.hand
    );

    defenderState.totalDamageDealt += counterHP + counterShield;
    attackerState.totalDamageTaken += counterHP + counterShield;

    events.push({
      timestamp: Number(currentTime.toFixed(1)),
      type: 'counter',
      attacker: defenderName,
      defender: attackerName,
      weapon: counterWeaponInfo.name,
      hand: counterResult.hand,
      damage: counterHP + counterShield,
      hpDamage: counterHP,
      shieldDamage: counterShield,
      hit: true,
      counter: true,
      robot1HP: attackerState.currentHP,
      robot2HP: defenderState.currentHP,
      robot1Shield: attackerState.currentShield,
      robot2Shield: defenderState.currentShield,
      message: `🔄 ${defenderName} counters for ${(counterHP + counterShield).toFixed(0)} damage with ${counterWeaponInfo.name}!`,
      formulaBreakdown: {
        calculation: `Counter trigger: ${counterBreakdown.calculation} (rolled ${counterRoll.toFixed(1)}, result: COUNTER)\nCounter hit: ${counterHitBreakdown.calculation} (rolled ${counterHitRoll.toFixed(1)}, result: HIT)\nCounter damage: ${counterDamageBreakdown.calculation} × 0.70 × ${counterResult.rangePenaltyMultiplier.toFixed(2)} range × ${counterResult.hydraulicMultiplier.toFixed(2)} hydraulic = ${counterDamage.toFixed(1)}\n${counterApplyBreakdown.calculation}`,
        components: {
          counterChance, counterRoll, counterHitChance, counterHitRoll,
          counterBase: counterDamage,
          counterRangePenalty: counterResult.rangePenaltyMultiplier,
          counterHydraulic: counterResult.hydraulicMultiplier,
          ...counterApplyBreakdown.components,
        },
        result: counterHP + counterShield,
      },
      ...spatialContext.positionSnapshot,
      distance: spatialContext.distance,
      rangeBand: spatialContext.rangeBand,
    });
  } else {
    events.push({
      timestamp: Number(currentTime.toFixed(1)),
      type: 'counter',
      attacker: defenderName,
      defender: attackerName,
      weapon: counterWeaponInfo.name,
      hand: counterResult.hand,
      damage: 0,
      hpDamage: 0,
      shieldDamage: 0,
      hit: false,
      counter: true,
      robot1HP: attackerState.currentHP,
      robot2HP: defenderState.currentHP,
      robot1Shield: attackerState.currentShield,
      robot2Shield: defenderState.currentShield,
      message: `🔄❌ ${defenderName} counters but misses ${attackerName}!`,
      formulaBreakdown: {
        calculation: `Counter trigger: ${counterBreakdown.calculation} (rolled ${counterRoll.toFixed(1)}, result: COUNTER)\nCounter hit: ${counterHitBreakdown.calculation} (rolled ${counterHitRoll.toFixed(1)}, result: MISS)`,
        components: { counterChance, counterRoll, counterHitChance, counterHitRoll },
        result: 0,
      },
      ...spatialContext.positionSnapshot,
      distance: spatialContext.distance,
      rangeBand: spatialContext.rangeBand,
    });
  }
}


/**
 * Initialize extended combat state with spatial fields.
 * Pure function — creates a fresh state object from robot data and spawn position.
 */
function initializeCombatState(
  robot: RobotWithWeapons,
  spawnPosition: Position,
  facingTarget: Position,
  teamIndex: number,
  attackCooldown: number,
  offhandCooldown: number,
): SpatialRobotCombatState {
  const servoMotors = Number(robot.servoMotors ?? 1);
  const baseSpeed = calculateBaseSpeed(servoMotors);
  const combatAlgorithms = Number(robot.combatAlgorithms ?? 1);
  const facingDirection = angleBetween(spawnPosition, facingTarget);

  return {
    robot,
    currentHP: robot.currentHP,
    maxHP: robot.maxHP,
    currentShield: robot.currentShield,
    maxShield: robot.maxShield,
    lastAttackTime: 0,
    lastOffhandAttackTime: 0,
    attackCooldown,
    offhandCooldown,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    // Spatial fields
    position: { x: spawnPosition.x, y: spawnPosition.y },
    facingDirection,
    velocity: { x: 0, y: 0 },
    movementSpeed: baseSpeed,
    effectiveMovementSpeed: baseSpeed,
    // Servo strain
    servoStrain: 0,
    sustainedMovementTime: 0,
    isUsingClosingBonus: false,
    // AI state
    movementIntent: {
      targetPosition: spawnPosition,
      strategy: 'direct_path',
      preferredRange: 'short',
      stanceSpeedModifier: 0,
    },
    currentTarget: null,
    patienceTimer: 0,
    combatAlgorithmScore: Math.min(combatAlgorithms / 50, 1.0),
    // Adaptation
    adaptationHitBonus: 0,
    adaptationDamageBonus: 0,
    hitsTaken: 0,
    missCount: 0,
    // Pressure
    pressureThreshold: 15 + Number(robot.logicCores ?? 1) * 0.6,
    isUnderPressure: false,
    // Team
    teamIndex,
    isAlive: true,
  };
}


/**
 * Configuration for the unified battle simulator.
 * Replaces the old `isTournament` boolean with a general config object.
 */
export interface BattleConfig {
  /** If true, time-limit draws are resolved by HP tiebreaker (highest HP% wins) */
  allowDraws: boolean;
  /** Max battle duration in seconds (defaults to MAX_BATTLE_DURATION) */
  maxDuration?: number;
  /** Optional game mode config for extensible mechanics (KotH zones, targeting, etc.) */
  gameModeConfig?: GameModeConfig;
  /** Optional game mode state (zone scores, custom data, etc.) */
  gameModeState?: GameModeState;
  /** Optional arena radius override */
  arenaRadius?: number;
}

// ─── Helper: calculate weapon cooldown ───────────────────────────────
function calcCooldown(robot: RobotWithWeapons, weaponCooldown: number | undefined, hand: 'main' | 'offhand'): number {
  const baseCooldown = weaponCooldown || BASE_WEAPON_COOLDOWN;
  const cooldownWithPenalty = hand === 'offhand' ? baseCooldown * 1.4 : baseCooldown;
  const effectiveAttackSpeed = getEffectiveAttribute(robot, robot.attackSpeed, hand, 'attackSpeedBonus');
  return cooldownWithPenalty / (1 + Number(effectiveAttackSpeed) / 50);
}

// ─── Helper: build spatial context for an attack pair ────────────────
function buildSpatialContext(
  attacker: SpatialRobotCombatState,
  defender: SpatialRobotCombatState,
  hand: 'main' | 'offhand',
  currentTime: number,
  arena: ArenaConfig,
  allStates: SpatialRobotCombatState[],
): {
  distance: number;
  rangeBand: RangeBand;
  rangePenaltyMult: number;
  hydraulicMult: number;
  backstabBonus: number;
  adaptationHit: number;
  adaptationDmg: number;
  pressureAccuracy: number;
  pressureDamage: number;
  combatAlgorithmScore: number;
  syncVolleyBonus: number;
  formationDefenseBonus: number;
  positionSnapshot: { positions: Record<string, Position>; facingDirections: Record<string, number> };
  isBackstab: boolean;
  attackAngle: number;
} {
  const dist = euclideanDistance(attacker.position, defender.position);
  const rangeBand = classifyRangeBand(dist);

  const weapon = hand === 'main' ? attacker.robot.mainWeapon?.weapon : attacker.robot.offhandWeapon?.weapon;
  const weaponLike: WeaponLike | null = weapon ? { name: weapon.name, rangeBand: weapon.rangeBand as RangeBand } : null;
  const optimalRange = weaponLike ? getWeaponOptimalRange(weaponLike) : 'short';
  const rangePenaltyMult = getRangePenalty(optimalRange, rangeBand);
  const hydraulicMult = calculateHydraulicBonus(Number(attacker.robot.hydraulicSystems ?? 0), rangeBand);

  const backstabResult = checkBackstab(
    { position: attacker.position, facingDirection: attacker.facingDirection, gyroStabilizers: Number(attacker.robot.gyroStabilizers ?? 1), threatAnalysis: Number(attacker.robot.threatAnalysis ?? 1) },
    { position: defender.position, facingDirection: defender.facingDirection, gyroStabilizers: Number(defender.robot.gyroStabilizers ?? 1), threatAnalysis: Number(defender.robot.threatAnalysis ?? 1) },
  );

  const adaptation = getEffectiveAdaptation({
    adaptiveAI: Number(attacker.robot.adaptiveAI ?? 1),
    adaptationHitBonus: attacker.adaptationHitBonus,
    adaptationDamageBonus: attacker.adaptationDamageBonus,
    currentHP: attacker.currentHP,
    maxHP: attacker.maxHP,
  });

  const pressure = calculatePressureEffects({
    logicCores: Number(attacker.robot.logicCores ?? 1),
    currentHP: attacker.currentHP,
    maxHP: attacker.maxHP,
  });

  const syncBonus = checkSyncVolley(attacker, currentTime);
  const formationBonus = getFormationDefenseBonus(defender, arena);

  return {
    distance: dist,
    rangeBand,
    rangePenaltyMult,
    hydraulicMult,
    backstabBonus: backstabResult.bonus,
    adaptationHit: adaptation.hitBonus,
    adaptationDmg: adaptation.damageBonus,
    pressureAccuracy: pressure.accuracyMod,
    pressureDamage: pressure.damageMod,
    combatAlgorithmScore: attacker.combatAlgorithmScore,
    syncVolleyBonus: syncBonus,
    formationDefenseBonus: formationBonus,
    positionSnapshot: buildPositionSnapshot(...allStates),
    isBackstab: backstabResult.isBackstab,
    attackAngle: backstabResult.angle,
  };
}


/**
 * Unified N-robot battle simulator with full spatial mechanics.
 *
 * Handles any number of robots (1v1, FFA, KotH, battle royale, etc.)
 * using the complete 7-phase tick loop with all 23 robot attributes.
 *
 * Game mode-specific behavior (zone scoring, custom targeting, win conditions)
 * is injected via the optional GameModeConfig/GameModeState in BattleConfig.
 *
 * @param robots Array of robots to fight (N >= 2)
 * @param config Battle configuration (draw rules, duration, game mode hooks)
 * @returns SpatialCombatResult with full arena metadata
 */
export function simulateBattleMulti(
  robots: RobotWithWeapons[],
  config: BattleConfig = { allowDraws: true },
): SpatialCombatResult {
  const n = robots.length;
  if (n < 2) throw new Error('simulateBattleMulti requires at least 2 robots');

  const maxDuration = config.gameModeConfig?.maxDuration ?? config.maxDuration ?? MAX_BATTLE_DURATION;
  const gameModeConfig = config.gameModeConfig;
  const gameModeState = config.gameModeState;

  // === 1. Arena setup ===
  const teamSizes = robots.map(() => 1); // Each robot is its own "team" for FFA/KotH
  const arena = createArena(teamSizes, config.arenaRadius);
  if (gameModeConfig?.arenaZones) {
    arena.zones = gameModeConfig.arenaZones;
  }

  // For N>2 FFA/KotH: override spawn positions to distribute evenly around perimeter
  if (n > 2) {
    const spawnDistance = arena.radius - 2;
    const angleStep = (2 * Math.PI) / n;
    arena.spawnPositions = [];
    for (let i = 0; i < n; i++) {
      const angle = i * angleStep;
      arena.spawnPositions.push({
        x: Math.round(spawnDistance * Math.cos(angle) * 1000) / 1000,
        y: Math.round(spawnDistance * Math.sin(angle) * 1000) / 1000,
      });
    }
  }

  // === 2. Initialize combat states ===
  const states: SpatialRobotCombatState[] = robots.map((robot, i) => {
    const spawn = arena.spawnPositions[i] ?? { x: 0, y: 0 };
    const facingTarget = n === 2
      ? (arena.spawnPositions[1 - i] ?? arena.center)
      : arena.center;
    const mainCd = calcCooldown(robot, robot.mainWeapon?.weapon?.cooldown, 'main');
    const offCd = calcCooldown(robot, robot.offhandWeapon?.weapon?.cooldown, 'offhand');
    return initializeCombatState(robot, spawn, facingTarget, i, mainCd, offCd);
  });

  // Record starting positions
  const startingPositions: Record<string, Position> = {};
  for (const s of states) {
    startingPositions[s.robot.name] = { x: s.position.x, y: s.position.y };
  }

  const rawEvents: SpatialCombatEvent[] = [];
  let currentTime = 0;
  let battleEnded = false;
  let winnerId: number | null = null;
  let winReason: string | undefined;

  // For N>2 battles, create a proxy that auto-injects robotHP/robotShield maps
  // on every event push, so all events (including those from performAttack) get enriched.
  const events: SpatialCombatEvent[] = n > 2
    ? new Proxy(rawEvents, {
        get(target, prop, receiver) {
          if (prop === 'push') {
            return (...args: SpatialCombatEvent[]): number => {
              const snapshot = buildHPShieldSnapshot(states);
              for (const evt of args) {
                evt.robotHP = snapshot.robotHP;
                evt.robotShield = snapshot.robotShield;
              }
              return target.push(...args);
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      })
    : rawEvents;

  // Movement event throttling per robot
  const lastMoveEventTime: number[] = states.map(() => 0);
  const lastMoveEventPos: Position[] = states.map(s => ({ x: s.position.x, y: s.position.y }));

  // Range band tracking per robot (for transition events)
  const lastRangeBandToTarget: Map<number, RangeBand> = new Map();

  // === 3. Battle start event ===
  const participantSummary = states.map(s => {
    const ws = getWeaponStatsSummary(s.robot);
    return `${s.robot.name} (${s.robot.stance}): ${s.currentHP}HP/${s.maxHP}HP, ${s.currentShield}S/${s.maxShield}S | ${ws} | Speed: ${s.movementSpeed.toFixed(1)}`;
  }).join('\n');

  events.push({
    timestamp: 0,
    type: 'attack',
    message: `⚔️ Battle commences! ${robots.map(r => r.name).join(' vs ')}`,
    robot1HP: states[0]?.currentHP ?? 0,
    robot2HP: states[1]?.currentHP ?? 0,
    robot1Shield: states[0]?.currentShield ?? 0,
    robot2Shield: states[1]?.currentShield ?? 0,
    formulaBreakdown: {
      calculation: participantSummary + `\nArena: radius ${arena.radius}`,
      components: { arenaRadius: arena.radius, participantCount: n },
      result: 0,
    },
    ...buildPositionSnapshot(...states),
  });

  // === 4. Main simulation loop ===
  while (currentTime < maxDuration && !battleEnded) {
    currentTime += SIMULATION_TICK;
    const aliveStates = states.filter(s => s.isAlive);
    if (aliveStates.length <= 1 && !gameModeConfig?.winCondition) {
      battleEnded = true;
      break;
    }

    // Sync states to gameModeState so movement/target modifiers can access all robots
    if (gameModeState?.customData) {
      (gameModeState.customData as Record<string, unknown>).robots = states;
    }

    // ── PHASE 1: MOVEMENT ──
    for (const state of aliveStates) {
      const opponents = states.filter(s => s !== state && s.isAlive);

      // No opponents: skip movement unless a game mode modifier can still direct us
      // (e.g. KotH last-standing phase needs the robot to move toward the zone)
      if (opponents.length === 0 && !gameModeConfig?.movementModifier) continue;

      // Select target via game mode strategy or default threat scoring
      let target: SpatialRobotCombatState | null = null;
      if (opponents.length > 0) {
        let targetIdx: number | null = null;
        if (gameModeConfig?.targetPriority) {
          const priorities = gameModeConfig.targetPriority.selectTargets(
            state, opponents, arena, gameModeState,
          );
          targetIdx = priorities.length > 0 ? priorities[0] : null;
        }
        if (targetIdx === null) {
          const threat = selectTarget(state, opponents, arena.radius);
          targetIdx = threat?.robotIndex ?? opponents[0].teamIndex;
        }
        state.currentTarget = targetIdx;
        target = states.find(s => s.teamIndex === targetIdx) ?? opponents[0];
      } else {
        state.currentTarget = null;
      }

      // Effective speed with servo strain
      const opponentMainWeapon = target?.robot.mainWeapon?.weapon;
      const hasRangedOpponent = opponentMainWeapon
        ? opponentMainWeapon.weaponType !== 'melee' && opponentMainWeapon.weaponType !== 'shield'
        : false;
      const hasMeleeWeapon = state.robot.mainWeapon?.weapon?.weaponType === 'melee';
      const distToTarget = target ? euclideanDistance(state.position, target.position) : 0;
      const servoState = {
        servoMotors: Number(state.robot.servoMotors ?? 1),
        servoStrain: state.servoStrain,
        sustainedMovementTime: state.sustainedMovementTime,
        isUsingClosingBonus: state.isUsingClosingBonus,
        stance: (state.robot.stance ?? 'balanced') as 'defensive' | 'offensive' | 'balanced',
        hasMeleeWeapon,
        distanceToTarget: distToTarget,
        currentSpeedRatio: 0,
      };
      const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(
        servoState, target?.effectiveMovementSpeed ?? 0, hasRangedOpponent,
      );
      state.effectiveMovementSpeed = effectiveSpeed;
      state.isUsingClosingBonus = isClosingBonus;

      // Movement intent (with optional game mode modifier)
      const intent = calculateMovementIntent(
        state, opponents, arena, gameModeConfig?.movementModifier, gameModeState,
      );
      state.movementIntent = intent;

      // Apply movement
      const oldPos = { x: state.position.x, y: state.position.y };
      const newPos = applyMovement(state, intent, arena, SIMULATION_TICK);
      state.position = newPos;
      state.velocity = {
        x: (newPos.x - oldPos.x) / SIMULATION_TICK,
        y: (newPos.y - oldPos.y) / SIMULATION_TICK,
      };

      // Servo strain update
      const actualMove = euclideanDistance(oldPos, newPos);
      const maxMove = effectiveSpeed * SIMULATION_TICK;
      servoState.currentSpeedRatio = maxMove > 0 ? actualMove / maxMove : 0;
      servoState.isUsingClosingBonus = state.isUsingClosingBonus;
      servoState.servoStrain = state.servoStrain;
      servoState.sustainedMovementTime = state.sustainedMovementTime;
      updateServoStrain(servoState, SIMULATION_TICK);
      state.servoStrain = servoState.servoStrain;
      state.sustainedMovementTime = servoState.sustainedMovementTime;
    }

    // ── PHASE 2: FACING ──
    for (const state of aliveStates) {
      if (state.currentTarget === null) continue;
      const target = states.find(s => s.teamIndex === state.currentTarget);
      if (!target) continue;
      const turnSpeed = calculateTurnSpeed(Number(state.robot.gyroStabilizers ?? 1));
      const facingState = {
        position: state.position,
        facingDirection: state.facingDirection,
        turnSpeed,
      };
      const opponentState = { position: target.position, velocity: target.velocity };
      updateFacing(
        facingState, target.position, SIMULATION_TICK,
        opponentState, Number(state.robot.threatAnalysis ?? 1),
      );
      state.facingDirection = facingState.facingDirection;
    }

    // ── Emit range transition events (per robot → target pair) ──
    for (const state of aliveStates) {
      if (state.currentTarget === null) continue;
      const target = states.find(s => s.teamIndex === state.currentTarget);
      if (!target) continue;
      const dist = euclideanDistance(state.position, target.position);
      const currentBand = classifyRangeBand(dist);
      const prevBand = lastRangeBandToTarget.get(state.teamIndex);
      if (prevBand !== undefined && currentBand !== prevBand) {
        const closingOrFalling = dist < euclideanDistance(
          lastMoveEventPos[state.teamIndex], target.position,
        ) ? 'closes to' : 'falls back to';
        events.push({
          timestamp: Number(currentTime.toFixed(1)),
          type: 'range_transition',
          attacker: state.robot.name,
          defender: target.robot.name,
          message: `📏 Combat ${closingOrFalling} ${currentBand} range (${dist.toFixed(1)} units)`,
          robot1HP: states[0]?.currentHP ?? 0,
          robot2HP: states[1]?.currentHP ?? 0,
          robot1Shield: states[0]?.currentShield ?? 0,
          robot2Shield: states[1]?.currentShield ?? 0,
          ...buildPositionSnapshot(...states),
          distance: dist,
          rangeBand: currentBand,
        });
      }
      lastRangeBandToTarget.set(state.teamIndex, currentBand);
    }

    // ── PHASE 3: ATTACKS (range-gated, per robot) ──
    const attackedThisTick: Set<number> = new Set();

    for (const state of aliveStates) {
      if (state.currentTarget === null) continue;
      let target = states.find(s => s.teamIndex === state.currentTarget);
      if (!target || !target.isAlive) continue;

      let dist = euclideanDistance(state.position, target.position);
      let didAttack = false;

      // Main weapon attack
      if (currentTime - state.lastAttackTime >= state.attackCooldown
          && state.currentHP > 0 && state.isAlive) {
        const weapon = state.robot.mainWeapon?.weapon;
        const weaponLike: WeaponLike | null = weapon
          ? { name: weapon.name, rangeBand: weapon.rangeBand as RangeBand }
          : null;
        const patienceLimit = getPatienceLimit(state.combatAlgorithmScore);
        const forceAttack = state.patienceTimer >= patienceLimit;

        // Target-of-opportunity: if melee weapon can't reach primary target,
        // find the nearest in-range opponent to attack instead (FFA/KotH only)
        if (weaponLike && !canAttack(weaponLike, dist) && !forceAttack && n > 2) {
          const nearestInRange = states
            .filter(s => s !== state && s.isAlive && s.teamIndex !== state.teamIndex)
            .map(s => ({ state: s, dist: euclideanDistance(state.position, s.position) }))
            .filter(({ dist: d }) => canAttack(weaponLike, d))
            .sort((a, b) => a.dist - b.dist)[0];
          if (nearestInRange) {
            target = nearestInRange.state;
            dist = nearestInRange.dist;
          }
        }

        if (!weaponLike || canAttack(weaponLike, dist) || forceAttack) {
          const ctx = buildSpatialContext(state, target, 'main', currentTime, arena, states);
          performAttack(
            state, target, state.robot.name, target.robot.name,
            currentTime, 'main', events, ctx,
          );
          state.lastAttackTime = currentTime;
          state.patienceTimer = 0;
          didAttack = true;
        } else {
          events.push({
            timestamp: Number(currentTime.toFixed(1)),
            type: 'out_of_range',
            attacker: state.robot.name,
            defender: target.robot.name,
            weapon: weaponLike.name,
            message: `🚫 ${state.robot.name}'s ${weaponLike.name} can't reach ${target.robot.name} at ${dist.toFixed(1)} units (need ≤2)`,
            robot1HP: states[0]?.currentHP ?? 0,
            robot2HP: states[1]?.currentHP ?? 0,
            robot1Shield: states[0]?.currentShield ?? 0,
            robot2Shield: states[1]?.currentShield ?? 0,
            ...buildPositionSnapshot(...states),
            distance: dist,
            rangeBand: classifyRangeBand(dist),
          });
        }
      }

      // Offhand attack (dual wield)
      if (state.robot.loadoutType === 'dual_wield'
          && state.robot.offhandWeapon?.weapon
          && currentTime - state.lastOffhandAttackTime >= state.offhandCooldown
          && state.currentHP > 0 && state.isAlive) {
        const offWeapon = state.robot.offhandWeapon.weapon;
        const offWeaponLike: WeaponLike = {
          name: offWeapon.name,
          rangeBand: offWeapon.rangeBand as RangeBand,
        };
        const patienceLimit = getPatienceLimit(state.combatAlgorithmScore);

        // Target-of-opportunity for offhand melee weapon in FFA/KotH
        let offTarget = target;
        let offDist = dist;
        if (!canAttack(offWeaponLike, offDist) && !(state.patienceTimer >= patienceLimit) && n > 2) {
          const nearestInRange = states
            .filter(s => s !== state && s.isAlive && s.teamIndex !== state.teamIndex)
            .map(s => ({ state: s, dist: euclideanDistance(state.position, s.position) }))
            .filter(({ dist: d }) => canAttack(offWeaponLike, d))
            .sort((a, b) => a.dist - b.dist)[0];
          if (nearestInRange) {
            offTarget = nearestInRange.state;
            offDist = nearestInRange.dist;
          }
        }

        if (canAttack(offWeaponLike, offDist) || state.patienceTimer >= patienceLimit) {
          const ctx = buildSpatialContext(state, offTarget, 'offhand', currentTime, arena, states);
          performAttack(
            state, offTarget, state.robot.name, offTarget.robot.name,
            currentTime, 'offhand', events, ctx,
          );
          state.lastOffhandAttackTime = currentTime;
          state.patienceTimer = 0;
          didAttack = true;
        }
      }

      if (didAttack) attackedThisTick.add(state.teamIndex);
    }

    // Update patience timers for robots that didn't attack
    for (const state of aliveStates) {
      if (!attackedThisTick.has(state.teamIndex)) {
        state.patienceTimer += SIMULATION_TICK;
      }
    }

    // ── PHASE 5: SHIELD REGEN ──
    for (const state of aliveStates) {
      const supportBoost = getSupportShieldBoost(state);
      const shieldBefore = state.currentShield;
      regenerateShields(state, SIMULATION_TICK, supportBoost);
      if (state.maxShield > 0 && shieldBefore < state.currentShield) {
        const oldPct = Math.floor((shieldBefore / state.maxShield) * 4);
        const newPct = Math.floor((state.currentShield / state.maxShield) * 4);
        if (newPct > oldPct) {
          events.push({
            timestamp: Number(currentTime.toFixed(1)),
            type: 'shield_regen',
            attacker: state.robot.name,
            robot1HP: states[0]?.currentHP ?? 0,
            robot2HP: states[1]?.currentHP ?? 0,
            robot1Shield: states[0]?.currentShield ?? 0,
            robot2Shield: states[1]?.currentShield ?? 0,
            message: `🛡️⚡ ${state.robot.name}'s shields regenerate to ${Math.round((state.currentShield / state.maxShield) * 100)}%`,
            ...buildPositionSnapshot(...states),
          });
        }
      }
    }

    // ── PHASE 6: STATE CHECKS ──
    for (const state of states) {
      if (!state.isAlive) continue;
      if (state.currentHP <= 0) {
        state.isAlive = false;
        events.push({
          timestamp: Number(currentTime.toFixed(1)),
          type: 'destroyed',
          message: `💀 ${state.robot.name} destroyed!`,
          robot1HP: states[0]?.currentHP ?? 0,
          robot2HP: states[1]?.currentHP ?? 0,
          robot1Shield: states[0]?.currentShield ?? 0,
          robot2Shield: states[1]?.currentShield ?? 0,
          ...buildPositionSnapshot(...states),
        });
      } else if (shouldYield(state)) {
        state.isAlive = false;
        events.push({
          timestamp: Number(currentTime.toFixed(1)),
          type: 'yield',
          message: `🏳️ ${state.robot.name} yields at ${((state.currentHP / state.maxHP) * 100).toFixed(0)}% HP!`,
          robot1HP: states[0]?.currentHP ?? 0,
          robot2HP: states[1]?.currentHP ?? 0,
          robot1Shield: states[0]?.currentShield ?? 0,
          robot2Shield: states[1]?.currentShield ?? 0,
          ...buildPositionSnapshot(...states),
        });
      }
    }

    // Update pressure state for all robots
    for (const state of states) {
      state.isUnderPressure = (state.currentHP / state.maxHP) * 100 < state.pressureThreshold;
    }

    // ── Game mode per-tick hooks (zone scoring, passive penalties, zone rotation) ──
    // Runs BEFORE win condition check so scores are current when evaluated.
    if (gameModeState?.customData && !battleEnded) {
      const tickHook = gameModeState.customData.tickHook as
        ((st: SpatialRobotCombatState[], t: number, dt: number, ev: SpatialCombatEvent[], ar: ArenaConfig) => void) | undefined;
      if (tickHook) {
        tickHook(states, currentTime, SIMULATION_TICK, events, arena);
      }
    }

    // Game mode win condition check (KotH score threshold, last-standing, time limit, etc.)
    if (gameModeConfig?.winCondition && !battleEnded) {
      const teams = states.map(s => [s]); // Each robot is its own team for FFA
      const result = gameModeConfig.winCondition.evaluate(teams, currentTime, gameModeState);
      if (result?.ended) {
        winnerId = result.winnerId;
        winReason = result.reason;
        battleEnded = true;
        // Retrieve any events the win condition evaluator stored on gameState
        const wcEvents = gameModeState?.customData?.pendingEvents as SpatialCombatEvent[] | undefined;
        if (wcEvents?.length) {
          events.push(...wcEvents);
          (gameModeState!.customData as Record<string, unknown>).pendingEvents = [];
        }
      }
    }

    // Default elimination check: if only 1 robot alive and no custom win condition, they win
    if (!battleEnded) {
      const alive = states.filter(s => s.isAlive);
      if (alive.length <= 1 && !gameModeConfig?.winCondition) {
        if (alive.length === 1) {
          winnerId = alive[0].robot.id;
          battleEnded = true;
          events.push({
            timestamp: Number(currentTime.toFixed(1)),
            type: 'destroyed',
            message: `🏆 ${alive[0].robot.name} wins!`,
            robot1HP: states[0]?.currentHP ?? 0,
            robot2HP: states[1]?.currentHP ?? 0,
            robot1Shield: states[0]?.currentShield ?? 0,
            robot2Shield: states[1]?.currentShield ?? 0,
            ...buildPositionSnapshot(...states),
          });
        } else if (alive.length === 0 && !config.allowDraws) {
          // Mutual destruction/yield: use HP tiebreaker (highest HP% wins)
          const sorted = [...states].sort((a, b) => (b.currentHP / b.maxHP) - (a.currentHP / a.maxHP));
          winnerId = sorted[0].robot.id;
          battleEnded = true;
          const pct = ((sorted[0].currentHP / sorted[0].maxHP) * 100).toFixed(1);
          events.push({
            timestamp: Number(currentTime.toFixed(1)),
            type: 'yield',
            message: `⚔️ Mutual takedown! ${sorted[0].robot.name} wins by HP tiebreaker (${pct}%)`,
            robot1HP: states[0]?.currentHP ?? 0,
            robot2HP: states[1]?.currentHP ?? 0,
            robot1Shield: states[0]?.currentShield ?? 0,
            robot2Shield: states[1]?.currentShield ?? 0,
            ...buildPositionSnapshot(...states),
          });
        } else {
          // All eliminated and draws allowed — draw
          winnerId = null;
          battleEnded = true;
        }
      }
    }

    // ── PHASE 7: POSITION SNAPSHOTS (throttled movement events) ──
    if (!battleEnded) {
      for (let i = 0; i < states.length; i++) {
        const state = states[i];
        if (!state.isAlive) continue;
        const moveDist = euclideanDistance(state.position, lastMoveEventPos[i]);
        const moveTime = currentTime - lastMoveEventTime[i];
        if ((moveDist >= MOVEMENT_EVENT_THRESHOLD || moveTime >= MOVEMENT_EVENT_MIN_INTERVAL)
            && moveDist > 0.01) {
          const nearestOpp = states
            .filter(s => s !== state && s.isAlive)
            .sort((a, b) =>
              euclideanDistance(state.position, a.position) - euclideanDistance(state.position, b.position),
            )[0];
          const distToNearest = nearestOpp
            ? euclideanDistance(state.position, nearestOpp.position) : 0;
          events.push({
            timestamp: Number(currentTime.toFixed(1)),
            type: 'movement',
            attacker: state.robot.name,
            defender: nearestOpp?.robot.name,
            message: `🏃 ${state.robot.name} moves to (${state.position.x.toFixed(1)}, ${state.position.y.toFixed(1)})${nearestOpp ? ` — ${distToNearest.toFixed(1)} units from ${nearestOpp.robot.name}` : ''}`,
            robot1HP: states[0]?.currentHP ?? 0,
            robot2HP: states[1]?.currentHP ?? 0,
            robot1Shield: states[0]?.currentShield ?? 0,
            robot2Shield: states[1]?.currentShield ?? 0,
            ...buildPositionSnapshot(...states),
            distance: distToNearest,
            rangeBand: classifyRangeBand(distToNearest),
          });
          lastMoveEventTime[i] = currentTime;
          lastMoveEventPos[i] = { x: state.position.x, y: state.position.y };
        }
      }
    }
  } // end main loop

  // === 5. Time limit handling ===
  if (!battleEnded) {
    if (!config.allowDraws) {
      // HP tiebreaker — highest HP% wins
      const alive = states.filter(s => s.isAlive);
      alive.sort((a, b) => (b.currentHP / b.maxHP) - (a.currentHP / a.maxHP));
      if (alive.length > 0) {
        winnerId = alive[0].robot.id;
        const pct = ((alive[0].currentHP / alive[0].maxHP) * 100).toFixed(1);
        events.push({
          timestamp: Number(currentTime.toFixed(1)),
          type: 'yield',
          message: `⏱️ Time limit! ${alive[0].robot.name} wins by HP (${pct}%)`,
          robot1HP: states[0]?.currentHP ?? 0,
          robot2HP: states[1]?.currentHP ?? 0,
          robot1Shield: states[0]?.currentShield ?? 0,
          robot2Shield: states[1]?.currentShield ?? 0,
          ...buildPositionSnapshot(...states),
        });
      }
    } else {
      events.push({
        timestamp: Number(currentTime.toFixed(1)),
        type: 'yield',
        message: `⏱️ Time limit reached - Draw!`,
        robot1HP: states[0]?.currentHP ?? 0,
        robot2HP: states[1]?.currentHP ?? 0,
        robot1Shield: states[0]?.currentShield ?? 0,
        robot2Shield: states[1]?.currentShield ?? 0,
        ...buildPositionSnapshot(...states),
      });
    }
  }

  // === 6. Build result ===
  const endingPositions: Record<string, Position> = {};
  for (const s of states) {
    endingPositions[s.robot.name] = { x: s.position.x, y: s.position.y };
  }

  // Build kothMetadata if game mode state has zone scores
  let kothMetadata: SpatialCombatResult['kothMetadata'];
  if (gameModeState?.mode === 'zone_control' && gameModeState.zoneScores) {
    const scoreState = gameModeState.customData?.scoreState as {
      zoneOccupationTimes?: Record<number, number>;
      uncontestedTimes?: Record<number, number>;
      zoneEntries?: Record<number, number>;
      zoneExits?: Record<number, number>;
      killCounts?: Record<number, number>;
    } | undefined;
    kothMetadata = {
      finalZoneScores: { ...gameModeState.zoneScores },
      zoneOccupationTimes: scoreState?.zoneOccupationTimes ? { ...scoreState.zoneOccupationTimes } : undefined,
      uncontestedTimes: scoreState?.uncontestedTimes ? { ...scoreState.uncontestedTimes } : undefined,
      zoneEntries: scoreState?.zoneEntries ? { ...scoreState.zoneEntries } : undefined,
      zoneExits: scoreState?.zoneExits ? { ...scoreState.zoneExits } : undefined,
      killCounts: scoreState?.killCounts ? { ...scoreState.killCounts } : undefined,
      matchDuration: Number(currentTime.toFixed(1)),
      winReason,
    };
  }

  return {
    winnerId,
    robot1FinalHP: Math.max(0, states[0]?.currentHP ?? 0),
    robot2FinalHP: Math.max(0, states[1]?.currentHP ?? 0),
    robot1FinalShield: states[0]?.currentShield ?? 0,
    robot2FinalShield: states[1]?.currentShield ?? 0,
    robot1Damage: states[0]?.totalDamageTaken ?? 0,
    robot2Damage: states[1]?.totalDamageTaken ?? 0,
    robot1DamageDealt: states[0]?.totalDamageDealt ?? 0,
    robot2DamageDealt: states[1]?.totalDamageDealt ?? 0,
    durationSeconds: Number(currentTime.toFixed(1)),
    isDraw: winnerId === null,
    events: rawEvents,
    arenaRadius: arena.radius,
    startingPositions,
    endingPositions,
    kothMetadata,
    finalStates: states,
  };
}


/**
 * Backward-compatible 1v1 battle simulator.
 *
 * Delegates to simulateBattleMulti() with 2 robots.
 * Preserves the exact same signature and return shape used by
 * league, tournament, and tag team orchestrators.
 *
 * @param robot1 First robot
 * @param robot2 Second robot
 * @param isTournament If true, resolves draws with HP tiebreaker
 */
export function simulateBattle(
  robot1: RobotWithWeapons,
  robot2: RobotWithWeapons,
  isTournament: boolean = false,
): CombatResult {
  const result = simulateBattleMulti([robot1, robot2], {
    allowDraws: !isTournament,
  });

  // Map SpatialCombatResult back to the legacy CombatResult shape
  return {
    winnerId: result.winnerId,
    robot1FinalHP: result.robot1FinalHP,
    robot2FinalHP: result.robot2FinalHP,
    robot1FinalShield: result.robot1FinalShield,
    robot2FinalShield: result.robot2FinalShield,
    robot1Damage: result.robot1Damage,
    robot2Damage: result.robot2Damage,
    robot1DamageDealt: result.robot1DamageDealt,
    robot2DamageDealt: result.robot2DamageDealt,
    durationSeconds: result.durationSeconds,
    isDraw: result.isDraw,
    events: result.events,
    arenaRadius: result.arenaRadius,
    startingPositions: result.startingPositions,
    endingPositions: result.endingPositions,
  };
}
