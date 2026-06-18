/**
 * Achievement Types & Configuration
 * All exported interfaces, event type definitions, and the EVENT_TRIGGER_MAP.
 */

import type { AchievementTier, AchievementTriggerType } from '../../config/achievements';

// ─── Event Types ─────────────────────────────────────────────────────

export type AchievementEventType =
  | 'battle_complete'
  | 'league_promotion'
  | 'weapon_purchased'
  | 'weapon_sold'
  | 'weapon_refined'
  | 'weapon_equipped'
  | 'attribute_upgraded'
  | 'facility_upgraded'
  | 'robot_created'
  | 'tuning_allocated'
  | 'stance_changed'
  | 'onboarding_complete'
  | 'practice_battle'
  | 'tournament_complete'
  | 'daily_finances';

export interface AchievementEvent {
  type: AchievementEventType;
  data: Record<string, unknown>;
}

export interface UnlockedAchievement {
  id: string;
  name: string;
  description: string;
  tier: AchievementTier;
  rewardCredits: number;
  rewardPrestige: number;
  badgeIconFile: string;
  robotId: number | null;
  robotName: string | null;
}

// ─── Response Types ────────────────────────────────────────────────────

export interface AchievementWithProgress {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: string;
  rewardCredits: number;
  rewardPrestige: number;
  badgeIconFile: string;
  hidden: boolean;
  unlocked: boolean;
  unlockedAt: string | null;
  robotId: number | null;
  robotName: string | null;
  progress: {
    current: number;
    target: number;
    label: string;
    bestRobotName?: string;
  } | null;
  isPinned: boolean;
}

export interface AchievementsResponse {
  achievements: AchievementWithProgress[];
  summary: {
    total: number;
    unlocked: number;
    byTier: Record<string, { total: number; unlocked: number }>;
  };
  rarity: {
    counts: Record<string, number>;
    totalActivePlayers: number;
  };
}

export interface PinnedAchievement {
  id: string;
  name: string;
  tier: string;
  badgeIconFile: string;
  unlockedAt: string;
}

export interface StableAchievementData {
  pinned: PinnedAchievement[];
  totalUnlocked: number;
  totalAvailable: number;
}

export interface AchievementRarityCache {
  counts: Map<string, number>;
  totalActivePlayers: number;
  refreshedAt: Date;
}

// ─── Service Interface ───────────────────────────────────────────────

export interface IAchievementService {
  checkAndAward(
    userId: number,
    robotId: number | null,
    event: AchievementEvent,
  ): Promise<UnlockedAchievement[]>;

  getPlayerAchievements(userId: number): Promise<AchievementsResponse>;
  getRecentUnlocks(userId: number, limit?: number, since?: Date): Promise<(UnlockedAchievement & { unlockedAt: string })[]>;
  updatePinnedAchievements(userId: number, achievementIds: string[]): Promise<void>;
  getStableAchievements(userId: number): Promise<StableAchievementData>;
  refreshRarityCache(): Promise<void>;
}

// ─── Event → Trigger Type Mapping ────────────────────────────────────

/**
 * Maps each event type to the set of trigger types that should be evaluated.
 * This avoids checking all achievements on every event.
 */
export const EVENT_TRIGGER_MAP: Record<AchievementEventType, AchievementTriggerType[]> = {
  battle_complete: [
    'wins', 'losses', 'battles', 'kills', 'elo',
    'perfect_victory', 'low_hp_win', 'elo_upset',
    'win_streak', 'yield_forced', 'yield_comeback',
    'zero_yield_win', 'no_tuning_win', 'glass_cannon',
    'low_hp_survival', 'battle_duration',
    'loadout_wins', 'stance_wins',
    'koth_wins', 'tag_team_wins', 'tag_in_win', 'solo_carry',
    'survival_streak', 'lose_streak', 'all_modes_win',
    'prestige', 'fame', 'streaming_revenue',
    'lifetime_earnings', 'currency',
    'league_promotion',
    'league_2v2_wins', 'league_3v3_wins',
  ],
  league_promotion: ['league_promotion'],
  weapon_purchased: ['weapon_count', 'weapon_type'],
  weapon_sold: ['weapons_sold_count', 'weapons_sold_credits', 'weapon_sold_at_max_workshop'],
  weapon_refined: [
    'weapons_refined_count',
    'weapons_refined_credits_spent',
    'owns_legendary_weapon',
    'owns_legendary_starter_weapon',
    'owns_max_dps_weapon',
  ],
  weapon_equipped: ['weapon_type', 'effective_stat'],
  attribute_upgraded: ['attribute_upgraded', 'effective_stat'],
  facility_upgraded: ['facility_count'],
  robot_created: ['robot_count'],
  tuning_allocated: ['tuning_allocated', 'tuning_full', 'effective_stat'],
  stance_changed: ['effective_stat'],
  onboarding_complete: ['onboarding'],
  practice_battle: ['practice_battles'],
  tournament_complete: ['tournament_wins', 'tournament_2v2_wins', 'tournament_3v3_wins'],
  daily_finances: ['bankrupt'],
};
