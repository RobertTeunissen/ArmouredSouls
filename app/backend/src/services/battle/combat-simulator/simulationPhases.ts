/**
 * Combat Simulator — the per-tick phases of the simulation loop.
 *
 * `simulateBattleMulti` (simulationLoop) sets the battle up and calls these in
 * order every tick: movement, facing, range transitions, attacks, shield
 * regen, state checks, battle end, movement events. Each phase reads and
 * writes the shared `SimulationContext`; the order is part of the combat
 * rules and must not change.
 */

import { euclideanDistance } from '../../arena/vector2d';
import { classifyRangeBand, canAttack } from '../../arena/rangeBands';
import { calculateTurnSpeed, updateFacing } from '../../arena/positionTracker';
import { calculateEffectiveSpeed, updateServoStrain, ServoStrainState } from '../../arena/servoStrain';
import {
  calculateMovementIntent,
  applyMovement,
  enforceTeamSeparation,
  getEngagementRange,
  getPatienceLimit,
  RANGE_BAND_MIDPOINTS,
} from '../../arena/movementAI';
import { getEngagementRole, isMeleeCommitActive, updateDisengage, isDisengageActive } from '../../arena/engagementCycle';
import { getSupportShieldBoost } from '../../arena/teamCoordination';
import { selectTarget } from '../../arena/threatScoring';
import type { MovementIntent } from '../../arena/types';
import type { SpatialGrid } from './spatialGrid';
import {
  BattleConfig,
  SpatialRobotCombatState,
  SpatialCombatEvent,
  RangeBand,
  ArenaConfig,
  GameModeConfig,
  GameModeState,
  Position,
  WeaponLike,
  SIMULATION_TICK,
  MOVEMENT_EVENT_THRESHOLD,
  MOVEMENT_EVENT_MIN_INTERVAL,
} from './combatTypes';
import { roundTime, regenerateShields, shouldYield } from './combatFormulas';
import { performAttack, AttackOutcome } from './attackResolution';
import { buildSpatialContext } from './simulationState';

/** Seconds between full AI evaluations for distant robots (variable tick rate, Spec #44 R1.3). */
const VARIABLE_TICK_INTERVAL = 0.5;
/** Units: a robot farther than this from every opponent is "distant". */
const VARIABLE_TICK_DISTANCE = 50;

/** Position snapshot attached to events, cached once per tick. */
export type PositionSnapshot = { positions: Record<string, Position>; facingDirections: Record<string, number> };

/** Battle-wide state shared by the tick phases. */
export interface SimulationContext {
  n: number;
  states: SpatialRobotCombatState[];
  arena: ArenaConfig;
  config: BattleConfig;
  gameModeConfig: GameModeConfig | undefined;
  gameModeState: GameModeState | undefined;
  /** O(1) lookup by teamIndex. */
  stateByTeamIndex: Map<number, SpatialRobotCombatState>;
  /** Spatial grid for threat evaluation, or null (2-robot battles, or disabled). */
  spatialGrid: SpatialGrid | null;
  /** Variable tick rate: robots far from all opponents skip AI re-evaluation. */
  useVariableTick: boolean;
  lastAITick: number[];
  /** Array-like event sink: `push` injects HP/shield snapshots. */
  events: SpatialCombatEvent[];
  /** Movement event throttling per robot. */
  lastMoveEventTime: number[];
  lastMoveEventPos: Position[];
  /** Range band per robot → target, for transition events. */
  lastRangeBandToTarget: Map<number, RangeBand>;
  /** Out-of-range message suppression: one per streak, until the robot attacks. */
  outOfRangeSuppressed: Set<number>;
  getPositionSnapshot: () => PositionSnapshot;
}

/** How a battle ended this tick. */
export interface BattleEnd {
  winnerId: number | null;
  winReason: string | undefined;
}

/**
 * Nearest living opponent the given weapon can physically reach, measured to that
 * opponent's own position (#518). Teammates (team modes) and the attacker itself are
 * skipped. Returns null when no opponent is in reach.
 */
