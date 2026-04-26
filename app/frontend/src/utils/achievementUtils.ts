// Achievement utility functions and types for the frontend.
// Pure functions used by AchievementsPage, StableViewPage, and battle report components.

// --- Types matching the backend API response ---

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

export interface UnlockedAchievement {
  id: string;
  name: string;
  description: string;
  tier: string;
  rewardCredits: number;
  rewardPrestige: number;
  badgeIconFile: string;
  robotId: number | null;
  robotName: string | null;
}

export type AchievementTier = 'easy' | 'medium' | 'hard' | 'very_hard' | 'secret';
export type AchievementSortOption = 'default' | 'rarity_asc' | 'rarity_desc' | 'status_locked' | 'status_unlocked' | 'tier_hard' | 'tier_easy';

export interface AchievementFilters {
  tier: AchievementTier | 'all';
  status: 'all' | 'locked' | 'unlocked';
}

// --- Pure utility functions ---

export function getTierColor(tier: string): string {
  switch (tier) {
    case 'easy': return '#3fb950';
    case 'medium': return '#58a6ff';
    case 'hard': return '#d29922';
    case 'very_hard': return '#f85149';
    case 'secret': return '#a371f7';
    default: return '#8b949e';
  }
}

export function getTierLabel(tier: string): string {
  switch (tier) {
    case 'easy': return 'Easy';
    case 'medium': return 'Medium';
    case 'hard': return 'Hard';
    case 'very_hard': return 'Very Hard';
    case 'secret': return 'Secret';
    default: return tier;
  }
}

export function getRarityLabel(percentage: number): { label: string; color: string } {
  if (percentage > 75) return { label: 'Common', color: 'text-secondary' };
  if (percentage > 25) return { label: 'Uncommon', color: 'text-success' };
  if (percentage > 10) return { label: 'Rare', color: 'text-primary' };
  if (percentage > 1) return { label: 'Epic', color: 'text-warning' };
  return { label: 'Legendary', color: 'text-error' };
}

export function filterAchievements(
  achievements: AchievementWithProgress[],
  filters: AchievementFilters,
): AchievementWithProgress[] {
  return achievements.filter(a => {
    if (filters.tier !== 'all' && a.tier !== filters.tier) return false;
    if (filters.status === 'locked' && a.unlocked) return false;
    if (filters.status === 'unlocked' && !a.unlocked) return false;
    return true;
  });
}

const TIER_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2, very_hard: 3, secret: 4 };

export function sortAchievements(
  achievements: AchievementWithProgress[],
  sortOption: AchievementSortOption,
  rarityCounts?: Record<string, number>,
  _totalActivePlayers?: number,
): AchievementWithProgress[] {
  const sorted = [...achievements];
  switch (sortOption) {
    case 'rarity_asc': // rarest first
      sorted.sort((a, b) => {
        const aCount = rarityCounts?.[a.id] ?? 0;
        const bCount = rarityCounts?.[b.id] ?? 0;
        return aCount - bCount;
      });
      break;
    case 'rarity_desc': // most common first
      sorted.sort((a, b) => {
        const aCount = rarityCounts?.[a.id] ?? 0;
        const bCount = rarityCounts?.[b.id] ?? 0;
        return bCount - aCount;
      });
      break;
    case 'status_locked':
      sorted.sort((a, b) => (a.unlocked === b.unlocked ? 0 : a.unlocked ? 1 : -1));
      break;
    case 'status_unlocked':
      sorted.sort((a, b) => (a.unlocked === b.unlocked ? 0 : a.unlocked ? -1 : 1));
      break;
    case 'tier_hard':
      sorted.sort((a, b) => (TIER_ORDER[b.tier] ?? 0) - (TIER_ORDER[a.tier] ?? 0));
      break;
    case 'tier_easy':
      sorted.sort((a, b) => (TIER_ORDER[a.tier] ?? 0) - (TIER_ORDER[b.tier] ?? 0));
      break;
    default:
      break;
  }
  return sorted;
}
