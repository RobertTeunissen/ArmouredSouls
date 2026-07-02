/**
 * Combat Simulator — Main simulation loop functions.
 */

import { BattleError, BattleErrorCode } from '../../../errors/battleErrors';
import { euclideanDistance } from '../../arena/vector2d';
import { createArena } from '../../arena/arenaLayout';
import { classifyRangeBand, canAttack } from '../../arena/rangeBands';
import { calculateTurnSpeed, updateFacing } from '../../arena/positionTracker';
import { calculateEffectiveSpeed, updateServoStrain } from '../../arena/servoStrain';
import { calculateMovementIntent, applyMovement, getPatienceLimit, enforceTeamSeparation, RANGE_BAND_MIDPOINTS } from '../../arena/movementAI';
import { getSupportShieldBoost } from '../../arena/teamCoordination';
import { selectTarget } from '../../arena/threatScoring';
import { SpatialGrid, computeMaxWeaponRange } from './spatialGrid';
import {
  RobotWithWeapons,
  CombatResult,
  BattleConfig,
  SpatialRobotCombatState,
  SpatialCombatEvent,
  SpatialCombatResult,
  RangeBand,
  ArenaConfig,
  Position,
  WeaponLike,
  MAX_BATTLE_DURATION,
  SIMULATION_TICK,
  MOVEMENT_EVENT_THRESHOLD,
  MOVEMENT_EVENT_MIN_INTERVAL,
} from './combatTypes';
import { roundTime, getWeaponStatsSummary, regenerateShields, shouldYield } from './combatFormulas';
import { buildPositionSnapshot, buildHPShieldSnapshot, performAttack } from './attackResolution';
import { initializeCombatState, calcCooldown, buildSpatialContext, handleTimeLimitReached, compileBattleResult } from './simulationState';

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
  if (n < 2) {
    throw new BattleError(
      BattleErrorCode.BATTLE_SIMULATION_FAILED,
      'simulateBattleMulti requires at least 2 robots',
      400,
      { robotCount: n }
    );
  }

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

  // Pre-build index for O(1) lookups by teamIndex (replaces repeated linear scans)
  const stateByTeamIndex = new Map<number, SpatialRobotCombatState>(
    states.map(s => [s.teamIndex, s])
  );

  // Spatial grid for O(n×k) threat evaluation (Spec #44: R1.1, R1.2, R1.5)
  // Only used for filtering candidates passed to selectTarget — movement AI still sees all opponents
  const useSpatialGrid = config.spatialPartitioning !== false && n > 2;
  const spatialGrid = useSpatialGrid
    ? new SpatialGrid(computeMaxWeaponRange(robots))
    : null;

  // Variable tick rate: robots far from all opponents skip AI re-evaluation (Spec #44: R1.3, R1.7)
  // Only activates for battles with 10+ robots — no impact on KotH (5-6) or 1v1
  const VARIABLE_TICK_INTERVAL = 0.5; // seconds between full AI evaluations for distant robots
  const VARIABLE_TICK_DISTANCE = 50; // units — threshold for "far from all opponents"
  const VARIABLE_TICK_MIN_ROBOTS = 10;
  const useVariableTick = config.variableTickRate !== false && n >= VARIABLE_TICK_MIN_ROBOTS;
  const lastAITick: number[] = states.map(() => 0);

  // Cached HP/shield snapshot to avoid rebuilding on every event push
  let cachedHPSnapshot: { robotHP: Record<string, number>; robotShield: Record<string, number> } | null = null;
  let hpSnapshotDirty = true;

  function getHPSnapshot() {
    if (hpSnapshotDirty || !cachedHPSnapshot) {
      cachedHPSnapshot = buildHPShieldSnapshot(states);
      hpSnapshotDirty = false;
    }
    return cachedHPSnapshot;
  }

  // Push helper that auto-injects robotHP/robotShield maps on every event.
  // Uses cached snapshot to avoid rebuilding when HP hasn't changed.
  // Direct function call is faster than Proxy trap in V8.
  function pushEvent(...args: SpatialCombatEvent[]): number {
    const snapshot = getHPSnapshot();
    for (const evt of args) {
      evt.robotHP = snapshot.robotHP;
      evt.robotShield = snapshot.robotShield;
    }
    return rawEvents.push(...args);
  }

  // Array-like object passed to performAttack (which calls events.push internally)
  const events = { push: pushEvent } as unknown as SpatialCombatEvent[];

  // Movement event throttling per robot
  const lastMoveEventTime: number[] = states.map(() => 0);
  const lastMoveEventPos: Position[] = states.map(s => ({ x: s.position.x, y: s.position.y }));

  // Range band tracking per robot (for transition events)
  const lastRangeBandToTarget: Map<number, RangeBand> = new Map();

  // Out-of-range message suppression: show once per streak, suppress until robot attacks
  const outOfRangeSuppressed: Set<number> = new Set();

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
  // Cached position snapshot — rebuilt once per tick after facing phase
  let cachedPositionSnapshot: { positions: Record<string, Position>; facingDirections: Record<string, number> } | null = null;

  /** Get or build position snapshot for this tick (cached after first call per tick) */
  function getPositionSnapshot(): { positions: Record<string, Position>; facingDirections: Record<string, number> } {
    if (!cachedPositionSnapshot) {
      cachedPositionSnapshot = buildPositionSnapshot(...states);
    }
    return cachedPositionSnapshot;
  }

  while (currentTime < maxDuration && !battleEnded) {
    currentTime += SIMULATION_TICK;
    // Mark HP snapshot dirty at start of each tick (attacks may change HP/shield)
    hpSnapshotDirty = true;
    // Invalidate position snapshot (movement/facing phases will update positions)
    cachedPositionSnapshot = null;
    const aliveStates = states.filter(s => s.isAlive);
    if (aliveStates.length <= 1 && !gameModeConfig?.winCondition) {
      battleEnded = true;
      break;
    }

    // Sync states to gameModeState so movement/target modifiers can access all robots
    if (gameModeState?.customData) {
      (gameModeState.customData as Record<string, unknown>).robots = states;
    }

    // Update spatial grid with current positions (Spec #44: R1.1)
    if (spatialGrid) {
      spatialGrid.update(states);
    }

    // ── PHASE 1: MOVEMENT ──
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
          // Not due for AI re-evaluation — apply movement only at constant velocity
          // Move in current direction using existing velocity (R1.7: no teleporting)
          state.position.x += state.velocity.x * SIMULATION_TICK;
          state.position.y += state.velocity.y * SIMULATION_TICK;
          // Clamp to arena bounds
          const distFromCenter = euclideanDistance(state.position, arena.center);
          if (distFromCenter > arena.radius) {
            const scale = arena.radius / distFromCenter;
            state.position.x = arena.center.x + (state.position.x - arena.center.x) * scale;
            state.position.y = arena.center.y + (state.position.y - arena.center.y) * scale;
          }
          continue;
        }
        lastAITick[state.teamIndex] = currentTime;
      }

      // Filter opponents: exclude teammates in team modes so movement AI
      // targets enemies, not allies (prevents clumping on teammates)
      const teamOfMap = gameModeState?.customData?.teamOf as Record<number, number> | undefined;
      const opponents = states.filter(s => {
        if (s === state || !s.isAlive) return false;
        if (teamOfMap && teamOfMap[s.teamIndex] === teamOfMap[state.teamIndex]) return false;
        if (!teamOfMap && s.teamIndex === state.teamIndex) return false;
        return true;
      });

      // No opponents: skip movement unless a game mode modifier can still direct us
      // (e.g. KotH last-standing phase needs the robot to move toward the zone)
      if (opponents.length === 0 && !gameModeConfig?.movementModifier) continue;

      // Select target via game mode strategy or default threat scoring.
      // Target stickiness: keep current target for at least 1.5s unless it's dead
      // or a new target has significantly higher priority (50%+ more weight).
      let target: SpatialRobotCombatState | null = null;
      if (opponents.length > 0) {
        // Decay target lock timer
        state.targetLockTimer = Math.max(0, state.targetLockTimer - SIMULATION_TICK);

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

        // Apply target stickiness: only switch if lock expired or current target dead
        if (!currentTargetAlive || state.currentTarget === null) {
          // Must switch — current target is gone
          state.currentTarget = newTargetIdx;
          state.targetLockTimer = 1.5; // Lock onto new target for 1.5s
        } else if (state.targetLockTimer <= 0 && newTargetIdx !== state.currentTarget) {
          // Lock expired and a different target is preferred — switch
          state.currentTarget = newTargetIdx;
          state.targetLockTimer = 1.5;
        }
        // else: keep current target (lock still active or same target selected)

        target = stateByTeamIndex.get(state.currentTarget!) ?? opponents[0];
      } else {
        state.currentTarget = null;
      }

      // Effective speed with servo strain
      const opponentMainWeapon = target?.robot.mainWeapon?.weapon;
      const hasRangedOpponent = opponentMainWeapon
        ? opponentMainWeapon.weaponType !== 'melee' && opponentMainWeapon.weaponType !== 'shield'
        : false;
      const hasMeleeOpponent = opponentMainWeapon
        ? opponentMainWeapon.weaponType === 'melee'
        : false;
      const hasMeleeWeapon = state.robot.mainWeapon?.weapon?.weaponType === 'melee';
      const hasRangedWeapon = state.robot.mainWeapon?.weapon
        ? state.robot.mainWeapon.weapon.weaponType !== 'melee' && state.robot.mainWeapon.weapon.weaponType !== 'shield'
        : false;
      const weaponRangeBand = state.robot.mainWeapon?.weapon?.rangeBand ?? 'short';
      const weaponOptimalRangeMidpoint = RANGE_BAND_MIDPOINTS[weaponRangeBand as RangeBand] ?? 4.5;
      const distToTarget = target ? euclideanDistance(state.position, target.position) : 0;
      const servoState = {
        servoMotors: state.numServoMotors,
        servoStrain: state.servoStrain,
        sustainedMovementTime: state.sustainedMovementTime,
        isUsingClosingBonus: state.isUsingClosingBonus,
        stance: (state.robot.stance ?? 'balanced') as 'defensive' | 'offensive' | 'balanced',
        hasMeleeWeapon,
        hasRangedWeapon,
        weaponOptimalRangeMidpoint,
        distanceToTarget: distToTarget,
        currentSpeedRatio: 0,
      };
      const { effectiveSpeed, isClosingBonus } = calculateEffectiveSpeed(
        servoState, target?.effectiveMovementSpeed ?? 0, hasRangedOpponent, hasMeleeOpponent,
      );
      state.effectiveMovementSpeed = effectiveSpeed;
      state.isUsingClosingBonus = isClosingBonus;

      // Movement intent (with optional game mode modifier)
      let intent = calculateMovementIntent(
        state, opponents, arena, gameModeConfig?.movementModifier, gameModeState,
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

    // ── PHASE 3: ATTACKS (range-gated, per robot) ──
    const attackedThisTick: Set<number> = new Set();

    for (const state of aliveStates) {
      if (state.currentTarget === null) continue;
      let target = stateByTeamIndex.get(state.currentTarget);
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
          let nearestDist = Infinity;
          let nearestState: SpatialRobotCombatState | undefined;
          const teamOfMap = gameModeState?.customData?.teamOf as Record<number, number> | undefined;
          for (const s of states) {
            if (s === state || !s.isAlive) continue;
            // Skip teammates in team modes
            if (teamOfMap && teamOfMap[s.teamIndex] === teamOfMap[state.teamIndex]) continue;
            // Fallback for non-team modes: skip same teamIndex (self only)
            if (!teamOfMap && s.teamIndex === state.teamIndex) continue;
            const d = euclideanDistance(state.position, s.position);
            if (canAttack(weaponLike, d) && d < nearestDist) {
              nearestDist = d;
              nearestState = s;
            }
          }
          if (nearestState) {
            target = nearestState;
            dist = nearestDist;
          }
        }

        if (!weaponLike || canAttack(weaponLike, dist) || forceAttack) {
          const ctx = buildSpatialContext(state, target, 'main', currentTime, arena, states, gameModeState, getPositionSnapshot());
          performAttack(
            state, target, state.robot.name, target.robot.name,
            currentTime, 'main', events, ctx,
          );
          state.lastAttackTime = currentTime;
          state.patienceTimer = 0;
          didAttack = true;
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
        const patienceLimit = getPatienceLimit(state.combatAlgorithmScore);

        // Target-of-opportunity for offhand melee weapon in FFA/KotH
        let offTarget = target;
        let offDist = dist;
        if (!canAttack(offWeaponLike, offDist) && !(state.patienceTimer >= patienceLimit) && n > 2) {
          let nearestDist = Infinity;
          let nearestState: SpatialRobotCombatState | undefined;
          const teamOfMap = gameModeState?.customData?.teamOf as Record<number, number> | undefined;
          for (const s of states) {
            if (s === state || !s.isAlive) continue;
            // Skip teammates in team modes
            if (teamOfMap && teamOfMap[s.teamIndex] === teamOfMap[state.teamIndex]) continue;
            // Fallback for non-team modes: skip same teamIndex (self only)
            if (!teamOfMap && s.teamIndex === state.teamIndex) continue;
            const d = euclideanDistance(state.position, s.position);
            if (canAttack(offWeaponLike, d) && d < nearestDist) {
              nearestDist = d;
              nearestState = s;
            }
          }
          if (nearestState) {
            offTarget = nearestState;
            offDist = nearestDist;
          }
        }

        if (canAttack(offWeaponLike, offDist) || state.patienceTimer >= patienceLimit) {
          const ctx = buildSpatialContext(state, offTarget, 'offhand', currentTime, arena, states, gameModeState, getPositionSnapshot());
          performAttack(
            state, offTarget, state.robot.name, offTarget.robot.name,
            currentTime, 'offhand', events, ctx,
          );
          state.lastOffhandAttackTime = currentTime;
          state.patienceTimer = 0;
          didAttack = true;
          // Reset out-of-range suppression — robot successfully attempted an attack
          outOfRangeSuppressed.delete(state.teamIndex);
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
            timestamp: roundTime(currentTime),
            type: 'destroyed',
            message: `🏆 ${alive[0].robot.name} wins!`,
            robot1HP: states[0]?.currentHP ?? 0,
            robot2HP: states[1]?.currentHP ?? 0,
            robot1Shield: states[0]?.currentShield ?? 0,
            robot2Shield: states[1]?.currentShield ?? 0,
            ...getPositionSnapshot(),
          });
        } else if (alive.length === 0 && !config.allowDraws) {
          // Mutual destruction/yield: use HP tiebreaker (highest HP% wins)
          const sorted = [...states].sort((a, b) => (b.currentHP / b.maxHP) - (a.currentHP / a.maxHP));
          winnerId = sorted[0].robot.id;
          battleEnded = true;
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
  } // end main loop

  // === 5. Time limit handling ===
  if (!battleEnded) {
    handleTimeLimitReached(states, config, events, currentTime, getPositionSnapshot);
    if (!config.allowDraws) {
      const alive = states.filter(s => s.isAlive);
      alive.sort((a, b) => (b.currentHP / b.maxHP) - (a.currentHP / a.maxHP));
      if (alive.length > 0) {
        winnerId = alive[0].robot.id;
      }
    }
  }

  // === 6. Build result ===
  return compileBattleResult(states, rawEvents, currentTime, winnerId, winReason, arena, startingPositions, gameModeState, config);
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