function findNearestOpponentInReach(
  attacker: SpatialRobotCombatState,
  weapon: WeaponLike,
  states: SpatialRobotCombatState[],
  gameModeState: GameModeState | undefined,
): { target: SpatialRobotCombatState; distance: number } | null {
  const teamOfMap = gameModeState?.customData?.teamOf as Record<number, number> | undefined;
  let nearest: { target: SpatialRobotCombatState; distance: number } | null = null;
  for (const s of states) {
    if (s === attacker || !s.isAlive) continue;
    // Skip teammates in team modes
    if (teamOfMap && teamOfMap[s.teamIndex] === teamOfMap[attacker.teamIndex]) continue;
    // Fallback for non-team modes: skip same teamIndex (self only)
    if (!teamOfMap && s.teamIndex === attacker.teamIndex) continue;
    const d = euclideanDistance(attacker.position, s.position);
    if (canAttack(weapon, d) && (nearest === null || d < nearest.distance)) {
      nearest = { target: s, distance: d };
    }
  }
  return nearest;
}

/** One robot's movement decisions for the current tick (simultaneous movement, #520). */
interface MovementPlan {
  state: SpatialRobotCombatState;
  opponents: SpatialRobotCombatState[];
  target: SpatialRobotCombatState | null;
  servoState?: ServoStrainState;
  intent?: MovementIntent;
  threatPosition?: Position;
}

