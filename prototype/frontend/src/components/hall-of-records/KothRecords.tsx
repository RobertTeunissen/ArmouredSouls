import { RecordSection } from './RecordSection';
import { RecordCard } from './RecordCard';
import type { RecordsData } from './types';

export interface KothRecordsProps {
  records: RecordsData;
  formatDuration: (seconds: number) => string;
}

export function KothRecords({ records, formatDuration }: KothRecordsProps) {
  return (
    <>
      {records.koth.mostWins?.length > 0 && (
        <RecordSection title="👑 Most KotH Wins">
          {records.koth.mostWins.map((record, index) => (
            <RecordCard
              key={record.robotId}
              rank={index + 1}
              value={`${record.kothWins} wins`}
              description={`${record.robotName} by ${record.username}`}
              details={[
                `Matches: ${record.kothMatches}`,
                `Win Rate: ${record.winRate}%`,
              ]}
            />
          ))}
        </RecordSection>
      )}

      {records.koth.highestAvgZoneScore?.length > 0 && (
        <RecordSection title="🎯 Highest Avg Zone Score">
          {records.koth.highestAvgZoneScore.map((record, index) => (
            <RecordCard
              key={record.robotId}
              rank={index + 1}
              value={`${record.avgZoneScore.toFixed(1)} avg`}
              description={`${record.robotName} by ${record.username}`}
              details={[`Matches: ${record.kothMatches}`]}
            />
          ))}
        </RecordSection>
      )}

      {records.koth.mostKillsCareer?.length > 0 && (
        <RecordSection title="☠️ Most KotH Kills (Career)">
          {records.koth.mostKillsCareer.map((record, index) => (
            <RecordCard
              key={record.robotId}
              rank={index + 1}
              value={`${record.kothKills} kills`}
              description={`${record.robotName} by ${record.username}`}
              details={[`Matches: ${record.kothMatches}`]}
            />
          ))}
        </RecordSection>
      )}

      {records.koth.longestWinStreak?.length > 0 && (
        <RecordSection title="🔥 Longest Win Streak">
          {records.koth.longestWinStreak.map((record, index) => (
            <RecordCard
              key={record.robotId}
              rank={index + 1}
              value={`${record.bestWinStreak} streak`}
              description={`${record.robotName} by ${record.username}`}
              details={[`Total Wins: ${record.kothWins}`]}
            />
          ))}
        </RecordSection>
      )}

      {records.koth.mostZoneTime?.length > 0 && (
        <RecordSection title="⏱️ Most Zone Time (Career)">
          {records.koth.mostZoneTime.map((record, index) => (
            <RecordCard
              key={record.robotId}
              rank={index + 1}
              value={formatDuration(record.totalZoneTime)}
              description={`${record.robotName} by ${record.username}`}
              details={[`Matches: ${record.kothMatches}`]}
            />
          ))}
        </RecordSection>
      )}

      {records.koth.bestPlacement?.length > 0 && (
        <RecordSection title="🏆 Best Placement">
          {records.koth.bestPlacement.map((record, index) => (
            <RecordCard
              key={record.robotId}
              rank={index + 1}
              value={`#${record.bestPlacement}`}
              description={`${record.robotName} by ${record.username}`}
              details={[`Matches: ${record.kothMatches}`]}
            />
          ))}
        </RecordSection>
      )}

      {records.koth.zoneDominator?.length > 0 && (
        <RecordSection title="🏰 Zone Dominator">
          {records.koth.zoneDominator.map((record, index) => (
            <RecordCard
              key={record.robotId}
              rank={index + 1}
              value={`${record.totalZoneScore} total`}
              description={`${record.robotName} by ${record.username}`}
              details={[`Matches: ${record.kothMatches}`]}
            />
          ))}
        </RecordSection>
      )}
    </>
  );
}
