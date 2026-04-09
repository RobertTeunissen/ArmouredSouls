/**
 * Shared league tier helper functions.
 *
 * Both solo-league and tag-team-league pages use the same tier names,
 * colors, and icons. Keep a single source of truth here.
 */

export const LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;
export type LeagueTier = typeof LEAGUE_TIERS[number];

const TIER_NAMES: Record<LeagueTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
  champion: 'Champion',
};

const TIER_COLORS: Record<LeagueTier, string> = {
  bronze: 'text-orange-600',
  silver: 'text-gray-400',
  gold: 'text-yellow-500',
  platinum: 'text-cyan-400',
  diamond: 'text-blue-400',
  champion: 'text-purple-500',
};

const TIER_ICONS: Record<LeagueTier, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '💎',
  diamond: '💠',
  champion: '👑',
};

/** Get display name for a league tier. Accepts any string for API compatibility. */
export const getTierName = (tier: string): string => TIER_NAMES[tier.toLowerCase() as LeagueTier] || tier;
/** Get Tailwind color class for a league tier. */
export const getTierColor = (tier: string): string => TIER_COLORS[tier.toLowerCase() as LeagueTier] || 'text-gray-400';
/** Get emoji icon for a league tier. */
export const getTierIcon = (tier: string): string => TIER_ICONS[tier.toLowerCase() as LeagueTier] || '⚔️';
