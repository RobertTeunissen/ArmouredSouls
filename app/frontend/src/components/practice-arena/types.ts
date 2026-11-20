/**
 * Shared types for Practice Arena components.
 *
 * Extracted from PracticeArenaPage.tsx during component splitting (Spec 18).
 */

import type { WhatIfOverrides } from '@shared/types';

// ---------------------------------------------------------------------------
// Enums / Unions
// ---------------------------------------------------------------------------

export type LoadoutType = 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
export type Stance = 'offensive' | 'defensive' | 'balanced';
import type { RangeBand } from '@shared/types';
export type { RangeBand };
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

/** What-If panel state: the request overrides plus the client-only academy simulation. */
export interface WhatIfSettings extends WhatIfOverrides {
  /** Simulated academy level overrides (local to What-If, not sent to backend) */
  simulatedAcademyLevels?: Record<string, number>;
}

export interface SlotState {
  mode: SlotMode;
  robotId: number | null;
  overrides: WhatIfSettings;
  sparringConfig: SparringConfig;
}

export type { PracticeBatchResult, PracticeBattleResult } from '@shared/types';

// ---------------------------------------------------------------------------
// Academy Levels shape (used by WhatIfPanel and BattleSlotPanel)
// ---------------------------------------------------------------------------
