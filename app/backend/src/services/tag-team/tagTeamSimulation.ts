import { Robot } from '../../../generated/prisma';
import { simulateBattle } from '../battle/combatSimulator';
import { RobotWithWeapons } from '../battle/combatSimulator';
import { CombatMessageGenerator } from '../battle/combatMessageGenerator';
import {
  TagTeamWithRobots,
  TagTeamBattleResult,
  TagTeamRawEvent,
  TagOutEvent,
  TagInEvent,
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
export function activateReserveRobot(robot: RobotWithWeapons): RobotWithWeapons {
  robot.currentHP = robot.maxHP;
  robot.currentShield = robot.maxShield;
  // Note: Weapon cooldowns are handled by combat simulator
  return robot;
}

/**
 * Simulate a tag team battle with tag-out mechanics
 * Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 * Requirement 7.1, 7.2, 7.3: Record all combat events with timestamps, tag-out/tag-in events
 * Requirement 10.7: Track damage dealt and survival time for fame calculation
 */
export async function simulateTagTeamBattle(
  team1: TagTeamWithRobots,
  team2: TagTeamWithRobots
): Promise<TagTeamBattleResult> {
  const battleEvents: TagTeamRawEvent[] = [];
  const tagOutEvents: TagOutEvent[] = [];
  const tagInEvents: TagInEvent[] = [];

  let team1CurrentRobot = team1.activeRobot;
  let team2CurrentRobot = team2.activeRobot;
  let team1ReserveUsed = false;
  let team2ReserveUsed = false;
  let team1TagOutTime: number | undefined;
  let team2TagOutTime: number | undefined;
  let currentTime: number;
  const maxTime = BATTLE_TIME_LIMIT;

  // Track damage dealt and survival time for each robot
  let team1ActiveDamageDealt = 0;
  let team1ReserveDamageDealt = 0;
  let team2ActiveDamageDealt = 0;
  let team2ReserveDamageDealt = 0;
  let team1ActiveSurvivalTime = 0;
  let team1ReserveSurvivalTime = 0;
  let team2ActiveSurvivalTime = 0;
  let team2ReserveSurvivalTime = 0;
  let lastPhaseWasDraw: boolean; // Track if the final phase ended in a time-expired draw

  // Phase 1: Active robots fight
  const phase1Result = simulateBattle(team1CurrentRobot, team2CurrentRobot);
  const phase1Duration = phase1Result.durationSeconds;
  currentTime = phase1Duration;
  team1CurrentRobot.currentHP = phase1Result.robot1FinalHP;
  team2CurrentRobot.currentHP = phase1Result.robot2FinalHP;
  // FIX: Capture shield state after phase 1 (Requirement 2.4)
  // This ensures surviving robot keeps depleted shields into phase 2
  team1CurrentRobot.currentShield = phase1Result.robot1FinalShield;
  team2CurrentRobot.currentShield = phase1Result.robot2FinalShield;
  
  // Track phase 1 damage and survival time
  team1ActiveDamageDealt += phase1Result.robot1DamageDealt;
  team2ActiveDamageDealt += phase1Result.robot2DamageDealt;
  team1ActiveSurvivalTime += phase1Duration;
  team2ActiveSurvivalTime += phase1Duration;
  
  // Track if phase 1 had a decisive winner (destruction or yield)
  // Used below for tag-out fallback check
  
  // Collect combat events from phase 1 (Requirement 7.1)
  if (phase1Result.events && Array.isArray(phase1Result.events)) {
    battleEvents.push(...phase1Result.events.map(e => ({ ...e })));
  }

  // Capture arena metadata from phase 1 (same radius for all phases)
  const arenaRadius = phase1Result.arenaRadius;
  const startingPositions = phase1Result.startingPositions;
  let endingPositions = phase1Result.endingPositions;
  lastPhaseWasDraw = phase1Result.isDraw;

  // Check for tag-outs (Requirement 3.3: HP ≤ yield threshold OR HP ≤ 0)
  // Also check phase1 winnerId as a fallback: if the simulator ended the battle
  // (via yield or destruction), the losing robot must tag out even if shouldTagOut
  // would miss it due to floating-point edge cases.
  const phase1Winner = phase1Result.winnerId;
  const team1NeedsTagOut = shouldTagOut(team1CurrentRobot) ||
    (phase1Winner !== null && phase1Winner === team2CurrentRobot.id && !team1ReserveUsed);
  const team2NeedsTagOut = shouldTagOut(team2CurrentRobot) ||
    (phase1Winner !== null && phase1Winner === team1CurrentRobot.id && !team2ReserveUsed);

  // If a tag-out is happening, strip the yield/destroyed/battle_end events from phase 1
  // since the battle continues with the reserve robot
  if (team1NeedsTagOut || team2NeedsTagOut) {
    const terminalTypes = ['yield', 'destroyed', 'battle_end'];
    // Remove terminal events that were added from phase 1
    for (let i = battleEvents.length - 1; i >= 0; i--) {
      if (terminalTypes.includes(battleEvents[i].type)) {
        battleEvents.splice(i, 1);
      }
    }
  }

  // Handle simultaneous tag-outs
  if (team1NeedsTagOut && team2NeedsTagOut) {
    // Both teams tag out at the same time
    team1TagOutTime = currentTime;
    team2TagOutTime = currentTime;

    // Record tag-out events (Requirement 3.4: remove from combat)
    const team1TagOutEvent: TagOutEvent = {
      timestamp: currentTime,
      teamNumber: 1,
      robotId: team1CurrentRobot.id,
      robotName: team1CurrentRobot.name,
      reason: team1CurrentRobot.currentHP <= 0 ? 'destruction' : 'yield',
      finalHP: team1CurrentRobot.currentHP,
    };
    tagOutEvents.push(team1TagOutEvent);

    const team2TagOutEvent: TagOutEvent = {
      timestamp: currentTime,
      teamNumber: 2,
      robotId: team2CurrentRobot.id,
      robotName: team2CurrentRobot.name,
      reason: team2CurrentRobot.currentHP <= 0 ? 'destruction' : 'yield',
      finalHP: team2CurrentRobot.currentHP,
    };
    tagOutEvents.push(team2TagOutEvent);

    // Generate tag-out messages (Requirement 7.2)
    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_out',
      teamNumber: 1,
      robotId: team1CurrentRobot.id,
      reason: team1TagOutEvent.reason,
      robot1HP: team1TagOutEvent.finalHP,
      message: CombatMessageGenerator.generateTagOut({
        robotName: team1CurrentRobot.name,
        teamName: team1.teamName,
        reason: team1TagOutEvent.reason,
        finalHP: team1TagOutEvent.finalHP,
      }),
    });

    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_out',
      teamNumber: 2,
      robotId: team2CurrentRobot.id,
      reason: team2TagOutEvent.reason,
      robot2HP: team2TagOutEvent.finalHP,
      message: CombatMessageGenerator.generateTagOut({
        robotName: team2CurrentRobot.name,
        teamName: team2.teamName,
        reason: team2TagOutEvent.reason,
        finalHP: team2TagOutEvent.finalHP,
      }),
    });

    // Activate reserve robots (Requirement 3.5: full HP, fresh cooldowns)
    team1CurrentRobot = activateReserveRobot(team1.reserveRobot);
    team2CurrentRobot = activateReserveRobot(team2.reserveRobot);
    team1ReserveUsed = true;
    team2ReserveUsed = true;

    // Record tag-in events
    const team1TagInEvent: TagInEvent = {
      timestamp: currentTime,
      teamNumber: 1,
      robotId: team1CurrentRobot.id,
      robotName: team1CurrentRobot.name,
      initialHP: team1CurrentRobot.currentHP,
    };
    tagInEvents.push(team1TagInEvent);

    const team2TagInEvent: TagInEvent = {
      timestamp: currentTime,
      teamNumber: 2,
      robotId: team2CurrentRobot.id,
      robotName: team2CurrentRobot.name,
      initialHP: team2CurrentRobot.currentHP,
    };
    tagInEvents.push(team2TagInEvent);

    // Generate tag-in messages (Requirement 7.3)
    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_in',
      teamNumber: 1,
      robotId: team1CurrentRobot.id,
      message: CombatMessageGenerator.generateTagIn({
        robotName: team1CurrentRobot.name,
        teamName: team1.teamName,
        hp: team1CurrentRobot.currentHP,
      }),
    });

    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_in',
      teamNumber: 2,
      robotId: team2CurrentRobot.id,
      message: CombatMessageGenerator.generateTagIn({
        robotName: team2CurrentRobot.name,
        teamName: team2.teamName,
        hp: team2CurrentRobot.currentHP,
      }),
    });

    // Continue battle with reserve robots
    if (currentTime < maxTime) {
      const phase2StartTime = currentTime;
      const phase2Result = simulateBattle(team1CurrentRobot, team2CurrentRobot);
      const phase2Duration = phase2Result.durationSeconds;
      currentTime += phase2Duration;
      team1CurrentRobot.currentHP = phase2Result.robot1FinalHP;
      team2CurrentRobot.currentHP = phase2Result.robot2FinalHP;
      // FIX: Capture shield state after phase 2 (Requirement 2.4)
      team1CurrentRobot.currentShield = phase2Result.robot1FinalShield;
      team2CurrentRobot.currentShield = phase2Result.robot2FinalShield;
      
      // Track phase 2 damage and survival time
      team1ReserveDamageDealt += phase2Result.robot1DamageDealt;
      team2ReserveDamageDealt += phase2Result.robot2DamageDealt;
      team1ReserveSurvivalTime += phase2Duration;
      team2ReserveSurvivalTime += phase2Duration;
      lastPhaseWasDraw = phase2Result.isDraw;
      
      // Collect combat events from phase 2 with timestamp offset (Requirement 7.1)
      if (phase2Result.events && Array.isArray(phase2Result.events)) {
        const offsetEvents = phase2Result.events.map(event => ({
          ...event,
          timestamp: event.timestamp + phase2StartTime,
        }));
        battleEvents.push(...offsetEvents);
      }
    }
  } else if (team1NeedsTagOut) {
    // Only team 1 tags out
    team1TagOutTime = currentTime;

    const team1TagOutEvent: TagOutEvent = {
      timestamp: currentTime,
      teamNumber: 1,
      robotId: team1CurrentRobot.id,
      robotName: team1CurrentRobot.name,
      reason: team1CurrentRobot.currentHP <= 0 ? 'destruction' : 'yield',
      finalHP: team1CurrentRobot.currentHP,
    };
    tagOutEvents.push(team1TagOutEvent);

    // Generate tag-out message (Requirement 7.2)
    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_out',
      teamNumber: 1,
      robotId: team1CurrentRobot.id,
      reason: team1TagOutEvent.reason,
      robot1HP: team1TagOutEvent.finalHP,
      message: CombatMessageGenerator.generateTagOut({
        robotName: team1CurrentRobot.name,
        teamName: team1.teamName,
        reason: team1TagOutEvent.reason,
        finalHP: team1TagOutEvent.finalHP,
      }),
    });

    team1CurrentRobot = activateReserveRobot(team1.reserveRobot);
    team1ReserveUsed = true;

    const team1TagInEvent: TagInEvent = {
      timestamp: currentTime,
      teamNumber: 1,
      robotId: team1CurrentRobot.id,
      robotName: team1CurrentRobot.name,
      initialHP: team1CurrentRobot.currentHP,
    };
    tagInEvents.push(team1TagInEvent);

    // Generate tag-in message (Requirement 7.3)
    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_in',
      teamNumber: 1,
      robotId: team1CurrentRobot.id,
      message: CombatMessageGenerator.generateTagIn({
        robotName: team1CurrentRobot.name,
        teamName: team1.teamName,
        hp: team1CurrentRobot.currentHP,
      }),
    });

    // Continue battle
    if (currentTime < maxTime) {
      const phase2StartTime = currentTime;
      const phase2Result = simulateBattle(team1CurrentRobot, team2CurrentRobot);
      const phase2Duration = phase2Result.durationSeconds;
      currentTime += phase2Duration;
      team1CurrentRobot.currentHP = phase2Result.robot1FinalHP;
      team2CurrentRobot.currentHP = phase2Result.robot2FinalHP;
      // FIX: Capture shield state after phase 2 (Requirement 2.4)
      team1CurrentRobot.currentShield = phase2Result.robot1FinalShield;
      team2CurrentRobot.currentShield = phase2Result.robot2FinalShield;
      
      // Track phase 2 damage and survival time
      team1ReserveDamageDealt += phase2Result.robot1DamageDealt;
      team2ActiveDamageDealt += phase2Result.robot2DamageDealt;
      team1ReserveSurvivalTime += phase2Duration;
      team2ActiveSurvivalTime += phase2Duration;
      lastPhaseWasDraw = phase2Result.isDraw;
      
      // Collect combat events from phase 2 with timestamp offset (Requirement 7.1)
      if (phase2Result.events && Array.isArray(phase2Result.events)) {
        const offsetEvents = phase2Result.events.map(event => ({
          ...event,
          timestamp: event.timestamp + phase2StartTime,
        }));
        battleEvents.push(...offsetEvents);
      }

      // Check if team 2 needs to tag out now
      if (shouldTagOut(team2CurrentRobot) && !team2ReserveUsed) {
        team2TagOutTime = currentTime;

        const team2TagOutEvent: TagOutEvent = {
          timestamp: currentTime,
          teamNumber: 2,
          robotId: team2CurrentRobot.id,
          robotName: team2CurrentRobot.name,
          reason: team2CurrentRobot.currentHP <= 0 ? 'destruction' : 'yield',
          finalHP: team2CurrentRobot.currentHP,
        };
        tagOutEvents.push(team2TagOutEvent);

        // Generate tag-out message (Requirement 7.2)
        battleEvents.push({
          timestamp: currentTime,
          type: 'tag_out',
          teamNumber: 2,
          robotId: team2CurrentRobot.id,
          reason: team2TagOutEvent.reason,
          robot2HP: team2TagOutEvent.finalHP,
          message: CombatMessageGenerator.generateTagOut({
            robotName: team2CurrentRobot.name,
            teamName: team2.teamName,
            reason: team2TagOutEvent.reason,
            finalHP: team2TagOutEvent.finalHP,
          }),
        });

        team2CurrentRobot = activateReserveRobot(team2.reserveRobot);
        team2ReserveUsed = true;

        const team2TagInEvent: TagInEvent = {
          timestamp: currentTime,
          teamNumber: 2,
          robotId: team2CurrentRobot.id,
          robotName: team2CurrentRobot.name,
          initialHP: team2CurrentRobot.currentHP,
        };
        tagInEvents.push(team2TagInEvent);

        // Generate tag-in message (Requirement 7.3)
        battleEvents.push({
          timestamp: currentTime,
          type: 'tag_in',
          teamNumber: 2,
          robotId: team2CurrentRobot.id,
          message: CombatMessageGenerator.generateTagIn({
            robotName: team2CurrentRobot.name,
            teamName: team2.teamName,
            hp: team2CurrentRobot.currentHP,
          }),
        });

        // Final phase
        if (currentTime < maxTime) {
          const phase3StartTime = currentTime;
          const phase3Result = simulateBattle(team1CurrentRobot, team2CurrentRobot);
          const phase3Duration = phase3Result.durationSeconds;
          currentTime += phase3Duration;
          team1CurrentRobot.currentHP = phase3Result.robot1FinalHP;
          team2CurrentRobot.currentHP = phase3Result.robot2FinalHP;
          // FIX: Capture shield state after phase 3 (Requirement 2.4)
          team1CurrentRobot.currentShield = phase3Result.robot1FinalShield;
          team2CurrentRobot.currentShield = phase3Result.robot2FinalShield;
          
          // Track phase 3 damage and survival time
          team1ReserveDamageDealt += phase3Result.robot1DamageDealt;
          team2ReserveDamageDealt += phase3Result.robot2DamageDealt;
          team1ReserveSurvivalTime += phase3Duration;
          team2ReserveSurvivalTime += phase3Duration;
          lastPhaseWasDraw = phase3Result.isDraw;
          
          // Collect combat events from phase 3 with timestamp offset (Requirement 7.1)
          if (phase3Result.events && Array.isArray(phase3Result.events)) {
            const offsetEvents = phase3Result.events.map(event => ({
              ...event,
              timestamp: event.timestamp + phase3StartTime,
            }));
            battleEvents.push(...offsetEvents);
          }
        }
      }
    }
  } else if (team2NeedsTagOut) {
    // Only team 2 tags out
    team2TagOutTime = currentTime;

    const team2TagOutEvent: TagOutEvent = {
      timestamp: currentTime,
      teamNumber: 2,
      robotId: team2CurrentRobot.id,
      robotName: team2CurrentRobot.name,
      reason: team2CurrentRobot.currentHP <= 0 ? 'destruction' : 'yield',
      finalHP: team2CurrentRobot.currentHP,
    };
    tagOutEvents.push(team2TagOutEvent);

    // Generate tag-out message (Requirement 7.2)
    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_out',
      teamNumber: 2,
      robotId: team2CurrentRobot.id,
      reason: team2TagOutEvent.reason,
      robot2HP: team2TagOutEvent.finalHP,
      message: CombatMessageGenerator.generateTagOut({
        robotName: team2CurrentRobot.name,
        teamName: team2.teamName,
        reason: team2TagOutEvent.reason,
        finalHP: team2TagOutEvent.finalHP,
      }),
    });

    team2CurrentRobot = activateReserveRobot(team2.reserveRobot);
    team2ReserveUsed = true;

    const team2TagInEvent: TagInEvent = {
      timestamp: currentTime,
      teamNumber: 2,
      robotId: team2CurrentRobot.id,
      robotName: team2CurrentRobot.name,
      initialHP: team2CurrentRobot.currentHP,
    };
    tagInEvents.push(team2TagInEvent);

    // Generate tag-in message (Requirement 7.3)
    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_in',
      teamNumber: 2,
      robotId: team2CurrentRobot.id,
      message: CombatMessageGenerator.generateTagIn({
        robotName: team2CurrentRobot.name,
        teamName: team2.teamName,
        hp: team2CurrentRobot.currentHP,
      }),
    });

    // Continue battle
    if (currentTime < maxTime) {
      const phase2StartTime = currentTime;
      const phase2Result = simulateBattle(team1CurrentRobot, team2CurrentRobot);
      const phase2Duration = phase2Result.durationSeconds;
      currentTime += phase2Duration;
      team1CurrentRobot.currentHP = phase2Result.robot1FinalHP;
      team2CurrentRobot.currentHP = phase2Result.robot2FinalHP;
      // FIX: Capture shield state after phase 2 (Requirement 2.4)
      team1CurrentRobot.currentShield = phase2Result.robot1FinalShield;
      team2CurrentRobot.currentShield = phase2Result.robot2FinalShield;
      
      // Track phase 2 damage and survival time
      team1ActiveDamageDealt += phase2Result.robot1DamageDealt;
      team2ReserveDamageDealt += phase2Result.robot2DamageDealt;
      team1ActiveSurvivalTime += phase2Duration;
      team2ReserveSurvivalTime += phase2Duration;
      lastPhaseWasDraw = phase2Result.isDraw;
      
      // Collect combat events from phase 2 with timestamp offset (Requirement 7.1)
      if (phase2Result.events && Array.isArray(phase2Result.events)) {
        const offsetEvents = phase2Result.events.map(event => ({
          ...event,
          timestamp: event.timestamp + phase2StartTime,
        }));
        battleEvents.push(...offsetEvents);
      }

      // Check if team 1 needs to tag out now
      if (shouldTagOut(team1CurrentRobot) && !team1ReserveUsed) {
        team1TagOutTime = currentTime;

        const team1TagOutEvent: TagOutEvent = {
          timestamp: currentTime,
          teamNumber: 1,
          robotId: team1CurrentRobot.id,
          robotName: team1CurrentRobot.name,
          reason: team1CurrentRobot.currentHP <= 0 ? 'destruction' : 'yield',
          finalHP: team1CurrentRobot.currentHP,
        };
        tagOutEvents.push(team1TagOutEvent);

        // Generate tag-out message (Requirement 7.2)
        battleEvents.push({
          timestamp: currentTime,
          type: 'tag_out',
          teamNumber: 1,
          robotId: team1CurrentRobot.id,
          reason: team1TagOutEvent.reason,
          robot1HP: team1TagOutEvent.finalHP,
          message: CombatMessageGenerator.generateTagOut({
            robotName: team1CurrentRobot.name,
            teamName: team1.teamName,
            reason: team1TagOutEvent.reason,
            finalHP: team1TagOutEvent.finalHP,
          }),
        });

        team1CurrentRobot = activateReserveRobot(team1.reserveRobot);
        team1ReserveUsed = true;

        const team1TagInEvent: TagInEvent = {
          timestamp: currentTime,
          teamNumber: 1,
          robotId: team1CurrentRobot.id,
          robotName: team1CurrentRobot.name,
          initialHP: team1CurrentRobot.currentHP,
        };
        tagInEvents.push(team1TagInEvent);

        // Generate tag-in message (Requirement 7.3)
        battleEvents.push({
          timestamp: currentTime,
          type: 'tag_in',
          teamNumber: 1,
          robotId: team1CurrentRobot.id,
          message: CombatMessageGenerator.generateTagIn({
            robotName: team1CurrentRobot.name,
            teamName: team1.teamName,
            hp: team1CurrentRobot.currentHP,
          }),
        });

        // Final phase
        if (currentTime < maxTime) {
          const phase3StartTime = currentTime;
          const phase3Result = simulateBattle(team1CurrentRobot, team2CurrentRobot);
          const phase3Duration = phase3Result.durationSeconds;
          currentTime += phase3Duration;
          team1CurrentRobot.currentHP = phase3Result.robot1FinalHP;
          team2CurrentRobot.currentHP = phase3Result.robot2FinalHP;
          // FIX: Capture shield state after phase 3 (Requirement 2.4)
          team1CurrentRobot.currentShield = phase3Result.robot1FinalShield;
          team2CurrentRobot.currentShield = phase3Result.robot2FinalShield;
          
          // Track phase 3 damage and survival time
          team1ReserveDamageDealt += phase3Result.robot1DamageDealt;
          team2ReserveDamageDealt += phase3Result.robot2DamageDealt;
          team1ReserveSurvivalTime += phase3Duration;
          team2ReserveSurvivalTime += phase3Duration;
          lastPhaseWasDraw = phase3Result.isDraw;
          
          // Collect combat events from phase 3 with timestamp offset (Requirement 7.1)
          if (phase3Result.events && Array.isArray(phase3Result.events)) {
            const offsetEvents = phase3Result.events.map(event => ({
              ...event,
              timestamp: event.timestamp + phase3StartTime,
            }));
            battleEvents.push(...offsetEvents);
          }
        }
      }
    }
  }

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
  const _team1CurrentFighterId = team1ReserveUsed ? team1.reserveRobotId : team1.activeRobotId;
  const _team2CurrentFighterId = team2ReserveUsed ? team2.reserveRobotId : team2.activeRobotId;

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
    team1TagOutTime,
    team2TagOutTime,
    team1ActiveFinalHP,
    team1ReserveFinalHP,
    team2ActiveFinalHP,
    team2ReserveFinalHP,
    team1ReserveUsed,
    team2ReserveUsed,
    team1ActiveDamageDealt,
    team1ReserveDamageDealt,
    team2ActiveDamageDealt,
    team2ReserveDamageDealt,
    team1ActiveSurvivalTime,
    team1ReserveSurvivalTime,
    team2ActiveSurvivalTime,
    team2ReserveSurvivalTime,
    battleLog: battleEvents, // Raw events - will be converted to narrative in createTagTeamBattleRecord
    arenaRadius,
    startingPositions,
    endingPositions,
    // Phase tracking for narrative conversion
    phases: (() => {
      const phases: Array<{
        robot1Name: string;
        robot2Name: string;
        robot1Stance: string;
        robot2Stance: string;
        robot1MaxHP: number;
        robot2MaxHP: number;
      }> = [];
      // Phase 1 is always active vs active
      phases.push({
        robot1Name: team1.activeRobot.name,
        robot2Name: team2.activeRobot.name,
        robot1Stance: team1.activeRobot.stance,
        robot2Stance: team2.activeRobot.stance,
        robot1MaxHP: team1.activeRobot.maxHP,
        robot2MaxHP: team2.activeRobot.maxHP,
      });
      // Phase 2+ depends on who tagged out
      if (team1NeedsTagOut && team2NeedsTagOut) {
        phases.push({
          robot1Name: team1.reserveRobot.name,
          robot2Name: team2.reserveRobot.name,
          robot1Stance: team1.reserveRobot.stance,
          robot2Stance: team2.reserveRobot.stance,
          robot1MaxHP: team1.reserveRobot.maxHP,
          robot2MaxHP: team2.reserveRobot.maxHP,
        });
      } else if (team1NeedsTagOut) {
        phases.push({
          robot1Name: team1.reserveRobot.name,
          robot2Name: team2.activeRobot.name,
          robot1Stance: team1.reserveRobot.stance,
          robot2Stance: team2.activeRobot.stance,
          robot1MaxHP: team1.reserveRobot.maxHP,
          robot2MaxHP: team2.activeRobot.maxHP,
        });
        if (team2ReserveUsed) {
          phases.push({
            robot1Name: team1.reserveRobot.name,
            robot2Name: team2.reserveRobot.name,
            robot1Stance: team1.reserveRobot.stance,
            robot2Stance: team2.reserveRobot.stance,
            robot1MaxHP: team1.reserveRobot.maxHP,
            robot2MaxHP: team2.reserveRobot.maxHP,
          });
        }
      } else if (team2NeedsTagOut) {
        phases.push({
          robot1Name: team1.activeRobot.name,
          robot2Name: team2.reserveRobot.name,
          robot1Stance: team1.activeRobot.stance,
          robot2Stance: team2.reserveRobot.stance,
          robot1MaxHP: team1.activeRobot.maxHP,
          robot2MaxHP: team2.reserveRobot.maxHP,
        });
        if (team1ReserveUsed) {
          phases.push({
            robot1Name: team1.reserveRobot.name,
            robot2Name: team2.reserveRobot.name,
            robot1Stance: team1.reserveRobot.stance,
            robot2Stance: team2.reserveRobot.stance,
            robot1MaxHP: team1.reserveRobot.maxHP,
            robot2MaxHP: team2.reserveRobot.maxHP,
          });
        }
      }
      return phases;
    })(),
    team1Name: team1.teamName,
    team2Name: team2.teamName,
    team1ReserveName: team1.reserveRobot.name,
    team2ReserveName: team2.reserveRobot.name,
  };
}
