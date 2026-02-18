/**
 * StableStatistics component
 * Displays aggregate performance metrics across all robots in the stable
 */

import { useEffect, useState } from 'react';
import { getStableStatistics, StableStatistics as StableStatsType } from '../utils/userApi';

function StableStatistics() {
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

  // Format change indicator
  const formatChange = (value: number, showPlus: boolean = true) => {
    if (value === 0) return null;
    const sign = value > 0 ? '+' : '';
    const color = value > 0 ? 'text-success' : 'text-error';
    return (
      <span className={`text-xs ${color} ml-1`}>
        {showPlus ? sign : ''}{value}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold mb-3">Stable Overview</h2>
        <div className="text-center py-4 text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold mb-3">Stable Overview</h2>
        <div className="text-center py-4 text-error">{error || 'No data available'}</div>
      </div>
    );
  }

  return (
    <div className="bg-surface p-4 rounded-lg border border-gray-700">
      <h2 className="text-lg font-semibold mb-3">Stable Overview</h2>
      
      <div className="space-y-3">
        {/* Prestige, Record, and ELO on same line */}
        <div className="pb-3 border-b border-gray-700">
          <div className="flex items-center justify-between gap-4">
            {/* Prestige */}
            <div>
              <div className="text-xs text-gray-400 mb-1">Prestige</div>
              <div className="text-xl font-bold text-info">
                {stats.prestige.toLocaleString()}
                {stats.cycleChanges && stats.cycleChanges.prestige !== 0 && (
                  <span className="text-sm text-success ml-1">
                    (+{stats.cycleChanges.prestige})
                  </span>
                )}
              </div>
            </div>

            {/* W/L Record */}
            <div>
              <div className="text-xs text-gray-400 mb-1">Record</div>
              <div className="flex items-baseline gap-2">
                <span className="text-success font-semibold">{stats.wins}W</span>
                <span className="text-error font-semibold">{stats.losses}L</span>
                {stats.cycleChanges && (stats.cycleChanges.wins !== 0 || stats.cycleChanges.losses !== 0) && (
                  <span className="text-xs text-gray-400">
                    ({[
                      stats.cycleChanges.wins !== 0 && `+${stats.cycleChanges.wins}W`,
                      stats.cycleChanges.losses !== 0 && `+${stats.cycleChanges.losses}L`
                    ].filter(Boolean).join(', ')})
                  </span>
                )}
              </div>
            </div>

            {/* Highest ELO */}
            <div>
              <div className="text-xs text-gray-400 mb-1">Highest ELO</div>
              <div className="text-lg font-bold text-primary">
                {stats.highestELO}
                {stats.cycleChanges && formatChange(stats.cycleChanges.highestElo)}
              </div>
            </div>
          </div>
        </div>

        {/* Compact Stats Grid - 2 columns */}
        <div className="grid grid-cols-2 gap-3">
          {/* Highest League */}
          <div>
            <div className="text-xs text-gray-400 mb-1">Highest League</div>
            <div className="text-sm font-semibold text-white">
              {formatLeague(stats.highestLeague)}
            </div>
          </div>

          {/* Highest Tag Team League */}
          <div>
            <div className="text-xs text-gray-400 mb-1">Tag Team League</div>
            <div className="text-sm font-semibold text-white">
              {stats.highestTagTeamLeague ? formatLeague(stats.highestTagTeamLeague) : 'None'}
            </div>
          </div>
        </div>

        {/* Bottom Stats - Single Row */}
        <div className="pt-3 border-t border-gray-700 flex justify-between text-xs text-gray-400">
          <span>{stats.totalRobots} Robot{stats.totalRobots !== 1 ? 's' : ''}</span>
          <span>{stats.totalBattles} Battle{stats.totalBattles !== 1 ? 's' : ''}</span>
          <span className={stats.winRate >= 50 ? 'text-success' : 'text-error'}>
            {stats.winRate.toFixed(1)}% WR
          </span>
        </div>
      </div>
    </div>
  );
}

export default StableStatistics;
