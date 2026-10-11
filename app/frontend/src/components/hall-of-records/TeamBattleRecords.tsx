import { Fragment, useState } from 'react';
import { RecordSection } from './RecordSection';
import { RecordCard } from './RecordCard';
import { RecordStableName } from './RecordStableName';
import type { RecordsData, TeamBattleParticipantDisplay, TeamBattleSizeRecords } from './types';

export interface TeamBattleRecordsProps {
  records: RecordsData;
  formatDuration: (seconds: number) => string;
  formatDate: (dateString: string) => string;
  onBattleClick: (battleId: number) => void;
}

export function TeamBattleRecords({ records, formatDuration, formatDate, onBattleClick }: TeamBattleRecordsProps) {
  const [activeSize, setActiveSize] = useState<'2v2' | '3v3'>('2v2');

  const sizeRecords: TeamBattleSizeRecords = records.teamBattle[activeSize];

  // "Robot (Stable), Robot (Stable)"; an Automaton stable carries its badge (decision 42).
  const formatTeamNames = (team: TeamBattleParticipantDisplay[]) => team.map((r, index) => (
    <Fragment key={r.id}>
      {index > 0 && ', '}
      {r.name} (<RecordStableName name={r.username} stableType={r.stableType} />)
    </Fragment>
  ));

  return (
    <>
      {/* Size selector */}
      <div className="flex space-x-2 mb-6">
        <button
          onClick={() => setActiveSize('2v2')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeSize === '2v2'
              ? 'bg-blue-600 text-white'
              : 'bg-surface text-secondary hover:bg-surface-elevated'
          }`}
        >
          2v2 League
        </button>
        <button
          onClick={() => setActiveSize('3v3')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeSize === '3v3'
              ? 'bg-purple-600 text-white'
              : 'bg-surface text-secondary hover:bg-surface-elevated'
          }`}
        >
          3v3 League
        </button>
      </div>

      {/* Fastest Victory */}
      {sizeRecords.fastestVictory?.length > 0 && (
        <RecordSection title="⚡ Fastest Victory">
          {sizeRecords.fastestVictory.map((record, index) => (
            <RecordCard
              key={`${record.battleId}-fast`}
              rank={index + 1}
              value={formatDuration(record.durationSeconds)}
              description={<>Team 1: {formatTeamNames(record.team1)}</>}
              details={[
                <>vs Team 2: {formatTeamNames(record.team2)}</>,
                formatDate(record.date),
              ]}
              onClick={() => onBattleClick(record.battleId)}
            />
          ))}
        </RecordSection>
      )}

      {/* Longest Survival */}
      {sizeRecords.longestSurvival?.length > 0 && (
        <RecordSection title="🛡️ Longest Survival">
          {sizeRecords.longestSurvival.map((record, index) => (
            <RecordCard
              key={`${record.battleId}-${record.robot.id}-surv`}
              rank={index + 1}
              value={formatDuration(record.survivalSeconds)}
              description={<>{record.robot.name} by <RecordStableName name={record.robot.username} stableType={record.robot.stableType} /></>}
              details={[formatDate(record.date)]}
              onClick={() => onBattleClick(record.battleId)}
            />
          ))}
        </RecordSection>
      )}

      {/* Most Damage Dealt */}
      {sizeRecords.mostDamageDealt?.length > 0 && (
        <RecordSection title="💥 Most Damage Dealt">
          {sizeRecords.mostDamageDealt.map((record, index) => (
            <RecordCard
              key={`${record.battleId}-${record.robot.id}-dmg`}
              rank={index + 1}
              value={`${record.damageDealt.toLocaleString()} dmg`}
              description={<>{record.robot.name} by <RecordStableName name={record.robot.username} stableType={record.robot.stableType} /></>}
              details={[
                `Duration: ${formatDuration(record.durationSeconds)}`,
                formatDate(record.date),
              ]}
              onClick={() => onBattleClick(record.battleId)}
            />
          ))}
        </RecordSection>
      )}

      {/* Most Decisive Victory */}
      {sizeRecords.mostDecisiveVictory?.length > 0 && (
        <RecordSection title="🏆 Most Decisive Victory">
          {sizeRecords.mostDecisiveVictory.map((record, index) => (
            <RecordCard
              key={`${record.battleId}-decisive`}
              rank={index + 1}
              value={`${record.hpDifference} HP diff`}
              description={<>Team 1: {formatTeamNames(record.team1)}</>}
              details={[
                <>vs Team 2: {formatTeamNames(record.team2)}</>,
                formatDate(record.date),
              ]}
              onClick={() => onBattleClick(record.battleId)}
            />
          ))}
        </RecordSection>
      )}

      {/* Longest Non-Draw Battle */}
      {sizeRecords.longestNonDrawBattle?.length > 0 && (
        <RecordSection title="⏱️ Longest Battle (Non-Draw)">
          {sizeRecords.longestNonDrawBattle.map((record, index) => (
            <RecordCard
              key={`${record.battleId}-long`}
              rank={index + 1}
              value={formatDuration(record.durationSeconds)}
              description={<>Team 1: {formatTeamNames(record.team1)}</>}
              details={[
                <>vs Team 2: {formatTeamNames(record.team2)}</>,
                formatDate(record.date),
              ]}
              onClick={() => onBattleClick(record.battleId)}
            />
          ))}
        </RecordSection>
      )}

      {/* Empty state */}
      {(!sizeRecords.fastestVictory?.length &&
        !sizeRecords.longestSurvival?.length &&
        !sizeRecords.mostDamageDealt?.length &&
        !sizeRecords.mostDecisiveVictory?.length &&
        !sizeRecords.longestNonDrawBattle?.length) && (
        <div className="text-center py-12">
          <p className="text-secondary text-lg">No {activeSize} team battle records yet.</p>
          <p className="text-tertiary mt-2">Records will appear once team battles have been played.</p>
        </div>
      )}
    </>
  );
}
