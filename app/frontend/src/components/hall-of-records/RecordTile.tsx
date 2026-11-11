import { Link } from 'react-router-dom';
import { RecordHolderLine } from './RecordNames';
import { tileFootprint } from '../../utils/hallOfRecords';
import type { MyPlace, RecordDefinition, RecordRow } from './types';

export interface RecordTileProps {
  record: RecordDefinition;
  /** Where "Top 10" goes: the record's full list, or its leaderboard page. */
  detailHref: string;
  viewerId: number | null;
  /** The viewer's best place in this record, if any. */
  myBest: MyPlace | null;
  /** Extra classes, e.g. to hide a collapsed tile on phones. */
  className?: string;
  /**
   * Players' lists (#595): the top row is the best player, not the record, so
   * the tile shows its place among every stable ("#14").
   */
  showPlace?: boolean;
}

function linkLabel(record: RecordDefinition): string {
  if (record.leaderboard) return 'Full leaderboard ›';
  // The champions log holds the 10 most recent winners per type, not all of them.
  if (!record.ranked) return 'Last 10 per type ›';
  return record.variants.length > 1 ? 'Top 10 per mode ›' : 'Top 10 ›';
}

/** "#14", the best player's place among every stable. */
function PlaceBadge({ rank }: { rank: number }) {
  return (
    <span className="shrink-0 text-xs font-semibold text-secondary" data-testid="record-tile-place">
      <span className="sr-only">Place </span>#{rank}
    </span>
  );
}

/** Grid classes for a tile's footprint (see `tileFootprint`). */
function footprintClasses(record: RecordDefinition): string {
  const { cols, rows } = tileFootprint(record);
  return [cols === 2 ? 'md:col-span-2' : '', rows === 2 ? 'xl:row-span-2' : ''].filter(Boolean).join(' ');
}

/** "tied with HitHard" / "tied with 3 others", when the top spot is shared. */
function tieNote(rows: RecordRow[]): string | null {
  const tied = rows.filter((row) => row.rank === 1).slice(1);
  if (tied.length === 0) return null;
  if (tied.length === 1) return `tied with ${tied[0].holder.subjectName ?? tied[0].holder.stable.name}`;
  return `tied with ${tied.length} others`;
}

function MyPlaceLine({ place }: { place: MyPlace }) {
  const label = place.row.holder.subjectName ?? place.row.value;
  return (
    <p className="mt-3 border-t border-white/5 pt-2 text-xs text-primary" data-testid="record-my-place">
      You: #{place.row.rank}
      {place.variantLabel ? ` in ${place.variantLabel}` : ''} · {label}
    </p>
  );
}

function TileHeader({ record, detailHref }: { record: RecordDefinition; detailHref: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <h3 className="text-sm font-medium text-secondary">{record.title}</h3>
      <Link
        to={detailHref}
        className="-my-3 inline-flex min-h-[44px] shrink-0 items-center text-xs text-primary hover:underline"
        aria-label={`${record.title}: ${linkLabel(record).replace(' ›', '')}`}
      >
        {linkLabel(record)}
      </Link>
    </div>
  );
}

/**
 * One record on the board: the holder of the top spot, its value and a line of
 * context. Records ranked per mode list the top holder of each mode instead.
 */
export function RecordTile({ record, detailHref, viewerId, myBest, className = '', showPlace = false }: RecordTileProps) {
  const base = `flex flex-col rounded-lg border border-white/10 bg-surface p-4 ${footprintClasses(record)} ${className}`;

  // The champions log: one stacked entry per tournament type, narrow enough
  // for a single grid column.
  if (!record.ranked) {
    return (
      <article className={base} data-testid={`record-tile-${record.key}`}>
        <TileHeader record={record} detailHref={detailHref} />
        <ul className="mt-2 divide-y divide-white/5">
          {record.variants.map((variant) => {
            const top = variant.rows[0];
            return (
              <li key={variant.key} className="py-2 text-sm">
                <p className="text-xs text-secondary">{top.value}</p>
                <RecordHolderLine holder={top.holder} viewerId={viewerId} />
              </li>
            );
          })}
        </ul>
      </article>
    );
  }

  if (record.variants.length > 1) {
    return (
      <article className={base} data-testid={`record-tile-${record.key}`}>
        <TileHeader record={record} detailHref={detailHref} />
        <ul className="mt-3 divide-y divide-white/5">
          {record.variants.map((variant) => {
            const top = variant.rows[0];
            return (
              <li key={variant.key} className="flex items-baseline gap-3 py-2 text-sm">
                <span className="w-24 shrink-0 text-xs text-secondary sm:w-32">{variant.label}</span>
                {showPlace && <PlaceBadge rank={top.rank} />}
                <span className="min-w-0 flex-1">
                  <RecordHolderLine holder={top.holder} viewerId={viewerId} />
                </span>
                <span className="shrink-0 font-bold text-warning">
                  {top.value}
                  {top.running && <span className="sr-only"> (still running)</span>}
                  {top.running && <span className="ml-1 text-xs font-normal text-success" aria-hidden="true">●</span>}
                </span>
              </li>
            );
          })}
        </ul>
        {myBest && <MyPlaceLine place={myBest} />}
      </article>
    );
  }

  const { rows, label: modeLabel } = record.variants[0];
  const top = rows[0];
  const tie = tieNote(rows);
  const detail = [top.detail, tie].filter(Boolean).join(' · ');

  return (
    <article className={base} data-testid={`record-tile-${record.key}`}>
      <TileHeader record={record} detailHref={detailHref} />
      {/* A per-mode record with one populated mode keeps that mode's label, so
          it does not read as an all-mode ranking. Unscoped records have none. */}
      {modeLabel && (
        <p className="mt-1 text-xs text-secondary" data-testid="record-tile-mode">{modeLabel}</p>
      )}
      <p className="mt-2 text-2xl font-bold text-warning">
        {showPlace && <span className="mr-2 align-middle"><PlaceBadge rank={top.rank} /></span>}
        {top.value}
        {top.running && <span className="ml-2 align-middle text-xs font-normal text-success">● running</span>}
      </p>
      <div className="mt-1 text-sm">
        <RecordHolderLine holder={top.holder} viewerId={viewerId} />
      </div>
      {detail && <p className="mt-1 text-xs text-secondary">{detail}</p>}
      {top.battleId !== undefined && (
        <Link to={`/battle/${top.battleId}`} className="mt-1 text-xs text-primary hover:underline">
          Battle report ›
        </Link>
      )}
      <div className="mt-auto">{myBest && <MyPlaceLine place={myBest} />}</div>
    </article>
  );
}
