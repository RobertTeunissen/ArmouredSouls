import React from 'react';
import { BattleHistory } from '../utils/matchmakingApi';
import { formatDateTime, formatDuration } from '../utils/matchmakingApi';

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
  myRobotId,
  reward,
  onClick,
}) => {
  const isTournament = battle.battleType === 'tournament';
  
  const getBorderColor = () => {
    if (isTournament) return 'border-l-[#d29922]';
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

  const myRobotELOBefore = battle.robot1Id === myRobotId ? battle.robot1ELOBefore : battle.robot2ELOBefore;
  const myRobotELOAfter = battle.robot1Id === myRobotId ? battle.robot1ELOAfter : battle.robot2ELOAfter;
  
  return (
    <div 
      onClick={onClick}
      className={`
        bg-[#252b38] border border-gray-700 rounded-lg p-3 mb-2
        border-l-4 ${getBorderColor()}
        hover:bg-[#1a1f29] hover:border-[#58a6ff]/50 cursor-pointer 
        transition-all duration-150 ease-out
        hover:-translate-y-0.5
      `}
    >
      {/* Desktop Layout */}
      <div className="hidden md:flex items-center gap-4">
        {/* Outcome Badge */}
        <div className="flex-shrink-0 w-20">
          <div className={`text-xs font-bold px-2 py-1 rounded text-center ${getOutcomeBadgeClass()}`}>
            {outcome === 'win' ? 'VICTORY' : outcome === 'loss' ? 'DEFEAT' : 'DRAW'}
          </div>
          {isTournament && (
            <div className="text-xs text-[#d29922] mt-1 text-center">🏆</div>
          )}
        </div>
        
        {/* Matchup */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            <span className="text-[#58a6ff]">{myRobot.name}</span>
            <span className="text-[#57606a] mx-2">vs</span>
            <span className="text-[#e6edf3]">{opponent.name}</span>
          </div>
          <div className="text-xs text-[#8b949e] truncate">
            {opponent.user.username}
          </div>
        </div>
        
        {/* Date */}
        <div className="flex-shrink-0 w-32 text-xs text-[#8b949e]">
          {formatDateTime(battle.createdAt)}
        </div>
        
        {/* ELO Change */}
        <div className="flex-shrink-0 w-24">
          <div className={`text-sm font-bold ${eloChange >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
            {eloChange > 0 ? '+' : ''}{eloChange}
          </div>
          <div className="text-xs text-[#57606a]">
            {myRobotELOBefore} → {myRobotELOAfter}
          </div>
        </div>
        
        {/* Reward */}
        <div className="flex-shrink-0 w-24 text-right">
          <div className="text-sm font-medium text-[#e6edf3]">₡{reward.toLocaleString()}</div>
          <div className="text-xs text-[#57606a]">{formatDuration(battle.durationSeconds)}</div>
        </div>
        
        {/* Arrow Icon */}
        <div className="flex-shrink-0 w-8 text-center text-[#58a6ff]">
          →
        </div>
      </div>
      
      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-2">
          <div className={`text-xs font-bold px-2 py-1 rounded ${getOutcomeBadgeClass()}`}>
            {outcome === 'win' ? 'VICTORY' : outcome === 'loss' ? 'DEFEAT' : 'DRAW'}
            {isTournament && ' 🏆'}
          </div>
          <div className="text-xs text-[#8b949e]">
            {formatDateTime(battle.createdAt)}
          </div>
        </div>
        
        {/* Matchup Row */}
        <div className="mb-2">
          <div className="text-sm font-medium">
            <span className="text-[#58a6ff]">{myRobot.name}</span>
            <span className="text-[#57606a] mx-2">vs</span>
            <span className="text-[#e6edf3]">{opponent.name}</span>
          </div>
          <div className="text-xs text-[#8b949e]">{opponent.user.username}</div>
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
          <div className="text-[#57606a]">
            {formatDuration(battle.durationSeconds)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompactBattleCard;
