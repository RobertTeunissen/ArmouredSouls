import { RecordSection } from './RecordSection';
import { RecordCard } from './RecordCard';
import OwnerNameLink from '../OwnerNameLink';
import { formatCurrency } from '../../utils/formatters';
import type { RecordsData } from './types';

export interface EconomicRecordsProps {
  records: RecordsData;
}

export function EconomicRecords({ records }: EconomicRecordsProps) {
  return (
    <>
      {records.economic.highestFame.length > 0 && (
        <RecordSection title="⭐ Highest Fame">
          {records.economic.highestFame.map((record, index) => (
            <RecordCard
              key={record.robotId}
              rank={index + 1}
              value={`${record.fame.toLocaleString()} fame`}
              description={`${record.robotName} by ${record.username}`}
              details={[
                `League: ${record.league}`,
                `ELO: ${record.elo}`,
              ]}
            />
          ))}
        </RecordSection>
      )}

      {records.economic.richestStables.length > 0 && (
        <RecordSection title="💎 Richest Stable">
          {records.economic.richestStables.map((record, index) => (
            <RecordCard
              key={record.userId}
              rank={index + 1}
              value={formatCurrency(record.currency)}
              description={<><OwnerNameLink userId={record.userId} displayName={record.username} />'s stable</>}
              details={[
                `Robots: ${record.robotCount}`,
                `Prestige: ${record.prestige.toLocaleString()}`,
              ]}
            />
          ))}
        </RecordSection>
      )}
    </>
  );
}
