import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import AchievementBadge from '../components/AchievementBadge';
import {
  getBattleLog,
  formatDateTime,
  isTeamBattleType,
} from '../utils/matchmakingApi';
import type { BattleLogResponse, BattleLogParticipant } from '../utils/matchmakingApi';
import { BattlePlaybackViewer } from '../components/BattlePlaybackViewer/BattlePlaybackViewer';
import { computeBattleStatistics } from '../utils/battleStatistics';
import { useMediaQuery } from '../hooks/useMediaQuery';
import type { TabId } from '../components/battle-detail/types';
import {
  BattleResultBanner,
  StableRewards,
  ArenaSummary,
  CombatMessages,
  BattleStatisticsSummary,
  DamageFlowDiagram,
  TabLayout,
  useBattlePlaybackData,
  TeamBattleMetrics,
} from '../components/battle-detail';
import { PlaybackUnavailableNotice } from '../components/battle-detail/PlaybackUnavailableNotice';
import { RobotSelector } from '../components/battle-detail/RobotSelector';

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
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 404) {
          setError('Battle not found');
        } else if (err.response?.status === 403) {
          setError('Access denied to this battle');
        } else {
          setError('Failed to load battle details');
        }
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
        <div className="container mx-auto px-4 py-4">
          <div className="bg-surface p-3 rounded-lg">
            <p className="text-secondary text-sm">Loading battle details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !battleLog) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-4">
          <div className="bg-error/10 border border-error p-3 rounded-lg">
            <p className="text-error">{error || 'Battle not found'}</p>
            <button
              onClick={() => navigate('/battle-history')}
              className="mt-4 px-4 py-2 bg-surface-elevated rounded hover:bg-surface transition-colors duration-150 ease-out motion-reduce:transition-none"
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

/**
 * Canonical participant ordering — winner first, then by placement/team.
 * Used once on the page; all components receive the same ordered list.
 *
 * - KotH: sorted by placement (1st, 2nd, 3rd…)
 * - Tag team: winning team first, then losing team (active before reserve within each team)
 * - Team battle (2v2/3v3): winning team first, grouped by team
 * - 1v1 / tournament: winner first, loser second. Draw keeps API order.
 */
function orderParticipants(battleLog: BattleLogResponse): BattleLogParticipant[] {
  const participants = battleLog.participants ?? [];
  if (participants.length === 0) return participants;

  // KotH: placement is the natural order (1st = winner)
  if (battleLog.battleType === 'koth') {
    return [...participants].sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));
  }

  // Team battles (2v2/3v3): group by team, winning team first
  if (isTeamBattleType(battleLog.battleType)) {
    const winningSide = (() => {
      if (battleLog.winner === 'robot1') return 1;
      if (battleLog.winner === 'robot2') return 2;
      return null;
    })();

    return [...participants].sort((a, b) => {
      // Winning team first
      if (winningSide !== null) {
        const aWin = a.team === winningSide ? 0 : 1;
        const bWin = b.team === winningSide ? 0 : 1;
        if (aWin !== bWin) return aWin - bWin;
      }
      // Within same team, sort by team number then keep API order
      if (a.team !== b.team) return a.team - b.team;
      return 0;
    });
  }

  // Determine winning team/robot
  const winningTeam = (() => {
    if (battleLog.battleType !== 'tag_team') return null;
    if (battleLog.winner === 'robot1') return 1;
    if (battleLog.winner === 'robot2') return 2;
    return null;
  })();

  const winnerId = (() => {
    if (battleLog.winner === 'robot1') return battleLog.robot1?.id ?? null;
    if (battleLog.winner === 'robot2') return battleLog.robot2?.id ?? null;
    return null;
  })();

  if (winningTeam !== null) {
    // Tag team: winning team first
    return [...participants].sort((a, b) => {
      const aWin = a.team === winningTeam ? 0 : 1;
      const bWin = b.team === winningTeam ? 0 : 1;
      if (aWin !== bWin) return aWin - bWin;
      // Within same team, keep API order (active before reserve)
      return 0;
    });
  }

  if (winnerId !== null) {
    // 1v1 / tournament: winner first
    return [...participants].sort((a, b) => {
      const aWin = a.robotId === winnerId ? 0 : 1;
      const bWin = b.robotId === winnerId ? 0 : 1;
      return aWin - bWin;
    });
  }

  // Draw — keep API order
  return participants;
}

