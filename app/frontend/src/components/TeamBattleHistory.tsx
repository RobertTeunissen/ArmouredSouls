/**
 * TeamBattleHistory — Displays team battle history for a specific robot,
 * grouped by team size (2v2, 3v3, tag team).
 *
 * Uses the shared CompactBattleCard component for consistent card rendering
 * across the app (same cards as RecentMatches and BattleHistoryPage).
 *
 * Requirements: R9.3, R9.11, R9.15
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getMatchHistory, BattleHistory, PaginatedResponse, getBattleOutcome, getELOChange, getBattleReward } from '../utils/matchmakingApi';
import CompactBattleCard from './CompactBattleCard';

interface TeamBattleHistoryProps {
  robotId: number;
}

type TeamBattleTab = 'league_2v2' | 'league_3v3' | 'tag_team';

function TeamBattleHistory({ robotId }: TeamBattleHistoryProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TeamBattleTab>('league_2v2');
  const [battles, setBattles] = useState<Record<TeamBattleTab, BattleHistory[]>>({
    league_2v2: [],
    league_3v3: [],
    tag_team: [],
  });
  const [pagination, setPagination] = useState<Record<TeamBattleTab, { page: number; totalPages: number; total: number }>>({
    league_2v2: { page: 1, totalPages: 1, total: 0 },
    league_3v3: { page: 1, totalPages: 1, total: 0 },
    tag_team: { page: 1, totalPages: 1, total: 0 },
  });
  const [loading, setLoading] = useState(true);

  const fetchBattles = useCallback(async (tab: TeamBattleTab, page: number) => {
    const result: PaginatedResponse<BattleHistory> = await getMatchHistory(page, 50, tab, robotId);

    setBattles(prev => ({ ...prev, [tab]: result.data }));
    setPagination(prev => ({
      ...prev,
      [tab]: { page: result.pagination.page, totalPages: result.pagination.totalPages, total: result.pagination.total },
    }));
  }, [robotId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchBattles('league_2v2', 1),
      fetchBattles('league_3v3', 1),
      fetchBattles('tag_team', 1),
    ])
      .catch(() => {
        // Silently handle errors - empty state will show
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [fetchBattles]);

  const handlePageChange = async (page: number) => {
    setLoading(true);
    await fetchBattles(activeTab, page).catch(() => {});
    setLoading(false);
  };

  const isMyRobot = (robotUserId: number): boolean => {
    return user != null && robotUserId === user.id;
  };

  const getMatchData = (battle: BattleHistory) => {
    const isMyRobot1 = isMyRobot(battle.robot1.userId);
    const myRobot = isMyRobot1 ? battle.robot1 : battle.robot2;
    const opponent = isMyRobot1 ? battle.robot2 : battle.robot1;
    const myRobotId = myRobot.id;
    const outcome = getBattleOutcome(battle, myRobotId);
    const eloChange = getELOChange(battle, myRobotId);

    return { myRobot, opponent, outcome, eloChange, myRobotId };
  };

  const currentBattles = battles[activeTab];
  const currentPagination = pagination[activeTab];
  const hasAnyBattles = pagination.league_2v2.total > 0 || pagination.league_3v3.total > 0 || pagination.tag_team.total > 0;

  if (loading) {
    return (
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Team Battle History</h3>
        <div className="flex items-center justify-center py-8 text-secondary">
          Loading team battle history...
        </div>
      </div>
    );
  }

  if (!hasAnyBattles) {
    return (
      <div className="bg-surface rounded-lg p-6" data-testid="team-battle-history-empty">
        <h3 className="text-lg font-semibold text-white mb-4">Team Battle History</h3>
        <div className="flex flex-col items-center justify-center py-12 text-secondary">
          <span className="text-3xl mb-3" aria-hidden="true">⚔️</span>
          <p className="text-center">No team battle history yet.</p>
          <p className="text-center text-sm mt-1">
            Register this robot in a 2v2 or 3v3 team to start competing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg p-6" data-testid="team-battle-history">
      <h3 className="text-lg font-semibold text-white mb-4">Team Battle History</h3>

      {/* Tab Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('league_2v2')}
          className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'league_2v2'
              ? 'bg-primary text-white'
              : 'bg-surface-elevated text-secondary hover:text-white'
          }`}
          aria-pressed={activeTab === 'league_2v2'}
        >
          2v2 League ({pagination.league_2v2.total})
        </button>
        <button
          onClick={() => setActiveTab('league_3v3')}
          className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'league_3v3'
              ? 'bg-primary text-white'
              : 'bg-surface-elevated text-secondary hover:text-white'
          }`}
          aria-pressed={activeTab === 'league_3v3'}
        >
          3v3 League ({pagination.league_3v3.total})
        </button>
        <button
          onClick={() => setActiveTab('tag_team')}
          className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'tag_team'
              ? 'bg-primary text-white'
              : 'bg-surface-elevated text-secondary hover:text-white'
          }`}
          aria-pressed={activeTab === 'tag_team'}
        >
          Tag Team ({pagination.tag_team.total})
        </button>
      </div>

      {/* Battle List */}
      {currentBattles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-secondary" data-testid={`team-battle-history-${activeTab}-empty`}>
          <p>No {activeTab === 'league_2v2' ? '2v2' : activeTab === 'league_3v3' ? '3v3' : 'tag team'} battles recorded yet.</p>
        </div>
      ) : (
        <>
          <div className="space-y-0">
            {currentBattles.map((battle) => {
              const { myRobot, opponent, outcome, eloChange, myRobotId } = getMatchData(battle);
              const reward = getBattleReward(battle, myRobotId);

              return (
                <CompactBattleCard
                  key={battle.id}
                  battle={battle}
                  myRobot={myRobot}
                  opponent={opponent}
                  outcome={outcome}
                  eloChange={eloChange}
                  myRobotId={myRobotId}
                  reward={reward}
                  prestige={battle.prestigeAwarded}
                  fame={battle.fameAwarded}
                  streamingRevenue={battle.streamingRevenue}
                  onClick={() => navigate(`/battle/${battle.id}`)}
                />
              );
            })}
          </div>

          {/* Pagination */}
          {currentPagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-white/10">
              <button
                onClick={() => handlePageChange(currentPagination.page - 1)}
                disabled={currentPagination.page <= 1}
                className="px-3 py-1.5 min-h-[44px] text-sm rounded bg-surface-elevated text-secondary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <span className="text-sm text-secondary">
                Page {currentPagination.page} of {currentPagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPagination.page + 1)}
                disabled={currentPagination.page >= currentPagination.totalPages}
                className="px-3 py-1.5 min-h-[44px] text-sm rounded bg-surface-elevated text-secondary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default TeamBattleHistory;
