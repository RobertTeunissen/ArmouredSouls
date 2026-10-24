/**
 * Status strip: battles and players today (UTC), the season totals, today's
 * refusals and how long the arena was unavailable yesterday.
 */
import type { ReactNode } from 'react';
import type { PracticeArenaOverview } from '../../../utils/adminPracticeArenaApi';
import { formatCount, formatUnavailable, refusedCaption } from '../../../utils/adminPracticeArenaFormat';
import { PanelError } from '../shared';

export interface PracticeStatusStripProps {
  overview: PracticeArenaOverview | null;
  loading: boolean;
  error: string | null;
}

function Tile({ label, value, caption, tone = 'neutral', className = '' }: {
  label: string;
  value: ReactNode;
  caption: ReactNode;
  tone?: 'neutral' | 'warning';
  className?: string;
}): ReactNode {
  const box = tone === 'warning' ? 'border-warning/50 bg-warning/[0.08]' : 'border-white/10 bg-surface';
  return (
    <div className={`min-w-0 rounded-lg border px-4 py-3 ${box} ${className}`}>
      <dt className={`text-xs ${tone === 'warning' ? 'text-warning' : 'text-secondary'}`}>{label}</dt>
      <dd className="mt-1 truncate text-lg font-semibold text-white">{value}</dd>
      <dd className="mt-0.5 text-xs text-tertiary">{caption}</dd>
    </div>
  );
}

export function PracticeStatusStrip({ overview, loading, error }: PracticeStatusStripProps): ReactNode {
  if (!overview) {
    return (
      <section aria-label="Practice Arena status" aria-busy={loading || undefined} className="rounded-lg border border-white/10 bg-surface">
        {error ? <PanelError message={error} /> : <div className="h-24 animate-pulse rounded-lg bg-white/5 motion-reduce:animate-none" aria-hidden="true" />}
      </section>
    );
  }

  const [today, yesterday] = overview.days;
  const refused = today.rateLimited + today.cycleBusy;
  const noData = (day: typeof today | undefined): boolean => !day || !day.recorded;

  return (
    <section aria-label="Practice Arena status">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Tile
          label="Battles today"
          value={noData(today) ? '—' : formatCount(today.battles)}
          caption={`${formatCount(today.requests)} request${today.requests === 1 ? '' : 's'}${yesterday && yesterday.recorded ? ` · yesterday ${formatCount(yesterday.battles)}` : ''}`}
        />
        <Tile
          label="Players today"
          value={noData(today) ? '—' : formatCount(today.players)}
          caption={yesterday && yesterday.recorded ? `yesterday ${formatCount(yesterday.players)}` : 'No data for yesterday'}
        />
        <Tile
          label="This season"
          className="col-span-2 md:col-span-1"
          value={`${formatCount(overview.season.battles)} battle${overview.season.battles === 1 ? '' : 's'}`}
          caption={`${formatCount(overview.season.players)} player${overview.season.players === 1 ? '' : 's'}${overview.season.number !== null ? ` · Season ${overview.season.number}` : ''}`}
        />
        <Tile
          label="Refused today"
          tone={refused > 0 ? 'warning' : 'neutral'}
          value={formatCount(refused)}
          caption={refusedCaption(today)}
        />
        <Tile
          label="Unavailable yesterday"
          value={formatUnavailable(yesterday?.unavailableMs ?? null)}
          caption={yesterday?.unavailableMs === null || !yesterday ? 'No run history for yesterday' : 'while scheduler jobs ran'}
        />
      </dl>
    </section>
  );
}
