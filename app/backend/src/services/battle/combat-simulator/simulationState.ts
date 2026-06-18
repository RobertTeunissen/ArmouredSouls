/**
 * Combat Simulator — State initialization and result compilation.
 */

import { euclideanDistance, angleBetween } from '../../arena/vector2d';
import { classifyRangeBand, getRangePenalty, getWeaponOptimalRange } from '../../arena/rangeBands';
import { calculateHydraulicBonus } from '../../arena/hydraulicBonus';
import { checkBackstab } from '../../arena/positionTracker';
import { getEffectiveAdaptation } from '../../arena/adaptationTracker';
import { calculatePressureEffects } from '../../arena/pressureSystem';
import { calculateBaseSpeed } from '../../arena/servoStrain';
import { checkSyncVolley, getFormationDefenseBonus } from '../../arena/teamCoordination';
import {
  RobotWithWeapons,
  BattleConfig,
  SpatialRobotCombatState,
  SpatialCombatEvent,
  SpatialCombatResult,
  RangeBand,
  ArenaConfig,
  GameModeState,
  Position,
  WeaponLike,
  BASE_WEAPON_COOLDOWN,
} from './combatTypes';
import { roundTime } from './combatFormulas';
import { buildPositionSnapshot } from './attackResolution';


/**
 * Initialize extended combat state with spatial fields.
 * Pure function — creates a fresh state object from robot data and spawn position.
 */
export function initializeCombatState(
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
    // Pre-computed numeric attributes (avoids Decimal→number per tick)
    numServoMotors: servoMotors,
    numGyroStabilizers: Number(robot.gyroStabilizers ?? 1),
    numThreatAnalysis: Number(robot.threatAnalysis ?? 1),
    numAdaptiveAI: Number(robot.adaptiveAI ?? 1),
    numLogicCores: Number(robot.logicCores ?? 1),
    numHydraulicSystems: Number(robot.hydraulicSystems ?? 0),
    numPowerCore: Number(robot.powerCore ?? 1),
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
    targetLockTimer: 0,
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


// ─── Helper: calculate weapon cooldown ───────────────────────────────
export function calcCooldown(robot: RobotWithWeapons, weaponCooldown: number | undefined, hand: 'main' | 'offhand'): number {
  const baseCooldown = weaponCooldown || BASE_WEAPON_COOLDOWN;
  const cooldownWithPenalty = hand === 'offhand' ? baseCooldown * 1.4 : baseCooldown;
  const effectiveAttackSpeed = Number(robot.attackSpeed);
  return cooldownWithPenalty / (1 + effectiveAttackSpeed / 50);
}

// ─── Helper: build spatial context for an attack pair ────────────────
export function buildSpatialContext(
  attacker: SpatialRobotCombatState,
  defender: SpatialRobotCombatState,
  hand: 'main' | 'offhand',
  currentTime: number,
  arena: ArenaConfig,
  allStates: SpatialRobotCombatState[],
  gameModeState?: GameModeState,
  cachedPosSnapshot?: { positions: Record<string, Position>; facingDirections: Record<string, number> },
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
  passiveAccuracyPenalty: number;
  passiveDamageReduction: number;
} {
  const dist = euclideanDistance(attacker.position, defender.position);
  const rangeBand = classifyRangeBand(dist);

  const weapon = hand === 'main' ? attacker.robot.mainWeapon?.weapon : attacker.robot.offhandWeapon?.weapon;
  const weaponLike: WeaponLike | null = weapon ? { name: weapon.name, rangeBand: weapon.rangeBand as RangeBand } : null;
  const optimalRange = weaponLike ? getWeaponOptimalRange(weaponLike) : 'short';
  const rangePenaltyMult = getRangePenalty(optimalRange, rangeBand);
  const hydraulicMult = calculateHydraulicBonus(attacker.numHydraulicSystems, rangeBand);

  const backstabResult = checkBackstab(
    { position: attacker.position, facingDirection: attacker.facingDirection, gyroStabilizers: attacker.numGyroStabilizers, threatAnalysis: attacker.numThreatAnalysis },
    { position: defender.position, facingDirection: defender.facingDirection, gyroStabilizers: defender.numGyroStabilizers, threatAnalysis: defender.numThreatAnalysis },
  );

  const adaptation = getEffectiveAdaptation({
    adaptiveAI: attacker.numAdaptiveAI,
    adaptationHitBonus: attacker.adaptationHitBonus,
    adaptationDamageBonus: attacker.adaptationDamageBonus,
    currentHP: attacker.currentHP,
    maxHP: attacker.maxHP,
  });

  const pressure = calculatePressureEffects({
    logicCores: attacker.numLogicCores,
    currentHP: attacker.currentHP,
    maxHP: attacker.maxHP,
  });

  const syncBonus = checkSyncVolley(attacker, currentTime);
  const formationBonus = getFormationDefenseBonus(defender, arena);

  // KoTH passive penalties (damage reduction + accuracy penalty for staying outside zone)
  let passiveAccuracyPenalty = 0;
  let passiveDamageReduction = 0;
  if (gameModeState?.customData?.scoreState) {
    const scoreState = gameModeState.customData.scoreState as { passivePenalties?: Record<number, { damageReduction: number; accuracyPenalty: number }> };
    const penalties = scoreState.passivePenalties?.[attacker.robot.id];
    if (penalties) {
      passiveAccuracyPenalty = (penalties.accuracyPenalty ?? 0) * 100; // convert 0.15 → 15%
      passiveDamageReduction = penalties.damageReduction ?? 0; // already 0-0.30
    }
  }

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
    positionSnapshot: cachedPosSnapshot ?? buildPositionSnapshot(...allStates),
    isBackstab: backstabResult.isBackstab,
    attackAngle: backstabResult.angle,
    passiveAccuracyPenalty,
    passiveDamageReduction,
  };
}


