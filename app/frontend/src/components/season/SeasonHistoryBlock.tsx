/**
 * Season history block for the Stable page (Spec #45 R14).
 *
 * Gives the Stable page a persistent narrative: one collapsed row per completed
 * season, expandable to reveal the robots fielded, their final standing per
 * mode, team memberships, and the accolades the stable earned.
 *
 * Collapsed rows arrive with the initial request; expanded detail loads on
 * demand, so a stable with many seasons does not pay for all of them up front.
 *
 * Styling mirrors the Stable page's other sections (surface panels, design-
 * system tokens) and the Season Archive page's record cards, so the two views
 * of season records read identically.
 *
 * Below 1024px each season becomes a full-width card and expanded detail stacks
 * one card per robot — the per-mode standings are naturally wide data that would
 * otherwise force horizontal scrolling.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  getStableSeasonHistory,
  getStableSeasonDetail,
  type StableSeasonSummary,
  type StableSeasonDetail,
  type ArchivedAccolade,
} from '../../utils/seasonApi';
import { categoryLabel, modeLabel, rankBadge } from '../../utils/seasonFormat';
import { createLogger } from '../../utils/logger';

const log = createLogger('SeasonHistoryBlock');

interface SeasonHistoryBlockProps {
  userId: number;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section
      id="season-history"
      className="bg-surface border border-white/10 rounded-lg p-6"
      data-testid="season-history-block"
    >
      <h2 className="text-xl font-semibold text-white">Season History</h2>
      {children}
    </section>
  );
}

export function SeasonHistoryBlock({ userId }: SeasonHistoryBlockProps) {
  const [seasons, setSeasons] = useState<StableSeasonSummary[] | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, StableSeasonDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await getStableSeasonHistory(userId);
        // Guard the shape rather than trusting it: this block renders inside the
        // Stable page, and a malformed response must degrade to an empty state
        // rather than throwing during render and blanking the whole page.
        if (!cancelled) setSeasons(Array.isArray(rows) ? rows : []);
      } catch (error) {
        log.error('Failed to load season history', error);
        if (!cancelled) setSeasons([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggle = useCallback(
    async (seasonNumber: number): Promise<void> => {
      if (expanded === seasonNumber) {
        setExpanded(null);
        return;
      }
      setExpanded(seasonNumber);
      if (details[seasonNumber]) return;

      setLoadingDetail(seasonNumber);
      try {
        const detail = await getStableSeasonDetail(userId, seasonNumber);
        setDetails((prev) => ({ ...prev, [seasonNumber]: detail }));
      } catch (error) {
        log.error(`Failed to load season ${seasonNumber} detail`, error);
      } finally {
        setLoadingDetail(null);
      }
    },
    [expanded, details, userId],
  );

  if (seasons === null) {
    return (
      <Panel>
        <p className="mt-2 text-sm text-secondary">Loading…</p>
      </Panel>
    );
  }

  if (seasons.length === 0) {
    return (
      <Panel>
        <p className="mt-2 text-sm text-secondary" data-testid="season-history-empty">
          This stable&apos;s first season is in progress. Completed seasons appear here once the
          season ends.
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <ul className="mt-4 space-y-3">
        {seasons.map((s) => (
          <SeasonRow
            key={s.seasonNumber}
            summary={s}
            isOpen={expanded === s.seasonNumber}
            detail={details[s.seasonNumber]}
            loading={loadingDetail === s.seasonNumber}
            onToggle={() => void toggle(s.seasonNumber)}
          />
        ))}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Season row                                                        */
/* ------------------------------------------------------------------ */

interface SeasonRowProps {
  summary: StableSeasonSummary;
  isOpen: boolean;
  detail?: StableSeasonDetail;
  loading: boolean;
  onToggle: () => void;
}

