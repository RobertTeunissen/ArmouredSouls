/**
 * Formatting shared by the admin pages. Page-specific format modules
 * re-export these instead of keeping their own copies.
 */

/** "12,345" (en-US grouping). */
export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

/** Whole-percent share of `part` in `whole` ("12%", "<1%", "0%" for an empty whole). */
export function formatPartShare(part: number, whole: number): string {
  if (whole <= 0) return '0%';
  const percent = (part / whole) * 100;
  if (percent > 0 && percent < 1) return '<1%';
  return `${Math.round(percent)}%`;
}

const ERROR_CODE_LABELS: Readonly<Record<string, string>> = {
  STATEMENT_TIMEOUT: 'statement timeout',
  INTERNAL_ERROR: 'internal error',
};

/**
 * What a recorded server-error code means ("statement timeout", "HTTP 502",
 * "service unavailable"), for the System page and its Dashboard item.
 */
export function errorCodeLabel(code: string): string {
  const known = ERROR_CODE_LABELS[code];
  if (known) return known;
  const http = /^HTTP_(\d{3})$/.exec(code);
  if (http) return `HTTP ${http[1]}`;
  return code.toLowerCase().replace(/_/g, ' ');
}
