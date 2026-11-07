import { getTierColor } from '../../utils/tierHelpers';
import { tierSummaryLabel, type TierSummary } from '../../utils/stableViewFormat';

interface TierChipProps {
  summary: TierSummary | null;
}

/** A robot's highest tier over every mode, e.g. "Champion ×3". */
export function TierChip({ summary }: TierChipProps) {
  if (!summary) {
    return <span className="text-xs text-tertiary">Not played</span>;
  }
  const label = tierSummaryLabel(summary);
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full bg-current/10 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-current/30 ${getTierColor(summary.tier)}`}
      title={summary.modeCount > 1 ? `Highest tier, held in ${summary.modeCount} modes` : 'Highest tier'}
      data-testid="tier-chip"
    >
      {label}
    </span>
  );
}

export default TierChip;
