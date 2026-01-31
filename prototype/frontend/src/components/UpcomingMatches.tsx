import { useEffect, useState } from 'react';
import { getUpcomingMatches, ScheduledMatch, formatDateTime, getLeagueTierColor, getLeagueTierName } from '../utils/matchmakingApi';
import { useAuth } from '../contexts/AuthContext';

function UpcomingMatches() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<ScheduledMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const data = await getUpcomingMatches();
      setMatches(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch upcoming matches:', err);
      setError('Failed to load upcoming matches');
    } finally {
      setLoading(false);
    }
  };

  const isMyRobot = (robotUserId: number) => {
    return user && robotUserId === user.id;
  };

  const getMatchResult = (match: ScheduledMatch) => {
    const myRobot = isMyRobot(match.robot1.userId) ? match.robot1 : match.robot2;
    const opponent = isMyRobot(match.robot1.userId) ? match.robot2 : match.robot1;
    return { myRobot, opponent };
  };

  if (loading) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">Upcoming Matches</h2>
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">Upcoming Matches</h2>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">Upcoming Matches</h2>
        <p className="text-gray-400">No upcoming matches scheduled</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h2 className="text-2xl font-semibold mb-4">Upcoming Matches</h2>
      <div className="space-y-4">
        {matches.map((match) => {
          const { myRobot, opponent } = getMatchResult(match);
          const tierColor = getLeagueTierColor(match.leagueType);
          const tierName = getLeagueTierName(match.leagueType);
          
          return (
            <div key={match.id} className="bg-gray-700 p-4 rounded border border-gray-600">
              <div className="flex justify-between items-start mb-2">
                <span className={`text-sm font-semibold ${tierColor}`}>
                  {tierName} League
                </span>
                <span className="text-sm text-gray-400">
                  {formatDateTime(match.scheduledFor)}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 items-center">
                {/* Your Robot */}
                <div className="text-right">
                  <div className="font-semibold text-blue-400">{myRobot.name}</div>
                  <div className="text-sm text-gray-400">
                    ELO: {myRobot.elo}
                  </div>
                  <div className="text-xs text-gray-500">
                    HP: {myRobot.currentHP}/{myRobot.maxHP}
                  </div>
                </div>
                
                {/* VS */}
                <div className="text-center">
                  <span className="text-gray-500 font-bold">VS</span>
                </div>
                
                {/* Opponent */}
                <div className="text-left">
                  <div className="font-semibold">{opponent.name}</div>
                  <div className="text-sm text-gray-400">
                    ELO: {opponent.elo}
                  </div>
                  <div className="text-xs text-gray-500">
                    {opponent.user.username}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default UpcomingMatches;
