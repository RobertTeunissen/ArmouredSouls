/**
 * Combat Simulator — Formula calculations and utility functions.
 */

import { Weapon } from '../../../../generated/prisma';
import { formatWeaponDisplayName } from '../../../shared/utils/weaponRefinement';
import {
  RobotWithWeapons,
  FormulaBreakdown,
  ARMOR_EFFECTIVENESS,
  PENETRATION_BONUS,
  SpatialRobotCombatState,
} from './combatTypes';

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Round a time value to 1 decimal place without string conversion.
 * Avoids the overhead of Number(value.toFixed(1)) which allocates a string.
 */
export function roundTime(t: number): number {
  return Math.round(t * 10) / 10;
}

/**
 * Get random value between min and max
 */
export function random(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Get effective attribute value including weapon bonuses and tuning bonuses.
 *
 * @deprecated After `prepareRobotForCombat()` runs, all robot attributes already
 * contain effective values (base + both weapons + tuning). The combat simulator
 * should read them directly with `Number(robot.attribute)`. This function is kept
 * as a no-op passthrough for backward compatibility.
 */
export function getEffectiveAttribute(
  _robot: RobotWithWeapons,
  baseAttribute: number | string | { toNumber(): number },
  _hand: 'main' | 'offhand',
  _bonusField: keyof Weapon
): number {
  // Attributes are pre-computed by prepareRobotForCombat() — just return the value.
  return typeof baseAttribute === 'object' && 'toNumber' in baseAttribute
    ? baseAttribute.toNumber()
    : Number(baseAttribute);
}


/**
 * Calculate hit chance based on attacker and defender attributes
 */
export function calculateHitChance(
  attacker: RobotWithWeapons,
  defender: RobotWithWeapons,
  attackerHand: 'main' | 'offhand' = 'main',
  spatialBonuses?: { adaptationHitBonus: number; pressureAccuracyMod: number; combatAlgorithmScore: number; passiveAccuracyPenalty?: number }
): { hitChance: number; breakdown: FormulaBreakdown } {
  const baseHitChance = attackerHand === 'offhand' ? 50 : 70;
  const effectiveTargeting = Number(attacker.targetingSystems);
  const targetingBonus = effectiveTargeting / 2;
  const stanceBonus = attacker.stance === 'offensive' ? 5 : 0;
  const evasionPenalty = Number(defender.evasionThrusters) / 3;
  const gyroPenalty = Number(defender.gyroStabilizers) / 5;

  let adaptBonus = 0;
  let pressureMod = 0;
  let algoBonus = 0;
  let passivePenalty = 0;
  if (spatialBonuses) {
    adaptBonus = spatialBonuses.adaptationHitBonus;
    pressureMod = spatialBonuses.pressureAccuracyMod;
    passivePenalty = spatialBonuses.passiveAccuracyPenalty ?? 0;
    // Combat algorithm hit bonus: score > 0.5 grants 1-5% (Req 5.5)
    if (spatialBonuses.combatAlgorithmScore > 0.5) {
      algoBonus = (spatialBonuses.combatAlgorithmScore - 0.5) * 10; // 0-5%
    }
  }

  const calculated = baseHitChance + targetingBonus + stanceBonus - evasionPenalty - gyroPenalty + adaptBonus + pressureMod + algoBonus - passivePenalty;
  const randomVariance = random(-10, 10);
  const final = clamp(calculated + randomVariance, 10, 95);

  return {
    hitChance: final,
    breakdown: {
      calculation: `${baseHitChance} base + ${targetingBonus.toFixed(1)} targeting + ${stanceBonus} stance - ${evasionPenalty.toFixed(1)} evasion - ${gyroPenalty.toFixed(1)} gyro${adaptBonus ? ` + ${adaptBonus.toFixed(1)} adapt` : ''}${pressureMod ? ` + ${pressureMod.toFixed(1)} pressure` : ''}${algoBonus ? ` + ${algoBonus.toFixed(1)} algo` : ''}${passivePenalty ? ` - ${passivePenalty.toFixed(1)} passive` : ''} + ${randomVariance.toFixed(1)} variance = ${final.toFixed(1)}%`,
      components: {
        base: baseHitChance,
        targeting: targetingBonus,
        stance: stanceBonus,
        evasion: -evasionPenalty,
        gyro: -gyroPenalty,
        adaptation: adaptBonus,
        pressure: pressureMod,
        algorithmBonus: algoBonus,
        passivePenalty: -passivePenalty,
        variance: randomVariance,
        // hitChanceBase: static base from robot stats only (no spatial modifiers, no variance)
        hitChanceBase: clamp(baseHitChance + targetingBonus + stanceBonus - evasionPenalty - gyroPenalty, 10, 95),
      },
      result: final,
    },
  };
}

/**
 * Calculate critical hit chance
 */
export function calculateCritChance(attacker: RobotWithWeapons, _attackerHand: 'main' | 'offhand' = 'main'): { critChance: number; breakdown: FormulaBreakdown } {
  const baseCrit = 5;
  const effectiveCritSystems = Number(attacker.criticalSystems);
  const critBonus = effectiveCritSystems / 8;
  const effectiveTargeting = Number(attacker.targetingSystems);
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
        critChanceBase: clamp(calculated, 0, 50),
      },
      result: final,
    },
  };
}

