/**
 * Combat Simulator — State initialization and result compilation.
 */

import { euclideanDistance, angleBetween } from '../../arena/vector2d';
import { canAttack, classifyRangeBand, getRangePenalty } from '../../arena/rangeBands';
import { calculateHydraulicBonus } from '../../arena/hydraulicBonus';
import { calculateLogicCoresBonus } from '../../arena/logicCoresBonus';
import { checkBackstab, checkFlanking, type PositionedRobot } from '../../arena/positionTracker';
import { getEffectiveAdaptation } from '../../arena/adaptationTracker';
import { calculatePressureEffects } from '../../arena/pressureSystem';
import { calculateBaseSpeed } from '../../arena/servoStrain';
import { checkSyncVolley, getFormationDefenseBonus } from '../../arena/teamCoordination';
import { calculateFocusFireBonus, FOCUS_FIRE_WINDOW_SECONDS } from '../../team-battle/teamCoordinationEffects';
import {
  RobotWithWeapons,
  BattleConfig,
  RobotCombatState,
  CombatEvent,
  CombatResult,
  RangeBand,
  ArenaConfig,
  GameModeState,
  Position,
} from './combatTypes';
import { roundTime, requireHandWeapon } from './combatFormulas';
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
): RobotCombatState {
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
    // Engagement cycle (#520)
    lastMeleeHitTakenAt: null,
    disengageBurstUntil: 0,
    disengageReadyAt: 0,
    disengageScheduledAt: null,
    speedBurst: 'none',
    movementMode: 'normal',
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
    lastHitTakenFrom: {},
  };
}


// ─── Helper: calculate weapon cooldown ───────────────────────────────
export function calcCooldown(robot: RobotWithWeapons, weaponCooldown: number, hand: 'main' | 'offhand'): number {
  const cooldownWithPenalty = hand === 'offhand' ? weaponCooldown * 1.4 : weaponCooldown;
  // Prepared attack speed: base + both weapons + tuning, × loadout modifier (#517).
  const effectiveAttackSpeed = Number(robot.attackSpeed);
  return cooldownWithPenalty / (1 + effectiveAttackSpeed / 50);
}

function positioned(state: RobotCombatState): PositionedRobot {
  return {
    position: state.position,
    facingDirection: state.facingDirection,
    gyroStabilizers: state.numGyroStabilizers,
    threatAnalysis: state.numThreatAnalysis,
  };
}

/** Living teammates of `attacker` targeting `defender` with it in their main weapon's reach. */
function engagingTeammates(
  attacker: RobotCombatState,
  defender: RobotCombatState,
  allStates: RobotCombatState[],
  teamOf: Record<number, number>,
): RobotCombatState[] {
  return allStates.filter((s) => {
    if (s === attacker || !s.isAlive || teamOf[s.teamIndex] !== teamOf[attacker.teamIndex]) return false;
    if (s.currentTarget !== defender.teamIndex) return false;
    const weapon = s.robot.mainWeapon?.weapon;
    return weapon !== undefined && weapon !== null
      && canAttack({ name: weapon.name, rangeBand: weapon.rangeBand as RangeBand }, euclideanDistance(s.position, defender.position));
  });
}

/**
 * Focus fire (team battles): the attacker plus every living teammate that hit
 * `defender` within the last FOCUS_FIRE_WINDOW_SECONDS, scaled by their
 * average syncProtocols. No bonus without a recent teammate hit.
 */
function focusFireFor(
  attacker: RobotCombatState,
  defender: RobotCombatState,
  allStates: RobotCombatState[],
  teamOf: Record<number, number>,
  currentTime: number,
  gameModeState: GameModeState | undefined,
): { bonus: number; contributors: string[] } {
  const contributors = [attacker, ...allStates.filter((s) => {
    if (s === attacker || !s.isAlive || teamOf[s.teamIndex] !== teamOf[attacker.teamIndex]) return false;
    const lastHit = defender.lastHitTakenFrom[s.teamIndex];
    return lastHit !== undefined && currentTime - lastHit <= FOCUS_FIRE_WINDOW_SECONDS;
  })];
  if (contributors.length < 2) return { bonus: 0, contributors: [] };
  const teamSize = Number(gameModeState?.customData?.teamSize ?? contributors.length);
  const avgSync = contributors.reduce((sum, s) => sum + Number(s.robot.syncProtocols ?? 0), 0) / contributors.length;
  const bonus = calculateFocusFireBonus(avgSync, contributors.length, teamSize);
  return { bonus, contributors: bonus > 0 ? contributors.map((s) => s.robot.name) : [] };
}

