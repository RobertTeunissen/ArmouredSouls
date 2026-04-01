import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { getTournamentDetails, TournamentDetails, SeedEntry } from '../utils/tournamentApi';
import { fetchMyRobots } from '../utils/robotApi';
import BracketView from '../components/tournament/BracketView';

/**
 * Tournament Detail Page — displays full tournament info and bracket visualization.
 * Route: /tournaments/:id
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */
function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState<TournamentDetails | null>(null);
  const [seedings, setSeedings] = useState<SeedEntry[]>([]);
  const [userRobotIds, setUserRobotIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const fetchTournament = useCallback(async () => {
    if (!id) return;

    const currentToken = token || localStorage.getItem('token');
    if (!currentToken) {
      logout();
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setNotFound(false);

      const data = await getTournamentDetails(parseInt(id, 10));
      setTournament(data.tournament);
      setSeedings(data.seedings);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr.response?.status === 404) {
        setNotFound(true);
      } else if (axiosErr.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      } else {
        setError('Failed to load tournament details');
      }
    } finally {
      setLoading(false);
    }
  }, [id, token, logout, navigate]);

  const fetchUserRobots = useCallback(async () => {
    try {
      const robots = await fetchMyRobots();
      setUserRobotIds(new Set(robots.map((r) => r.id)));
    } catch (err) {
      console.error('Failed to fetch user robots:', err);
    }
  }, []);

  useEffect(() => {
    fetchTournament();
    fetchUserRobots();
  }, [fetchTournament, fetchUserRobots]);

  if (!user) {
    return <></>;
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="w-full px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-32 bg-surface-elevated rounded" />
            <div className="h-8 w-64 bg-surface-elevated rounded" />
            <div className="flex gap-3 flex-wrap">
              <div className="h-6 w-20 bg-surface-elevated rounded-full" />
              <div className="h-6 w-28 bg-surface-elevated rounded" />
              <div className="h-6 w-28 bg-surface-elevated rounded" />
              <div className="h-6 w-36 bg-surface-elevated rounded" />
            </div>
            <div className="h-96 bg-surface rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // 404 — tournament not found
  if (notFound) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-surface border border-white/10 p-8 rounded-lg text-center">
            <p className="text-xl text-secondary mb-4">Tournament not found</p>
            <Link
              to="/tournaments"
              className="inline-block px-4 py-2 bg-primary hover:bg-primary/80 rounded text-white"
            >
              Back to Tournaments
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error || !tournament) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-900/30 border border-red-600 p-6 rounded-lg">
            <p className="text-error mb-4">{error || 'Something went wrong'}</p>
            <div className="flex gap-3">
              <button
                onClick={fetchTournament}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-white"
              >
                Retry
              </button>
              <Link
                to="/tournaments"
                className="px-4 py-2 bg-surface-elevated hover:bg-surface-elevated/80 rounded text-white"
              >
                Back to Tournaments
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />
      <div className="w-full px-4 py-6 pb-24 lg:pb-8">
        {/* Back link */}
        <Link
          to="/tournaments"
          className="inline-flex items-center text-secondary hover:text-white mb-4 text-sm"
        >
          ← Back to Tournaments
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            <StatusBadge status={tournament.status} />
          </div>

          <div className="flex items-center gap-4 text-sm text-secondary flex-wrap">
            <span>
              Round {tournament.currentRound} / {tournament.maxRounds}
            </span>
            <span>•</span>
            <span>{tournament.totalParticipants} participants</span>
            <span>•</span>
            <span>Created {new Date(tournament.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Champion banner */}
        {tournament.status === 'completed' && tournament.winner && (
          <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 mb-6 flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="text-warning font-semibold text-lg">
                Champion: {tournament.winner.name}
              </p>
              <p className="text-yellow-600 text-sm">Tournament Winner</p>
            </div>
          </div>
        )}

        {/* Bracket visualization — overflow-x-auto for mobile scroll affordance */}
        <div className="overflow-x-auto">
        <BracketView
          matches={tournament.matches}
          seedings={seedings}
          maxRounds={tournament.maxRounds}
          currentRound={tournament.currentRound}
          status={tournament.status}
          userRobotIds={userRobotIds}
        />
        </div>
      </div>
    </div>
  );
}

/** Status badge for tournament status */
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-surface-elevated text-secondary',
    active: 'bg-green-700 text-green-200',
    completed: 'bg-primary text-white',
  };

  const labels: Record<string, string> = {
    pending: 'Pending',
    active: 'Active',
    completed: 'Completed',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-surface-elevated text-secondary'}`}>
      {labels[status] || status}
    </span>
  );
}

export default TournamentDetailPage;
