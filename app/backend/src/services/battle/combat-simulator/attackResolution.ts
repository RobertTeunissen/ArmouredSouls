/**
 * Combat Simulator — Attack resolution logic.
 */

import { updateAdaptation } from '../../arena/adaptationTracker';
import { resolveCounter } from '../../arena/counterAttack';
import {
  CombatEvent,
  SpatialRobotCombatState,
  RangeBand,
  Position,
  WeaponLike,
} from './combatTypes';
import {
  roundTime,
  random,
  getWeaponInfo,
  calculateMalfunctionChance,
  calculateHitChance,
  calculateCritChance,
  calculateBaseDamage,
  applyDamage,
  calculateCounterChance,
} from './combatFormulas';

/**
 * Build position snapshot for events
 */
export function buildPositionSnapshot(
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
export function buildHPShieldSnapshot(
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
export function performAttack(
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
    passiveAccuracyPenalty?: number;
    passiveDamageReduction?: number;
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
      timestamp: roundTime(currentTime),
      type: 'malfunction',
      attacker: attackerName,
      defender: defenderName,
      weapon: weaponInfo.name,
      customName: weaponInfo.customName,
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
        components: { ...malfunctionBreakdown.components, malfunctionRoll, malfunctionChance: malfunctionBreakdown.result },
        result: 0,
      },
      ...spatialContext.positionSnapshot,
      distance: spatialContext.distance,
      rangeBand: spatialContext.rangeBand,
    });
    // Update adaptation on miss (malfunction counts as miss for adaptation)
    const malfAdaptState = {
      adaptiveAI: attackerState.numAdaptiveAI,
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
    { adaptationHitBonus: spatialContext.adaptationHit, pressureAccuracyMod: spatialContext.pressureAccuracy, combatAlgorithmScore: spatialContext.combatAlgorithmScore, passiveAccuracyPenalty: spatialContext.passiveAccuracyPenalty ?? 0 }
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
    // Apply KoTH passive damage reduction (stays outside zone too long)
    const passiveDmgReduction = spatialContext.passiveDamageReduction ?? 0;
    const effectiveBaseDamage = baseDamage * (1 - passiveDmgReduction);
    const { hpDamage, shieldDamage, breakdown: applyBreakdown } = applyDamage(
      effectiveBaseDamage, attackerState.robot, defenderState.robot, defenderState, isCritical, hand,
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
      timestamp: roundTime(currentTime),
      type: isCritical ? 'critical' : 'attack',
      attacker: attackerName,
      defender: defenderName,
      weapon: weaponInfo.name,
      customName: weaponInfo.customName,
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
          malfunctionChance: malfunctionBreakdown.result,
          ...hitBreakdown.components, hitRoll,
          hitChance: hitBreakdown.result,
          ...critBreakdown.components, critRoll,
          critChance: critBreakdown.result,
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
      adaptiveAI: defenderState.numAdaptiveAI,
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
      timestamp: roundTime(currentTime),
      type: 'miss',
      attacker: attackerName,
      defender: defenderName,
      weapon: weaponInfo.name,
      customName: weaponInfo.customName,
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
          malfunctionChance: malfunctionBreakdown.result,
          ...hitBreakdown.components, hitRoll,
          hitChance: hitBreakdown.result,
          ...critBreakdown.components, critRoll,
          critChance: critBreakdown.result,
        },
        result: 0,
      },
      ...spatialContext.positionSnapshot,
      distance: spatialContext.distance,
      rangeBand: spatialContext.rangeBand,
    });

    // Update adaptation for attacker (miss)
    const atkAdaptState = {
      adaptiveAI: attackerState.numAdaptiveAI,
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
  // Off-hand attacks do not trigger counter-attacks — dual-wield robots should not
  // be penalized with double counter exposure compared to single-weapon builds.
  if (hand === 'offhand') return;
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
      timestamp: roundTime(currentTime),
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
      timestamp: roundTime(currentTime),
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
          counterHitChanceBase: counterHitBreakdown.components.hitChanceBase ?? counterHitChance,
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
      timestamp: roundTime(currentTime),
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
        components: { counterChance, counterRoll, counterHitChance, counterHitRoll, counterHitChanceBase: counterHitBreakdown.components.hitChanceBase ?? counterHitChance },
        result: 0,
      },
      ...spatialContext.positionSnapshot,
      distance: spatialContext.distance,
      rangeBand: spatialContext.rangeBand,
    });
  }
}