/** PHASE 1: movement. Every robot decides from the same tick-start snapshot (#520). */
export function runMovementPhase(ctx: SimulationContext, aliveStates: SpatialRobotCombatState[], currentTime: number): void {
  const { states, arena, gameModeConfig, gameModeState, stateByTeamIndex, spatialGrid, useVariableTick, lastAITick } = ctx;
  // ── PHASE 1: MOVEMENT (simultaneous, #520 movement fix) ──
  // Every robot decides from the same tick-start snapshot: targets, speeds and
  // intents are computed for all robots before any robot moves, and each pass
  // only publishes its writes once every robot has read the tick-start values.
  // Robot order therefore never affects movement.
  const teamOfMap = gameModeState?.customData?.teamOf as Record<number, number> | undefined;
  const movers: MovementPlan[] = [];
  const coasting: SpatialRobotCombatState[] = [];

  // Pass 1a: variable tick and target selection (reads tick-start targets)
  const targetDecisions: Array<{ plan: MovementPlan; currentTarget: number | null; targetLockTimer: number }> = [];
  for (const state of aliveStates) {
    // Variable tick rate: skip full AI evaluation for distant robots (Spec #44: R1.3, R1.7)
    // Robot keeps moving at constant velocity — only AI decisions are deferred
    if (useVariableTick) {
      let nearestDist = Infinity;
      for (const s of states) {
        if (s === state || !s.isAlive) continue;
        const d = euclideanDistance(state.position, s.position);
        if (d < nearestDist) nearestDist = d;
      }
      if (nearestDist > VARIABLE_TICK_DISTANCE && currentTime - lastAITick[state.teamIndex] < VARIABLE_TICK_INTERVAL) {
        coasting.push(state);
        continue;
      }
      lastAITick[state.teamIndex] = currentTime;
    }

    // Filter opponents: exclude teammates in team modes so movement AI
    // targets enemies, not allies (prevents clumping on teammates)
    const opponents = states.filter(s => {
      if (s === state || !s.isAlive) return false;
      if (teamOfMap && teamOfMap[s.teamIndex] === teamOfMap[state.teamIndex]) return false;
      if (!teamOfMap && s.teamIndex === state.teamIndex) return false;
      return true;
    });

    // No opponents: skip movement unless a game mode modifier can still direct us
    // (e.g. KotH last-standing phase needs the robot to move toward the zone)
    if (opponents.length === 0 && !gameModeConfig?.movementModifier) continue;

    const plan: MovementPlan = { state, opponents, target: null };
    let currentTarget: number | null = null;
    let targetLockTimer = state.targetLockTimer;

    // Select target via game mode strategy or default threat scoring.
    // Target stickiness: keep current target for at least 1.5s unless it's dead
    // or a new target has significantly higher priority (50%+ more weight).
    if (opponents.length > 0) {
      // Decay target lock timer
      targetLockTimer = Math.max(0, state.targetLockTimer - SIMULATION_TICK);

      // Check if current target is still alive
      const currentTargetAlive = state.currentTarget !== null &&
        (stateByTeamIndex.get(state.currentTarget)?.isAlive ?? false);

      let newTargetIdx: number | null = null;
      if (gameModeConfig?.targetPriority) {
        const priorities = gameModeConfig.targetPriority.selectTargets(
          state, opponents, arena, gameModeState,
        );
        newTargetIdx = priorities.length > 0 ? priorities[0] : null;
      }
      if (newTargetIdx === null) {
        // Use spatial grid to limit threat evaluation to nearby robots (Spec #44: R1.2)
        const threatCandidates = spatialGrid
          ? opponents.filter(o => spatialGrid.getNearby(state.teamIndex).includes(o.teamIndex))
          : opponents;
        // Fall back to full opponents if spatial grid returns empty (edge case: all far away)
        const evalTargets = threatCandidates.length > 0 ? threatCandidates : opponents;
        const threat = selectTarget(state, evalTargets, arena.radius);
        newTargetIdx = threat?.robotIndex ?? opponents[0].teamIndex;
      }

      currentTarget = state.currentTarget;
      // Apply target stickiness: only switch if lock expired or current target dead
      if (!currentTargetAlive || state.currentTarget === null) {
        // Must switch — current target is gone
        currentTarget = newTargetIdx;
        targetLockTimer = 1.5; // Lock onto new target for 1.5s
      } else if (targetLockTimer <= 0 && newTargetIdx !== state.currentTarget) {
        // Lock expired and a different target is preferred — switch
        currentTarget = newTargetIdx;
        targetLockTimer = 1.5;
      }
      // else: keep current target (lock still active or same target selected)

      plan.target = stateByTeamIndex.get(currentTarget!) ?? opponents[0];
    }
    targetDecisions.push({ plan, currentTarget, targetLockTimer });
  }
  for (const { plan, currentTarget, targetLockTimer } of targetDecisions) {
    plan.state.currentTarget = currentTarget;
    plan.state.targetLockTimer = targetLockTimer;
    movers.push(plan);
  }

  // Pass 1b: engagement cycle and effective speed (each robot writes only its own state)
  for (const plan of movers) {
    const { state, target } = plan;
    // Engagement cycle (#520): roles from both robots' engagement ranges;
    // the ranged disengage burst starts 2.5 s after the first melee hit
    const range = getEngagementRange(state, target);
    const role = getEngagementRole(range);
    const opponentRole = target ? getEngagementRole(getEngagementRange(target, state)) : null;
    const engagementRangeMidpoint = RANGE_BAND_MIDPOINTS[range];
    const distToTarget = target ? euclideanDistance(state.position, target.position) : 0;
    const patienceLimit = getPatienceLimit(state.combatAlgorithmScore);
    updateDisengage(state, {
      role,
      currentTime,
      evasionThrusters: Number(state.robot.evasionThrusters),
      cooldownSeconds: patienceLimit,
    });
    state.speedBurst = isDisengageActive(state, currentTime)
      ? 'ranged_disengage'
      : isMeleeCommitActive({
          role,
          opponentRole,
          patienceTimer: state.patienceTimer,
          patienceLimit,
          distance: distToTarget,
        })
        ? 'melee_commit'
        : 'none';

    // Effective speed with servo strain
    const servoState: ServoStrainState = {
      servoMotors: state.numServoMotors,
      servoStrain: state.servoStrain,
      sustainedMovementTime: state.sustainedMovementTime,
      isUsingClosingBonus: state.isUsingClosingBonus,
      stance: (state.robot.stance ?? 'balanced') as 'defensive' | 'offensive' | 'balanced',
      role,
      engagementRangeMidpoint,
      speedBurst: state.speedBurst,
      distanceToTarget: distToTarget,
      currentSpeedRatio: 0,
      // Season 2 round 3: ranged vs ranged kiting / pursuit compares both midpoints
      opponentEngagementMidpoint: target ? RANGE_BAND_MIDPOINTS[getEngagementRange(target, state)] : null,
    };
    const { effectiveSpeed, isClosingBonus, mode } = calculateEffectiveSpeed(servoState, opponentRole);
    state.effectiveMovementSpeed = effectiveSpeed;
    state.isUsingClosingBonus = isClosingBonus;
    state.movementMode = mode;
    plan.servoState = servoState;
  }

  // Pass 1c: movement intents (reads tick-start positions, velocities and intents)
  for (const plan of movers) {
    const { state, opponents, target } = plan;
    let intent = calculateMovementIntent(
      state, opponents, arena, SIMULATION_TICK, gameModeConfig?.movementModifier, gameModeState,
    );

    // Enforce team separation: push apart from teammates to prevent clumping
    if (teamOfMap) {
      const teammates = aliveStates.filter(s =>
        s !== state && teamOfMap[s.teamIndex] === teamOfMap[state.teamIndex]
      );
      if (teammates.length > 0) {
        intent = enforceTeamSeparation(intent, state, teammates);
      }
    }

    plan.intent = intent;
    plan.threatPosition = target ? { x: target.position.x, y: target.position.y } : undefined;
  }

  // Pass 2: apply every move, then servo strain
  for (const plan of movers) {
    const { state, intent, servoState } = plan;
    if (!intent || !servoState) continue;
    state.movementIntent = intent;

    const oldPos = { x: state.position.x, y: state.position.y };
    const newPos = applyMovement(state, intent, arena, SIMULATION_TICK, plan.threatPosition);
    state.position = newPos;
    state.velocity = {
      x: (newPos.x - oldPos.x) / SIMULATION_TICK,
      y: (newPos.y - oldPos.y) / SIMULATION_TICK,
    };

    // Servo strain update
    const actualMove = euclideanDistance(oldPos, newPos);
    const maxMove = state.effectiveMovementSpeed * SIMULATION_TICK;
    servoState.currentSpeedRatio = maxMove > 0 ? actualMove / maxMove : 0;
    servoState.isUsingClosingBonus = state.isUsingClosingBonus;
    servoState.servoStrain = state.servoStrain;
    servoState.sustainedMovementTime = state.sustainedMovementTime;
    updateServoStrain(servoState, SIMULATION_TICK);
    state.servoStrain = servoState.servoStrain;
    state.sustainedMovementTime = servoState.sustainedMovementTime;
  }
  for (const state of coasting) {
    // Not due for AI re-evaluation — move at constant velocity (R1.7: no teleporting)
    state.position = {
      x: state.position.x + state.velocity.x * SIMULATION_TICK,
      y: state.position.y + state.velocity.y * SIMULATION_TICK,
    };
    // Clamp to arena bounds
    const distFromCenter = euclideanDistance(state.position, arena.center);
    if (distFromCenter > arena.radius) {
      const scale = arena.radius / distFromCenter;
      state.position = {
        x: arena.center.x + (state.position.x - arena.center.x) * scale,
        y: arena.center.y + (state.position.y - arena.center.y) * scale,
      };
    }
  }
  // No robot-robot collision handling exists; arena containment is done inside
  // applyMovement and the coasting clamp above.
}

