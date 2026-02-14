import { useState, useEffect } from 'react';
import axios from 'axios';

interface RankingEntry {
  rank: number;
  total: number;
  percentile: number;
  value: number;
}

interface RobotRankings {
  combatCategory: RankingEntry;
  defenseCategory: RankingEntry;
  chassisCategory: RankingEntry;
  aiCategory: RankingEntry;
  teamCategory: RankingEntry;
  totalDamageDealt: RankingEntry;
  winRate: RankingEntry;
  elo: RankingEntry;
  kdRatio: RankingEntry;
}

interface StatisticalRankingsProps {
  robotId: number;
}

const categoryColors: { [key: string]: string } = {
  combatCategory: '#f85149',
  defenseCategory: '#58a6ff',
  chassisCategory: '#3fb950',
  aiCategory: '#d29922',
  teamCategory: '#a371f7',
};

const categoryIcons: { [key: string]: string } = {
  combatCategory: '⚔️',
  defenseCategory: '🛡️',
  chassisCategory: '⚙️',
  aiCategory: '🧠',
  teamCategory: '👥',
  totalDamageDealt: '💥',
  winRate: '🏆',
  elo: '📊',
  kdRatio: '⚡',
};

const categoryNames: { [key: string]: string } = {
  combatCategory: 'Combat',
  defenseCategory: 'Defense',
  chassisCategory: 'Chassis',
  aiCategory: 'AI',
  teamCategory: 'Team',
  totalDamageDealt: 'Total Damage',
  winRate: 'Win Rate',
  elo: 'ELO Rating',
  kdRatio: 'K/D Ratio',
};

function getBadge(percentile: number): { label: string; color: string } | null {
  if (percentile >= 90) {
    return { label: 'Top 10%', color: 'bg-yellow-500' };
  } else if (percentile >= 75) {
    return { label: 'Top 25%', color: 'bg-gray-400' };
  } else if (percentile >= 50) {
    return { label: 'Top 50%', color: 'bg-amber-700' };
  }
  return null;
}

function StatisticalRankings({ robotId }: StatisticalRankingsProps) {
  const [rankings, setRankings] = useState<RobotRankings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchRankings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await axios.get(`/api/robots/${robotId}/rankings`);
        if (isMounted) {
          setRankings(response.data);
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load rankings');
          console.error('Rankings fetch error:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRankings();

    // Refresh rankings every 5 minutes
    const intervalId = setInterval(fetchRankings, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [robotId]);

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">Statistical Rankings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="bg-gray-700 rounded-lg p-2 animate-pulse">
              <div className="h-12 bg-gray-600 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">Statistical Rankings</h3>
        <p className="text-red-400 text-sm">Failed to load rankings. Please try again later.</p>
      </div>
    );
  }

  if (!rankings) {
    return null;
  }

  const rankingEntries = Object.entries(rankings) as [keyof RobotRankings, RankingEntry][];

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-base font-semibold mb-3">Statistical Rankings</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {rankingEntries.map(([category, ranking]) => {
          const badge = getBadge(ranking.percentile);
          const color = categoryColors[category] || '#6b7280';
          const icon = categoryIcons[category] || '📈';
          const name = categoryNames[category] || category;

          return (
            <div
              key={category}
              className="bg-gray-700 rounded-lg p-2 hover:bg-gray-650 transition-colors duration-150"
            >
              <div className="flex items-center gap-2 mb-1">
                {/* Icon and Name */}
                <span
                  className="text-lg"
                  style={{ filter: `drop-shadow(0 0 2px ${color})` }}
                  aria-hidden="true"
                >
                  {icon}
                </span>
                <h4 className="font-semibold text-sm flex-1" style={{ color }}>
                  {name}
                </h4>
                
                {/* Badge */}
                {badge && (
                  <span
                    className={`${badge.color} text-white text-xs px-2 py-0.5 rounded-full font-semibold`}
                  >
                    {badge.label}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-1">
                {/* Rank */}
                <div className="text-gray-300 text-xs">
                  #{ranking.rank} / {ranking.total}
                </div>

                {/* Percentile */}
                <div className="text-xs text-gray-400 ml-auto">
                  {ranking.percentile.toFixed(1)}%
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative w-full h-1.5 bg-gray-600 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${ranking.percentile}%`,
                    backgroundColor: color,
                  }}
                  role="progressbar"
                  aria-valuenow={ranking.percentile}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${name} percentile: ${ranking.percentile.toFixed(1)}%`}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default StatisticalRankings;
