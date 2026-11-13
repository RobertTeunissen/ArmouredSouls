import AutomatonBadge from '../AutomatonBadge';
import type { StableType } from '../../types/stable';
import { categoryLabel } from '../../utils/seasonFormat';
import { formatMonthYear } from '../../utils/stableViewFormat';
import type { StableUser } from './types';
import type { SeasonState, StableAccolade } from '@shared/types';

interface StableHeaderProps {
  user: StableUser;
  robotCount: number;
  season: SeasonState | null;
  accolades: readonly StableAccolade[];
}

/** First places shown as header chips; the trophy cabinet lists the rest. */
const HEADER_ACCOLADE_LIMIT = 2;

function seasonLine(season: SeasonState | null): string | null {
  if (!season) return null;
  if (season.phase === 'preparation') return `Season ${season.seasonNumber}, preparation day ${season.preparationDay}`;
  if (season.isLegacy) return `Season ${season.seasonNumber}, cycle ${season.seasonCycle}`;
  return `Season ${season.seasonNumber}, cycle ${season.seasonCycle} of ${season.seasonLengthCycles}`;
}

function titleChips(user: StableUser): string[] {
  const perFormat: Array<[number | undefined, string]> = [
    [user.championshipTitles1v1, '1v1'],
    [user.championshipTitles2v2, '2v2'],
    [user.championshipTitles3v3, '3v3'],
  ];
  const chips = perFormat
    .filter(([count]) => (count ?? 0) > 0)
    .map(([count, format]) => `${count}× ${format} Tournament champion`);
  // Older responses carry only the total.
  if (chips.length === 0 && user.championshipTitles > 0) {
    chips.push(`${user.championshipTitles}× Tournament champion`);
  }
  return chips;
}

export function StableHeader({ user, robotCount, season, accolades }: StableHeaderProps) {
  const displayName = user.stableName || user.username;
  const firstPlaces = accolades.filter((a) => a.rank === 1).slice(0, HEADER_ACCOLADE_LIMIT);
  const meta = [
    user.stableName && user.stableName !== user.username ? user.username : null,
    user.memberSince ? `Member since ${formatMonthYear(user.memberSince)}` : null,
    seasonLine(season),
  ].filter((part): part is string => part !== null);
  const chips = titleChips(user);

  return (
    <section className="rounded-lg border border-white/10 bg-surface p-5 sm:p-6" aria-labelledby="stable-name">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 id="stable-name" className="text-2xl font-bold sm:text-3xl">
              <StableHeadingName name={displayName} stableType={user.stableType} />
            </h2>
            <span className="rounded-full bg-info/15 px-3 py-0.5 text-sm font-semibold text-info ring-1 ring-info/40">
              {user.prestigeRank}
            </span>
          </div>
          {meta.length > 0 && <p className="mt-2 text-sm text-secondary">{meta.join(' · ')}</p>}
          {(chips.length > 0 || firstPlaces.length > 0) && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Honours">
              {chips.map((chip) => (
                <li key={chip} className="rounded-full bg-warning/10 px-3 py-1 text-sm text-warning ring-1 ring-warning/40">
                  <span aria-hidden="true">🏆 </span>{chip}
                </li>
              ))}
              {firstPlaces.map((a) => (
                <li key={`${a.seasonNumber}-${a.category}-${a.mode ?? ''}`} className="rounded-full bg-surface-elevated px-3 py-1 text-sm">
                  <span aria-hidden="true">🥇 </span>#1 {categoryLabel(a.category).label} · Season {a.seasonNumber}
                </li>
              ))}
            </ul>
          )}
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-6">
          <HeaderFigure label="Prestige" value={user.prestige.toLocaleString()} className="text-primary" />
          <HeaderFigure label="Titles" value={String(user.championshipTitles)} className="text-warning" />
          <HeaderFigure label="Robots" value={String(robotCount)} className="text-white" />
        </dl>
      </div>
    </section>
  );
}

function HeaderFigure({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-secondary">{label}</dt>
      <dd className={`text-xl font-bold sm:text-2xl ${className}`}>{value}</dd>
    </div>
  );
}

/**
 * Stable heading text. For an Automaton the badge (full label, Spec #55 §18)
 * is kept on the line of the name's last word, so a wrapping heading never
 * leaves the badge on a line of its own.
 */
function StableHeadingName({ name, stableType }: { name: string; stableType?: StableType }) {
  if (stableType !== 'automaton') return <>{name}</>;
  const lastSpace = name.lastIndexOf(' ');
  const head = lastSpace >= 0 ? name.slice(0, lastSpace + 1) : '';
  const lastWord = name.slice(lastSpace + 1);
  return (
    <>
      {head}
      <span className="whitespace-nowrap">
        {lastWord} <AutomatonBadge stableType={stableType} compact={false} />
      </span>
    </>
  );
}

