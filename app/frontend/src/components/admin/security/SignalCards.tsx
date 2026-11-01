/**
 * The six signal cards of the Security page: total in the window, a small
 * per-bucket chart, what the signal means, and when it last fired. A card
 * whose signal fired is outlined in its colour.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_FOCUS_RING } from '../shared';
import type { SignalSummary } from '../../../utils/adminSecurityApi';
import { SIGNAL_HINTS, SIGNAL_LABELS, lastSeenLabel } from '../../../utils/adminSecurityFormat';
import { formatCount } from '../../../utils/adminDashboardFormat';
import { SIGNAL_TONES } from './signalTones';

export interface SignalCardsProps {
  signals: readonly SignalSummary[];
  now: Date;
}

function Spark({ values, tone }: { values: readonly number[]; tone: string }): ReactNode {
  const peak = Math.max(1, ...values);
  return (
    <span className="flex h-6 w-20 shrink-0 items-end gap-px" aria-hidden="true">
      {values.map((value, index) => (
        <span
          key={index}
          className={`min-w-0 flex-1 rounded-t-sm ${value > 0 ? tone : 'bg-surface-elevated'}`}
          style={{ height: value > 0 ? `${Math.max(12, (value / peak) * 100)}%` : '2px' }}
        />
      ))}
    </span>
  );
}

export function SignalCards({ signals, now }: SignalCardsProps): ReactNode {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Security signals">
      {signals.map((summary) => {
        const tone = SIGNAL_TONES[summary.signal];
        const fired = summary.total > 0;
        return (
          <li
            key={summary.signal}
            data-testid={`signal-card-${summary.signal}`}
            className={`flex flex-col gap-1 rounded-lg border bg-surface px-4 py-3 ${fired ? tone.border : 'border-white/10'}`}
          >
            <span className="text-sm text-white">{SIGNAL_LABELS[summary.signal]}</span>
            <span className="flex items-end justify-between gap-2">
              <span className={`text-2xl font-bold tabular-nums ${fired ? tone.text : 'text-white'}`}>{formatCount(summary.total)}</span>
              <Spark values={summary.perBucket} tone={tone.bar} />
            </span>
            <span className="text-xs text-secondary">{SIGNAL_HINTS[summary.signal]}</span>
            <span className="text-xs text-secondary">Last: {lastSeenLabel(summary.lastSeenAt, now)}</span>
            {summary.signal === 'nsfw_block' && (
              <Link to="/admin/image-uploads" className={`mt-auto text-xs text-primary hover:underline ${ADMIN_FOCUS_RING}`}>
                Image Uploads <span aria-hidden="true">↗</span>
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
