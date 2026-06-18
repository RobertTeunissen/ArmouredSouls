/**
 * King of the Hill — Strategy implementations (win condition, targeting, movement).
 *
 * Requirements: 4.1–4.12, 5.1–5.7, 6.1–6.6
 */

import { euclideanDistance, lerp, normalizeVector } from '../vector2d';
import type {
  ArenaConfig,
  GameModeState,
  MovementIntent,
  MovementIntentModifier,
  RobotCombatState,
  TargetPriorityStrategy,
  WinConditionEvaluator,
} from '../types';
import type {
  KothMatchConfig,
  KothZoneState,
  KothScoreState,
  KothPlacement,
  KothCombatEvent,
} from './kothConfig';
import { KOTH_MATCH_DEFAULTS, KOTH_PASSIVE_PENALTIES } from './kothConfig';
import { calculateFinalPlacements } from './kothElimination';

// ─── Win Condition Evaluator ────────────────────────────────────────

/**
 * KotH win condition evaluator implementing the WinConditionEvaluator interface.
 *
 * Checks (in order each simulation step):
 *   1. Score threshold reached → ended, reason 'score_threshold'
 *   2. All but one eliminated → enter last-standing phase (10s window)
 *   3. Last-standing timer expired → highest score wins, reason 'last_standing'
 *   4. Time limit reached → highest score wins, reason 'time_limit'
 *   5. Tiebreaker: zone occupation time → damage dealt
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12
 */
export class KothWinConditionEvaluator implements WinConditionEvaluator {
  private scoreThreshold: number;
  private timeLimit: number;
  private lastStandingDuration: number;

  constructor(config: KothMatchConfig) {
    this.scoreThreshold = config.scoreThreshold
      ?? (config.rotatingZone
        ? KOTH_MATCH_DEFAULTS.rotatingZoneScoreThreshold
        : KOTH_MATCH_DEFAULTS.scoreThreshold);
    this.timeLimit = config.timeLimit
      ?? (config.rotatingZone
        ? KOTH_MATCH_DEFAULTS.rotatingZoneTimeLimit
        : KOTH_MATCH_DEFAULTS.timeLimit);
    this.lastStandingDuration = KOTH_MATCH_DEFAULTS.lastStandingDuration;
  }

  evaluate(
    teams: RobotCombatState[][],
    currentTime: number,
    gameState?: GameModeState,
  ): { ended: boolean; winnerId: number | null; reason: string } | null {
    const robots = teams.flat();
    const scoreState = gameState?.customData?.scoreState as KothScoreState | undefined;
    if (!scoreState) return null;

    // Collect events to emit (stored on gameState for caller to retrieve)
    const events: KothCombatEvent[] = [];

    // --- Check 1: Score threshold reached (Req 4.2) ---
    for (const robot of robots) {
      const robotId = robot.robot.id;
      const score = scoreState.zoneScores[robotId] ?? 0;
      if (score >= this.scoreThreshold) {
        const placements = calculateFinalPlacements(scoreState, robots);
        events.push(this._buildMatchEndEvent(
          robotId, scoreState, placements, currentTime, 'score_threshold',
        ));
        this._storeEvents(gameState!, events);
        return { ended: true, winnerId: robotId, reason: 'score_threshold' };
      }
    }

    // --- Check 2: Last-standing phase is detected and managed by the tick hook ---
    // The tick hook sets lastStandingPhase, emits the last_standing event, and
    // increments the timer — all in chronological order with score_tick events.

    // --- Check 3: Last-standing timer expired (Req 4.9) ---
    if (scoreState.lastStandingPhase) {
      // Timer is incremented externally by the simulation loop via deltaTime.
      // Here we just check if it has expired.
      if (
        scoreState.lastStandingTimer >= this.lastStandingDuration ||
        currentTime >= this.timeLimit
      ) {
        const placements = calculateFinalPlacements(scoreState, robots);
        const winnerId = placements[0]?.robotId ?? null;
        events.push(this._buildMatchEndEvent(
          winnerId, scoreState, placements, currentTime, 'last_standing',
        ));
        this._storeEvents(gameState!, events);
        return { ended: true, winnerId, reason: 'last_standing' };
      }
      // Still in last-standing phase, not expired yet
      this._storeEvents(gameState!, events);
      return null;
    }

    // --- Check 4: Time limit reached (Req 4.4) ---
    if (currentTime >= this.timeLimit) {
      const placements = calculateFinalPlacements(scoreState, robots);
      const winnerId = placements[0]?.robotId ?? null;
      events.push(this._buildMatchEndEvent(
        winnerId, scoreState, placements, currentTime, 'time_limit',
      ));
      this._storeEvents(gameState!, events);
      return { ended: true, winnerId, reason: 'time_limit' };
    }

    // No end condition met
    this._storeEvents(gameState!, events);
    return null;
  }

