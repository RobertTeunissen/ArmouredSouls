/**
 * Hall of Records (`/hall-of-records`, PRD_HALL_OF_RECORDS v2.0).
 *
 * The live season's records as a board of tiles, one per record, grouped into
 * Robots / Single battles / Streaks / KotH & Melee / Stables. A tile opens the
 * record's top 10 (`?record=`), or its leaderboard page when one exists. Past
 * seasons' records live in the Season Archive, so this page shows the live
 * season only.
 *
 * URL state: `group` (board filter), `record` + `mode` (full list), `mine=1`
 * (only records the viewer's stable appears in), `stables=players` (#595: the
 * players' top 10 per record, each with its place among every stable; also
 * remembered on this device).
 */
import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSeasonStore, selectSeason } from '../stores/seasonStore';
import { StableFilterControl } from '../components/StableFilterControl';
import { useStableFilter } from '../hooks/useStableFilter';
import {
  RecordBoard,
  RecordDetail,
  RecordGroupTabs,
  YourPlacesStrip,
  useHallOfRecords,
  RECORD_GROUPS,
} from '../components/hall-of-records';
import type { RecordDefinition, RecordGroupKey } from '../components/hall-of-records';
import { buildRecordCatalogue, findMyPlaces, summariseMyPlaces } from '../utils/hallOfRecords';
import type { SeasonState } from '../utils/seasonApi';

function isGroup(value: string | null): value is RecordGroupKey {
  return value !== null && (RECORD_GROUPS as readonly string[]).includes(value);
}

function seasonLine(season: SeasonState | null): string {
  if (!season) return 'This season’s records';
  const name = season.isLegacy ? 'Season 0' : `Season ${season.seasonNumber}`;
  if (season.phase === 'competitive') {
    return `${name} records · cycle ${season.seasonCycle} of ${season.seasonLengthCycles}`;
  }
  if (season.phase === 'preparation') return `${name} records · preparation`;
  return `${name} records`;
}

