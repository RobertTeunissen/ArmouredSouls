import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import {
  getBattleLog,
  formatDateTime,
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
} from '../components/battle-detail';
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
 * - 1v1 / tournament: winner first, loser second. Draw keeps API order.
 */
function orderParticipants(battleLog: BattleLogResponse): BattleLogParticipant[] {
  const participants = battleLog.participants ?? [];
  if (participants.length === 0) return participants;

  // KotH: placement is the natural order (1st = winner)
  if (battleLog.battleType === 'koth') {
    return [...participants].sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));
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

  // Determine if playback is available — use the hook's determination as source of truth
  const hasPlayback = showPlaybackViewer && !!playbackResult;

  // Compute battle statistics once from detailed combat events (raw simulator output).
  // The narrative `events` array strips hit/damage/hand fields for standard battles,
  // so we must use `detailedCombatEvents` which preserves all combat data fields.
  const statistics = useMemo(() => {
    const events = battleLog.battleLog.detailedCombatEvents?.length
      ? battleLog.battleLog.detailedCombatEvents
      : battleLog.battleLog.events;

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

    // Build robotMaxHP map
    const robotMaxHP: Record<string, number> = {};
    if (battleLog.robot1?.maxHP) robotMaxHP[battleLog.robot1.name] = battleLog.robot1.maxHP;
    if (battleLog.robot2?.maxHP) robotMaxHP[battleLog.robot2.name] = battleLog.robot2.maxHP;
    if (battleLog.tagTeam) {
      if (battleLog.tagTeam.team1.activeRobot?.maxHP) {
        robotMaxHP[battleLog.tagTeam.team1.activeRobot.name] = battleLog.tagTeam.team1.activeRobot.maxHP;
      }
      if (battleLog.tagTeam.team1.reserveRobot?.maxHP) {
        robotMaxHP[battleLog.tagTeam.team1.reserveRobot.name] = battleLog.tagTeam.team1.reserveRobot.maxHP;
      }
      if (battleLog.tagTeam.team2.activeRobot?.maxHP) {
        robotMaxHP[battleLog.tagTeam.team2.activeRobot.name] = battleLog.tagTeam.team2.activeRobot.maxHP;
      }
      if (battleLog.tagTeam.team2.reserveRobot?.maxHP) {
        robotMaxHP[battleLog.tagTeam.team2.reserveRobot.name] = battleLog.tagTeam.team2.reserveRobot.maxHP;
      }
    }
    if (battleLog.kothParticipants) {
      // KotH participants don't have maxHP directly, but we can use robotHP from first event
      // The computeBattleStatistics function handles missing maxHP gracefully
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
      <StableRewards battleLog={battleLog} selectedRobotIndex={isMobile ? selectedRobotIndex : undefined} />
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
