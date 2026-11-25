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


/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 102nd… */
export function ordinal(n: number): string {
  const lastTwo = Math.abs(n) % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  switch (Math.abs(n) % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}
