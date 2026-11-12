/**
 * AchievementAnalyticsPage — "Which achievements are too easy or too hard?"
 * (`/admin/achievements`).
 *
 * This season only (a rollover deletes every unlock). Stable type in the URL
 * as `?stables=` (Players, Automatons, Generated; default Players). Player
 * rates are out of the players who logged in since the season started, so
 * dormant accounts do not drag every rate down. Sections: headline numbers,
 * unlock rate per achievement by tier, two balance notes, and the full table.
 * Data: `GET /api/admin/achievements/analytics?stables=`.
 *
 * Definitions: docs/guides/ADMIN_PANEL_GUIDE.md §Achievements.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ADMIN_FOCUS_RING, AdminPageHeader, PanelError, PanelSkeleton, StableScopeToggle } from '../../components/admin/shared';
import { AchievementSummary, AchievementTable, TierNotes, TierStripChart } from '../../components/admin/achievements';
import { ApiError } from '../../utils/ApiError';
import { isAbortError } from '../../utils/abort';
import {
  ACHIEVEMENT_STABLES,
  getAchievementAnalytics,
} from '../../utils/adminAchievementsApi';
import {
  easierThanTier,
  harderThanTier,
  readAchievementStables,
  tierStrips,
  writeAchievementStables,
} from '../../utils/adminAchievementsFormat';
import { formatCount, formatUtcTime } from '../../utils/adminDashboardFormat';
import { dayMonth } from '../../utils/adminImagesFormat';
import type { AchievementAnalytics } from '@shared/types';

/** Who the rates are out of, in the page's words. */
function populationWords(data: AchievementAnalytics): { who: string; scope: string } {
  if (data.stables === 'players') {
    const since = data.seasonStartedAt ? ` (logged in since ${dayMonth(data.seasonStartedAt)})` : '';
    return {
      who: 'active players',
      scope: `This season · ${formatCount(data.population)} active ${data.population === 1 ? 'player' : 'players'}${since} of ${formatCount(data.totalStables)} accounts · rates are of active players`,
    };
  }
  const who = data.stables === 'automatons' ? 'Automatons' : 'generated stables';
  return { who, scope: `This season · ${formatCount(data.population)} ${who} · rates are of all of them` };
}

function AchievementAnalyticsPage(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const stables = readAchievementStables(params);
  const [data, setData] = useState<AchievementAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getAchievementAnalytics(stables, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setFetchedAt(new Date().toISOString());
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err, controller.signal)) return;
        setError((err instanceof ApiError && err.message) || 'Could not load the achievement analytics.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [stables, token]);

  // Never show another stable type's numbers while the new ones load.
  const current = data && data.stables === stables ? data : null;
  const derived = useMemo(() => (current ? {
    strips: tierStrips(current.achievements),
    easier: easierThanTier(current.achievements),
    harder: harderThanTier(current.achievements),
    words: populationWords(current),
  } : null), [current]);
  const refreshing = loading && current !== null;

  return (
    <div data-testid="achievement-analytics-page" className="space-y-6">
      <AdminPageHeader
        title="Achievements"
        subtitle="Which achievements are too easy or too hard?"
        actions={(
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-xs text-secondary" aria-live="polite">
              {refreshing ? 'Refreshing…' : current && fetchedAt ? `Last updated ${formatUtcTime(fetchedAt, true)}` : ''}
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
        <StableScopeToggle
          value={stables}
          options={ACHIEVEMENT_STABLES}
          label="Stable type"
          onChange={(option) => setParams((existing) => writeAchievementStables(existing, option), { replace: true })}
        />
        {derived && <p className="text-xs text-secondary" data-testid="achievement-scope">{derived.words.scope}</p>}
      </div>

      {error && (
        <div className="rounded-lg border border-white/10 bg-surface">
          <PanelError message={error} onRetry={() => setToken((t) => t + 1)} />
        </div>
      )}

      {!current && loading && <div className="rounded-lg border border-white/10 bg-surface"><PanelSkeleton rows={6} /></div>}

      {current && derived && (
        <>
          <AchievementSummary data={current} />
          <TierStripChart strips={derived.strips} population={derived.words.who} />
          <TierNotes easier={derived.easier} harder={derived.harder} population={current.population} who={derived.words.who} />
          <AchievementTable rows={current.achievements} who={derived.words.who} showAllAccounts={current.stables === 'players'} />
        </>
      )}
    </div>
  );
}

export default AchievementAnalyticsPage;
