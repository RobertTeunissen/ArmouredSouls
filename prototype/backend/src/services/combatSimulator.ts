import { Robot, Weapon, WeaponInventory } from '@prisma/client';

/**
 * Combat Simulator - Implements time-based combat formulas from ROBOT_ATTRIBUTES.md
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
  type: 'attack' | 'miss' | 'critical' | 'counter' | 'shield_break' | 'shield_regen' | 'yield' | 'destroyed';
  attacker?: string;
  defender?: string;
  weapon?: string;
  hand?: 'main' | 'offhand'; // Which hand performed the attack (for dual wield)
  damage?: number;
  shieldDamage?: number;
  hpDamage?: number;
  hit?: boolean;
  critical?: boolean;
  counter?: boolean;
  robot1HP?: number;
  robot2HP?: number;
  robot1Shield?: number;
  robot2Shield?: number;
  message: string;
  formulaBreakdown?: FormulaBreakdown;
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
  maxSingleAttackDamage: number;
  maxSingleAttackRobotId: number | null;
}

interface RobotCombatState {
  robot: RobotWithWeapons;
  currentHP: number;
  maxHP: number;
  currentShield: number;
  maxShield: number;
  lastAttackTime: number;
  lastOffhandAttackTime: number; // For dual wield
  attackCooldown: number;
  offhandCooldown: number; // For dual wield
  totalDamageDealt: number;
  totalDamageTaken: number;
  maxSingleAttack: number; // Track highest single attack damage
}

const BASE_WEAPON_COOLDOWN = 4; // seconds
const MAX_BATTLE_DURATION = 120; // seconds
const SIMULATION_TICK = 0.1; // 100ms per tick

// Maximum armor reduction cap removed - armor now scales without limit
// This was previously capped at 30 to prevent armor from being too overpowered
// export const MAX_ARMOR_REDUCTION = 30;

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
  baseAttribute: number | string,
  hand: 'main' | 'offhand',
  bonusField: keyof Weapon
): number {
  const baseValue = Number(baseAttribute);
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
function calculateHitChance(attacker: RobotWithWeapons, defender: RobotWithWeapons, attackerHand: 'main' | 'offhand' = 'main'): { hitChance: number; breakdown: FormulaBreakdown } {
  // Offhand attacks have reduced base hit chance (50% vs 70%)
  const baseHitChance = attackerHand === 'offhand' ? 50 : 70;
  const effectiveTargeting = getEffectiveAttribute(attacker, attacker.targetingSystems, attackerHand, 'targetingSystemsBonus');
  const targetingBonus = effectiveTargeting / 2;
  const stanceBonus = attacker.stance === 'offensive' ? 5 : 0;
  const evasionPenalty = Number(defender.evasionThrusters) / 3;
  const gyroPenalty = Number(defender.gyroStabilizers) / 5;
  
  const calculated = baseHitChance + targetingBonus + stanceBonus - evasionPenalty - gyroPenalty;
  const randomVariance = random(-10, 10);
  const final = clamp(calculated + randomVariance, 10, 95);
  
  return {
    hitChance: final,
    breakdown: {
      calculation: `${baseHitChance} base + ${targetingBonus.toFixed(1)} targeting + ${stanceBonus} stance - ${evasionPenalty.toFixed(1)} evasion - ${gyroPenalty.toFixed(1)} gyro + ${randomVariance.toFixed(1)} variance = ${final.toFixed(1)}%`,
      components: {
        base: baseHitChance,
        targeting: targetingBonus,
        stance: stanceBonus,
        evasion: -evasionPenalty,
        gyro: -gyroPenalty,
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
 * Calculate base damage before defense
 */
