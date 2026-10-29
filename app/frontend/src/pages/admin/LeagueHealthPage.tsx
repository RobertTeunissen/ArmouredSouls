/**
 * LeagueHealthPage — every tiered league (1v1, 2v2, 3v3, Tag Team, King of the
 * Hill, Grand Melee): who is in each tier and what the next rebalance would do.
 *
 * Sections: toolbar (season, last updated, Refresh), Needs attention, the
 * mode × tier grid, and the detail of one mode (`?mode=`) with the instances of
 * an expanded tier (`?tier=`). Structure (places, zones, who qualifies now)
 * comes from the rebalancer's own planner on the current standings; whether
 * anyone actually moves comes from the mode's last rebalances in
 * `league_history` (`GET /api/admin/league-health`).
 *
 * Definitions: docs/guides/ADMIN_PANEL_GUIDE.md §League Health.
 */
import { useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LeagueGrid, LeagueHealthAttention, LeagueModeTabs, TierTable } from '../../components/admin/league-health';
import { ADMIN_FOCUS_RING, PanelError, PanelSkeleton } from '../../components/admin/shared';
import { useLeagueHealth } from '../../hooks/useLeagueHealth';
import type { LeagueHealthMode } from '../../utils/adminLeagueHealthApi';
import { formatUtcTime } from '../../utils/adminDashboardFormat';
import {
  DEFAULT_LEAGUE_HEALTH_MODE,
  modeLabel,
  readLeagueHealthMode,
  readLeagueHealthTier,
  rulesSummary,
  seasonLabel,
  standingsHref,
} from '../../utils/adminLeagueHealthFormat';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function LeagueHealthPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = readLeagueHealthMode(searchParams.get('mode'));
  const expandedTier = readLeagueHealthTier(searchParams.get('tier'));
  const { data, loading, error, reload } = useLeagueHealth();
  const detailRef = useRef<HTMLElement>(null);
  const refreshing = loading && data !== null;

  const scrollToDetail = useCallback((): void => {
    // After the URL update has rendered the selected mode and tier.
    window.setTimeout(() => {
      detailRef.current?.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }, 0);
  }, []);

  const select = useCallback((nextMode: LeagueHealthMode, tier: string | null, scroll = false): void => {
    setSearchParams((params) => {
      const updated = new URLSearchParams(params);
      if (nextMode === DEFAULT_LEAGUE_HEALTH_MODE) updated.delete('mode');
      else updated.set('mode', nextMode);
      if (tier) updated.set('tier', tier);
      else updated.delete('tier');
      return updated;
    }, { replace: true });
    if (scroll) scrollToDetail();
  }, [setSearchParams, scrollToDetail]);

  const toggleTier = useCallback((tier: string): void => {
    select(mode, expandedTier === tier ? null : tier);
  }, [select, mode, expandedTier]);

  const summary = data?.modes.find((item) => item.mode === mode) ?? null;
  const season = seasonLabel(data?.season ?? null);

  return (
    <div data-testid="league-health-page" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-secondary">
          Who is in each tier, and whether promotion and demotion move{season ? ` · ${season}` : ''}
        </p>
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-xs text-secondary" aria-live="polite">
            {refreshing ? 'Refreshing…' : data ? `Last updated ${formatUtcTime(data.generatedAt, true)}` : 'Not loaded yet'}
          </span>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className={`min-h-11 whitespace-nowrap rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white hover:bg-white/10 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
          >
            <span aria-hidden="true">↻ </span>Refresh
          </button>
        </div>
      </div>

      <LeagueHealthAttention
        items={data?.attention ?? null}
        lowMovementShare={data?.thresholds.lowMovementShare ?? 0.25}
        loading={loading}
        error={data ? null : error}
        onRetry={reload}
        onNavigate={scrollToDetail}
      />
      {data && error && (
        <div className="rounded-lg border border-white/10 bg-surface">
          <PanelError message={`${error} Showing the data from ${formatUtcTime(data.generatedAt, true)}.`} onRetry={reload} />
        </div>
      )}

      <LeagueGrid
        modes={data?.modes ?? null}
        selectedMode={mode}
        loading={loading}
        onSelect={(nextMode, tier) => select(nextMode, tier, true)}
      />

      <section
        ref={detailRef}
        aria-labelledby="league-health-detail-heading"
        className="scroll-mt-4 rounded-lg border border-white/10 bg-surface"
        data-testid="league-health-detail"
      >
        <div className="space-y-3 border-b border-white/10 px-5 py-3.5">
          <h2 id="league-health-detail-heading" className="sr-only">{modeLabel(mode)} tiers</h2>
          <LeagueModeTabs selected={mode} onSelect={(nextMode) => select(nextMode, null)} />
          {summary && (
            <div className="flex flex-col gap-1 text-xs text-secondary lg:flex-row lg:items-center lg:justify-between">
              <span>{rulesSummary(summary)}</span>
              <Link to={standingsHref(mode, 'bronze')} className={`whitespace-nowrap text-primary hover:underline ${ADMIN_FOCUS_RING}`}>
                Player standings <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </div>
        <div className="p-3 md:p-2">
          {summary ? (
            <TierTable mode={summary} expandedTier={expandedTier} onToggleTier={toggleTier} />
          ) : loading ? (
            <PanelSkeleton rows={6} />
          ) : null}
        </div>
        {summary && (
          <div className="space-y-1 border-t border-white/10 px-5 py-3 text-xs text-secondary">
            <p>
              Promotion and demotion: how many moved in the last rebalance of the places the rebalancer's planner gives each tier,
              and the average over the last {summary.rebalanceCycles.length > 0 ? summary.rebalanceCycles.length : data?.thresholds.historyWindow} rebalances
              {summary.rebalanceCycles.length > 0 ? ` (cycles ${summary.rebalanceCycles[summary.rebalanceCycles.length - 1]}–${summary.rebalanceCycles[0]})` : ''}.
              {summary.rebalanceCycles.length < (data?.thresholds.historyWindow ?? 5) ? ' Not judged until the league has that many rebalances this season.' : ''}
            </p>
            <p>
              Active = subscribed to this event ({summary.entityType === 'team' ? 'every team member' : 'the robot'}). Unsubscribed rows keep their seat and count toward zone sizes.
              {summary.entityType === 'team' ? ' Team ELO is the members\' combined ELO, as on the league pages.' : ''}
              {' '}Past promotions and demotions: <Link to="/admin/league-history" className={`text-primary hover:underline ${ADMIN_FOCUS_RING}`}>League History <span aria-hidden="true">→</span></Link>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default LeagueHealthPage;
