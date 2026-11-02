/**
 * AdminActionsPage — everything an admin changed, newest first
 * (`/admin/actions`, formerly the Audit Log at `/admin/audit-log`).
 *
 * Area chips (with counts over every recorded action) and a Failures chip
 * filter the list; both and the page live in the URL (`area`, `result`,
 * `page`). A row opens its stored details and a link to the page the action
 * was taken on. Admin actions are kept forever; the 30-day player event log
 * (`audit_logs`) is something else.
 * Data: `GET /api/admin/actions`.
 *
 * Definitions: docs/guides/ADMIN_PANEL_GUIDE.md §Admin actions.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ADMIN_FOCUS_RING, AdminPageHeader, PanelError, PanelSkeleton } from '../../components/admin/shared';
import { ToggleChip } from '../../components/admin/automatons/ui';
import { BattlesPagination } from '../../components/admin/battles/BattlesTable';
import { AdminActionsList } from '../../components/admin/actions/AdminActionsList';
import { ApiError } from '../../utils/ApiError';
import { isAbortError } from '../../utils/abort';
import { ADMIN_ACTION_AREAS, ADMIN_ACTION_AREA_LABELS, getAdminActions, type AdminActionsPage as ActionsPage, type AdminActionsQuery } from '../../utils/adminActionsApi';
import { formatActionDate, readActionsView, writeActionsView } from '../../utils/adminActionsFormat';

const count = (value: number): string => value.toLocaleString('en-US');

function AdminActionsPage(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const view = readActionsView(params);
  const [data, setData] = useState<ActionsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  const { area, result, page } = view;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getAdminActions({ area, result, page }, { signal: controller.signal })
      .then((next) => {
        if (controller.signal.aborted) return;
        setData(next);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err, controller.signal)) return;
        setError((err instanceof ApiError && err.message) || 'Could not load the admin actions.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [area, result, page, token]);

  const update = (patch: Partial<AdminActionsQuery>): void => {
    setParams((current) => writeActionsView(current, patch), { replace: true });
  };

  const counts = data?.counts;
  // "Other" holds operations the catalogue does not know; it is only offered when there are some.
  const areas = ADMIN_ACTION_AREAS.filter((key) => key !== 'other' || (counts?.byArea.other ?? 0) > 0 || area === 'other');

  return (
    <div data-testid="admin-actions-page" className="space-y-6">
      <AdminPageHeader
        title="Admin actions"
        subtitle="Everything an admin changed, newest first"
        actions={(
          <button
            type="button"
            onClick={() => setToken((t) => t + 1)}
            disabled={loading}
            className={`min-h-11 whitespace-nowrap rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white hover:bg-white/10 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
          >
            <span aria-hidden="true">↻ </span>Refresh
          </button>
        )}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Area">
          <ToggleChip pressed={area === null} onClick={() => update({ area: null, page: 1 })} className="px-3">
            All{counts ? ` · ${count(counts.all)}` : ''}
          </ToggleChip>
          {areas.map((key) => (
            <ToggleChip key={key} pressed={area === key} onClick={() => update({ area: key, page: 1 })} className="px-3">
              {ADMIN_ACTION_AREA_LABELS[key]}{counts ? ` · ${count(counts.byArea[key])}` : ''}
            </ToggleChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Result">
            <ToggleChip pressed={result === 'all'} onClick={() => update({ result: 'all', page: 1 })} className="px-3">All results</ToggleChip>
            <ToggleChip pressed={result === 'failure'} onClick={() => update({ result: 'failure', page: 1 })} className="px-3">
              Failures{counts ? ` · ${count(counts.failures)}` : ''}
            </ToggleChip>
          </div>
          {data && (
            <p className="text-xs text-secondary">
              {data.since
                ? `${count(data.counts.all)} ${data.counts.all === 1 ? 'action' : 'actions'} since ${formatActionDate(data.since)} · kept forever`
                : 'No admin action recorded yet'}
            </p>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-white/10 bg-surface"><PanelError message={error} onRetry={() => setToken((t) => t + 1)} /></div>}

      <section aria-label="Recorded admin actions" aria-busy={loading || undefined} className="rounded-lg border border-white/10 bg-surface">
        {!data && loading && <PanelSkeleton rows={8} />}
        {data && data.entries.length === 0 && (
          <p className="p-5 text-sm text-secondary">{data.counts.all === 0 ? 'No admin action has been recorded yet.' : 'No admin actions match these filters.'}</p>
        )}
        {data && data.entries.length > 0 && <AdminActionsList entries={data.entries} />}
        <p className="border-t border-white/5 px-5 py-3 text-xs text-secondary">
          A row opens its full details and a link to the page the action was taken on. Game events (battles, purchases, repairs) are not here; the event log keeps those 30 days.
        </p>
      </section>

      {data && data.totalPages > 1 && (
        <BattlesPagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          loading={loading}
          onPage={(next) => update({ page: next })}
          noun="actions"
        />
      )}
    </div>
  );
}

export default AdminActionsPage;
