/**
 * Shared formatting utilities used across the frontend.
 */

/**
 * Format a number as in-game currency with ₡ prefix.
 * Handles NaN, null, undefined gracefully.
 */
export function formatCurrency(amount: number): string {
  const safeAmount = Number(amount) || 0;
  return `₡${safeAmount.toLocaleString()}`;
}

/**
 * Format a cost with abbreviated suffixes (K, M).
 */
export function formatCost(cost: number): string {
  if (cost >= 1000000) return `₡${(cost / 1000000).toFixed(1)}M`;
  if (cost >= 1000) return `₡${(cost / 1000).toFixed(0)}K`;
  return `₡${cost}`;
}

/**
 * Format a large number with locale separators.
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Get the Tailwind text color class for a league tier.
 */
export function getLeagueColor(league: string): string {
  switch (league) {
    case 'champion': return 'text-purple-400';
    case 'diamond': return 'text-cyan-400';
    case 'platinum': return 'text-blue-400';
    case 'gold': return 'text-yellow-400';
    case 'silver': return 'text-gray-300';
    case 'bronze': return 'text-orange-600';
    default: return 'text-gray-400';
  }
}
