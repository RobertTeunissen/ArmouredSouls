import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Tournament,
  createTournament,
  listTournaments,
  getTournamentDetails,
  executeRound,
  getEligibleRobots,
  TournamentDetails,
  EligibleRobotsResponse
} from '../utils/tournamentApi';

const TournamentManagement = () => {
  const { token } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournament, setActiveTournament] = useState<TournamentDetails | null>(null);
  const [eligibleRobots, setEligibleRobots] = useState<EligibleRobotsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadTournaments();
    loadEligibleRobots();
  }, []);

  const loadTournaments = async () => {
    if (!token) return;
    
    try {
      const data = await listTournaments(token);
      setTournaments(data.tournaments);
      
      // Load details for active tournament
      const active = data.tournaments.find(t => t.status === 'active');
      if (active) {
        const details = await getTournamentDetails(token, active.id);
        setActiveTournament(details.tournament);
      } else {
        setActiveTournament(null);
      }
    } catch (err: any) {
      console.error('Failed to load tournaments:', err);
      setError(err.response?.data?.error || 'Failed to load tournaments');
    }
  };

  const loadEligibleRobots = async () => {
    if (!token) return;
    
    try {
      const data = await getEligibleRobots(token);
      setEligibleRobots(data);
    } catch (err: any) {
      console.error('Failed to load eligible robots:', err);
    }
  };

  const handleCreateTournament = async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const result = await createTournament(token);
      setSuccessMessage(result.message);
      await loadTournaments();
      await loadEligibleRobots();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create tournament');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteRound = async (tournamentId: number) => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const result = await executeRound(token, tournamentId);
      setSuccessMessage(result.message);
      await loadTournaments();
      await loadEligibleRobots();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to execute round');
    } finally {
      setLoading(false);
    }
  };

  const getRoundName = (round: number, maxRounds: number) => {
    const remainingRounds = maxRounds - round + 1;
    if (remainingRounds === 1) return 'Finals';
    if (remainingRounds === 2) return 'Semi-finals';
    if (remainingRounds === 3) return 'Quarter-finals';
    return `Round ${round}/${maxRounds}`;
  };

  const activeTournaments = tournaments.filter(t => t.status === 'active');
  const pendingTournaments = tournaments.filter(t => t.status === 'pending');
  const completedTournaments = tournaments.filter(t => t.status === 'completed').slice(0, 5);

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <span className="text-3xl">🏆</span>
        Tournament Management
      </h2>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-900/50 border border-green-700 rounded text-green-200">
          {successMessage}
        </div>
      )}

      {/* Current Status */}
      <div className="mb-6 p-4 bg-gray-900/50 rounded border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">Current Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-400">Active Tournaments</div>
            <div className="text-2xl font-bold text-white">{activeTournaments.length}</div>
          </div>
          <div>
            <div className="text-gray-400">Pending Tournaments</div>
            <div className="text-2xl font-bold text-yellow-400">{pendingTournaments.length}</div>
          </div>
          <div>
            <div className="text-gray-400">Eligible Robots</div>
            <div className="text-2xl font-bold text-green-400">
              {eligibleRobots?.eligibleCount || 0}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Total Robots</div>
            <div className="text-2xl font-bold text-gray-400">
              {eligibleRobots?.totalRobots || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Create Tournament Button */}
      <div className="mb-6">
        <button
          onClick={handleCreateTournament}
          disabled={loading || activeTournaments.length > 0}
          className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 
                   text-white font-semibold rounded hover:from-yellow-700 hover:to-orange-700 
                   transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : '🏆 Create Single Elimination Tournament'}
        </button>
        {activeTournaments.length > 0 && (
          <p className="text-sm text-gray-400 mt-2">
            Complete or cancel active tournament before creating a new one
          </p>
        )}
      </div>

      {/* Active Tournament Details */}
      {activeTournament && (
        <div className="mb-6 p-4 bg-gradient-to-br from-yellow-900/20 to-orange-900/20 rounded border border-yellow-700/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-yellow-400">
              {activeTournament.name}
              <span className="ml-2 text-sm px-2 py-1 bg-green-600 rounded">ACTIVE</span>
            </h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
            <div>
              <div className="text-gray-400">Current Round</div>
              <div className="text-lg font-bold text-white">
                {getRoundName(activeTournament.currentRound, activeTournament.maxRounds)}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Total Participants</div>
              <div className="text-lg font-bold text-white">
                {activeTournament.totalParticipants}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Robots Remaining</div>
              <div className="text-lg font-bold text-white">
                {(activeTournament.currentRoundMatches || []).filter(m => !m.isByeMatch).length * 2}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Pending Matches</div>
              <div className="text-lg font-bold text-white">
                {(activeTournament.currentRoundMatches || []).filter(m => m.status !== 'completed').length}
              </div>
            </div>
          </div>

          {/* Current Round Matches */}
          {activeTournament.currentRoundMatches && activeTournament.currentRoundMatches.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Current Round Matches:</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {activeTournament.currentRoundMatches.map((match) => (
                  <div
                    key={match.id}
                    className={`p-2 rounded text-sm ${
                      match.status === 'completed'
                        ? 'bg-gray-900/50 text-gray-400'
                        : 'bg-gray-800 text-white'
                    }`}
                  >
                    {match.isByeMatch ? (
                      <span className="flex items-center gap-2">
                        <span className="text-yellow-400">🎖️</span>
                        {match.robot1?.name || 'TBD'} (Bye - Auto-advance)
                      </span>
                    ) : (
                      <span className="flex items-center justify-between">
                        <span>
                          {match.robot1?.name || 'TBD'} vs {match.robot2?.name || 'TBD'}
                        </span>
                        {match.status === 'completed' && match.winnerId && (
                          <span className="text-green-400">
                            Winner: {match.winnerId === match.robot1Id ? match.robot1?.name : match.robot2?.name}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => handleExecuteRound(activeTournament.id)}
            disabled={loading}
            className="w-full px-4 py-2 bg-green-600 text-white font-semibold rounded 
                     hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Executing...' : '⚔️ Execute Current Round'}
          </button>
        </div>
      )}

      {/* Pending Tournaments */}
      {pendingTournaments.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Pending Tournaments</h3>
          <div className="space-y-2">
            {pendingTournaments.map((tournament) => (
              <div key={tournament.id} className="p-3 bg-gray-900/50 rounded border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{tournament.name}</div>
                    <div className="text-sm text-gray-400">
                      {tournament.totalParticipants} participants • {tournament.maxRounds} rounds
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-yellow-600 rounded">PENDING</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Completed Tournaments */}
      {completedTournaments.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Recent Completed Tournaments</h3>
          <div className="space-y-2">
            {completedTournaments.map((tournament) => (
              <div key={tournament.id} className="p-3 bg-gray-900/50 rounded border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{tournament.name}</div>
                    <div className="text-sm text-gray-400">
                      Winner: {tournament.winner?.name || 'Unknown'} • 
                      {tournament.totalParticipants} participants
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-gray-600 rounded">COMPLETED</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Active Tournaments */}
      {activeTournaments.length === 0 && pendingTournaments.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p className="text-lg mb-2">No active tournaments</p>
          <p className="text-sm">
            Create a new tournament to get started. Requires at least 4 eligible robots.
          </p>
        </div>
      )}
    </div>
  );
};

export default TournamentManagement;
