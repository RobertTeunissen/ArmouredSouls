/**
 * Shared league tier helper functions.
 *
 * Both solo-league and tag-team-league pages use the same tier names,
 * colors, and icons. Keep a single source of truth here.
 */

export const LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;
export type LeagueTier = typeof LEAGUE_TIERS[number];

const TIER_NAMES: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
  champion: 'Champion',
};

const TIER_COLORS: Record<string, string> = {
  bronze: 'text-orange-600',
  silver: 'text-gray-400',
  gold: 'text-yellow-500',
  platinum: 'text-cyan-400',
  diamond: 'text-blue-400',
  champion: 'text-purple-500',
};

const TIER_ICONS: Record<string, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '💎',
  diamond: '💠',
  champion: '👑',
};

export const getTierName = (tier: string): string => TIER_NAMES[tier] || tier;
export const getTierColor = (tier: string): string => TIER_COLORS[tier] || 'text-gray-400';
export const getTierIcon = (tier: string): string => TIER_ICONS[tier.toLowerCase()] || '⚔️';
