/**
 * Six status cards: disk, database, memory, last backup, backend uptime and
 * failing requests in the last 24 hours. The left border carries the tone;
 * the caption says the same in words.
 */
import type { ReactNode } from 'react';
import { deriveSystemCards, type SystemTone } from '../../../utils/adminSystemFormat';
import { PanelError } from '../shared';
import type { SystemOverview } from '@shared/types';

const BORDER: Readonly<Record<SystemTone, string>> = {
  ok: 'border-l-success',
  warning: 'border-l-warning',
  error: 'border-l-error',
  info: 'border-l-primary',
  muted: 'border-l-tertiary',
};

export interface SystemStatusCardsProps {
  overview: SystemOverview | null;
  now: Date;
  loading: boolean;
  error: string | null;
}

export function SystemStatusCards({ overview, now, loading, error }: SystemStatusCardsProps): ReactNode {
  if (!overview) {
    return (
      <section aria-label="System status" aria-busy={loading || undefined} className="rounded-lg border border-white/10 bg-surface">
        {error ? <PanelError message={error} /> : <div className="h-24 animate-pulse rounded-lg bg-white/5 motion-reduce:animate-none" aria-hidden="true" />}
      </section>
    );
  }

  return (
    <section aria-label="System status">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {deriveSystemCards(overview, now).map((card) => (
          <div
            key={card.key}
            data-testid={`system-card-${card.key}`}
            className={`min-w-0 rounded-lg border border-white/10 border-l-4 bg-surface px-4 py-3 ${BORDER[card.tone]}`}
          >
            <dt className="text-xs text-secondary">{card.label}</dt>
            <dd className={`mt-1 truncate text-lg font-semibold tabular-nums ${card.tone === 'error' ? 'text-error' : 'text-white'}`}>{card.value}</dd>
            <dd className="mt-0.5 text-xs text-secondary">{card.caption}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
