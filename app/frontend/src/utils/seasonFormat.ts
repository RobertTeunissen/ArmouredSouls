/**
 * Shared formatting for season standings and accolades (Spec #45).
 *
 * Used by both the Season Archive page and the Stable page's Season History
 * block so the two present records identically — the same category labels,
 * icons, rank medals, and mode names.
 */

/** Friendly label + icon per accolade category; unknown categories fall back to a spaced form. */
export const CATEGORY_META: Record<string, { icon: string; label: string }> = {
  mostDamageInBattle: { icon: '💥', label: 'Most Damage in a Battle' },
  narrowestVictory: { icon: '🩸', label: 'Narrowest Victory' },
  biggestUpset: { icon: '🎲', label: 'Biggest Upset' },
  mostBattles: { icon: '⚔️', label: 'Most Battles' },
  highestWinRate: { icon: '📈', label: 'Highest Win Rate' },
  mostLifetimeDamage: { icon: '🔥', label: 'Most Lifetime Damage' },
  highestElo: { icon: '🏆', label: 'Highest ELO' },
  mostKills: { icon: '💀', label: 'Most Kills' },
  highestFame: { icon: '🎖️', label: 'Highest Fame' },
  richestStable: { icon: '💰', label: 'Richest Stable' },
  highestPrestige: { icon: '⭐', label: 'Highest Prestige' },
  mostTitles: { icon: '👑', label: 'Most Championship Titles' },
  kothMostWins: { icon: '⛰️', label: 'Most Wins' },
  kothAvgZoneScore: { icon: '⛰️', label: 'Avg Zone Score' },
  kothMostKills: { icon: '⛰️', label: 'Most Kills' },
  kothLongestWinStreak: { icon: '⛰️', label: 'Longest Win Streak' },
  kothMostZoneTime: { icon: '⛰️', label: 'Most Zone Time' },
  kothZoneDominator: { icon: '⛰️', label: 'Zone Dominator' },
  grandMeleeMostWins: { icon: '🌀', label: 'Most Wins' },
  grandMeleeHighestLp: { icon: '🌀', label: 'Highest LP' },
  grandMeleeMostKills: { icon: '🌀', label: 'Most Kills' },
  tournamentChampion: { icon: '🏅', label: 'Tournament Champions' },
  longestWinStreak: { icon: '🔥', label: 'Longest Win Streak' },
};

/** Category display metadata, with a graceful fallback for unmapped categories. */
export function categoryLabel(category: string): { icon: string; label: string } {
  return (
    CATEGORY_META[category] ?? {
      icon: '🏅',
      label: category
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (c) => c.toUpperCase())
        .trim(),
    }
  );
}

/** Title-cased mode name, preserving the "2v2"/"3v3" form. */
export function modeLabel(mode: string): string {
  return mode
    .replace(/_/g, ' ')
    .replace(/\b(\w)/g, (c) => c.toUpperCase())
    .replace(/(\d)V(\d)/i, (_m, a, b) => `${a}v${b}`);
}

/** Medal for the top three placements, otherwise a plain rank. */
export function rankBadge(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
}

/** Locale date, or an em dash for a missing value. */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}
