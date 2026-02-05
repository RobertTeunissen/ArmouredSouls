import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import {
  getLeagueStandings,
  getLeagueInstances,
  LeagueRobot,
  LeagueInstance,
  getLeagueTierName,
  getLeagueTierColor,
} from '../utils/matchmakingApi';

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];

function LeagueStandingsPage() {
  const { user } = useAuth();
  const [selectedTier, setSelectedTier] = useState('bronze');
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [robots, setRobots] = useState<LeagueRobot[]>([]);
  const [instances, setInstances] = useState<LeagueInstance[]>([]);
  const [userRobotTiers, setUserRobotTiers] = useState<Set<string>>(new Set());
  const [showInstancesList, setShowInstancesList] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedInstance(null); // Reset selected instance when tier changes
    fetchLeagueData(selectedTier, 1);
    fetchUserRobotTiers(); // Fetch user's robot tiers on load
  }, [selectedTier]);

  const fetchUserRobotTiers = async () => {
    // Fetch user's robots to determine which tiers they're in
    try {
      const response = await fetch('http://localhost:3001/api/robots', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const robotsData = await response.json();
        const tiers = new Set<string>(robotsData.map((r: any) => r.currentLeague));
        setUserRobotTiers(tiers);
      }
    } catch (err) {
      console.error('Failed to fetch user robot tiers:', err);
    }
  };

  const fetchLeagueData = async (tier: string, page: number, instance?: string) => {
    try {
      setLoading(true);
      const [standingsData, instancesData] = await Promise.all([
        getLeagueStandings(tier, page, 50, instance),
        getLeagueInstances(tier),
      ]);
      setRobots(standingsData.data);
      setPagination(standingsData.pagination);
      setInstances(instancesData);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch league data:', err);
      setError('Failed to load league standings');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchLeagueData(selectedTier, newPage, selectedInstance || undefined);
  };

  const handleInstanceClick = (instanceId: string) => {
    if (selectedInstance === instanceId) {
      // Clicking on the same instance deselects it
      setSelectedInstance(null);
      fetchLeagueData(selectedTier, 1);
    } else {
      setSelectedInstance(instanceId);
      fetchLeagueData(selectedTier, 1, instanceId);
    }
  };

  const isMyRobot = (robotUserId: number) => {
    return user && robotUserId === user.id;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400'; // Gold
    if (rank === 2) return 'text-gray-300'; // Silver
    if (rank === 3) return 'text-orange-600'; // Bronze
    return 'text-gray-400';
  };

  // Transform league instance identifier to human-readable display text
  const buildInstanceDisplayLabel = (leagueIdentifier: string) => {
    const segments = leagueIdentifier.split('_');
    if (segments.length < 2) return leagueIdentifier;
    
    const tierLabel = getLeagueTierName(segments[0]);
    const instanceNum = segments[1];
    return `${tierLabel} ${instanceNum}`;
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6">League Standings</h1>

        {/* Tier Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TIERS.map((tier) => {
            const tierColor = getLeagueTierColor(tier);
            const tierName = getLeagueTierName(tier);
            const isActive = selectedTier === tier;
            const hasUserRobots = userRobotTiers.has(tier);

            return (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors relative ${
                  isActive
                    ? `${tierColor} bg-gray-700 border-2 border-current`
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {tierName}
                {hasUserRobots && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-gray-900"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Instance Information */}
        {!loading && instances.length > 0 && (
          <div className="bg-gray-800 p-4 rounded-lg mb-6">
            <div 
              className="flex items-center justify-between cursor-pointer mb-2"
              onClick={() => setShowInstancesList(!showInstancesList)}
            >
              <h2 className="text-lg font-semibold">
                League Instances
                {selectedInstance && (
                  <span className="ml-2 text-sm text-gray-400">
                    (Click selected to view all)
                  </span>
                )}
              </h2>
              <button className="text-gray-400 hover:text-white transition-colors">
                {showInstancesList ? (
                  <span className="text-2xl">−</span>
                ) : (
                  <span className="text-2xl">+</span>
                )}
              </button>
            </div>
            
            {showInstancesList && (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
                {instances.map((instance) => {
                  const isSelected = selectedInstance === instance.leagueId;
                  const tierColorClass = getLeagueTierColor(instance.leagueTier);

                  return (
                    <div
                      key={instance.leagueId}
                      onClick={() => handleInstanceClick(instance.leagueId)}
                      className={`p-3 rounded cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-yellow-900 border-2 border-yellow-500 ring-2 ring-yellow-400'
                          : 'bg-gray-700 hover:bg-gray-600 border-2 border-transparent'
                      }`}
                    >
                      <div className={`text-sm ${tierColorClass} font-semibold`}>
                        {buildInstanceDisplayLabel(instance.leagueId)}
                      </div>
                      <div className="text-lg font-semibold mt-1">
                        {instance.currentRobots} / {instance.maxRobots}
                      </div>
                      <div className="text-xs text-gray-500">robots</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <p className="text-gray-400">Loading standings...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-600 p-6 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && robots.length === 0 && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <p className="text-gray-400">No robots in this tier yet.</p>
          </div>
        )}

        {!loading && !error && robots.length > 0 && (
          <>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Rank</th>
                      <th className="px-4 py-3 text-left font-semibold">Robot</th>
                      <th className="px-4 py-3 text-left font-semibold">Owner</th>
                      <th className="px-4 py-3 text-center font-semibold">ELO</th>
                      <th className="px-4 py-3 text-center font-semibold">LP</th>
                      <th className="px-4 py-3 text-center font-semibold">Fame</th>
                      <th className="px-4 py-3 text-center font-semibold">W-D-L</th>
                      <th className="px-4 py-3 text-center font-semibold">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {robots.map((robot, index) => {
                      const rank = (pagination.page - 1) * pagination.pageSize + index + 1;
                      const rankColor = getRankColor(rank);
                      const isMyBot = isMyRobot(robot.userId);
                      const winRate =
                        robot.totalBattles > 0
                          ? ((robot.wins / robot.totalBattles) * 100).toFixed(1)
                          : '0.0';

                      return (
                        <tr
                          key={robot.id}
                          className={`border-b border-gray-700 ${
                            isMyBot ? 'bg-blue-900 bg-opacity-30' : 'hover:bg-gray-700'
                          } transition-colors`}
                        >
                          <td className={`px-4 py-3 font-bold ${rankColor}`}>
                            #{rank}
                          </td>
                          <td className="px-4 py-3">
                            <div className={`font-semibold ${isMyBot ? 'text-blue-400' : ''}`}>
                              {robot.name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {robot.user.username}
                            {isMyBot && (
                              <span className="ml-2 text-xs bg-blue-600 px-2 py-1 rounded">
                                YOU
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-mono">{robot.elo}</td>
                          <td className="px-4 py-3 text-center font-mono text-yellow-400">
                            {robot.leaguePoints}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-purple-400">
                            {robot.fame}
                          </td>
                          <td className="px-4 py-3 text-center font-mono">
                            <span className="text-green-400">{robot.wins}</span>
                            <span className="text-gray-500"> - </span>
                            <span className="text-yellow-400">{robot.draws}</span>
                            <span className="text-gray-500"> - </span>
                            <span className="text-red-400">{robot.losses}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono">{winRate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                >
                  Previous
                </button>

                <div className="px-4 py-2 bg-gray-800 rounded">
                  Page {pagination.page} of {pagination.totalPages}
                </div>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default LeagueStandingsPage;
