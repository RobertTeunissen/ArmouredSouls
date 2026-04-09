import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import {
  getBattleLog,
  formatDateTime,
} from '../utils/matchmakingApi';
import type { BattleLogResponse } from '../utils/matchmakingApi';
import { BattlePlaybackViewer } from '../components/BattlePlaybackViewer/BattlePlaybackViewer';
import {
  BattleResultBanner,
  TagTeamInfo,
  KothParticipants,
  BattleSummary,
  ArenaSummary,
  CombatMessages,
  useBattlePlaybackData,
} from '../components/battle-detail';

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
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
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

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-surface p-6 rounded-lg">
            <p className="text-secondary">Loading battle details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !battleLog) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-900 border border-red-600 p-6 rounded-lg">
            <p className="text-error">{error || 'Battle not found'}</p>
            <button
              onClick={() => navigate('/battle-history')}
              className="mt-4 px-4 py-2 bg-surface-elevated rounded hover:bg-gray-600"
            >
              Back to Battle History
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <BattleDetailContent battleLog={battleLog} userId={user.id} />;
}

function BattleDetailContent({ battleLog, userId }: { battleLog: BattleLogResponse; userId?: number }) {
  const navigate = useNavigate();
  const {
    showPlaybackViewer,
    playbackResult,
    robot1PlaybackInfo,
    robot2PlaybackInfo,
    extraPlaybackRobots,
    narrativePlaybackEvents,
    isTagTeam,
    kothPlaybackData,
  } = useBattlePlaybackData(battleLog);

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />
      <div className="container mx-auto px-4 py-4 pb-24 lg:pb-8">
        {/* Header */}
        <div className="mb-3">
          <button
            onClick={() => navigate('/battle-history')}
            className="text-primary hover:text-blue-300 mb-2 transition-colors text-sm"
          >
            ← Back to Battle History
          </button>
          <h1 className="text-3xl font-bold">Battle Report #{battleLog.battleId}</h1>
          <p className="text-secondary mt-1 text-sm">{formatDateTime(battleLog.createdAt)}</p>
        </div>

        <BattleResultBanner battleLog={battleLog} userId={userId} />
        <TagTeamInfo battleLog={battleLog} />
        <KothParticipants battleLog={battleLog} userId={userId} />
        <BattleSummary battleLog={battleLog} />
        <ArenaSummary battleLog={battleLog} />

        {/* Battle Playback / Combat Log */}
        {showPlaybackViewer && playbackResult && robot1PlaybackInfo && robot2PlaybackInfo ? (
          <div className="bg-surface p-3 rounded-lg">
            <h2 className="text-lg font-bold mb-2">Battle Playback</h2>
            <BattlePlaybackViewer
              battleResult={playbackResult}
              robot1Info={robot1PlaybackInfo}
              robot2Info={robot2PlaybackInfo}
              extraRobots={extraPlaybackRobots}
              narrativeEvents={narrativePlaybackEvents}
              isTagTeam={isTagTeam}
              kothData={kothPlaybackData}
            />
          </div>
        ) : (
          <CombatMessages battleLog={battleLog} />
        )}
      </div>
    </div>
  );
}

export default BattleDetailPage;
