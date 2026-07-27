import { RecordSection } from './RecordSection';
import { RecordCard } from './RecordCard';
import {
  WIN_STREAK_MODES,
  WIN_STREAK_MODE_LABELS,
  type RecordsData,
} from './types';

export interface WinStreakRecordsProps {
  records: RecordsData;
}

/**
 * Longest league win streaks (Spec #46 R7).
 *
 * All four League_Modes render side by side in one grouped section rather than
 * being scattered across the existing per-mode tabs, so a player can compare a
 * 1v1 streak against a Tag Team streak without switching tabs — which is the
 * whole point of the category.
 *
 * `RecordCard` is deliberately rendered without `onClick`: a streak spans many
 * battles and no single battle represents it, so there is nowhere to navigate.
 */
export function WinStreakRecords({ records }: WinStreakRecordsProps) {
  const streaks = records.winStreaks ?? {};
  const populatedModes = WIN_STREAK_MODES.filter((mode) => (streaks[mode]?.length ?? 0) > 0);

  if (populatedModes.length === 0) {
    return (
      <p className="text-tertiary" data-testid="win-streaks-empty">
        No win streaks recorded yet.
      </p>
    );
  }

  return (
    <>
      {populatedModes.map((mode) => (
        <RecordSection
          key={mode}
          title={`🔥 Longest Win Streak — ${WIN_STREAK_MODE_LABELS[mode]}`}
          subtitle="Best streak ever achieved. An active streak is still running."
        >
          {(streaks[mode] ?? []).map((record, index) => (
            <RecordCard
              key={record.entityId}
              rank={index + 1}
              value={`${record.bestWinStreak} wins in a row`}
              description={`${record.entityName} by ${record.username}`}
              details={[
                record.isActive
                  ? `🔴 Active — currently on ${record.currentWinStreak}`
                  : `Current streak: ${record.currentWinStreak}`,
                `Total wins: ${record.wins}`,
              ]}
            />
          ))}
        </RecordSection>
      ))}
    </>
  );
}
