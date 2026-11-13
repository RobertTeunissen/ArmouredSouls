/**
 * Achievement classification shared by the achievement contracts
 * (`AchievementTier`, `AchievementCategory` in backend `config/achievements.ts`).
 */
export type AchievementTier = 'easy' | 'medium' | 'hard' | 'very_hard' | 'secret';
export type AchievementCategory = 'combat' | 'league' | 'economy' | 'prestige' | 'style';

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
