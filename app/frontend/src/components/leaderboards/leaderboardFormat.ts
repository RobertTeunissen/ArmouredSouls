/** Colour of a win rate: green from 60%, amber from 50%, orange below. */
export function winRateClass(winRate: number): string {
  if (winRate >= 60) return 'text-success';
  if (winRate >= 50) return 'text-warning';
  return 'text-orange-400';
}

/** Colour of a destructions-per-loss ratio: green from 2.0, amber from 1.0, orange below. */
export function lossRatioClass(ratio: number): string {
  if (ratio >= 2.0) return 'text-success';
  if (ratio >= 1.0) return 'text-warning';
  return 'text-orange-400';
}

const FAME_TIER_CLASSES: Record<string, string> = {
  Mythical: 'text-purple-400',
  Legendary: 'text-warning',
  Renowned: 'text-orange-400',
  Famous: 'text-primary',
  Known: 'text-success',
};

/** Colour of a fame tier name (see `getFameTier`). */
export function fameTierClass(tier: string): string {
  return FAME_TIER_CLASSES[tier] ?? 'text-secondary';
}

const PRESTIGE_RANK_CLASSES: Record<string, string> = {
  Legendary: 'text-purple-400',
  Champion: 'text-warning',
  Elite: 'text-orange-400',
  Veteran: 'text-primary',
  Established: 'text-success',
};

/** Colour of a prestige rank name (see `getPrestigeRank`). */
export function prestigeRankClass(rank: string): string {
  return PRESTIGE_RANK_CLASSES[rank] ?? 'text-secondary';
}

/** Header cell classes shared by the leaderboard tables. */
export const LEADERBOARD_TH = 'px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider';