function calculateBaseDamage(attacker: RobotWithWeapons, weaponBaseDamage: number, attackerHand: 'main' | 'offhand' = 'main'): { damage: number; breakdown: FormulaBreakdown } {
  const effectiveCombatPower = getEffectiveAttribute(attacker, attacker.combatPower, attackerHand, 'combatPowerBonus');
  const combatPowerMult = 1 + (effectiveCombatPower * 1.5) / 100;
  let damage = weaponBaseDamage * combatPowerMult;
  
  // Loadout modifiers
  const loadoutMult = attacker.loadoutType === 'two_handed' ? 1.25 : 
                      attacker.loadoutType === 'dual_wield' ? 0.90 : 1.0;
  damage *= loadoutMult;
  
  // Weapon control
  const effectiveWeaponControl = getEffectiveAttribute(attacker, attacker.weaponControl, attackerHand, 'weaponControlBonus');
  const controlMult = 1 + effectiveWeaponControl / 100;
  damage *= controlMult;
  
  // Stance modifiers
  const stanceMult = attacker.stance === 'offensive' ? 1.15 :
                     attacker.stance === 'defensive' ? 0.90 : 1.0;
  damage *= stanceMult;
  
  return {
    damage,
    breakdown: {
      calculation: `${weaponBaseDamage} base × ${combatPowerMult.toFixed(2)} combat_power × ${loadoutMult.toFixed(2)} loadout × ${controlMult.toFixed(2)} weapon_control × ${stanceMult.toFixed(2)} stance = ${damage.toFixed(1)}`,
      components: {
        weaponBase: weaponBaseDamage,
        combatPower: combatPowerMult,
        loadout: loadoutMult,
        weaponControl: controlMult,
        stance: stanceMult,
      },
      result: damage,
    },
  };
}

/**
 * Apply damage through shields and armor
 * Armor reduction is no longer capped
 */
