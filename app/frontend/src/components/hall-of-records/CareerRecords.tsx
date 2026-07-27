import { RecordSection } from './RecordSection';
import { RecordCard } from './RecordCard';
import type { RecordsData } from './types';

export interface CareerRecordsProps {
  records: RecordsData;
}

export function CareerRecords({ records }: CareerRecordsProps) {
  return (
    <>
      {records.career.mostBattles.length > 0 && (
        <RecordSection
          title="🎖️ Most Battles Fought"
          subtitle="Covers 1v1 League, 1v1 Tournament, Tag Team, and 2v2/3v3 League. KotH and Grand Melee resolve by placement, so they do not increment the win/loss counters."
        >
          {records.career.mostBattles.map((record, index) => (
            <RecordCard
              key={record.robotId}
              rank={index + 1}
              value={`${record.totalBattles} battles`}
              description={`${record.robotName} by ${record.username}`}
              details={[
                `Record: ${record.wins}-${record.losses}-${record.draws}`,
                `Win Rate: ${record.winRate}%`,
                `Current ELO: ${record.elo}`,
              ]}
            />
          ))}
        </RecordSection>
      )}

      {records.career.highestWinRate.length > 0 && (
        <RecordSection
          title="🏆 Highest Win Rate"
          subtitle="Covers 1v1 League, 1v1 Tournament, Tag Team, and 2v2/3v3 League. KotH and Grand Melee resolve by placement, so they do not increment the win/loss counters."
        >
          {records.career.highestWinRate.map((record, index) => (
            <RecordCard
              key={record.robotId}
              rank={index + 1}
              value={`${record.winRate}%`}
              description={`${record.robotName} by ${record.username}`}
              details={[
                `Wins: ${record.wins} / ${record.totalBattles}`,
                `ELO: ${record.elo}`,
                `League: ${record.league}`,
              ]}
            />
          ))}
        </RecordSection>
      )}

      {records.career.mostLifetimeDamage.length > 0 && (
        <RecordSection
          title="💪 Most Lifetime Damage"
          subtitle="Covers every mode, including KotH and Grand Melee."
        >
          {records.career.mostLifetimeDamage.map((record, index) => (
            <RecordCard
              key={record.robotId}
              rank={index + 1}
              value={`${record.damageDealt.toLocaleString()} damage`}
              description={`${record.robotName} by ${record.username}`}
              details={[
                `Total Battles: ${record.totalBattles}`,
                `Avg per Battle: ${record.avgDamagePerBattle.toLocaleString()}`,
              ]}
            />
          ))}
        </RecordSection>
      )}

      {records.career.highestElo.length > 0 && (
        <RecordSection
          title="👑 Highest Current ELO"
          subtitle="1v1 League and 1v1 Tournament only — ELO is a 1v1 rating."
        >
          {records.career.highestElo.map((record, index) => (
            <RecordCard
              key={record.robotId}
              rank={index + 1}
              value={`${record.elo} ELO`}
              description={`${record.robotName} by ${record.username}`}
              details={[
                `League: ${record.league}`,
                `Record: ${record.wins}-${record.losses}-${record.draws}`,
              ]}
            />
          ))}
        </RecordSection>
      )}

      {records.career.mostKills.length > 0 && (
        <RecordSection
          title="☠️ Most Robot Destructions"
          subtitle="Covers 1v1 League, 1v1 Tournament, Tag Team, and 2v2/3v3 League. KotH and Grand Melee kills are tracked separately on their own tabs."
        >
          {records.career.mostKills.map((record, index) => (
            <RecordCard
              key={record.robotId}
              rank={index + 1}
              value={`${record.kills} kills`}
              description={`${record.robotName} by ${record.username}`}
              details={[
                `Total Battles: ${record.totalBattles}`,
                `Kill Rate: ${record.killRate}%`,
              ]}
            />
          ))}
        </RecordSection>
      )}
    </>
  );
}
