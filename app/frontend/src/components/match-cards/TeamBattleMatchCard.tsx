import { ScheduledMatch, formatDateTime, getLeagueTierColor, getLeagueTierName } from '../../utils/matchmakingApi';
import { getModeConfig } from '../../utils/battleModeConfig';

interface TeamBattleMatchCardProps {
  match: ScheduledMatch;
  myUserId?: number;
}

function TeamBattleMatchCard({ match, myUserId }: TeamBattleMatchCardProps) {
  const team1 = match.teamBattleTeam1;
  const team2 = match.teamBattleTeam2;
  const isTagTeam = match.matchType === 'tag_team';
  const isTournament = match.matchType === 'tournament_2v2' || match.matchType === 'tournament_3v3';
  
  // Use shared mode config for consistent icon/badge/color
  const modeConfig = getModeConfig(match.matchType);
  const sizeLabel = modeConfig.label;
  const tierColor = isTournament ? 'text-[#d29922]' : isTagTeam ? 'text-[#f0a030]' : getLeagueTierColor(match.teamBattleLeague || 'bronze');

  const getRoundName = (round: number, maxRounds: number): string => {
    const remainingRounds = maxRounds - round + 1;
    if (remainingRounds === 1) return 'Finals';
    if (remainingRounds === 2) return 'Semi-finals';
    if (remainingRounds === 3) return 'Quarter-finals';
    return `Round ${round}/${maxRounds}`;
  };

  const tierName = isTournament
    ? (match.tournamentRound && match.maxRounds
        ? `${match.tournamentName || 'Tournament'} • ${getRoundName(match.tournamentRound, match.maxRounds)}`
        : match.tournamentName || 'Tournament')
    : `${getLeagueTierName(match.teamBattleLeague || 'bronze')} ${modeConfig.tierPrefix}`;
  const isBye = match.isByeMatch || !team2;

  // Determine which team is "mine"
  const isMyTeam1 = team1?.members.some(m => m.userId === myUserId);
  const myTeam = isMyTeam1 ? team1 : team2;
  const opponentTeam = isMyTeam1 ? team2 : team1;

  const myTeamName = myTeam?.teamName || 'Your Team';
  const opponentTeamName = isBye ? 'Bye' : (opponentTeam?.teamName || 'Opponent');

  return (
    <div
      className={`
        bg-[#252b38] border border-white/10 rounded-lg p-2 mb-1.5
        border-l-4 ${modeConfig.borderColor}
        hover:bg-[#1a1f29] hover:border-[#58a6ff]/50
        transition-all duration-150 ease-out
        hover:-translate-y-0.5
      `}
    >
      {/* Desktop Layout */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex-shrink-0 w-6 text-center text-base">
          {modeConfig.icon}
        </div>
        <div className="flex-shrink-0 w-16">
          <div className="text-xs font-bold px-1.5 py-0.5 rounded text-center bg-primary-dark/20 text-primary">
            {isBye ? 'BYE' : 'PENDING'}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${modeConfig.badgeColor}`}>
              {sizeLabel}
            </span>
            <div className={`text-xs ${tierColor}`}>{tierName}</div>
          </div>
          <div className="font-medium text-xs truncate">
            <span className="text-[#58a6ff]">{myTeamName}</span>
            <span className="text-[#57606a] mx-1.5">vs</span>
            <span className="text-[#e6edf3]">{opponentTeamName}</span>
          </div>
        </div>
        <div className="flex-shrink-0 w-28 text-xs text-[#8b949e]">
          {formatDateTime(match.scheduledFor)}
        </div>
        <div className="flex-shrink-0 w-20 text-center">
          {!isBye && myTeam && opponentTeam && (
            <div className="text-xs text-[#8b949e]">
              {myTeam.combinedELO} vs {opponentTeam.combinedELO}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 w-6 text-center text-[#58a6ff] text-sm">→</div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{modeConfig.icon}</span>
            <div className="text-xs font-bold px-1.5 py-0.5 rounded bg-primary-dark/20 text-primary">
              {isBye ? 'BYE' : 'PENDING'}
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${modeConfig.badgeColor}`}>
              {sizeLabel}
            </span>
          </div>
          <div className="text-xs text-[#8b949e]">
            {formatDateTime(match.scheduledFor)}
          </div>
        </div>
        <div className={`text-xs ${tierColor} mb-1.5`}>{tierName}</div>
        <div className="mb-1.5">
          <div className="text-sm font-medium">
            <span className="text-[#58a6ff]">{myTeamName}</span>
            <span className="text-[#57606a] mx-1.5">vs</span>
            <span className="text-[#e6edf3]">{opponentTeamName}</span>
          </div>
        </div>
        {!isBye && myTeam && opponentTeam && (
          <div className="flex justify-between text-xs">
            <div>
              <span className="text-[#57606a]">ELO: </span>
              <span className="text-[#e6edf3]">{myTeam.combinedELO}</span>
            </div>
            <div>
              <span className="text-[#57606a]">vs </span>
              <span className="text-[#e6edf3]">{opponentTeam.combinedELO}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamBattleMatchCard;
