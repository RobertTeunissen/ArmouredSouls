import { ScheduledMatch } from '../../utils/matchmakingApi';

interface ByeMatchCardProps {
  match: ScheduledMatch;
  myRobot: { id: number; name: string; elo: number; userId: number };
  getRoundName: (round: number, maxRounds: number) => string;
}

function ByeMatchCard({ match, myRobot, getRoundName }: ByeMatchCardProps) {
  const tournamentLabel = match.tournamentRound && match.maxRounds
    ? `${match.tournamentName || 'Tournament'} • ${getRoundName(match.tournamentRound, match.maxRounds)}`
    : match.tournamentName || 'Tournament';

  return (
    <div
      className={`
        bg-[#252b38] border border-white/10 rounded-lg p-2 mb-1.5
        border-l-4 border-l-[#d29922]
        transition-all duration-150 ease-out
      `}
    >
      {/* Desktop Layout */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex-shrink-0 w-6 text-center text-base">🏆</div>
        <div className="flex-shrink-0 w-16">
          <div className="text-xs font-bold px-1.5 py-0.5 rounded text-center bg-yellow-500/20 text-warning">
            BYE
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-[#d29922] mb-0.5">{tournamentLabel}</div>
          <div className="font-medium text-xs">
            <span className="text-[#58a6ff]">{myRobot.name}</span>
            <span className="text-warning ml-2">auto-advances to next round</span>
          </div>
        </div>
        <div className="flex-shrink-0 w-48 text-right">
          <div className="text-xs text-[#8b949e]">
            Top seed — no opponent in this round
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-base">🏆</span>
            <div className="text-xs font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-warning">
              BYE
            </div>
          </div>
        </div>
        <div className="text-xs text-[#d29922] mb-1.5">{tournamentLabel}</div>
        <div className="text-sm font-medium mb-1">
          <span className="text-[#58a6ff]">{myRobot.name}</span>
          <span className="text-warning ml-2">auto-advances</span>
        </div>
        <div className="text-xs text-[#8b949e]">
          Top seed — no opponent in this round
        </div>
      </div>
    </div>
  );
}

export default ByeMatchCard;