// ─── Helper: build spatial context for an attack pair ────────────────
export function buildSpatialContext(
  attacker: RobotCombatState,
  defender: RobotCombatState,
  hand: 'main' | 'offhand',
  currentTime: number,
  arena: ArenaConfig,
  allStates: RobotCombatState[],
  gameModeState?: GameModeState,
  cachedPosSnapshot?: { positions: Record<string, Position>; facingDirections: Record<string, number> },
): {
  distance: number;
  rangeBand: RangeBand;
  rangePenaltyMult: number;
  hydraulicMult: number;
  logicCoresMult: number;
  positionalBonus: number;
  focusFireBonus: number;
  focusFireContributors: string[];
  adaptationHit: number;
  adaptationDmg: number;
  pressureAccuracy: number;
  pressureDamage: number;
  combatAlgorithmScore: number;
  syncVolleyBonus: number;
  formationDefenseBonus: number;
  positionSnapshot: { positions: Record<string, Position>; facingDirections: Record<string, number> };
  isBackstab: boolean;
  isFlanking: boolean;
  attackAngle: number;
  passiveAccuracyPenalty: number;
  passiveDamageReduction: number;
} {
  const dist = euclideanDistance(attacker.position, defender.position);
  const rangeBand = classifyRangeBand(dist);

  const weapon = requireHandWeapon(attacker.robot, hand);
  const rangePenaltyMult = getRangePenalty(weapon.rangeBand as RangeBand, rangeBand);
  const hydraulicMult = calculateHydraulicBonus(attacker.numHydraulicSystems, rangeBand);
  const logicCoresMult = calculateLogicCoresBonus(attacker.numLogicCores, rangeBand);

  const attackerPos = positioned(attacker);
  const defenderPos = positioned(defender);
  const backstabResult = checkBackstab(attackerPos, defenderPos);
  const teamOf = gameModeState?.customData?.teamOf as Record<number, number> | undefined;
  const flankingResult = teamOf
    ? checkFlanking(
      attackerPos,
      Number(attacker.robot.formationTactics ?? 0),
      engagingTeammates(attacker, defender, allStates, teamOf).map(positioned),
      defenderPos,
    )
    : { isFlanking: false, bonus: 0 };
  const focusFire = teamOf
    ? focusFireFor(attacker, defender, allStates, teamOf, currentTime, gameModeState)
    : { bonus: 0, contributors: [] };
  // One positional bonus per hit: the larger of backstab and flanking.
  const isFlanking = flankingResult.isFlanking && flankingResult.bonus >= backstabResult.bonus;

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
    logicCoresMult,
    positionalBonus: isFlanking ? flankingResult.bonus : backstabResult.bonus,
    focusFireBonus: focusFire.bonus,
    focusFireContributors: focusFire.contributors,
    adaptationHit: adaptation.hitBonus,
    adaptationDmg: adaptation.damageBonus,
    pressureAccuracy: pressure.accuracyMod,
    pressureDamage: pressure.damageMod,
    combatAlgorithmScore: attacker.combatAlgorithmScore,
    syncVolleyBonus: syncBonus,
    formationDefenseBonus: formationBonus,
    positionSnapshot: cachedPosSnapshot ?? buildPositionSnapshot(...allStates),
    isBackstab: backstabResult.isBackstab && !isFlanking,
    isFlanking,
    attackAngle: backstabResult.angle,
    passiveAccuracyPenalty,
    passiveDamageReduction,
  };
}


/**
 * Handle time limit reached — emit appropriate event and determine winner via HP tiebreaker.
 */
export function handleTimeLimitReached(
  states: RobotCombatState[],
  config: BattleConfig,
  events: { push: (...args: CombatEvent[]) => number },
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
  states: RobotCombatState[],
  rawEvents: CombatEvent[],
  currentTime: number,
  winnerId: number | null,
  winReason: string | undefined,
  arena: ArenaConfig,
  startingPositions: Record<string, Position>,
  gameModeState: GameModeState | undefined,
  _config: BattleConfig,
): CombatResult {
  const endingPositions: Record<string, Position> = {};
  for (const s of states) {
    endingPositions[s.robot.name] = { x: s.position.x, y: s.position.y };
  }

  // Build kothMetadata if game mode state has zone scores
  let kothMetadata: CombatResult['kothMetadata'];
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
