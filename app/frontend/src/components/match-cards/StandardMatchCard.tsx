import { Link } from 'react-router-dom';
import { ScheduledMatch, formatDateTime, getLeagueTierColor, getLeagueTierName } from '../../utils/matchmakingApi';
import { getModeConfig } from '../../utils/battleModeConfig';

interface StandardMatchCardProps {
  match: ScheduledMatch;
  myRobot: { id: number; name: string; elo: number; userId: number };
  opponent: { id: number; name: string; elo: number; userId: number };
  getRoundName: (round: number, maxRounds: number) => string;
}

function StandardMatchCard({ match, myRobot, opponent, getRoundName }: StandardMatchCardProps) {
  const isTournament = match.matchType === 'tournament_1v1';
  const modeConfig = getModeConfig(match.matchType);

  const tierColor = isTournament ? 'text-warning' : getLeagueTierColor(match.leagueType);
  const tierName = isTournament
    ? (match.tournamentRound && match.maxRounds
        ? `${match.tournamentName || 'Tournament'} • ${getRoundName(match.tournamentRound, match.maxRounds)}`
        : match.tournamentName || 'Tournament')
    : `${getLeagueTierName(match.leagueType)} League`;

  return (
    <div
      className={`
        bg-surface-elevated border border-white/10 rounded-lg p-2 mb-1.5
        border-l-4 ${modeConfig.borderColor}
        hover:bg-surface hover:border-primary/50
        transition-all duration-150 ease-out
        hover:-translate-y-0.5
      `}
    >
      {/* Desktop Layout */}
      <div className="hidden lg:flex items-center gap-3">
        <div className="flex-shrink-0 w-6 text-center text-base">
          {modeConfig.icon}
        </div>
        <div className="flex-shrink-0 w-16">
          <div className="text-xs font-bold px-1.5 py-0.5 rounded text-center bg-primary-dark/20 text-primary">
            PENDING
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-xs ${tierColor} mb-0.5`}>{tierName}</div>
          <div className="font-medium text-xs truncate">
            <span className="text-primary">{myRobot.name}</span>
            <span className="text-tertiary mx-1.5">vs</span>
            <Link
              to={`/robots/${opponent.id}`}
              className="text-foreground hover:text-primary hover:underline transition-colors"
            >
              {opponent.name}
            </Link>
          </div>
        </div>
        <div className="flex-shrink-0 w-28 text-xs text-secondary">
          {formatDateTime(match.scheduledFor)}
        </div>
        <div className="flex-shrink-0 w-20 text-center">
          <div className="text-xs text-secondary">
            {myRobot.elo} vs {opponent.elo}
          </div>
        </div>
        <div className="flex-shrink-0 w-6 text-center text-primary text-sm">→</div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{modeConfig.icon}</span>
            <div className="text-xs font-bold px-1.5 py-0.5 rounded bg-primary-dark/20 text-primary">
              PENDING
            </div>
          </div>
          <div className="text-xs text-secondary">
            {formatDateTime(match.scheduledFor)}
          </div>
        </div>
        <div className={`text-xs ${tierColor} mb-1.5`}>{tierName}</div>
        <div className="mb-1.5">
          <div className="text-sm font-medium">
            <span className="text-primary">{myRobot.name}</span>
            <span className="text-tertiary mx-1.5">vs</span>
            <Link
              to={`/robots/${opponent.id}`}
              className="text-foreground hover:text-primary hover:underline transition-colors"
            >
              {opponent.name}
            </Link>
          </div>
        </div>
        <div className="flex justify-between text-xs">
          <div>
            <span className="text-tertiary">ELO: </span>
            <span className="text-foreground">{myRobot.elo}</span>
          </div>
          <div>
            <span className="text-tertiary">vs </span>
            <span className="text-foreground">{opponent.elo}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StandardMatchCard;
