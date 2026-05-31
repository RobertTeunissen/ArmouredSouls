/**
 * Team Battle Engine — N-vs-N Simultaneous Combat Simulation
 *
 * Wraps the existing `combatSimulator.ts` infrastructure to run 2v2 or 3v3
 * team battles where all robots are active simultaneously. Adds team-specific
 * coordination effects (focus fire, ally shield regen, formation defence)
 * on top of the standard combat resolution.
 *
 * The engine reuses:
 *   - `arenaLayout.createArena([teamSize, teamSize])` for arena setup
 *   - `combatSimulator.simulateBattleMulti()` for the core combat loop
 *   - `teamCoordinationEffects.ts` for ally-targeted bonuses
 *
 * Requirements: R1.1, R1.3, R1.5, R1.7, R1.9, R5.1–R5.10, R6.2, R6.3, R6.4, R6.5, R6.6
 *
 * @module services/team-battle/teamBattleEngine
 */

import { RobotWithWeapons, simulateBattleMulti, BattleConfig } from '../battle/combatSimulator';
import { createArena } from '../arena/arenaLayout';
import { euclideanDistance } from '../arena/vector2d';
import { TeamBattleError, TeamBattleErrorCode } from '../../errors/teamBattleErrors';
import {
  TeamBattleResult,
  TeamBattleParticipantResult,
  TeamBattleCombatEvent,
  FocusFireEvent,
  TeamMetricPair,
} from '../../types/teamBattleLogTypes';
import {
  calculateFocusFireBonus,
  calculateAllyShieldRegen,
  calculateFormationDefense,
  FORMATION_RANGE,
} from './teamCoordinationEffects';
import { GameModeState, GameModeConfig, RobotCombatState, ArenaConfig } from '../arena/types';

// ── Constants ────────────────────────────────────────────────────────

/** Maximum battle duration in seconds before declaring a draw (R1.7) */
const TEAM_BATTLE_MAX_DURATION = 300;

/** Simulation tick interval in seconds (matches combatSimulator) */
const SIMULATION_TICK = 0.1;

// ── Internal Types ───────────────────────────────────────────────────

/** Tracks per-robot stats during simulation */
interface RobotTracker {
  robotId: number;
  team: 1 | 2;
  damageDealt: number;
  damageTaken: number;
  eliminatedAt: number | null; // timestamp when eliminated, null if survived
  stateIndex: number; // index into the combat states array
}



// ── Main Export ──────────────────────────────────────────────────────

/**
 * Simulate a team battle between two teams of N robots.
 *
 * All 2N robots are placed in the arena at tick 0 and fight simultaneously.
 * Team coordination effects (focus fire bonus, ally shield regen, formation
 * defence) are applied per tick based on the Team Coordination Attributes.
 *
 * @param team1Robots - Array of N robots for team 1
 * @param team2Robots - Array of N robots for team 2
 * @param teamSize - Expected team size (2 or 3)
 * @returns Full battle result with per-robot stats, battle log, and focus fire events
 *
 * @throws TeamBattleError with TEAM_INVALID_SIZE if teamSize is not 2 or 3
 * @throws TeamBattleError with TEAM_INVALID_COMPOSITION if robot arrays don't match teamSize
 */
