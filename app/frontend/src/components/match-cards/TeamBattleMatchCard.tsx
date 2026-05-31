import { ScheduledMatch, formatDateTime, getLeagueTierColor, getLeagueTierName } from '../../utils/matchmakingApi';

interface TeamBattleMatchCardProps {
  match: ScheduledMatch;
  myUserId?: number;
}

function TeamBattleMatchCard({ match, myUserId }: TeamBattleMatchCardProps) {
  const team1 = match.teamBattleTeam1;
  const team2 = match.teamBattleTeam2;
  const teamSize = match.teamSize || 2;
  const sizeLabel = `${teamSize}v${teamSize}`;
  const tierColor = getLeagueTierColor(match.teamBattleLeague || 'bronze');
  const tierName = getLeagueTierName(match.teamBattleLeague || 'bronze');
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
        border-l-4 ${teamSize === 2 ? 'border-l-emerald-400' : 'border-l-violet-400'}
        hover:bg-[#1a1f29] hover:border-[#58a6ff]/50
        transition-all duration-150 ease-out
        hover:-translate-y-0.5
      `}
    >
      {/* Desktop Layout */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex-shrink-0 w-6 text-center text-base">
          {teamSize === 2 ? '⚔️' : '🗡️'}
        </div>
        <div className="flex-shrink-0 w-16">
          <div className="text-xs font-bold px-1.5 py-0.5 rounded text-center bg-primary-dark/20 text-primary">
            {isBye ? 'BYE' : 'PENDING'}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
              teamSize === 2 ? 'bg-emerald-400/20 text-emerald-400' : 'bg-violet-400/20 text-violet-400'
            }`}>
              {sizeLabel}
            </span>
            <div className={`text-xs ${tierColor}`}>{tierName} League</div>
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
            <span className="text-base">{teamSize === 2 ? '⚔️' : '🗡️'}</span>
            <div className="text-xs font-bold px-1.5 py-0.5 rounded bg-primary-dark/20 text-primary">
              {isBye ? 'BYE' : 'PENDING'}
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
              teamSize === 2 ? 'bg-emerald-400/20 text-emerald-400' : 'bg-violet-400/20 text-violet-400'
            }`}>
              {sizeLabel}
            </span>
          </div>
          <div className="text-xs text-[#8b949e]">
            {formatDateTime(match.scheduledFor)}
          </div>
        </div>
        <div className={`text-xs ${tierColor} mb-1.5`}>{tierName} League</div>
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