/** PHASE 2: facing toward each robot's current target. */
export function runFacingPhase(ctx: SimulationContext, aliveStates: SpatialRobotCombatState[]): void {
  const { stateByTeamIndex } = ctx;
  // ── PHASE 2: FACING ──
  for (const state of aliveStates) {
    if (state.currentTarget === null) continue;
    const target = stateByTeamIndex.get(state.currentTarget);
    if (!target) continue;
    const turnSpeed = calculateTurnSpeed(state.numGyroStabilizers);
    const facingState = {
      position: state.position,
      facingDirection: state.facingDirection,
      turnSpeed,
    };
    const opponentState = { position: target.position, velocity: target.velocity };
    updateFacing(
      facingState, target.position, SIMULATION_TICK,
      opponentState, state.numThreatAnalysis,
    );
    state.facingDirection = facingState.facingDirection;
  }
}

/** Range transition events per robot → target pair. */
export function emitRangeTransitions(ctx: SimulationContext, aliveStates: SpatialRobotCombatState[], currentTime: number): void {
  const { states, stateByTeamIndex, events, lastMoveEventPos, lastRangeBandToTarget, getPositionSnapshot } = ctx;
  // ── Emit range transition events (per robot → target pair) ──
  for (const state of aliveStates) {
    if (state.currentTarget === null) continue;
    const target = stateByTeamIndex.get(state.currentTarget);
    if (!target) continue;
    const dist = euclideanDistance(state.position, target.position);
    const currentBand = classifyRangeBand(dist);
    const prevBand = lastRangeBandToTarget.get(state.teamIndex);
    if (prevBand !== undefined && currentBand !== prevBand) {
      const closingOrFalling = dist < euclideanDistance(
        lastMoveEventPos[state.teamIndex], target.position,
      ) ? 'closes to' : 'falls back to';
      events.push({
        timestamp: roundTime(currentTime),
        type: 'range_transition',
        attacker: state.robot.name,
        defender: target.robot.name,
        message: `📏 Combat ${closingOrFalling} ${currentBand} range (${dist.toFixed(1)} units)`,
        robot1HP: states[0]?.currentHP ?? 0,
        robot2HP: states[1]?.currentHP ?? 0,
        robot1Shield: states[0]?.currentShield ?? 0,
        robot2Shield: states[1]?.currentShield ?? 0,
        ...getPositionSnapshot(),
        distance: dist,
        rangeBand: currentBand,
      });
    }
    lastRangeBandToTarget.set(state.teamIndex, currentBand);
  }
}

