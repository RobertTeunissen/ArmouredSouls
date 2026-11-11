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
  | 'daily_finances'
  // ── Season 2 ──
  | 'robot_image_uploaded'
  | 'subscription_changed'
  | 'tournament_bye'
  | 'season_started'
  /** Fired by the service itself after any unlock, for count-of-unlocks triggers. */
  | 'achievement_unlocked';

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
  /** Recognition only: no credits or prestige (issue #446). */
  trophy: boolean;
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
  /** Recognition only: no credits or prestige (issue #446). */
  trophy: boolean;
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

/**
 * One badge of the stable page's trophy cabinet: the stable's pins first,
 * then its rarest other unlocks, so the cabinet is never empty slots.
 */
export interface ShowcaseAchievement extends PinnedAchievement {
  pinned: boolean;
  /** Human stables holding it (rarity cache); null until the cache has loaded. */
  holders: number | null;
}

export interface StableAchievementData {
  pinned: PinnedAchievement[];
  /** Up to `SHOWCASE_SIZE` badges: pins, then rarest unlocks (hidden ones only when pinned). */
  showcase: ShowcaseAchievement[];
  totalUnlocked: number;
  totalAvailable: number;
}

export interface AchievementRarityCache {
  counts: Map<string, number>;
  totalActivePlayers: number;
  /** Snapshot boundary, taken before the holder query: unlocks at or after it may be missing from `counts`. */
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
    // Spec #46 R8 Cause C: these three were declared in AchievementTriggerType
    // and used by L26–L30, but were never added here, so no event ever selected
    // them as candidates and all five achievements were unreachable. Spec #44
    // tasks 10.1/10.2 covered this registration and were left unchecked.
    'grand_melee_wins', 'grand_melee_top3', 'grand_melee_win_high_hp',
    // Season 2 (ACHIEVEMENTS_SEASON_2_REVAMP.md §4)
    'reserve_rescue_win', 'moral_victory', 'close_loss', 'draw',
    'times_yielded', 'times_destroyed', 'losing_streak_broken', 'revenge_win',
    'higher_tier_win', 'long_battle_win', 'starter_weapon_wins', 'max_yield_win',
    'tournament_match_win', 'tournament_semifinal', 'tournament_final_loss',
    'grand_melee_first_out', 'grand_melee_survived', 'kills_in_battle',
    'koth_last_standing', 'koth_uncontested', 'team_all_survived_win',
    'underdog_placement_win', 'mirror_match_win', 'all_loadout_wins',
    'battle_streaming_revenue', 'balance_recovery', 'demotion_repromotion',
  ],
  league_promotion: ['league_promotion', 'demotion_repromotion'],
  weapon_purchased: ['weapon_count', 'weapon_type'],
  weapon_sold: ['weapons_sold_count', 'weapons_sold_credits', 'weapon_sold_at_workshop_level'],
  weapon_refined: [
    'weapons_refined_count',
    'weapons_refined_credits_spent',
    'owns_legendary_weapon',
    'owns_legendary_starter_weapon',
    'owns_max_dps_weapon',
  ],
  weapon_equipped: ['weapon_type', 'effective_stat'],
  attribute_upgraded: ['attribute_upgraded', 'effective_stat', 'attribute_upgrade_spend'],
  facility_upgraded: ['facility_count'],
  robot_created: ['robot_count'],
  tuning_allocated: ['tuning_allocated', 'tuning_full', 'effective_stat'],
  stance_changed: ['effective_stat'],
  onboarding_complete: ['onboarding'],
  practice_battle: ['practice_battles'],
  tournament_complete: ['tournament_wins', 'tournament_2v2_wins', 'tournament_3v3_wins'],
  // Season 2: settlement is where repairs and merchandising income land.
  daily_finances: ['bankrupt', 'repair_spend', 'merchandising_income', 'balance_recovery', 'achievement_count'],
  robot_image_uploaded: ['robot_image_uploaded'],
  subscription_changed: ['all_event_subscriptions'],
  tournament_bye: ['tournament_bye'],
  season_started: ['previous_season_veteran'],
  achievement_unlocked: ['achievement_count'],
};
