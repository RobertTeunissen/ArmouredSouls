import { Link } from 'react-router-dom';
import RobotImage from '../RobotImage';
import AutomatonBadge from '../AutomatonBadge';
import { TierChip } from '../stable-view/TierChip';
import { categoryLabel } from '../../utils/seasonFormat';
import { formatMonthYear, modeShortLabel, type TierSummary } from '../../utils/stableViewFormat';
import type { FormItem } from '../../utils/robotProfileFormat';
import type { ProfileAccolade } from './useRobotProfile';
import type { StableType } from '../../types/stable';

interface ProfileHeaderProps {
  name: string;
  imageUrl: string | null;
  owner: { id: number; name: string; stableType?: StableType } | null;
  createdAt?: string;
  summary: TierSummary | null;
  accolades: readonly ProfileAccolade[];
  achievementCount: number;
  elo: number;
  fame: number;
  kills: number;
  battles: number;
  form: readonly FormItem[];
}

const FORM_COLOURS: Record<FormItem['kind'], string> = {
  win: 'bg-success',
  first: 'bg-warning',
  loss: 'bg-error',
  draw: 'bg-secondary',
  placement: 'bg-surface-elevated',
  unknown: 'bg-surface-elevated',
};

export function ProfileHeader(props: ProfileHeaderProps) {
  const { name, imageUrl, owner, createdAt, summary, accolades, achievementCount, elo, fame, kills, battles, form } = props;
  const best = accolades[0];

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-white/10 bg-surface p-5 sm:p-6 lg:flex-row" aria-labelledby="robot-name">
      <div className="flex min-w-0 flex-1 gap-4 sm:gap-6">
        <div className="shrink-0 sm:hidden"><RobotImage imageUrl={imageUrl} robotName={name} size="small" /></div>
        <div className="hidden shrink-0 sm:block"><RobotImage imageUrl={imageUrl} robotName={name} size="medium" /></div>
        <div className="min-w-0">
          <h1 id="robot-name" className="break-words text-2xl font-bold sm:text-3xl">{name}</h1>
          {owner && (
            <div className="mt-1 text-sm text-secondary">
              {/* flex-wrap puts the stable name on its own line before it would shrink to nothing. */}
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span>of</span>
                {/* Name and badge share one line (Spec #55); a long name truncates instead of pushing the badge down. */}
                <span className="flex max-w-full flex-nowrap items-center gap-1.5">
                  <Link to={`/stables/${owner.id}`} className="min-w-0 truncate text-primary hover:underline" title={owner.name}>{owner.name}</Link>
                  {owner.stableType === 'automaton' && <AutomatonBadge stableType={owner.stableType} compact={false} />}
                </span>
              </p>
              {createdAt && <p className="mt-0.5">fighting since {formatMonthYear(createdAt)}</p>}
            </div>
          )}
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Honours">
            {summary && <li><TierChip summary={summary} /></li>}
            {best && (
              <li className="rounded-full bg-surface-elevated px-3 py-0.5 text-xs">
                <span aria-hidden="true">🏅 </span>#{best.rank} {categoryLabel(best.category).label}{best.mode ? ` (${modeShortLabel(best.mode)})` : ''} · Season {best.seasonNumber}
              </li>
            )}
            {achievementCount > 0 && (
              <li className="rounded-full bg-surface-elevated px-3 py-0.5 text-xs">{achievementCount} {achievementCount === 1 ? 'achievement' : 'achievements'}</li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-x-6 gap-y-4 lg:w-[22rem]">
        <Figure label="ELO" value={elo.toLocaleString()} />
        <Figure label="Fame" value={fame.toLocaleString()} className="text-warning" />
        <Figure label="Destroyed" value={kills.toLocaleString()} />
        <Figure label="Battles" value={battles.toLocaleString()} />
        <div className="col-span-2">
          <div className="text-[11px] uppercase tracking-wide text-secondary">Last {form.length || 10}</div>
          {form.length > 0 ? (
            <>
              <ol className="mt-1.5 flex gap-1" aria-label="Recent results, newest first">
                {form.map((f) => (
                  <li key={f.battleId} className={`h-4 w-4 rounded-sm ${FORM_COLOURS[f.kind]}`} title={`${f.label}`}>
                    <span className="sr-only">{f.label}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-1 text-[10px] text-tertiary">green win · gold 1st · red loss · grey other</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-secondary">No battles yet</p>
          )}
        </div>
      </div>
    </section>
  );
}

function Figure({ label, value, className = 'text-white' }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-secondary">{label}</div>
      <div className={`text-xl font-bold tabular-nums sm:text-2xl ${className}`}>{value}</div>
    </div>
  );
}

export default ProfileHeader;
