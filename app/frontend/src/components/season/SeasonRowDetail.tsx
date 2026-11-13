/**
 * Expanded detail of one archived season on the stable page (Spec #45 R14,
 * stable page revamp). Laid out like the live page at that point: the same
 * headline figures, the same roster strip (highest tier over every mode and
 * the tier per mode), then teams and Hall of Records placements.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ModeStrip } from '../stable-view/ModeStrip';
import { TierChip } from '../stable-view/TierChip';
import { categoryLabel, rankBadge } from '../../utils/seasonFormat';
import { getTierName } from '../../utils/tierHelpers';
import {
  archivedModeCells,
  bestFinish,
  modeShortLabel,
  recordPlacements,
  seasonTeams,
  tierSummary,
  tournamentWins,
} from '../../utils/stableViewFormat';
import type { StableSeasonDetail } from '@shared/types';

/** Placements shown before "more". */
const RECORD_CHIP_LIMIT = 4;

export function SeasonRowDetail({ detail }: { detail: StableSeasonDetail }) {
  const [showAllRecords, setShowAllRecords] = useState(false);

  const roster = useMemo(
    () => detail.robots
      .map((robot) => {
        const cells = archivedModeCells(robot);
        return { robot, cells, summary: tierSummary(cells), finish: bestFinish(robot) };
      })
      .sort((a, b) => b.robot.finalElo - a.robot.finalElo),
    [detail.robots],
  );
  const teams = useMemo(() => seasonTeams(detail.robots), [detail.robots]);
  const records = useMemo(() => recordPlacements(detail.accolades), [detail.accolades]);
  const tournaments = useMemo(() => tournamentWins(detail.accolades), [detail.accolades]);
  const shownRecords = showAllRecords ? records : records.slice(0, RECORD_CHIP_LIMIT);

  return (
    <div className="space-y-5">
      {detail.isLegacy && (
        <p className="rounded-lg bg-surface p-3 text-xs text-secondary">
          Season 0 predates the season system, so these are career totals accumulated before
          seasons existed rather than one season&apos;s figures.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-7">
        <Figure label="Prestige earned" value={detail.prestigeEarned.toLocaleString()} className="text-primary" />
        <Figure label="Final credits" value={`₡${detail.finalCredits.toLocaleString()}`} />
        <Figure label="Record" value={`${detail.wins}–${detail.losses}–${detail.draws}`} />
        <Figure label="Win rate" value={`${(detail.winRate * 100).toFixed(1)}%`} />
        <Figure label="Highest ELO" value={detail.highestElo.toLocaleString()} />
        <Figure label="Titles" value={String(detail.championshipTitles)} className="text-warning" />
        <Figure label="Achievements" value={`${detail.achievementsUnlocked}/${detail.achievementsAvailable}`} />
      </dl>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tertiary">
          Roster · {roster.length} {roster.length === 1 ? 'robot' : 'robots'}
        </h4>
        <ul className="divide-y divide-white/5">
          {roster.map(({ robot, cells, summary, finish }) => (
            <li key={robot.robotName} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
              <span className="flex min-w-0 flex-1 basis-48 items-center gap-3">
                {robot.imageUrl ? (
                  <img src={robot.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                ) : (
                  // Image was deleted from the library, or never set.
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-elevated text-tertiary">▣</span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium text-white">{robot.robotName}</span>
                  <span className="block text-xs text-secondary">
                    ELO {robot.finalElo.toLocaleString()} · {robot.fame.toLocaleString()} fame
                  </span>
                </span>
              </span>
              <span className="flex basis-full flex-wrap items-center gap-3 sm:basis-auto">
                <TierChip summary={summary} />
                <ModeStrip cells={cells} showLabels />
              </span>
              <span className="basis-full text-xs text-secondary sm:basis-44">
                {finish
                  ? <>{finish.rank <= 3 && <span aria-hidden="true">{rankBadge(finish.rank)} </span>}Best finish: #{finish.rank} {getTierName(finish.tier)} {modeShortLabel(finish.mode)}</>
                  : 'No league finish'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {teams.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-tertiary">Teams</h4>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {teams.map((t) => (
              <li key={t.teamName}>
                <span className="text-white">{t.teamName}</span>
                <span className="text-secondary"> {t.teamSize}v{t.teamSize} · {t.members.join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(records.length > 0 || tournaments.length > 0) && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tertiary">Hall of Records</h4>
          {records.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {shownRecords.map((a) => (
                <li
                  key={`${a.category}-${a.mode ?? ''}-${a.rank}-${a.subjectName}`}
                  className={`rounded-full px-3 py-1 text-xs ${a.rank === 1 ? 'bg-warning/10 text-warning ring-1 ring-warning/40' : 'bg-surface text-white'}`}
                >
                  #{a.rank} {categoryLabel(a.category).label}
                  {a.mode && ` (${modeShortLabel(a.mode)})`} · {a.subjectName}
                </li>
              ))}
              {records.length > RECORD_CHIP_LIMIT && (
                <li>
                  <button
                    type="button"
                    onClick={() => setShowAllRecords(!showAllRecords)}
                    aria-expanded={showAllRecords}
                    className="min-h-[44px] rounded-full px-3 text-xs text-primary hover:underline"
                  >
                    {showAllRecords ? 'Show fewer' : `+${records.length - RECORD_CHIP_LIMIT} more`}
                  </button>
                </li>
              )}
            </ul>
          )}
          {tournaments.length > 0 && (
            <p className="mt-2 text-sm text-secondary">
              Tournament wins: {tournaments.map((t) => `${t.valueLabel} (${t.subjectName})`).join(' · ')}
            </p>
          )}
        </div>
      )}

      <p className="text-right text-xs">
        <Link to="/seasons" className="text-primary hover:underline">Season archive →</Link>
      </p>
    </div>
  );
}

function Figure({ label, value, className = 'text-white' }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-secondary">{label}</dt>
      <dd className={`text-base font-bold ${className}`}>{value}</dd>
    </div>
  );
}

