/**
 * Fame tier utility for the frontend.
 * Mirrors the backend getFameTier from prestigeUtils.ts.
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
  if (fame < 100) return 'Unknown';
  if (fame < 500) return 'Known';
  if (fame < 1000) return 'Famous';
  if (fame < 2500) return 'Renowned';
  if (fame < 5000) return 'Legendary';
  return 'Mythical';
}
