/**
 * StableStatistics component
 * Displays aggregate performance metrics across all robots in the stable
 */

import { useEffect, useState } from 'react';
import { getStableStatistics, StableStatistics as StableStatsType } from '../utils/userApi';

interface StableStatisticsProps {
  prestige?: number;
}

function StableStatistics({ prestige }: StableStatisticsProps) {
  const [stats, setStats] = useState<StableStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await getStableStatistics();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch stable statistics:', err);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  // Format league name
  const formatLeague = (league: string | null) => {
    if (!league) return 'Unranked';
    return league.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Determine win rate color
  const getWinRateColor = (winRate: number) => {
    if (winRate >= 60) return 'text-success';
    if (winRate >= 40) return 'text-warning';
    return 'text-error';
  };

  if (loading) {
    return (
      <div className="bg-surface p-6 rounded-lg border border-gray-700">
        <h2 className="text-2xl font-semibold mb-4">Stable Overview</h2>
        <div className="text-center py-4 text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-surface p-6 rounded-lg border border-gray-700">
        <h2 className="text-2xl font-semibold mb-4">Stable Overview</h2>
        <div className="text-center py-4 text-error">{error || 'No data available'}</div>
      </div>
    );
  }

  return (
    <div className="bg-surface p-4 rounded-lg border border-gray-700">
      <h2 className="text-lg font-semibold mb-3">Stable Overview</h2>
      
      <div className="space-y-2">
        {/* Prestige - Most Prominent */}
        {prestige !== undefined && (
          <div className="pb-2 border-b border-gray-700">
            <div className="text-xs text-gray-400">Prestige</div>
            <div className="text-2xl font-bold text-info">{prestige.toLocaleString()}</div>
          </div>
        )}

        {/* Compact Stats Grid - 3 columns */}
        <div className="grid grid-cols-3 gap-2">
          {/* Total Robots */}
          <div>
            <div className="text-xs text-gray-400">Robots</div>
            <div className="text-lg font-bold text-white">{stats.totalRobots}</div>
          </div>

          {/* Battle Ready */}
          <div>
            <div className="text-xs text-gray-400">Ready</div>
            <div className="text-lg font-bold text-success">{stats.robotsReady}</div>
          </div>

          {/* Total Battles */}
          <div>
            <div className="text-xs text-gray-400">Battles</div>
            <div className="text-lg font-bold text-white">{stats.totalBattles}</div>
          </div>

          {/* Win Rate */}
          <div>
            <div className="text-xs text-gray-400">Win Rate</div>
            <div className={`text-lg font-bold ${getWinRateColor(stats.winRate)}`}>
              {stats.winRate.toFixed(1)}%
            </div>
          </div>

          {/* Average ELO */}
          <div>
            <div className="text-xs text-gray-400">Avg ELO</div>
            <div className="text-lg font-bold text-primary">{stats.avgELO}</div>
          </div>

          {/* Highest League */}
          <div>
            <div className="text-xs text-gray-400">League</div>
            <div className="text-sm font-semibold text-white truncate">
              {formatLeague(stats.highestLeague)}
            </div>
          </div>
        </div>

        {/* W/L/D Record - Compact */}
        <div className="pt-2 border-t border-gray-700">
          <div className="flex gap-3 justify-center text-sm">
            <span className="text-success font-semibold">{stats.wins}W</span>
            <span className="text-error font-semibold">{stats.losses}L</span>
            {stats.draws > 0 && (
              <span className="text-gray-400 font-semibold">{stats.draws}D</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StableStatistics;
