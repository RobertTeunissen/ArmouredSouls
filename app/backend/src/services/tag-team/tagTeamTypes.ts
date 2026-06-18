import { RobotWithWeapons } from '../battle/combatSimulator';

// Battle constants
export const BATTLE_TIME_LIMIT = 300; // 5 minutes in seconds
export const TAG_TEAM_REWARD_MULTIPLIER = 2; // Tag team rewards are 2x standard
export const TAG_TEAM_PRESTIGE_MULTIPLIER = 1.6; // Tag team prestige is 1.6x standard

// Types
export interface TagTeamWithRobots {
  id: number;
  stableId: number;
  teamName: string;
  teamSize: number;
  activeRobotId: number;
  reserveRobotId: number;
  activeRobot: RobotWithWeapons;
  reserveRobot: RobotWithWeapons;
  tagTeamLp: number;
  tagTeamLeague: string;
  tagTeamLeagueId: string;
  cyclesInTagTeamLeague: number;
  totalTagTeamWins: number;
  totalTagTeamLosses: number;
  totalTagTeamDraws: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TagTeamBattleResult {
  battleId: number;
  winnerId: number | null;
  isDraw: boolean;
  durationSeconds: number;
  team1TagOutTime?: number;
  team2TagOutTime?: number;
  team1ActiveFinalHP: number;
  team1ReserveFinalHP: number;
  team2ActiveFinalHP: number;
  team2ReserveFinalHP: number;
  team1ReserveUsed: boolean; // Track if reserve was used
  team2ReserveUsed: boolean; // Track if reserve was used
  team1ActiveDamageDealt: number; // Damage dealt by team1 active robot
  team1ReserveDamageDealt: number; // Damage dealt by team1 reserve robot
  team2ActiveDamageDealt: number; // Damage dealt by team2 active robot
  team2ReserveDamageDealt: number; // Damage dealt by team2 reserve robot
  team1ActiveSurvivalTime: number; // Time in combat for team1 active robot
  team1ReserveSurvivalTime: number; // Time in combat for team1 reserve robot
  team2ActiveSurvivalTime: number; // Time in combat for team2 active robot
  team2ReserveSurvivalTime: number; // Time in combat for team2 reserve robot
  battleLog: TagTeamRawEvent[]; // Complete battle log with all events
  // 2D arena spatial metadata (from first phase)
  arenaRadius?: number;
  startingPositions?: Record<string, { x: number; y: number }>;
  endingPositions?: Record<string, { x: number; y: number }>;
  phases: Array<{
    robot1Name: string;
    robot2Name: string;
    robot1Stance: string;
    robot2Stance: string;
    robot1MaxHP: number;
    robot2MaxHP: number;
  }>; // Phase robot mappings for narrative conversion
  team1Name: string;
  team2Name: string;
  team1ReserveName: string;
  team2ReserveName: string;
}

/** Base event type for the mixed event array during tag team simulation.
 * Holds both raw CombatEvent objects and manually constructed tag_out/tag_in events. */
export interface TagTeamRawEvent {
  timestamp: number;
  type: string;
  [key: string]: unknown;
}

export interface TagOutEvent {
  timestamp: number;
  teamNumber: 1 | 2;
  robotId: number;
  robotName: string;
  reason: 'yield' | 'destruction';
  finalHP: number;
}

export interface TagInEvent {
  timestamp: number;
  teamNumber: 1 | 2;
  robotId: number;
  robotName: string;
  initialHP: number;
}
