/**
 * Theme-token classes per signal: card outline, number colour and the bar
 * colour used in the sparklines and the per-day chart.
 */
import type { SignalCard } from '../../../utils/adminSecurityApi';

export interface SignalTone {
  border: string;
  text: string;
  bar: string;
}

export const SIGNAL_TONES: Readonly<Record<SignalCard, SignalTone>> = {
  failed_login: { border: 'border-warning/60', text: 'text-warning', bar: 'bg-warning' },
  rate_limit: { border: 'border-warning/60', text: 'text-warning', bar: 'bg-warning/50' },
  ownership_violation: { border: 'border-error/60', text: 'text-error', bar: 'bg-error' },
  race_condition_burst: { border: 'border-info/60', text: 'text-info', bar: 'bg-info' },
  robot_creation_burst: { border: 'border-primary/60', text: 'text-primary', bar: 'bg-primary' },
  nsfw_block: { border: 'border-error/60', text: 'text-error', bar: 'bg-error/50' },
};
