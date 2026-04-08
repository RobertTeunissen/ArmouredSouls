/**
 * Shared prestige and fame utility functions.
 * Extracted from leaderboards.ts for reuse across routes (leaderboards, stables).
 */

/**
 * Get prestige rank title based on prestige value.
 *
 * Thresholds:
 *   < 1000   → Novice
 *   < 5000   → Established
 *   < 10000  → Veteran
 *   < 25000  → Elite
 *   < 50000  → Champion
 *   ≥ 50000  → Legendary
 */
export function getPrestigeRank(prestige: number): string {
  if (prestige < 1000) return "Novice";
  if (prestige < 5000) return "Established";
  if (prestige < 10000) return "Veteran";
  if (prestige < 25000) return "Elite";
  if (prestige < 50000) return "Champion";
  return "Legendary";
}

/**
 * Get fame tier name based on fame value.
 *
 * Thresholds:
 *   < 100   → Unknown
 *   < 500   → Known
 *   < 1000  → Famous
 *   < 2500  → Renowned
 *   < 5000  → Legendary
 *   ≥ 5000  → Mythical
 */
export function getFameTier(fame: number): string {
  if (fame < 100) return "Unknown";
  if (fame < 500) return "Known";
  if (fame < 1000) return "Famous";
  if (fame < 2500) return "Renowned";
  if (fame < 5000) return "Legendary";
  return "Mythical";
}
