import { RecordSection } from './RecordSection';
import { RecordCard } from './RecordCard';
import type { RecordsData } from './types';

export interface CombatRecordsProps {
  records: RecordsData;
  formatDuration: (seconds: number) => string;
  formatDate: (dateString: string) => string;
  onBattleClick: (battleId: number) => void;
}

export function CombatRecords({ records, formatDuration, formatDate, onBattleClick }: CombatRecordsProps) {
  return (
    <>
      {records.combat.fastestVictory.length > 0 && (
        <RecordSection title="⚡ Fastest Victory">
          {records.combat.fastestVictory.map((record, index) => (
            <RecordCard
              key={record.battleId}
              rank={index + 1}
              value={formatDuration(record.durationSeconds)}
              description={`${record.winner.name} defeated ${record.loser.name}`}
              details={[
                `Winner: ${record.winner.username}`,
                `Date: ${formatDate(record.date)}`,
              ]}
              onClick={() => onBattleClick(record.battleId)}
            />
          ))}
        </RecordSection>
      )}

      {records.combat.longestBattle.length > 0 && (
        <RecordSection title="⏱️ Longest Battle">
          {records.combat.longestBattle.map((record, index) => (
            <RecordCard
              key={record.battleId}
              rank={index + 1}
              value={formatDuration(record.durationSeconds)}
              description={`${record.winner.name} vs ${record.loser.name}`}
              details={[
                `Winner: ${record.winner.username}`,
                `Date: ${formatDate(record.date)}`,
              ]}
              onClick={() => onBattleClick(record.battleId)}
            />
          ))}
        </RecordSection>
      )}

      {records.combat.mostDamageInBattle.length > 0 && (
        <RecordSection title="💥 Most Damage in Single Battle">
          {records.combat.mostDamageInBattle.map((record, index) => (
            <RecordCard
              key={record.battleId}
              rank={index + 1}
              value={`${record.damageDealt.toLocaleString()} damage`}
              description={`${record.robot.name} vs ${record.opponent.name}`}
              details={[
                `Robot: ${record.robot.username}`,
                `Duration: ${formatDuration(record.durationSeconds)}`,
                `Date: ${formatDate(record.date)}`,
              ]}
              onClick={() => onBattleClick(record.battleId)}
            />
          ))}
        </RecordSection>
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