function SeasonRow({ summary: s, isOpen, detail, loading, onToggle }: SeasonRowProps) {
  return (
    <li className="overflow-hidden rounded-lg border border-white/10 bg-surface-elevated">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        // Full-width card on mobile; 44px minimum touch target.
        className="flex w-full min-h-[44px] flex-col gap-1 p-4 text-left transition-colors hover:bg-surface lg:flex-row lg:items-center lg:justify-between"
      >
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="font-semibold text-white">
            {s.isLegacy ? 'Season 0' : `Season ${s.seasonNumber}`}
          </span>
          {s.isLegacy && (
            <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-tertiary">
              career totals
            </span>
          )}
          <span className="text-xs text-tertiary">{s.competitiveCycles} cycles</span>
        </span>

        {/* Figures wrap onto multiple lines rather than forcing a fixed grid. */}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary">
          <span>₡{s.finalCredits.toLocaleString()}</span>
          <span>{s.prestigeEarned.toLocaleString()} prestige</span>
          <span>
            {s.wins}W/{s.losses}L/{s.draws}D
          </span>
          <span>{Math.round(s.winRate * 100)}% win rate</span>
          {s.bestTier && (
            <span className="capitalize">
              {s.bestTier.tier} · {modeLabel(s.bestTier.mode)}
            </span>
          )}
          <span>{s.championshipTitles} titles</span>
          <span>
            {s.achievementsUnlocked}/{s.achievementsAvailable} achievements
          </span>
          <span className="text-primary" aria-hidden="true">
            {isOpen ? '▲' : '▼'}
          </span>
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-white/10 p-4">
          {loading && !detail && <p className="text-sm text-secondary">Loading season detail…</p>}
          {detail && <SeasonRowDetail detail={detail} isLegacy={s.isLegacy} />}
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Expanded detail                                                   */
/* ------------------------------------------------------------------ */

function SeasonRowDetail({ detail, isLegacy }: { detail: StableSeasonDetail; isLegacy: boolean }) {
  // Group accolades by (category, mode) so each card holds one coherent ranking.
  const recordGroups = useMemo(() => {
    const groups: Array<{ key: string; category: string; mode: string | null; entries: ArchivedAccolade[] }> = [];
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

  return (
    <div className="space-y-5">
      {isLegacy && (
        <p className="rounded-lg bg-surface p-3 text-xs text-secondary">
          Season 0 predates the season system, so these are career totals accumulated before
          seasons existed rather than one season&apos;s figures.
        </p>
      )}

      {/* Robots */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-tertiary">
          Robots ({detail.robots.length})
        </h3>
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {detail.robots.map((robot) => (
            <li key={robot.robotName} className="rounded-lg border border-white/10 bg-surface p-3">
              <div className="flex items-center gap-3">
                {robot.imageUrl ? (
                  <img src={robot.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  // Image was deleted from the library, or never set.
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-elevated text-tertiary"
                  >
                    ▣
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{robot.robotName}</p>
                  <p className="text-xs text-secondary">
                    ELO {robot.finalElo} · {robot.fame} fame · {robot.wins}W/{robot.losses}L/
                    {robot.draws}D
                  </p>
                </div>
              </div>

              {robot.standings.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {robot.standings.map((standing) => (
                    <li
                      key={standing.mode}
                      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded bg-surface-elevated px-2 py-1 text-xs"
                    >
                      <span className="w-6 text-center font-bold text-tertiary">
                        {rankBadge(standing.instanceRank)}
                      </span>
                      <span className="text-secondary">{modeLabel(standing.mode)}</span>
                      <span className="capitalize text-white">{standing.tier}</span>
                      <span className="font-semibold text-primary">{standing.leaguePoints} LP</span>
                      <span className="text-tertiary">{standing.leagueInstanceId}</span>
                    </li>
                  ))}
                </ul>
              )}

              {robot.teams.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-secondary">
                  {robot.teams.map((team) => (
                    <li key={team.teamName}>
                      Team <span className="text-white">{team.teamName}</span> ({team.teamSize}v
                      {team.teamSize})
                      {team.modes.map((m) => (
                        <span key={m.mode} className="ml-1">
                          · {modeLabel(m.mode)} <span className="capitalize">{m.tier}</span> #
                          {m.instanceRank}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Records */}
      {recordGroups.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-tertiary">
            Records
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recordGroups.map((g) => {
              const { icon, label } = categoryLabel(g.category);
              return (
                <div key={g.key} className="rounded-lg border border-white/10 bg-surface p-4">
                  <div className="mb-3 flex items-baseline gap-2">
                    <span aria-hidden="true">{icon}</span>
                    <h4 className="text-sm font-semibold text-white">{label}</h4>
                    {g.mode && (
                      <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-tertiary">
                        {modeLabel(g.mode)}
                      </span>
                    )}
                  </div>
                  <ol className="space-y-1.5">
                    {g.entries.map((a) => (
                      <li
                        key={`${a.rank}-${a.subjectName}-${a.valueLabel}`}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="w-6 shrink-0 text-center font-bold text-tertiary">
                          {rankBadge(a.rank)}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-white">
                          {a.subjectName}
                        </span>
                        <span className="shrink-0 text-right text-secondary">
                          {a.value !== 0 ? `${a.value} ` : ''}
                          {a.valueLabel}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default SeasonHistoryBlock;
