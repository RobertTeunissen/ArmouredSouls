/**
 * RobotDashboardCard Component
 * 
 * Visual card for displaying robot information on the dashboard
 * Includes portrait placeholder, HP bar, stats, and battle readiness
 */

import { useNavigate } from 'react-router-dom';
import HPBar from './HPBar';
import BattleReadinessBadge from './BattleReadinessBadge';

interface RobotDashboardCardProps {
  robot: {
    id: number;
    name: string;
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
    mainWeapon?: any;
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
        bg-surface border border-gray-700 rounded-lg p-4
        hover:border-primary hover:shadow-lg transition-all duration-200
        cursor-pointer
      "
      onClick={() => navigate(`/robots/${robot.id}`)}
    >
      <div className="flex gap-4">
        {/* Portrait Placeholder (128x128) */}
        <div className="flex-shrink-0 w-32 h-32 bg-surface-elevated rounded-lg flex items-center justify-center border border-gray-600">
          <svg 
            className="w-16 h-16 text-gray-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
            />
          </svg>
        </div>
        
        {/* Info Section */}
        <div className="flex-1 min-w-0">
          {/* Name and Status */}
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-white truncate mr-2">
              {robot.name}
            </h3>
            <BattleReadinessBadge status={readinessStatus} size="sm" />
          </div>
          
          {/* ELO and League */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">ELO:</span>
              <span className="text-base font-bold text-primary">{robot.elo}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">League:</span>
              <span className="text-sm font-semibold text-white">
                {formatLeague(robot.currentLeague)}
              </span>
            </div>
            {robot.leaguePoints !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">LP:</span>
                <span className="text-sm font-semibold text-white">
                  {robot.leaguePoints}
                </span>
              </div>
            )}
          </div>
          
          {/* HP Bar */}
          <div className="mb-3">
            <HPBar 
              current={robot.currentHP} 
              max={robot.maxHP} 
              label="HP"
              size="md"
            />
          </div>
          
          {/* Win/Loss Record */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">Record:</span>
            <span className="text-success font-semibold">{wins}W</span>
            <span className="text-error font-semibold">{losses}L</span>
            {draws > 0 && (
              <span className="text-gray-400 font-semibold">{draws}D</span>
            )}
            <span className="text-gray-400">
              ({winRate}% win rate)
            </span>
          </div>
        </div>
      </div>
      
      {/* Quick Actions (if needed repair) */}
      {readinessStatus === 'needs-repair' && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/robots/${robot.id}`);
            }}
            className="text-sm text-primary hover:text-primary-light font-semibold"
          >
            → Repair Robot
          </button>
        </div>
      )}
    </div>
  );
}

export default RobotDashboardCard;