/**
 * Calculate weapon malfunction chance based on weapon control
 */
export function calculateMalfunctionChance(attacker: RobotWithWeapons, _attackerHand: 'main' | 'offhand' = 'main'): { malfunctionChance: number; breakdown: FormulaBreakdown } {
  const effectiveWeaponControl = Number(attacker.weaponControl);
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
  _attackerHand: 'main' | 'offhand' = 'main',
  spatialMultipliers?: { rangePenalty: number; hydraulicBonus: number; backstabBonus: number; adaptationDamageBonus: number; pressureDamageMod: number; syncVolleyBonus: number }
): { damage: number; breakdown: FormulaBreakdown } {
  const effectiveCombatPower = Number(attacker.combatPower);
  const combatPowerMult = 1 + (effectiveCombatPower * 1.5) / 100;
  let damage = weaponBaseDamage * combatPowerMult;

  const loadoutMult = attacker.loadoutType === 'two_handed' ? 1.10 :
                      attacker.loadoutType === 'dual_wield' ? 0.90 : 1.0;
  damage *= loadoutMult;

  const effectiveWeaponControl = Number(attacker.weaponControl);
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
  _attackerHand: 'main' | 'offhand' = 'main',
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

  const effectivePenetration = Number(attacker.penetration);
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
    let damageMultiplier: number;

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
export function calculateCounterChance(defender: RobotWithWeapons): { counterChance: number; breakdown: FormulaBreakdown } {
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
export function regenerateShields(state: SpatialRobotCombatState, deltaTime: number, supportBoost: number = 0): number {
  const regenPerSecond = state.numPowerCore * 0.15;
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
export function shouldYield(state: SpatialRobotCombatState): boolean {
  const hpPercent = (state.currentHP / state.maxHP) * 100;
  return hpPercent <= state.robot.yieldThreshold && hpPercent > 0;
}

/**
 * Get weapon info for display.
 *
 * After Spec #34, the weapon record passed in carries POST-REFINEMENT effective
 * stats and two derived marker fields (`__refinementCount`, `__customName`)
 * attached during `prepareRobotForCombat`. The display name is built via
 * `formatWeaponDisplayName(weapon.name, refinementCount)` so battle log events
 * naturally render rank prefixes (e.g. `Mastercrafted Volt Sabre`).
 */
export function getWeaponInfo(robot: RobotWithWeapons, hand: 'main' | 'offhand'): { name: string; baseDamage: number; customName: string | null } {
  const weaponInventory = hand === 'main' ? robot.mainWeapon : robot.offhandWeapon;
  if (weaponInventory?.weapon) {
    const weaponRecord = weaponInventory.weapon as Weapon & {
      __refinementCount?: number;
      __customName?: string | null;
    };
    const refinementCount = weaponRecord.__refinementCount ?? 0;
    const customName = weaponRecord.__customName ?? null;
    return {
      name: formatWeaponDisplayName(weaponInventory.weapon.name, refinementCount),
      baseDamage: weaponInventory.weapon.baseDamage,
      customName,
    };
  }
  return {
    name: 'Fists',
    baseDamage: 10,
    customName: null,
  };
}

/**
 * Get weapon stats summary for robot
 */
export function getWeaponStatsSummary(robot: RobotWithWeapons): string {
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
