/**
 * The list of the admin Actions page: one row per recorded action (when,
 * area, plain title, one-line details, admin, result). A row opens its full
 * stored summary and a link to the page the action was taken on. Rows stack
 * on small screens; the column header shows from `lg` up.
 */
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_FOCUS_RING } from '../shared';
import { ADMIN_ACTION_AREA_LABELS, ADMIN_ACTION_LINK_LABELS } from '../../../utils/adminActionsApi';
import { AREA_TONE, formatActionTime, summaryRows } from '../../../utils/adminActionsFormat';
import type { AdminActionEntry } from '@shared/types';

/** Columns from `lg` up; the expanded details are indented to the Action column (1.25 + 8.5 + 7.5 + 2 × 1 rem). */
const GRID = 'lg:grid lg:grid-cols-[8.5rem_7.5rem_minmax(0,1.3fr)_minmax(0,1.4fr)_8rem_4.5rem] lg:items-start lg:gap-4';

function ResultBadge({ result }: { result: AdminActionEntry['result'] }): ReactNode {
  return result === 'failure'
    ? <span className="inline-block rounded-full bg-error/15 px-2 py-0.5 text-xs font-medium text-error">Failed</span>
    : <span className="text-xs font-medium text-success">OK</span>;
}

function ActionRow({ entry }: { entry: AdminActionEntry }): ReactNode {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const failed = entry.result === 'failure';
  const rows = summaryRows(entry.summary);
  return (
    <li className={`border-t border-white/5 first:border-t-0 ${open ? 'bg-surface-elevated/60' : ''}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={`w-full px-5 py-3 text-left text-sm hover:bg-white/5 ${GRID} ${ADMIN_FOCUS_RING}`}
      >
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 lg:contents">
          <span className="tabular-nums text-white">{formatActionTime(entry.createdAt)}</span>
          <span><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${AREA_TONE[entry.area]}`}>{ADMIN_ACTION_AREA_LABELS[entry.area]}</span></span>
          <span className="ml-auto lg:hidden"><ResultBadge result={entry.result} /></span>
        </span>
        <span className={`mt-1 block font-medium lg:mt-0 ${failed ? 'text-error' : 'text-white'}`}>{entry.title}</span>
        <span className="mt-0.5 block break-words text-xs text-secondary lg:mt-0 lg:truncate lg:text-sm">{entry.details}</span>
        <span className="mt-0.5 block text-xs text-secondary lg:mt-0 lg:text-sm"><span className="lg:hidden">by </span>{entry.admin.name}</span>
        <span className="hidden text-right lg:block"><ResultBadge result={entry.result} /></span>
      </button>
      <div id={panelId} hidden={!open} className="px-5 pb-4 lg:pl-[19.25rem]">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-secondary">Details</p>
        {rows.length === 0 ? <p className="text-xs text-secondary">Nothing else was recorded.</p> : (
          <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-4 gap-y-0.5 text-xs">
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="truncate text-secondary">{row.label}</dt>
                <dd className="break-words text-white">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-1 flex flex-wrap items-center gap-x-4 text-xs text-secondary">
          <span>Recorded as <code className="text-white">{entry.operationType}</code></span>
          {entry.link && (
            <Link to={entry.link} className={`inline-flex min-h-11 items-center text-primary hover:underline ${ADMIN_FOCUS_RING}`}>
              Open {ADMIN_ACTION_LINK_LABELS[entry.area] || 'page'}
            </Link>
          )}
        </p>
      </div>
    </li>
  );
}

export function AdminActionsList({ entries }: { entries: AdminActionEntry[] }): ReactNode {
  return (
    <>
      <div aria-hidden="true" className={`hidden border-b border-white/10 px-5 py-2 text-xs text-secondary ${GRID}`}>
        <span>When (UTC)</span>
        <span>Area</span>
        <span>Action</span>
        <span>Details</span>
        <span>By</span>
        <span className="text-right">Result</span>
      </div>
      <ul aria-label="Admin actions, newest first">
        {entries.map((entry) => <ActionRow key={entry.id} entry={entry} />)}
      </ul>
    </>
  );
}
