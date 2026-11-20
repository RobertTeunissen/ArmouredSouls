/**
 * Wire contracts of the Practice Arena (`POST /api/practice-arena/battle`):
 * the What-If request overrides, the academy levels the panel simulates
 * against, and the battle results (backend `services/practice-arena`).
 */
import type { UnlockedAchievement } from './achievements';
import type { ArenaPoint, BattleLogEvent } from './battle-log';

/** What-If overrides for an owned robot */
export interface WhatIfOverrides {
  attributes?: Partial<Record<string, number>>; // any of 23 attributes, each 1-50
  loadoutType?: 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
  stance?: 'offensive' | 'defensive' | 'balanced';
  yieldThreshold?: number;
  mainWeaponId?: number;
  offhandWeaponId?: number;
  tuningBonuses?: Partial<Record<string, number>>; // override tuning allocation for this practice battle
}

export interface AcademyLevels {
  combat_training_academy: number;
  defense_training_academy: number;
  mobility_training_academy: number;
  ai_training_academy: number;
}

/** The simulator's result for one practice battle. */
export interface PracticeCombatResult {
  winnerId: number | null;
  robot1FinalHP: number;
  robot2FinalHP: number;
  robot1FinalShield: number;
  robot2FinalShield: number;
  robot1Damage: number;
  robot2Damage: number;
  robot1DamageDealt: number;
  robot2DamageDealt: number;
  durationSeconds: number;
  isDraw: boolean;
  /** Raw simulator events (positions, HP snapshots, formula breakdowns) for playback. */
  events: BattleLogEvent[];
  arenaRadius?: number;
  startingPositions?: Record<string, ArenaPoint>;
  endingPositions?: Record<string, ArenaPoint>;
}

export interface PracticeRobotInfo {
  name: string;
  maxHP: number;
  maxShield: number;
}

/** One practice battle (`count` = 1, and each entry of a batch). */
export interface PracticeBattleResult {
  combatResult: PracticeCombatResult;
  /** Narrative combat log (the same pipeline as league 1v1 battles). */
  battleLog: BattleLogEvent[];
  robot1Info: PracticeRobotInfo;
  robot2Info: PracticeRobotInfo;
  achievementUnlocks?: UnlockedAchievement[];
}

/** A practice batch (`count` > 1). */
export interface PracticeBatchResult {
  results: PracticeBattleResult[];
  aggregate: {
    totalBattles: number;
    robot1Wins: number;
    robot2Wins: number;
    draws: number;
    avgDurationSeconds: number;
    avgRobot1DamageDealt: number;
    avgRobot2DamageDealt: number;
  };
  /**
   * Unlocks from the batch's counter update, at the top level like a single
   * battle's: the frontend's toast subscriber only reads `achievementUnlocks`
   * on the response body (#608).
   */
  achievementUnlocks: UnlockedAchievement[];
}
