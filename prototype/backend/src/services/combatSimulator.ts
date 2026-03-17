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
import { selectTarget as _selectTarget } from './arena/threatScoring';
import {
  RobotCombatState as SpatialRobotCombatState,
  CombatEvent as _SpatialCombatEvent,
  CombatResult as _SpatialCombatResult,
  RangeBand,
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
    | 'movement' | 'range_transition' | 'out_of_range' | 'counter_out_of_range' | 'backstab' | 'flanking';
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
}

const BASE_WEAPON_COOLDOWN = 4; // seconds
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
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get random value between min and max
 */
function random(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Get effective attribute value including weapon bonuses
 */
function getEffectiveAttribute(
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
function calculateHitChance(
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
function calculateCritChance(attacker: RobotWithWeapons, attackerHand: 'main' | 'offhand' = 'main'): { critChance: number; breakdown: FormulaBreakdown } {
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
function calculateMalfunctionChance(attacker: RobotWithWeapons, attackerHand: 'main' | 'offhand' = 'main'): { malfunctionChance: number; breakdown: FormulaBreakdown } {
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
function calculateBaseDamage(
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
function applyDamage(
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
function getWeaponInfo(robot: RobotWithWeapons, hand: 'main' | 'offhand'): { name: string; baseDamage: number } {
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
function getWeaponBonusesSummary(robot: RobotWithWeapons): string {
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
  state1: SpatialRobotCombatState,
  state2: SpatialRobotCombatState
): { positions: Record<string, Position>; facingDirections: Record<string, number> } {
  return {
    positions: {
      [state1.robot.name]: { x: state1.position.x, y: state1.position.y },
      [state2.robot.name]: { x: state2.position.x, y: state2.position.y },
    },
    facingDirections: {
      [state1.robot.name]: state1.facingDirection,
      [state2.robot.name]: state2.facingDirection,
    },
  };
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

    attackerState.totalDamageDealt += hpDamage;
    defenderState.totalDamageTaken += hpDamage;

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

    defenderState.totalDamageDealt += counterHP;
    attackerState.totalDamageTaken += counterHP;

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
  opponentPosition: Position,
  teamIndex: number,
  attackCooldown: number,
  offhandCooldown: number,
): SpatialRobotCombatState {
  const servoMotors = Number(robot.servoMotors ?? 1);
  const baseSpeed = calculateBaseSpeed(servoMotors);
  const combatAlgorithms = Number(robot.combatAlgorithms ?? 1);
  const facingDirection = angleBetween(spawnPosition, opponentPosition);

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
 * Simulate a complete battle between two robots with 2D spatial mechanics.
 * @param robot1 First robot
 * @param robot2 Second robot
 * @param isTournament If true, resolves draws with HP tiebreaker
 */
export function simulateBattle(
  robot1: RobotWithWeapons,
  robot2: RobotWithWeapons,
  isTournament: boolean = false
): CombatResult {
  // === 1. Arena setup ===
  const arena = createArena([1, 1]);
  const spawn1 = arena.spawnPositions[0];
  const spawn2 = arena.spawnPositions[1];

  // === 2. Weapon cooldowns ===
  const mainWeapon1 = robot1.mainWeapon?.weapon;
  const offhandWeapon1 = robot1.offhandWeapon?.weapon;
  const mainWeapon2 = robot2.mainWeapon?.weapon;
  const offhandWeapon2 = robot2.offhandWeapon?.weapon;

  const calcCooldown = (robot: RobotWithWeapons, weaponCooldown: number | undefined, hand: 'main' | 'offhand'): number => {
    const baseCooldown = weaponCooldown || BASE_WEAPON_COOLDOWN;
    const cooldownWithPenalty = hand === 'offhand' ? baseCooldown * 1.4 : baseCooldown;
    const effectiveAttackSpeed = getEffectiveAttribute(robot, robot.attackSpeed, hand, 'attackSpeedBonus');
    return cooldownWithPenalty / (1 + Number(effectiveAttackSpeed) / 50);
  };


  // === 3. Initialize extended combat states ===
  const state1 = initializeCombatState(
    robot1, spawn1, spawn2, 0,
    calcCooldown(robot1, mainWeapon1?.cooldown, 'main'),
    calcCooldown(robot1, offhandWeapon1?.cooldown, 'offhand'),
  );
  const state2 = initializeCombatState(
    robot2, spawn2, spawn1, 1,
    calcCooldown(robot2, mainWeapon2?.cooldown, 'main'),
    calcCooldown(robot2, offhandWeapon2?.cooldown, 'offhand'),
  );

  // Record starting positions
  const startingPositions: Record<string, Position> = {
    [robot1.name]: { x: spawn1.x, y: spawn1.y },
    [robot2.name]: { x: spawn2.x, y: spawn2.y },
  };

  const events: CombatEvent[] = [];
  let currentTime = 0;
  let battleEnded = false;
  let winnerId: number | null = null;

  // Movement event throttling state
  let lastMoveEventTime1 = 0;
  let lastMoveEventPos1: Position = { x: spawn1.x, y: spawn1.y };
  let lastMoveEventTime2 = 0;
  let lastMoveEventPos2: Position = { x: spawn2.x, y: spawn2.y };

  // Range band tracking for transition events
  let lastRangeBand: RangeBand = classifyRangeBand(euclideanDistance(spawn1, spawn2));


  // === 4. Battle start event ===
  const weaponStats1 = getWeaponStatsSummary(robot1);
  const weaponStats2 = getWeaponStatsSummary(robot2);
  const weaponBonuses1 = getWeaponBonusesSummary(robot1);
  const weaponBonuses2 = getWeaponBonusesSummary(robot2);
  const initDist = euclideanDistance(spawn1, spawn2);

  events.push({
    timestamp: 0,
    type: 'attack',
    message: `⚔️ Battle commences! ${robot1.name} (${robot1.stance}) vs ${robot2.name} (${robot2.stance})`,
    robot1HP: state1.currentHP,
    robot2HP: state2.currentHP,
    robot1Shield: state1.currentShield,
    robot2Shield: state2.currentShield,
    formulaBreakdown: {
      calculation: `${robot1.name}: ${state1.currentHP}HP / ${state1.maxHP}HP, ${state1.currentShield}S / ${state1.maxShield}S
Weapons: ${weaponStats1}
Main CD: ${state1.attackCooldown.toFixed(2)}s${robot1.loadoutType === 'dual_wield' && offhandWeapon1 ? `, Offhand CD: ${state1.offhandCooldown.toFixed(2)}s (40% penalty applied)` : ''}
Speed: ${state1.movementSpeed.toFixed(1)} units/s
Weapon Attribute Bonuses:
${weaponBonuses1}

${robot2.name}: ${state2.currentHP}HP / ${state2.maxHP}HP, ${state2.currentShield}S / ${state2.maxShield}S
Weapons: ${weaponStats2}
Main CD: ${state2.attackCooldown.toFixed(2)}s${robot2.loadoutType === 'dual_wield' && offhandWeapon2 ? `, Offhand CD: ${state2.offhandCooldown.toFixed(2)}s (40% penalty applied)` : ''}
Speed: ${state2.movementSpeed.toFixed(1)} units/s
Weapon Attribute Bonuses:
${weaponBonuses2}

Arena: radius ${arena.radius}, starting distance ${initDist.toFixed(1)} units (${classifyRangeBand(initDist)} range)`,
      components: {
        robot1_hp: state1.currentHP,
        robot1_max_hp: state1.maxHP,
        robot1_shield: state1.currentShield,
        robot1_max_shield: state1.maxShield,
        robot1_main_cooldown: state1.attackCooldown,
        robot1_offhand_cooldown: state1.offhandCooldown,
        robot1_speed: state1.movementSpeed,
        robot2_hp: state2.currentHP,
        robot2_max_hp: state2.maxHP,
        robot2_shield: state2.currentShield,
        robot2_max_shield: state2.maxShield,
        robot2_main_cooldown: state2.attackCooldown,
        robot2_offhand_cooldown: state2.offhandCooldown,
        robot2_speed: state2.movementSpeed,
        arenaRadius: arena.radius,
        startingDistance: initDist,
      },
      result: 0,
    },
    positions: startingPositions,
    facingDirections: {
      [robot1.name]: state1.facingDirection,
      [robot2.name]: state2.facingDirection,
    },
    distance: initDist,
    rangeBand: classifyRangeBand(initDist),
  });


  // === 5. Main simulation loop ===
  while (currentTime < MAX_BATTLE_DURATION && !battleEnded) {
    currentTime += SIMULATION_TICK;

    // ── PHASE 1: MOVEMENT ──
    // Calculate movement intent and apply movement for each robot
    for (const [state, opponent] of [[state1, state2], [state2, state1]] as [SpatialRobotCombatState, SpatialRobotCombatState][]) {
      if (!state.isAlive) continue;

      // Determine if opponent has ranged weapon (for closing bonus)
      const opponentMainWeapon = opponent.robot.mainWeapon?.weapon;
      const hasRangedOpponent = opponentMainWeapon
        ? opponentMainWeapon.weaponType !== 'melee' && opponentMainWeapon.weaponType !== 'shield'
        : false;

      // Calculate effective speed with servo strain
      const hasMeleeWeapon = state.robot.mainWeapon?.weapon?.weaponType === 'melee';
      const distToOpponent = euclideanDistance(state.position, opponent.position);
      const servoState = {
        servoMotors: Number(state.robot.servoMotors ?? 1),
        servoStrain: state.servoStrain,
        sustainedMovementTime: state.sustainedMovementTime,
        isUsingClosingBonus: state.isUsingClosingBonus,
        stance: (state.robot.stance ?? 'balanced') as 'defensive' | 'offensive' | 'balanced',
        hasMeleeWeapon,
        distanceToTarget: distToOpponent,
        currentSpeedRatio: 0, // Will be updated after movement
      };

      const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(
        servoState, opponent.effectiveMovementSpeed, hasRangedOpponent
      );
      state.effectiveMovementSpeed = effectiveSpeed;
      state.isUsingClosingBonus = isClosingBonus;

      // Calculate movement intent
      state.currentTarget = opponent.teamIndex;
      const intent = calculateMovementIntent(state, [opponent], arena);
      state.movementIntent = intent;

      // Apply movement
      const oldPos = { x: state.position.x, y: state.position.y };
      const newPos = applyMovement(state, intent, arena, SIMULATION_TICK);
      state.position = newPos;

      // Calculate velocity for prediction
      state.velocity = {
        x: (newPos.x - oldPos.x) / SIMULATION_TICK,
        y: (newPos.y - oldPos.y) / SIMULATION_TICK,
      };

      // Update speed ratio for servo strain
      const actualMove = euclideanDistance(oldPos, newPos);
      const maxMove = effectiveSpeed * SIMULATION_TICK;
      servoState.currentSpeedRatio = maxMove > 0 ? actualMove / maxMove : 0;
      servoState.isUsingClosingBonus = state.isUsingClosingBonus;
      servoState.servoStrain = state.servoStrain;
      servoState.sustainedMovementTime = state.sustainedMovementTime;

      // Update servo strain
      updateServoStrain(servoState, SIMULATION_TICK);
      state.servoStrain = servoState.servoStrain;
      state.sustainedMovementTime = servoState.sustainedMovementTime;
    }


    // ── PHASE 2: FACING ──
    const distance = euclideanDistance(state1.position, state2.position);
    const currentRangeBand = classifyRangeBand(distance);

    if (state1.isAlive) {
      const turnSpeed1 = calculateTurnSpeed(Number(state1.robot.gyroStabilizers ?? 1));
      const facingState1 = { position: state1.position, facingDirection: state1.facingDirection, turnSpeed: turnSpeed1 };
      const opponentState1 = { position: state2.position, velocity: state2.velocity };
      updateFacing(facingState1, state2.position, SIMULATION_TICK, opponentState1, Number(state1.robot.threatAnalysis ?? 1));
      state1.facingDirection = facingState1.facingDirection;
    }

    if (state2.isAlive) {
      const turnSpeed2 = calculateTurnSpeed(Number(state2.robot.gyroStabilizers ?? 1));
      const facingState2 = { position: state2.position, facingDirection: state2.facingDirection, turnSpeed: turnSpeed2 };
      const opponentState2 = { position: state1.position, velocity: state1.velocity };
      updateFacing(facingState2, state1.position, SIMULATION_TICK, opponentState2, Number(state2.robot.threatAnalysis ?? 1));
      state2.facingDirection = facingState2.facingDirection;
    }

    // ── Emit range transition events ──
    if (currentRangeBand !== lastRangeBand) {
      const closingOrFalling = distance < euclideanDistance(lastMoveEventPos1, lastMoveEventPos2)
        ? 'closes to' : 'falls back to';
      events.push({
        timestamp: Number(currentTime.toFixed(1)),
        type: 'range_transition',
        attacker: robot1.name,
        defender: robot2.name,
        message: `📏 Combat ${closingOrFalling} ${currentRangeBand} range (${distance.toFixed(1)} units)`,
        robot1HP: state1.currentHP,
        robot2HP: state2.currentHP,
        robot1Shield: state1.currentShield,
        robot2Shield: state2.currentShield,
        ...buildPositionSnapshot(state1, state2),
        distance,
        rangeBand: currentRangeBand,
      });
      lastRangeBand = currentRangeBand;
    }


    // ── PHASE 3: ATTACKS (range-gated) ──
    const posSnapshot = buildPositionSnapshot(state1, state2);

    // Helper to build spatial context for an attack
    const buildSpatialContext = (
      attacker: SpatialRobotCombatState,
      defender: SpatialRobotCombatState,
      hand: 'main' | 'offhand',
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
    } => {
      const weapon = hand === 'main' ? attacker.robot.mainWeapon?.weapon : attacker.robot.offhandWeapon?.weapon;
      const weaponLike: WeaponLike | null = weapon ? { weaponType: weapon.weaponType, handsRequired: weapon.handsRequired, name: weapon.name } : null;
      const optimalRange = weaponLike ? getWeaponOptimalRange(weaponLike) : 'short';
      const rangePenaltyMult = getRangePenalty(optimalRange, currentRangeBand);
      const hydraulicMult = calculateHydraulicBonus(Number(attacker.robot.hydraulicSystems ?? 0), currentRangeBand);

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
        distance,
        rangeBand: currentRangeBand,
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
        positionSnapshot: posSnapshot,
        isBackstab: backstabResult.isBackstab,
        attackAngle: backstabResult.angle,
      };
    };

    // Robot 1 main weapon attack
    let robot1AttackedThisTick = false;
    if (currentTime - state1.lastAttackTime >= state1.attackCooldown && state1.currentHP > 0 && state1.isAlive) {
      const weapon1 = robot1.mainWeapon?.weapon;
      const weaponLike1: WeaponLike | null = weapon1 ? { weaponType: weapon1.weaponType, handsRequired: weapon1.handsRequired, name: weapon1.name } : null;

      // Check patience timer — force attack even if out of range
      const patienceLimit = getPatienceLimit(state1.combatAlgorithmScore);
      const forceAttack = state1.patienceTimer >= patienceLimit;

      if (!weaponLike1 || canAttack(weaponLike1, distance) || forceAttack) {
        const ctx = buildSpatialContext(state1, state2, 'main');
        performAttack(state1, state2, robot1.name, robot2.name, currentTime, 'main', events, ctx);
        state1.lastAttackTime = currentTime;
        state1.patienceTimer = 0;
        robot1AttackedThisTick = true;
      } else {
        // Melee out of range — emit event
        events.push({
          timestamp: Number(currentTime.toFixed(1)),
          type: 'out_of_range',
          attacker: robot1.name,
          defender: robot2.name,
          weapon: weaponLike1.name,
          message: `🚫 ${robot1.name}'s ${weaponLike1.name} can't reach ${robot2.name} at ${distance.toFixed(1)} units (need ≤2)`,
          robot1HP: state1.currentHP,
          robot2HP: state2.currentHP,
          robot1Shield: state1.currentShield,
          robot2Shield: state2.currentShield,
          ...posSnapshot,
          distance,
          rangeBand: currentRangeBand,
        });
      }
    }

    // Robot 1 offhand attack (dual wield)
    if (robot1.loadoutType === 'dual_wield' &&
        robot1.offhandWeapon?.weapon &&
        currentTime - state1.lastOffhandAttackTime >= state1.offhandCooldown &&
        state1.currentHP > 0 && state1.isAlive) {
      const offWeapon1 = robot1.offhandWeapon.weapon;
      const offWeaponLike1: WeaponLike = { weaponType: offWeapon1.weaponType, handsRequired: offWeapon1.handsRequired, name: offWeapon1.name };

      if (canAttack(offWeaponLike1, distance) || state1.patienceTimer >= getPatienceLimit(state1.combatAlgorithmScore)) {
        const ctx = buildSpatialContext(state1, state2, 'offhand');
        performAttack(state1, state2, robot1.name, robot2.name, currentTime, 'offhand', events, ctx);
        state1.lastOffhandAttackTime = currentTime;
        state1.patienceTimer = 0;
        robot1AttackedThisTick = true;
      }
    }


    // Robot 2 main weapon attack
    let robot2AttackedThisTick = false;
    if (currentTime - state2.lastAttackTime >= state2.attackCooldown && state2.currentHP > 0 && state2.isAlive) {
      const weapon2 = robot2.mainWeapon?.weapon;
      const weaponLike2: WeaponLike | null = weapon2 ? { weaponType: weapon2.weaponType, handsRequired: weapon2.handsRequired, name: weapon2.name } : null;

      const patienceLimit2 = getPatienceLimit(state2.combatAlgorithmScore);
      const forceAttack2 = state2.patienceTimer >= patienceLimit2;

      if (!weaponLike2 || canAttack(weaponLike2, distance) || forceAttack2) {
        const ctx = buildSpatialContext(state2, state1, 'main');
        performAttack(state2, state1, robot2.name, robot1.name, currentTime, 'main', events, ctx);
        state2.lastAttackTime = currentTime;
        state2.patienceTimer = 0;
        robot2AttackedThisTick = true;
      } else {
        events.push({
          timestamp: Number(currentTime.toFixed(1)),
          type: 'out_of_range',
          attacker: robot2.name,
          defender: robot1.name,
          weapon: weaponLike2.name,
          message: `🚫 ${robot2.name}'s ${weaponLike2.name} can't reach ${robot1.name} at ${distance.toFixed(1)} units (need ≤2)`,
          robot1HP: state1.currentHP,
          robot2HP: state2.currentHP,
          robot1Shield: state1.currentShield,
          robot2Shield: state2.currentShield,
          ...posSnapshot,
          distance,
          rangeBand: currentRangeBand,
        });
      }
    }

    // Robot 2 offhand attack (dual wield)
    if (robot2.loadoutType === 'dual_wield' &&
        robot2.offhandWeapon?.weapon &&
        currentTime - state2.lastOffhandAttackTime >= state2.offhandCooldown &&
        state2.currentHP > 0 && state2.isAlive) {
      const offWeapon2 = robot2.offhandWeapon.weapon;
      const offWeaponLike2: WeaponLike = { weaponType: offWeapon2.weaponType, handsRequired: offWeapon2.handsRequired, name: offWeapon2.name };

      if (canAttack(offWeaponLike2, distance) || state2.patienceTimer >= getPatienceLimit(state2.combatAlgorithmScore)) {
        const ctx = buildSpatialContext(state2, state1, 'offhand');
        performAttack(state2, state1, robot2.name, robot1.name, currentTime, 'offhand', events, ctx);
        state2.lastOffhandAttackTime = currentTime;
        state2.patienceTimer = 0;
        robot2AttackedThisTick = true;
      }
    }

    // Update patience timers if no attack occurred
    if (!robot1AttackedThisTick) state1.patienceTimer += SIMULATION_TICK;
    if (!robot2AttackedThisTick) state2.patienceTimer += SIMULATION_TICK;


    // ── PHASE 5: SHIELD REGEN ──
    const supportBoost1 = getSupportShieldBoost(state1);
    const supportBoost2 = getSupportShieldBoost(state2);

    const shield1Before = state1.currentShield;
    const shield2Before = state2.currentShield;
    regenerateShields(state1, SIMULATION_TICK, supportBoost1);
    regenerateShields(state2, SIMULATION_TICK, supportBoost2);

    // Emit shield_regen events at 25% thresholds
    if (state1.maxShield > 0 && shield1Before < state1.currentShield) {
      const oldPct = Math.floor((shield1Before / state1.maxShield) * 4);
      const newPct = Math.floor((state1.currentShield / state1.maxShield) * 4);
      if (newPct > oldPct) {
        events.push({
          timestamp: Number(currentTime.toFixed(1)),
          type: 'shield_regen',
          attacker: robot1.name,
          robot1HP: state1.currentHP,
          robot2HP: state2.currentHP,
          robot1Shield: state1.currentShield,
          robot2Shield: state2.currentShield,
          message: `🛡️⚡ ${robot1.name}'s shields regenerate to ${Math.round((state1.currentShield / state1.maxShield) * 100)}%`,
          ...buildPositionSnapshot(state1, state2),
        });
      }
    }
    if (state2.maxShield > 0 && shield2Before < state2.currentShield) {
      const oldPct = Math.floor((shield2Before / state2.maxShield) * 4);
      const newPct = Math.floor((state2.currentShield / state2.maxShield) * 4);
      if (newPct > oldPct) {
        events.push({
          timestamp: Number(currentTime.toFixed(1)),
          type: 'shield_regen',
          attacker: robot2.name,
          robot1HP: state1.currentHP,
          robot2HP: state2.currentHP,
          robot1Shield: state1.currentShield,
          robot2Shield: state2.currentShield,
          message: `🛡️⚡ ${robot2.name}'s shields regenerate to ${Math.round((state2.currentShield / state2.maxShield) * 100)}%`,
          ...buildPositionSnapshot(state1, state2),
        });
      }
    }


    // ── PHASE 6: STATE CHECKS ──
    if (state1.currentHP <= 0) {
      state1.isAlive = false;
      winnerId = robot2.id;
      battleEnded = true;
      events.push({
        timestamp: Number(currentTime.toFixed(1)),
        type: 'destroyed',
        message: `💀 ${robot1.name} destroyed! ${robot2.name} wins!`,
        robot1HP: 0,
        robot2HP: state2.currentHP,
        robot1Shield: state1.currentShield,
        robot2Shield: state2.currentShield,
        ...buildPositionSnapshot(state1, state2),
      });
    } else if (state2.currentHP <= 0) {
      state2.isAlive = false;
      winnerId = robot1.id;
      battleEnded = true;
      events.push({
        timestamp: Number(currentTime.toFixed(1)),
        type: 'destroyed',
        message: `💀 ${robot2.name} destroyed! ${robot1.name} wins!`,
        robot1HP: state1.currentHP,
        robot2HP: 0,
        robot1Shield: state1.currentShield,
        robot2Shield: state2.currentShield,
        ...buildPositionSnapshot(state1, state2),
      });
    } else if (shouldYield(state1)) {
      state1.isAlive = false;
      winnerId = robot2.id;
      battleEnded = true;
      events.push({
        timestamp: Number(currentTime.toFixed(1)),
        type: 'yield',
        message: `🏳️ ${robot1.name} yields at ${((state1.currentHP / state1.maxHP) * 100).toFixed(0)}% HP! ${robot2.name} wins!`,
        robot1HP: state1.currentHP,
        robot2HP: state2.currentHP,
        robot1Shield: state1.currentShield,
        robot2Shield: state2.currentShield,
        ...buildPositionSnapshot(state1, state2),
      });
    } else if (shouldYield(state2)) {
      state2.isAlive = false;
      winnerId = robot1.id;
      battleEnded = true;
      events.push({
        timestamp: Number(currentTime.toFixed(1)),
        type: 'yield',
        message: `🏳️ ${robot2.name} yields at ${((state2.currentHP / state2.maxHP) * 100).toFixed(0)}% HP! ${robot1.name} wins!`,
        robot1HP: state1.currentHP,
        robot2HP: state2.currentHP,
        robot1Shield: state1.currentShield,
        robot2Shield: state2.currentShield,
        ...buildPositionSnapshot(state1, state2),
      });
    }

    // Update pressure state
    state1.isUnderPressure = (state1.currentHP / state1.maxHP) * 100 < state1.pressureThreshold;
    state2.isUnderPressure = (state2.currentHP / state2.maxHP) * 100 < state2.pressureThreshold;


    // ── PHASE 7: POSITION SNAPSHOTS (throttled movement events) ──
    if (!battleEnded) {
      // Robot 1 movement event
      const moveDist1 = euclideanDistance(state1.position, lastMoveEventPos1);
      const moveTime1 = currentTime - lastMoveEventTime1;
      if (moveDist1 >= MOVEMENT_EVENT_THRESHOLD || moveTime1 >= MOVEMENT_EVENT_MIN_INTERVAL) {
        if (moveDist1 > 0.01) { // Only emit if actually moved
          events.push({
            timestamp: Number(currentTime.toFixed(1)),
            type: 'movement',
            attacker: robot1.name,
            defender: robot2.name,
            message: `🏃 ${robot1.name} moves to (${state1.position.x.toFixed(1)}, ${state1.position.y.toFixed(1)}) — ${distance.toFixed(1)} units from ${robot2.name}`,
            robot1HP: state1.currentHP,
            robot2HP: state2.currentHP,
            robot1Shield: state1.currentShield,
            robot2Shield: state2.currentShield,
            ...buildPositionSnapshot(state1, state2),
            distance,
            rangeBand: currentRangeBand,
          });
          lastMoveEventTime1 = currentTime;
          lastMoveEventPos1 = { x: state1.position.x, y: state1.position.y };
        }
      }

      // Robot 2 movement event
      const moveDist2 = euclideanDistance(state2.position, lastMoveEventPos2);
      const moveTime2 = currentTime - lastMoveEventTime2;
      if (moveDist2 >= MOVEMENT_EVENT_THRESHOLD || moveTime2 >= MOVEMENT_EVENT_MIN_INTERVAL) {
        if (moveDist2 > 0.01) {
          events.push({
            timestamp: Number(currentTime.toFixed(1)),
            type: 'movement',
            attacker: robot2.name,
            defender: robot1.name,
            message: `🏃 ${robot2.name} moves to (${state2.position.x.toFixed(1)}, ${state2.position.y.toFixed(1)}) — ${distance.toFixed(1)} units from ${robot1.name}`,
            robot1HP: state1.currentHP,
            robot2HP: state2.currentHP,
            robot1Shield: state1.currentShield,
            robot2Shield: state2.currentShield,
            ...buildPositionSnapshot(state1, state2),
            distance,
            rangeBand: currentRangeBand,
          });
          lastMoveEventTime2 = currentTime;
          lastMoveEventPos2 = { x: state2.position.x, y: state2.position.y };
        }
      }
    }
  } // end main loop


  // === 6. Time limit handling ===
  if (!battleEnded) {
    if (isTournament && winnerId === null) {
      const robot1FinalHP = Math.max(0, state1.currentHP);
      const robot2FinalHP = Math.max(0, state2.currentHP);
      const hpPercent1 = robot1FinalHP / state1.maxHP;
      const hpPercent2 = robot2FinalHP / state2.maxHP;

      if (hpPercent1 > hpPercent2) {
        winnerId = robot1.id;
        events.push({
          timestamp: Number(currentTime.toFixed(1)),
          type: 'yield',
          message: `⏱️ Time limit! ${robot1.name} wins by HP (${(hpPercent1 * 100).toFixed(1)}% vs ${(hpPercent2 * 100).toFixed(1)}%)`,
          robot1HP: state1.currentHP,
          robot2HP: state2.currentHP,
          robot1Shield: state1.currentShield,
          robot2Shield: state2.currentShield,
          ...buildPositionSnapshot(state1, state2),
        });
      } else if (hpPercent2 > hpPercent1) {
        winnerId = robot2.id;
        events.push({
          timestamp: Number(currentTime.toFixed(1)),
          type: 'yield',
          message: `⏱️ Time limit! ${robot2.name} wins by HP (${(hpPercent2 * 100).toFixed(1)}% vs ${(hpPercent1 * 100).toFixed(1)}%)`,
          robot1HP: state1.currentHP,
          robot2HP: state2.currentHP,
          robot1Shield: state1.currentShield,
          robot2Shield: state2.currentShield,
          ...buildPositionSnapshot(state1, state2),
        });
      } else {
        winnerId = robot1.id;
        events.push({
          timestamp: Number(currentTime.toFixed(1)),
          type: 'yield',
          message: `⏱️ Time limit! Perfect tie! ${robot1.name} wins (tournament tiebreaker)`,
          robot1HP: state1.currentHP,
          robot2HP: state2.currentHP,
          robot1Shield: state1.currentShield,
          robot2Shield: state2.currentShield,
          ...buildPositionSnapshot(state1, state2),
        });
      }
    } else {
      events.push({
        timestamp: Number(currentTime.toFixed(1)),
        type: 'yield',
        message: `⏱️ Time limit reached - Draw!`,
        robot1HP: state1.currentHP,
        robot2HP: state2.currentHP,
        robot1Shield: state1.currentShield,
        robot2Shield: state2.currentShield,
        ...buildPositionSnapshot(state1, state2),
      });
    }
  }

  // === 7. Return CombatResult with arena metadata ===
  return {
    winnerId,
    robot1FinalHP: Math.max(0, state1.currentHP),
    robot2FinalHP: Math.max(0, state2.currentHP),
    robot1FinalShield: state1.currentShield,
    robot2FinalShield: state2.currentShield,
    robot1Damage: state1.totalDamageTaken,
    robot2Damage: state2.totalDamageTaken,
    robot1DamageDealt: state1.totalDamageDealt,
    robot2DamageDealt: state2.totalDamageDealt,
    durationSeconds: Number(currentTime.toFixed(1)),
    isDraw: winnerId === null,
    events,
    arenaRadius: arena.radius,
    startingPositions,
    endingPositions: {
      [robot1.name]: { x: state1.position.x, y: state1.position.y },
      [robot2.name]: { x: state2.position.x, y: state2.position.y },
    },
  };
}
