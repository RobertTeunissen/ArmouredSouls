/**
 * "Needs attention": open items first, each linking to the page that resolves
 * it. Items that are fine collapse to a muted ✓ line.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_FOCUS_RING } from '../shared';
import type { DashboardStatus } from '../../../utils/adminDashboardApi';
import {
  countOpenItems,
  deriveAttentionItems,
  formatCount,
  type AttentionItem,
  type AttentionSeverity,
} from '../../../utils/adminDashboardFormat';
import { AdminPanel } from '../shared/AdminPanel';

export interface NeedsAttentionPanelProps {
  status: DashboardStatus | null;
  loading: boolean;
  error: string | null;
}

const BADGE: Readonly<Record<AttentionSeverity, string>> = {
  error: 'bg-error/15 text-error',
  warning: 'bg-warning/15 text-warning',
  unavailable: 'bg-white/5 text-secondary',
  ok: 'bg-success/10 text-success',
};

const SEVERITY_WORD: Readonly<Record<AttentionSeverity, string>> = {
  error: 'Needs action',
  warning: 'Warning',
  unavailable: 'Unavailable',
  ok: 'OK',
};

function Badge({ item }: { item: AttentionItem }): ReactNode {
  const symbol = item.count !== null ? formatCount(item.count) : item.severity === 'ok' ? '✓' : '?';
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-bold tabular-nums ${BADGE[item.severity]}`}
      aria-hidden="true"
    >
      {symbol}
    </span>
  );
}

function ItemBody({ item, open }: { item: AttentionItem; open: boolean }): ReactNode {
  return (
    <>
      <Badge item={item} />
      <span className="min-w-0 flex-1">
        <span className="sr-only">{SEVERITY_WORD[item.severity]}: </span>
        <span className={`block text-sm font-medium ${open ? 'text-white' : 'text-secondary'}`}>
          {item.count !== null && <span className="sr-only">{formatCount(item.count)} </span>}
          {item.title}
        </span>
        <span className={`block text-xs ${open ? 'text-secondary' : 'text-tertiary'}`}>{item.detail}</span>
      </span>
    </>
  );
}

export function NeedsAttentionPanel({ status, loading, error }: NeedsAttentionPanelProps): ReactNode {
  const items = status ? deriveAttentionItems(status) : null;
  const open = items ? countOpenItems(items) : 0;

  const badge = items ? (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${open > 0 ? 'bg-error/15 text-error' : 'bg-success/10 text-success'}`}>
      {open > 0 ? `${open} open` : 'All clear'}
    </span>
  ) : null;

  return (
    <AdminPanel title="Needs attention" actions={badge} loading={loading} error={error} skeletonRows={4}>
      {items && (
        <ul className="divide-y divide-white/5 px-2 py-1">
          {items.map((item) => {
            const isOpen = item.severity === 'error' || item.severity === 'warning';
            return (
              <li key={item.key}>
                {isOpen ? (
                  <Link
                    to={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-3 transition-colors motion-reduce:transition-none hover:bg-white/5 ${ADMIN_FOCUS_RING}`}
                  >
                    <ItemBody item={item} open />
                    <span className="shrink-0 text-sm text-primary">
                      <span className="hidden sm:inline">{item.destination} </span>
                      <span aria-hidden="true">→</span>
                      <span className="sr-only sm:hidden">Open {item.destination}</span>
                    </span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-3">
                    <ItemBody item={item} open={false} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AdminPanel>
  );
}
