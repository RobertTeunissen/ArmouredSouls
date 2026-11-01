/**
 * SecurityPage — "Is anyone abusing or attacking the game, and who?"
 * (`/admin/security`).
 *
 * Sections: the window picker (24 hours / 7 days / 30 days, in the URL as
 * `?window=`), a status line naming the signal types that fired, the six
 * signal cards, signals per bucket, the stables behind the signals and the
 * sources without an account (by IP, with failed-login bursts).
 * Data: `GET /api/admin/security/overview?window=`.
 *
 * Signals are stored for 90 days and survive deploys. Admin page views and
 * routine purchases are not signals. Definitions: docs/guides/ADMIN_PANEL_GUIDE.md §Security.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ADMIN_FOCUS_RING, AdminPageHeader, AdminPanel, PanelError, PanelSkeleton } from '../../components/admin/shared';
import { SignalCards, SignalSourcesTable, SignalStablesTable, SignalsChart } from '../../components/admin/security';
import { ApiError } from '../../utils/ApiError';
import { isAbortError } from '../../utils/abort';
import { getSecurityOverview, SECURITY_WINDOWS, type SecurityOverview } from '../../utils/adminSecurityApi';
import { WINDOW_LABELS, firedSummary, readSecurityWindow, writeSecurityWindow } from '../../utils/adminSecurityFormat';
import { formatUtcTime } from '../../utils/adminDashboardFormat';
import { dayMonth } from '../../utils/adminImagesFormat';

function SecurityPage(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const range = readSecurityWindow(params);
  const [data, setData] = useState<SecurityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  const now = useMemo(() => (data ? new Date(data.generatedAt) : new Date()), [data]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getSecurityOverview(range, controller.signal)
      .then((overview) => {
        if (controller.signal.aborted) return;
        setData(overview);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err, controller.signal)) return;
        setError((err instanceof ApiError && err.message) || 'Could not load the security signals.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [range, token]);

  const summary = data && data.window === range ? firedSummary(data.signals, range) : null;
  const refreshing = loading && data !== null;

  return (
    <div data-testid="security-page" className="space-y-6">
      <AdminPageHeader
        title="Security"
        subtitle="Is anyone abusing or attacking the game, and who?"
        actions={(
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-xs text-secondary" aria-live="polite">
              {refreshing ? 'Refreshing…' : data ? `Last updated ${formatUtcTime(data.generatedAt, true)}` : ''}
            </span>
            <button
              type="button"
              onClick={() => setToken((t) => t + 1)}
              disabled={loading}
              className={`min-h-11 whitespace-nowrap rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white hover:bg-white/10 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
            >
              <span aria-hidden="true">↻ </span>Refresh
            </button>
          </div>
        )}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Time window">
          {SECURITY_WINDOWS.map((option) => {
            const pressed = option === range;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={pressed}
                onClick={() => setParams((current) => writeSecurityWindow(current, option), { replace: true })}
                className={`min-h-11 rounded-full border px-4 text-sm transition-colors motion-reduce:transition-none ${pressed ? 'border-primary bg-primary/15 text-primary' : 'border-white/10 bg-surface-elevated text-white hover:bg-white/10'} ${ADMIN_FOCUS_RING}`}
              >
                {WINDOW_LABELS[option]}
              </button>
            );
          })}
        </div>
        {data && (
          <p className="text-xs text-secondary">
            {data.recordingSince ? `Recorded since ${dayMonth(data.recordingSince)}` : 'Nothing recorded yet'} · kept {data.thresholds.retentionDays} days
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-white/10 bg-surface">
          <PanelError message={error} onRetry={() => setToken((t) => t + 1)} />
        </div>
      )}

      {!data && loading && <div className="rounded-lg border border-white/10 bg-surface"><PanelSkeleton rows={6} /></div>}

      {data && (
        <>
          {summary && (
            <p
              role="status"
              data-testid="security-status"
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm text-white ${summary.quiet ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10'}`}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${summary.quiet ? 'bg-success' : 'bg-warning'}`} aria-hidden="true" />
              {summary.text}
            </p>
          )}

          <SignalCards signals={data.signals} now={now} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <AdminPanel title={data.bucket === 'hour' ? 'Signals per hour' : 'Signals per day'}>
              <SignalsChart overview={data} />
            </AdminPanel>
            <AdminPanel title="Stables with signals">
              <p className="px-5 pt-3 text-xs text-secondary">Players who triggered a signal. Failed logins count attempts on that account.</p>
              <SignalStablesTable rows={data.stables} />
            </AdminPanel>
          </div>

          <AdminPanel title="Without an account">
            <p className="px-5 pt-3 text-xs text-secondary">Requests from an IP address before or without login: failed logins, malformed requests and rate-limit hits.</p>
            <SignalSourcesTable rows={data.sources} burstCount={data.thresholds.burstCount} burstWindowMinutes={data.thresholds.burstWindowMinutes} />
          </AdminPanel>

          <p className="text-xs text-secondary">
            Not recorded: admin page views and purchases. There are no severity levels; a signal either fired in the window or it did not.
            The dashboard flags failed-login bursts, ownership violations and race-condition or robot-creation bursts of the last 24 hours.
          </p>
        </>
      )}
    </div>
  );
}

export default SecurityPage;
