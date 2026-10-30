/**
 * "Needs attention": one line per league problem, grouped across modes by the
 * backend, each linking to the tier it is about.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_FOCUS_RING, AdminPanel } from '../shared';
import type { LeagueHealthAttentionItem } from '../../../utils/adminLeagueHealthApi';
import { attentionText } from '../../../utils/adminLeagueHealthFormat';
import { SEVERITY_DOT, SEVERITY_WORD } from './leagueHealthTones';

export interface LeagueHealthAttentionProps {
  items: readonly LeagueHealthAttentionItem[] | null;
  /** Share below which movement counts as low (from the overview's thresholds). */
  lowMovementShare: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Called after a link is followed, so the page can bring the tier into view. */
  onNavigate: () => void;
}

export function LeagueHealthAttention({ items, lowMovementShare, loading, error, onRetry, onNavigate }: LeagueHealthAttentionProps): ReactNode {
  const open = items?.filter((item) => item.severity !== 'notice').length ?? 0;
  const badge = items ? (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${open > 0 ? 'bg-warning/15 text-warning' : 'bg-success/10 text-success'}`}>
      {open > 0 ? `${open} open` : 'All clear'}
    </span>
  ) : null;

  return (
    <AdminPanel title="Needs attention" actions={badge} loading={loading && !items} error={error} onRetry={onRetry} skeletonRows={3}>
      {items && items.length === 0 && (
        <p className="px-5 py-4 text-sm text-secondary">Every tier promotes and demotes. No unsubscribed rows above the notice share.</p>
      )}
      {items && items.length > 0 && (
        <ul className="divide-y divide-white/5 px-2 py-1" data-testid="league-health-attention">
          {items.map((item) => {
            const text = attentionText(item, lowMovementShare);
            return (
              <li key={`${item.code}:${item.tier ?? 'all'}`}>
                <Link
                  to={text.href}
                  onClick={onNavigate}
                  className={`flex items-start gap-3 rounded-md px-3 py-3 transition-colors motion-reduce:transition-none hover:bg-white/5 ${ADMIN_FOCUS_RING}`}
                >
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${SEVERITY_DOT[item.severity]}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="sr-only">{SEVERITY_WORD[item.severity]}: </span>
                    <span className="block text-sm font-medium text-white">{text.title}</span>
                    <span className="block text-xs text-secondary">{text.detail}</span>
                  </span>
                  <span className="shrink-0 text-sm text-primary">
                    <span className="hidden sm:inline">{text.destination} </span>
                    <span aria-hidden="true">→</span>
                    <span className="sr-only sm:hidden">Open {text.destination}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AdminPanel>
  );
}