function applyDamage(
  baseDamage: number,
  attacker: RobotWithWeapons,
  defender: RobotWithWeapons,
  defenderState: RobotCombatState,
  isCritical: boolean,
  attackerHand: 'main' | 'offhand' = 'main'
): { hpDamage: number; shieldDamage: number; breakdown: FormulaBreakdown } {
  let damage = baseDamage;
  
  // Apply critical multiplier
  let critMultiplier = 1.0;
  if (isCritical) {
    critMultiplier = attacker.loadoutType === 'two_handed' ? 2.5 : 2.0;
    critMultiplier -= Number(defender.damageDampeners) / 100;
    critMultiplier = Math.max(critMultiplier, 1.2);
    damage *= critMultiplier;
  }
  
  const effectivePenetration = getEffectiveAttribute(attacker, attacker.penetration, attackerHand, 'penetrationBonus');
  const effectiveArmor = Number(defender.armorPlating); // Defender doesn't have equipped weapon affecting their armor in this context
  
  let shieldDamage = 0;
  let hpDamage = 0;
  let armorReduction = 0;
  let detailedFormula = '';
  
  const damageAfterCrit = damage;
  
  if (defenderState.currentShield > 0) {
    // Shields absorb damage up to their maximum capacity
    // The penetration multiplier allows some extra damage to "punch through" shields
    const penetrationMult = 1 + effectivePenetration / 200;
    const effectiveShieldDamage = damage * penetrationMult;
    
    // Shield absorbs up to its current capacity
    shieldDamage = Math.min(effectiveShieldDamage, defenderState.currentShield);
    defenderState.currentShield -= shieldDamage;
    
    // Bleed-through damage: any damage beyond shield capacity flows through to HP
    const bleedThroughDamage = Math.max(0, effectiveShieldDamage - shieldDamage);
    
    if (bleedThroughDamage > 0) {
      // Apply armor reduction (no cap)
      const rawArmorReduction = effectiveArmor * (1 - effectivePenetration / 100);
      armorReduction = rawArmorReduction;
      hpDamage = Math.max(1, bleedThroughDamage - armorReduction);
      detailedFormula = `${baseDamage.toFixed(1)} base × ${critMultiplier.toFixed(2)} crit = ${damageAfterCrit.toFixed(1)} | Shield: ${shieldDamage.toFixed(1)} absorbed | Bleed: ${bleedThroughDamage.toFixed(1)} - ${armorReduction.toFixed(1)} armor = ${hpDamage.toFixed(1)} HP`;
    } else {
      detailedFormula = `${baseDamage.toFixed(1)} base × ${critMultiplier.toFixed(2)} crit = ${damageAfterCrit.toFixed(1)} | Shield: ${shieldDamage.toFixed(1)} absorbed, 0 HP`;
    }
  } else {
    // No shield - damage goes to HP with armor reduction
    // Apply armor reduction (no cap)
    const rawArmorReduction = effectiveArmor * (1 - effectivePenetration / 100);
    armorReduction = rawArmorReduction;
    hpDamage = Math.max(1, damage - armorReduction);
    detailedFormula = `${baseDamage.toFixed(1)} base × ${critMultiplier.toFixed(2)} crit = ${damageAfterCrit.toFixed(1)} | No shield | ${damageAfterCrit.toFixed(1)} - ${armorReduction.toFixed(1)} armor = ${hpDamage.toFixed(1)} HP`;
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
        damageAfterCrit,
        penetration: effectivePenetration,
        armor: effectiveArmor,
        armorReduction,
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
function regenerateShields(state: RobotCombatState, deltaTime: number): number {
  const regenPerSecond = Number(state.robot.powerCore) * 0.15;
  const stanceBonus = state.robot.stance === 'defensive' ? 1.20 : 1.0;
  const effectiveRegen = regenPerSecond * stanceBonus * deltaTime;
  
  const oldShield = state.currentShield;
  state.currentShield = Math.min(state.currentShield + effectiveRegen, state.maxShield);
  
  return state.currentShield - oldShield;
}

/**
 * Check if robot should yield based on threshold
 */
function shouldYield(state: RobotCombatState): boolean {
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
    baseDamage: 10, // Default unarmed damage
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
  
  if (robot.mainWeapon?.weapon) {
    const w = robot.mainWeapon.weapon;
    const bonuses: string[] = [];
    
    // Only show non-zero bonuses
    if (w.combatPowerBonus !== 0) bonuses.push(`CombatPower ${w.combatPowerBonus > 0 ? '+' : ''}${w.combatPowerBonus}`);
    if (w.targetingSystemsBonus !== 0) bonuses.push(`Targeting ${w.targetingSystemsBonus > 0 ? '+' : ''}${w.targetingSystemsBonus}`);
    if (w.criticalSystemsBonus !== 0) bonuses.push(`Crit ${w.criticalSystemsBonus > 0 ? '+' : ''}${w.criticalSystemsBonus}`);
    if (w.penetrationBonus !== 0) bonuses.push(`Pen ${w.penetrationBonus > 0 ? '+' : ''}${w.penetrationBonus}`);
    if (w.weaponControlBonus !== 0) bonuses.push(`Control ${w.weaponControlBonus > 0 ? '+' : ''}${w.weaponControlBonus}`);
    if (w.attackSpeedBonus !== 0) bonuses.push(`Speed ${w.attackSpeedBonus > 0 ? '+' : ''}${w.attackSpeedBonus}`);
    
    if (bonuses.length > 0) {
      parts.push(`Main (${w.name}): ${bonuses.join(', ')}`);
    } else {
      parts.push(`Main (${w.name}): No bonuses`);
    }
  }
  
  if (robot.offhandWeapon?.weapon) {
    const w = robot.offhandWeapon.weapon;
    const bonuses: string[] = [];
    
    // Only show non-zero bonuses
    if (w.combatPowerBonus !== 0) bonuses.push(`CombatPower ${w.combatPowerBonus > 0 ? '+' : ''}${w.combatPowerBonus}`);
    if (w.targetingSystemsBonus !== 0) bonuses.push(`Targeting ${w.targetingSystemsBonus > 0 ? '+' : ''}${w.targetingSystemsBonus}`);
    if (w.criticalSystemsBonus !== 0) bonuses.push(`Crit ${w.criticalSystemsBonus > 0 ? '+' : ''}${w.criticalSystemsBonus}`);
    if (w.penetrationBonus !== 0) bonuses.push(`Pen ${w.penetrationBonus > 0 ? '+' : ''}${w.penetrationBonus}`);
    if (w.weaponControlBonus !== 0) bonuses.push(`Control ${w.weaponControlBonus > 0 ? '+' : ''}${w.weaponControlBonus}`);
    if (w.attackSpeedBonus !== 0) bonuses.push(`Speed ${w.attackSpeedBonus > 0 ? '+' : ''}${w.attackSpeedBonus}`);
    
    if (bonuses.length > 0) {
      parts.push(`Offhand (${w.name}): ${bonuses.join(', ')}`);
    } else {
      parts.push(`Offhand (${w.name}): No bonuses`);
    }
  }
  
  return parts.length > 0 ? parts.join('\n') : 'No weapons equipped';
}

/**
 * Perform a single attack from attacker to defender
 */
function performAttack(
  attackerState: RobotCombatState,
  defenderState: RobotCombatState,
  attackerName: string,
  defenderName: string,
  currentTime: number,
  hand: 'main' | 'offhand',
  events: CombatEvent[]
): void {
  const { hitChance, breakdown: hitBreakdown } = calculateHitChance(attackerState.robot, defenderState.robot, hand);
  const hitRoll = random(0, 100);
  const hit = hitRoll < hitChance;
  
  // Always calculate crit chance (issue #3)
  const { critChance, breakdown: critBreakdown } = calculateCritChance(attackerState.robot, hand);
  const critRoll = random(0, 100);
  const isCritical = hit && (critRoll < critChance);
  
  const weaponInfo = getWeaponInfo(attackerState.robot, hand);
  const weaponDamage = weaponInfo.baseDamage;
  
  if (hit) {
    const { damage: baseDamage, breakdown: damageBreakdown } = calculateBaseDamage(attackerState.robot, weaponDamage, hand);
    const { hpDamage, shieldDamage, breakdown: applyBreakdown } = applyDamage(
      baseDamage,
      attackerState.robot,
      defenderState.robot,
      defenderState,
      isCritical,
      hand
    );
    
    attackerState.totalDamageDealt += hpDamage;
    defenderState.totalDamageTaken += hpDamage;
    
    const totalDamage = hpDamage + shieldDamage;
    
    // Track max single attack damage
    if (totalDamage > attackerState.maxSingleAttack) {
      attackerState.maxSingleAttack = totalDamage;
    }
    
    const handLabel = hand === 'offhand' ? ' [OFFHAND]' : '';
    
    // Build multiline formula breakdown with crit roll info
    const formulaParts = [
      `Hit: ${hitBreakdown.calculation} (rolled ${hitRoll.toFixed(1)}, result: HIT)`,
      `Crit: ${critBreakdown.calculation} (rolled ${critRoll.toFixed(1)}, result: ${isCritical ? 'CRITICAL HIT' : 'normal'})`,
      `Damage: ${damageBreakdown.calculation}`,
      `Apply: ${applyBreakdown.calculation}`,
    ];
    
    // Always calculate counter chance (issue #4)
    const { counterChance, breakdown: counterBreakdown } = calculateCounterChance(defenderState.robot);
    const counterRoll = random(0, 100);
    const counterHappens = defenderState.currentHP > 0 && (counterRoll < counterChance);
    
    formulaParts.push(`Counter: ${counterBreakdown.calculation} (rolled ${counterRoll.toFixed(1)}, result: ${counterHappens ? 'COUNTER' : 'no counter'})`);
    
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
        ? `💢 CRITICAL!${handLabel} ${attackerName} deals ${totalDamage.toFixed(0)} damage with ${weaponInfo.name} (${shieldDamage.toFixed(0)} shield, ${hpDamage.toFixed(0)} HP)`
        : `💥${handLabel} ${attackerName} hits for ${totalDamage.toFixed(0)} damage with ${weaponInfo.name} (${shieldDamage.toFixed(0)} shield, ${hpDamage.toFixed(0)} HP)`,
      formulaBreakdown: {
        calculation: formulaParts.join('\n'),
        components: { 
          ...hitBreakdown.components,
          hitRoll,
          ...critBreakdown.components,
          critRoll,
          ...damageBreakdown.components, 
          ...applyBreakdown.components,
          ...counterBreakdown.components,
          counterRoll,
        },
        result: totalDamage,
      },
    });
    
    // Execute counter-attack if it happens
    if (counterHappens) {
      const counterDamage = baseDamage * 0.7;
      const { hpDamage: counterHP, shieldDamage: counterShield, breakdown: counterApplyBreakdown } = applyDamage(
        counterDamage, 
        defenderState.robot, 
        attackerState.robot, 
        attackerState, 
        false,
        'main' // Counters always use main hand
      );
      
      defenderState.totalDamageDealt += counterHP;
      attackerState.totalDamageTaken += counterHP;
      
      // Track max single attack damage for counter-attacks
      const counterTotalDamage = counterHP + counterShield;
      if (counterTotalDamage > defenderState.maxSingleAttack) {
        defenderState.maxSingleAttack = counterTotalDamage;
      }
      
      events.push({
        timestamp: Number(currentTime.toFixed(1)),
        type: 'counter',
        attacker: defenderName,
        defender: attackerName,
        weapon: getWeaponInfo(defenderState.robot, 'main').name,
        damage: counterHP,
        hpDamage: counterHP,
        shieldDamage: counterShield,
        counter: true,
        robot1HP: attackerState.currentHP,
        robot2HP: defenderState.currentHP,
        robot1Shield: attackerState.currentShield,
        robot2Shield: defenderState.currentShield,
        message: `🔄 ${defenderName} counters for ${counterHP.toFixed(0)} damage!`,
        formulaBreakdown: {
          calculation: `Counter: ${counterDamage.toFixed(1)} base (70% of attack)\n${counterApplyBreakdown.calculation}`,
          components: {
            counterChance: counterChance,
            counterBase: counterDamage,
            ...counterApplyBreakdown.components,
          },
          result: counterHP,
        },
      });
    }
  } else {
    // Miss - show hit calculation and crit roll too
    const formulaParts = [
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
      message: `❌${hand === 'offhand' ? ' [OFFHAND]' : ''} ${attackerName} misses ${defenderName} with ${weaponInfo.name}`,
      formulaBreakdown: {
        calculation: formulaParts.join('\n'),
        components: {
          ...hitBreakdown.components,
          hitRoll,
          ...critBreakdown.components,
          critRoll,
        },
        result: 0,
      },
    });
  }
}

