/**
 * RobotDashboardCard Component
 * 
 * Visual card for displaying robot information on the dashboard.
 * Supports two variants:
 *   - 'owner' (default): Shows HP bar, battle readiness badge, weapon details
 *   - 'public': Shows fame, fame tier, total battles, kills, lifetime damage stats
 */

import { useNavigate } from 'react-router-dom';
import HPBar from './HPBar';
import BattleReadinessBadge from './BattleReadinessBadge';
import RobotImage from './RobotImage';
import { getFameTier } from '../utils/fameTiers';

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
    // Public-only fields (available when variant === 'public')
    fame?: number;
    kills?: number;
    damageDealtLifetime?: number;
    damageTakenLifetime?: number;
  };
  variant?: 'owner' | 'public';
}

function RobotDashboardCard({ robot, variant = 'owner' }: RobotDashboardCardProps) {
  const navigate = useNavigate();
  const isPublic = variant === 'public';

  // Calculate battle readiness (owner variant only)
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
  
  const readinessStatus = !isPublic ? getBattleReadiness() : null;
  
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

  // Fame tier (public variant only)
  const fameTier = isPublic && robot.fame != null ? getFameTier(robot.fame) : null;

  // Fame tier badge color
  const fameTierColor: Record<string, string> = {
    Unknown: 'bg-gray-600 text-gray-200',
    Known: 'bg-blue-800 text-blue-200',
    Famous: 'bg-purple-800 text-purple-200',
    Renowned: 'bg-amber-800 text-amber-200',
    Legendary: 'bg-orange-800 text-orange-200',
    Mythical: 'bg-red-800 text-red-200',
  };
  
  return (
    <div 
      className="
        bg-surface border border-white/10 rounded-lg p-3
        hover:border-primary hover:shadow-lg transition-all duration-200
        cursor-pointer min-h-[44px]
      "
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/robots/${robot.id}`)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/robots/${robot.id}`); }}
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
            {!isPublic && readinessStatus && (
              <BattleReadinessBadge status={readinessStatus} size="sm" />
            )}
            {isPublic && fameTier && (
              <span
                className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-semibold ${fameTierColor[fameTier] || 'bg-gray-600 text-gray-200'}`}
              >
                {fameTier}
              </span>
            )}
          </div>
          
          {/* ELO and League - More compact */}
          <div className="flex items-center gap-3 mb-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-secondary">ELO:</span>
              <span className="font-bold text-primary">{robot.elo}</span>
            </div>
            <div className="flex items-center gap-1 truncate">
              <span className="text-secondary">League:</span>
              <span className="font-semibold text-white truncate">
                {formatLeague(robot.currentLeague)}
              </span>
            </div>
            {robot.leaguePoints !== undefined && (
              <div className="flex items-center gap-1">
                <span className="text-secondary">LP:</span>
                <span className="font-semibold text-white">
                  {robot.leaguePoints}
                </span>
              </div>
            )}
          </div>
          
          {/* HP Bar - Owner variant only */}
          {!isPublic && (
            <div className="mb-2">
              <HPBar 
                current={robot.currentHP} 
                max={robot.maxHP} 
                label="HP"
                size="sm"
              />
            </div>
          )}
          
          {/* Win/Loss Record - More compact */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-secondary">Record:</span>
            <span className="text-success font-semibold">{wins}W</span>
            <span className="text-error font-semibold">{losses}L</span>
            {draws > 0 && (
              <span className="text-secondary font-semibold">{draws}D</span>
            )}
            <span className="text-secondary">
              ({winRate}%)
            </span>
          </div>

          {/* Public variant: fame, battles, kills, lifetime damage */}
          {isPublic && (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {robot.fame != null && (
                <div className="flex items-center gap-1">
                  <span className="text-secondary">Fame:</span>
                  <span className="font-semibold text-white">{robot.fame.toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span className="text-secondary">Battles:</span>
                <span className="font-semibold text-white">{totalBattles.toLocaleString()}</span>
              </div>
              {robot.kills != null && (
                <div className="flex items-center gap-1">
                  <span className="text-secondary">Kills:</span>
                  <span className="font-semibold text-white">{robot.kills.toLocaleString()}</span>
                </div>
              )}
              {robot.damageDealtLifetime != null && (
                <div className="flex items-center gap-1">
                  <span className="text-secondary">Dmg Dealt:</span>
                  <span className="font-semibold text-white">{robot.damageDealtLifetime.toLocaleString()}</span>
                </div>
              )}
              {robot.damageTakenLifetime != null && (
                <div className="flex items-center gap-1">
                  <span className="text-secondary">Dmg Taken:</span>
                  <span className="font-semibold text-white">{robot.damageTakenLifetime.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RobotDashboardCard;
