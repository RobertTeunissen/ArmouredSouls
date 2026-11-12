/**
 * Season history block for the Stable page (Spec #45 R14, stable page revamp).
 *
 * The season in progress first, then one row per completed season, newest
 * first. The latest completed season opens on load; older ones load their
 * detail on demand, so a stable with many seasons does not pay for all of
 * them up front. Expanded detail is `SeasonRowDetail`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getStableSeasonHistory,
  getStableSeasonDetail,
} from '../../utils/seasonApi';
import { modeShortLabel } from '../../utils/stableViewFormat';
import { getTierName } from '../../utils/tierHelpers';
import { useSeasonStore } from '../../stores/seasonStore';
import { createLogger } from '../../utils/logger';
import { SeasonRowDetail } from './SeasonRowDetail';
import type { SeasonState, StableSeasonDetail, StableSeasonSummary } from '@shared/types';

const log = createLogger('SeasonHistoryBlock');

interface SeasonHistoryBlockProps {
  userId: number;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section
      id="season-history"
      className="rounded-lg border border-white/10 bg-surface p-5 sm:p-6"
      data-testid="season-history-block"
    >
      <h2 className="text-lg font-semibold text-white">Season History</h2>
      {children}
    </section>
  );
}

function currentSeasonText(season: SeasonState): string {
  if (season.phase === 'preparation') return `Preparation, day ${season.preparationDay}`;
  if (season.isLegacy) return `In progress · cycle ${season.seasonCycle}`;
  return `In progress · cycle ${season.seasonCycle} of ${season.seasonLengthCycles} · archived at rollover`;
}

export function SeasonHistoryBlock({ userId }: SeasonHistoryBlockProps) {
  const season = useSeasonStore((s) => s.season);
  const [seasons, setSeasons] = useState<StableSeasonSummary[] | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, StableSeasonDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);
  const [detailError, setDetailError] = useState<number | null>(null);
  const loaded = useRef(new Set<number>());

  const loadDetail = useCallback(async (seasonNumber: number): Promise<void> => {
    if (loaded.current.has(seasonNumber)) return;
    setLoadingDetail(seasonNumber);
    setDetailError(null);
    try {
      const detail = await getStableSeasonDetail(userId, seasonNumber);
      loaded.current.add(seasonNumber);
      setDetails((prev) => ({ ...prev, [seasonNumber]: detail }));
    } catch (error) {
      log.error(`Failed to load season ${seasonNumber} detail`, error);
      setDetailError(seasonNumber);
    } finally {
      setLoadingDetail(null);
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    loaded.current = new Set();
    setDetails({});
    void (async () => {
      try {
        const rows = await getStableSeasonHistory(userId);
        // Guard the shape rather than trusting it: this block renders inside the
        // Stable page, and a malformed response must degrade to an empty state
        // rather than throwing during render and blanking the whole page.
        const list = Array.isArray(rows) ? rows : [];
        if (cancelled) return;
        setSeasons(list);
        // The latest completed season is the one most visitors want to see.
        if (list.length > 0) {
          setExpanded(list[0].seasonNumber);
          void loadDetail(list[0].seasonNumber);
        }
      } catch (error) {
        log.error('Failed to load season history', error);
        if (!cancelled) setSeasons([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, loadDetail]);

  const toggle = (seasonNumber: number): void => {
    if (expanded === seasonNumber) {
      setExpanded(null);
      return;
    }
    setExpanded(seasonNumber);
    void loadDetail(seasonNumber);
  };

  const current = season && season.phase !== 'completed'
    && !(seasons ?? []).some((s) => s.seasonNumber === season.seasonNumber)
    ? season
    : null;

  if (seasons === null) {
    return (
      <Panel>
        <p className="mt-2 text-sm text-secondary">Loading…</p>
      </Panel>
    );
  }

  return (
    <Panel>
      <ul className="mt-4 space-y-3">
        {current && (
          <li className="flex min-h-[44px] flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-white/10 bg-surface-elevated p-4">
            <span className="font-semibold text-white">Season {current.seasonNumber}</span>
            <span className="text-xs text-secondary">{currentSeasonText(current)}</span>
          </li>
        )}
        {seasons.map((s) => (
          <SeasonRow
            key={s.seasonNumber}
            summary={s}
            isOpen={expanded === s.seasonNumber}
            detail={details[s.seasonNumber]}
            loading={loadingDetail === s.seasonNumber}
            failed={detailError === s.seasonNumber}
            onToggle={() => toggle(s.seasonNumber)}
          />
        ))}
      </ul>
      {seasons.length === 0 && (
        <p className="mt-3 text-sm text-secondary" data-testid="season-history-empty">
          This stable&apos;s first season is in progress. Completed seasons appear here once the
          season ends.
        </p>
      )}
    </Panel>
  );
}

interface SeasonRowProps {
  summary: StableSeasonSummary;
  isOpen: boolean;
  detail?: StableSeasonDetail;
  loading: boolean;
  failed: boolean;
  onToggle: () => void;
}

function SeasonRow({ summary: s, isOpen, detail, loading, failed, onToggle }: SeasonRowProps) {
  const panelId = `season-${s.seasonNumber}-detail`;
  return (
    <li className={`overflow-hidden rounded-lg border bg-surface-elevated ${isOpen ? 'border-primary/30' : 'border-white/10'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex min-h-[44px] w-full flex-col gap-1 p-4 text-left transition-colors hover:bg-surface lg:flex-row lg:items-center lg:justify-between"
      >
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="font-semibold text-white">Season {s.seasonNumber}</span>
          {s.isLegacy && (
            <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-tertiary">
              career totals
            </span>
          )}
          <span className="text-xs text-tertiary">
            {s.competitiveCycles} cycles{s.isLegacy ? ', before seasons existed' : ''}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary">
          <span>{s.prestigeEarned.toLocaleString()} prestige</span>
          <span>{s.championshipTitles} {s.championshipTitles === 1 ? 'title' : 'titles'}</span>
          {s.bestTier && <span>Best: {getTierName(s.bestTier.tier)} {modeShortLabel(s.bestTier.mode)}</span>}
          <span className="text-primary" aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
        </span>
      </button>

      {isOpen && (
        <div id={panelId} className="border-t border-white/10 p-4">
          {loading && !detail && <p className="text-sm text-secondary">Loading season detail…</p>}
          {failed && !detail && <p role="alert" className="text-sm text-error">Could not load this season. Close and reopen it to try again.</p>}
          {detail && <SeasonRowDetail detail={detail} />}
        </div>
      )}
    </li>
  );
}

export default SeasonHistoryBlock;
