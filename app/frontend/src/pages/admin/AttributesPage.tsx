/**
 * AttributesPage — which attributes, attribute groups and build profiles win
 * battles (`/admin/attributes`, formerly Robot Stats), to plan how the meta
 * should shift next season.
 *
 * Built on the battle-time build records: what each robot actually fought
 * with, not its current values. Range, sort column and layer toggles live in
 * the URL (`?range=&column=&off=`), so a view can be linked.
 * Method and definitions: docs/guides/ADMIN_PANEL_GUIDE.md §Attributes.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AttributeHeatmap,
  AttributesControls,
  BiggestEffects,
  BuildProfilesTable,
  ColumnSummaries,
  GroupMatrix,
  LayerFitTable,
  MethodNote,
} from '../../components/admin/attributes';
import type { AttributeAnalysisCollecting, AttributeAnalysisReady, AttributeFilters } from '../../components/admin/attributes';
import { ADMIN_FOCUS_RING, AdminPanel, PanelError, PanelSkeleton } from '../../components/admin/shared';
import { useAttributeAnalysis } from '../../hooks/useAttributeAnalysis';
import {
  RANGE_OPTIONS,
  columnLabel,
  formatCount,
  formatUtcDate,
  readAttributeFilters,
  writeAttributeFilters,
} from '../../utils/adminAttributesFormat';

function CollectingState({ data }: { data: AttributeAnalysisCollecting }): React.ReactElement {
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
          No battle-time builds are recorded yet. Recording starts with the first battles after this release; the analysis appears seven days later.
        </p>
      )}
    </div>
  );
}

function WindowLine({ data }: { data: AttributeAnalysisReady }): React.ReactElement {
  const range = RANGE_OPTIONS.find((o) => o.key === data.window.range)?.label ?? data.window.range;
  const skipped = data.skipped.draws + data.skipped.forfeits + data.skipped.tiedPlacements + data.skipped.missingBuilds;
  return (
    <p className="text-sm text-secondary" aria-live="polite">
      <span className="font-semibold text-white">{formatCount(data.window.battlesUsed)} battles</span>
      {data.window.sampled && <> (a sample of {formatCount(data.window.battlesInRange)})</>}
      {' · '}{range}
      {data.window.from ? ` from ${formatUtcDate(data.window.from)}` : ` since recording started ${formatUtcDate(data.recordingSince)}`}
      {' · '}{formatCount(data.robots.all)} robots fought ({formatCount(data.robots.human)} players&apos;)
      {skipped > 0 && <> · left out: {formatCount(data.skipped.draws)} draws, {formatCount(data.skipped.forfeits)} forfeits{data.skipped.tiedPlacements > 0 && `, ${formatCount(data.skipped.tiedPlacements)} tied placements`}{data.skipped.missingBuilds > 0 && `, ${formatCount(data.skipped.missingBuilds)} without builds`}</>}
    </p>
  );
}

function AttributesPage(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readAttributeFilters(params), [params]);
  const analysis = useAttributeAnalysis(filters.range, filters.toggles);

  const setFilters = useCallback((next: Partial<AttributeFilters>) => {
    setParams((current) => writeAttributeFilters(current, { ...readAttributeFilters(current), ...next }), { replace: true });
  }, [setParams]);

  const data = analysis.data;
  const ready = data?.status === 'ready' ? data : null;
  const refreshing = analysis.loading && data !== null;
  const column = filters.column;

  return (
    <div data-testid="attributes-page" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-secondary">
          Which attributes and combinations win, from what each robot fought with. Use it to plan next season&apos;s meta shift.
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

      <AttributesControls filters={filters} onChange={setFilters} />

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
          <WindowLine data={ready} />
          <ColumnSummaries columns={ready.columns} selected={column} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <AdminPanel title="Attribute effects">
              <AttributeHeatmap attributes={ready.attributes} columns={ready.columns} column={column} />
            </AdminPanel>
            <AdminPanel title={`Biggest effects · ${columnLabel(column)}`}>
              <BiggestEffects attributes={ready.attributes} column={column} />
            </AdminPanel>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <AdminPanel title={`Group combinations · ${columnLabel(column)}`}>
              <GroupMatrix groups={ready.groups} pairs={ready.groupPairs} column={column} />
            </AdminPanel>
            <AdminPanel title={`Build profiles · ${columnLabel(column)}`}>
              <BuildProfilesTable profiles={ready.profiles} column={column} />
            </AdminPanel>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <AdminPanel title="Model fit by layer">
              <LayerFitTable fit={ready.layerFit} />
            </AdminPanel>
            <AdminPanel title="How this is calculated">
              <MethodNote />
            </AdminPanel>
          </div>
        </div>
      )}
    </div>
  );
}

export default AttributesPage;
