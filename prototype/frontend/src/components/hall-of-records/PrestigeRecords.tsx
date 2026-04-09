import { RecordSection } from './RecordSection';
import { RecordCard } from './RecordCard';
import OwnerNameLink from '../OwnerNameLink';
import type { RecordsData } from './types';

export interface PrestigeRecordsProps {
  records: RecordsData;
}

export function PrestigeRecords({ records }: PrestigeRecordsProps) {
  return (
    <>
      {records.prestige.highestPrestige.length > 0 && (
        <RecordSection title="🌟 Highest Prestige">
          {records.prestige.highestPrestige.map((record, index) => (
            <RecordCard
              key={record.userId}
              rank={index + 1}
              value={`${record.prestige.toLocaleString()} prestige`}
              description={<><OwnerNameLink userId={record.userId} displayName={record.username} />'s stable</>}
              details={[
                `Robots: ${record.robotCount}`,
                `Championships: ${record.championshipTitles}`,
              ]}
            />
          ))}
        </RecordSection>
      )}

      {records.prestige.mostTitles.length > 0 && (
        <RecordSection title="🏅 Most Championship Titles">
          {records.prestige.mostTitles.map((record, index) => (
            <RecordCard
              key={record.userId}
              rank={index + 1}
              value={`${record.championshipTitles} titles`}
              description={<><OwnerNameLink userId={record.userId} displayName={record.username} />'s stable</>}
              details={[
                `Prestige: ${record.prestige.toLocaleString()}`,
                `Robots: ${record.robotCount}`,
              ]}
            />
          ))}
        </RecordSection>
      )}
    </>
  );
}
