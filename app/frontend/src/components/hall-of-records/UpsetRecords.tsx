import { RecordSection } from './RecordSection';
import { RecordCard } from './RecordCard';
import type { RecordsData } from './types';

export interface UpsetRecordsProps {
  records: RecordsData;
  formatDate: (dateString: string) => string;
  onBattleClick: (battleId: number) => void;
}

const TEAM_UPSET_LABEL: Record<string, string> = {
  tournament_2v2: '2v2 Tournament',
  tournament_3v3: '3v3 Tournament',
};

/**
 * Upsets tab of the Hall of Records.
 *
 * Spec #46 scoped upsets to tournament modes (R4.6). League matchmaking scores
 * on LP and confines matches to a tier instance, so it deliberately pairs
 * comparable robots — a league "upset" measured the matchmaker's tolerance, not
 * an underdog result. Tournament brackets are seeded, so beating a high seed is
 * a genuine upset.
 *
 * Biggest ELO Gain and Biggest ELO Loss were removed (R4.8): `ELO_K_FACTOR` is a
 * fixed 32, so every entry in both lists reported the same ±32.
 */
export function UpsetRecords({ records, formatDate, onBattleClick }: UpsetRecordsProps) {
  const teamUpsets = records.upsets.biggestTeamUpset ?? [];

  return (
    <>
      {records.upsets.biggestUpset.length > 0 && (
        <RecordSection title="🎲 Biggest Upset — 1v1 Tournament">
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

      {teamUpsets.length > 0 && (
        <RecordSection title="🎲 Biggest Upset — Team Tournaments">
          {teamUpsets.map((record, index) => (
            <RecordCard
              key={record.battleId}
              rank={index + 1}
              value={`${record.eloDifference} combined ELO underdog`}
              description={`${record.underdog.robots.map((r) => r.name).join(' + ')} (${record.underdog.teamEloBefore} combined) defeated ${record.favorite.robots.map((r) => r.name).join(' + ')} (${record.favorite.teamEloBefore} combined)`}
              details={[
                `Mode: ${TEAM_UPSET_LABEL[record.battleType] ?? record.battleType}`,
                `Underdog stable: ${record.underdog.robots[0]?.username ?? '—'}`,
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