export function simulateTeamBattle(
  team1Robots: RobotWithWeapons[],
  team2Robots: RobotWithWeapons[],
  teamSize: 2 | 3,
): TeamBattleResult {
  // ── Validation ──
  if (teamSize !== 2 && teamSize !== 3) {
    throw new TeamBattleError(
      TeamBattleErrorCode.TEAM_INVALID_SIZE,
      `Team size must be 2 or 3, got ${teamSize}`,
      400,
      { teamSize },
    );
  }

  if (team1Robots.length !== teamSize) {
    throw new TeamBattleError(
      TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
      `Team 1 must have exactly ${teamSize} robots, got ${team1Robots.length}`,
      400,
      { expected: teamSize, actual: team1Robots.length, team: 1 },
    );
  }

  if (team2Robots.length !== teamSize) {
    throw new TeamBattleError(
      TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
      `Team 2 must have exactly ${teamSize} robots, got ${team2Robots.length}`,
      400,
      { expected: teamSize, actual: team2Robots.length, team: 2 },
    );
  }

  // ── Arena Setup ──
  const arena = createArena([teamSize, teamSize]);

  // ── Prepare robots array (team1 first, then team2) ──
  const allRobots: RobotWithWeapons[] = [...team1Robots, ...team2Robots];

  // ── Build robot trackers ──
  const trackers: RobotTracker[] = allRobots.map((robot, index) => ({
    robotId: robot.id,
    team: index < teamSize ? 1 : 2,
    damageDealt: 0,
    damageTaken: 0,
    eliminatedAt: null,
    stateIndex: index,
  }));

  // ── Team coordination state tracking ──
  const battleLog: TeamBattleCombatEvent[] = [];
  const focusFireEvents: FocusFireEvent[] = [];
  const focusFireMetrics: TeamMetricPair = { team1: 0, team2: 0 };
  const allySupportMetrics: TeamMetricPair = { team1: 0, team2: 0 };
  const formationDefenceMetrics: TeamMetricPair = { team1: 0, team2: 0 };

  // Track focus fire bonus damage separately so it can be added to the
  // simulator's internal damage tracking (which doesn't know about bonus damage)
  const focusFireBonusDamageDealt: Map<number, number> = new Map();
  const focusFireBonusDamageTaken: Map<number, number> = new Map();

  // ── Custom game mode hooks for team coordination ──
  // We use the game mode extensibility system to inject team coordination
  // effects into the standard combat loop.
  let tickCount = 0;
  const lastDamageSnapshot: Map<number, number> = new Map();

  // Build team membership lookup
  const teamOf = new Map<number, 1 | 2>();
  for (let i = 0; i < allRobots.length; i++) {
    teamOf.set(i, i < teamSize ? 1 : 2);
  }

  // Custom target priority: robots only target opposing team members
  const teamTargetPriority: GameModeConfig['targetPriority'] = {
    selectTargets(
      robot: RobotCombatState,
      opponents: RobotCombatState[],
      _arena: ArenaConfig,
      _gameState?: GameModeState,
    ): number[] {
      const myTeam = teamOf.get(robot.teamIndex);
      // Filter to only opposing team members that are alive
      const validTargets = opponents.filter(opp => {
        const oppTeam = teamOf.get(opp.teamIndex);
        return oppTeam !== myTeam && opp.isAlive;
      });

      if (validTargets.length === 0) return [];

      // Sort by threat (lowest HP% first for focus fire tendency)
      const sorted = [...validTargets].sort((a, b) => {
        const aHpPct = a.currentHP / a.maxHP;
        const bHpPct = b.currentHP / b.maxHP;
        // Prefer lower HP targets (focus fire tendency)
        if (Math.abs(aHpPct - bHpPct) > 0.15) {
          return aHpPct - bHpPct;
        }
        // Tiebreak: closer target
        const distA = euclideanDistance(robot.position, a.position);
        const distB = euclideanDistance(robot.position, b.position);
        return distA - distB;
      });

      return sorted.map(s => s.teamIndex);
    },
  };

  // Custom win condition: one team fully eliminated or time limit
  const teamWinCondition: GameModeConfig['winCondition'] = {
    evaluate(
      teams: RobotCombatState[][],
      currentTime: number,
      _gameState?: GameModeState,
    ): { ended: boolean; winnerId: number | null; reason: string } | null {
      // Flatten all states
      const allStates = teams.flat();

      // Check team survival
      const team1Alive = allStates.filter(s => teamOf.get(s.teamIndex) === 1 && s.isAlive);
      const team2Alive = allStates.filter(s => teamOf.get(s.teamIndex) === 2 && s.isAlive);

      if (team1Alive.length === 0 && team2Alive.length === 0) {
        // Mutual elimination — draw
        return { ended: true, winnerId: null, reason: 'mutual_elimination' };
      }

      if (team1Alive.length === 0) {
        // Team 2 wins
        return { ended: true, winnerId: team2Alive[0].robot.id, reason: 'team1_eliminated' };
      }

      if (team2Alive.length === 0) {
        // Team 1 wins
        return { ended: true, winnerId: team1Alive[0].robot.id, reason: 'team2_eliminated' };
      }

      // Time limit check (300 seconds)
      if (currentTime >= TEAM_BATTLE_MAX_DURATION) {
        return { ended: true, winnerId: null, reason: 'time_limit' };
      }

      return null; // Battle continues
    },
  };

  // Tick hook for team coordination effects and tracking
  const tickHook = (
    states: RobotCombatState[],
    currentTime: number,
    _dt: number,
    _events: unknown[],
    _arenaConfig: ArenaConfig,
  ): void => {
    tickCount++;
    const currentTick = tickCount;

    // ── Track damage dealt/taken this tick ──
    for (const state of states) {
      const tracker = trackers[state.teamIndex];
      if (!tracker) continue;

      const prevDamageDealt = lastDamageSnapshot.get(state.teamIndex) ?? 0;
      const newDamageDealt = state.totalDamageDealt - prevDamageDealt;

      if (newDamageDealt > 0) {
        tracker.damageDealt = state.totalDamageDealt;
      }
      tracker.damageTaken = state.totalDamageTaken;
    }

    // Update damage snapshot
    for (const state of states) {
      lastDamageSnapshot.set(state.teamIndex, state.totalDamageDealt);
    }

    // ── Detect eliminations ──
    for (const state of states) {
      const tracker = trackers[state.teamIndex];
      if (!tracker) continue;

      if (!state.isAlive && tracker.eliminatedAt === null) {
        tracker.eliminatedAt = currentTime;

        // Find who dealt the killing blow (last attacker)
        let eliminatedBy: number | null = null;
        const opposingTeam = tracker.team === 1 ? 2 : 1;
        const opposingTrackers = trackers.filter(t => t.team === opposingTeam);
        // Attribute to the opposing robot that dealt the most damage
        let maxDmg = 0;
        for (const oppTracker of opposingTrackers) {
          const oppState = states[oppTracker.stateIndex];
          if (oppState && oppState.totalDamageDealt > maxDmg) {
            maxDmg = oppState.totalDamageDealt;
            eliminatedBy = oppTracker.robotId;
          }
        }

        battleLog.push({
          type: 'elimination',
          tick: currentTick,
          timestamp: currentTime,
          robotId: tracker.robotId,
          eliminatedByRobotId: eliminatedBy,
          team: tracker.team,
        });
      }
    }

    // ── Detect focus fire (2+ robots targeting same enemy this tick) ──
    const tickTargets: Map<number, number[]> = new Map(); // targetIdx → attackerIdxs

    for (const state of states) {
      if (!state.isAlive) continue;
      if (state.currentTarget === null || state.currentTarget === undefined) continue;

      const targetIdx = state.currentTarget;
      const targetState = states[targetIdx];
      if (!targetState) continue;

      // Only count if targeting opposing team
      const myTeam = teamOf.get(state.teamIndex);
      const targetTeam = teamOf.get(targetIdx);
      if (myTeam === targetTeam) continue;

      if (!tickTargets.has(targetIdx)) {
        tickTargets.set(targetIdx, []);
      }
      tickTargets.get(targetIdx)!.push(state.teamIndex);
    }

    // Process focus fire events
    for (const [targetIdx, attackerIdxs] of tickTargets.entries()) {
      if (attackerIdxs.length >= 2) {
        const targetState = states[targetIdx];
        if (!targetState) continue;

        const attackingTeam = teamOf.get(attackerIdxs[0])!;

        // Calculate average syncProtocols of contributors
        const avgSyncProtocols = attackerIdxs.reduce((sum, idx) => {
          return sum + Number(states[idx].robot.syncProtocols ?? 0);
        }, 0) / attackerIdxs.length;

        const bonus = calculateFocusFireBonus(avgSyncProtocols, attackerIdxs.length, teamSize);

        if (bonus > 0) {
          const contributorRobotIds = attackerIdxs.map(idx => trackers[idx].robotId);
          const targetRobotId = trackers[targetIdx].robotId;

          focusFireEvents.push({
            tick: currentTick,
            targetRobotId,
            contributorRobotIds,
            contributorCount: attackerIdxs.length,
            bonusApplied: bonus,
          });

          battleLog.push({
            type: 'focus_fire',
            tick: currentTick,
            timestamp: currentTime,
            targetRobotId,
            contributorRobotIds,
            bonusApplied: bonus,
          });

          // Track metrics
          if (attackingTeam === 1) {
            focusFireMetrics.team1 += bonus;
          } else {
            focusFireMetrics.team2 += bonus;
          }

          // Apply focus fire damage bonus to contributors
          // The bonus multiplies damage dealt this tick by contributors targeting this enemy
          for (const attackerIdx of attackerIdxs) {
            const attackerState = states[attackerIdx];
            if (attackerState && attackerState.isAlive) {
              // Apply bonus damage to the target (bonus % of recent damage)
              const recentDmg = attackerState.totalDamageDealt - (lastDamageSnapshot.get(attackerIdx) ?? 0);
              if (recentDmg > 0) {
                const bonusDamage = recentDmg * bonus;
                targetState.currentHP -= bonusDamage;

                // Track focus fire bonus damage separately — the combat simulator's
                // internal totalDamageDealt/totalDamageTaken don't include this
                focusFireBonusDamageDealt.set(
                  attackerIdx,
                  (focusFireBonusDamageDealt.get(attackerIdx) ?? 0) + bonusDamage,
                );
                focusFireBonusDamageTaken.set(
                  targetIdx,
                  (focusFireBonusDamageTaken.get(targetIdx) ?? 0) + bonusDamage,
                );

                battleLog.push({
                  type: 'damage',
                  tick: currentTick,
                  timestamp: currentTime,
                  attackerRobotId: trackers[attackerIdx].robotId,
                  defenderRobotId: trackers[targetIdx].robotId,
                  amount: bonusDamage,
                  weaponId: null,
                  isFocusFire: true,
                });
              }
            }
          }
        }
      }
    }

    // ── Apply ally shield regen (supportSystems) ──
    for (const state of states) {
      if (!state.isAlive) continue;

      const supportValue = Number(state.robot.supportSystems ?? 0);
      if (supportValue <= 0) continue;

      const myTeam = teamOf.get(state.teamIndex)!;
      const regenAmount = calculateAllyShieldRegen(supportValue, SIMULATION_TICK);

      if (regenAmount <= 0) continue;

      // Apply regen to all alive allies (not self)
      for (const allyState of states) {
        if (allyState === state) continue;
        if (!allyState.isAlive) continue;
        if (teamOf.get(allyState.teamIndex) !== myTeam) continue;

        const prevShield = allyState.currentShield;
        allyState.currentShield = Math.min(
          allyState.maxShield,
          allyState.currentShield + regenAmount,
        );
        const actualRegen = allyState.currentShield - prevShield;

        if (actualRegen > 0) {
          if (myTeam === 1) {
            allySupportMetrics.team1 += actualRegen;
          } else {
            allySupportMetrics.team2 += actualRegen;
          }

          // Log significant regen events (every 10 ticks to avoid spam)
          if (currentTick % 10 === 0) {
            battleLog.push({
              type: 'shield_regen',
              tick: currentTick,
              timestamp: currentTime,
              supporterRobotId: trackers[state.teamIndex].robotId,
              targetRobotId: trackers[allyState.teamIndex].robotId,
              amount: actualRegen,
            });
          }
        }
      }
    }

    // ── Apply formation defence (formationTactics) ──
    for (const state of states) {
      if (!state.isAlive) continue;

      const myTeam = teamOf.get(state.teamIndex)!;

      // Count allies within FORMATION_RANGE
      let alliesInRange = 0;
      let totalFormationTactics = 0;

      for (const allyState of states) {
        if (allyState === state) continue;
        if (!allyState.isAlive) continue;
        if (teamOf.get(allyState.teamIndex) !== myTeam) continue;

        const dist = euclideanDistance(state.position, allyState.position);
        if (dist <= FORMATION_RANGE) {
          alliesInRange++;
          totalFormationTactics += Number(allyState.robot.formationTactics ?? 0);
        }
      }

      if (alliesInRange > 0) {
        const avgFormationTactics = totalFormationTactics / alliesInRange;
        const reduction = calculateFormationDefense(avgFormationTactics, alliesInRange, teamSize);

        if (reduction > 0) {
          // Store formation defence as a damage reduction modifier on the state
          // This is tracked for metrics; actual damage reduction is applied via
          // the combat system's existing damage pipeline
          if (myTeam === 1) {
            formationDefenceMetrics.team1 += reduction;
          } else {
            formationDefenceMetrics.team2 += reduction;
          }

          // Log significant formation events (every 20 ticks to avoid spam)
          if (currentTick % 20 === 0) {
            battleLog.push({
              type: 'formation_defence',
              tick: currentTick,
              timestamp: currentTime,
              robotId: trackers[state.teamIndex].robotId,
              alliesInRange,
              reductionPercent: reduction * 100,
            });
          }
        }
      }
    }
  };

  // ── Configure and run the battle ──
  const gameModeState: GameModeState = {
    mode: 'custom',
    customData: {
      teamSize,
      teamOf: Object.fromEntries(teamOf),
      tickHook,
    },
  };

  const gameModeConfig: GameModeConfig = {
    targetPriority: teamTargetPriority,
    winCondition: teamWinCondition,
    maxDuration: TEAM_BATTLE_MAX_DURATION,
  };

  const battleConfig: BattleConfig = {
    allowDraws: true,
    maxDuration: TEAM_BATTLE_MAX_DURATION,
    gameModeConfig,
    gameModeState,
    arenaRadius: arena.radius,
  };

  // Run the simulation
  const result = simulateBattleMulti(allRobots, battleConfig);

  // ── Compile final results ──

  // Finalize tracker stats from combat states
  // The simulator tracks its own damageDealt/damageTaken internally, but it
  // doesn't know about focus fire bonus damage applied in the tick hook.
  // We take the simulator's values and ADD the separately-tracked bonus damage.
  if (result.finalStates) {
    for (const state of result.finalStates) {
      const tracker = trackers[state.teamIndex];
      if (tracker) {
        tracker.damageDealt = state.totalDamageDealt + (focusFireBonusDamageDealt.get(state.teamIndex) ?? 0);
        tracker.damageTaken = state.totalDamageTaken + (focusFireBonusDamageTaken.get(state.teamIndex) ?? 0);
      }
    }
  }

  // Determine winning side
  let winningSide: 1 | 2 | null = null;
  if (result.winnerId !== null) {
    // Find which team the winner belongs to
    const winnerTracker = trackers.find(t => t.robotId === result.winnerId);
    winningSide = winnerTracker?.team ?? null;
  }

  const isDraw = result.isDraw || winningSide === null;

  // Build participant results
  const participants: TeamBattleParticipantResult[] = trackers.map(tracker => ({
    robotId: tracker.robotId,
    team: tracker.team,
    damageDealt: tracker.damageDealt,
    damageTaken: tracker.damageTaken,
    finalHP: result.finalStates
      ? Math.max(0, result.finalStates[tracker.stateIndex]?.currentHP ?? 0)
      : 0,
    survivalSeconds: tracker.eliminatedAt !== null
      ? Math.round(tracker.eliminatedAt * 10) / 10
      : result.durationSeconds,
  }));

  // Add damage events from the combat simulator's raw events to our battle log
  // (we already have focus fire, elimination, shield regen, and formation events)
  // Extract key damage events from the simulator's event stream
  let damageEventCount = 0;
  for (const event of result.events) {
    if (event.type === 'attack' || event.type === 'critical') {
      if (event.damage && event.damage > 0 && event.attacker && event.defender) {
        // Find attacker and defender robot IDs
        const attackerTracker = trackers.find(t =>
          allRobots[t.stateIndex]?.name === event.attacker
        );
        const defenderTracker = trackers.find(t =>
          allRobots[t.stateIndex]?.name === event.defender
        );

        if (attackerTracker && defenderTracker) {
          damageEventCount++;
          // Only log every 5th damage event to keep log manageable
          if (damageEventCount % 5 === 0) {
            battleLog.push({
              type: 'damage',
              tick: Math.round(event.timestamp / SIMULATION_TICK),
              timestamp: event.timestamp,
              attackerRobotId: attackerTracker.robotId,
              defenderRobotId: defenderTracker.robotId,
              amount: event.damage,
              weaponId: null,
              isFocusFire: false,
            });
          }
        }
      }
    }
  }

  // Add draw timeout event if applicable
  if (isDraw && result.durationSeconds >= TEAM_BATTLE_MAX_DURATION) {
    battleLog.push({
      type: 'draw_timeout',
      tick: tickCount,
      timestamp: result.durationSeconds,
      durationSeconds: result.durationSeconds,
    });
  }

  // Sort battle log by timestamp
  battleLog.sort((a, b) => a.timestamp - b.timestamp);

  // Build starting/ending position maps keyed by robot name
  const startingPositions: Record<string, { x: number; y: number }> = {};
  const endingPositions: Record<string, { x: number; y: number }> = {};
  if (result.startingPositions) {
    for (const [name, pos] of Object.entries(result.startingPositions)) {
      startingPositions[name] = pos;
    }
  }
  if (result.endingPositions) {
    for (const [name, pos] of Object.entries(result.endingPositions)) {
      endingPositions[name] = pos;
    }
  }

  return {
    winningSide: isDraw ? null : winningSide,
    winnerRobotId: result.winnerId,
    isDraw,
    isByeMatch: false,
    durationSeconds: result.durationSeconds,
    participants,
    battleLog,
    detailedCombatEvents: result.events,
    focusFireEvents,
    focusFireMetrics,
    allySupportMetrics,
    formationDefenceMetrics,
    arenaRadius: arena.radius,
    startingPositions,
    endingPositions,
  };
}
