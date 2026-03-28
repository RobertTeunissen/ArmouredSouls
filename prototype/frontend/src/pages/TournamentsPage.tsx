import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { listTournaments, Tournament } from '../utils/tournamentApi';
import { getRoundLabel } from '../utils/bracketUtils';

function TournamentsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    fetchTournaments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (err.response?.status === 401) {
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

  const getRoundName = (currentRound: number, maxRounds: number): string => {
    return getRoundLabel(currentRound, maxRounds);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-3 py-1 bg-green-900/50 text-success rounded-full text-sm font-semibold">🔴 Live</span>;
      case 'completed':
        return <span className="px-3 py-1 bg-surface-elevated text-secondary rounded-full text-sm font-semibold">✓ Completed</span>;
      default:
        return <span className="px-3 py-1 bg-surface-elevated text-secondary rounded-full text-sm">{status}</span>;
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
  const completedTournaments = tournaments.filter(t => t.status === 'completed');

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <span className="text-5xl">🏆</span>
            Tournaments
          </h1>
          <p className="text-secondary">View active and past tournaments</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-surface p-6 rounded-lg border border-white/10">
            <div className="text-3xl font-bold text-success">{activeTournaments.length}</div>
            <div className="text-secondary text-sm">Active Tournaments</div>
          </div>
          <div className="bg-surface p-6 rounded-lg border border-white/10">
            <div className="text-3xl font-bold text-secondary">{completedTournaments.length}</div>
            <div className="text-secondary text-sm">Completed</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 font-semibold transition-colors ${
              filter === 'all'
                ? 'text-primary border-b-2 border-blue-400'
                : 'text-secondary hover:text-secondary'
            }`}
          >
            All ({tournaments.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 font-semibold transition-colors ${
              filter === 'active'
                ? 'text-primary border-b-2 border-blue-400'
                : 'text-secondary hover:text-secondary'
            }`}
          >
            Active ({activeTournaments.length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 font-semibold transition-colors ${
              filter === 'completed'
                ? 'text-primary border-b-2 border-blue-400'
                : 'text-secondary hover:text-secondary'
            }`}
          >
            Completed ({completedTournaments.length})
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-surface p-8 rounded-lg text-center">
            <p className="text-secondary">Loading tournaments...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-900/20 border border-red-500 p-6 rounded-lg">
            <p className="text-error">{error}</p>
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
          <div className="bg-surface p-12 rounded-lg text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="text-xl font-semibold mb-2 text-secondary">No Tournaments Found</h3>
            <p className="text-secondary">
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
                className="bg-surface p-6 rounded-lg border-2 border-yellow-500/30 hover:border-yellow-500/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-warning">{tournament.name}</h3>
                      {getStatusBadge(tournament.status)}
                    </div>
                    <p className="text-secondary text-sm">Tournament #{tournament.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-secondary">Participants</div>
                    <div className="text-xl font-semibold">{tournament.totalParticipants}</div>
                  </div>
                  <div>
                    <div className="text-sm text-secondary">Current Round</div>
                    <div className="text-xl font-semibold">
                      {tournament.status === 'active' ? (
                        <span className="text-success">{getRoundName(tournament.currentRound, tournament.maxRounds)}</span>
                      ) : tournament.status === 'completed' ? (
                        <span className="text-secondary">Finished</span>
                      ) : (
                        <span className="text-warning">Not Started</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-secondary">Total Rounds</div>
                    <div className="text-xl font-semibold">{tournament.maxRounds}</div>
                  </div>
                  <div>
                    <div className="text-sm text-secondary">Created</div>
                    <div className="text-xl font-semibold text-sm">{formatDate(tournament.createdAt)}</div>
                  </div>
                </div>

                {/* Winner Display */}
                {tournament.status === 'completed' && tournament.winner && (
                  <div className="bg-yellow-900/20 border border-yellow-500/50 p-4 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">👑</span>
                      <div>
                        <div className="text-sm text-warning font-semibold">Champion</div>
                        <div className="text-xl font-bold">{tournament.winner.name}</div>
                        <div className="text-sm text-secondary">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          Owned by {(tournament.winner as any).user?.stableName || (tournament.winner as any).user?.username || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Progress Bar for Active Tournaments */}
                {tournament.status === 'active' && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-secondary">Tournament Progress</span>
                      <span className="text-secondary">
                        Round {tournament.currentRound} of {tournament.maxRounds}
                      </span>
                    </div>
                    <div className="w-full bg-surface-elevated rounded-full h-2">
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
                    onClick={() => navigate(`/tournaments/${tournament.id}`)}
                    className="w-full px-4 py-2 bg-primary hover:bg-blue-700 rounded transition-colors font-semibold"
                  >
                    View Tournament Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

export default TournamentsPage;