/**
 * Simulate a complete battle between two robots
 */
export function simulateBattle(robot1: RobotWithWeapons, robot2: RobotWithWeapons): CombatResult {
  // Get weapon cooldowns (use weapon cooldown if equipped, otherwise use base)
  const mainWeapon1 = robot1.mainWeapon?.weapon;
  const offhandWeapon1 = robot1.offhandWeapon?.weapon;
  const mainWeapon2 = robot2.mainWeapon?.weapon;
  const offhandWeapon2 = robot2.offhandWeapon?.weapon;
  
  const calculateCooldown = (robot: RobotWithWeapons, weaponCooldown: number | undefined, hand: 'main' | 'offhand') => {
    const baseCooldown = weaponCooldown || BASE_WEAPON_COOLDOWN;
    // Offhand attacks have 40% cooldown penalty (applied before attack speed bonuses)
    const cooldownWithPenalty = hand === 'offhand' ? baseCooldown * 1.4 : baseCooldown;
    // Get effective attack speed including weapon bonus for the specific hand
    const effectiveAttackSpeed = getEffectiveAttribute(robot, robot.attackSpeed, hand, 'attackSpeedBonus');
    return cooldownWithPenalty / (1 + Number(effectiveAttackSpeed) / 50);
  };
  
  // Initialize combat state
  const state1: RobotCombatState = {
    robot: robot1,
    currentHP: robot1.currentHP,
    maxHP: robot1.maxHP,
    currentShield: robot1.currentShield,
    maxShield: robot1.maxShield,
    lastAttackTime: 0,
    lastOffhandAttackTime: 0,
    attackCooldown: calculateCooldown(robot1, mainWeapon1?.cooldown, 'main'),
    offhandCooldown: calculateCooldown(robot1, offhandWeapon1?.cooldown, 'offhand'),
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    maxSingleAttack: 0,
  };
  
  const state2: RobotCombatState = {
    robot: robot2,
    currentHP: robot2.currentHP,
    maxHP: robot2.maxHP,
    currentShield: robot2.currentShield,
    maxShield: robot2.maxShield,
    lastAttackTime: 0,
    lastOffhandAttackTime: 0,
    attackCooldown: calculateCooldown(robot2, mainWeapon2?.cooldown, 'main'),
    offhandCooldown: calculateCooldown(robot2, offhandWeapon2?.cooldown, 'offhand'),
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    maxSingleAttack: 0,
  };
  
  const events: CombatEvent[] = [];
  let currentTime = 0;
  let battleEnded = false;
  let winnerId: number | null = null;
  
  // Battle start event with complete robot stats including weapons
  const weaponStats1 = getWeaponStatsSummary(robot1);
  const weaponStats2 = getWeaponStatsSummary(robot2);
  const weaponBonuses1 = getWeaponBonusesSummary(robot1);
  const weaponBonuses2 = getWeaponBonusesSummary(robot2);
  
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
Weapon Attribute Bonuses:
${weaponBonuses1}

${robot2.name}: ${state2.currentHP}HP / ${state2.maxHP}HP, ${state2.currentShield}S / ${state2.maxShield}S
Weapons: ${weaponStats2}
Main CD: ${state2.attackCooldown.toFixed(2)}s${robot2.loadoutType === 'dual_wield' && offhandWeapon2 ? `, Offhand CD: ${state2.offhandCooldown.toFixed(2)}s (40% penalty applied)` : ''}
Weapon Attribute Bonuses:
${weaponBonuses2}`,
      components: {
        robot1_hp: state1.currentHP,
        robot1_max_hp: state1.maxHP,
        robot1_shield: state1.currentShield,
        robot1_max_shield: state1.maxShield,
        robot1_main_cooldown: state1.attackCooldown,
        robot1_offhand_cooldown: state1.offhandCooldown,
        robot2_hp: state2.currentHP,
        robot2_max_hp: state2.maxHP,
        robot2_shield: state2.currentShield,
        robot2_max_shield: state2.maxShield,
        robot2_main_cooldown: state2.attackCooldown,
        robot2_offhand_cooldown: state2.offhandCooldown,
      },
      result: 0,
    },
  });
  
  // Main combat loop
  while (currentTime < MAX_BATTLE_DURATION && !battleEnded) {
    currentTime += SIMULATION_TICK;
    
    // Regenerate shields
    const shield1Regen = regenerateShields(state1, SIMULATION_TICK);
    const shield2Regen = regenerateShields(state2, SIMULATION_TICK);
    
    // Check if robot1 can attack with main weapon
    if (currentTime - state1.lastAttackTime >= state1.attackCooldown && state1.currentHP > 0) {
      performAttack(state1, state2, robot1.name, robot2.name, currentTime, 'main', events);
      state1.lastAttackTime = currentTime;
    }
    
    // Check if robot1 can attack with offhand (dual wield only)
    if (robot1.loadoutType === 'dual_wield' && 
        robot1.offhandWeapon?.weapon &&
        currentTime - state1.lastOffhandAttackTime >= state1.offhandCooldown && 
        state1.currentHP > 0) {
      performAttack(state1, state2, robot1.name, robot2.name, currentTime, 'offhand', events);
      state1.lastOffhandAttackTime = currentTime;
    }
    
    // Check if robot2 can attack with main weapon
    if (currentTime - state2.lastAttackTime >= state2.attackCooldown && state2.currentHP > 0) {
      performAttack(state2, state1, robot2.name, robot1.name, currentTime, 'main', events);
      state2.lastAttackTime = currentTime;
    }
    
    // Check if robot2 can attack with offhand (dual wield only)
    if (robot2.loadoutType === 'dual_wield' && 
        robot2.offhandWeapon?.weapon &&
        currentTime - state2.lastOffhandAttackTime >= state2.offhandCooldown && 
        state2.currentHP > 0) {
      performAttack(state2, state1, robot2.name, robot1.name, currentTime, 'offhand', events);
      state2.lastOffhandAttackTime = currentTime;
    }
    
    // Check battle end conditions
    if (state1.currentHP <= 0) {
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
      });
    } else if (state2.currentHP <= 0) {
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
      });
    } else if (shouldYield(state1)) {
      winnerId = robot2.id;
      battleEnded = true;
      events.push({
        timestamp: Number(currentTime.toFixed(1)),
        type: 'yield',
        message: `🏳️ ${robot1.name} yields at ${((state1.currentHP/state1.maxHP)*100).toFixed(0)}% HP! ${robot2.name} wins!`,
        robot1HP: state1.currentHP,
        robot2HP: state2.currentHP,
        robot1Shield: state1.currentShield,
        robot2Shield: state2.currentShield,
      });
    } else if (shouldYield(state2)) {
      winnerId = robot1.id;
      battleEnded = true;
      events.push({
        timestamp: Number(currentTime.toFixed(1)),
        type: 'yield',
        message: `🏳️ ${robot2.name} yields at ${((state2.currentHP/state2.maxHP)*100).toFixed(0)}% HP! ${robot1.name} wins!`,
        robot1HP: state1.currentHP,
        robot2HP: state2.currentHP,
        robot1Shield: state1.currentShield,
        robot2Shield: state2.currentShield,
      });
    }
  }
  
  // Time limit draw
  if (!battleEnded) {
    events.push({
      timestamp: Number(currentTime.toFixed(1)),
      type: 'yield',
      message: `⏱️ Time limit reached - Draw!`,
      robot1HP: state1.currentHP,
      robot2HP: state2.currentHP,
      robot1Shield: state1.currentShield,
      robot2Shield: state2.currentShield,
    });
  }
  
  // Determine which robot dealt the max single attack
  const maxSingleAttackDamage = Math.max(state1.maxSingleAttack, state2.maxSingleAttack);
  let maxSingleAttackRobotId: number | null = null;
  
  if (maxSingleAttackDamage > 0) {
    // If both have equal non-zero max, favor robot1 (tie-breaker)
    if (state1.maxSingleAttack >= state2.maxSingleAttack && state1.maxSingleAttack > 0) {
      maxSingleAttackRobotId = robot1.id;
    } else if (state2.maxSingleAttack > 0) {
      maxSingleAttackRobotId = robot2.id;
    }
  }
  
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
    maxSingleAttackDamage,
    maxSingleAttackRobotId,
  };
}
