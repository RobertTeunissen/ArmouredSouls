import { RecordSection } from './RecordSection';
import { RecordCard } from './RecordCard';
import type { RecordsData } from './types';

export interface UpsetRecordsProps {
  records: RecordsData;
  formatDate: (dateString: string) => string;
  onBattleClick: (battleId: number) => void;
}

export function UpsetRecords({ records, formatDate, onBattleClick }: UpsetRecordsProps) {
  return (
    <>
      {records.upsets.biggestUpset.length > 0 && (
        <RecordSection title="🎲 Biggest Upset">
          {records.upsets.biggestUpset.map((record, index) => (
            <RecordCard
              key={record.battleId}
              rank={index + 1}
              value={`${record.eloDifference} ELO underdog`}
              description={`${record.underdog.name} (${record.underdog.eloBefore} ELO) defeated ${record.favorite.name} (${record.favorite.eloBefore} ELO)`}
              details={[
                `Underdog: ${record.underdog.username}`,
                `Date: ${formatDate(record.date)}`,
              ]}
              onClick={() => onBattleClick(record.battleId)}
            />
          ))}
        </RecordSection>
      )}

      {records.upsets.biggestEloGain.length > 0 && (
        <RecordSection title="📈 Biggest ELO Gain">
          {records.upsets.biggestEloGain.map((record, index) => (
            <RecordCard
              key={record.battleId}
              rank={index + 1}
              value={`+${record.eloChange} ELO`}
              description={`${record.winner.name} (${record.winner.eloBefore} → ${record.winner.eloAfter})`}
              details={[
                `Winner: ${record.winner.username}`,
                `Opponent ELO: ${record.loser.eloBefore}`,
                `Date: ${formatDate(record.date)}`,
              ]}
              onClick={() => onBattleClick(record.battleId)}
            />
          ))}
        </RecordSection>
      )}

      {records.upsets.biggestEloLoss.length > 0 && (
        <RecordSection title="📉 Biggest ELO Loss">
          {records.upsets.biggestEloLoss.map((record, index) => (
            <RecordCard
              key={record.battleId}
              rank={index + 1}
              value={`-${record.eloChange} ELO`}
              description={`${record.loser.name} (${record.loser.eloBefore} → ${record.loser.eloAfter})`}
              details={[
                `Lost to: ${record.winner.username}`,
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
