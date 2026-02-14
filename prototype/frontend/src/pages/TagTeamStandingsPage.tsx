import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navigation from '../components/Navigation';
import {
  getTagTeamStandings,
  TagTeamStanding,
  TAG_TEAM_LEAGUE_TIERS,
  TagTeamLeagueTier,
  getTagTeamLeagueTierName,
  getTagTeamLeagueTierColor,
  getTagTeamLeagueTierIcon,
  getTeamName,
} from '../utils/tagTeamApi';

function TagTeamStandingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedTier, setSelectedTier] = useState<TagTeamLeagueTier>('bronze');
  const [standings, setStandings] = useState<TagTeamStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (user) {
      fetchStandings();
    }
  }, [user, selectedTier, page]);

  const fetchStandings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        logout();
        navigate('/login');
        return;
      }
      
      const data = await getTagTeamStandings(selectedTier, page, 50);
      console.log('Standings API response - first team:', JSON.stringify(data.standings[0], null, 2));
      setStandings(data.standings);
      setTotalPages(data.pagination.totalPages);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }
      console.error('Failed to fetch tag team standings:', err);
      setError(err.response?.data?.message || 'Failed to load standings');
    } finally {
      setLoading(false);
    }
  };

  const handleTierChange = (tier: TagTeamLeagueTier) => {
    setSelectedTier(tier);
    setPage(1);
  };

  const isMyTeam = (stableId: number) => {
    return user && stableId === user.id;
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-6 pb-4 border-b border-gray-700">
          <h1 className="text-3xl font-bold text-white">Tag Team League Standings</h1>
          <p className="text-gray-400 mt-1">View rankings across all tag team league tiers</p>
        </div>

        {/* Tier Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TAG_TEAM_LEAGUE_TIERS.map((tier) => {
            const tierName = getTagTeamLeagueTierName(tier);
            const tierColor = getTagTeamLeagueTierColor(tier);
            const tierIcon = getTagTeamLeagueTierIcon(tier);
            const isActive = selectedTier === tier;

            return (
              <button
                key={tier}
                onClick={() => handleTierChange(tier)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all
                  ${isActive
                    ? `${tierColor} bg-white/10 border-2 border-current`
                    : 'text-gray-400 bg-surface-elevated border-2 border-gray-700 hover:border-gray-600'
                  }
                `}
              >
                <span>{tierIcon}</span>
                <span>{tierName}</span>
              </button>
            );
          })}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading standings...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-error/10 border border-error rounded-lg p-4 mb-6">
            <p className="text-error">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && standings.length === 0 && (
          <div className="bg-surface-elevated p-8 rounded-lg border border-gray-700 text-center">
            <p className="text-gray-400">No teams in this tier yet</p>
          </div>
        )}

        {/* Standings Table */}
        {!loading && !error && standings.length > 0 && (
          <>
            <div className="bg-surface-elevated rounded-lg border border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface border-b border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Team</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Combined ELO</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">League Points</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Record</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Matches</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {standings.map((team) => {
                      const isMyTeamRow = isMyTeam(team.stableId);
                      const winRate = team.totalMatches > 0 
                        ? ((team.wins / team.totalMatches) * 100).toFixed(0) 
                        : '0';

                      return (
                        <tr
                          key={team.teamId}
                          className={`
                            hover:bg-surface transition-colors
                            ${isMyTeamRow ? 'bg-primary/5 border-l-4 border-l-primary' : ''}
                          `}
                        >
                          {/* Rank */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {team.rank <= 3 && (
                                <span className="text-lg">
                                  {team.rank === 1 ? '🥇' : team.rank === 2 ? '🥈' : '🥉'}
                                </span>
                              )}
                              <span className={`font-semibold ${isMyTeamRow ? 'text-primary' : 'text-white'}`}>
                                #{team.rank}
                              </span>
                            </div>
                          </td>

                          {/* Team */}
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <div className="font-semibold text-white text-base">
                                {getTeamName(team)}
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-primary">{team.activeRobot.name}</span>
                                <span className="text-xs text-gray-500">(Active)</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-white">{team.reserveRobot.name}</span>
                                <span className="text-xs text-gray-500">(Reserve)</span>
                              </div>
                              <div className="text-xs text-gray-400">
                                ELO: {team.activeRobot.elo} + {team.reserveRobot.elo}
                              </div>
                            </div>
                          </td>

                          {/* Combined ELO */}
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold text-white">{team.combinedELO}</span>
                          </td>

                          {/* League Points */}
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold text-primary">{team.tagTeamLeaguePoints}</span>
                          </td>

                          {/* Record */}
                          <td className="px-4 py-3 text-center">
                            <div className="space-y-1">
                              <div className="text-sm font-semibold text-white">
                                {team.wins}W-{team.losses}L-{team.draws}D
                              </div>
                              <div className="text-xs text-gray-400">
                                {winRate}% win rate
                              </div>
                            </div>
                          </td>

                          {/* Total Matches */}
                          <td className="px-4 py-3 text-center">
                            <span className="text-white">{team.totalMatches}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-surface-elevated border border-gray-700 rounded-lg text-white hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-surface-elevated border border-gray-700 rounded-lg text-white hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

export default TagTeamStandingsPage;
