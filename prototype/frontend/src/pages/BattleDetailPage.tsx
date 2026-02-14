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
    
    // For tag team battles, show team victory with team name
    if (battleLog.battleType === 'tag_team' && battleLog.tagTeam) {
      const winningTeam = battleLog.winner === 'robot1' ? battleLog.tagTeam.team1 : battleLog.tagTeam.team2;
      const teamName = winningTeam.stableName || `Team ${winningTeam.teamId}`;
      return `${teamName.toUpperCase()} WINS`;
    }
    
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

      <div className="container mx-auto px-4 py-4">
        {/* Header */}
        <div className="mb-3">
          <button
            onClick={() => navigate('/battle-history')}
            className="text-blue-400 hover:text-blue-300 mb-2 transition-colors text-sm"
          >
            ← Back to Battle History
          </button>
          <h1 className="text-3xl font-bold">Battle Report #{battleLog.battleId}</h1>
          <p className="text-gray-400 mt-1 text-sm">{formatDateTime(battleLog.createdAt)}</p>
        </div>

        {/* Battle Result Banner */}
        <div className={`mb-3 p-3 rounded-lg text-center ${
          !battleLog.winner ? 'bg-yellow-900/20 border-2 border-yellow-600' :
          battleLog.winner === 'robot1' && battleLog.robot1.owner === user?.username ? 'bg-green-900/20 border-2 border-green-600' :
          battleLog.winner === 'robot2' && battleLog.robot2.owner === user?.username ? 'bg-green-900/20 border-2 border-green-600' :
          'bg-red-900/20 border-2 border-red-600'
        }`}>
          <div className={`text-3xl font-bold mb-1 ${getWinnerColor()}`}>
            {getWinnerText()}
          </div>
          <div className="text-gray-300 text-sm">
            {battleLog.battleType === 'tag_team' ? (
              <>🤝 Tag Team Battle • Duration: {formatDuration(battleLog.duration)}</>
            ) : (
              <>{getLeagueTierName(battleLog.leagueType)} League • Duration: {formatDuration(battleLog.duration)}</>
            )}
          </div>
        </div>

        {/* Tag Team Info (if applicable) */}
        {battleLog.battleType === 'tag_team' && battleLog.tagTeam && (
          <div className="bg-cyan-900/20 border border-cyan-600 rounded-lg mb-3 p-3">
            <h3 className="text-lg font-bold text-cyan-400 mb-2">Tag Team Battle</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {/* Team 1 */}
              <div className="space-y-1">
                <div className="font-semibold text-white text-base">
                  {battleLog.tagTeam.team1.stableName || `Team ${battleLog.tagTeam.team1.teamId}`}
                </div>
                {battleLog.tagTeam.team1.activeRobot && (
                  <div className="text-gray-300">
                    <span className="text-primary">Active:</span> {battleLog.tagTeam.team1.activeRobot.name}
                  </div>
                )}
                {battleLog.tagTeam.team1.reserveRobot && (
                  <div className="text-gray-300">
                    <span className="text-white">Reserve:</span> {battleLog.tagTeam.team1.reserveRobot.name}
                  </div>
                )}
                {battleLog.tagTeam.team1.tagOutTime !== null && (
                  <div className="text-xs text-cyan-400">
                    Tagged out at {battleLog.tagTeam.team1.tagOutTime.toFixed(1)}s
                  </div>
                )}
              </div>
              
              {/* Team 2 */}
              <div className="space-y-1">
                <div className="font-semibold text-white text-base">
                  {battleLog.tagTeam.team2.stableName || `Team ${battleLog.tagTeam.team2.teamId}`}
                </div>
                {battleLog.tagTeam.team2.activeRobot && (
                  <div className="text-gray-300">
                    <span className="text-primary">Active:</span> {battleLog.tagTeam.team2.activeRobot.name}
                  </div>
                )}
                {battleLog.tagTeam.team2.reserveRobot && (
                  <div className="text-gray-300">
                    <span className="text-white">Reserve:</span> {battleLog.tagTeam.team2.reserveRobot.name}
                  </div>
                )}
                {battleLog.tagTeam.team2.tagOutTime !== null && (
                  <div className="text-xs text-cyan-400">
                    Tagged out at {battleLog.tagTeam.team2.tagOutTime.toFixed(1)}s
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Battle Summary - Horizontal Compact Layout */}
        <div className="bg-gray-800 rounded-lg mb-3 p-3">
          {/* Robot Names Row */}
          <div className="grid grid-cols-2 gap-4 mb-2 pb-2 border-b border-gray-700">
            <div>
              <h3 className="text-lg font-bold text-blue-400">{battleLog.robot1.name}</h3>
              <p className="text-gray-400 text-xs">Pilot: {battleLog.robot1.owner}</p>
            </div>
            <div className="text-right">
              <h3 className="text-lg font-bold text-blue-400">{battleLog.robot2.name}</h3>
              <p className="text-gray-400 text-xs">Pilot: {battleLog.robot2.owner}</p>
            </div>
          </div>

          {/* ELO Changes Row */}
          <div className="grid grid-cols-2 gap-4 mb-2 pb-2 border-b border-gray-700">
            <div className="flex items-center justify-between bg-gray-900 rounded px-2 py-1.5">
              <span className="text-xs text-gray-400">ELO</span>
              <div className="flex items-center gap-1.5 text-sm">
                <span>{battleLog.robot1.eloBefore}</span>
                <span className="text-gray-500">→</span>
                <span className="font-bold">{battleLog.robot1.eloAfter}</span>
                <span
                  className={`text-xs font-bold ${
                    battleLog.robot1.eloAfter - battleLog.robot1.eloBefore >= 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  ({battleLog.robot1.eloAfter - battleLog.robot1.eloBefore > 0 ? '+' : ''}
                  {battleLog.robot1.eloAfter - battleLog.robot1.eloBefore})
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between bg-gray-900 rounded px-2 py-1.5">
              <span className="text-xs text-gray-400">ELO</span>
              <div className="flex items-center gap-1.5 text-sm">
                <span>{battleLog.robot2.eloBefore}</span>
                <span className="text-gray-500">→</span>
                <span className="font-bold">{battleLog.robot2.eloAfter}</span>
                <span
                  className={`text-xs font-bold ${
                    battleLog.robot2.eloAfter - battleLog.robot2.eloBefore >= 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  ({battleLog.robot2.eloAfter - battleLog.robot2.eloBefore > 0 ? '+' : ''}
                  {battleLog.robot2.eloAfter - battleLog.robot2.eloBefore})
                </span>
              </div>
            </div>
          </div>

          {/* Rewards & Stats Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            {/* Robot 1 Rewards & Stats */}
            <div className="space-y-1">
              {battleLog.robot1.reward !== undefined && battleLog.robot1.reward !== null && (
                <div className="flex items-center justify-between bg-gray-900 rounded px-2 py-1">
                  <span className="text-gray-400">💰 Credits</span>
                  <span className="font-bold text-green-400">₡{battleLog.robot1.reward}</span>
                </div>
              )}
              {battleLog.robot1.prestige !== undefined && battleLog.robot1.prestige > 0 && (
                <div className="flex items-center justify-between bg-gray-900 rounded px-2 py-1">
                  <span className="text-gray-400">⭐ Prestige</span>
                  <span className="font-bold text-purple-400">+{battleLog.robot1.prestige}</span>
                </div>
              )}
              {battleLog.robot1.fame !== undefined && battleLog.robot1.fame > 0 && (
                <div className="flex items-center justify-between bg-gray-900 rounded px-2 py-1">
                  <span className="text-gray-400">🎖️ Fame</span>
                  <span className="font-bold text-yellow-400">+{battleLog.robot1.fame}</span>
                </div>
              )}
              <div className="flex items-center justify-between bg-gray-900 rounded px-2 py-1">
                <span className="text-gray-400">Final HP</span>
                <span>{battleLog.robot1.finalHP}%</span>
              </div>
              <div className="flex items-center justify-between bg-gray-900 rounded px-2 py-1">
                <span className="text-gray-400">Damage</span>
                <span className="text-blue-400">{battleLog.robot1.damageDealt}</span>
              </div>
            </div>

            {/* Robot 2 Rewards & Stats */}
            <div className="space-y-1">
              {battleLog.robot2.reward !== undefined && battleLog.robot2.reward !== null && (
                <div className="flex items-center justify-between bg-gray-900 rounded px-2 py-1">
                  <span className="text-gray-400">💰 Credits</span>
                  <span className="font-bold text-green-400">₡{battleLog.robot2.reward}</span>
                </div>
              )}
              {battleLog.robot2.prestige !== undefined && battleLog.robot2.prestige > 0 && (
                <div className="flex items-center justify-between bg-gray-900 rounded px-2 py-1">
                  <span className="text-gray-400">⭐ Prestige</span>
                  <span className="font-bold text-purple-400">+{battleLog.robot2.prestige}</span>
                </div>
              )}
              {battleLog.robot2.fame !== undefined && battleLog.robot2.fame > 0 && (
                <div className="flex items-center justify-between bg-gray-900 rounded px-2 py-1">
                  <span className="text-gray-400">🎖️ Fame</span>
                  <span className="font-bold text-yellow-400">+{battleLog.robot2.fame}</span>
                </div>
              )}
              <div className="flex items-center justify-between bg-gray-900 rounded px-2 py-1">
                <span className="text-gray-400">Final HP</span>
                <span>{battleLog.robot2.finalHP}%</span>
              </div>
              <div className="flex items-center justify-between bg-gray-900 rounded px-2 py-1">
                <span className="text-gray-400">Damage</span>
                <span className="text-blue-400">{battleLog.robot2.damageDealt}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Combat Log */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-xl font-bold mb-3">Combat Messages</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {battleLog.battleLog.events && battleLog.battleLog.events.length > 0 ? (
              battleLog.battleLog.events
                .filter((event: BattleLogEvent) => {
                  // Filter out financial/reward messages since they're now in the top summary
                  const message = event.message.toLowerCase();
                  return !message.includes('financial') && 
                         !message.includes('₡') && 
                         !message.includes('credits') &&
                         !message.includes('winner (') &&
                         !message.includes('loser (') &&
                         !message.includes('league base') &&
                         !message.includes('participation');
                })
                .map((event: BattleLogEvent, index: number) => {
                // Determine event color based on type
                let eventColor = 'border-gray-600';
                let bgColor = 'bg-gray-700';
                let icon = '';
                
                if (event.type === 'battle_start') {
                  eventColor = 'border-blue-500';
                  bgColor = 'bg-blue-900/20';
                } else if (event.type === 'battle_end') {
                  eventColor = 'border-green-500';
                  bgColor = 'bg-green-900/20';
                } else if (event.type === 'tag_out') {
                  eventColor = 'border-orange-500';
                  bgColor = 'bg-orange-900/20';
                  icon = '🔄';
                } else if (event.type === 'tag_in') {
                  eventColor = 'border-cyan-500';
                  bgColor = 'bg-cyan-900/20';
                  icon = '⚡';
                } else if (event.type === 'attack' && event.message.includes('CRITICAL')) {
                  eventColor = 'border-red-500';
                  bgColor = 'bg-red-900/20';
                } else if (event.type === 'miss') {
                  eventColor = 'border-gray-500';
                  bgColor = 'bg-gray-800';
                }

                return (
                  <div
                    key={index}
                    className={`${bgColor} p-3 rounded border-l-4 ${eventColor} flex items-start gap-3 transition-colors hover:bg-gray-600/50`}
                  >
                    <div className="text-gray-400 text-sm font-mono whitespace-nowrap flex-shrink-0 min-w-[50px]">
                      {event.timestamp.toFixed(1)}s
                    </div>
                    {icon && <div className="text-lg flex-shrink-0">{icon}</div>}
                    <div className="flex-1 text-sm leading-relaxed">{event.message}</div>
                  </div>
                );
              })
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
