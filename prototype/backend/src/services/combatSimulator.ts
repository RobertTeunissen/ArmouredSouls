import { Robot } from '@prisma/client';

/**
 * Combat Simulator - Implements time-based combat formulas from ROBOT_ATTRIBUTES.md
 * 
 * This simulator uses ALL 23 robot attributes to determine battle outcomes.
 * ELO is NOT used in combat calculations - it's only for matchmaking.
 */

export interface CombatEvent {
  timestamp: number;
  type: 'attack' | 'miss' | 'critical' | 'counter' | 'shield_break' | 'shield_regen' | 'yield' | 'destroyed';
  attacker?: string;
  defender?: string;
  weapon?: string;
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
}

interface RobotCombatState {
  robot: Robot;
  currentHP: number;
  maxHP: number;
  currentShield: number;
  maxShield: number;
  lastAttackTime: number;
  attackCooldown: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
}

const BASE_WEAPON_COOLDOWN = 4; // seconds
const MAX_BATTLE_DURATION = 120; // seconds
const SIMULATION_TICK = 0.1; // 100ms per tick

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
 * Calculate hit chance based on attacker and defender attributes
 */
function calculateHitChance(attacker: Robot, defender: Robot): { hitChance: number; breakdown: FormulaBreakdown } {
  const baseHitChance = 70;
  const targetingBonus = Number(attacker.targetingSystems) / 2;
  const stanceBonus = attacker.stance === 'offensive' ? 5 : 0;
  const evasionPenalty = Number(defender.evasionThrusters) / 3;
  const gyroPenalty = Number(defender.gyroStabilizers) / 5;
  
  const calculated = baseHitChance + targetingBonus + stanceBonus - evasionPenalty - gyroPenalty;
  const randomVariance = random(-10, 10);
  const final = clamp(calculated + randomVariance, 10, 95);
  
  return {
    hitChance: final,
    breakdown: {
      calculation: `${baseHitChance} base + ${targetingBonus.toFixed(1)} targeting + ${stanceBonus} stance - ${evasionPenalty.toFixed(1)} evasion - ${gyroPenalty.toFixed(1)} gyro + ${randomVariance.toFixed(1)} variance`,
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
function calculateCritChance(attacker: Robot): { critChance: number; breakdown: FormulaBreakdown } {
  const baseCrit = 5;
  const critBonus = Number(attacker.criticalSystems) / 8;
  const targetingBonus = Number(attacker.targetingSystems) / 25;
  const loadoutBonus = attacker.loadoutType === 'two_handed' ? 10 : 0;
  
  const calculated = baseCrit + critBonus + targetingBonus + loadoutBonus;
  const randomVariance = random(-10, 10);
  const final = clamp(calculated + randomVariance, 0, 50);
  
  return {
    critChance: final,
    breakdown: {
      calculation: `${baseCrit} base + ${critBonus.toFixed(1)} crit_systems + ${targetingBonus.toFixed(1)} targeting + ${loadoutBonus} loadout + ${randomVariance.toFixed(1)} variance`,
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
function calculateBaseDamage(attacker: Robot, weaponBaseDamage: number): { damage: number; breakdown: FormulaBreakdown } {
  const combatPowerMult = 1 + Number(attacker.combatPower) / 100;
  let damage = weaponBaseDamage * combatPowerMult;
  
  // Loadout modifiers
  const loadoutMult = attacker.loadoutType === 'two_handed' ? 1.25 : 
                      attacker.loadoutType === 'dual_wield' ? 0.90 : 1.0;
  damage *= loadoutMult;
  
  // Weapon control
  const controlMult = 1 + Number(attacker.weaponControl) / 100;
  damage *= controlMult;
  
  // Stance modifiers
  const stanceMult = attacker.stance === 'offensive' ? 1.15 :
                     attacker.stance === 'defensive' ? 0.90 : 1.0;
  damage *= stanceMult;
  
  return {
    damage,
    breakdown: {
      calculation: `${weaponBaseDamage} base × ${combatPowerMult.toFixed(2)} combat_power × ${loadoutMult.toFixed(2)} loadout × ${controlMult.toFixed(2)} weapon_control × ${stanceMult.toFixed(2)} stance`,
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
 */
function applyDamage(
  baseDamage: number,
  attacker: Robot,
  defender: Robot,
  defenderState: RobotCombatState,
  isCritical: boolean
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
  
  let shieldDamage = 0;
  let hpDamage = 0;
  
  if (defenderState.currentShield > 0) {
    // Shields absorb at 70% effectiveness
    const shieldAbsorption = damage * 0.7;
    const penetrationMult = 1 + Number(attacker.penetration) / 200;
    const effectiveShieldDamage = shieldAbsorption * penetrationMult;
    
    shieldDamage = Math.min(effectiveShieldDamage, defenderState.currentShield);
    defenderState.currentShield -= shieldDamage;
    
    // Bleed-through damage at reduced rate
    if (effectiveShieldDamage > defenderState.currentShield) {
      const overflow = (effectiveShieldDamage - defenderState.currentShield) * 0.3;
      const armorReduction = Number(defender.armorPlating) * (1 - Number(attacker.penetration) / 150);
      hpDamage = Math.max(1, overflow - armorReduction);
    }
  } else {
    // No shield - damage goes to HP with armor reduction
    const armorReduction = Number(defender.armorPlating) * (1 - Number(attacker.penetration) / 150);
    hpDamage = Math.max(1, damage - armorReduction);
  }
  
  defenderState.currentHP = Math.max(0, defenderState.currentHP - hpDamage);
  
  return {
    hpDamage,
    shieldDamage,
    breakdown: {
      calculation: `${baseDamage.toFixed(1)} base × ${critMultiplier.toFixed(2)} crit → ${shieldDamage.toFixed(1)} shield, ${hpDamage.toFixed(1)} HP`,
      components: {
        baseDamage,
        critMultiplier,
        penetration: Number(attacker.penetration),
        armor: Number(defender.armorPlating),
      },
      result: hpDamage + shieldDamage,
    },
  };
}

/**
 * Calculate counter-attack chance
 */
function calculateCounterChance(defender: Robot): number {
  let baseCounter = Number(defender.counterProtocols) / 100;
  
  if (defender.stance === 'defensive') {
    baseCounter *= 1.15;
  }
  
  if (defender.loadoutType === 'weapon_shield') {
    baseCounter *= 1.10;
  }
  
  return clamp(baseCounter * 100, 0, 40);
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
 * Simulate a complete battle between two robots
 */
export function simulateBattle(robot1: Robot, robot2: Robot): CombatResult {
  // Initialize combat state
  const state1: RobotCombatState = {
    robot: robot1,
    currentHP: robot1.currentHP,
    maxHP: robot1.maxHP,
    currentShield: robot1.currentShield,
    maxShield: robot1.maxShield,
    lastAttackTime: 0,
    attackCooldown: BASE_WEAPON_COOLDOWN / (1 + Number(robot1.attackSpeed) / 50),
    totalDamageDealt: 0,
    totalDamageTaken: 0,
  };
  
  const state2: RobotCombatState = {
    robot: robot2,
    currentHP: robot2.currentHP,
    maxHP: robot2.maxHP,
    currentShield: robot2.currentShield,
    maxShield: robot2.maxShield,
    lastAttackTime: 0,
    attackCooldown: BASE_WEAPON_COOLDOWN / (1 + Number(robot2.attackSpeed) / 50),
    totalDamageDealt: 0,
    totalDamageTaken: 0,
  };
  
  const events: CombatEvent[] = [];
  let currentTime = 0;
  let battleEnded = false;
  let winnerId: number | null = null;
  
  // Battle start event
  events.push({
    timestamp: 0,
    type: 'attack',
    message: `⚔️ Battle commences! ${robot1.name} (${robot1.stance}) vs ${robot2.name} (${robot2.stance})`,
    robot1HP: state1.currentHP,
    robot2HP: state2.currentHP,
    robot1Shield: state1.currentShield,
    robot2Shield: state2.currentShield,
  });
  
  // Main combat loop
  while (currentTime < MAX_BATTLE_DURATION && !battleEnded) {
    currentTime += SIMULATION_TICK;
    
    // Regenerate shields
    const shield1Regen = regenerateShields(state1, SIMULATION_TICK);
    const shield2Regen = regenerateShields(state2, SIMULATION_TICK);
    
    // Check if robot1 can attack
    if (currentTime - state1.lastAttackTime >= state1.attackCooldown && state1.currentHP > 0) {
      const { hitChance, breakdown: hitBreakdown } = calculateHitChance(state1.robot, state2.robot);
      const hit = random(0, 100) < hitChance;
      
      if (hit) {
        const { critChance, breakdown: critBreakdown } = calculateCritChance(state1.robot);
        const isCritical = random(0, 100) < critChance;
        
        const weaponDamage = 20; // Base weapon damage (simplified for Phase 1)
        const { damage: baseDamage, breakdown: damageBreakdown } = calculateBaseDamage(state1.robot, weaponDamage);
        const { hpDamage, shieldDamage, breakdown: applyBreakdown } = applyDamage(
          baseDamage,
          state1.robot,
          state2.robot,
          state2,
          isCritical
        );
        
        state1.totalDamageDealt += hpDamage;
        state2.totalDamageTaken += hpDamage;
        
        const totalDamage = hpDamage + shieldDamage;
        events.push({
          timestamp: Number(currentTime.toFixed(1)),
          type: isCritical ? 'critical' : 'attack',
          attacker: robot1.name,
          defender: robot2.name,
          weapon: 'weapon',
          damage: totalDamage,
          shieldDamage,
          hpDamage,
          hit: true,
          critical: isCritical,
          robot1HP: state1.currentHP,
          robot2HP: state2.currentHP,
          robot1Shield: state1.currentShield,
          robot2Shield: state2.currentShield,
          message: isCritical 
            ? `💢 CRITICAL! ${robot1.name} deals ${totalDamage.toFixed(0)} damage (${shieldDamage.toFixed(0)} shield, ${hpDamage.toFixed(0)} HP)`
            : `💥 ${robot1.name} hits for ${totalDamage.toFixed(0)} damage (${shieldDamage.toFixed(0)} shield, ${hpDamage.toFixed(0)} HP)`,
          formulaBreakdown: {
            calculation: `Hit: ${hitBreakdown.calculation} | Damage: ${damageBreakdown.calculation} | Apply: ${applyBreakdown.calculation}`,
            components: { ...hitBreakdown.components, ...damageBreakdown.components, ...applyBreakdown.components },
            result: totalDamage,
          },
        });
        
        // Check for counter-attack
        if (state2.currentHP > 0) {
          const counterChance = calculateCounterChance(state2.robot);
          if (random(0, 100) < counterChance) {
            const counterDamage = baseDamage * 0.7;
            const { hpDamage: counterHP } = applyDamage(counterDamage, state2.robot, state1.robot, state1, false);
            
            state2.totalDamageDealt += counterHP;
            state1.totalDamageTaken += counterHP;
            
            events.push({
              timestamp: Number(currentTime.toFixed(1)),
              type: 'counter',
              attacker: robot2.name,
              defender: robot1.name,
              damage: counterHP,
              hpDamage: counterHP,
              counter: true,
              robot1HP: state1.currentHP,
              robot2HP: state2.currentHP,
              robot1Shield: state1.currentShield,
              robot2Shield: state2.currentShield,
              message: `🔄 ${robot2.name} counters for ${counterHP.toFixed(0)} damage!`,
            });
          }
        }
      } else {
        events.push({
          timestamp: Number(currentTime.toFixed(1)),
          type: 'miss',
          attacker: robot1.name,
          defender: robot2.name,
          hit: false,
          robot1HP: state1.currentHP,
          robot2HP: state2.currentHP,
          robot1Shield: state1.currentShield,
          robot2Shield: state2.currentShield,
          message: `❌ ${robot1.name} misses ${robot2.name}`,
          formulaBreakdown: hitBreakdown,
        });
      }
      
      state1.lastAttackTime = currentTime;
    }
    
    // Check if robot2 can attack
    if (currentTime - state2.lastAttackTime >= state2.attackCooldown && state2.currentHP > 0) {
      const { hitChance, breakdown: hitBreakdown } = calculateHitChance(state2.robot, state1.robot);
      const hit = random(0, 100) < hitChance;
      
      if (hit) {
        const { critChance, breakdown: critBreakdown } = calculateCritChance(state2.robot);
        const isCritical = random(0, 100) < critChance;
        
        const weaponDamage = 20;
        const { damage: baseDamage, breakdown: damageBreakdown } = calculateBaseDamage(state2.robot, weaponDamage);
        const { hpDamage, shieldDamage, breakdown: applyBreakdown } = applyDamage(
          baseDamage,
          state2.robot,
          state1.robot,
          state1,
          isCritical
        );
        
        state2.totalDamageDealt += hpDamage;
        state1.totalDamageTaken += hpDamage;
        
        const totalDamage = hpDamage + shieldDamage;
        events.push({
          timestamp: Number(currentTime.toFixed(1)),
          type: isCritical ? 'critical' : 'attack',
          attacker: robot2.name,
          defender: robot1.name,
          weapon: 'weapon',
          damage: totalDamage,
          shieldDamage,
          hpDamage,
          hit: true,
          critical: isCritical,
          robot1HP: state1.currentHP,
          robot2HP: state2.currentHP,
          robot1Shield: state1.currentShield,
          robot2Shield: state2.currentShield,
          message: isCritical
            ? `💢 CRITICAL! ${robot2.name} deals ${totalDamage.toFixed(0)} damage (${shieldDamage.toFixed(0)} shield, ${hpDamage.toFixed(0)} HP)`
            : `💥 ${robot2.name} hits for ${totalDamage.toFixed(0)} damage (${shieldDamage.toFixed(0)} shield, ${hpDamage.toFixed(0)} HP)`,
          formulaBreakdown: {
            calculation: `Hit: ${hitBreakdown.calculation} | Damage: ${damageBreakdown.calculation} | Apply: ${applyBreakdown.calculation}`,
            components: { ...hitBreakdown.components, ...damageBreakdown.components, ...applyBreakdown.components },
            result: totalDamage,
          },
        });
        
        // Check for counter-attack
        if (state1.currentHP > 0) {
          const counterChance = calculateCounterChance(state1.robot);
          if (random(0, 100) < counterChance) {
            const counterDamage = baseDamage * 0.7;
            const { hpDamage: counterHP } = applyDamage(counterDamage, state1.robot, state2.robot, state2, false);
            
            state1.totalDamageDealt += counterHP;
            state2.totalDamageTaken += counterHP;
            
            events.push({
              timestamp: Number(currentTime.toFixed(1)),
              type: 'counter',
              attacker: robot1.name,
              defender: robot2.name,
              damage: counterHP,
              hpDamage: counterHP,
              counter: true,
              robot1HP: state1.currentHP,
              robot2HP: state2.currentHP,
              robot1Shield: state1.currentShield,
              robot2Shield: state2.currentShield,
              message: `🔄 ${robot1.name} counters for ${counterHP.toFixed(0)} damage!`,
            });
          }
        }
      } else {
        events.push({
          timestamp: Number(currentTime.toFixed(1)),
          type: 'miss',
          attacker: robot2.name,
          defender: robot1.name,
          hit: false,
          robot1HP: state1.currentHP,
          robot2HP: state2.currentHP,
          robot1Shield: state1.currentShield,
          robot2Shield: state2.currentShield,
          message: `❌ ${robot2.name} misses ${robot1.name}`,
          formulaBreakdown: hitBreakdown,
        });
      }
      
      state2.lastAttackTime = currentTime;
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
  };
}
