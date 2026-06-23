/**
 * King of the Hill — Game mode assembly (config builder, initial state, tick hook).
 *
 * Requirements: 2.1–2.5, 3.1–3.7, 7.1–7.6, 11.1–11.7
 */

import type {
  ArenaConfig,
  CombatEvent,
  GameModeConfig,
  GameModeState,
  RobotCombatState,
} from '../types';
import type {
  KothMatchConfig,
  KothZoneState,
  KothScoreState,
  KothEnrichedPlacement,
} from './kothConfig';
import { KOTH_MATCH_DEFAULTS } from './kothConfig';
import { createControlZone, evaluateZoneOccupation, trackZoneTransitions } from './kothZone';
import { createKothScoreState, tickScoring, tickPassivePenalties } from './kothScoring';
import { handleRobotDestruction, handleRobotYield, calculateFinalPlacements } from './kothElimination';
import { KothWinConditionEvaluator, KothTargetPriorityStrategy, KothMovementIntentModifier } from './kothStrategies';

// ─── Game Mode Config Assembly ──────────────────────────────────────

/**
 * Assemble a complete GameModeConfig for a KotH match.
 *
 * Wires together all KotH strategy implementations:
 *   - targetPriority: KothTargetPriorityStrategy
 *   - movementModifier: KothMovementIntentModifier
 *   - winCondition: KothWinConditionEvaluator (with config)
 *   - arenaZones: single control_point zone from createControlZone
 *   - maxDuration: config.timeLimit or default (150 fixed / 210 rotating)
 *
 * Requirements: 11.1, 11.2, 11.3, 11.6, 11.7
 */
export function buildKothGameModeConfig(config: KothMatchConfig): GameModeConfig {
  const maxDuration = config.timeLimit ?? KOTH_MATCH_DEFAULTS.timeLimit;

  return {
    targetPriority: new KothTargetPriorityStrategy(),
    movementModifier: new KothMovementIntentModifier(),
    winCondition: new KothWinConditionEvaluator(config),
    arenaZones: [createControlZone(config)],
    maxDuration,
  };
}

// ─── Game Mode Initial State Assembly ───────────────────────────────

/**
 * Build the initial GameModeState for a KotH match.
 *
 * Initializes:
 *   - mode: 'zone_control'
 *   - zoneScores: zeroed for each robotId
 *   - customData containing scoreState, zoneState, robots, eliminatedRobots, passiveTimers
 *
 * Requirements: 11.1, 11.2, 11.3, 11.6, 11.7
 */
export function buildKothInitialState(
  config: KothMatchConfig,
  robotIds: number[],
): GameModeState {
  const scoreState = createKothScoreState(robotIds);
  const zoneRadius = config.zoneRadius ?? KOTH_MATCH_DEFAULTS.zoneRadius;

  const zoneScores: Record<number, number> = {};
  for (const id of robotIds) {
    zoneScores[id] = 0;
  }

  return {
    mode: 'zone_control',
    zoneScores,
    customData: {
      scoreState,
      kothConfig: config,
      zoneState: {
        center: { x: 0, y: 0 },
        radius: zoneRadius,
        isActive: true,
        rotationCount: 0,
        rotationTimer: 0,
      },
      robots: [] as unknown[],
      eliminatedRobots: new Set<number>(),
      passiveTimers: {} as Record<string, unknown>,
    },
  };
}

// ─── Tick Hook Builder ──────────────────────────────────────────────

/**
 * Build the per-tick hook function for KotH matches.
 *
 * Called by simulateBattleMulti every tick. Wires together all KotH mechanics:
 * zone occupation, scoring, transitions, passive penalties, zone rotation,
 * and destruction/yield tracking.
 *
 * The hook captures scoreState, zoneState, and gameModeState by reference so
 * mutations are visible to the KothWinConditionEvaluator and the result builder.
 *
 * Requirements: 2.1–2.5, 3.1–3.7, 7.1–7.6
 */
