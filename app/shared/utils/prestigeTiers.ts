/**
 * Prestige rank and fame tier names. Shared by the backend (leaderboards,
 * stable and profile responses) and the frontend (robot cards, the prestige
 * leaderboard legend).
 */

export type PrestigeRank = 'Novice' | 'Established' | 'Veteran' | 'Elite' | 'Champion' | 'Legendary';

/** Prestige ranks with the prestige each one starts at, lowest first. */
export const PRESTIGE_RANKS: ReadonlyArray<{ rank: PrestigeRank; min: number }> = [
  { rank: 'Novice', min: 0 },
  { rank: 'Established', min: 1000 },
  { rank: 'Veteran', min: 5000 },
  { rank: 'Elite', min: 10000 },
  { rank: 'Champion', min: 25000 },
  { rank: 'Legendary', min: 50000 },
];

/** Prestige rank title for a prestige value. */
export function getPrestigeRank(prestige: number): PrestigeRank {
  let rank: PrestigeRank = 'Novice';
  for (const entry of PRESTIGE_RANKS) {
    if (prestige >= entry.min) rank = entry.rank;
  }
  return rank;
}

export type FameTier = 'Unknown' | 'Known' | 'Famous' | 'Renowned' | 'Legendary' | 'Mythical';

/**
 * Fame tier name for a fame value.
 *
 * Thresholds:
 *   < 100   → Unknown
 *   < 500   → Known
 *   < 1000  → Famous
 *   < 2500  → Renowned
 *   < 5000  → Legendary
 *   ≥ 5000  → Mythical
 */
export function getFameTier(fame: number): FameTier {
  if (fame < 100) return 'Unknown';
  if (fame < 500) return 'Known';
  if (fame < 1000) return 'Famous';
  if (fame < 2500) return 'Renowned';
  if (fame < 5000) return 'Legendary';
  return 'Mythical';
}
