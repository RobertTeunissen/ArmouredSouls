import RobotImage from '../RobotImage';
import { TierChip } from '../stable-view/TierChip';
import type { TierSummary } from '../../utils/stableViewFormat';

interface WorkshopHeaderProps {
  name: string;
  imageUrl: string | null;
  elo: number;
  summary: TierSummary | null;
  gear: string;
  currentHP: number;
  maxHP: number;
  currentShield: number;
  maxShield: number;
  /** Manual repair price for this robot (half the automatic quote); 0 when undamaged. */
  repairCost: number;
  /** Manual repair price for every damaged robot in the stable. */
  repairAllCost: number;
  damagedCount: number;
  onRepairAll: () => void;
  repairing: boolean;
  onEditImage: () => void;
}

function hpTone(pct: number): string {
  if (pct <= 0) return 'bg-error';
  if (pct < 50) return 'bg-warning';
  return 'bg-success';
}

/** Who the robot is, its condition, and repairs (only Repair all exists server-side). */
export function WorkshopHeader(props: WorkshopHeaderProps) {
  const { name, imageUrl, elo, summary, gear, currentHP, maxHP, currentShield, maxShield, repairCost, repairAllCost, damagedCount, onRepairAll, repairing, onEditImage } = props;
  const hpPct = maxHP > 0 ? Math.round((currentHP / maxHP) * 100) : 0;
  const condition = currentHP <= 0 ? 'Destroyed' : currentHP >= maxHP ? 'Fully repaired' : `${hpPct}% HP`;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-white/10 bg-surface p-4 sm:p-5 lg:flex-row lg:items-center" aria-label="Robot">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <RobotImage imageUrl={imageUrl} robotName={name} size="small" showEdit onEditClick={onEditImage} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{name}</h1>
            {summary && <TierChip summary={summary} />}
          </div>
          <p className="mt-1 text-xs text-secondary">ELO {elo.toLocaleString()} · {gear}</p>
        </div>
      </div>

      <div className="w-full lg:w-60">
        <div className="flex justify-between text-xs">
          <span className="uppercase tracking-wide text-secondary">Condition</span>
          <span className={currentHP <= 0 ? 'font-semibold text-error' : 'text-secondary'}>{condition} · {currentHP} / {maxHP} HP</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-elevated" role="img" aria-label={`Hull ${currentHP} of ${maxHP}`}>
          <div className={`h-full ${hpTone(hpPct)}`} style={{ width: `${hpPct}%` }} />
        </div>
        <p className="mt-1 text-xs text-secondary">Shield {currentShield} / {maxShield}</p>
      </div>

      <div className="w-full lg:w-72">
        {damagedCount > 0 ? (
          <button
            type="button"
            onClick={onRepairAll}
            disabled={repairing}
            className="min-h-[44px] w-full rounded-lg border border-warning/50 bg-warning/10 px-4 py-2 text-left transition-colors hover:bg-warning/20 disabled:opacity-50"
          >
            <span className="block text-sm font-semibold text-warning">
              {repairing ? 'Repairing…' : `Repair all damaged · ₡${repairAllCost.toLocaleString()}`}
            </span>
            <span className="block text-xs text-secondary">
              {repairCost > 0 ? `This robot ₡${repairCost.toLocaleString()} · ` : ''}
              {damagedCount} {damagedCount === 1 ? 'robot' : 'robots'}, half the automatic price
            </span>
          </button>
        ) : (
          <p className="rounded-lg bg-surface-elevated px-4 py-3 text-sm text-secondary">All robots fully repaired</p>
        )}
      </div>
    </section>
  );
}

export default WorkshopHeader;
