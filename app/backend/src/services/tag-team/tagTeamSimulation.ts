import { Robot } from '../../../generated/prisma';
import { simulateBattle } from '../battle/combatSimulator';
import { RobotWithWeapons } from '../battle/combatSimulator';
import { CombatMessageGenerator } from '../battle/combatMessageGenerator';
import {
  TagTeamWithRobots,
  TagTeamBattleResult,
  TagTeamRawEvent,
  BATTLE_TIME_LIMIT,
} from './tagTeamTypes';

/**
 * Check if a robot should tag out
 * Requirement 3.3: Tag-out when HP ≤ yield threshold OR HP ≤ 0
 */
export function shouldTagOut(robot: Robot): boolean {
  if (robot.currentHP <= 0) {
    return true;
  }

  // Use the same percentage-based check as shouldYield in combatSimulator
  // to avoid rounding mismatches (e.g. Math.floor(5.5) = 5 missing HP of 5.45)
  const hpPercent = (robot.currentHP / robot.maxHP) * 100;
  return hpPercent <= robot.yieldThreshold && hpPercent > 0;
}

/**
 * Activate a reserve robot
 * Requirement 3.5: Set HP to 100%, reset weapon cooldowns to 0
 */
function activateReserveRobot(robot: RobotWithWeapons): RobotWithWeapons {
  robot.currentHP = robot.maxHP;
  robot.currentShield = robot.maxShield;
  // Note: Weapon cooldowns are handled by combat simulator
  return robot;
}

type TeamNumber = 1 | 2;
type TagTeamPhase = TagTeamBattleResult['phases'][number];

/** One team's running state across the phases of a tag team battle. */
interface TeamSide {
  team: TagTeamWithRobots;
  teamNumber: TeamNumber;
  /** The robot fighting now: the Active robot until the tag-out, then the Reserve. */
  current: RobotWithWeapons;
  reserveUsed: boolean;
  tagOutTime?: number;
  activeDamageDealt: number;
  reserveDamageDealt: number;
  activeSurvivalTime: number;
  reserveSurvivalTime: number;
}

function createSide(team: TagTeamWithRobots, teamNumber: TeamNumber): TeamSide {
  return {
    team, teamNumber, current: team.activeRobot, reserveUsed: false,
    activeDamageDealt: 0, reserveDamageDealt: 0, activeSurvivalTime: 0, reserveSurvivalTime: 0,
  };
}

/**
 * Simulate a tag team battle with tag-out mechanics
 * Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 * Requirement 7.1, 7.2, 7.3: Record all combat events with timestamps, tag-out/tag-in events
 * Requirement 10.7: Track damage dealt and survival time for fame calculation
 *
 * Phase 1 is Active vs Active. A side whose robot yields or is destroyed tags
 * in its Reserve (both sides at once when both fall in phase 1), and the
 * battle continues until each side has used its Reserve or time runs out.
 */
