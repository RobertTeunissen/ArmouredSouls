/**
 * Prestige_Tile — "am I climbing?"
 *
 * Spec #48 Requirement 3. Renders ONLY: the prestige total, prestige earned this
 * cycle, the Comparison_Figure, and progress toward the next Prestige_Gate.
 */

import React from 'react';
import {
  DashboardTile,
  DashboardTileStat,
  DashboardTileProgress,
  DashboardTileNote,
} from './DashboardTile';
import type { OverviewRowData } from './types';
import {
  getUnlockedFacilityLevel,
  getNextPrestigeThreshold,
  PRESTIGE_GATES,
} from '../../../../shared/utils/prestigeGates';

export function PrestigeTile({ data }: { data: OverviewRowData }): React.ReactElement {
  const { prestigeTotal, cycleProgress, isLoading, error } = data;

  const earned = cycleProgress?.prestigeEarned ?? 0;
  const comparison = cycleProgress?.comparison?.prestigeEarned;

  const unlockedLevel = getUnlockedFacilityLevel(prestigeTotal);
  const next = getNextPrestigeThreshold(prestigeTotal);

  const content = (
    <>
      <DashboardTileStat
        label="Stable prestige"
        value={prestigeTotal.toLocaleString()}
        signMeaning="no-meaning"
      />

      {/* Requirement 3 criterion 2: rendered as `0` when zero, because a
          Current_Cycle total of zero is a known figure rather than an absent one. */}
      <DashboardTileStat
        label="Earned"
        value={earned.toLocaleString()}
        comparison={comparison !== undefined ? { value: comparison.toLocaleString() } : undefined}
        delta={comparison !== undefined ? earned - comparison : undefined}
        signMeaning="higher-is-better"
      />

      {next === null ? (
        // Requirement 3 criterion 6: at the top of the curve there is no remaining
        // figure and no bar to draw, so state the level reached instead.
        <DashboardTileNote
          message={`All facility levels unlocked (level ${unlockedLevel}).`}
        />
      ) : (
        <PrestigeGateProgress
          prestigeTotal={prestigeTotal}
          unlockedLevel={unlockedLevel}
          required={next.required}
        />
      )}
    </>
  );

  return (
    <DashboardTile
      title="Prestige"
      periodNote="This cycle, compared with last"
      isLoading={isLoading}
      error={error}
      content={content}
      loadingRows={3}
    />
  );
}

/**
 * Progress toward the next Prestige_Gate.
 *
 * Requirement 3 criterion 4: the filled proportion is
 * `(total − currentGateThreshold) / (required − currentGateThreshold)`, as a whole
 * percentage clamped to 0–100. Measuring from the current gate rather than from zero
 * is what makes the bar move visibly between gates instead of crawling.
 */
function PrestigeGateProgress({
  prestigeTotal,
  unlockedLevel,
  required,
}: {
  prestigeTotal: number;
  unlockedLevel: number;
  required: number;
}): React.ReactElement {
  const currentGateThreshold = PRESTIGE_GATES[unlockedLevel - 1] ?? 0;
  const span = required - currentGateThreshold;
  const progressed = prestigeTotal - currentGateThreshold;

  const percent =
    span <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((progressed / span) * 100)));

  const remaining = Math.max(0, required - prestigeTotal);

  return (
    <DashboardTileProgress
      label={`To facility level ${unlockedLevel + 1}`}
      percent={percent}
      valueText={`${remaining.toLocaleString()} to go`}
    />
  );
}
