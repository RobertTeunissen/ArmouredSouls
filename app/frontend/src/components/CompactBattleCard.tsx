import type { FC, KeyboardEvent, ReactNode } from 'react';
import { BattleHistory, getTournamentRoundName, getLeagueTierName } from '../utils/matchmakingApi';
import { formatDateTime } from '../utils/matchmakingApi';
import { getModeConfig, OUTCOME_BADGE_CONFIG } from '../utils/battleModeConfig';
import { ordinal } from '../utils/formatters';

interface BattleRobot {
  name: string;
  id: number;
  userId: number;
}

interface CompactBattleCardProps {
  battle: BattleHistory;
  myRobot: BattleRobot;
  opponent: BattleRobot | null;
  outcome: string;
  eloChange: number;
  myRobotId: number;
  reward: number;
  prestige?: number;
  fame?: number;
  streamingRevenue?: number;
  onClick: () => void;
}

const TEAM_TOURNAMENT_TYPES = new Set(['tournament_2v2', 'tournament_3v3']);
const TEAM_LEAGUE_TYPES = new Set(['league_2v2', 'league_3v3']);

/** Header line: mode name, tournament and round, or the league tier at battle time. */
function battleTypeText(battle: BattleHistory): string {
  const type = battle.battleType;
  if (type === 'koth') return 'King of the Hill';
  if (type === 'grand_melee') return 'Grand Melee';
  const isTournament = type === 'tournament_1v1' || TEAM_TOURNAMENT_TYPES.has(type ?? '');
  if (isTournament) {
    const roundName = battle.tournamentRound && battle.tournamentMaxRounds
      ? getTournamentRoundName(battle.tournamentRound, battle.tournamentMaxRounds)
      : '';
    const round = roundName ? ` • ${roundName}` : '';
    if (battle.tournamentName) return `${battle.tournamentName}${round}`;
    if (type === 'tournament_1v1') return `Tournament${round}`;
    return `${type === 'tournament_2v2' ? '2v2' : '3v3'} Tournament${round}`;
  }
  // Tag team has no league at battle time on old rows: Bronze, like the other leagues.
  if (type === 'tag_team') return `${getLeagueTierName(battle.leagueType || 'bronze')} League`;
  if (battle.leagueType) return `${getLeagueTierName(battle.leagueType)} League`;
  return 'League Match';
}

/** Left border: the mode colour, except 1v1 leagues which show the outcome. */
function borderColor(battle: BattleHistory, outcome: string, modeBorder: string): string {
  const type = battle.battleType ?? '';
  const isOneVsOneLeague = !['koth', 'grand_melee', 'tournament_1v1', 'tag_team'].includes(type)
    && !TEAM_TOURNAMENT_TYPES.has(type) && !TEAM_LEAGUE_TYPES.has(type);
  if (!isOneVsOneLeague) return modeBorder;
  switch (outcome) {
    case 'win': return 'border-l-success';
    case 'loss': return 'border-l-error';
    case 'draw': return 'border-l-tertiary';
    default: return 'border-l-gray-700';
  }
}

function placementBadgeClass(placement: number | null | undefined): string {
  if (placement === 1) return 'bg-warning/20 text-warning';
  if (placement === 2) return 'bg-gray-400/20 text-gray-300';
  if (placement === 3) return 'bg-orange-600/20 text-orange-500';
  return 'bg-surface-elevated text-secondary';
}

