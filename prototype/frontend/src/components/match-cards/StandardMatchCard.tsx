import { useNavigate } from 'react-router-dom';
import { ScheduledMatch, formatDateTime, getLeagueTierColor, getLeagueTierName } from '../../utils/matchmakingApi';

interface StandardMatchCardProps {
  match: ScheduledMatch;
  myRobot: { id: number; name: string; elo: number; userId: number };
  opponent: { id: number; name: string; elo: number; userId: number };
  getRoundName: (round: number, maxRounds: number) => string;
}

function StandardMatchCard({ match, myRobot, opponent, getRoundName }: StandardMatchCardProps) {
  const navigate = useNavigate();
  const isTournament = match.matchType === 'tournament';

  const tierColor = isTournament ? 'text-[#d29922]' : getLeagueTierColor(match.leagueType);
  const tierName = isTournament
    ? (match.tournamentRound && match.maxRounds
        ? `${match.tournamentName || 'Tournament'} • ${getRoundName(match.tournamentRound, match.maxRounds)}`
        : match.tournamentName || 'Tournament')
    : `${getLeagueTierName(match.leagueType)} League`;

  const borderColor = isTournament ? 'border-l-[#d29922]' : 'border-l-[#58a6ff]';

  return (
    <div
      className={`
        bg-[#252b38] border border-white/10 rounded-lg p-2 mb-1.5
        border-l-4 ${borderColor}
        hover:bg-[#1a1f29] hover:border-[#58a6ff]/50
        transition-all duration-150 ease-out
        hover:-translate-y-0.5
      `}
    >
      {/* Desktop Layout */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex-shrink-0 w-6 text-center text-base">
          {isTournament ? '🏆' : '⚔️'}
        </div>
        <div className="flex-shrink-0 w-16">
          <div className="text-xs font-bold px-1.5 py-0.5 rounded text-center bg-primary-dark/20 text-primary">
            PENDING
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-xs ${tierColor} mb-0.5`}>{tierName}</div>
          <div className="font-medium text-xs truncate">
            <span className="text-[#58a6ff]">{myRobot.name}</span>
            <span className="text-[#57606a] mx-1.5">vs</span>
            <span
              className="text-[#e6edf3] hover:text-[#58a6ff] cursor-pointer hover:underline transition-colors"
              onClick={(e) => { e.stopPropagation(); navigate(`/robots/${opponent.id}`); }}
            >
              {opponent.name}
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 w-28 text-xs text-[#8b949e]">
          {formatDateTime(match.scheduledFor)}
        </div>
        <div className="flex-shrink-0 w-20 text-center">
          <div className="text-xs text-[#8b949e]">
            {myRobot.elo} vs {opponent.elo}
          </div>
        </div>
        <div className="flex-shrink-0 w-6 text-center text-[#58a6ff] text-sm">→</div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{isTournament ? '🏆' : '⚔️'}</span>
            <div className="text-xs font-bold px-1.5 py-0.5 rounded bg-primary-dark/20 text-primary">
              PENDING
            </div>
          </div>
          <div className="text-xs text-[#8b949e]">
            {formatDateTime(match.scheduledFor)}
          </div>
        </div>
        <div className={`text-xs ${tierColor} mb-1.5`}>{tierName}</div>
        <div className="mb-1.5">
          <div className="text-sm font-medium">
            <span className="text-[#58a6ff]">{myRobot.name}</span>
            <span className="text-[#57606a] mx-1.5">vs</span>
            <span
              className="text-[#e6edf3] hover:text-[#58a6ff] cursor-pointer hover:underline transition-colors"
              onClick={(e) => { e.stopPropagation(); navigate(`/robots/${opponent.id}`); }}
            >
              {opponent.name}
            </span>
          </div>
        </div>
        <div className="flex justify-between text-xs">
          <div>
            <span className="text-[#57606a]">ELO: </span>
            <span className="text-[#e6edf3]">{myRobot.elo}</span>
          </div>
          <div>
            <span className="text-[#57606a]">vs </span>
            <span className="text-[#e6edf3]">{opponent.elo}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StandardMatchCard;