export async function simulateTagTeamBattle(
  team1: TagTeamWithRobots,
  team2: TagTeamWithRobots
): Promise<TagTeamBattleResult> {
  const battleEvents: TagTeamRawEvent[] = [];
  const side1 = createSide(team1, 1);
  const side2 = createSide(team2, 2);
  const maxTime = BATTLE_TIME_LIMIT;
  let currentTime = 0;
  let lastPhaseWasDraw = false; // Whether the final phase ended in a time-expired draw

  const matchup = (): TagTeamPhase => ({
    robot1Name: side1.current.name,
    robot2Name: side2.current.name,
    robot1Stance: side1.current.stance,
    robot2Stance: side2.current.stance,
    robot1MaxHP: side1.current.maxHP,
    robot2MaxHP: side2.current.maxHP,
  });
  const phases: TagTeamPhase[] = [matchup()];

  /** Fight the current robots, carry HP/shields forward and credit damage and time. */
  const runPhase = (): ReturnType<typeof simulateBattle> => {
    const phaseStartTime = currentTime;
    const result = simulateBattle(side1.current, side2.current);
    const duration = result.durationSeconds;
    currentTime += duration;
    // Shields carry over too, so a surviving robot keeps depleted shields (Requirement 2.4)
    side1.current.currentHP = result.robot1FinalHP;
    side2.current.currentHP = result.robot2FinalHP;
    side1.current.currentShield = result.robot1FinalShield;
    side2.current.currentShield = result.robot2FinalShield;
    for (const [side, damage] of [[side1, result.robot1DamageDealt], [side2, result.robot2DamageDealt]] as const) {
      if (side.reserveUsed) {
        side.reserveDamageDealt += damage;
        side.reserveSurvivalTime += duration;
      } else {
        side.activeDamageDealt += damage;
        side.activeSurvivalTime += duration;
      }
    }
    lastPhaseWasDraw = result.isDraw;
    // Combat events with the phase's start as timestamp offset (Requirement 7.1)
    if (result.events && Array.isArray(result.events)) {
      battleEvents.push(...result.events.map(event => ({ ...event, timestamp: event.timestamp + phaseStartTime })));
    }
    return result;
  };

  /** Requirements 3.4, 7.2: the current robot leaves combat. */
  const tagOut = (side: TeamSide): void => {
    side.tagOutTime = currentTime;
    const robot = side.current;
    const reason = robot.currentHP <= 0 ? 'destruction' : 'yield';
    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_out',
      teamNumber: side.teamNumber,
      robotId: robot.id,
      reason,
      [side.teamNumber === 1 ? 'robot1HP' : 'robot2HP']: robot.currentHP,
      message: CombatMessageGenerator.generateTagOut({
        robotName: robot.name,
        teamName: side.team.teamName,
        reason,
        finalHP: robot.currentHP,
      }),
    });
  };

  /** Requirements 3.5, 7.3: the Reserve enters at full HP and shields. */
  const tagIn = (side: TeamSide): void => {
    side.current = activateReserveRobot(side.team.reserveRobot);
    side.reserveUsed = true;
    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_in',
      teamNumber: side.teamNumber,
      robotId: side.current.id,
      message: CombatMessageGenerator.generateTagIn({
        robotName: side.current.name,
        teamName: side.team.teamName,
        hp: side.current.currentHP,
      }),
    });
  };

  // Phase 1: Active robots fight
  const phase1Result = runPhase();
  // Arena metadata from phase 1 (same radius for all phases)
  const arenaRadius = phase1Result.arenaRadius;
  const startingPositions = phase1Result.startingPositions;
  let endingPositions = phase1Result.endingPositions;

  // Tag-out check (Requirement 3.3: HP ≤ yield threshold OR HP ≤ 0). The phase 1
  // winner is a fallback: if the simulator ended the battle by yield or
  // destruction, the loser tags out even if shouldTagOut misses it on a
  // floating-point edge.
  const phase1Winner = phase1Result.winnerId;
  const team1NeedsTagOut = shouldTagOut(side1.current) ||
    (phase1Winner !== null && phase1Winner === side2.current.id);
  const team2NeedsTagOut = shouldTagOut(side2.current) ||
    (phase1Winner !== null && phase1Winner === side1.current.id);

  if (team1NeedsTagOut || team2NeedsTagOut) {
    // The battle continues with a Reserve, so phase 1's ending events are dropped
    const terminalTypes = ['yield', 'destroyed', 'battle_end'];
    for (let i = battleEvents.length - 1; i >= 0; i--) {
      if (terminalTypes.includes(battleEvents[i].type)) {
        battleEvents.splice(i, 1);
      }
    }
  }

  if (team1NeedsTagOut && team2NeedsTagOut) {
    // Both sides tag out at the same moment: Reserve vs Reserve
    tagOut(side1);
    tagOut(side2);
    tagIn(side1);
    tagIn(side2);
    phases.push(matchup());
    if (currentTime < maxTime) runPhase();
  } else if (team1NeedsTagOut || team2NeedsTagOut) {
    const first = team1NeedsTagOut ? side1 : side2;
    const other = team1NeedsTagOut ? side2 : side1;
    tagOut(first);
    tagIn(first);
    phases.push(matchup());
    if (currentTime < maxTime) {
      runPhase();
      // The other side's Active may fall to the Reserve: final phase, Reserve vs Reserve
      if (shouldTagOut(other.current) && !other.reserveUsed) {
        tagOut(other);
        tagIn(other);
        phases.push(matchup());
        if (currentTime < maxTime) runPhase();
      }
    }
  }

  const team1CurrentRobot = side1.current;
  const team2CurrentRobot = side2.current;
  const team1ReserveUsed = side1.reserveUsed;
  const team2ReserveUsed = side2.reserveUsed;

  // Determine winner (Requirements 3.6, 3.7, 3.8)
  // Winner is determined by the final state after all phases complete
  let winnerId: number | null = null;
  let isDraw = false;

  // Calculate final HP for each robot on each team
  const team1ActiveFinalHP = team1.activeRobot.currentHP;
  const team1ReserveFinalHP = team1ReserveUsed ? team1CurrentRobot.currentHP : team1.reserveRobot.maxHP;
  const team2ActiveFinalHP = team2.activeRobot.currentHP;
  const team2ReserveFinalHP = team2ReserveUsed ? team2CurrentRobot.currentHP : team2.reserveRobot.maxHP;

  // Determine which robot is currently fighting for each team (the one that finished the battle)
  const team1CurrentFighterHP = team1ReserveUsed ? team1ReserveFinalHP : team1ActiveFinalHP;
  const team2CurrentFighterHP = team2ReserveUsed ? team2ReserveFinalHP : team2ActiveFinalHP;

  // Calculate total remaining HP for each team (active + reserve)
  // This is used for draw detection - a team is only exhausted when ALL robots are destroyed
  const team1TotalHP = team1ActiveFinalHP + (team1ReserveUsed ? team1ReserveFinalHP : team1.reserveRobot.maxHP);
  const team2TotalHP = team2ActiveFinalHP + (team2ReserveUsed ? team2ReserveFinalHP : team2.reserveRobot.maxHP);

  // Requirement 3.8: Battle timeout draw
  // This triggers when the overall tag team time limit is reached, OR when
  // the inner phase(s) all ended in draws (time expired without a decisive result).
  // The inner simulateBattle has its own 120s max duration — if it times out
  // with both robots alive, that's a draw even though currentTime < maxTime.
  if (currentTime >= maxTime || lastPhaseWasDraw) {
    isDraw = true;
  }
  // Requirement 3.7: Both teams exhausted (all robots destroyed/yielded)
  // Only declare draw when BOTH teams have 0 total HP (active + reserve)
  else if (team1TotalHP <= 0 && team2TotalHP <= 0) {
    isDraw = true;
  }
  // Team 1 exhausted - all robots destroyed
  else if (team1TotalHP <= 0) {
    winnerId = team2.id;  // FIXED: Use team ID, not robot ID (Requirement 2.1)
  }
  // Team 2 exhausted - all robots destroyed
  else if (team2TotalHP <= 0) {
    winnerId = team1.id;  // FIXED: Use team ID, not robot ID (Requirement 2.1)
  }
  // Requirement 3.6: Team defeat - winner is the team whose current fighter has more HP
  // This covers both destruction (HP = 0) and yield (HP > 0 but yielded)
  else if (team1CurrentFighterHP <= 0) {
    winnerId = team2.id;  // FIXED: Use team ID, not robot ID (Requirement 2.1)
  } else if (team2CurrentFighterHP <= 0) {
    winnerId = team1.id;  // FIXED: Use team ID, not robot ID (Requirement 2.1)
  } else if (team1CurrentFighterHP > team2CurrentFighterHP) {
    // Both robots still have HP, winner is the one with more HP (yield case)
    winnerId = team1.id;  // FIXED: Use team ID, not robot ID (Requirement 2.1)
  } else if (team2CurrentFighterHP > team1CurrentFighterHP) {
    winnerId = team2.id;  // FIXED: Use team ID, not robot ID (Requirement 2.1)
  } else {
    // Equal HP - draw
    isDraw = true;
  }

  // Compute final endingPositions from the last events with position data
  // (later phases override phase1's endingPositions)
  for (let i = battleEvents.length - 1; i >= 0; i--) {
    const evt = battleEvents[i];
    const positions = evt.positions as Record<string, { x: number; y: number }> | undefined;
    if (positions && Object.keys(positions).length > 0) {
      endingPositions = positions;
      break;
    }
  }

  return {
    battleId: 0, // Will be set after creating battle record
    winnerId,
    isDraw,
    durationSeconds: Math.min(currentTime, maxTime),
    team1TagOutTime: side1.tagOutTime,
    team2TagOutTime: side2.tagOutTime,
    team1ActiveFinalHP,
    team1ReserveFinalHP,
    team2ActiveFinalHP,
    team2ReserveFinalHP,
    team1ReserveUsed,
    team2ReserveUsed,
    team1ActiveDamageDealt: side1.activeDamageDealt,
    team1ReserveDamageDealt: side1.reserveDamageDealt,
    team2ActiveDamageDealt: side2.activeDamageDealt,
    team2ReserveDamageDealt: side2.reserveDamageDealt,
    team1ActiveSurvivalTime: side1.activeSurvivalTime,
    team1ReserveSurvivalTime: side1.reserveSurvivalTime,
    team2ActiveSurvivalTime: side2.activeSurvivalTime,
    team2ReserveSurvivalTime: side2.reserveSurvivalTime,
    battleLog: battleEvents, // Raw events - will be converted to narrative in createTagTeamBattleRecord
    arenaRadius,
    startingPositions,
    endingPositions,
    // Phase tracking for narrative conversion
    phases,
    team1Name: team1.teamName,
    team2Name: team2.teamName,
    team1ReserveName: team1.reserveRobot.name,
    team2ReserveName: team2.reserveRobot.name,
  };
}
