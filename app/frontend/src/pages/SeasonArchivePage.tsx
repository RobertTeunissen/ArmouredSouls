/**
 * Season_Archive_Page (Spec #45 R25).
 *
 * Browsable history of every completed season, so past seasons are shared game
 * history rather than something visible only on your own stable page.
 *
 * Bot entries are shown and labelled rather than hidden: bots hold most league
 * positions, so filtering them out would misrepresent where players actually
 * finished. A "show only my stable" toggle and per-row highlighting let a
 * player find their own results in what is otherwise a crowded board.
 *
 * Archived standings carry only a denormalized stable name (Spec #45 keeps no
 * foreign key so the rows survive a purge), so "mine" is matched on the stable
 * name rather than an id.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { useAuth } from '../contexts/AuthContext';
import {
  listSeasons,
  getSeasonDetail,
  type SeasonListEntry,
  type SeasonDetail,
  type SnapshotEntry,
  type ArchivedAccolade,
} from '../utils/seasonApi';
import { createLogger } from '../utils/logger';
import { categoryLabel, modeLabel, rankBadge, formatDate } from '../utils/seasonFormat';

const log = createLogger('SeasonArchivePage');

type AccoladeEntry = ArchivedAccolade & { stableName: string; isGeneratedSubject: boolean };

function SeasonArchivePage() {
  const { user } = useAuth();
  const [seasons, setSeasons] = useState<SeasonListEntry[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, SeasonDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);

  /** The player's stable identity as it appears in archived rows. */
  const myName = user ? user.stableName || user.username : null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listSeasons();
        if (!cancelled) setSeasons(rows);
      } catch (error) {
        log.error('Failed to load seasons', error);
        if (!cancelled) setSeasons([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const select = useCallback(
    async (seasonNumber: number): Promise<void> => {
      if (selected === seasonNumber) {
        setSelected(null);
        return;
      }
      setSelected(seasonNumber);
      if (details[seasonNumber]) return;

      setLoadingDetail(true);
      try {
        const detail = await getSeasonDetail(seasonNumber);
        setDetails((prev) => ({ ...prev, [seasonNumber]: detail }));
      } catch (error) {
        log.error(`Failed to load season ${seasonNumber}`, error);
      } finally {
        setLoadingDetail(false);
      }
    },
    [selected, details],
  );

  return (
    <div className="min-h-screen bg-background text-white pb-24 md:pb-8">
      <Navigation />
      <div className="container mx-auto max-w-6xl px-3 py-8 sm:px-4">
        <h1 className="text-3xl font-bold">Season Archive</h1>
        <p className="mt-1 text-sm text-secondary">
          Completed seasons, their final standings, and the records they produced.
        </p>

        {seasons === null && <p className="mt-6 text-secondary">Loading…</p>}

        {seasons !== null && seasons.length === 0 && (
          <div
            className="mt-6 rounded-lg border border-gray-700 bg-surface p-6 text-secondary"
            data-testid="season-archive-empty"
          >
            The first season is still in progress. Once it ends, its final standings and records
            appear here.
          </div>
        )}

        {seasons !== null && seasons.length > 0 && (
          <ul className="mt-6 space-y-4" data-testid="season-archive-list">
            {seasons.map((s) => (
              <SeasonCard
                key={s.seasonNumber}
                season={s}
                isOpen={selected === s.seasonNumber}
                detail={details[s.seasonNumber]}
                loading={loadingDetail && selected === s.seasonNumber}
                onToggle={() => void select(s.seasonNumber)}
                myName={myName}
                mineOnly={mineOnly}
                onMineOnlyChange={setMineOnly}
              />
            ))}
          </ul>
        )}

        {user && (
          <p className="mt-8 text-xs text-tertiary">
            Looking for your own stable&apos;s history?{' '}
            <Link to={`/stables/${user.id}`} className="text-primary hover:underline">
              Open your stable page
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Season card (header + expandable detail)                          */
/* ------------------------------------------------------------------ */

interface SeasonCardProps {
  season: SeasonListEntry;
  isOpen: boolean;
  detail?: SeasonDetail;
  loading: boolean;
  onToggle: () => void;
  myName: string | null;
  mineOnly: boolean;
  onMineOnlyChange: (v: boolean) => void;
}

function SeasonCard({
  season: s,
  isOpen,
  detail,
  loading,
  onToggle,
  myName,
  mineOnly,
  onMineOnlyChange,
}: SeasonCardProps) {
  return (
    <li className="overflow-hidden rounded-lg border border-gray-700 bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full min-h-[44px] flex-col gap-2 p-4 text-left transition-colors hover:bg-surface-elevated lg:flex-row lg:items-center lg:justify-between"
      >
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="text-xl font-bold text-white">
            {s.isLegacy ? 'Season 0' : `Season ${s.seasonNumber}`}
          </span>
          {s.isLegacy && (
            <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-tertiary">
              legacy — career totals
            </span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary">
          <span>{s.competitiveCycles} cycles</span>
          <span>
            {formatDate(s.startedAt)} – {formatDate(s.endedAt)}
          </span>
          <span>{s.humanStableCount} player stables</span>
          <span>{s.generatedStableCount} system stables</span>
          <span className="text-primary" aria-hidden="true">
            {isOpen ? '▲' : '▼'}
          </span>
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-gray-700 p-4">
          {loading && !detail && <p className="text-sm text-secondary">Loading season detail…</p>}
          {detail && (
            <SeasonDetailView
              detail={detail}
              myName={myName}
              mineOnly={mineOnly}
              onMineOnlyChange={onMineOnlyChange}
            />
          )}
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Season detail (standings + records)                               */
/* ------------------------------------------------------------------ */

interface DetailProps {
  detail: SeasonDetail;
  myName: string | null;
  mineOnly: boolean;
  onMineOnlyChange: (v: boolean) => void;
}

function SeasonDetailView({ detail, myName, mineOnly, onMineOnlyChange }: DetailProps) {
  const isMine = useCallback(
    (stableName: string, isGenerated: boolean): boolean =>
      !!myName && !isGenerated && stableName === myName,
    [myName],
  );

  // Group records by (category, mode) so each card holds one coherent ranking.
  const recordGroups = useMemo(() => {
    const groups: Array<{ key: string; category: string; mode: string | null; entries: AccoladeEntry[] }> = [];
    const index = new Map<string, number>();
    for (const a of detail.accolades) {
      const key = `${a.category}|${a.mode ?? ''}`;
      let i = index.get(key);
      if (i === undefined) {
        i = groups.length;
        index.set(key, i);
        groups.push({ key, category: a.category, mode: a.mode, entries: [] });
      }
      groups[i].entries.push(a);
    }
    for (const g of groups) g.entries.sort((x, y) => x.rank - y.rank);
    return groups;
  }, [detail.accolades]);

  const myCount = useMemo(() => {
    if (!myName) return 0;
    const inStandings = Object.values(detail.standingsByMode)
      .flat()
      .filter((r) => isMine(r.stableName, r.isGeneratedSubject)).length;
    const inRecords = detail.accolades.filter((a) => isMine(a.stableName, a.isGeneratedSubject)).length;
    return inStandings + inRecords;
  }, [detail, myName, isMine]);

  const standingModes = Object.entries(detail.standingsByMode);
  const visibleStandings = standingModes
    .map(([mode, rows]) => [mode, mineOnly ? rows.filter((r) => isMine(r.stableName, r.isGeneratedSubject)) : rows] as const)
    .filter(([, rows]) => rows.length > 0);
  const visibleRecords = recordGroups
    .map((g) => ({ ...g, entries: mineOnly ? g.entries.filter((e) => isMine(e.stableName, e.isGeneratedSubject)) : g.entries }))
    .filter((g) => g.entries.length > 0);

  const nothingHere = standingModes.length === 0 && recordGroups.length === 0;

  return (
    <div className="space-y-6">
      {/* Toolbar: find-my-stable controls */}
      {myName && !nothingHere && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-elevated px-3 py-2">
          <span className="text-xs text-tertiary">
            {myCount > 0 ? (
              <>
                <span className="font-semibold text-primary">{myCount}</span> result
                {myCount === 1 ? '' : 's'} for <span className="text-secondary">{myName}</span>
              </>
            ) : (
              <>No recorded results for {myName} this season.</>
            )}
          </span>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => onMineOnlyChange(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Show only my stable
          </label>
        </div>
      )}

      {nothingHere && (
        <p className="text-sm text-secondary">No standings or records were captured for this season.</p>
      )}

      {/* Final standings */}
      {visibleStandings.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-medium text-white">Final Standings</h2>
          <div className="space-y-5">
            {visibleStandings.map(([mode, rows]) => (
              <div key={mode}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-tertiary">
                  {modeLabel(mode)}
                </h3>
                <ul className="space-y-1.5">
                  {rows.map((row) => (
                    <StandingRow
                      key={`${row.tier}-${row.leagueInstanceId}-${row.instanceRank}-${row.entityName}`}
                      row={row}
                      mine={isMine(row.stableName, row.isGeneratedSubject)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Records */}
      {visibleRecords.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-medium text-white">Records</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleRecords.map((g) => (
              <RecordCard key={g.key} group={g} isMine={isMine} />
            ))}
          </div>
        </section>
      )}

      {mineOnly && myCount === 0 && !nothingHere && (
        <p className="text-sm text-secondary">
          You have no recorded results in this season. Turn off the filter to see everyone.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rows and cards                                                    */
/* ------------------------------------------------------------------ */

function StandingRow({ row, mine }: { row: SnapshotEntry; mine: boolean }) {
  return (
    <li
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-xs ${
        mine ? 'border border-primary bg-primary/10' : 'bg-surface-elevated'
      }`}
    >
      <span className="w-7 text-center text-sm font-bold text-tertiary">
        {rankBadge(row.instanceRank)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-medium text-white">{row.entityName}</span>
        <span className="ml-2 text-secondary">{row.stableName}</span>
        {mine && (
          <span className="ml-2 rounded bg-primary px-1 text-[10px] font-semibold uppercase text-white">
            My Stable
          </span>
        )}
        {row.isGeneratedSubject && (
          <span className="ml-2 rounded bg-surface px-1 text-[10px] uppercase text-tertiary">
            system
          </span>
        )}
      </span>
      <span className="capitalize text-tertiary">
        {row.tier} · {row.leagueInstanceId}
      </span>
      <span className="font-semibold text-primary">{row.leaguePoints} LP</span>
      <span className="text-tertiary">
        {row.wins}W/{row.losses}L/{row.draws}D
      </span>
    </li>
  );
}

interface RecordGroup {
  key: string;
  category: string;
  mode: string | null;
  entries: AccoladeEntry[];
}

function RecordCard({
  group,
  isMine,
}: {
  group: RecordGroup;
  isMine: (stableName: string, isGenerated: boolean) => boolean;
}) {
  const { icon, label } = categoryLabel(group.category);
  return (
    <div className="rounded-lg border border-gray-700 bg-surface-elevated p-4">
      <div className="mb-3 flex items-baseline gap-2">
        <span aria-hidden="true">{icon}</span>
        <h4 className="text-sm font-semibold text-white">{label}</h4>
        {group.mode && (
          <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-tertiary">
            {modeLabel(group.mode)}
          </span>
        )}
      </div>
      <ol className="space-y-1.5">
        {group.entries.map((a) => {
          const mine = isMine(a.stableName, a.isGeneratedSubject);
          return (
            <li
              key={`${a.rank}-${a.subjectName}-${a.valueLabel}`}
              className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                mine ? 'bg-primary/10 ring-1 ring-primary' : ''
              }`}
            >
              <span className="w-6 shrink-0 text-center font-bold text-tertiary">
                {rankBadge(a.rank)}
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-white">{a.subjectName}</span>
                <span className="ml-1.5 text-secondary">{a.stableName}</span>
                {a.isGeneratedSubject && (
                  <span className="ml-1.5 rounded bg-surface px-1 text-[10px] uppercase text-tertiary">
                    system
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right text-slate-300">
                {a.value !== 0 ? `${a.value} ` : ''}
                {a.valueLabel}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default SeasonArchivePage;
