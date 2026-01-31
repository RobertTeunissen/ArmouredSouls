import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import {
  getMatchHistory,
  BattleHistory,
  PaginatedResponse,
  getBattleOutcome,
  getELOChange,
  formatDateTime,
  formatDuration,
} from '../utils/matchmakingApi';

function BattleHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [battles, setBattles] = useState<BattleHistory[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBattles(1);
  }, []);

  const fetchBattles = async (page: number) => {
    try {
      setLoading(true);
      const data: PaginatedResponse<BattleHistory> = await getMatchHistory(page, 20);
      setBattles(data.data);
      setPagination(data.pagination);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch battle history:', err);
      setError('Failed to load battle history');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchBattles(newPage);
  };

  const isMyRobot = (robotUserId: number) => {
    return user && robotUserId === user.id;
  };

  const getMatchData = (battle: BattleHistory) => {
    const myRobot = isMyRobot(battle.robot1.userId) ? battle.robot1 : battle.robot2;
    const opponent = isMyRobot(battle.robot1.userId) ? battle.robot2 : battle.robot1;
    const myRobotId = myRobot.id;
    const outcome = getBattleOutcome(battle, myRobotId);
    const eloChange = getELOChange(battle, myRobotId);

    return { myRobot, opponent, outcome, eloChange, myRobotId };
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'win':
        return 'bg-green-900 border-green-600 text-green-400';
      case 'loss':
        return 'bg-red-900 border-red-600 text-red-400';
      case 'draw':
        return 'bg-gray-700 border-gray-500 text-gray-400';
      default:
        return 'bg-gray-700 border-gray-500 text-gray-400';
    }
  };

  const getOutcomeText = (outcome: string) => {
    switch (outcome) {
      case 'win':
        return 'VICTORY';
      case 'loss':
        return 'DEFEAT';
      case 'draw':
        return 'DRAW';
      default:
        return 'N/A';
    }
  };

  const getReward = (battle: BattleHistory, robotId: number) => {
    return battle.winnerId === robotId ? battle.winnerReward : battle.loserReward;
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6">Battle History</h1>

        {loading && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <p className="text-gray-400">Loading battles...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-600 p-6 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && battles.length === 0 && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <p className="text-gray-400">No battles yet. Your first match is coming soon!</p>
          </div>
        )}

        {!loading && !error && battles.length > 0 && (
          <>
            <div className="space-y-4 mb-6">
              {battles.map((battle) => {
                const { myRobot, opponent, outcome, eloChange, myRobotId } = getMatchData(battle);
                const outcomeClass = getOutcomeColor(outcome);
                const reward = getReward(battle, myRobotId);

                return (
                  <div
                    key={battle.id}
                    className={`border p-4 rounded-lg ${outcomeClass}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      {/* Battle Outcome */}
                      <div className="flex-shrink-0">
                        <div className="text-2xl font-bold mb-1">
                          {getOutcomeText(outcome)}
                        </div>
                        <div className="text-sm opacity-75">
                          {formatDateTime(battle.createdAt)}
                        </div>
                      </div>

                      {/* Battle Participants */}
                      <div className="flex-1">
                        <div className="grid grid-cols-3 gap-4 items-center">
                          <div className="text-right">
                            <div className="font-semibold text-blue-400">{myRobot.name}</div>
                            <div className="text-sm opacity-75">You</div>
                          </div>

                          <div className="text-center text-xl font-bold opacity-50">VS</div>

                          <div className="text-left">
                            <div className="font-semibold">{opponent.name}</div>
                            <div className="text-sm opacity-75">{opponent.user.username}</div>
                          </div>
                        </div>
                      </div>

                      {/* Battle Stats */}
                      <div className="flex-shrink-0 text-right space-y-1">
                        <div className={eloChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                          ELO: {eloChange > 0 ? '+' : ''}
                          {eloChange}
                        </div>
                        <div className="text-sm opacity-75">
                          Reward: ₡{reward.toLocaleString()}
                        </div>
                        <div className="text-sm opacity-75">
                          Duration: {formatDuration(battle.durationSeconds)}
                        </div>
                      </div>
                    </div>

                    {/* Detailed Stats */}
                    <div className="mt-4 pt-4 border-t border-opacity-25 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="opacity-75 mb-1">ELO Change</div>
                        <div className="font-semibold">
                          {battle.robot1Id === myRobotId
                            ? `${battle.robot1ELOBefore} → ${battle.robot1ELOAfter}`
                            : `${battle.robot2ELOBefore} → ${battle.robot2ELOAfter}`}
                        </div>
                      </div>
                      <div>
                        <div className="opacity-75 mb-1">Final HP</div>
                        <div className="font-semibold">
                          {battle.robot1Id === myRobotId
                            ? battle.robot1FinalHP
                            : battle.robot2FinalHP}
                          %
                        </div>
                      </div>
                      <div>
                        <div className="opacity-75 mb-1">Opponent HP</div>
                        <div className="font-semibold">
                          {battle.robot1Id === myRobotId
                            ? battle.robot2FinalHP
                            : battle.robot1FinalHP}
                          %
                        </div>
                      </div>
                      <div>
                        <div className="opacity-75 mb-1">Battle ID</div>
                        <div className="font-semibold">#{battle.id}</div>
                      </div>
                    </div>

                    {/* View Details Button */}
                    <div className="mt-4 pt-4 border-t border-opacity-25">
                      <button
                        onClick={() => navigate(`/battle/${battle.id}`)}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                      >
                        View Detailed Battle Report
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2">
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

export default BattleHistoryPage;
