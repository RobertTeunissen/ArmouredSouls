import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import {
  getKothStandings,
  KothStandingRobot,
} from '../utils/kothApi';

type ViewFilter = 'all_time' | 'last_10';

function KothStandingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<ViewFilter>('all_time');
  const [robots, setRobots] = useState<KothStandingRobot[]>([]);
  const [summary, setSummary] = useState<{
    totalEvents: number;
    uniqueParticipants: number;
    topRobot: string | null;
  }>({ totalEvents: 0, uniqueParticipants: 0, topRobot: null });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStandings(view, 1);
  }, [view]);

  const fetchStandings = async (currentView: ViewFilter, page: number) => {
    try {
      setLoading(true);
      const data = await getKothStandings(currentView, page, 50);
      setRobots(data.data);
      setSummary(data.summary);
      setPagination(data.pagination);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch KotH standings:', err);
      setError('Failed to load King of the Hill standings');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchStandings(view, newPage);
  };

  const isMyRobot = (ownerId: number) => {
    return user && ownerId === user.id;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-warning'; // Gold
    if (rank === 2) return 'text-secondary'; // Silver
    if (rank === 3) return 'text-orange-600'; // Bronze
    return 'text-secondary';
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6">👑 King of the Hill Standings</h1>

        {/* Summary Header */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-surface p-4 rounded-lg text-center">
              <div className="text-2xl font-bold font-mono">{summary.totalEvents}</div>
              <div className="text-sm text-secondary">Total Events</div>
            </div>
            <div className="bg-surface p-4 rounded-lg text-center">
              <div className="text-2xl font-bold font-mono">{summary.uniqueParticipants}</div>
              <div className="text-sm text-secondary">Unique Participants</div>
            </div>
            <div className="bg-surface p-4 rounded-lg text-center">
              <div className="text-2xl font-bold font-mono text-orange-500">
                {summary.topRobot || '—'}
              </div>
              <div className="text-sm text-secondary">#1 Robot</div>
            </div>
          </div>
        )}

        {/* View Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setView('all_time')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              view === 'all_time'
                ? 'bg-surface-elevated border-2 border-orange-500 text-orange-500'
                : 'bg-surface text-secondary hover:bg-surface-elevated'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => setView('last_10')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              view === 'last_10'
                ? 'bg-surface-elevated border-2 border-orange-500 text-orange-500'
                : 'bg-surface text-secondary hover:bg-surface-elevated'
            }`}
          >
            Last 10 Events
          </button>
        </div>

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
            <p className="text-secondary">No King of the Hill data yet. Check back after events have been played.</p>
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
                      <th className="px-1.5 lg:px-4 py-3 text-center font-semibold text-sm lg:text-base">KotH Wins</th>
                      <th className="px-1.5 lg:px-4 py-3 text-center font-semibold text-sm lg:text-base">Matches</th>
                      <th className="px-1.5 lg:px-4 py-3 text-center font-semibold text-sm lg:text-base">Win Rate</th>
                      <th className="px-1.5 lg:px-4 py-3 text-center font-semibold text-sm lg:text-base">Total Zone</th>
                      <th className="hidden lg:table-cell px-4 py-3 text-center font-semibold">Avg Zone</th>
                      <th className="hidden lg:table-cell px-4 py-3 text-center font-semibold">Kills</th>
                      <th className="hidden lg:table-cell px-4 py-3 text-center font-semibold">Best Streak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {robots.map((robot) => {
                      const rankColor = getRankColor(robot.rank);
                      const isMyBot = isMyRobot(robot.ownerId);

                      return (
                        <tr
                          key={robot.robotId}
                          className={`border-b border-white/10 ${
                            isMyBot ? 'bg-blue-900 bg-opacity-30' : 'hover:bg-surface-elevated'
                          } transition-colors`}
                        >
                          <td className={`px-1.5 lg:px-4 py-3 font-bold ${rankColor} text-sm lg:text-base`}>
                            #{robot.rank}
                          </td>
                          <td className="px-1.5 lg:px-4 py-3">
                            <div
                              className={`font-semibold text-sm lg:text-base truncate max-w-[100px] lg:max-w-none cursor-pointer hover:underline transition-colors ${isMyBot ? 'text-primary hover:text-blue-300' : 'hover:text-[#58a6ff]'}`}
                              onClick={() => navigate(`/robots/${robot.robotId}`)}
                            >
                              {robot.robotName}
                            </div>
                          </td>
                          <td className="px-1.5 lg:px-4 py-3 text-secondary text-sm lg:text-base">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate max-w-[80px] lg:max-w-none">
                                {robot.ownerName}
                              </span>
                              {isMyBot && (
                                <span className="shrink-0 text-xs bg-primary text-white px-1.5 py-0.5 rounded font-semibold">
                                  YOU
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-1.5 lg:px-4 py-3 text-center font-mono text-sm lg:text-base text-warning">
                            {robot.kothWins}
                          </td>
                          <td className="px-1.5 lg:px-4 py-3 text-center font-mono text-sm lg:text-base">
                            {robot.kothMatches}
                          </td>
                          <td className="px-1.5 lg:px-4 py-3 text-center font-mono text-sm lg:text-base">
                            {robot.winRate.toFixed(1)}%
                          </td>
                          <td className="px-1.5 lg:px-4 py-3 text-center font-mono text-sm lg:text-base text-orange-500">
                            {Number(robot.totalZoneScore).toFixed(1)}
                          </td>
                          <td className="hidden lg:table-cell px-4 py-3 text-center font-mono text-orange-500">
                            {robot.avgZoneScore.toFixed(1)}
                          </td>
                          <td className="hidden lg:table-cell px-4 py-3 text-center font-mono">
                            {robot.kothKills}
                          </td>
                          <td className="hidden lg:table-cell px-4 py-3 text-center font-mono">
                            {robot.bestWinStreak}
                          </td>
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

export default KothStandingsPage;