export function buildKothTickHook(
  config: KothMatchConfig,
  scoreState: KothScoreState,
  zoneState: KothZoneState,
  gameModeState: GameModeState,
): (
  states: RobotCombatState[],
  currentTime: number,
  deltaTime: number,
  events: CombatEvent[],
  arena: ArenaConfig,
) => void {
  // Track previous alive set to detect new destructions/yields
  let previousAliveIds: Set<number> | null = null;

  return (states, currentTime, deltaTime, events, _arena) => {
    const aliveRobots = states.filter(s => s.isAlive);

    // Initialize previous alive set on first tick
    if (previousAliveIds === null) {
      previousAliveIds = new Set(states.map(s => s.robot.id));
      // Populate nameMap so all KotH message functions can resolve robot names
      for (const s of states) {
        scoreState.nameMap[s.robot.id] = s.robot.name;
      }
    }

    // --- Detect newly dead/yielded robots ---
    const currentAliveIds = new Set(aliveRobots.map(s => s.robot.id));
    for (const prevId of previousAliveIds) {
      if (!currentAliveIds.has(prevId)) {
        const deadState = states.find(s => s.robot.id === prevId);
        if (!deadState) continue;

        if (deadState.currentHP <= 0) {
          // Find killer by scanning recent events for the last damage dealt to this robot.
          // This correctly handles counter-attack kills where the defender (counter-attacker)
          // killed the original attacker — in that case currentTarget won't point at the victim.
          const deadName = deadState.robot.name;
          let killerId = 0;

          // Strategy 1: Scan events backwards for the most recent damaging hit on this robot
          for (let i = events.length - 1; i >= 0; i--) {
            const evt = events[i];
            if (evt.defender === deadName && evt.hit && evt.damage && evt.damage > 0 && evt.attacker) {
              // Found the last robot that dealt damage to the dead robot
              const killerState = states.find(s => s.robot.name === evt.attacker);
              if (killerState) {
                killerId = killerState.robot.id;
                break;
              }
            }
          }

          // Strategy 2: Fallback to currentTarget heuristic if no event found
          if (killerId === 0) {
            const killer = aliveRobots.find(s => s.currentTarget === deadState.teamIndex);
            killerId = killer?.robot.id ?? 0;
          }

          const destroyEvents = handleRobotDestruction(scoreState, killerId, prevId, zoneState);
          for (const e of destroyEvents) {
            e.timestamp = currentTime;
            events.push(e);
          }
        } else {
          // Yielded
          const yieldEvent = handleRobotYield(scoreState, prevId, zoneState);
          yieldEvent.timestamp = currentTime;
          events.push(yieldEvent);
        }
      }
    }
    previousAliveIds = currentAliveIds;

    // --- Zone occupation ---
    const occupation = evaluateZoneOccupation(aliveRobots, zoneState);

    // --- Zone transitions (enter/exit events) ---
    const transitionEvents = trackZoneTransitions(scoreState, occupation, currentTime);
    for (const e of transitionEvents) events.push(e);

    // --- Scoring ---
    const scoreEvents = tickScoring(scoreState, zoneState, occupation, deltaTime);
    for (const e of scoreEvents) {
      e.timestamp = currentTime;
      events.push(e);
    }

    // --- Sync zone scores to gameModeState so win condition evaluator can read them ---
    if (gameModeState.zoneScores) {
      for (const [id, score] of Object.entries(scoreState.zoneScores)) {
        gameModeState.zoneScores[Number(id)] = score;
      }
    }

    // --- Sync scoreState onto customData so win condition evaluator can access it ---
    (gameModeState.customData as Record<string, unknown>).scoreState = scoreState;
    (gameModeState.customData as Record<string, unknown>).zoneState = zoneState;

    // --- Passive penalties ---
    const penaltyEvents = tickPassivePenalties(scoreState, aliveRobots, zoneState, deltaTime);
    for (const e of penaltyEvents) {
      e.timestamp = currentTime;
      events.push(e);
    }

    // --- Update lastStanding tracking for win condition evaluator ---
    if (aliveRobots.length <= 1) {
      if (!scoreState.lastStandingPhase) {
        scoreState.lastStandingPhase = true;
        scoreState.lastStandingTimer = 0;
        scoreState.lastStandingRobotId = aliveRobots.length === 1
          ? aliveRobots[0].robot.id : null;

        // Emit last_standing event here (in tick hook) so it appears in
        // chronological order with score_tick events (Req 4.10)
        const survivorId = scoreState.lastStandingRobotId;
        const lastStandingDuration = KOTH_MATCH_DEFAULTS.lastStandingDuration;
        events.push({
          timestamp: currentTime,
          type: 'last_standing' as CombatEvent['type'],
          message: survivorId != null
            ? `${scoreState.nameMap[survivorId] ?? `Robot ${survivorId}`} is the last robot standing — ${lastStandingDuration} seconds to score`
            : `All robots eliminated — match ending`,
          kpiData: {
            survivorId: survivorId ?? undefined,
            zoneScores: { ...scoreState.zoneScores },
            countdown: lastStandingDuration,
          },
        });
      }
      scoreState.lastStandingTimer += deltaTime;
    }
  };
}

/**
 * Build enriched placements from the unified simulator result + KotH score state.
 *
 * Maps the raw KothPlacement (score-based) with robot names, HP, kills, etc.
 * from the combat states, producing the full shape processKothBattle needs for DB records.
 */
export function buildEnrichedPlacements(
  scoreState: KothScoreState,
  states: RobotCombatState[],
): KothEnrichedPlacement[] {
  const basePlacements = calculateFinalPlacements(scoreState, states);

  return basePlacements.map(p => {
    const robot = states.find(s => s.robot.id === p.robotId);
    return {
      ...p,
      robotName: robot?.robot.name ?? `Robot ${p.robotId}`,
      zoneTime: scoreState.zoneOccupationTime[p.robotId] ?? 0,
      kills: scoreState.killCounts[p.robotId] ?? 0,
      destroyed: scoreState.eliminatedRobots.has(p.robotId)
        ? (robot ? robot.currentHP <= 0 : true)
        : false,
      damageDealt: robot?.totalDamageDealt ?? 0,
      finalHP: Math.max(0, robot?.currentHP ?? 0),
      uncontestedScore: scoreState.uncontestedTime[p.robotId] ?? 0,
    };
  });
}
