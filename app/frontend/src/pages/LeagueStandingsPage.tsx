import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { useRobotStore } from '../stores';
import {
  getLeagueStandings,
  getLeagueInstances,
  LeagueRobot,
  LeagueInstance,
  getLeagueTierName,
  getLeagueTierColor,
  getLeagueTierIcon,
} from '../utils/matchmakingApi';
import OwnerNameLink from '../components/OwnerNameLink';

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];

function LeagueStandingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storeRobots = useRobotStore(state => state.robots);
  const fetchStoreRobots = useRobotStore(state => state.fetchRobots);
  const initialTier = TIERS.includes(searchParams.get('tier') ?? '') ? searchParams.get('tier')! : 'bronze';
  const [selectedTier, setSelectedTier] = useState(initialTier);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [robots, setRobots] = useState<LeagueRobot[]>([]);
  const [instances, setInstances] = useState<LeagueInstance[]>([]);
  const [userRobotTiers, setUserRobotTiers] = useState<Set<string>>(new Set());
  const [userRobotInstances, setUserRobotInstances] = useState<Set<string>>(new Set());
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
    fetchStoreRobots(); // Fetch user's robots via store
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchLeagueData changes on every render; fetchStoreRobots is a stable store selector
  }, [selectedTier, fetchStoreRobots]);

  // Derive user robot tiers/instances from store
  useEffect(() => {
    if (storeRobots.length > 0) {
      const tiers = new Set<string>(storeRobots.map((r) => r.currentLeague));
      const instanceIds = new Set<string>(storeRobots.map((r) => r.leagueId).filter(Boolean) as string[]);
      setUserRobotTiers(tiers);
      setUserRobotInstances(instanceIds);
    }
  }, [storeRobots]);

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
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
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
    if (rank === 1) return 'text-warning'; // Gold
    if (rank === 2) return 'text-secondary'; // Silver
    if (rank === 3) return 'text-orange-600'; // Bronze
    return 'text-secondary';
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
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
        <h1 className="text-4xl font-bold mb-6">League Standings</h1>

        {/* Tier Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TIERS.map((tier) => {
            const tierColor = getLeagueTierColor(tier);
            const tierName = getLeagueTierName(tier);
            const tierIcon = getLeagueTierIcon(tier);
            const isActive = selectedTier === tier;
            const hasUserRobots = userRobotTiers.has(tier);

            return (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors relative ${
                  isActive
                    ? `${tierColor} bg-surface-elevated border-2 border-current`
                    : 'bg-surface text-secondary hover:bg-surface-elevated'
                }`}
              >
                <span>{tierIcon}</span>
                <span>{tierName}</span>
                {hasUserRobots && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary-dark rounded-full border-2 border-background"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Instance Information */}
        {!loading && instances.length > 0 && (
          <div className="bg-surface p-4 rounded-lg mb-6">
            <div 
              className="flex items-center justify-between cursor-pointer mb-2"
              onClick={() => setShowInstancesList(!showInstancesList)}
            >
              <h2 className="text-lg font-semibold">
                League Instances
                {selectedInstance && (
                  <span className="ml-2 text-sm text-secondary">
                    (Click selected to view all)
                  </span>
                )}
              </h2>
              <button className="text-secondary hover:text-white transition-colors">
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
                  const hasUserRobots = userRobotInstances.has(instance.leagueId);

                  return (
                    <div
                      key={instance.leagueId}
                      onClick={() => handleInstanceClick(instance.leagueId)}
                      className={`p-3 rounded cursor-pointer transition-all relative ${
                        isSelected
                          ? 'bg-yellow-900 border-2 border-yellow-500 ring-2 ring-yellow-400'
                          : 'bg-surface-elevated hover:bg-gray-600 border-2 border-transparent'
                      }`}
                    >
                      <div className={`text-sm ${tierColorClass} font-semibold`}>
                        {buildInstanceDisplayLabel(instance.leagueId)}
                      </div>
                      <div className="text-lg font-semibold mt-1">
                        {instance.currentRobots} / {instance.maxRobots}
                      </div>
                      <div className="text-xs text-tertiary">robots</div>
                      {hasUserRobots && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary-dark rounded-full border-2 border-background"></span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="bg-surface p-6 rounded-lg">
            <p className="text-secondary">Loading standings...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-600 p-6 rounded-lg">
            <p className="text-error">{error}</p>
          </div>
        )}

        {!loading && !error && robots.length === 0 && (
          <div className="bg-surface p-6 rounded-lg">
            <p className="text-secondary">No robots in this tier yet.</p>
          </div>
        )}

        {!loading && !error && robots.length > 0 && (
          <>
            <div className="bg-surface rounded-lg overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full">
                  <thead className="bg-surface-elevated">
                    <tr>
                      <th className="px-1.5 lg:px-4 py-3 text-left font-semibold text-sm lg:text-base">#</th>
                      <th className="px-1.5 lg:px-4 py-3 text-left font-semibold text-sm lg:text-base">Robot</th>
                      <th className="px-1.5 lg:px-4 py-3 text-left font-semibold text-sm lg:text-base">Owner</th>
                      <th className="px-1.5 lg:px-4 py-3 text-center font-semibold text-sm lg:text-base">LP</th>
                      <th className="px-1.5 lg:px-4 py-3 text-center font-semibold text-sm lg:text-base">ELO</th>
                      <th className="hidden lg:table-cell px-4 py-3 text-center font-semibold">Fame</th>
                      <th className="hidden lg:table-cell px-4 py-3 text-center font-semibold">W-D-L</th>
                      <th className="hidden lg:table-cell px-4 py-3 text-center font-semibold">Win Rate</th>
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
                          className={`border-b border-white/10 ${
                            isMyBot ? 'bg-blue-900 bg-opacity-30' : 'hover:bg-surface-elevated'
                          } transition-colors`}
                        >
                          <td className={`px-1.5 lg:px-4 py-3 font-bold ${rankColor} text-sm lg:text-base`}>
                            #{rank}
                          </td>
                          <td className="px-1.5 lg:px-4 py-3">
                            <div 
                              className={`font-semibold text-sm lg:text-base truncate max-w-[100px] lg:max-w-none cursor-pointer hover:underline transition-colors ${isMyBot ? 'text-primary hover:text-blue-300' : 'hover:text-[#58a6ff]'}`}
                              onClick={() => navigate(`/robots/${robot.id}`)}
                            >
                              {robot.name}
                            </div>
                          </td>
                          <td className="px-1.5 lg:px-4 py-3 text-secondary text-sm lg:text-base">
                            <div className="flex items-center gap-1.5">
                              <OwnerNameLink
                                userId={robot.userId}
                                displayName={robot.user.stableName || robot.user.username}
                                className="truncate max-w-[80px] lg:max-w-none"
                              />
                              {isMyBot && (
                                <span className="shrink-0 text-xs bg-primary text-white px-1.5 py-0.5 rounded font-semibold">
                                  YOU
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-1.5 lg:px-4 py-3 text-center font-mono text-sm lg:text-base text-warning">
                            {robot.leaguePoints}
                          </td>
                          <td className="px-1.5 lg:px-4 py-3 text-center font-mono text-sm lg:text-base">{robot.elo}</td>
                          <td className="hidden lg:table-cell px-4 py-3 text-center font-mono text-purple-400">
                            {robot.fame}
                          </td>
                          <td className="hidden lg:table-cell px-4 py-3 text-center font-mono">
                            <span className="text-success">{robot.wins}</span>
                            <span className="text-tertiary"> - </span>
                            <span className="text-warning">{robot.draws}</span>
                            <span className="text-tertiary"> - </span>
                            <span className="text-error">{robot.losses}</span>
                          </td>
                          <td className="hidden lg:table-cell px-4 py-3 text-center font-mono">{winRate}%</td>
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
                  className="px-4 py-2 bg-surface-elevated rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 min-h-[44px]"
                >
                  Previous
                </button>

                <div className="px-4 py-2 bg-surface rounded min-h-[44px] flex items-center">
                  Page {pagination.page} of {pagination.totalPages}
                </div>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 bg-surface-elevated rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 min-h-[44px]"
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
