/**
 * Combat Simulator — battle setup and the main simulation loop. The per-tick
 * phases live in `simulationPhases`.
 */

import { BattleError, BattleErrorCode } from '../../../errors/battleErrors';
import { assertAllRobotsArmed } from '../combatReadiness';
import { createArena } from '../../arena/arenaLayout';
import { SpatialGrid, computeMaxWeaponRange } from './spatialGrid';
import {
  RobotWithWeapons,
  CombatResult,
  BattleConfig,
  SpatialRobotCombatState,
  SpatialCombatEvent,
  SpatialCombatResult,
  RangeBand,
  Position,
  MAX_BATTLE_DURATION,
  SIMULATION_TICK,
} from './combatTypes';
import { getWeaponStatsSummary } from './combatFormulas';
import { buildPositionSnapshot, buildHPShieldSnapshot } from './attackResolution';
import { initializeCombatState, calcCooldown, handleTimeLimitReached, compileBattleResult } from './simulationState';
import {
  emitMovementEvents,
  emitRangeTransitions,
  evaluateBattleEnd,
  runAttackPhase,
  runFacingPhase,
  runMovementPhase,
  runShieldRegenPhase,
  runStateChecks,
  type SimulationContext,
} from './simulationPhases';

/**
 * Unified N-robot battle simulator with full spatial mechanics.
 *
 * Handles any number of robots (1v1, FFA, KotH, battle royale, etc.)
 * using the complete 7-phase tick loop with all 23 robot attributes.
 *
 * Game mode-specific behavior (zone scoring, custom targeting, win conditions)
 * is injected via the optional GameModeConfig/GameModeState in BattleConfig.
 *
 * Robots must have passed through `prepareRobotForCombat()`; the simulator reads
 * their attributes as effective values and never re-derives weapon/tuning/loadout
 * bonuses. It does not mutate the robots' attribute fields.
 *
 * Every robot must hold a main weapon. The battle-time readiness gate forfeits
 * unarmed robots before they get here, so an unarmed robot is a bug signal: it
 * throws `BattleError(ROBOT_NOT_BATTLE_READY)`, handled by the match failure policy.
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
  assertAllRobotsArmed(robots);

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
    // Main weapon presence is asserted above.
    const mainCd = calcCooldown(robot, robot.mainWeapon!.weapon!.cooldown, 'main');
    // Without an offhand the offhand attack never fires (it is gated on the weapon).
    const offhandWeapon = robot.offhandWeapon?.weapon;
    const offCd = offhandWeapon
      ? calcCooldown(robot, offhandWeapon.cooldown, 'offhand')
      : Number.POSITIVE_INFINITY;
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
  const VARIABLE_TICK_MIN_ROBOTS = 10;
  const useVariableTick = config.variableTickRate !== false && n >= VARIABLE_TICK_MIN_ROBOTS;
  const lastAITick: number[] = states.map(() => 0);

  // Push helper that auto-injects robotHP/robotShield maps on every event.
  // Always builds a fresh snapshot from live state to ensure post-damage accuracy.
  function pushEvent(...args: SpatialCombatEvent[]): number {
    const snapshot = buildHPShieldSnapshot(states);
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

  const ctx: SimulationContext = {
    n,
    states,
    arena,
    config,
    gameModeConfig,
    gameModeState,
    stateByTeamIndex,
    spatialGrid,
    useVariableTick,
    lastAITick,
    events,
    lastMoveEventTime,
    lastMoveEventPos,
    lastRangeBandToTarget,
    outOfRangeSuppressed,
    getPositionSnapshot,
  };

  while (currentTime < maxDuration && !battleEnded) {
    currentTime += SIMULATION_TICK;
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

    runMovementPhase(ctx, aliveStates, currentTime);
    runFacingPhase(ctx, aliveStates);
    emitRangeTransitions(ctx, aliveStates, currentTime);
    runAttackPhase(ctx, aliveStates, currentTime);
    runShieldRegenPhase(ctx, aliveStates, currentTime);
    runStateChecks(ctx, currentTime);
    const ended = evaluateBattleEnd(ctx, currentTime);
    if (ended) {
      winnerId = ended.winnerId;
      winReason = ended.winReason;
      battleEnded = true;
    } else {
      emitMovementEvents(ctx, currentTime);
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
 * Robots must have passed through `prepareRobotForCombat()`.
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
