import { ScheduledMatch, formatDateTime, getLeagueTierColor, getLeagueTierName } from '../../utils/matchmakingApi';

interface TagTeamMatchCardProps {
  match: ScheduledMatch;
  myTeam: NonNullable<ScheduledMatch['team1']>;
  opponentTeam: NonNullable<ScheduledMatch['team1']>;
}

function TagTeamMatchCard({ match, myTeam, opponentTeam }: TagTeamMatchCardProps) {
  const tierColor = getLeagueTierColor(match.tagTeamLeague || 'bronze');
  const tierName = getLeagueTierName(match.tagTeamLeague || 'bronze');

  return (
    <div
      className={`
        bg-[#252b38] border border-white/10 rounded-lg p-2 mb-1.5
        border-l-4 border-l-cyan-400
        hover:bg-[#1a1f29] hover:border-[#58a6ff]/50
        transition-all duration-150 ease-out
        hover:-translate-y-0.5
      `}
    >
      {/* Desktop Layout */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex-shrink-0 w-6 text-center text-base">🤝</div>
        <div className="flex-shrink-0 w-16">
          <div className="text-xs font-bold px-1.5 py-0.5 rounded text-center bg-primary-dark/20 text-primary">
            PENDING
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs px-1.5 py-0.5 bg-cyan-400/20 rounded text-cyan-400 font-semibold">
              2v2
            </span>
            <div className={`text-xs ${tierColor}`}>{tierName} Tag Team</div>
          </div>
          <div className="font-medium text-xs truncate">
            <span className="text-[#58a6ff]">
              {myTeam.activeRobot.name} & {myTeam.reserveRobot.name}
            </span>
            <span className="text-[#57606a] mx-1.5">vs</span>
            <span className="text-[#e6edf3]">
              {opponentTeam.activeRobot.name} & {opponentTeam.reserveRobot.name}
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 w-28 text-xs text-[#8b949e]">
          {formatDateTime(match.scheduledFor)}
        </div>
        <div className="flex-shrink-0 w-20 text-center">
          <div className="text-xs text-[#8b949e]">
            {myTeam.combinedELO} vs {opponentTeam.combinedELO}
          </div>
        </div>
        <div className="flex-shrink-0 w-6 text-center text-[#58a6ff] text-sm">→</div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-base">🤝</span>
            <div className="text-xs font-bold px-1.5 py-0.5 rounded bg-primary-dark/20 text-primary">
              PENDING
            </div>
            <span className="text-xs px-1.5 py-0.5 bg-cyan-400/20 rounded text-cyan-400 font-semibold">
              2v2
            </span>
          </div>
          <div className="text-xs text-[#8b949e]">
            {formatDateTime(match.scheduledFor)}
          </div>
        </div>
        <div className={`text-xs ${tierColor} mb-1.5`}>{tierName} Tag Team</div>
        <div className="mb-1.5">
          <div className="text-sm font-medium">
            <span className="text-[#58a6ff]">
              {myTeam.activeRobot.name} & {myTeam.reserveRobot.name}
            </span>
            <span className="text-[#57606a] mx-1.5">vs</span>
            <span className="text-[#e6edf3]">
              {opponentTeam.activeRobot.name} & {opponentTeam.reserveRobot.name}
            </span>
          </div>
        </div>
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
      </div>
    </div>
  );
}

export default TagTeamMatchCard;