/** PHASE 3: range-gated attacks per robot, then patience timers. */
export function runAttackPhase(ctx: SimulationContext, aliveStates: SpatialRobotCombatState[], currentTime: number): void {
  const { n, states, arena, gameModeState, stateByTeamIndex, events, outOfRangeSuppressed, getPositionSnapshot } = ctx;
  // ── PHASE 3: ATTACKS (range-gated, per robot) ──
  const landedHitThisTick: Set<number> = new Set();

  for (const state of aliveStates) {
    if (state.currentTarget === null) continue;
    let target = stateByTeamIndex.get(state.currentTarget);
    if (!target || !target.isAlive) continue;

    let dist = euclideanDistance(state.position, target.position);
    let didLandHit = false;

    // Main weapon attack
    if (currentTime - state.lastAttackTime >= state.attackCooldown
        && state.currentHP > 0 && state.isAlive) {
      // Main weapon presence is asserted at battle start.
      const weapon = state.robot.mainWeapon!.weapon!;
      const weaponLike: WeaponLike = { name: weapon.name, rangeBand: weapon.rangeBand as RangeBand };

      // Target-of-opportunity: if the weapon can't reach the primary target,
      // attack the nearest opponent within its own reach instead (n > 2 only).
      // Patience never bypasses reach (#518).
      if (!canAttack(weaponLike, dist) && n > 2) {
        const opportunity = findNearestOpponentInReach(state, weaponLike, states, gameModeState);
        if (opportunity) {
          target = opportunity.target;
          dist = opportunity.distance;
        }
      }

      const outcome: AttackOutcome = canAttack(weaponLike, dist)
        ? performAttack(
            state, target, state.robot.name, target.robot.name,
            currentTime, 'main', events,
            buildSpatialContext(state, target, 'main', currentTime, arena, states, gameModeState, getPositionSnapshot()),
          )
        : 'blocked';

      if (outcome !== 'blocked') {
        state.lastAttackTime = currentTime;
        // Patience resets only on a landed hit (#520)
        if (outcome === 'hit') {
          state.patienceTimer = 0;
          didLandHit = true;
        }
        // Reset out-of-range suppression — robot successfully attempted an attack
        outOfRangeSuppressed.delete(state.teamIndex);
      } else {
        // Out-of-range: show one message per streak, suppress until robot attacks
        if (!outOfRangeSuppressed.has(state.teamIndex)) {
          outOfRangeSuppressed.add(state.teamIndex);
          events.push({
            timestamp: roundTime(currentTime),
            type: 'out_of_range',
            attacker: state.robot.name,
            defender: target.robot.name,
            weapon: weaponLike.name,
            message: `🚫 ${state.robot.name}'s ${weaponLike.name} can't reach ${target.robot.name} at ${dist.toFixed(1)} units (need ≤2)`,
            robot1HP: states[0]?.currentHP ?? 0,
            robot2HP: states[1]?.currentHP ?? 0,
            robot1Shield: states[0]?.currentShield ?? 0,
            robot2Shield: states[1]?.currentShield ?? 0,
            ...getPositionSnapshot(),
            distance: dist,
            rangeBand: classifyRangeBand(dist),
          });
        }
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

      // Target-of-opportunity for the offhand weapon (n > 2 only): starts from the
      // main hand's target and re-validates with the offhand's own weapon and distance.
      let offTarget = target;
      let offDist = dist;
      if (!canAttack(offWeaponLike, offDist) && n > 2) {
        const opportunity = findNearestOpponentInReach(state, offWeaponLike, states, gameModeState);
        if (opportunity) {
          offTarget = opportunity.target;
          offDist = opportunity.distance;
        }
      }

      // A blocked offhand stays silent and keeps its cooldown ready (#518).
      const offOutcome: AttackOutcome = canAttack(offWeaponLike, offDist)
        ? performAttack(
            state, offTarget, state.robot.name, offTarget.robot.name,
            currentTime, 'offhand', events,
            buildSpatialContext(state, offTarget, 'offhand', currentTime, arena, states, gameModeState, getPositionSnapshot()),
          )
        : 'blocked';

      if (offOutcome !== 'blocked') {
        state.lastOffhandAttackTime = currentTime;
        // Patience resets only on a landed hit (#520)
        if (offOutcome === 'hit') {
          state.patienceTimer = 0;
          didLandHit = true;
        }
        // Reset out-of-range suppression — robot successfully attempted an attack
        outOfRangeSuppressed.delete(state.teamIndex);
      }
    }

    if (didLandHit) landedHitThisTick.add(state.teamIndex);
  }

  // Update patience timers for robots that landed no hit this tick. Patience never
  // grants an attack (#518); since #520 it triggers the melee commit burst once it
  // reaches getPatienceLimit(), and movement AI still reads it to seed path deviation.
  for (const state of aliveStates) {
    if (!landedHitThisTick.has(state.teamIndex)) {
      state.patienceTimer += SIMULATION_TICK;
    }
  }
}

/** PHASE 5: shield regeneration, with an event per quarter regained. */
export function runShieldRegenPhase(ctx: SimulationContext, aliveStates: SpatialRobotCombatState[], currentTime: number): void {
  const { states, events, getPositionSnapshot } = ctx;
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
          timestamp: roundTime(currentTime),
          type: 'shield_regen',
          attacker: state.robot.name,
          robot1HP: states[0]?.currentHP ?? 0,
          robot2HP: states[1]?.currentHP ?? 0,
          robot1Shield: states[0]?.currentShield ?? 0,
          robot2Shield: states[1]?.currentShield ?? 0,
          message: `🛡️⚡ ${state.robot.name}'s shields regenerate to ${Math.round((state.currentShield / state.maxShield) * 100)}%`,
          ...getPositionSnapshot(),
        });
      }
    }
  }
}

