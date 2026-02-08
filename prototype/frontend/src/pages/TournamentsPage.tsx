import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { listTournaments, getTournamentDetails, Tournament, TournamentDetails } from '../utils/tournamentApi';
import axios from 'axios';

function TournamentsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<TournamentDetails | null>(null);
  const [userRobots, setUserRobots] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'completed'>('all');
  const [showOnlyUserRobots, setShowOnlyUserRobots] = useState(false);
  const [matchesPage, setMatchesPage] = useState(1);
  const [matchesPerPage, setMatchesPerPage] = useState(50);

  useEffect(() => {
    fetchTournaments();
    fetchUserRobots();
  }, []);

  const fetchUserRobots = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get('http://localhost:3001/api/robots/my-robots', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const robotIds = new Set<number>(response.data.robots.map((r: any) => r.id));
      setUserRobots(robotIds);
    } catch (err) {
      console.error('Failed to fetch user robots:', err);
    }
  };

  const fetchTournamentDetails = async (tournamentId: number) => {
    try {
      setDetailsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        logout();
        navigate('/login');
        return;
      }

      const data = await getTournamentDetails(token, tournamentId);
      setSelectedTournament(data.tournament);
    } catch (err: any) {
      console.error('Failed to fetch tournament details:', err);
      setError('Failed to load tournament details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        logout();
        navigate('/login');
        return;
      }

      const data = await listTournaments(token);
      setTournaments(data.tournaments || []);
      setError(null);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }
      console.error('Failed to fetch tournaments:', err);
      setError('Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTournaments = () => {
    if (filter === 'all') return tournaments;
    return tournaments.filter(t => t.status === filter);
  };

  const getRoundName = (currentRound: number, maxRounds: number) => {
    const remainingRounds = maxRounds - currentRound + 1;
    if (remainingRounds === 1) return 'Finals';
    if (remainingRounds === 2) return 'Semi-finals';
    if (remainingRounds === 3) return 'Quarter-finals';
    return `Round ${currentRound}/${maxRounds}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-3 py-1 bg-green-900/50 text-green-400 rounded-full text-sm font-semibold">🔴 Live</span>;
      case 'pending':
        return <span className="px-3 py-1 bg-yellow-900/50 text-yellow-400 rounded-full text-sm font-semibold">⏳ Pending</span>;
      case 'completed':
        return <span className="px-3 py-1 bg-gray-700 text-gray-400 rounded-full text-sm font-semibold">✓ Completed</span>;
      default:
        return <span className="px-3 py-1 bg-gray-700 text-gray-400 rounded-full text-sm">{status}</span>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!user) {
    return null;
  }

  const filteredTournaments = getFilteredTournaments();
  const activeTournaments = tournaments.filter(t => t.status === 'active');
  const pendingTournaments = tournaments.filter(t => t.status === 'pending');
  const completedTournaments = tournaments.filter(t => t.status === 'completed');

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <span className="text-5xl">🏆</span>
            Tournaments
          </h1>
          <p className="text-gray-400">View active and past tournaments</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="text-3xl font-bold text-green-400">{activeTournaments.length}</div>
            <div className="text-gray-400 text-sm">Active Tournaments</div>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="text-3xl font-bold text-yellow-400">{pendingTournaments.length}</div>
            <div className="text-gray-400 text-sm">Pending Start</div>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="text-3xl font-bold text-gray-400">{completedTournaments.length}</div>
            <div className="text-gray-400 text-sm">Completed</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 font-semibold transition-colors ${
              filter === 'all'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            All ({tournaments.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 font-semibold transition-colors ${
              filter === 'active'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Active ({activeTournaments.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 font-semibold transition-colors ${
              filter === 'pending'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Pending ({pendingTournaments.length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 font-semibold transition-colors ${
              filter === 'completed'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Completed ({completedTournaments.length})
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-gray-800 p-8 rounded-lg text-center">
            <p className="text-gray-400">Loading tournaments...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-900/20 border border-red-500 p-6 rounded-lg">
            <p className="text-red-400">{error}</p>
            <button
              onClick={fetchTournaments}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredTournaments.length === 0 && (
          <div className="bg-gray-800 p-12 rounded-lg text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="text-xl font-semibold mb-2 text-gray-300">No Tournaments Found</h3>
            <p className="text-gray-400">
              {filter === 'all' ? 'No tournaments have been created yet.' : `No ${filter} tournaments.`}
            </p>
          </div>
        )}

        {/* Tournaments List */}
        {!loading && !error && filteredTournaments.length > 0 && (
          <div className="space-y-4">
            {filteredTournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="bg-gray-800 p-6 rounded-lg border-2 border-yellow-500/30 hover:border-yellow-500/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-yellow-400">{tournament.name}</h3>
                      {getStatusBadge(tournament.status)}
                    </div>
                    <p className="text-gray-400 text-sm">Tournament #{tournament.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-400">Participants</div>
                    <div className="text-xl font-semibold">{tournament.totalParticipants}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Current Round</div>
                    <div className="text-xl font-semibold">
                      {tournament.status === 'active' ? (
                        <span className="text-green-400">{getRoundName(tournament.currentRound, tournament.maxRounds)}</span>
                      ) : tournament.status === 'completed' ? (
                        <span className="text-gray-400">Finished</span>
                      ) : (
                        <span className="text-yellow-400">Not Started</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Total Rounds</div>
                    <div className="text-xl font-semibold">{tournament.maxRounds}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Created</div>
                    <div className="text-xl font-semibold text-sm">{formatDate(tournament.createdAt)}</div>
                  </div>
                </div>

                {/* Winner Display */}
                {tournament.status === 'completed' && tournament.winner && (
                  <div className="bg-yellow-900/20 border border-yellow-500/50 p-4 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">👑</span>
                      <div>
                        <div className="text-sm text-yellow-400 font-semibold">Champion</div>
                        <div className="text-xl font-bold">{tournament.winner.name}</div>
                        <div className="text-sm text-gray-400">
                          Owned by {(tournament.winner as any).user?.username || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Progress Bar for Active Tournaments */}
                {tournament.status === 'active' && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Tournament Progress</span>
                      <span className="text-gray-400">
                        Round {tournament.currentRound} of {tournament.maxRounds}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-yellow-500 h-2 rounded-full transition-all"
                        style={{ width: `${(tournament.currentRound / tournament.maxRounds) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* View Details Button */}
                <div className="mt-4">
                  <button
                    onClick={() => fetchTournamentDetails(tournament.id)}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors font-semibold"
                  >
                    View Tournament Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tournament Details Modal */}
        {selectedTournament && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto border-2 border-yellow-500/50">
              {/* Header */}
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold text-yellow-400 mb-1">{selectedTournament.name}</h2>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(selectedTournament.status)}
                    <span className="text-gray-400">
                      Round {selectedTournament.currentRound} of {selectedTournament.maxRounds}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTournament(null)}
                  className="text-gray-400 hover:text-white text-3xl leading-none"
                >
                  ×
                </button>
              </div>

              {detailsLoading ? (
                <div className="p-12 text-center">
                  <p className="text-gray-400">Loading tournament details...</p>
                </div>
              ) : (
                <div className="p-6">
                  {/* Tournament Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-900 p-4 rounded-lg">
                      <div className="text-sm text-gray-400">Total Participants</div>
                      <div className="text-2xl font-bold">{selectedTournament.totalParticipants}</div>
                    </div>
                    <div className="bg-gray-900 p-4 rounded-lg">
                      <div className="text-sm text-gray-400">Robots Remaining</div>
                      <div className="text-2xl font-bold text-green-400">
                        {(() => {
                          const matches = selectedTournament.currentRoundMatches || [];
                          const regularMatches = matches.filter((m: any) => !m.isByeMatch).length;
                          const byeMatches = matches.filter((m: any) => m.isByeMatch).length;
                          return (regularMatches * 2) + byeMatches;
                        })()}
                      </div>
                    </div>
                    <div className="bg-gray-900 p-4 rounded-lg">
                      <div className="text-sm text-gray-400">Total Rounds</div>
                      <div className="text-2xl font-bold">{selectedTournament.maxRounds}</div>
                    </div>
                    <div className="bg-gray-900 p-4 rounded-lg">
                      <div className="text-sm text-gray-400">Your Robots</div>
                      <div className="text-2xl font-bold text-blue-400">
                        {(() => {
                          const userRobotIds = new Set<number>();
                          selectedTournament.currentRoundMatches?.forEach((m: any) => {
                            if (m.robot1Id && userRobots.has(m.robot1Id)) {
                              userRobotIds.add(m.robot1Id);
                            }
                            if (m.robot2Id && userRobots.has(m.robot2Id)) {
                              userRobotIds.add(m.robot2Id);
                            }
                          });
                          return userRobotIds.size;
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* User's Robots in Tournament */}
                  {selectedTournament.currentRoundMatches && selectedTournament.currentRoundMatches.some((m: any) => 
                    (m.robot1Id && userRobots.has(m.robot1Id)) || 
                    (m.robot2Id && userRobots.has(m.robot2Id))
                  ) && (
                    <div className="bg-blue-900/20 border border-blue-500/50 p-4 rounded-lg mb-6">
                      <h3 className="text-xl font-bold text-blue-400 mb-3 flex items-center gap-2">
                        <span>🤖</span>
                        Your Robots Still In Tournament
                      </h3>
                      <div className="space-y-2">
                        {selectedTournament.currentRoundMatches
                          .filter((m: any) => 
                            (m.robot1Id && userRobots.has(m.robot1Id)) || 
                            (m.robot2Id && userRobots.has(m.robot2Id))
                          )
                          .map((match: any) => {
                            const userRobot = userRobots.has(match.robot1Id) ? match.robot1 : match.robot2;
                            const opponent = userRobots.has(match.robot1Id) ? match.robot2 : match.robot1;
                            
                            return (
                              <div key={match.id} className="bg-gray-900 p-3 rounded flex justify-between items-center">
                                <div>
                                  <span className="font-bold text-blue-400">{userRobot?.name || 'Your Robot'}</span>
                                  {match.status === 'completed' ? (
                                    <span className="ml-2 text-sm">
                                      {match.winnerId === userRobot?.id ? (
                                        <span className="text-green-400">✓ Advanced</span>
                                      ) : (
                                        <span className="text-red-400">✗ Eliminated</span>
                                      )}
                                    </span>
                                  ) : match.isByeMatch ? (
                                    <span className="ml-2 text-sm text-yellow-400">Bye (Auto-advance)</span>
                                  ) : (
                                    <span className="ml-2 text-sm text-gray-400">
                                      vs {opponent?.name || 'TBD'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-400">
                                  {match.isByeMatch ? 'No Match' : 
                                    match.status === 'completed' ? 'Completed' : 'Pending'}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Current Round Matches */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold">
                        {getRoundName(selectedTournament.currentRound, selectedTournament.maxRounds)} Matches
                      </h3>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={showOnlyUserRobots}
                            onChange={(e) => {
                              setShowOnlyUserRobots(e.target.checked);
                              setMatchesPage(1); // Reset to first page
                            }}
                            className="rounded"
                          />
                          <span className="text-gray-300">Show only my robots</span>
                        </label>
                        <select
                          value={matchesPerPage}
                          onChange={(e) => {
                            setMatchesPerPage(Number(e.target.value));
                            setMatchesPage(1); // Reset to first page
                          }}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
                        >
                          <option value={25}>25 per page</option>
                          <option value={50}>50 per page</option>
                          <option value={100}>100 per page</option>
                          <option value={500}>500 per page</option>
                        </select>
                      </div>
                    </div>
                    
                    {selectedTournament.currentRoundMatches && selectedTournament.currentRoundMatches.length > 0 ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                          {(() => {
                            // Filter matches if "show only my robots" is enabled
                            const filteredMatches = showOnlyUserRobots
                              ? selectedTournament.currentRoundMatches.filter((m: any) =>
                                  (m.robot1Id && userRobots.has(m.robot1Id)) ||
                                  (m.robot2Id && userRobots.has(m.robot2Id))
                                )
                              : selectedTournament.currentRoundMatches;

                            // Pagination
                            const totalMatches = filteredMatches.length;
                            const totalPages = Math.ceil(totalMatches / matchesPerPage);
                            const startIndex = (matchesPage - 1) * matchesPerPage;
                            const endIndex = startIndex + matchesPerPage;
                            const paginatedMatches = filteredMatches.slice(startIndex, endIndex);

                            return (
                              <>
                                {paginatedMatches.map((match: any) => (
                                  <div
                                    key={match.id}
                                    className={`p-3 rounded border ${
                                      match.status === 'completed'
                                        ? 'bg-gray-900/50 border-gray-700'
                                        : 'bg-gray-900 border-yellow-500/30'
                                    }`}
                                  >
                                    {match.isByeMatch ? (
                                      <div className="text-center py-2">
                                        <div className="font-bold text-yellow-400">
                                          {match.robot1?.name || 'Robot'}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                          ELO: {match.robot1?.elo || 'N/A'}
                                        </div>
                                        {match.robot1?.user && (
                                          <div className="text-xs text-gray-500">
                                            {match.robot1.user.stableName || match.robot1.user.username}
                                          </div>
                                        )}
                                        <div className="text-xs text-yellow-300 mt-1">🎖️ Bye - Auto-advances</div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex justify-between items-start gap-2">
                                          <div className={`flex-1 ${match.winnerId === match.robot1Id ? 'font-bold text-green-400' : ''}`}>
                                            <div>{match.robot1?.name || 'TBD'}</div>
                                            <div className="text-xs text-gray-400">
                                              ELO: {match.robot1?.elo || 'N/A'}
                                            </div>
                                            {match.robot1?.user && (
                                              <div className="text-xs text-gray-500">
                                                {match.robot1.user.stableName || match.robot1.user.username}
                                              </div>
                                            )}
                                          </div>
                                          <div className="px-2 text-gray-500 text-xs pt-2">VS</div>
                                          <div className={`flex-1 text-right ${match.winnerId === match.robot2Id ? 'font-bold text-green-400' : ''}`}>
                                            <div>{match.robot2?.name || 'TBD'}</div>
                                            <div className="text-xs text-gray-400">
                                              ELO: {match.robot2?.elo || 'N/A'}
                                            </div>
                                            {match.robot2?.user && (
                                              <div className="text-xs text-gray-500">
                                                {match.robot2.user.stableName || match.robot2.user.username}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="text-center text-xs text-gray-500 mt-2">
                                          {match.status === 'completed' ? '✓ Completed' : 'Pending'}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ))}

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                  <div className="col-span-full flex justify-center items-center gap-4 mt-4">
                                    <button
                                      onClick={() => setMatchesPage(Math.max(1, matchesPage - 1))}
                                      disabled={matchesPage === 1}
                                      className="px-4 py-2 bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
                                    >
                                      Previous
                                    </button>
                                    <span className="text-gray-400">
                                      Page {matchesPage} of {totalPages} ({totalMatches} matches)
                                    </span>
                                    <button
                                      onClick={() => setMatchesPage(Math.min(totalPages, matchesPage + 1))}
                                      disabled={matchesPage === totalPages}
                                      className="px-4 py-2 bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
                                    >
                                      Next
                                    </button>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-400 text-center py-8">No matches in current round</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TournamentsPage;
