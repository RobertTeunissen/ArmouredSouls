/**
 * Season_Summary_Modal (Spec #45 R15).
 *
 * Shown once per season to a returning player after a rollover, so the reset is
 * acknowledged rather than silent — a player who logs in to an empty stable
 * with no explanation would reasonably think something broke.
 *
 * Fits a 320×568 viewport with its own scroll area and a dismiss control that
 * stays reachable without scrolling.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getSeasonSummary,
  markSeasonSummarySeen,
  type SeasonSummary,
} from '../../utils/seasonApi';
import { useSeasonStore, selectSeason } from '../../stores/seasonStore';
import { createLogger } from '../../utils/logger';

const log = createLogger('SeasonSummaryModal');

export function SeasonSummaryModal() {
  const [summary, setSummary] = useState<SeasonSummary | null>(null);
  const [open, setOpen] = useState(false);
  const season = useSeasonStore(selectSeason);

  useEffect(() => {
    // Same reasoning as the season store: the endpoint is authenticated, so
    // skip it entirely without a token rather than firing a doomed request from
    // the app shell on every mount.
    if (typeof localStorage !== 'undefined' && !localStorage.getItem('token')) return;

    let cancelled = false;
    void (async () => {
      try {
        const result = await getSeasonSummary();
        if (!cancelled && result) {
          setSummary(result);
          setOpen(true);
        }
      } catch (error) {
        // No modal is better than a broken one.
        log.error('Failed to load season summary', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = async (): Promise<void> => {
    setOpen(false);
    if (!summary) return;
    try {
      await markSeasonSummarySeen(summary.seasonNumber);
    } catch (error) {
      log.error('Failed to record season summary as seen', error);
    }
  };

  if (!open || !summary) return null;

  const record = `${summary.wins}W / ${summary.losses}L / ${summary.draws}D`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="season-summary-title"
      data-testid="season-summary-modal"
    >
      <div className="flex max-h-[95vh] w-full max-w-lg flex-col rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
        {/* Header stays fixed so the dismiss control is always reachable. */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-700 p-4">
          <h2 id="season-summary-title" className="text-lg font-semibold text-white">
            {summary.isLegacy
              ? 'Season 0 archived'
              : `Season ${summary.seasonNumber} archived`}
          </h2>
          <button
            type="button"
            onClick={() => void dismiss()}
            className="min-h-[44px] min-w-[44px] shrink-0 rounded text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close season summary"
          >
            ✕
          </button>
        </div>

        {/* Body scrolls, so a 568px-tall viewport never clips the footer. */}
        <div className="flex-1 overflow-y-auto p-4 text-sm text-slate-300">
          {summary.isLegacy && (
            <p className="mb-3 rounded bg-slate-800/60 p-2 text-xs text-slate-400">
              Season 0 covers everything before the season system existed, so these are
              career totals rather than one season&apos;s figures.
            </p>
          )}

          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Final credits</dt>
              <dd className="text-white">₡{summary.finalCredits.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Prestige</dt>
              <dd className="text-white">{summary.prestigeEarned.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Record</dt>
              <dd className="text-white">{record}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Best tier</dt>
              <dd className="capitalize text-white">
                {summary.bestTier
                  ? `${summary.bestTier.tier} (${summary.bestTier.mode.replace(/_/g, ' ')})`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Achievements</dt>
              <dd className="text-white">
                {summary.achievementsUnlocked} / {summary.achievementsAvailable}
              </dd>
            </div>
          </dl>

          {summary.accolades.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-1 text-xs uppercase tracking-wide text-slate-500">
                Notable placements
              </h3>
              <ul className="space-y-1">
                {summary.accolades.map((a) => (
                  <li key={`${a.category}-${a.rank}`} className="text-slate-300">
                    #{a.rank} {a.category.replace(/([A-Z])/g, ' $1').toLowerCase()} —{' '}
                    <span className="text-white">{a.subjectName}</span> (
                    {a.value !== 0 ? `${a.value} ` : ''}
                    {a.valueLabel})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {season?.phase === 'preparation' && (
            <p className="mt-4 rounded bg-amber-950/50 p-2 text-amber-100">
              A new season is being prepared. Competitive battles resume in{' '}
              {season.remainingPreparationCycles} cycle(s) — build your stable now.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-700 p-4 sm:flex-row sm:justify-between">
          <Link
            to="/changelog"
            onClick={() => void dismiss()}
            className="flex min-h-[44px] items-center justify-center rounded border border-slate-600 px-4 text-slate-200 hover:bg-slate-800"
          >
            What changed this season
          </Link>
          <button
            type="button"
            onClick={() => void dismiss()}
            className="min-h-[44px] rounded bg-cyan-700 px-4 font-medium text-white hover:bg-cyan-600"
          >
            Start building
          </button>
        </div>
      </div>
    </div>
  );
}

export default SeasonSummaryModal;
