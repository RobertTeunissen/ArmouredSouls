/**
 * Trend indicator utility for admin dashboard KPI cards.
 *
 * Compares a current value against a previous value and returns
 * the direction of change: 'up', 'down', or 'neutral'.
 */

export type TrendDirection = 'up' | 'down' | 'neutral';

/**
 * Returns the trend direction given current and previous numeric values.
 *
 * @param current  - The current metric value
 * @param previous - The previous metric value to compare against
 * @returns 'up' if current > previous, 'down' if current < previous, 'neutral' if equal
 */
export function getTrendIndicator(current: number, previous: number): TrendDirection {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'neutral';
}
