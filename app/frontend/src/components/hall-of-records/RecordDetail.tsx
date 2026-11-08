import { Link } from 'react-router-dom';
import { RecordStable, RecordSubject } from './RecordNames';
import { ScrollRow } from './ScrollRow';
import type { RecordDefinition, RecordRow } from './types';

export interface RecordDetailProps {
  record: RecordDefinition;
  /** The other records in the same group, for the switcher chips. */
  siblings: RecordDefinition[];
  /** Selected mode for per-mode records; falls back to the first. */
  variantKey: string | null;
  viewerId: number | null;
  backHref: string;
  detailHref: (record: RecordDefinition, variantKey?: string) => string;
  /** Shown under a ranked list without the viewer's rows; null hides it. */
  notInListNote?: string | null;
  /** Heading level of the record title (3 when the list sits under its own h2). */
  headingLevel?: 2 | 3;
}

const RANK_BADGES: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function RankCell({ row, ranked }: { row: RecordRow; ranked: boolean }) {
  if (ranked && RANK_BADGES[row.rank]) {
    return (
      <span className="w-10 shrink-0 text-center text-lg" aria-label={`Rank ${row.rank}`}>
        <span aria-hidden="true">{RANK_BADGES[row.rank]}</span>
      </span>
    );
  }
  return (
    <span className="w-10 shrink-0 text-center text-sm font-semibold text-secondary">
      {ranked ? <><span className="sr-only">Rank </span>{row.rank}</> : row.rank}
    </span>
  );
}

function DetailRow({ row, ranked, viewerId }: { row: RecordRow; ranked: boolean; viewerId: number | null }) {
  const mine = viewerId != null && row.holder.stable.userId === viewerId;
  return (
    <li
      className={`flex items-center gap-3 border-b border-white/5 px-3 py-3 last:border-b-0 sm:px-4 ${
        mine ? 'border-l-4 border-l-primary bg-primary/10' : ''
      }`}
      data-testid="record-detail-row"
      data-mine={mine ? 'true' : undefined}
    >
      <RankCell row={row} ranked={ranked} />
      <div className="min-w-0 flex-1">
        {/* Phones: robot above stable; wider screens: one line with a separator. */}
        <div className="flex min-w-0 flex-col gap-y-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
          {row.holder.subjectName && (
            <>
              <RecordSubject holder={row.holder} viewerId={viewerId} className="font-medium break-words" />
              <span className="hidden text-tertiary sm:inline" aria-hidden="true">·</span>
            </>
          )}
          <span className="text-sm">
            <RecordStable stable={row.holder.stable} />
          </span>
          {mine && (
            <span className="self-start rounded bg-primary px-1.5 text-[10px] font-semibold uppercase leading-4 text-background sm:self-auto">
              You
            </span>
          )}
        </div>
        {(row.detail || row.battleId !== undefined) && (
          <p className="mt-0.5 text-xs text-secondary">
            {row.detail}
            {row.detail && row.battleId !== undefined && ' · '}
            {row.battleId !== undefined && (
              <Link to={`/battle/${row.battleId}`} className="text-primary hover:underline">
                Battle report
              </Link>
            )}
          </p>
        )}
      </div>
      <span className={`shrink-0 text-right font-bold ${ranked ? 'text-warning' : 'max-w-[45%] text-sm text-secondary'}`}>
        {row.value}
        {row.running && <span className="ml-1 text-xs font-normal text-success">● running</span>}
      </span>
    </li>
  );
}

/**
 * One record's full list (top 10 per mode). Per-mode records get a mode
 * switcher; sibling records in the same group are one tap away.
 */
export function RecordDetail({
  record, siblings, variantKey, viewerId, backHref, detailHref,
  notInListNote = 'Your stable is not in this top 10 yet.', headingLevel = 2,
}: RecordDetailProps) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const variant = record.variants.find((v) => v.key === variantKey) ?? record.variants[0];
  const mineInVariant = variant?.rows.some((row) => viewerId != null && row.holder.stable.userId === viewerId) ?? false;

  return (
    <div data-testid="record-detail">
      <Link to={backHref} className="inline-flex min-h-[44px] items-center text-sm text-primary hover:underline">
        ← All records
      </Link>
      <Heading className="mt-1 text-2xl font-bold text-white">{record.title}</Heading>
      <p className="mt-1 text-sm text-secondary">{record.scope}</p>

      {/* On phones both chip rows scroll sideways in one line each, so the
          list starts above the fold; from md they wrap. */}
      {siblings.length > 1 && (
        <ScrollRow as="navigation" label="Records in this group" wrapFrom="md" className="mt-4">
          {siblings.map((sibling) => {
            const active = sibling.key === record.key;
            return (
              <Link
                key={sibling.key}
                to={detailHref(sibling)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-full px-4 text-xs font-medium transition-colors ${
                  active ? 'bg-warning text-background' : 'border border-white/10 bg-surface text-secondary hover:bg-surface-elevated'
                }`}
              >
                {sibling.title}
              </Link>
            );
          })}
        </ScrollRow>
      )}

      {record.variants.length > 1 && variant && (
        <ScrollRow label="Mode" wrapFrom="md" className="mt-3">
          {record.variants.map((v) => (
            <Link
              key={v.key}
              to={detailHref(record, v.key)}
              aria-current={v.key === variant.key ? 'true' : undefined}
              className={`inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-colors ${
                v.key === variant.key
                  ? 'bg-surface-elevated text-white ring-1 ring-warning'
                  : 'border border-white/10 bg-surface text-secondary hover:bg-surface-elevated'
              }`}
            >
              {v.label}
            </Link>
          ))}
        </ScrollRow>
      )}

      {/* A per-mode record with one populated mode: nothing to switch to, but
          the list must still say which mode it ranks. */}
      {record.variants.length === 1 && variant?.label && (
        <p className="mt-3 text-sm text-secondary" data-testid="record-detail-mode">
          Mode:{' '}
          <span className="inline-flex items-center rounded-lg bg-surface-elevated px-3 py-1 font-medium text-white ring-1 ring-warning">
            {variant.label}
          </span>
        </p>
      )}

      {record.leaderboard && (
        <p className="mt-4 text-sm">
          <Link to={record.leaderboard.href} className="text-primary hover:underline">
            Full ranking: {record.leaderboard.label} ›
          </Link>
        </p>
      )}

      {variant ? (
        <section className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-surface" aria-label={`${record.title}${variant.label ? `, ${variant.label}` : ''}`}>
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wide text-secondary sm:px-4">
            <span>{record.ranked ? 'Top 10' : 'Most recent'}</span>
            <span>{record.valueLabel}</span>
          </div>
          <ol>
            {variant.rows.map((row, index) => (
              <DetailRow key={`${row.rank}-${index}`} row={row} ranked={record.ranked} viewerId={viewerId} />
            ))}
          </ol>
        </section>
      ) : (
        <p className="mt-6 text-secondary">No one holds this record yet this season.</p>
      )}

      {record.ranked && variant && !mineInVariant && viewerId != null && notInListNote && (
        <p className="mt-3 text-xs text-secondary">{notInListNote}</p>
      )}
    </div>
  );
}
