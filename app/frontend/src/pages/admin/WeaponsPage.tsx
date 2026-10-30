/**
 * WeaponsPage — what winning robots fight with (`/admin/weapons`): the effect
 * of weapons, archetypes (main weapon range band × loadout) and matchups,
 * what is used per league tier, price vs effect, refinements and coverage.
 *
 * Built on the battle-time build records, like Attributes. Every effect is
 * against an equally strong opponent (same points invested, same stance).
 * Range, mode, strength and the matchup view live in the URL
 * (`?range=&column=&strength=&matchups=`), so a view can be linked.
 * Method and definitions: docs/guides/ADMIN_PANEL_GUIDE.md §Weapons.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArchetypeGrid,
  MatchupGrid,
  PriceEffectScatter,
  RefinementsCoverage,
  TierUsageBars,
  WeaponsControls,
  WeaponsTable,
} from '../../components/admin/weapons';
import type { WeaponAnalysisCollecting, WeaponAnalysisReady, WeaponFilters } from '../../components/admin/weapons';
import { ADMIN_FOCUS_RING, AdminPanel, PanelError, PanelSkeleton } from '../../components/admin/shared';
import { useWeaponAnalysis } from '../../hooks/useWeaponAnalysis';
import { RANGE_OPTIONS, columnLabel, formatCount, formatEffect, formatUtcDate } from '../../utils/adminAttributesFormat';
import { readWeaponFilters, writeWeaponFilters } from '../../utils/adminWeaponsFormat';

function CollectingState({ data }: { data: WeaponAnalysisCollecting }): React.ReactElement {
  return (
    <div className="rounded-lg border border-white/10 bg-surface px-5 py-8 text-center">
      <h2 className="text-base font-semibold text-white">Collecting battle-time builds</h2>
      {data.recordingSince && data.availableFrom ? (
        <p className="mx-auto mt-2 max-w-xl text-sm text-secondary">
          Recording started on {formatUtcDate(data.recordingSince)}; {formatCount(data.battlesRecorded)} battles recorded so far.
          The analysis appears on {formatUtcDate(data.availableFrom)}, after seven days of battles.
        </p>
      ) : (
        <p className="mx-auto mt-2 max-w-xl text-sm text-secondary">
          No battle-time builds are recorded yet. The analysis appears seven days after the first battles are recorded.
        </p>
      )}
    </div>
  );
}

function WindowLine({ data, column }: { data: WeaponAnalysisReady; column: WeaponFilters['column'] }): React.ReactElement {
  const range = RANGE_OPTIONS.find((o) => o.key === data.window.range)?.label ?? data.window.range;
  const summary = data.columns.find((c) => c.column === column);
  const cuts = data.columns.filter((c) => c.strengthCut !== null);
  return (
    <div className="space-y-1 text-sm text-secondary" aria-live="polite">
      <p>
        <span className="font-semibold text-white">{formatCount(data.window.battlesUsed)} battles</span>
        {data.window.sampled && <> (a sample of {formatCount(data.window.battlesInRange)})</>}
        {' · '}{range}
        {data.window.from ? ` from ${formatUtcDate(data.window.from)}` : ` since recording started ${formatUtcDate(data.recordingSince)}`}
        {summary && <> · {columnLabel(column)}: {formatCount(summary.battles)} battles, {formatCount(summary.robots)} robots fought ({formatCount(summary.humanRobots)} players&apos;)</>}
        {summary?.enough && summary.investmentEffect.effect !== null && <> · 10% more points: {formatEffect(summary.investmentEffect.effect)}</>}
      </p>
      {data.strength === 'top10' && cuts.length > 0 && (
        <p className="text-xs">
          Top 10%: fights where every robot invested at least {cuts.map((c) => `${formatCount(Math.round(c.strengthCut ?? 0))} points (${columnLabel(c.column)})`).join(', ')}.
        </p>
      )}
      {summary && !summary.enough && (
        <p className="text-xs text-warning">Too few comparisons in {columnLabel(column)} for effects ({formatCount(summary.comparisons)} of 300). Usage is still shown.</p>
      )}
    </div>
  );
}

function WeaponsPage(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readWeaponFilters(params), [params]);
  const analysis = useWeaponAnalysis(filters.range, filters.strength);

  const setFilters = useCallback((next: Partial<WeaponFilters>) => {
    setParams((current) => writeWeaponFilters(current, { ...readWeaponFilters(current), ...next }), { replace: true });
  }, [setParams]);

  const data = analysis.data;
  const ready = data?.status === 'ready' ? data : null;
  const refreshing = analysis.loading && data !== null;
  const { column } = filters;
  const mode = columnLabel(column);

  return (
    <div data-testid="weapons-page" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-secondary">
          What winning robots fight with, from the weapons each robot actually carried. Usage shows the meta; effects show its implications.
        </p>
        <button
          type="button"
          onClick={analysis.reload}
          disabled={analysis.loading}
          className={`min-h-11 whitespace-nowrap rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white hover:bg-white/10 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
        >
          <span aria-hidden="true">↻ </span>{analysis.loading ? 'Analysing…' : 'Refresh'}
        </button>
      </div>

      <WeaponsControls filters={filters} onChange={setFilters} />

      {analysis.error && (
        <div className="rounded-lg border border-white/10 bg-surface"><PanelError message={analysis.error} onRetry={analysis.reload} /></div>
      )}

      {!data && analysis.loading && (
        <div className="rounded-lg border border-white/10 bg-surface" aria-busy="true">
          <p className="px-5 pt-4 text-sm text-secondary">Analysing battles… the first view of a window can take several seconds.</p>
          <PanelSkeleton rows={10} />
        </div>
      )}

      {data?.status === 'collecting' && <CollectingState data={data} />}

      {ready && (
        <div className={`space-y-5 ${refreshing ? 'opacity-70 transition-opacity motion-reduce:transition-none' : ''}`}>
          <WindowLine data={ready} column={column} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <AdminPanel title={`Archetypes: range × loadout · ${mode}`}>
              <ArchetypeGrid archetypes={ready.archetypes} column={column} />
            </AdminPanel>
            <AdminPanel title={`Matchups · ${mode}`}>
              <MatchupGrid matchups={ready.matchups[column]} view={filters.matchups} onViewChange={(matchups) => setFilters({ matchups })} />
            </AdminPanel>
          </div>

          <AdminPanel title={`Usage by league tier · ${mode}`}>
            <TierUsageBars usage={ready.tiers[column]} />
          </AdminPanel>

          <AdminPanel title={`Weapons · ${mode}`}>
            <WeaponsTable weapons={ready.weapons} column={column} />
          </AdminPanel>

          <div className="grid gap-5 xl:grid-cols-2">
            <AdminPanel title={`Price vs effect · ${mode}`}>
              <PriceEffectScatter weapons={ready.weapons} column={column} />
            </AdminPanel>
            <AdminPanel title={`Refinements and coverage · ${mode}`}>
              <RefinementsCoverage refinements={ready.refinements[column]} coverage={ready.coverage[column]} notOwnedByPlayers={ready.notOwnedByPlayers} />
            </AdminPanel>
          </div>

          <p className="text-xs text-tertiary">
            Effects are associations from a logistic model on points invested (base + tuning) and stance; a weapon&apos;s own attribute bonuses count as part of the weapon.
            Team: a side is the average of its robots. Free-for-all: pairs of robots by placement. Usage counts robots that fought, not weapons owned.
          </p>
        </div>
      )}
    </div>
  );
}

export default WeaponsPage;
