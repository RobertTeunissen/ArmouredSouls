/**
 * Wire contract for the admin Achievements page:
 * `GET /api/admin/achievements/analytics`: how often each achievement is
 * unlocked this season, by one stable type.
 */
import type { AchievementCategory, AchievementTier } from './achievements';

/** `ACHIEVEMENT_STABLE_SCOPES` in the backend satisfies it. */
export type AchievementStableScope = 'players' | 'automatons' | 'generated';

export interface AchievementAnalyticsRow {
  achievementId: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  hidden: boolean;
  /** Stables in the population that unlocked it. */
  unlocked: number;
  /** `unlocked` as a percentage of the population, one decimal. */
  rate: number;
  /**
   * Median day of the season the population unlocked it on (day 1 = the day
   * the season started); 0 or less means before the season started (the
   * preparation phase or the rollover re-award). Null when nobody unlocked it.
   */
  medianDay: number | null;
  /** Every stable of the type that unlocked it, including dormant players. */
  unlockedAll: number;
}

export interface AchievementAnalytics {
  stables: AchievementStableScope;
  seasonNumber: number;
  seasonStartedAt: string | null;
  /**
   * The denominator of every rate. Players: human stables that logged in
   * since the season started (not dormant). Automatons and generated stables
   * never log in, so every stable of the type counts.
   */
  population: number;
  /** Every stable of the type, including dormant players. */
  totalStables: number;
  totalAchievements: number;
  /** Achievements unlocked by at least one stable of the population. */
  unlockedBySomeone: number;
  /** Unlocks by the population. */
  unlocks: number;
  /** Achievements are season-scoped: a rollover deletes every unlock. */
  achievements: AchievementAnalyticsRow[];
}
