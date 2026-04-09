/**
 * Shared types for Practice Arena components.
 *
 * Extracted from PracticeArenaPage.tsx during component splitting (Spec 18).
 */

import type { PlaybackCombatResult } from '../BattlePlaybackViewer/types';

// ---------------------------------------------------------------------------
// Enums / Unions
// ---------------------------------------------------------------------------

export type LoadoutType = 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
export type Stance = 'offensive' | 'defensive' | 'balanced';
export type RangeBand = 'melee' | 'short' | 'mid' | 'long';
export type BotTier = 'WimpBot' | 'AverageBot' | 'ExpertBot' | 'UltimateBot';
export type SlotMode = 'owned' | 'sparring';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface OwnedRobot {
  id: number;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface SparringPartnerDef {
  botTier: BotTier;
  description: string;
  attributeLevel: number;
  priceTier: { min: number; max: number };
  loadoutOptions: string[];
  rangeBandOptions: string[];
  stanceOptions: string[];
}

export interface SparringConfig {
  botTier: BotTier;
  loadoutType: LoadoutType;
  rangeBand: RangeBand;
  stance: Stance;
  yieldThreshold: number;
}

export interface WhatIfOverrides {
  attributes?: Record<string, number>;
  loadoutType?: LoadoutType;
  stance?: Stance;
  yieldThreshold?: number;
  mainWeaponId?: number;
  offhandWeaponId?: number;
  /** Simulated academy level overrides (local to What-If, not sent to backend) */
  simulatedAcademyLevels?: Record<string, number>;
}

export interface SlotState {
  mode: SlotMode;
  robotId: number | null;
  overrides: WhatIfOverrides;
  sparringConfig: SparringConfig;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PracticeBattleResult {
  combatResult: PlaybackCombatResult;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  battleLog: any[];
  robot1Info: { name: string; maxHP: number; maxShield: number };
  robot2Info: { name: string; maxHP: number; maxShield: number };
}

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
}

// ---------------------------------------------------------------------------
// Academy Levels shape (used by WhatIfPanel and BattleSlotPanel)
// ---------------------------------------------------------------------------

export interface AcademyLevels {
  combat_training_academy: number;
  defense_training_academy: number;
  mobility_training_academy: number;
  ai_training_academy: number;
}
