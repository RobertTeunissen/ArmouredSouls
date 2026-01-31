import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import {
  getBattleLog,
  BattleLogResponse,
  BattleLogEvent,
  formatDateTime,
  formatDuration,
  getLeagueTierName,
} from '../utils/matchmakingApi';

function BattleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [battleLog, setBattleLog] = useState<BattleLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchBattleLog(parseInt(id));
    }
  }, [id]);

  const fetchBattleLog = async (battleId: number) => {
    try {
      setLoading(true);
      const data = await getBattleLog(battleId);
      setBattleLog(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch battle log:', err);
      if (err.response?.status === 404) {
        setError('Battle not found');
      } else if (err.response?.status === 403) {
        setError('Access denied to this battle');
      } else {
        setError('Failed to load battle details');
      }
    } finally {
      setLoading(false);
    }
  };

  const getWinnerText = () => {
    if (!battleLog) return '';
    if (!battleLog.winner) return 'DRAW';
    const winner = battleLog.winner === 'robot1' ? battleLog.robot1 : battleLog.robot2;
    return `${winner.name} WINS`;
  };

  const getWinnerColor = () => {
    if (!battleLog || !battleLog.winner) return 'text-gray-400';
    return 'text-green-400';
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-gray-800 p-6 rounded-lg">
            <p className="text-gray-400">Loading battle details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !battleLog) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-900 border border-red-600 p-6 rounded-lg">
            <p className="text-red-400">{error || 'Battle not found'}</p>
            <button
              onClick={() => navigate('/battle-history')}
              className="mt-4 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
            >
              Back to Battle History
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/battle-history')}
            className="text-blue-400 hover:text-blue-300 mb-4"
          >
            ← Back to Battle History
          </button>
          <h1 className="text-4xl font-bold">Battle Report #{battleLog.battleId}</h1>
          <p className="text-gray-400 mt-2">{formatDateTime(battleLog.createdAt)}</p>
        </div>

        {/* Battle Summary */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Robot 1 */}
            <div className="text-center">
              <h3 className="text-2xl font-bold text-blue-400 mb-2">{battleLog.robot1.name}</h3>
              <p className="text-gray-400 mb-4">{battleLog.robot1.owner}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">ELO:</span>
                  <span>
                    {battleLog.robot1.eloBefore} → {battleLog.robot1.eloAfter}{' '}
                    <span
                      className={
                        battleLog.robot1.eloAfter - battleLog.robot1.eloBefore >= 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      }
                    >
                      ({battleLog.robot1.eloAfter - battleLog.robot1.eloBefore > 0 ? '+' : ''}
                      {battleLog.robot1.eloAfter - battleLog.robot1.eloBefore})
                    </span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Final HP:</span>
                  <span>{battleLog.robot1.finalHP}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Damage Dealt:</span>
                  <span>{battleLog.robot1.damageDealt}</span>
                </div>
              </div>
            </div>

            {/* Battle Result */}
            <div className="flex flex-col items-center justify-center">
              <div className={`text-3xl font-bold mb-2 ${getWinnerColor()}`}>
                {getWinnerText()}
              </div>
              <div className="text-gray-400 text-sm space-y-1">
                <div>{getLeagueTierName(battleLog.leagueType)} League</div>
                <div>Duration: {formatDuration(battleLog.duration)}</div>
              </div>
            </div>

            {/* Robot 2 */}
            <div className="text-center">
              <h3 className="text-2xl font-bold text-blue-400 mb-2">{battleLog.robot2.name}</h3>
              <p className="text-gray-400 mb-4">{battleLog.robot2.owner}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">ELO:</span>
                  <span>
                    {battleLog.robot2.eloBefore} → {battleLog.robot2.eloAfter}{' '}
                    <span
                      className={
                        battleLog.robot2.eloAfter - battleLog.robot2.eloBefore >= 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      }
                    >
                      ({battleLog.robot2.eloAfter - battleLog.robot2.eloBefore > 0 ? '+' : ''}
                      {battleLog.robot2.eloAfter - battleLog.robot2.eloBefore})
                    </span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Final HP:</span>
                  <span>{battleLog.robot2.finalHP}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Damage Dealt:</span>
                  <span>{battleLog.robot2.damageDealt}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Combat Log */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Combat Messages</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {battleLog.battleLog.events && battleLog.battleLog.events.length > 0 ? (
              battleLog.battleLog.events.map((event: BattleLogEvent, index: number) => (
                <div
                  key={index}
                  className="bg-gray-700 p-3 rounded border border-gray-600 flex items-start gap-3"
                >
                  <div className="text-gray-400 text-sm font-mono whitespace-nowrap flex-shrink-0">
                    {event.timestamp.toFixed(1)}s
                  </div>
                  <div className="flex-1 text-sm">{event.message}</div>
                </div>
              ))
            ) : (
              <p className="text-gray-400">No combat messages available for this battle.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BattleDetailPage;
