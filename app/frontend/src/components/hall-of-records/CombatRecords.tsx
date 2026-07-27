import { useMemo, useState } from 'react';
import { RecordSection } from './RecordSection';
import { RecordCard } from './RecordCard';
import {
  DAMAGE_RECORD_MODES,
  DAMAGE_RECORD_MODE_LABELS,
  type DamageRecordMode,
  type RecordsData,
} from './types';

export interface CombatRecordsProps {
  records: RecordsData;
  formatDuration: (seconds: number) => string;
  formatDate: (dateString: string) => string;
  onBattleClick: (battleId: number) => void;
}

/**
 * Combat tab of the Hall of Records.
 *
 * Spec #46 removed Fastest Victory and Longest Battle: `MAX_BATTLE_DURATION`
 * forces a draw at the cap, so every Longest Battle entry reported the same
 * 2:00, and any duration-derived replacement inherits that ceiling.
 *
 * Most Damage is scoped per mode (R4.5). A single overall ranking measured which
 * mode has the most targets rather than which robot hit hardest — a Grand Melee
 * robot swings at 19 opponents over the clock a 1v1 robot spends on one. On
 * narrow viewports the modes collapse into a switcher above a single list rather
 * than six stacked sections.
 */
export function CombatRecords({ records, formatDuration, formatDate, onBattleClick }: CombatRecordsProps) {
  // Memoised so the `?? {}` fallback does not produce a fresh object identity on
  // every render, which would defeat the memo below.
  const damageByMode = useMemo(
    () => records.combat.mostDamageInBattle ?? {},
    [records.combat.mostDamageInBattle],
  );

  // Only offer modes that actually have entries, so the switcher never leads to
  // an empty list.
  const populatedModes = useMemo(
    () => DAMAGE_RECORD_MODES.filter((mode) => (damageByMode[mode]?.length ?? 0) > 0),
    [damageByMode],
  );

  const [selectedMode, setSelectedMode] = useState<DamageRecordMode | null>(null);
  const activeMode = selectedMode && populatedModes.includes(selectedMode)
    ? selectedMode
    : populatedModes[0] ?? null;

  const activeEntries = activeMode ? damageByMode[activeMode] ?? [] : [];

  return (
    <>
      {activeMode && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-secondary mb-4">💥 Most Damage in Single Battle</h2>
          <div
            className="flex flex-wrap gap-2 mb-6"
            role="tablist"
            aria-label="Most damage battle mode"
          >
            {populatedModes.map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={mode === activeMode}
                onClick={() => setSelectedMode(mode)}
                data-testid={`damage-mode-${mode}`}
                className={[
                  'min-h-[44px] px-4 rounded text-sm font-semibold transition-colors',
                  mode === activeMode
                    ? 'bg-warning text-black'
                    : 'bg-surface border border-white/10 text-secondary hover:bg-surface-elevated',
                ].join(' ')}
              >
                {DAMAGE_RECORD_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeEntries.map((record, index) => (
              <RecordCard
                key={record.battleId}
                rank={index + 1}
                value={`${record.damageDealt.toLocaleString()} damage`}
                description={
                  record.opponent
                    ? `${record.robot.name} vs ${record.opponent.name}`
                    : `${record.robot.name} — ${DAMAGE_RECORD_MODE_LABELS[activeMode]}`
                }
                details={[
                  `Robot: ${record.robot.username}`,
                  `Duration: ${formatDuration(record.durationSeconds)}`,
                  `Date: ${formatDate(record.date)}`,
                ]}
                onClick={() => onBattleClick(record.battleId)}
              />
            ))}
          </div>
        </div>
      )}

      {records.combat.narrowestVictory.length > 0 && (
        <RecordSection title="🎯 Narrowest Victory">
          {records.combat.narrowestVictory.map((record, index) => (
            <RecordCard
              key={record.battleId}
              rank={index + 1}
              value={`${record.remainingHP} HP remaining`}
              description={`${record.winner.name} barely survived against ${record.loser.name}`}
              details={[
                `Winner: ${record.winner.username}`,
                `Date: ${formatDate(record.date)}`,
              ]}
              onClick={() => onBattleClick(record.battleId)}
            />
          ))}
        </RecordSection>
      )}
    </>
  );
}
