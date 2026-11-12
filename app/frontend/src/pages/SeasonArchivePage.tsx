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
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  listSeasons,
  getSeasonDetail,
} from '../utils/seasonApi';
import AutomatonBadge from '../components/AutomatonBadge';
import { SeasonArchiveRecords } from '../components/season/SeasonArchiveRecords';
import { createLogger } from '../utils/logger';
import { modeLabel, rankBadge, formatDate } from '../utils/seasonFormat';
import type { SeasonDetail, SeasonListEntry, SnapshotEntry } from '@shared/types';

const log = createLogger('SeasonArchivePage');

function SeasonArchivePage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [seasons, setSeasons] = useState<SeasonListEntry[] | null>(null);
  const [details, setDetails] = useState<Record<number, SeasonDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);

  // The open season and record live in the URL, so a record list can be linked
  // to: `/seasons?season=2&record=mostKills&mode=...`.
  const seasonParam = params.get('season');
  const selected = seasonParam !== null && /^\d+$/.test(seasonParam) ? Number(seasonParam) : null;

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

  // Load the open season's detail once (also when the page opens on a link).
  const hasDetail = selected !== null && details[selected] !== undefined;
  useEffect(() => {
    if (selected === null || hasDetail) return;
    let cancelled = false;
    setLoadingDetail(true);
    void (async () => {
      try {
        const detail = await getSeasonDetail(selected);
        if (!cancelled) setDetails((prev) => ({ ...prev, [selected]: detail }));
      } catch (error) {
        log.error(`Failed to load season ${selected}`, error);
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, hasDetail]);

  const select = useCallback(
    (seasonNumber: number): void => {
      setParams(selected === seasonNumber ? {} : { season: String(seasonNumber) });
    },
    [selected, setParams],
  );

  return (
    <div className="min-h-screen bg-background pb-24 text-white lg:pb-8">
      <div className="container mx-auto max-w-[1400px] px-4 py-8">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Season Archive</h1>
            <p className="mt-1 text-sm text-secondary">
              Completed seasons, their final standings, and the records they produced.
            </p>
          </div>
          <Link to="/hall-of-records" className="inline-flex min-h-[44px] items-center text-sm text-primary hover:underline">
            This season: Hall of Records ›
          </Link>
        </header>

        {seasons === null && <p className="mt-6 text-secondary">Loading…</p>}

        {seasons !== null && seasons.length === 0 && (
          <div
            className="mt-6 rounded-lg border border-white/10 bg-surface p-6 text-secondary"
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
                onToggle={() => select(s.seasonNumber)}
                myName={myName}
                viewerId={user?.id ?? null}
                mineOnly={mineOnly}
                onMineOnlyChange={setMineOnly}
                recordKey={selected === s.seasonNumber ? params.get('record') : null}
                modeKey={selected === s.seasonNumber ? params.get('mode') : null}
              />
            ))}
          </ul>
        )}

        {user && (
          <p className="mt-8 text-xs text-secondary">
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
  viewerId: number | null;
  mineOnly: boolean;
  onMineOnlyChange: (v: boolean) => void;
  recordKey: string | null;
  modeKey: string | null;
}

function SeasonCard({
  season: s,
  isOpen,
  detail,
  loading,
  onToggle,
  myName,
  viewerId,
  mineOnly,
  onMineOnlyChange,
  recordKey,
  modeKey,
}: SeasonCardProps) {
  return (
    <li className="overflow-hidden rounded-lg border border-white/10 bg-surface">
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
        <div className="border-t border-white/10 p-4">
          {loading && !detail && <p className="text-sm text-secondary">Loading season detail…</p>}
          {detail && (
            <SeasonDetailView
              detail={detail}
              myName={myName}
              viewerId={viewerId}
              mineOnly={mineOnly}
              onMineOnlyChange={onMineOnlyChange}
              recordKey={recordKey}
              modeKey={modeKey}
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
  viewerId: number | null;
  mineOnly: boolean;
  onMineOnlyChange: (v: boolean) => void;
  recordKey: string | null;
  modeKey: string | null;
}

function SeasonDetailView({ detail, myName, viewerId, mineOnly, onMineOnlyChange, recordKey, modeKey }: DetailProps) {
  const isMine = useCallback(
    (stableName: string, isGenerated: boolean): boolean =>
      !!myName && !isGenerated && stableName === myName,
    [myName],
  );

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
  const nothingHere = standingModes.length === 0 && detail.accolades.length === 0;

  return (
    <div className="space-y-6">
      {/* Toolbar: find-my-stable controls */}
      {myName && !nothingHere && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-elevated px-3 py-2">
          <span className="text-xs text-secondary">
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

      {/* Final standings — top 100 per mode, ranked by LP */}
      {visibleStandings.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-medium text-white">Final Standings</h2>
          <p className="mb-4 text-xs text-secondary">Top 100 per league, ranked by League Points.</p>
          <div className="space-y-6">
            {visibleStandings.map(([mode, rows]) => (
              <div key={mode} className="overflow-hidden rounded-lg border border-white/10">
                <div className="bg-surface-elevated px-4 py-2.5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
                    {modeLabel(mode)}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-surface text-left text-secondary">
                        <th className="w-12 px-3 py-2 text-center">#</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Stable</th>
                        <th className="px-3 py-2">Tier</th>
                        <th className="px-3 py-2 text-right">LP</th>
                        <th className="px-3 py-2 text-right">W/L/D</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <StandingRow
                          key={`${row.modeRank}-${row.entityName}`}
                          row={row}
                          mine={isMine(row.stableName, row.isGeneratedSubject)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Records, in the Hall of Records tiles and top-10 list */}
      <SeasonArchiveRecords
        detail={detail}
        myName={myName}
        viewerId={viewerId}
        mineOnly={mineOnly}
        recordKey={recordKey}
        modeKey={modeKey}
      />

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
    <tr
      className={`border-b border-white/5 ${
        mine ? 'border-l-4 border-l-primary bg-primary/10' : 'even:bg-surface-elevated/50'
      }`}
    >
      <td className="w-12 px-3 py-2 text-center font-bold text-secondary">
        {rankBadge(row.modeRank)}
      </td>
      <td className="px-3 py-2">
        <span className="font-medium text-white">{row.entityName}</span>
        {/* Same chips as the Hall of Records rows. */}
        {mine && (
          <span className="ml-2 rounded bg-primary px-1.5 text-[10px] font-semibold uppercase leading-4 text-background">
            You
          </span>
        )}
        {row.isGeneratedSubject && (
          <span className="ml-2 rounded bg-surface-elevated px-1 text-[10px] uppercase leading-4 text-secondary">
            bot
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-secondary">
        {row.subjectStableType === 'automaton' ? (
          // A long name shortens with "…" instead of widening the table; the
          // badge stays right after it on the same line (R12.2, design §18).
          <span className="inline-flex max-w-[10rem] flex-nowrap items-center gap-1 align-middle sm:max-w-[16rem]">
            <span className="min-w-0 truncate">{row.stableName}</span>
            <AutomatonBadge stableType={row.subjectStableType} size="sm" className="shrink-0" />
          </span>
        ) : (
          row.stableName
        )}
      </td>
      <td className="px-3 py-2 capitalize text-secondary">{row.tier}</td>
      <td className="px-3 py-2 text-right font-semibold text-primary">{row.leaguePoints}</td>
      <td className="px-3 py-2 text-right text-secondary">
        {row.wins}/{row.losses}/{row.draws}
      </td>
    </tr>
  );
}

export default SeasonArchivePage;
