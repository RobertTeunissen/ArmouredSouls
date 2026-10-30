/**
 * "This season" of the selected mode: a stable-type filter, the season totals,
 * the per-cycle trend and the tier boundaries with bounce-back. Data comes from
 * `GET /api/admin/league-health/season` (league history, this season).
 */
import type { ReactNode } from 'react';
import { AdminFilterBar, PanelError, PanelSkeleton } from '../shared';
import { useLeagueSeason } from '../../../hooks/useLeagueSeason';
import type { LeagueHealthMode, LeagueSeasonStableFilter } from '../../../utils/adminLeagueHealthApi';
import {
  SEASON_STABLE_FILTERS,
  formatCount,
  modeLabel,
  seasonRangeText,
  seasonTotalsText,
} from '../../../utils/adminLeagueHealthFormat';
import { SeasonTrend } from './SeasonTrend';
import { TierBoundaries } from './TierBoundaries';

export interface LeagueSeasonProps {
  mode: LeagueHealthMode;
  entityType: 'robot' | 'team';
  stable: LeagueSeasonStableFilter;
  onStableChange: (stable: LeagueSeasonStableFilter) => void;
  /** Changes when the page's Refresh is used. */
  reloadToken: number;
}

const SHORT_LABELS: Partial<Record<LeagueSeasonStableFilter, string>> = { generated: 'Bots' };

export function LeagueSeason({ mode, entityType, stable, onStableChange, reloadToken }: LeagueSeasonProps): ReactNode {
  const { data, loading, error } = useLeagueSeason(mode, stable, reloadToken);
  const noun = entityType === 'team' ? 'teams' : 'robots';
  const range = data ? seasonRangeText(data) : null;
  const last = data && data.cycles.length > 0 ? data.cycles[data.cycles.length - 1] : null;

  return (
    <section aria-labelledby="league-season-heading" className="space-y-4 border-t border-white/10 px-5 py-5" data-testid="league-season">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 id="league-season-heading" className="text-base font-semibold text-white">This season · {modeLabel(mode)}</h2>
          <p className="text-xs text-secondary">
            Promotions and demotions per cycle, from league history{range ? ` · ${range}` : ''}
          </p>
        </div>
        <AdminFilterBar
          variant="segmented"
          groupLabel="Stable type"
          filters={SEASON_STABLE_FILTERS.map((option) => ({
            ...option,
            shortLabel: SHORT_LABELS[option.key],
            active: option.key === stable,
          }))}
          onFilterToggle={(key) => onStableChange(key as LeagueSeasonStableFilter)}
        />
      </div>

      {error && <PanelError message={error} />}
      {!data && loading && <PanelSkeleton rows={5} />}
      {data && (
        data.cycles.length === 0 ? (
          <p className="text-sm text-secondary">No promotions or demotions recorded in this league this season yet.</p>
        ) : (
          <div className={`space-y-5 ${loading ? 'opacity-60' : ''}`} aria-busy={loading || undefined}>
            <SeasonTrend season={data} label={`${modeLabel(mode)} this season`} />
            <p className="text-sm text-secondary" data-testid="season-totals">
              Season so far: <span className="text-white">{seasonTotalsText(data)}</span>
              {last && ` · last cycle (${last.cycle}): ${formatCount(last.promoted)} up, ${formatCount(last.demoted)} down`}
            </p>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-white">Tier boundaries</h3>
              <TierBoundaries season={data} noun={noun} />
            </div>
            <p className="text-xs text-secondary">
              Back within {data.window} cycles: of the promotions at least {data.window} cycles old, the share demoted back across the same boundary within {data.window} cycles.
              Noted above {Math.round(data.noteShare * 100)}% with at least {data.minSample} promotions to judge.
              {(mode === 'koth' || mode === 'grand_melee') && ' KotH and Grand Melee hardly demote at all, so their bounce-back stays low; it does not mean promotions there are better judged.'}
            </p>
          </div>
        )
      )}
    </section>
  );
}
