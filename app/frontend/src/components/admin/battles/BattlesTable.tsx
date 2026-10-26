/**
 * The battle list: a table from `md` up, cards below it. A row (or card) opens
 * the admin check; the ↗ link opens the player battle report.
 */
import { Link } from 'react-router-dom';
import { ADMIN_FOCUS_RING } from '../shared';
import { ResultPill, StableTag } from './BattleBadges';
import type { BattleListRow, BattleSideSummary } from './types';
import {
  endedByLabel,
  fieldBreakdown,
  formatBattleDuration,
  formatBattleTime,
  modeDetail,
  modeLabel,
} from '../../../utils/adminBattlesFormat';

export interface BattlesTableProps {
  battles: BattleListRow[];
  selectedId: number | null;
  onOpen: (battleId: number) => void;
}

function SideLine({ side, prefix }: { side: BattleSideSummary; prefix?: string }): React.ReactElement {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${side.isWinner ? 'bg-success' : 'bg-transparent'}`}
        aria-hidden="true"
      />
      {side.stable ? <StableTag kind={side.stable.stableType} /> : <span className="w-[4.75rem] shrink-0" />}
      <span className={`min-w-0 shrink truncate ${side.isWinner ? 'font-semibold text-white' : 'text-secondary'}`}>
        {prefix}{side.label}
        {side.robotCount > 1 && ` (${side.robotCount})`}
      </span>
      {side.stable && <span className="min-w-0 shrink-[2] truncate text-tertiary">· {side.stable.name}</span>}
      {side.isWinner && <span className="sr-only">(winner)</span>}
    </div>
  );
}

function Sides({ row }: { row: BattleListRow }): React.ReactElement {
  if (row.field) {
    const winner = row.sides[0];
    return (
      <div className="space-y-1">
        {winner ? <SideLine side={winner} /> : <span className="text-secondary">Unknown</span>}
        {row.field.others > 0 && (
          <p className="pl-[6.25rem] text-xs text-secondary">
            + {row.field.others} other{row.field.others === 1 ? '' : 's'}
            {fieldBreakdown(row.field.othersByStableType) && ` · ${fieldBreakdown(row.field.othersByStableType)}`}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {row.sides.map((side, i) => <SideLine key={side.team} side={side} prefix={i > 0 ? 'vs ' : undefined} />)}
      {row.sides.length === 1 && <p className="pl-[6.25rem] text-xs text-tertiary">No opponent</p>}
    </div>
  );
}

function ReportLink({ id }: { id: number }): React.ReactElement {
  return (
    <Link
      to={`/battle/${id}`}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded text-primary hover:bg-white/5 ${ADMIN_FOCUS_RING}`}
      aria-label={`Open the player report of battle #${id}`}
      title="Open player report"
    >
      <span aria-hidden="true">↗</span>
    </Link>
  );
}

const durationOf = (row: BattleListRow): string => (row.result === 'bye' || row.result === 'forfeit' ? '—' : formatBattleDuration(row.durationSeconds));
const eloOf = (row: BattleListRow): string => (row.eloSwing === null ? '—' : `±${row.eloSwing}`);

export function BattlesTable({ battles, selectedId, onOpen }: BattlesTableProps): React.ReactElement {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-white/10 bg-surface md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Battles, newest first. Select a battle to open its admin check.</caption>
          <thead className="bg-surface-elevated text-left text-xs font-semibold uppercase tracking-wide text-secondary">
            <tr>
              <th scope="col" className="px-4 py-3">Battle</th>
              <th scope="col" className="px-3 py-3">Mode</th>
              <th scope="col" className="px-3 py-3">Sides</th>
              <th scope="col" className="px-3 py-3">Result</th>
              <th scope="col" className="px-3 py-3">Ended by</th>
              <th scope="col" className="px-3 py-3">ELO ±</th>
              <th scope="col" className="px-3 py-3">Length</th>
              <th scope="col" className="px-3 py-3">Time</th>
              <th scope="col" className="px-2 py-3"><span className="sr-only">Player report</span></th>
            </tr>
          </thead>
          <tbody>
            {battles.map((row) => (
              <tr
                key={row.id}
                onClick={() => onOpen(row.id)}
                className={`cursor-pointer border-t border-white/5 hover:bg-surface-elevated ${selectedId === row.id ? 'bg-surface-elevated shadow-[inset_3px_0_0_var(--color-primary)]' : ''}`}
              >
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpen(row.id); }}
                    className={`rounded text-secondary hover:text-white ${ADMIN_FOCUS_RING}`}
                    aria-label={`Open the admin check of battle #${row.id}`}
                  >
                    #{row.id}
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <p className="text-white">{modeLabel(row.battleType)}</p>
                  <p className="text-xs text-secondary">{modeDetail(row)}</p>
                </td>
                <td className="max-w-[22rem] px-3 py-2.5"><Sides row={row} /></td>
                <td className="px-3 py-2.5"><ResultPill result={row.result} /></td>
                <td className={`px-3 py-2.5 ${row.endedBy === 'time_limit' ? 'text-warning' : 'text-secondary'}`}>{endedByLabel(row.endedBy)}</td>
                <td className="px-3 py-2.5 text-white">{eloOf(row)}</td>
                <td className="px-3 py-2.5 text-white">{durationOf(row)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-secondary">{formatBattleTime(row.createdAt)}</td>
                <td className="px-2 py-1"><ReportLink id={row.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label="Battles, newest first">
        {battles.map((row) => (
          <li key={row.id} className={`rounded-lg border bg-surface ${selectedId === row.id ? 'border-primary/60' : 'border-white/10'}`}>
            <div className="flex items-start justify-between gap-2 px-4 pt-3">
              <button
                type="button"
                onClick={() => onOpen(row.id)}
                className={`min-h-11 min-w-0 flex-1 rounded text-left ${ADMIN_FOCUS_RING}`}
                aria-label={`Open the admin check of battle #${row.id}`}
              >
                <p className="text-sm text-white">{modeLabel(row.battleType)} <span className="text-secondary">#{row.id}</span></p>
                <p className="text-xs text-secondary">{modeDetail(row)} · {formatBattleTime(row.createdAt)} UTC</p>
              </button>
              <div className="flex items-center gap-1">
                <ResultPill result={row.result} />
                <ReportLink id={row.id} />
              </div>
            </div>
            <div className="px-4 py-2 text-sm"><Sides row={row} /></div>
            <p className="border-t border-white/5 px-4 py-2 text-xs text-secondary">
              {endedByLabel(row.endedBy)} · ELO {eloOf(row)} · {durationOf(row)}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

export interface BattlesPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  loading: boolean;
  onPage: (page: number) => void;
}

export function BattlesPagination({ page, totalPages, total, pageSize, loading, onPage }: BattlesPaginationProps): React.ReactElement {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const button = `min-h-11 rounded-md px-4 text-sm disabled:cursor-default disabled:text-tertiary ${ADMIN_FOCUS_RING}`;
  return (
    <nav aria-label="Battle pages" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-secondary">
        Showing {first.toLocaleString('en-US')}–{last.toLocaleString('en-US')} of {total.toLocaleString('en-US')} battles
      </p>
      <div className="flex gap-2">
        <button type="button" className={`${button} bg-surface text-white`} disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button type="button" className={`${button} bg-surface-elevated text-white`} disabled={page >= totalPages || loading} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </nav>
  );
}