function HallOfRecordsPage() {
  const { user } = useAuth();
  const season = useSeasonStore(selectSeason);
  const [stables, setStables] = useStableFilter();
  const { records, loading, failed, reload } = useHallOfRecords(stables);
  const [params, setParams] = useSearchParams();
  // What the payload on screen is, which lags the control while the other loads.
  const playersOnly = records?.stables === 'players';

  const viewerId = user?.id ?? null;
  const groupParam = params.get('group');
  const activeGroup = isGroup(groupParam) ? groupParam : null;
  const recordKey = params.get('record');
  const onlyMine = params.get('mine') === '1';

  const catalogue = useMemo(
    () => (records ? buildRecordCatalogue(records).filter((record) => record.variants.length > 0) : []),
    [records],
  );
  const places = useMemo(() => findMyPlaces(catalogue, viewerId), [catalogue, viewerId]);
  const summary = useMemo(() => summariseMyPlaces(places), [places]);

  /** Board link for a record: its leaderboard page, or its full list here. */
  const detailHref = useCallback((record: RecordDefinition, variantKey?: string): string => {
    if (record.leaderboard) return record.leaderboard.href;
    const next = new URLSearchParams();
    if (activeGroup) next.set('group', activeGroup);
    next.set('record', record.key);
    if (variantKey) next.set('mode', variantKey);
    return `/hall-of-records?${next.toString()}`;
  }, [activeGroup]);

  const backHref = activeGroup ? `/hall-of-records?group=${activeGroup}` : '/hall-of-records';

  const setFilter = useCallback((changes: { group?: RecordGroupKey | null; mine?: boolean }) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('record');
      next.delete('mode');
      if (changes.group !== undefined) {
        if (changes.group) next.set('group', changes.group);
        else next.delete('group');
      }
      if (changes.mine !== undefined) {
        if (changes.mine) next.set('mine', '1');
        else next.delete('mine');
      }
      return next;
    });
  }, [setParams]);

  if (!user) return null;

  const detailRecord = recordKey ? catalogue.find((record) => record.key === recordKey && !record.leaderboard) : undefined;
  const myRecordKeys = new Set(places.map((place) => place.recordKey));
  const boardRecords = catalogue.filter((record) =>
    (!activeGroup || record.group === activeGroup) && (!onlyMine || myRecordKeys.has(record.key)),
  );
  const availableGroups = RECORD_GROUPS.filter((group) => catalogue.some((record) => record.group === group));
  const stableName = user.stableName || user.username;

  return (
    <div className="min-h-screen bg-background pb-24 text-white lg:pb-8">
      <div className="container mx-auto max-w-[1400px] px-4 py-8" data-testid="hall-of-records">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Hall of Records</h1>
            <p className="mt-1 text-sm text-secondary">
              {seasonLine(season)} · updated after every cycle
            </p>
          </div>
          {/* Phones: the Stables control first and full width; from sm both on one line, the control last. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
            <div className="sm:order-2">
              <StableFilterControl value={stables} onChange={setStables} />
            </div>
            <Link to="/seasons" className="inline-flex min-h-[44px] items-center text-sm text-primary hover:underline sm:order-1">
              Past seasons: Season Archive ›
            </Link>
          </div>
        </header>

        {loading && !records && (
          <p className="py-20 text-center text-secondary" role="status">Loading records…</p>
        )}

        {failed && !records && (
          <div className="rounded-lg border border-error bg-error/10 p-6 text-center" role="alert">
            <p className="text-error">Failed to load the Hall of Records.</p>
            <button
              type="button"
              onClick={reload}
              className="mt-4 min-h-[44px] rounded-lg bg-surface-elevated px-6 text-white hover:bg-surface"
            >
              Retry
            </button>
          </div>
        )}

        {records && catalogue.length === 0 && playersOnly && (
          <div className="rounded-lg border border-white/10 bg-surface p-8 text-center" data-testid="records-empty-players">
            <p className="text-white">No player holds a record place yet this season.</p>
            <p className="mt-2 text-sm text-secondary">
              <button type="button" onClick={() => setStables('all')} className="inline-flex min-h-[44px] items-center text-primary hover:underline">
                Show all stables
              </button>
            </p>
          </div>
        )}

        {records && catalogue.length === 0 && !playersOnly && (
          <div className="rounded-lg border border-white/10 bg-surface p-8 text-center" data-testid="records-empty">
            <p className="text-white">No records yet this season.</p>
            <p className="mt-2 text-sm text-secondary">
              Records appear once the season’s first battles are fought. Last season’s records are in the{' '}
              <Link to="/seasons" className="text-primary hover:underline">Season Archive</Link>.
            </p>
          </div>
        )}

        {records && catalogue.length > 0 && detailRecord && (
          <RecordDetail
            record={detailRecord}
            siblings={catalogue.filter((record) => record.group === detailRecord.group)}
            variantKey={params.get('mode')}
            viewerId={viewerId}
            backHref={backHref}
            detailHref={detailHref}
            playersOnly={playersOnly}
            {...(playersOnly ? { notInListNote: 'Your stable is not in the players’ top 10 yet.' } : {})}
          />
        )}

        {records && catalogue.length > 0 && !detailRecord && (
          <div className="space-y-6">
            <YourPlacesStrip
              stableName={stableName}
              summary={summary}
              onlyMine={onlyMine}
              onToggleOnlyMine={() => setFilter({ mine: !onlyMine })}
              playersOnly={playersOnly}
            />
            {playersOnly && (
              <p className="text-sm text-secondary" data-testid="records-players-note">
                Each record lists the players’ top 10. Places count every stable, so they don’t change when you
                filter.{' '}
                <button type="button" onClick={() => setStables('all')} className="inline-flex min-h-[44px] items-center align-middle text-primary hover:underline">
                  Show all stables
                </button>
              </p>
            )}
            <RecordGroupTabs
              active={activeGroup}
              available={availableGroups}
              onSelect={(group) => setFilter({ group })}
            />
            {boardRecords.length > 0 ? (
              <RecordBoard
                records={boardRecords}
                groups={RECORD_GROUPS}
                viewerId={viewerId}
                places={places}
                detailHref={detailHref}
                collapseOnMobile={!activeGroup && !onlyMine}
                showPlaces={playersOnly}
              />
            ) : (
              <p className="py-10 text-center text-secondary" data-testid="records-none-mine">
                {`Your stable has no ${playersOnly ? 'players’ top-10' : 'top-10'} place${activeGroup ? ' in this group' : ''} yet.`}
              </p>
            )}
          </div>
        )}

        {records && catalogue.length > 0 && (
          <p className="mt-10 text-xs text-secondary">
            Robot and stable names open their profiles. Records reset when a season ends; each season’s
            records stay in the Season Archive.
          </p>
        )}
      </div>
    </div>
  );
}

export default HallOfRecordsPage;