  /** Build a match_end event (Req 4.11) */
  private _buildMatchEndEvent(
    winnerId: number | null,
    scoreState: KothScoreState,
    placements: KothPlacement[],
    currentTime: number,
    reason: string,
  ): KothCombatEvent {
    const winnerLabel = winnerId != null
      ? (scoreState.nameMap[winnerId] ?? `Robot ${winnerId}`)
      : 'No robot';

    // Determine a human-readable reason for the victory message.
    // When the match ends via last_standing phase, the winner is whoever has
    // the highest zone score — which may NOT be the last robot alive.
    let displayReason: string;
    if (reason === 'last_standing') {
      // If the winner IS the survivor, they won as last standing.
      // If the winner is someone else (e.g. destroyed but higher score), they won by score.
      displayReason = winnerId != null && winnerId === scoreState.lastStandingRobotId
        ? 'last standing'
        : 'highest zone score';
    } else {
      displayReason = reason.replace(/_/g, ' ');
    }

    return {
      timestamp: currentTime,
      type: 'match_end' as KothCombatEvent['type'],
      message: `${winnerLabel} wins the King of the Hill match — ${displayReason}`,
      kpiData: {
        winnerId,
        zoneScores: { ...scoreState.zoneScores },
        placements: [...placements],
        duration: currentTime,
        winReason: reason,
      },
    };
  }

  /** Store emitted events on gameState for the caller to retrieve */
  private _storeEvents(gameState: GameModeState, events: KothCombatEvent[]): void {
    if (events.length === 0) return;
    if (!gameState.customData) gameState.customData = {};
    const existing = (gameState.customData.pendingEvents as KothCombatEvent[]) ?? [];
    gameState.customData.pendingEvents = [...existing, ...events];
  }
}


// ─── Zone-Aware Target Priority Strategy ────────────────────────────

