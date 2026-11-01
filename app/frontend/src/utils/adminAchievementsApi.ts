/**
 * Typed API of the admin Achievements page (`/admin/achievements`).
 * Mirrors `app/backend/src/services/admin/achievements/achievementAnalyticsTypes.ts`.
 */
import { api } from './api';

export const ACHIEVEMENT_STABLES = ['players', 'automatons', 'generated'] as const;
export type AchievementStables = (typeof ACHIEVEMENT_STABLES)[number];

export type AchievementTier = 'easy' | 'medium' | 'hard' | 'very_hard' | 'secret';
export type AchievementCategory = 'combat' | 'league' | 'economy' | 'prestige' | 'style';

export interface AchievementRow {
  achievementId: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  hidden: boolean;
  /** Stables in the population that unlocked it. */
  unlocked: number;
  /** Percentage of the population, one decimal. */
  rate: number;
  /** 1-based day of the season; 0 or less is before the season started; null when nobody unlocked it. */
  medianDay: number | null;
  /** Every stable of the type that unlocked it, dormant players included. */
  unlockedAll: number;
}

export interface AchievementAnalytics {
  stables: AchievementStables;
  seasonNumber: number;
  seasonStartedAt: string | null;
  /** Denominator of every rate: players active this season, or every stable of the type. */
  population: number;
  totalStables: number;
  totalAchievements: number;
  unlockedBySomeone: number;
  unlocks: number;
  achievements: AchievementRow[];
}

export function getAchievementAnalytics(stables: AchievementStables, signal?: AbortSignal): Promise<AchievementAnalytics> {
  return api.get<AchievementAnalytics>('/api/admin/achievements/analytics', { params: { stables }, signal });
}
