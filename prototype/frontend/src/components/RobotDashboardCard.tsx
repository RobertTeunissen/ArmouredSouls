/**
 * RobotDashboardCard Component
 * 
 * Visual card for displaying robot information on the dashboard
 * Includes portrait, HP bar, stats, and battle readiness
 */

import { useNavigate } from 'react-router-dom';
import HPBar from './HPBar';
import BattleReadinessBadge from './BattleReadinessBadge';
import RobotImage from './RobotImage';

interface RobotDashboardCardProps {
  robot: {
    id: number;
    name: string;
    imageUrl: string | null;
    elo: number;
    currentHP: number;
    maxHP: number;
    currentShield?: number;
    maxShield?: number;
    currentLeague?: string;
    leaguePoints?: number;
    wins?: number;
    losses?: number;
    draws?: number;
    totalBattles?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mainWeapon?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    offhandWeapon?: any;
    loadoutType?: string;
  };
}

function RobotDashboardCard({ robot }: RobotDashboardCardProps) {
  const navigate = useNavigate();
  
  // Calculate battle readiness
  const getBattleReadiness = (): 'ready' | 'needs-repair' | 'no-weapon' => {
    // Check HP (needs repair if < 100%)
    if (robot.currentHP < robot.maxHP) {
      return 'needs-repair';
    }
    
    // Check weapon based on loadout type
    if (!robot.mainWeapon) {
      return 'no-weapon';
    }
    
    // Check offhand for loadout types that require it
    if (robot.loadoutType === 'dual_wield' || robot.loadoutType === 'weapon_shield') {
      if (!robot.offhandWeapon) {
        return 'no-weapon';
      }
    }
    
    return 'ready';
  };
  
  const readinessStatus = getBattleReadiness();
  
  // Format league name
  const formatLeague = (league?: string) => {
    if (!league) return 'Unranked';
    return league.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };
  
  // Calculate win rate
  const totalBattles = robot.totalBattles || 0;
  const wins = robot.wins || 0;
  const losses = robot.losses || 0;
  const draws = robot.draws || 0;
  const winRate = totalBattles > 0 ? ((wins / totalBattles) * 100).toFixed(0) : '0';
  
  return (
    <div 
      className="
        bg-surface border border-gray-700 rounded-lg p-3
        hover:border-primary hover:shadow-lg transition-all duration-200
        cursor-pointer
      "
      onClick={() => navigate(`/robots/${robot.id}`)}
    >
      <div className="flex gap-3">
        {/* Robot Portrait (96x96) */}
        <RobotImage
          imageUrl={robot.imageUrl}
          robotName={robot.name}
          size="medium"
          className="flex-shrink-0"
        />
        
        {/* Info Section */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Name and Status */}
          <div className="flex items-start justify-between mb-1.5 gap-2">
            <h3 className="text-base font-semibold text-white truncate flex-1">
              {robot.name}
            </h3>
            <BattleReadinessBadge status={readinessStatus} size="sm" />
          </div>
          
          {/* ELO and League - More compact */}
          <div className="flex items-center gap-3 mb-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-gray-400">ELO:</span>
              <span className="font-bold text-primary">{robot.elo}</span>
            </div>
            <div className="flex items-center gap-1 truncate">
              <span className="text-gray-400">League:</span>
              <span className="font-semibold text-white truncate">
                {formatLeague(robot.currentLeague)}
              </span>
            </div>
            {robot.leaguePoints !== undefined && (
              <div className="flex items-center gap-1">
                <span className="text-gray-400">LP:</span>
                <span className="font-semibold text-white">
                  {robot.leaguePoints}
                </span>
              </div>
            )}
          </div>
          
          {/* HP Bar */}
          <div className="mb-2">
            <HPBar 
              current={robot.currentHP} 
              max={robot.maxHP} 
              label="HP"
              size="sm"
            />
          </div>
          
          {/* Win/Loss Record - More compact */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-gray-400">Record:</span>
            <span className="text-success font-semibold">{wins}W</span>
            <span className="text-error font-semibold">{losses}L</span>
            {draws > 0 && (
              <span className="text-gray-400 font-semibold">{draws}D</span>
            )}
            <span className="text-gray-400">
              ({winRate}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RobotDashboardCard;