/** PHASE 6: destructions, then yields (only when nobody was destroyed this tick), then pressure. */
export function runStateChecks(ctx: SimulationContext, currentTime: number): void {
  const { states, events, getPositionSnapshot } = ctx;
  // ── PHASE 6: STATE CHECKS ──
  // Step 1: Process destructions first (HP <= 0), track which robots died this tick
  const destroyedThisTick = new Set<number>();
  for (const state of states) {
    if (!state.isAlive) continue;
    if (state.currentHP <= 0) {
      state.isAlive = false;
      destroyedThisTick.add(state.teamIndex);
      events.push({
        timestamp: roundTime(currentTime),
        type: 'destroyed',
        // Spec #46 R4.16: the destroyed event previously carried no attacker
        // or defender, so any consumer counting kills or elimination order by
        // name — Grand Melee's computePlacements() does both — matched against
        // undefined and silently produced zeros.
        attacker: state.lastDamagedBy,
        defender: state.robot.name,
        message: `💀 ${state.robot.name} destroyed!`,
        robot1HP: states[0]?.currentHP ?? 0,
        robot2HP: states[1]?.currentHP ?? 0,
        robot1Shield: states[0]?.currentShield ?? 0,
        robot2Shield: states[1]?.currentShield ?? 0,
        ...getPositionSnapshot(),
      });
    }
  }

  // Step 2: Only process yields if no robot was destroyed THIS tick.
  // When a robot is destroyed, the surviving robot wins — they shouldn't
  // also yield on the same tick just because they're below threshold.
  if (destroyedThisTick.size === 0) {
    for (const state of states) {
      if (!state.isAlive) continue;
      if (shouldYield(state)) {
        state.isAlive = false;
        events.push({
          timestamp: roundTime(currentTime),
          type: 'yield',
          // `defender` names the yielding robot so multi-robot modes can order
          // eliminations. A yield is not a kill, so no `attacker` is set.
          defender: state.robot.name,
          message: `🏳️ ${state.robot.name} yields at ${((state.currentHP / state.maxHP) * 100).toFixed(0)}% HP!`,
          robot1HP: states[0]?.currentHP ?? 0,
          robot2HP: states[1]?.currentHP ?? 0,
          robot1Shield: states[0]?.currentShield ?? 0,
          robot2Shield: states[1]?.currentShield ?? 0,
          ...getPositionSnapshot(),
        });
      }
    }
  }

  // Update pressure state for all robots
  for (const state of states) {
    state.isUnderPressure = (state.currentHP / state.maxHP) * 100 < state.pressureThreshold;
  }
}

