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