/**
 * Handle time limit reached — emit appropriate event and determine winner via HP tiebreaker.
 */
export function handleTimeLimitReached(
  states: SpatialRobotCombatState[],
  config: BattleConfig,
  events: { push: (...args: SpatialCombatEvent[]) => number },
  currentTime: number,
  getPositionSnapshot: () => { positions: Record<string, Position>; facingDirections: Record<string, number> },
): void {
  if (!config.allowDraws) {
    const alive = states.filter(s => s.isAlive);
    alive.sort((a, b) => (b.currentHP / b.maxHP) - (a.currentHP / a.maxHP));
    if (alive.length > 0) {
      const pct = ((alive[0].currentHP / alive[0].maxHP) * 100).toFixed(1);
      events.push({
        timestamp: roundTime(currentTime),
        type: 'yield',
        message: `⏱️ Time limit! ${alive[0].robot.name} wins by HP (${pct}%)`,
        robot1HP: states[0]?.currentHP ?? 0,
        robot2HP: states[1]?.currentHP ?? 0,
        robot1Shield: states[0]?.currentShield ?? 0,
        robot2Shield: states[1]?.currentShield ?? 0,
        ...getPositionSnapshot(),
      });
    }
  } else {
    events.push({
      timestamp: roundTime(currentTime),
      type: 'yield',
      message: `⏱️ Time limit reached - Draw!`,
      robot1HP: states[0]?.currentHP ?? 0,
      robot2HP: states[1]?.currentHP ?? 0,
      robot1Shield: states[0]?.currentShield ?? 0,
      robot2Shield: states[1]?.currentShield ?? 0,
      ...getPositionSnapshot(),
    });
  }
}

/**
 * Compile the final battle result from simulation state.
 */
export function compileBattleResult(
  states: SpatialRobotCombatState[],
  rawEvents: SpatialCombatEvent[],
  currentTime: number,
  winnerId: number | null,
  winReason: string | undefined,
  arena: ArenaConfig,
  startingPositions: Record<string, Position>,
  gameModeState: GameModeState | undefined,
  _config: BattleConfig,
): SpatialCombatResult {
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
      matchDuration: roundTime(currentTime),
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
    durationSeconds: roundTime(currentTime),
    isDraw: winnerId === null,
    events: rawEvents,
    arenaRadius: arena.radius,
    startingPositions,
    endingPositions,
    kothMetadata,
    finalStates: states,
  };
}
