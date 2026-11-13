import { statusText, tierAbove, type StatusTone } from '../../utils/leagueStandings';
import type { StandingStatus } from '@shared/types';

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'border-success/50 bg-success/15 text-success',
  error: 'border-error/50 bg-error/15 text-error',
  warning: 'border-warning/50 bg-warning/10 text-warning',
  neutral: 'border-white/15 bg-surface-elevated text-secondary',
};

export interface StatusChipProps {
  status: StandingStatus;
  tier: string;
  className?: string;
}

/** Whether the next rebalance moves this entry, or why its zone place is held. */
export function StatusChip({ status, tier, className = '' }: StatusChipProps) {
  const text = statusText(status, tierAbove(tier));
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[text.tone]} ${className}`}
      title={text.description}
      data-testid="standing-status"
      data-status={status.kind}
    >
      {text.label}
      <span className="sr-only">{`: ${text.description}`}</span>
    </span>
  );
}
