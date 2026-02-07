/**
 * StableStatistics component
 * Displays aggregate performance metrics across all robots in the stable
 */

import { useEffect, useState } from 'react';
import { getStableStatistics, StableStatistics as StableStatsType } from '../utils/userApi';

interface StableStatisticsProps {
  prestige?: number;
  stableName?: string;
}

function StableStatistics({ prestige, stableName }: StableStatisticsProps) {
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
    <div className="bg-surface p-6 rounded-lg border border-gray-700">
      <h2 className="text-2xl font-semibold mb-4">Stable Overview</h2>
      
      <div className="space-y-4">
        {/* Stable Name and Prestige - Most Prominent */}
        {stableName && (
          <div className="pb-4 border-b border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Stable Name</div>
            <div className="text-2xl font-bold text-white">{stableName}</div>
          </div>
        )}
        
        {prestige !== undefined && (
          <div className="pb-4 border-b border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Prestige</div>
            <div className="text-3xl font-bold text-info">{prestige.toLocaleString()}</div>
          </div>
        )}

        {/* Total Battles */}
        <div className="flex justify-between items-center pb-3 border-b border-gray-700">
          <span className="text-sm text-gray-400">Total Battles:</span>
          <span className="text-xl font-bold text-white">{stats.totalBattles}</span>
        </div>

        {/* Win Rate */}
        <div className="flex justify-between items-center pb-3 border-b border-gray-700">
          <span className="text-sm text-gray-400">Win Rate:</span>
          <span className={`text-xl font-bold ${getWinRateColor(stats.winRate)}`}>
            {stats.winRate.toFixed(1)}%
          </span>
        </div>

        {/* W/L/D Record */}
        <div className="pb-3 border-b border-gray-700">
          <div className="text-sm text-gray-400 mb-2">Record:</div>
          <div className="flex gap-4 justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{stats.wins}</div>
              <div className="text-xs text-gray-400">Wins</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-error">{stats.losses}</div>
              <div className="text-xs text-gray-400">Losses</div>
            </div>
            {stats.draws > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-400">{stats.draws}</div>
                <div className="text-xs text-gray-400">Draws</div>
              </div>
            )}
          </div>
        </div>

        {/* Average ELO */}
        <div className="flex justify-between items-center pb-3 border-b border-gray-700">
          <span className="text-sm text-gray-400">Average ELO:</span>
          <span className="text-xl font-bold text-primary">{stats.avgELO}</span>
        </div>

        {/* Highest League */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Highest League:</span>
          <span className="text-base font-semibold text-white">
            {formatLeague(stats.highestLeague)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default StableStatistics;
