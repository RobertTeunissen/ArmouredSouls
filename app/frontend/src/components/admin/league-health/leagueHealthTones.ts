/** Status colours of the League Health page (theme tokens only). */
import type { AttentionSeverity, TierStatusLevel } from '../../../utils/adminLeagueHealthApi';

export const STATUS_TEXT: Readonly<Record<TierStatusLevel, string>> = {
  ok: 'text-success',
  warning: 'text-warning',
  blocked: 'text-error',
  empty: 'text-tertiary',
};

export const STATUS_BAR: Readonly<Record<TierStatusLevel, string>> = {
  ok: 'bg-success',
  warning: 'bg-warning',
  blocked: 'bg-error',
  empty: 'bg-tertiary',
};

/** Tinted square of the mobile grid strips. */
export const STATUS_TINT: Readonly<Record<TierStatusLevel, string>> = {
  ok: 'bg-success/15 text-success',
  warning: 'bg-warning/20 text-warning',
  blocked: 'bg-error/20 text-error',
  empty: 'bg-tertiary/20 text-tertiary',
};

export const STATUS_WORD: Readonly<Record<TierStatusLevel, string>> = {
  ok: 'OK',
  warning: 'Attention',
  blocked: 'Blocked',
  empty: 'Empty',
};

export const SEVERITY_DOT: Readonly<Record<AttentionSeverity, string>> = {
  error: 'bg-error',
  warning: 'bg-warning',
  notice: 'bg-secondary',
};

export const SEVERITY_WORD: Readonly<Record<AttentionSeverity, string>> = {
  error: 'Blocked',
  warning: 'Attention',
  notice: 'Notice',
};