/**
 * KotH target priority strategy implementing TargetPriorityStrategy.
 *
 * Assigns zone-context weights to opponents and scales them by the
 * robot's threatAnalysis attribute. Returns opponent IDs sorted by
 * descending priority weight.
 *
 * Priority weights:
 *   Zone contesters (inside zone):        3.0× base
 *   Zone approachers (moving toward zone): 2.0× base
 *   Outside, not approaching:              1.0× base
 *
 * Situational modifiers:
 *   Robot inside zone uncontested: prioritize approachers
 *   Robot inside zone contested:   prioritize lowest HP contester
 *   Robot outside zone:            1.5× for approaching opponents
 *
 * threatAnalysis scaling:
 *   ta < 10:  50% effectiveness
 *   ta 10–30: linear 50% → 100%
 *   ta > 30:  100% effectiveness
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */
export class KothTargetPriorityStrategy implements TargetPriorityStrategy {
  selectTargets(
    robot: RobotCombatState,
    opponents: RobotCombatState[],
    arena: ArenaConfig,
    gameState?: GameModeState,
  ): number[] {
    // Filter out dead opponents
    const alive = opponents.filter((o) => o.isAlive);
    if (alive.length === 0) return [];

    // Resolve zone state from gameState or arena zones
    const zoneState = this._resolveZoneState(arena, gameState);
    if (!zoneState) {
      // No zone info — return opponents in original order (by teamIndex, not DB id)
      return alive.map((o) => o.teamIndex);
    }

    // Determine robot's own zone status
    const robotDist = euclideanDistance(robot.position, zoneState.center);
    const robotInZone = robotDist <= zoneState.radius;

    // Determine zone occupation state
    const occupants = alive.filter(
      (o) => euclideanDistance(o.position, zoneState.center) <= zoneState.radius,
    );
    const robotIsContested = robotInZone && occupants.length > 0;
    const robotIsUncontested = robotInZone && occupants.length === 0;

    // Get threatAnalysis scaling factor
    const ta = Number(robot.robot.threatAnalysis ?? 1);
    const taScale = this._threatAnalysisScale(ta);

    // Resolve score state for score-aware targeting
    const scoreState = gameState?.customData?.scoreState as KothScoreState | undefined;
    const scoreThreshold = this._resolveScoreThreshold(gameState);

    // Calculate weighted priority for each alive opponent
    const weighted = alive.map((opp) => {
      const oppDist = euclideanDistance(opp.position, zoneState.center);
      const oppInZone = oppDist <= zoneState.radius;
      const oppApproaching = this._isApproaching(opp, zoneState);

      // Base zone-context weight (Req 5.2)
      let weight: number;
      let context: string;
      if (oppInZone) {
        weight = 3.0;
        context = 'contester';
      } else if (oppApproaching) {
        weight = 2.0;
        context = 'approacher';
      } else {
        weight = 1.0;
        context = 'standard';
      }

      // Situational modifiers
      if (robotIsUncontested && oppApproaching && !oppInZone) {
        weight = Math.max(weight, 2.5);
      } else if (robotIsContested && oppInZone) {
        const hpRatio = opp.currentHP / opp.maxHP;
        weight += (1.0 - hpRatio) * 2.0;
      } else if (!robotInZone && oppApproaching && !oppInZone) {
        weight *= 1.5;
      }

      // Score-aware targeting: per-opponent score threat bonus
      // Higher-scoring opponents become higher priority before TA scaling is applied below
      if (scoreState && scoreThreshold > 0) {
        const oppScore = scoreState.zoneScores[opp.robot.id] ?? 0;
        const scoreRatio = oppScore / scoreThreshold;
        const scoreThreatBonus = scoreRatio * 3.0;
        weight += scoreThreatBonus;
      }

      // Apply threatAnalysis scaling (Req 5.6)
      const zoneBonus = weight - 1.0;
      const scaledWeight = 1.0 + zoneBonus * taScale;

      return { id: opp.teamIndex, weight: scaledWeight, context };
    });

    // Sort by weight descending (Req 5.7)
    weighted.sort((a, b) => b.weight - a.weight);

    return weighted.map((w) => w.id);
  }

  /**
   * Calculate threatAnalysis scaling factor.
   * Fully linear: 0.314 at ta=1, 1.0 at ta=50. Every point matters.
   */
  private _threatAnalysisScale(ta: number): number {
    return 0.3 + (ta / 50) * 0.7;
  }

  /**
   * Determine if an opponent is approaching the zone.
   * Checks if movementIntent.targetPosition is closer to zone center
   * than the opponent's current position, OR if velocity points toward zone.
   */
  private _isApproaching(opp: RobotCombatState, zone: KothZoneState): boolean {
    const currentDist = euclideanDistance(opp.position, zone.center);

    // Check movement intent target
    if (opp.movementIntent?.targetPosition) {
      const targetDist = euclideanDistance(opp.movementIntent.targetPosition, zone.center);
      if (targetDist < currentDist) return true;
    }

    // Check velocity vector direction
    if (opp.velocity && (opp.velocity.x !== 0 || opp.velocity.y !== 0)) {
      const toZoneX = zone.center.x - opp.position.x;
      const toZoneY = zone.center.y - opp.position.y;
      const dot = opp.velocity.x * toZoneX + opp.velocity.y * toZoneY;
      if (dot > 0) return true;
    }

    return false;
  }

  /**
   * Resolve zone state from gameState or arena zones.
   */
  private _resolveZoneState(
    arena: ArenaConfig,
    gameState?: GameModeState,
  ): KothZoneState | null {
    // Try gameState.customData.zoneState first
    const zs = gameState?.customData?.zoneState as KothZoneState | undefined;
    if (zs) return zs;

    // Fall back to arena zones with control_point effect
    const controlZone = arena.zones?.find((z) => z.effect === 'control_point');
    if (controlZone) {
      return {
        center: controlZone.center,
        radius: controlZone.radius,
        isActive: true,
        rotationCount: 0,
      };
    }

    return null;
  }

  /**
   * Resolve the score threshold from gameState config.
   * Falls back to the default (30) if not available.
   */
  private _resolveScoreThreshold(gameState?: GameModeState): number {
    const config = gameState?.customData?.kothConfig as KothMatchConfig | undefined;
    return config?.scoreThreshold ?? KOTH_MATCH_DEFAULTS.scoreThreshold;
  }
}


