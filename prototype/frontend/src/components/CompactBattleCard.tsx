import React from 'react';
import { BattleHistory, getTournamentRoundName, getLeagueTierName } from '../utils/matchmakingApi';
import { formatDateTime } from '../utils/matchmakingApi';

interface CompactBattleCardProps {
  battle: BattleHistory;
  myRobot: any;
  opponent: any;
  outcome: string;
  eloChange: number;
  myRobotId: number;
  reward: number;
  onClick: () => void;
}

const CompactBattleCard: React.FC<CompactBattleCardProps> = ({
  battle,
  myRobot,
  opponent,
  outcome,
  eloChange,
  // myRobotId is used in commented-out ELO calculations
  // myRobotId,
  reward,
  onClick,
}) => {
  const isTournament = battle.battleType === 'tournament';
  // Note: isLeague can be derived but not currently used in display logic
  
  const getBattleTypeIcon = () => {
    if (isTournament) {
      return '🏆';
    }
    return '⚔️'; // League match
  };
  
  const getBattleTypeText = () => {
    if (isTournament && battle.tournamentName) {
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
    // For league matches, show league tier if available
    if (myRobot.currentLeague) {
      return `${getLeagueTierName(myRobot.currentLeague)} League`;
    }
    return 'League Match';
  };
  
  const getBorderColor = () => {
    // Tournament battles get yellow border regardless of outcome
    if (isTournament) return 'border-l-[#d29922]';
    // League battles use outcome color
    switch (outcome) {
      case 'win': return 'border-l-[#3fb950]';
      case 'loss': return 'border-l-[#f85149]';
      case 'draw': return 'border-l-[#57606a]';
      default: return 'border-l-gray-700';
    }
  };
  
  const getOutcomeBadgeClass = () => {
    switch (outcome) {
      case 'win': return 'bg-[#3fb950]/20 text-[#3fb950]';
      case 'loss': return 'bg-[#f85149]/20 text-[#f85149]';
      case 'draw': return 'bg-[#57606a]/20 text-[#57606a]';
      default: return 'bg-gray-700 text-gray-400';
    }
  };

  // ELO values available if needed for future display
  // const myRobotELOBefore = battle.robot1Id === myRobotId ? battle.robot1ELOBefore : battle.robot2ELOBefore;
  // const myRobotELOAfter = battle.robot1Id === myRobotId ? battle.robot1ELOAfter : battle.robot2ELOAfter;
  
  return (
    <div 
      onClick={onClick}
      className={`
        bg-[#252b38] border border-gray-700 rounded-lg p-2 mb-1.5
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
          <div className={`text-xs font-bold px-1.5 py-0.5 rounded text-center ${getOutcomeBadgeClass()}`}>
            {outcome === 'win' ? 'WIN' : outcome === 'loss' ? 'LOSS' : 'DRAW'}
          </div>
        </div>
        
        {/* Matchup */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-xs truncate">
            <span className="text-[#58a6ff]">{myRobot.name}</span>
            <span className="text-[#57606a] mx-1.5">vs</span>
            <span className="text-[#e6edf3]">{opponent.name}</span>
          </div>
          <div className="text-xs text-[#8b949e] truncate">
            {getBattleTypeText()}
          </div>
        </div>
        
        {/* Date */}
        <div className="flex-shrink-0 w-28 text-xs text-[#8b949e]">
          {formatDateTime(battle.createdAt)}
        </div>
        
        {/* ELO Change */}
        <div className="flex-shrink-0 w-20 text-center">
          <div className={`text-xs font-bold ${eloChange >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
            {eloChange > 0 ? '+' : ''}{eloChange}
          </div>
        </div>
        
        {/* Reward */}
        <div className="flex-shrink-0 w-16 text-right">
          <div className="text-xs font-medium text-[#e6edf3]">₡{reward.toLocaleString()}</div>
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
            <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${getOutcomeBadgeClass()}`}>
              {outcome === 'win' ? 'WIN' : outcome === 'loss' ? 'LOSS' : 'DRAW'}
            </div>
          </div>
          <div className="text-xs text-[#8b949e]">
            {formatDateTime(battle.createdAt)}
          </div>
        </div>
        
        {/* Matchup Row */}
        <div className="mb-1.5">
          <div className="text-sm font-medium">
            <span className="text-[#58a6ff]">{myRobot.name}</span>
            <span className="text-[#57606a] mx-1.5">vs</span>
            <span className="text-[#e6edf3]">{opponent.name}</span>
          </div>
          <div className="text-xs text-[#8b949e]">
            {getBattleTypeText()}
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="flex justify-between text-xs">
          <div>
            <span className="text-[#57606a]">ELO: </span>
            <span className={`font-bold ${eloChange >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
              {eloChange > 0 ? '+' : ''}{eloChange}
            </span>
          </div>
          <div>
            <span className="text-[#57606a]">₡</span>
            <span className="font-medium text-[#e6edf3]">{reward.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompactBattleCard;