/** Game mode tick hook, then the win condition or the default elimination check. Returns the outcome once the battle has ended, otherwise null. */
export function evaluateBattleEnd(ctx: SimulationContext, currentTime: number): BattleEnd | null {
  const { states, arena, config, gameModeConfig, gameModeState, events, getPositionSnapshot } = ctx;
  // ── Game mode per-tick hooks (zone scoring, passive penalties) ──
  // Runs BEFORE win condition check so scores are current when evaluated.
  if (gameModeState?.customData) {
    const tickHook = gameModeState.customData.tickHook as
      ((st: SpatialRobotCombatState[], t: number, dt: number, ev: SpatialCombatEvent[], ar: ArenaConfig) => void) | undefined;
    if (tickHook) {
      tickHook(states, currentTime, SIMULATION_TICK, events, arena);
    }
  }

  // Game mode win condition check (KotH score threshold, last-standing, time limit, etc.)
  if (gameModeConfig?.winCondition) {
    const teams = states.map(s => [s]); // Each robot is its own team for FFA
    const result = gameModeConfig.winCondition.evaluate(teams, currentTime, gameModeState);
    if (result?.ended) {
      // Retrieve any events the win condition evaluator stored on gameState
      const wcEvents = gameModeState?.customData?.pendingEvents as SpatialCombatEvent[] | undefined;
      if (wcEvents?.length) {
        events.push(...wcEvents);
        (gameModeState!.customData as Record<string, unknown>).pendingEvents = [];
      }
      return { winnerId: result.winnerId, winReason: result.reason };
    }
  }

  // Default elimination check: if only 1 robot alive and no custom win condition, they win
  {
    const alive = states.filter(s => s.isAlive);
    if (alive.length <= 1 && !gameModeConfig?.winCondition) {
      if (alive.length === 1) {
        events.push({
          timestamp: roundTime(currentTime),
          type: 'destroyed',
          message: `🏆 ${alive[0].robot.name} wins!`,
          robot1HP: states[0]?.currentHP ?? 0,
          robot2HP: states[1]?.currentHP ?? 0,
          robot1Shield: states[0]?.currentShield ?? 0,
          robot2Shield: states[1]?.currentShield ?? 0,
          ...getPositionSnapshot(),
        });
        return { winnerId: alive[0].robot.id, winReason: undefined };
      } else if (alive.length === 0 && !config.allowDraws) {
        // Mutual destruction/yield: use HP tiebreaker (highest HP% wins)
        const sorted = [...states].sort((a, b) => (b.currentHP / b.maxHP) - (a.currentHP / a.maxHP));
        const pct = ((sorted[0].currentHP / sorted[0].maxHP) * 100).toFixed(1);
        events.push({
          timestamp: roundTime(currentTime),
          type: 'yield',
          message: `⚔️ Mutual takedown! ${sorted[0].robot.name} wins by HP tiebreaker (${pct}%)`,
          robot1HP: states[0]?.currentHP ?? 0,
          robot2HP: states[1]?.currentHP ?? 0,
          robot1Shield: states[0]?.currentShield ?? 0,
          robot2Shield: states[1]?.currentShield ?? 0,
          ...getPositionSnapshot(),
        });
        return { winnerId: sorted[0].robot.id, winReason: undefined };
      } else {
        // All eliminated and draws allowed — draw
        return { winnerId: null, winReason: undefined };
      }
    }
  }
  return null;
}

