import { getNextPrestigeThreshold } from '../../shared/utils/prestigeGates';
import type { PrestigeMilestoneForecast, SourceProvenance } from '../../types';

export interface PrestigeCycleSample {
  cycleNumber: number;
  positiveAward: number;
}

export function calculatePrestigeMilestoneForecast(
  currentPrestige: number,
  samples: readonly PrestigeCycleSample[],
  provenance: SourceProvenance,
): PrestigeMilestoneForecast {
  const latest = [...samples]
    .sort((left, right) => right.cycleNumber - left.cycleNumber)
    .slice(0, 7);
  const nextGate = getNextPrestigeThreshold(currentPrestige);
  const positivePrestigeAwarded = latest.reduce(
    (total, sample) => total + Math.max(0, sample.positiveAward),
    0,
  );
  const average = latest.length > 0 ? positivePrestigeAwarded / latest.length : null;
  const remaining = nextGate ? Math.max(0, nextGate.required - currentPrestige) : null;
  let status: PrestigeMilestoneForecast['status'];
  if (!nextGate) status = 'no_next_gate';
  else if (latest.length === 0) status = 'insufficient_history';
  else if (average === null || average <= 0) status = 'no_positive_pace';
  else status = 'available';

  return {
    provenance,
    currentPrestige,
    nextGatePrestige: nextGate?.required ?? null,
    remainingPrestige: remaining,
    completedCyclesSampled: latest.length,
    positivePrestigeAwarded,
    averagePerCompletedCycle: average,
    estimatedCycles: status === 'available' && remaining !== null && average !== null
      ? Math.ceil(remaining / average)
      : null,
    status,
  };
}