const CompactBattleCard: FC<CompactBattleCardProps> = ({
  battle,
  myRobot,
  opponent,
  outcome,
  eloChange,
  myRobotId,
  reward,
  prestige,
  fame,
  streamingRevenue,
  onClick,
}) => {
  const totalCredits = reward + (streamingRevenue ?? 0);
  const isBye = battle.isByeMatch === true;
  const opponentDisplay = isBye ? 'No opponent — walkover' : (opponent?.name ?? 'No opponent');
  const matchupSeparator = isBye ? '•' : 'vs';
  // Forfeits (keyed on forfeitedRobotIds, so a forfeiter placed last in a
  // fought KotH / Grand Melee battle is labelled too).
  const myRobotForfeited = battle.forfeitedRobotIds?.includes(myRobotId) === true;
  const wonByForfeit = !myRobotForfeited && battle.isForfeit === true && outcome === 'win';
  const forfeitSuffix = wonByForfeit ? ' — won by forfeit' : '';
  const forfeitTag: ReactNode = myRobotForfeited ? (
    <span className="text-error ml-1.5">Forfeit — no main weapon</span>
  ) : null;

  const isKoth = battle.battleType === 'koth';
  const isFFA = isKoth || battle.battleType === 'grand_melee';
  const isTeamMode = battle.battleType === 'tag_team'
    || TEAM_LEAGUE_TYPES.has(battle.battleType ?? '')
    || TEAM_TOURNAMENT_TYPES.has(battle.battleType ?? '');
  const myParticipant = battle.participants?.find(participant => participant.robotId === myRobotId);
  const ffaPlacement = myParticipant?.placement ?? battle.kothPlacement;

  // Use shared mode config for consistent icon/badge/color across all views
  const modeConfig = getModeConfig(battle.battleType);
  const modeBadgeLabel = isFFA ? 'FFA' : modeConfig.label;
  const typeText = battleTypeText(battle);

  // Team modes show team names from the viewer's side. Robot 1 is always on
  // team 1, so without participant data the owner decides the side.
  let myName = myRobot.name;
  let opponentSideName = opponentDisplay;
  if (isTeamMode) {
    const myTeam = myParticipant?.team ?? (battle.robot1.userId === myRobot.userId ? 1 : 2);
    const [mine, theirs] = myTeam === 1
      ? [battle.team1TeamName, battle.team2TeamName]
      : [battle.team2TeamName, battle.team1TeamName];
    myName = mine || myRobot.name;
    opponentSideName = theirs || opponentDisplay;
  }

  const matchup = (textClass: string): ReactNode => (isFFA ? (
    <div className={textClass}>
      <span className="text-primary">{myRobot.name}</span>
      <span className="text-secondary mx-1.5">• {battle.kothParticipantCount ?? '?'} robots</span>
      {forfeitTag}
    </div>
  ) : (
    <div className={textClass}>
      <span className="text-primary">{myName}</span>
      <span className="text-tertiary mx-1.5">{matchupSeparator}</span>
      <span className="text-foreground">{opponentSideName}{forfeitSuffix}</span>
      {forfeitTag}
    </div>
  ));

  const outcomeBadge = (layoutClass: string): ReactNode => {
    if (isBye) {
      return <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${layoutClass} bg-yellow-500/20 text-warning`}>BYE</div>;
    }
    if (isFFA && ffaPlacement != null && battle.kothParticipantCount != null) {
      return (
        <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${layoutClass} ${placementBadgeClass(ffaPlacement)}`}>
          {ordinal(ffaPlacement)} of {battle.kothParticipantCount}
        </div>
      );
    }
    const badge = OUTCOME_BADGE_CONFIG[outcome as keyof typeof OUTCOME_BADGE_CONFIG]?.badgeColor
      || 'bg-surface-elevated text-secondary';
    return (
      <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${layoutClass} ${badge}`}>
        {outcome === 'win' ? 'WIN' : outcome === 'loss' ? 'LOSS' : 'DRAW'}
      </div>
    );
  };

  const eloClass = eloChange >= 0 ? 'text-success' : 'text-error';
  const eloText = `${eloChange > 0 ? '+' : ''}${eloChange}`;
  const showZoneScore = isKoth && battle.kothZoneScore != null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={isBye ? `${myRobot.name} bye result` : `${myRobot.name} battle result`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`
        bg-surface-elevated border border-white/10 rounded-lg p-2 mb-1.5 min-h-[44px]
        border-l-4 ${borderColor(battle, outcome, modeConfig.borderColor)}
        hover:bg-surface hover:border-primary/50 cursor-pointer 
        transition-all duration-150 ease-out
        hover:-translate-y-0.5
      `}
    >
      {/* Desktop Layout */}
      <div className="hidden lg:flex items-center gap-3">
        <div className="flex-shrink-0 w-6 text-center text-base">
          {modeConfig.icon}
        </div>

        <div className="flex-shrink-0 w-20">
          {outcomeBadge('text-center whitespace-nowrap')}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${modeConfig.badgeColor}`}>
              {modeBadgeLabel}
            </span>
            <div className="text-xs text-secondary">
              {typeText}
            </div>
          </div>
          {matchup('font-medium text-xs truncate')}
        </div>

        <div className="flex-shrink-0 w-28 text-xs text-secondary">
          {formatDateTime(battle.createdAt)}
        </div>

        {/* Prestige & Fame Indicators */}
        {(prestige != null && prestige > 0) || (fame != null && fame > 0) ? (
          <div className="flex-shrink-0 flex items-center gap-2">
            {prestige != null && prestige > 0 && (
              <span className="text-xs font-medium text-info">⭐+{prestige}</span>
            )}
            {fame != null && fame > 0 && (
              <span className="text-xs font-medium text-warning">🎖️+{fame}</span>
            )}
          </div>
        ) : null}

        {/* ELO Change / Zone Score */}
        <div className="flex-shrink-0 w-20 text-center">
          {showZoneScore ? (
            <div className="text-xs font-bold text-orange-500">⏱ {battle.kothZoneScore}s</div>
          ) : (
            <div className={`text-xs font-bold ${eloClass}`}>{eloText}</div>
          )}
        </div>

        <div className="flex-shrink-0 w-16 text-right">
          <div className="text-xs font-medium text-foreground">₡{totalCredits.toLocaleString()}</div>
        </div>

        <div className="flex-shrink-0 w-6 text-center text-primary text-sm">
          →
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{modeConfig.icon}</span>
            {outcomeBadge('')}
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${modeConfig.badgeColor}`}>
              {modeBadgeLabel}
            </span>
          </div>
          <div className="text-xs text-secondary">
            {formatDateTime(battle.createdAt)}
          </div>
        </div>

        <div className="text-xs text-secondary mb-1.5">
          {typeText}
        </div>

        <div className="mb-1.5">
          {matchup('text-sm font-medium')}
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap justify-between text-xs gap-y-1">
          <div>
            <span className="text-tertiary">{isKoth ? 'Zone: ' : 'ELO: '}</span>
            {showZoneScore ? (
              <span className="font-bold text-orange-500">⏱ {battle.kothZoneScore}s</span>
            ) : (
              <span className={`font-bold ${eloClass}`}>{eloText}</span>
            )}
          </div>
          {prestige != null && prestige > 0 && (
            <div>
              <span className="text-xs font-medium text-info">⭐+{prestige}</span>
            </div>
          )}
          {fame != null && fame > 0 && (
            <div>
              <span className="text-xs font-medium text-warning">🎖️+{fame}</span>
            </div>
          )}
          <div>
            <span className="text-tertiary">₡</span>
            <span className="font-medium text-foreground">{totalCredits.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompactBattleCard;