// ─── Zone-Biased Movement Intent Modifier ───────────────────────────

/**
 * KotH movement intent modifier implementing MovementIntentModifier.
 *
 * Biases robot movement toward the control zone based on game context.
 * Rules are checked in order — first match wins:
 *
 *   1. Opponent within 4 units and attacking → preserve base combat AI movement
 *   2. Inside zone uncontested, no opponent within 8 units → hold position
 *   3. combatAlgorithms > 25 + zone contested by 2+ others → wait-and-enter
 *   4. No opponent within 6 units → move toward zone center (bias scaled by ta)
 *   5. Otherwise → return baseIntent unchanged
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export class KothMovementIntentModifier implements MovementIntentModifier {
  modify(
    baseIntent: MovementIntent,
    robot: RobotCombatState,
    arena: ArenaConfig,
    gameState?: GameModeState,
  ): MovementIntent {
    // Resolve zone state
    const zoneState = this._resolveZoneState(arena, gameState);
    if (!zoneState) return baseIntent;

    // Resolve score state for occupant info
    const scoreState = gameState?.customData?.scoreState as KothScoreState | undefined;

    // Gather all alive opponents from score state or fall back to empty
    const allRobots = this._getAliveOpponents(robot, gameState);

    // Find closest opponent distance and check if any opponent is attacking this robot
    let closestOpponentDist = Infinity;
    let hasAttackingOpponentWithin4 = false;

    for (const opp of allRobots) {
      const dist = euclideanDistance(robot.position, opp.position);
      if (dist < closestOpponentDist) {
        closestOpponentDist = dist;
      }
      if (dist <= 4 && opp.currentTarget === robot.teamIndex) {
        hasAttackingOpponentWithin4 = true;
      }
    }

    // Rule 0: Last-standing phase — aggressively move to zone center (override all other rules)
    if (scoreState?.lastStandingPhase || allRobots.length === 0) {
      return {
        ...baseIntent,
        targetPosition: { x: zoneState.center.x, y: zoneState.center.y },
      };
    }

    // Determine robot's zone status
    const robotDist = euclideanDistance(robot.position, zoneState.center);
    const robotInZone = robotDist <= zoneState.radius;

    // Determine zone occupation
    const zoneOccupants = this._getZoneOccupants(allRobots, zoneState);
    const isUncontested = robotInZone && zoneOccupants.length === 0;

    // Check if any opponent is within 8 units
    const hasOpponentWithin8 = closestOpponentDist <= 8;

    // Rule 1: Inside zone uncontested, no opponent within 8 units → hold position (Req 6.3)
    if (isUncontested && !hasOpponentWithin8) {
      return {
        ...baseIntent,
        targetPosition: { x: robot.position.x, y: robot.position.y },
      };
    }

    // Rule 2: Wait-and-enter — linear blend based on CA (Req 6.4)
    // At low CA robots mostly rush in, at high CA they mostly wait
    const combatAlgorithms = Number(robot.robot.combatAlgorithms ?? 1);
    const waitWeight = combatAlgorithms / 50;
    if (!robotInZone && zoneOccupants.length >= 2 && waitWeight > 0.1) {
      const waitPos = this._calculateWaitPosition(robot.position, zoneState);
      const blended = lerp(zoneState.center, waitPos, waitWeight);
      return {
        ...baseIntent,
        targetPosition: blended,
      };
    }

    const ta = Number(robot.robot.threatAnalysis ?? 1);
    const biasStrength = this._calculateBiasStrength(ta);

    // Compute base zone pull target — blend zone center with score-aware pull
    let pullTarget = { x: zoneState.center.x, y: zoneState.center.y };

    // Score-aware movement pull: pull toward current target proportional to their score
    if (scoreState) {
      const scoreThreshold = this._resolveScoreThreshold(gameState);
      const currentTargetId = robot.currentTarget;
      if (currentTargetId !== null && scoreThreshold > 0) {
        const targetRobot = allRobots.find(r => r.teamIndex === currentTargetId);
        if (targetRobot) {
          const targetScore = scoreState.zoneScores[targetRobot.robot.id] ?? 0;
          const scorePull = (targetScore / scoreThreshold) * 0.4 * biasStrength;
          if (scorePull > 0.01) {
            pullTarget = lerp(pullTarget, targetRobot.position, scorePull);
          }
        }
      }
    }

    // Passive timer zone pull: after 20s outside zone, increasing pull back
    if (scoreState) {
      const robotId = robot.robot.id;
      const passiveTimer = scoreState.passiveTimers[robotId] ?? 0;
      if (passiveTimer > KOTH_PASSIVE_PENALTIES.warningThreshold) {
        const passivePull = Math.min(0.5, (passiveTimer - KOTH_PASSIVE_PENALTIES.warningThreshold) / 40);
        pullTarget = lerp(pullTarget, zoneState.center, passivePull);
      }
    }

    // Rule 3: No opponent within 6 units → strong zone pull (Req 6.2)
    if (closestOpponentDist > 6) {
      const blended = lerp(baseIntent.targetPosition, pullTarget, biasStrength);
      return {
        ...baseIntent,
        targetPosition: blended,
      };
    }

    // Rule 4: Opponent within 4 units and actively attacking → mild zone pull
    if (hasAttackingOpponentWithin4) {
      const mildBias = biasStrength * 0.35; // 35% of normal pull (was 25%)
      const blended = lerp(baseIntent.targetPosition, pullTarget, mildBias);
      return {
        ...baseIntent,
        targetPosition: blended,
      };
    }

    // Rule 5: Opponents within 6 units but not attacking → moderate zone pull
    const moderateBias = biasStrength * 0.55; // 55% of normal pull (was 45%)
    const blended = lerp(baseIntent.targetPosition, pullTarget, moderateBias);
    return {
      ...baseIntent,
      targetPosition: blended,
    };
  }

  /**
   * Calculate bias strength from threatAnalysis.
   * ta=1 → 40%, ta=50 → 100%, linear interpolation, clamped [0.4, 1.0].
   */
  private _calculateBiasStrength(ta: number): number {
    const raw = ((ta - 1) / 49) * 0.6 + 0.4;
    return Math.max(0.4, Math.min(1.0, raw));
  }

  /**
   * Calculate wait-and-enter position: 2 units outside zone edge,
   * on the line from zone center toward the robot's current position.
   */
  private _calculateWaitPosition(robotPos: { x: number; y: number }, zone: KothZoneState): { x: number; y: number } {
    const dx = robotPos.x - zone.center.x;
    const dy = robotPos.y - zone.center.y;
    const dir = normalizeVector({ x: dx, y: dy });
    const waitDist = zone.radius + 2;
    return {
      x: zone.center.x + dir.x * waitDist,
      y: zone.center.y + dir.y * waitDist,
    };
  }

  /**
   * Get alive opponents (excluding the robot itself) from gameState robots.
   * Falls back to empty array if no robot data available.
   */
  private _getAliveOpponents(
    robot: RobotCombatState,
    gameState?: GameModeState,
  ): RobotCombatState[] {
    const robots = gameState?.customData?.robots as RobotCombatState[] | undefined;
    if (!robots) return [];
    return robots.filter((r) => r.isAlive && r.robot.id !== robot.robot.id);
  }

  /**
   * Get opponent robots currently inside the zone (excluding the given robot).
   */
  private _getZoneOccupants(
    opponents: RobotCombatState[],
    zone: KothZoneState,
  ): RobotCombatState[] {
    return opponents.filter(
      (opp) => euclideanDistance(opp.position, zone.center) <= zone.radius,
    );
  }

  /**
   * Resolve the score threshold from gameState config.
   */
  private _resolveScoreThreshold(gameState?: GameModeState): number {
    const config = gameState?.customData?.kothConfig as KothMatchConfig | undefined;
    return config?.scoreThreshold ?? KOTH_MATCH_DEFAULTS.scoreThreshold;
  }

  /**
   * Resolve zone state from gameState or arena zones.
   */
  private _resolveZoneState(
    arena: ArenaConfig,
    gameState?: GameModeState,
  ): KothZoneState | null {
    const zs = gameState?.customData?.zoneState as KothZoneState | undefined;
    if (zs) return zs;

    const controlZone = arena.zones?.find((z) => z.effect === 'control_point');
    if (controlZone) {
      return {
        center: controlZone.center,
        radius: controlZone.radius,
        isActive: true,
        rotationCount: 0,
      };
    }

    return null;
  }
}
