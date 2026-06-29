import { RecordSection } from './RecordSection';
import { RecordCard } from './RecordCard';
import type { RecordsData } from './types';

export interface GrandMeleeRecordsProps {
  records: RecordsData;
}

export function GrandMeleeRecords({ records }: GrandMeleeRecordsProps) {
  return (
    <>
      {records.grandMelee.mostWins?.length > 0 && (
        <RecordSection title="💀 Most Grand Melee Wins">
          {records.grandMelee.mostWins.map((record, index) => (
            <RecordCard
              key={record.robotId}
              rank={index + 1}
              value={`${record.grandMeleeWins} wins`}
              description={`${record.robotName} by ${record.username}`}
            />
          ))}
        </RecordSection>
      )}

      {records.grandMelee.highestLp?.length > 0 && (
        <RecordSection title="📈 Highest LP">
          {records.grandMelee.highestLp.map((record, index) => (
            <RecordCard
              key={record.robotId}
              rank={index + 1}
              value={`${record.leaguePoints} LP`}
              description={`${record.robotName} by ${record.username}`}
              details={[`Tier: ${record.tier}`]}
            />
          ))}
        </RecordSection>
      )}

      {records.grandMelee.mostKillsCareer?.length > 0 && (
        <RecordSection title="☠️ Most Kills (Career)">
          {records.grandMelee.mostKillsCareer.map((record, index) => (
            <RecordCard
              key={record.robotId}
              rank={index + 1}
              value={`${record.totalKills} kills`}
              description={`${record.robotName} by ${record.username}`}
            />
          ))}
        </RecordSection>
      )}
    </>
  );
}