/** PHASE 7: throttled movement events. */
export function emitMovementEvents(ctx: SimulationContext, currentTime: number): void {
  const { states, events, lastMoveEventTime, lastMoveEventPos, getPositionSnapshot } = ctx;
  // ── PHASE 7: POSITION SNAPSHOTS (throttled movement events) ──
  {
    for (let i = 0; i < states.length; i++) {
      const state = states[i];
      if (!state.isAlive) continue;
      const moveDist = euclideanDistance(state.position, lastMoveEventPos[i]);
      const moveTime = currentTime - lastMoveEventTime[i];
      if ((moveDist >= MOVEMENT_EVENT_THRESHOLD || moveTime >= MOVEMENT_EVENT_MIN_INTERVAL)
          && moveDist > 0.01) {
        // Find nearest opponent with single pass (avoids filter + sort + array allocation)
        let nearestOpp: SpatialRobotCombatState | undefined;
        let distToNearest = Infinity;
        for (const s of states) {
          if (s === state || !s.isAlive) continue;
          const d = euclideanDistance(state.position, s.position);
          if (d < distToNearest) {
            distToNearest = d;
            nearestOpp = s;
          }
        }
        if (!nearestOpp) distToNearest = 0;
        events.push({
          timestamp: roundTime(currentTime),
          type: 'movement',
          attacker: state.robot.name,
          defender: nearestOpp?.robot.name,
          message: `🏃 ${state.robot.name} moves to (${state.position.x.toFixed(1)}, ${state.position.y.toFixed(1)})${nearestOpp ? ` — ${distToNearest.toFixed(1)} units from ${nearestOpp.robot.name}` : ''}`,
          robot1HP: states[0]?.currentHP ?? 0,
          robot2HP: states[1]?.currentHP ?? 0,
          robot1Shield: states[0]?.currentShield ?? 0,
          robot2Shield: states[1]?.currentShield ?? 0,
          ...getPositionSnapshot(),
          distance: distToNearest,
          rangeBand: classifyRangeBand(distToNearest),
        });
        lastMoveEventTime[i] = currentTime;
        lastMoveEventPos[i] = { x: state.position.x, y: state.position.y };
      }
    }
  }
}