function BattleDetailContent({ battleLog: rawBattleLog, userId }: { battleLog: BattleLogResponse; userId?: number }) {
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedRobotIndex, setSelectedRobotIndex] = useState(0);

  // Compute canonical participant order once — all components use this same order.
  const battleLog = useMemo((): BattleLogResponse => {
    const ordered = orderParticipants(rawBattleLog);
    if (ordered === rawBattleLog.participants) return rawBattleLog;
    return { ...rawBattleLog, participants: ordered };
  }, [rawBattleLog]);

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

  // Determine if playback is available — API flag takes precedence, then hook detection
  const hasPlayback = (battleLog.playbackAvailable !== false) && showPlaybackViewer && !!playbackResult;

  // Use pre-computed summary from backend if available (Spec #39).
  // Falls back to client-side computation from events for battles without summaries.
  const statistics = useMemo(() => {
    // If summary is available from the API, use it directly (fast path — no client computation)
    if (battleLog.summary?.hasData) {
      return {
        perRobot: battleLog.summary.perRobot,
        perTeam: battleLog.summary.perTeam?.map(t => ({
          ...t,
          robots: t.robots.map(name => battleLog.summary!.perRobot.find(r => r.robotName === name)!).filter(Boolean),
        })) ?? null,
        damageFlows: battleLog.summary.damageFlows,
        battleDuration: battleLog.summary.battleDuration,
        totalEvents: battleLog.summary.totalEvents,
        hasData: battleLog.summary.hasData,
      };
    }

    // Fallback: compute from events (for battles without summaries or recent battles still in transition)
    const events = battleLog.battleLog?.detailedCombatEvents?.length
      ? battleLog.battleLog.detailedCombatEvents
      : battleLog.battleLog?.events ?? [];

    if (events.length === 0) {
      return { perRobot: [], perTeam: null, damageFlows: [], battleDuration: battleLog.duration, totalEvents: 0, hasData: false };
    }

    // Build tagTeamInfo if applicable
    let tagTeamInfo: { team1Robots: string[]; team2Robots: string[] } | undefined;
    if (battleLog.battleType === 'tag_team' && battleLog.tagTeam) {
      const team1Robots: string[] = [];
      const team2Robots: string[] = [];
      if (battleLog.tagTeam.team1.activeRobot) team1Robots.push(battleLog.tagTeam.team1.activeRobot.name);
      if (battleLog.tagTeam.team1.reserveRobot) team1Robots.push(battleLog.tagTeam.team1.reserveRobot.name);
      if (battleLog.tagTeam.team2.activeRobot) team2Robots.push(battleLog.tagTeam.team2.activeRobot.name);
      if (battleLog.tagTeam.team2.reserveRobot) team2Robots.push(battleLog.tagTeam.team2.reserveRobot.name);
      tagTeamInfo = { team1Robots, team2Robots };
    }

    if (isTeamBattleType(battleLog.battleType) && !tagTeamInfo) {
      const team1Robots = (battleLog.participants ?? []).filter(p => p.team === 1).map(p => p.robotName);
      const team2Robots = (battleLog.participants ?? []).filter(p => p.team === 2).map(p => p.robotName);
      if (team1Robots.length > 0 && team2Robots.length > 0) {
        tagTeamInfo = { team1Robots, team2Robots };
      }
    }

    const robotMaxHP: Record<string, number> = {};
    if (battleLog.robot1?.maxHP) robotMaxHP[battleLog.robot1.name] = battleLog.robot1.maxHP;
    if (battleLog.robot2?.maxHP) robotMaxHP[battleLog.robot2.name] = battleLog.robot2.maxHP;
    if (battleLog.tagTeam) {
      if (battleLog.tagTeam.team1.activeRobot?.maxHP) robotMaxHP[battleLog.tagTeam.team1.activeRobot.name] = battleLog.tagTeam.team1.activeRobot.maxHP;
      if (battleLog.tagTeam.team1.reserveRobot?.maxHP) robotMaxHP[battleLog.tagTeam.team1.reserveRobot.name] = battleLog.tagTeam.team1.reserveRobot.maxHP;
      if (battleLog.tagTeam.team2.activeRobot?.maxHP) robotMaxHP[battleLog.tagTeam.team2.activeRobot.name] = battleLog.tagTeam.team2.activeRobot.maxHP;
      if (battleLog.tagTeam.team2.reserveRobot?.maxHP) robotMaxHP[battleLog.tagTeam.team2.reserveRobot.name] = battleLog.tagTeam.team2.reserveRobot.maxHP;
    }
    if (isTeamBattleType(battleLog.battleType)) {
      for (const p of (battleLog.participants ?? [])) {
        if (p.maxHP > 0) robotMaxHP[p.robotName] = p.maxHP;
      }
    }

    return computeBattleStatistics(
      events,
      battleLog.duration,
      battleLog.battleType,
      tagTeamInfo,
      Object.keys(robotMaxHP).length > 0 ? robotMaxHP : undefined,
    );
  }, [battleLog]);

  const participants = battleLog.participants ?? [];

  // Shared content sections
  const overviewContent = (
    <>
      <BattleResultBanner battleLog={battleLog} userId={userId} isMobile={isMobile} />
      {isMobile && participants.length > 1 && (
        <RobotSelector
          participants={participants}
          selectedIndex={selectedRobotIndex}
          onSelect={setSelectedRobotIndex}
        />
      )}
      <BattleStatisticsSummary
        statistics={statistics}
        battleType={battleLog.battleType}
        robot1Name={battleLog.robot1?.name}
        battleLog={battleLog}
        selectedRobotIndex={isMobile ? selectedRobotIndex : undefined}
      />
      {/* Team Battle specific metrics (2v2/3v3) — per-robot stats + coordination */}
      {isTeamBattleType(battleLog.battleType) && (
        <TeamBattleMetrics battleLog={battleLog} isMobile={isMobile} />
      )}
      <StableRewards battleLog={battleLog} selectedRobotIndex={isMobile ? selectedRobotIndex : undefined} />
      {/* Achievement unlocks from this battle */}
      {battleLog.achievementUnlocks && battleLog.achievementUnlocks.length > 0 && (
        <div className="bg-surface rounded-lg mb-3 p-3">
          <h3 className="text-lg font-bold mb-3">🏆 Achievements Earned</h3>
          <div className="flex flex-wrap gap-3">
            {battleLog.achievementUnlocks.map(unlock => (
              <div key={unlock.id} className="flex items-center gap-2 bg-surface-elevated rounded-lg px-3 py-2">
                <AchievementBadge tier={unlock.tier} badgeIconFile={unlock.badgeIconFile} size={48} />
                <div>
                  <p className="text-sm font-bold text-white">{unlock.name}</p>
                  <p className="text-xs text-success">
                    +₡{unlock.rewardCredits.toLocaleString()} +{unlock.rewardPrestige} prestige
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <DamageFlowDiagram
        damageFlows={statistics.damageFlows}
        battleType={battleLog.battleType}
        battleLog={battleLog}
        selectedRobotIndex={isMobile ? selectedRobotIndex : undefined}
      />
      <ArenaSummary battleLog={battleLog} />
      {/* When no playback available, include CombatMessages in Overview */}
      {!hasPlayback && <CombatMessages battleLog={battleLog} />}
    </>
  );

  const playbackContent = showPlaybackViewer && playbackResult && robot1PlaybackInfo && robot2PlaybackInfo ? (
    <div className="bg-surface p-3 rounded-lg mb-3">
      <h2 className="text-lg font-bold mb-3">Battle Playback</h2>
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
  ) : battleLog.playbackAvailable === false ? (
    <div className="mb-3">
      <PlaybackUnavailableNotice />
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />
      <div className="container mx-auto px-4 py-4 pb-24 lg:pb-8">
        {/* Header */}
        <div className="mb-3">
          <button
            onClick={() => navigate('/battle-history')}
            className="text-primary hover:text-primary-light mb-2 transition-colors duration-150 ease-out motion-reduce:transition-none text-sm"
          >
            ← Back to Battle History
          </button>
          <h1 className="text-3xl font-bold">Battle Report #{battleLog.battleId}</h1>
          <p className="text-secondary mt-1 text-sm">{formatDateTime(battleLog.createdAt)}</p>
        </div>

        {/* Desktop: tabbed layout / Mobile: stacked layout */}
        {isDesktop ? (
          <TabLayout
            activeTab={activeTab}
            onTabChange={setActiveTab}
            hasPlayback={hasPlayback}
          >
            {{
              overview: overviewContent,
              playback: playbackContent,
            }}
          </TabLayout>
        ) : (
          <div>
            {overviewContent}
            {hasPlayback && playbackContent}
          </div>
        )}
      </div>
    </div>
  );
}

export default BattleDetailPage;
