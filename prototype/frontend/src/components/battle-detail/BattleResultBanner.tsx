import { formatDuration } from '../../utils/matchmakingApi';
import { getLeagueTierName } from '../../utils/matchmakingApi';
import type { BattleResultBannerProps } from './types';

export function BattleResultBanner({ battleLog, userId }: BattleResultBannerProps) {
  const getWinnerText = (): string => {
    if (!battleLog.winner) return 'DRAW';

    if (battleLog.battleType === 'koth' && battleLog.kothParticipants?.length) {
      const winner = battleLog.kothParticipants.find(p => p.placement === 1);
      return winner ? `${winner.robotName.toUpperCase()} WINS` : 'WINNER';
    }

    if (battleLog.battleType === 'tag_team' && battleLog.tagTeam) {
      const winningTeam = battleLog.winner === 'robot1' ? battleLog.tagTeam.team1 : battleLog.tagTeam.team2;
      const teamName = winningTeam.stableName || `Team ${winningTeam.teamId}`;
      return `${teamName.toUpperCase()} WINS`;
    }

    const winner = battleLog.winner === 'robot1' ? battleLog.robot1 : battleLog.robot2;
    return winner ? `${winner.name} WINS` : 'WINNER';
  };

  const getWinnerColor = (): string => {
    if (!battleLog.winner) return 'text-secondary';
    return 'text-success';
  };

  const bgClass = !battleLog.winner ? 'bg-yellow-900/20 border-2 border-yellow-600' :
    battleLog.battleType === 'koth' && battleLog.kothParticipants?.some(p => p.placement === 1 && p.ownerId === userId) ? 'bg-green-900/20 border-2 border-green-600' :
    battleLog.battleType === 'koth' ? 'bg-orange-900/20 border-2 border-orange-600' :
    battleLog.winner === 'robot1' && battleLog.robot1?.ownerId === userId ? 'bg-green-900/20 border-2 border-green-600' :
    battleLog.winner === 'robot2' && battleLog.robot2?.ownerId === userId ? 'bg-green-900/20 border-2 border-green-600' :
    'bg-red-900/20 border-2 border-red-600';

  return (
    <div className={`mb-3 p-3 rounded-lg text-center ${bgClass}`}>
      <div className={`text-3xl font-bold mb-1 ${getWinnerColor()}`}>
        {getWinnerText()}
      </div>
      <div className="text-secondary text-sm">
        {battleLog.battleType === 'tag_team' ? (
          <>🤝 Tag Team Battle • Duration: {formatDuration(battleLog.duration)}</>
        ) : battleLog.battleType === 'koth' ? (
          <>⛰️ King of the Hill • {battleLog.kothParticipants?.length || battleLog.battleLog.participantCount || 0} Participants • Duration: {formatDuration(battleLog.duration)}</>
        ) : battleLog.battleType === 'tournament' || battleLog.battleLog.isTournament ? (
          <>🏆 Tournament Round {battleLog.battleLog.round || '?'}/{battleLog.battleLog.maxRounds || '?'}
          {battleLog.battleLog.isFinals ? ' (Finals)' : ''} • Duration: {formatDuration(battleLog.duration)}</>
        ) : (
          <>{getLeagueTierName(battleLog.leagueType)} League • Duration: {formatDuration(battleLog.duration)}</>
        )}
      </div>
    </div>
  );
}
