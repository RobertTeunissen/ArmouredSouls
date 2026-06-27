import React from 'react';
import { BattleHistory, getTournamentRoundName, getLeagueTierName } from '../utils/matchmakingApi';
import { formatDateTime } from '../utils/matchmakingApi';
import { getModeConfig, OUTCOME_BADGE_CONFIG } from '../utils/battleModeConfig';

interface BattleRobot {
  name: string;
  id: number;
  userId: number;
}

interface CompactBattleCardProps {
  battle: BattleHistory;
  myRobot: BattleRobot;
  opponent: BattleRobot;
  outcome: string;
  eloChange: number;
  myRobotId: number;
  reward: number;
  prestige?: number;
  fame?: number;
  streamingRevenue?: number;
  onClick: () => void;
}

const CompactBattleCard: React.FC<CompactBattleCardProps> = ({
  battle,
  myRobot,
  opponent,
  outcome,
  eloChange,
  myRobotId: _myRobotId,
  reward,
  prestige,
  fame,
  streamingRevenue,
  onClick,
}) => {
  const totalCredits = reward + (streamingRevenue ?? 0);
  const isTournament = battle.battleType === 'tournament_1v1';
  const isTeamTournament = battle.battleType === 'tournament_2v2' || battle.battleType === 'tournament_3v3';
  const isTagTeam = battle.battleType === 'tag_team';
  const isKoth = battle.battleType === 'koth';
  const isTeamBattle = battle.battleType === 'league_2v2' || battle.battleType === 'league_3v3';
  
  // Use shared mode config for consistent icon/badge/color across all views
  const modeConfig = getModeConfig(battle.battleType);
  
  const getBattleTypeIcon = (): string => {
    return modeConfig.icon;
  };
  
  const getBattleTypeText = (): React.ReactNode => {
    if (isKoth) {
      return 'King of the Hill';
    }
    if ((isTournament || isTeamTournament) && battle.tournamentName) {
      const roundName = battle.tournamentRound && battle.tournamentMaxRounds 
        ? getTournamentRoundName(battle.tournamentRound, battle.tournamentMaxRounds)
        : '';
      return `${battle.tournamentName}${roundName ? ` • ${roundName}` : ''}`;
    }
    if (isTournament) {
      const roundName = battle.tournamentRound && battle.tournamentMaxRounds 
        ? getTournamentRoundName(battle.tournamentRound, battle.tournamentMaxRounds)
        : '';
      return `Tournament${roundName ? ` • ${roundName}` : ''}`;
    }
    if (isTeamTournament) {
      const roundName = battle.tournamentRound && battle.tournamentMaxRounds 
        ? getTournamentRoundName(battle.tournamentRound, battle.tournamentMaxRounds)
        : '';
      const sizeLabel = battle.battleType === 'tournament_2v2' ? '2v2' : '3v3';
      return `${sizeLabel} Tournament${roundName ? ` • ${roundName}` : ''}`;
    }
    if (isTagTeam) {
      // Show league tier with "League" suffix — same as other league modes
      const leagueAtBattleTime = battle.leagueType || 'bronze';
      const tierName = getLeagueTierName(leagueAtBattleTime);
      return `${tierName} League`;
    }
    // For league matches, show league tier from battle record
    if (battle.leagueType) {
      return `${getLeagueTierName(battle.leagueType)} League`;
    }
    return 'League Match';
  };
  
  const getBorderColor = (): string => {
    // KotH battles get orange border (from config)
    if (isKoth) return modeConfig.borderColor;
    // Tournament battles get golden border (from config)
    if (isTournament || isTeamTournament) return modeConfig.borderColor;
    // Tag team battles get amber border (from config)
    if (isTagTeam) return modeConfig.borderColor;
    // Team league battles get their mode color
    if (isTeamBattle) return modeConfig.borderColor;
    // 1v1 League battles use outcome color
    switch (outcome) {
      case 'win': return 'border-l-[#3fb950]';
      case 'loss': return 'border-l-[#f85149]';
      case 'draw': return 'border-l-[#57606a]';
      default: return 'border-l-gray-700';
    }
  };

  const getKothPlacementSuffix = (placement: number): string => {
    if (placement === 1) return 'st';
    if (placement === 2) return 'nd';
    if (placement === 3) return 'rd';
    return 'th';
  };

  const getKothPlacementBadgeClass = (): string => {
    const placement = battle.kothPlacement;
    if (placement === 1) return 'bg-warning/20 text-warning';
    if (placement === 2) return 'bg-gray-400/20 text-gray-300';
    if (placement === 3) return 'bg-orange-600/20 text-orange-500';
    return 'bg-surface-elevated text-secondary';
  };
  
  const getOutcomeBadgeClass = () => {
    const config = OUTCOME_BADGE_CONFIG[outcome as keyof typeof OUTCOME_BADGE_CONFIG];
    return config?.badgeColor || 'bg-surface-elevated text-secondary';
  };

  // For tag team battles, use team names (consistent with 2v2/3v3 league display)
  let myTeamRobots = myRobot.name;
  let opponentTeamRobots = opponent.name;
  
  if (isTagTeam) {
    // Use team names from API (same as 2v2/3v3 league)
    // In tag-team battles, both robots on a team belong to the same stable (userId).
    // robot1 is always team 1's active robot, so check userId match to determine team.
    const battleAny = battle as unknown as { team1TeamName?: string; team2TeamName?: string };
    const isTeam1 = battle.robot1.userId === myRobot.userId;
    myTeamRobots = isTeam1
      ? (battleAny.team1TeamName || myRobot.name)
      : (battleAny.team2TeamName || myRobot.name);
    opponentTeamRobots = isTeam1
      ? (battleAny.team2TeamName || opponent.name)
      : (battleAny.team1TeamName || opponent.name);
  }
  
  return (
    <div 
      onClick={onClick}
      className={`
        bg-[#252b38] border border-white/10 rounded-lg p-2 mb-1.5
        border-l-4 ${getBorderColor()}
        hover:bg-[#1a1f29] hover:border-[#58a6ff]/50 cursor-pointer 
        transition-all duration-150 ease-out
        hover:-translate-y-0.5
      `}
    >
      {/* Desktop Layout */}
      <div className="hidden md:flex items-center gap-3">
        {/* Battle Type Icon */}
        <div className="flex-shrink-0 w-6 text-center text-base">
          {getBattleTypeIcon()}
        </div>
        
        {/* Outcome Badge */}
        <div className="flex-shrink-0 w-16">
          {isKoth && battle.kothPlacement != null && battle.kothParticipantCount != null ? (
            <div className={`text-xs font-bold px-1.5 py-0.5 rounded text-center ${getKothPlacementBadgeClass()}`}>
              {battle.kothPlacement}{getKothPlacementSuffix(battle.kothPlacement)} of {battle.kothParticipantCount}
            </div>
          ) : (
            <div className={`text-xs font-bold px-1.5 py-0.5 rounded text-center ${getOutcomeBadgeClass()}`}>
              {outcome === 'win' ? 'WIN' : outcome === 'loss' ? 'LOSS' : 'DRAW'}
            </div>
          )}
        </div>
        
        {isKoth ? (
          /* KotH Layout — free-for-all, no 1v1 matchup */
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs px-1.5 py-0.5 bg-orange-500/20 rounded text-orange-400 font-semibold">
                FFA
              </span>
              <div className="text-xs text-[#8b949e]">
                {getBattleTypeText()}
              </div>
            </div>
            <div className="font-medium text-xs truncate">
              <span className="text-[#58a6ff]">{myRobot.name}</span>
              <span className="text-[#8b949e] mx-1.5">• {battle.kothParticipantCount ?? '?'} robots</span>
            </div>
          </div>
        ) : isTagTeam ? (
          /* Tag Team Layout */
          <>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${modeConfig.badgeColor}`}>
                  {modeConfig.label}
                </span>
                <div className="text-xs text-[#8b949e]">
                  {getBattleTypeText()}
                </div>
              </div>
              <div className="font-medium text-xs truncate">
                <span className="text-[#58a6ff]">{myTeamRobots}</span>
                <span className="text-[#57606a] mx-1.5">vs</span>
                <span className="text-[#e6edf3]">{opponentTeamRobots}</span>
              </div>
            </div>
          </>
        ) : isTeamBattle ? (
          /* Team Battle Layout (2v2/3v3) */
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${modeConfig.badgeColor}`}>
                {modeConfig.label}
              </span>
              <div className="text-xs text-[#8b949e]">
                {getBattleTypeText()}
              </div>
            </div>
            <div className="font-medium text-xs truncate">
              <span className="text-[#58a6ff]">{(battle as unknown as { team1TeamName?: string }).team1TeamName || myRobot.name}</span>
              <span className="text-[#57606a] mx-1.5">vs</span>
              <span className="text-[#e6edf3]">{(battle as unknown as { team2TeamName?: string }).team2TeamName || opponent.name}</span>
            </div>
          </div>
        ) : isTeamTournament ? (
          /* Team Tournament Layout (2v2/3v3 🏆) */
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${modeConfig.badgeColor}`}>
                {modeConfig.label}
              </span>
              <div className="text-xs text-[#8b949e]">
                {getBattleTypeText()}
              </div>
            </div>
            <div className="font-medium text-xs truncate">
              <span className="text-[#58a6ff]">{(battle as unknown as { team1TeamName?: string }).team1TeamName || myRobot.name}</span>
              <span className="text-[#57606a] mx-1.5">vs</span>
              <span className="text-[#e6edf3]">{(battle as unknown as { team2TeamName?: string }).team2TeamName || opponent.name}</span>
            </div>
          </div>
        ) : (
          /* Standard 1v1 Layout */
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${modeConfig.badgeColor}`}>
                {modeConfig.label}
              </span>
              <div className="text-xs text-[#8b949e]">
                {getBattleTypeText()}
              </div>
            </div>
            <div className="font-medium text-xs truncate">
              <span className="text-[#58a6ff]">{myRobot.name}</span>
              <span className="text-[#57606a] mx-1.5">vs</span>
              <span className="text-[#e6edf3]">{opponent.name}</span>
            </div>
          </div>
        )}
        
        {/* Date */}
        <div className="flex-shrink-0 w-28 text-xs text-[#8b949e]">
          {formatDateTime(battle.createdAt)}
        </div>
        
        {/* Prestige & Fame Indicators */}
        {(prestige != null && prestige > 0) || (fame != null && fame > 0) ? (
          <div className="flex-shrink-0 flex items-center gap-2">
            {prestige != null && prestige > 0 && (
              <span className="text-xs font-medium text-[#a371f7]">⭐+{prestige}</span>
            )}
            {fame != null && fame > 0 && (
              <span className="text-xs font-medium text-[#d29922]">🎖️+{fame}</span>
            )}
          </div>
        ) : null}
        
        {/* ELO Change / Zone Score */}
        <div className="flex-shrink-0 w-20 text-center">
          {isKoth && battle.kothZoneScore != null ? (
            <div className="text-xs font-bold text-orange-500">
              ⏱ {battle.kothZoneScore}s
            </div>
          ) : (
            <div className={`text-xs font-bold ${eloChange >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
              {eloChange > 0 ? '+' : ''}{eloChange}
            </div>
          )}
        </div>
        
        {/* Reward */}
        <div className="flex-shrink-0 w-16 text-right">
          <div className="text-xs font-medium text-[#e6edf3]">₡{totalCredits.toLocaleString()}</div>
        </div>
        
        {/* Arrow Icon */}
        <div className="flex-shrink-0 w-6 text-center text-[#58a6ff] text-sm">
          →
        </div>
      </div>
      
      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{getBattleTypeIcon()}</span>
            {isKoth && battle.kothPlacement != null && battle.kothParticipantCount != null ? (
              <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${getKothPlacementBadgeClass()}`}>
                {battle.kothPlacement}{getKothPlacementSuffix(battle.kothPlacement)} of {battle.kothParticipantCount}
              </div>
            ) : (
              <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${getOutcomeBadgeClass()}`}>
                {outcome === 'win' ? 'WIN' : outcome === 'loss' ? 'LOSS' : 'DRAW'}
              </div>
            )}
            {isKoth && (
              <span className="text-xs px-1.5 py-0.5 bg-orange-500/20 rounded text-orange-400 font-semibold">
                FFA
              </span>
            )}
            {isTagTeam && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${modeConfig.badgeColor}`}>
                {modeConfig.label}
              </span>
            )}
            {isTeamBattle && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${modeConfig.badgeColor}`}>
                {modeConfig.label}
              </span>
            )}
            {isTeamTournament && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${modeConfig.badgeColor}`}>
                {modeConfig.label}
              </span>
            )}
            {!isKoth && !isTagTeam && !isTeamBattle && !isTeamTournament && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${modeConfig.badgeColor}`}>
                {modeConfig.label}
              </span>
            )}
          </div>
          <div className="text-xs text-[#8b949e]">
            {formatDateTime(battle.createdAt)}
          </div>
        </div>
        
        {/* Battle Type */}
        <div className="text-xs text-[#8b949e] mb-1.5">
          {getBattleTypeText()}
        </div>
        
        {/* Matchup Row */}
        <div className="mb-1.5">
          {isKoth ? (
            <div className="text-sm font-medium">
              <span className="text-[#58a6ff]">{myRobot.name}</span>
              <span className="text-[#8b949e] mx-1.5">• {battle.kothParticipantCount ?? '?'} robots</span>
            </div>
          ) : isTagTeam ? (
            <>
              <div className="text-sm font-medium mb-1">
                <span className="text-[#58a6ff]">{myTeamRobots}</span>
                <span className="text-[#57606a] mx-1.5">vs</span>
                <span className="text-[#e6edf3]">{opponentTeamRobots}</span>
              </div>
            </>
          ) : isTeamBattle ? (
            <div className="text-sm font-medium">
              <span className="text-[#58a6ff]">{(battle as unknown as { team1TeamName?: string }).team1TeamName || myRobot.name}</span>
              <span className="text-[#57606a] mx-1.5">vs</span>
              <span className="text-[#e6edf3]">{(battle as unknown as { team2TeamName?: string }).team2TeamName || opponent.name}</span>
            </div>
          ) : isTeamTournament ? (
            <div className="text-sm font-medium">
              <span className="text-[#58a6ff]">{(battle as unknown as { team1TeamName?: string }).team1TeamName || myRobot.name}</span>
              <span className="text-[#57606a] mx-1.5">vs</span>
              <span className="text-[#e6edf3]">{(battle as unknown as { team2TeamName?: string }).team2TeamName || opponent.name}</span>
            </div>
          ) : (
            <div className="text-sm font-medium">
              <span className="text-[#58a6ff]">{myRobot.name}</span>
              <span className="text-[#57606a] mx-1.5">vs</span>
              <span className="text-[#e6edf3]">{opponent.name}</span>
            </div>
          )}
        </div>
        
        {/* Stats Row */}
        <div className="flex flex-wrap justify-between text-xs gap-y-1">
          <div>
            <span className="text-[#57606a]">{isKoth ? 'Zone: ' : 'ELO: '}</span>
            {isKoth && battle.kothZoneScore != null ? (
              <span className="font-bold text-orange-500">
                ⏱ {battle.kothZoneScore}s
              </span>
            ) : (
              <span className={`font-bold ${eloChange >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                {eloChange > 0 ? '+' : ''}{eloChange}
              </span>
            )}
          </div>
          {prestige != null && prestige > 0 && (
            <div>
              <span className="text-xs font-medium text-[#a371f7]">⭐+{prestige}</span>
            </div>
          )}
          {fame != null && fame > 0 && (
            <div>
              <span className="text-xs font-medium text-[#d29922]">🎖️+{fame}</span>
            </div>
          )}
          <div>
            <span className="text-[#57606a]">₡</span>
            <span className="font-medium text-[#e6edf3]">{totalCredits.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompactBattleCard;
