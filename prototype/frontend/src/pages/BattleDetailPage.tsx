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
import { BattlePlaybackViewer } from '../components/BattlePlaybackViewer/BattlePlaybackViewer';
import type { PlaybackCombatResult, PlaybackRobotInfo, KothPlaybackData } from '../components/BattlePlaybackViewer/types';

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

  const getWinnerText = () => {
    if (!battleLog) return '';
    if (!battleLog.winner) return 'DRAW';
    
    // For KotH battles, show the 1st place robot
    if (battleLog.battleType === 'koth' && battleLog.kothParticipants?.length) {
      const winner = battleLog.kothParticipants.find(p => p.placement === 1);
      return winner ? `${winner.robotName.toUpperCase()} WINS` : 'WINNER';
    }
    
    // For tag team battles, show team victory with team name
    if (battleLog.battleType === 'tag_team' && battleLog.tagTeam) {
      const winningTeam = battleLog.winner === 'robot1' ? battleLog.tagTeam.team1 : battleLog.tagTeam.team2;
      const teamName = winningTeam.stableName || `Team ${winningTeam.teamId}`;
      return `${teamName.toUpperCase()} WINS`;
    }
    
    const winner = battleLog.winner === 'robot1' ? battleLog.robot1 : battleLog.robot2;
    return winner ? `${winner.name} WINS` : 'WINNER';
  };

  const getWinnerColor = () => {
    if (!battleLog || !battleLog.winner) return 'text-secondary';
    return 'text-success';
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

  // Determine if this battle has spatial data for the playback viewer
  const hasSpatialData = !!battleLog.battleLog.arenaRadius && battleLog.battleLog.arenaRadius > 0;
  const isTagTeam = battleLog.battleType === 'tag_team';
  const isKoth = battleLog.battleType === 'koth';
  const is1v1 = !isTagTeam && !isKoth && !!battleLog.robot1 && !!battleLog.robot2;
  const showPlaybackViewer = hasSpatialData && (is1v1 || isTagTeam || isKoth);

  // Use detailedCombatEvents (raw simulator events with positions) for spatial animation,
  // falling back to narrative events if detailed events aren't available
  const spatialEvents = battleLog.battleLog.detailedCombatEvents ?? battleLog.battleLog.events;

  const playbackResult: PlaybackCombatResult | null = showPlaybackViewer ? {
    winnerId: battleLog.winner === 'robot1' ? 1 : battleLog.winner === 'robot2' ? 2 : null,
    robot1FinalHP: battleLog.robot1?.finalHP ?? 0,
    robot2FinalHP: battleLog.robot2?.finalHP ?? 0,
    durationSeconds: battleLog.duration + 0.5, // Add buffer so playback reaches final events at exactly durationSeconds
    isDraw: !battleLog.winner,
    events: spatialEvents.map((e: BattleLogEvent) => ({
      timestamp: e.timestamp,
      type: e.type,
      attacker: e.attacker,
      defender: e.defender,
      weapon: e.weapon,
      damage: e.damage,
      hit: e.hit,
      critical: e.critical,
      message: e.message,
      positions: e.positions,
      facingDirections: e.facingDirections,
      distance: e.distance,
      rangeBand: e.rangeBand,
      backstab: e.backstab,
      flanking: e.flanking,
      robot1HP: e.robot1HP,
      robot2HP: e.robot2HP,
      robot1Shield: e.robot1Shield,
      robot2Shield: e.robot2Shield,
      robotHP: e.robotHP,
      robotShield: e.robotShield,
      kpiData: e.kpiData,
    })),
    arenaRadius: battleLog.battleLog.arenaRadius,
    startingPositions: battleLog.battleLog.startingPositions,
    endingPositions: battleLog.battleLog.endingPositions,
  } : null;

  // Narrative events for the combat log text panel
  const narrativePlaybackEvents = showPlaybackViewer ? battleLog.battleLog.events.map((e: BattleLogEvent) => ({
    timestamp: e.timestamp,
    type: e.type,
    attacker: e.attacker,
    defender: e.defender,
    weapon: e.weapon,
    damage: e.damage,
    hit: e.hit,
    critical: e.critical,
    message: e.message,
    positions: e.positions,
    facingDirections: e.facingDirections,
    distance: e.distance,
    rangeBand: e.rangeBand,
    backstab: e.backstab,
    flanking: e.flanking,
    robot1HP: e.robot1HP,
    robot2HP: e.robot2HP,
    robot1Shield: e.robot1Shield,
    robot2Shield: e.robot2Shield,
    robotHP: e.robotHP,
    robotShield: e.robotShield,
  })) : undefined;

  // Derive starting HP/shield from the first spatial event (accurate to battle time,
  // even if the robot's maxHP has changed since then due to upgrades/repairs)
  const firstSpatialEvent = spatialEvents.find((e: BattleLogEvent) => e.robot1HP !== undefined);
  const startingRobot1HP = firstSpatialEvent?.robot1HP;
  const startingRobot2HP = firstSpatialEvent?.robot2HP;
  const startingRobot1Shield = firstSpatialEvent?.robot1Shield;
  const startingRobot2Shield = firstSpatialEvent?.robot2Shield;

  // For KotH: derive per-robot maxHP/maxShield from the first event's robotHP/robotShield maps
  // (robots are auto-repaired to full before KotH, so first event values = max values)
  const firstKothEvent = isKoth ? spatialEvents.find((e: BattleLogEvent) => e.robotHP) : null;
  const kothStartingHP: Record<string, number> = firstKothEvent?.robotHP ?? {};
  const kothStartingShield: Record<string, number> = firstKothEvent?.robotShield ?? {};

  const robot1PlaybackInfo: PlaybackRobotInfo | null = (() => {
    if (!showPlaybackViewer) return null;
    if (isKoth && battleLog.kothParticipants?.length) {
      const p = battleLog.kothParticipants[0];
      return { name: p.robotName, teamIndex: 0, maxHP: kothStartingHP[p.robotName] ?? 100, maxShield: kothStartingShield[p.robotName] ?? 0 };
    }
    if (isTagTeam && battleLog.tagTeam?.team1.activeRobot) {
      const r = battleLog.tagTeam.team1.activeRobot;
      return { name: r.name, teamIndex: 0, maxHP: startingRobot1HP ?? r.maxHP ?? 100, maxShield: startingRobot1Shield ?? r.maxShield ?? 0 };
    }
    if (battleLog.robot1) {
      return { name: battleLog.robot1.name, teamIndex: 0, maxHP: startingRobot1HP ?? battleLog.robot1.maxHP ?? 100, maxShield: startingRobot1Shield ?? battleLog.robot1.maxShield ?? 0 };
    }
    return null;
  })();

  const robot2PlaybackInfo: PlaybackRobotInfo | null = (() => {
    if (!showPlaybackViewer) return null;
    if (isKoth && battleLog.kothParticipants?.length && battleLog.kothParticipants.length >= 2) {
      const p = battleLog.kothParticipants[1];
      return { name: p.robotName, teamIndex: 1, maxHP: kothStartingHP[p.robotName] ?? 100, maxShield: kothStartingShield[p.robotName] ?? 0 };
    }
    if (isTagTeam && battleLog.tagTeam?.team2.activeRobot) {
      const r = battleLog.tagTeam.team2.activeRobot;
      return { name: r.name, teamIndex: 1, maxHP: startingRobot2HP ?? r.maxHP ?? 100, maxShield: startingRobot2Shield ?? r.maxShield ?? 0 };
    }
    if (battleLog.robot2) {
      return { name: battleLog.robot2.name, teamIndex: 1, maxHP: startingRobot2HP ?? battleLog.robot2.maxHP ?? 100, maxShield: startingRobot2Shield ?? battleLog.robot2.maxShield ?? 0 };
    }
    return null;
  })();

  // Extra robots for tag team battles (reserve robots) or KotH (participants 3+)
  const extraPlaybackRobots: PlaybackRobotInfo[] | undefined = (() => {
    if (!showPlaybackViewer) return undefined;
    if (isKoth && battleLog.kothParticipants && battleLog.kothParticipants.length > 2) {
      return battleLog.kothParticipants.slice(2).map((p, i) => ({
        name: p.robotName,
        teamIndex: i + 2,
        maxHP: kothStartingHP[p.robotName] ?? 100,
        maxShield: kothStartingShield[p.robotName] ?? 0,
      }));
    }
    if (!isTagTeam || !battleLog.tagTeam) return undefined;
    const extras: PlaybackRobotInfo[] = [];
    if (battleLog.tagTeam.team1.reserveRobot) {
      const r = battleLog.tagTeam.team1.reserveRobot;
      extras.push({ name: r.name, teamIndex: 0, maxHP: r.maxHP ?? 100, maxShield: r.maxShield ?? 0 });
    }
    if (battleLog.tagTeam.team2.reserveRobot) {
      const r = battleLog.tagTeam.team2.reserveRobot;
      extras.push({ name: r.name, teamIndex: 1, maxHP: r.maxHP ?? 100, maxShield: r.maxShield ?? 0 });
    }
    return extras.length > 0 ? extras : undefined;
  })();

  // Build KotH playback data from API response
  const kothPlaybackData: KothPlaybackData | undefined = (() => {
    if (!isKoth || !battleLog.kothData) return undefined;
    // Build robotId → robotName mapping from placements or participants
    const robotIdToName: Record<string, string> = {};
    const placements = battleLog.battleLog.placements as Array<{ robotId: number; robotName: string }> | undefined;
    if (placements) {
      for (const p of placements) {
        robotIdToName[String(p.robotId)] = p.robotName;
      }
    } else if (battleLog.kothParticipants) {
      for (const p of battleLog.kothParticipants) {
        robotIdToName[String(p.robotId)] = p.robotName;
      }
    }
    return {
      isKoth: true,
      participantCount: battleLog.kothData.participantCount,
      scoreThreshold: battleLog.kothData.scoreThreshold,
      zoneRadius: battleLog.kothData.zoneRadius,
      colorPalette: battleLog.kothData.colorPalette,
      robotIdToName,
    };
  })();

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-4">
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

        {/* Battle Result Banner */}
        <div className={`mb-3 p-3 rounded-lg text-center ${
          !battleLog.winner ? 'bg-yellow-900/20 border-2 border-yellow-600' :
          battleLog.battleType === 'koth' && battleLog.kothParticipants?.some(p => p.placement === 1 && p.owner === user?.username) ? 'bg-green-900/20 border-2 border-green-600' :
          battleLog.battleType === 'koth' ? 'bg-orange-900/20 border-2 border-orange-600' :
          battleLog.winner === 'robot1' && battleLog.robot1?.owner === user?.username ? 'bg-green-900/20 border-2 border-green-600' :
          battleLog.winner === 'robot2' && battleLog.robot2?.owner === user?.username ? 'bg-green-900/20 border-2 border-green-600' :
          'bg-red-900/20 border-2 border-red-600'
        }`}>
          <div className={`text-3xl font-bold mb-1 ${getWinnerColor()}`}>
            {getWinnerText()}
          </div>
          <div className="text-secondary text-sm">
            {battleLog.battleType === 'tag_team' ? (
              <>🤝 Tag Team Battle • Duration: {formatDuration(battleLog.duration)}</>
            ) : battleLog.battleType === 'koth' ? (
              <>⛰️ King of the Hill • {battleLog.kothParticipants?.length || battleLog.battleLog.participantCount || 0} Participants • Duration: {formatDuration(battleLog.duration)}</>
            ) : battleLog.battleType === 'tournament' || battleLog.battleLog.isTournament ? (
              <>🏆 Tournament Round {battleLog.battleLog.round || '?'}/{battleLog.battleLog.maxRounds || '?'}
              {battleLog.battleLog.isFinals ? ' (Finals)' : ''} • Duration: {formatDuration(battleLog.duration)}</>
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
                  <div className="text-secondary">
                    <span className="text-primary">Active:</span> {battleLog.tagTeam.team1.activeRobot.name}
                  </div>
                )}
                {battleLog.tagTeam.team1.reserveRobot && (
                  <div className="text-secondary">
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
                  <div className="text-secondary">
                    <span className="text-primary">Active:</span> {battleLog.tagTeam.team2.activeRobot.name}
                  </div>
                )}
                {battleLog.tagTeam.team2.reserveRobot && (
                  <div className="text-secondary">
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

        {/* KotH Participants */}
        {battleLog.battleType === 'koth' && battleLog.kothParticipants && (
          <div className="bg-orange-900/20 border border-orange-600 rounded-lg mb-3 p-3">
            <h3 className="text-lg font-bold text-orange-400 mb-3">⛰️ King of the Hill Results</h3>
            <div className="space-y-2">
              {battleLog.kothParticipants.map((p) => {
                const isCurrentUser = p.owner === user?.username;
                const placementEmoji = p.placement === 1 ? '🥇' : p.placement === 2 ? '🥈' : p.placement === 3 ? '🥉' : `#${p.placement}`;
                const bgColor = isCurrentUser ? 'bg-orange-900/30 border border-orange-500/50' : 'bg-background';
                
                return (
                  <div key={p.robotId} className={`${bgColor} rounded-lg p-2 flex items-center gap-3`}>
                    <div className="text-xl w-8 text-center flex-shrink-0">{placementEmoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${isCurrentUser ? 'text-orange-300' : 'text-white'}`}>{p.robotName}</span>
                        <span className="text-secondary text-xs">({p.owner})</span>
                        {p.destroyed && <span className="text-red-400 text-xs">💀 Destroyed</span>}
                      </div>
                      <div className="flex gap-3 text-xs text-secondary mt-1">
                        <span>Zone Score: <span className="text-orange-400 font-medium">{p.zoneScore}</span></span>
                        <span>Zone Time: <span className="text-cyan-400 font-medium">{p.zoneTime}s</span></span>
                        <span>Kills: <span className="text-red-400 font-medium">{p.kills}</span></span>
                        <span>Damage: <span className="text-yellow-400 font-medium">{p.damageDealt}</span></span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 text-xs space-y-0.5">
                      <div className="text-success font-medium">₡{p.credits.toLocaleString()}</div>
                      {p.fame > 0 && <div className="text-warning">+{p.fame} fame</div>}
                      {p.prestige > 0 && <div className="text-purple-400">+{p.prestige} prestige</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Battle Summary - Horizontal Compact Layout */}
        {battleLog.battleType !== 'koth' && (
        <div className="bg-surface rounded-lg mb-3 p-3">
          {battleLog.battleType === 'tag_team' && battleLog.tagTeam ? (
            <>
              {/* Tag Team Summary */}
              <div className="grid grid-cols-2 gap-4 mb-2 pb-2 border-b border-white/10">
                <div>
                  <h3 className="text-lg font-bold text-cyan-400">
                    {battleLog.tagTeam.team1.stableName || `Team ${battleLog.tagTeam.team1.teamId}`}
                  </h3>
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-bold text-cyan-400">
                    {battleLog.tagTeam.team2.stableName || `Team ${battleLog.tagTeam.team2.teamId}`}
                  </h3>
                </div>
              </div>

              {/* Team Rewards & Stats Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                {/* Team 1 Stats */}
                <div className="space-y-1">
                  {battleLog.team1Summary?.reward != null && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">💰 Credits</span>
                      <span className="font-bold text-success">₡{battleLog.team1Summary.reward.toLocaleString()}</span>
                    </div>
                  )}
                  {battleLog.team1Summary?.prestige != null && battleLog.team1Summary.prestige > 0 && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">⭐ Prestige</span>
                      <span className="font-bold text-purple-400">+{battleLog.team1Summary.prestige}</span>
                    </div>
                  )}
                  {battleLog.team1Summary?.totalFame != null && battleLog.team1Summary.totalFame > 0 && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">🎖️ Fame</span>
                      <span className="font-bold text-warning">+{battleLog.team1Summary.totalFame}</span>
                    </div>
                  )}
                  {battleLog.team1Summary?.streamingRevenue != null && battleLog.team1Summary.streamingRevenue > 0 && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">📺 Streaming</span>
                      <span className="font-bold text-cyan-400">₡{battleLog.team1Summary.streamingRevenue.toLocaleString()}</span>
                    </div>
                  )}
                  {battleLog.team1Summary?.totalDamage != null && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">Damage</span>
                      <span className="text-primary">{battleLog.team1Summary.totalDamage}</span>
                    </div>
                  )}
                </div>

                {/* Team 2 Stats */}
                <div className="space-y-1">
                  {battleLog.team2Summary?.reward != null && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">💰 Credits</span>
                      <span className="font-bold text-success">₡{battleLog.team2Summary.reward.toLocaleString()}</span>
                    </div>
                  )}
                  {battleLog.team2Summary?.prestige != null && battleLog.team2Summary.prestige > 0 && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">⭐ Prestige</span>
                      <span className="font-bold text-purple-400">+{battleLog.team2Summary.prestige}</span>
                    </div>
                  )}
                  {battleLog.team2Summary?.totalFame != null && battleLog.team2Summary.totalFame > 0 && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">🎖️ Fame</span>
                      <span className="font-bold text-warning">+{battleLog.team2Summary.totalFame}</span>
                    </div>
                  )}
                  {battleLog.team2Summary?.streamingRevenue != null && battleLog.team2Summary.streamingRevenue > 0 && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">📺 Streaming</span>
                      <span className="font-bold text-cyan-400">₡{battleLog.team2Summary.streamingRevenue.toLocaleString()}</span>
                    </div>
                  )}
                  {battleLog.team2Summary?.totalDamage != null && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">Damage</span>
                      <span className="text-primary">{battleLog.team2Summary.totalDamage}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : battleLog.robot1 && battleLog.robot2 ? (
            <>
              {/* 1v1 / Tournament Robot Names Row */}
              <div className="grid grid-cols-2 gap-4 mb-2 pb-2 border-b border-white/10">
                <div>
                  <h3 className="text-lg font-bold text-primary">{battleLog.robot1.name}</h3>
                  {battleLog.robot1.owner && (
                    <p className="text-secondary text-xs">Pilot: {battleLog.robot1.owner}</p>
                  )}
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-bold text-primary">{battleLog.robot2.name}</h3>
                  {battleLog.robot2.owner && (
                    <p className="text-secondary text-xs">Pilot: {battleLog.robot2.owner}</p>
                  )}
                </div>
              </div>

              {/* ELO Changes Row */}
              <div className="grid grid-cols-2 gap-4 mb-2 pb-2 border-b border-white/10">
                <div className="flex items-center justify-between bg-background rounded px-2 py-1.5">
                  <span className="text-xs text-secondary">ELO</span>
                  <div className="flex items-center gap-1.5 text-sm">
                    <span>{battleLog.robot1.eloBefore}</span>
                    <span className="text-tertiary">→</span>
                    <span className="font-bold">{battleLog.robot1.eloAfter}</span>
                    <span
                      className={`text-xs font-bold ${
                        battleLog.robot1.eloAfter - battleLog.robot1.eloBefore >= 0
                          ? 'text-success'
                          : 'text-error'
                      }`}
                    >
                      ({battleLog.robot1.eloAfter - battleLog.robot1.eloBefore > 0 ? '+' : ''}
                      {battleLog.robot1.eloAfter - battleLog.robot1.eloBefore})
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-background rounded px-2 py-1.5">
                  <span className="text-xs text-secondary">ELO</span>
                  <div className="flex items-center gap-1.5 text-sm">
                    <span>{battleLog.robot2.eloBefore}</span>
                    <span className="text-tertiary">→</span>
                    <span className="font-bold">{battleLog.robot2.eloAfter}</span>
                    <span
                      className={`text-xs font-bold ${
                        battleLog.robot2.eloAfter - battleLog.robot2.eloBefore >= 0
                          ? 'text-success'
                          : 'text-error'
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
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">💰 Credits</span>
                      <span className="font-bold text-success">₡{battleLog.robot1.reward.toLocaleString()}</span>
                    </div>
                  )}
                  {battleLog.robot1.prestige !== undefined && battleLog.robot1.prestige > 0 && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">⭐ Prestige</span>
                      <span className="font-bold text-purple-400">+{battleLog.robot1.prestige}</span>
                    </div>
                  )}
                  {battleLog.robot1.fame !== undefined && battleLog.robot1.fame > 0 && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">🎖️ Fame</span>
                      <span className="font-bold text-warning">+{battleLog.robot1.fame}</span>
                    </div>
                  )}
                  {battleLog.robot1.streamingRevenue !== undefined && battleLog.robot1.streamingRevenue > 0 && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">📺 Streaming</span>
                      <span className="font-bold text-cyan-400">₡{battleLog.robot1.streamingRevenue.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                    <span className="text-secondary">Final HP</span>
                    <span>{battleLog.robot1.maxHP ? Math.round((battleLog.robot1.finalHP / battleLog.robot1.maxHP) * 100) : battleLog.robot1.finalHP}%</span>
                  </div>
                  <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                    <span className="text-secondary">Damage</span>
                    <span className="text-primary">{battleLog.robot1.damageDealt}</span>
                  </div>
                </div>

                {/* Robot 2 Rewards & Stats */}
                <div className="space-y-1">
                  {battleLog.robot2.reward !== undefined && battleLog.robot2.reward !== null && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">💰 Credits</span>
                      <span className="font-bold text-success">₡{battleLog.robot2.reward.toLocaleString()}</span>
                    </div>
                  )}
                  {battleLog.robot2.prestige !== undefined && battleLog.robot2.prestige > 0 && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">⭐ Prestige</span>
                      <span className="font-bold text-purple-400">+{battleLog.robot2.prestige}</span>
                    </div>
                  )}
                  {battleLog.robot2.fame !== undefined && battleLog.robot2.fame > 0 && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">🎖️ Fame</span>
                      <span className="font-bold text-warning">+{battleLog.robot2.fame}</span>
                    </div>
                  )}
                  {battleLog.robot2.streamingRevenue !== undefined && battleLog.robot2.streamingRevenue > 0 && (
                    <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">📺 Streaming</span>
                      <span className="font-bold text-cyan-400">₡{battleLog.robot2.streamingRevenue.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                    <span className="text-secondary">Final HP</span>
                    <span>{battleLog.robot2.maxHP ? Math.round((battleLog.robot2.finalHP / battleLog.robot2.maxHP) * 100) : battleLog.robot2.finalHP}%</span>
                  </div>
                  <div className="flex items-center justify-between bg-background rounded px-2 py-1">
                    <span className="text-secondary">Damage</span>
                    <span className="text-primary">{battleLog.robot2.damageDealt}</span>
                  </div>
                </div>
              </div>

              {/* Streaming Revenue Details */}
              {(battleLog.robot1.streamingRevenueDetails || battleLog.robot2.streamingRevenueDetails) && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-cyan-400">📺 Streaming Revenue Breakdown</h3>
                    <div className="text-xs text-secondary italic">
                      Earned per battle based on robot stats & Streaming Studio
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    {battleLog.robot1.streamingRevenueDetails && (
                      <div className="bg-background rounded px-2 py-2 space-y-1">
                        <div className="font-semibold text-white mb-1">{battleLog.robot1.name}</div>
                        <div className="text-secondary">
                          Base: ₡{battleLog.robot1.streamingRevenueDetails.baseAmount.toLocaleString()} × 
                          Battles: {battleLog.robot1.streamingRevenueDetails.battleMultiplier.toFixed(2)} × 
                          Fame: {battleLog.robot1.streamingRevenueDetails.fameMultiplier.toFixed(2)} × 
                          Studio: {battleLog.robot1.streamingRevenueDetails.studioMultiplier.toFixed(2)}
                        </div>
                        <div className="text-xs text-tertiary">
                          ({battleLog.robot1.streamingRevenueDetails.robotBattles} battles, 
                          {battleLog.robot1.streamingRevenueDetails.robotFame} fame, 
                          Studio L{battleLog.robot1.streamingRevenueDetails.studioLevel})
                        </div>
                      </div>
                    )}
                    {battleLog.robot2.streamingRevenueDetails && (
                      <div className="bg-background rounded px-2 py-2 space-y-1">
                        <div className="font-semibold text-white mb-1">{battleLog.robot2.name}</div>
                        <div className="text-secondary">
                          Base: ₡{battleLog.robot2.streamingRevenueDetails.baseAmount.toLocaleString()} × 
                          Battles: {battleLog.robot2.streamingRevenueDetails.battleMultiplier.toFixed(2)} × 
                          Fame: {battleLog.robot2.streamingRevenueDetails.fameMultiplier.toFixed(2)} × 
                          Studio: {battleLog.robot2.streamingRevenueDetails.studioMultiplier.toFixed(2)}
                        </div>
                        <div className="text-xs text-tertiary">
                          ({battleLog.robot2.streamingRevenueDetails.robotBattles} battles, 
                          {battleLog.robot2.streamingRevenueDetails.robotFame} fame, 
                          Studio L{battleLog.robot2.streamingRevenueDetails.studioLevel})
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-secondary">Battle summary data unavailable.</p>
          )}
        </div>
        )}

        {/* Spatial Summary - only shown for 2D arena battles */}
        {battleLog.battleLog.arenaRadius && (() => {
          const bl = battleLog.battleLog;
          // Use detailedCombatEvents for spatial calculations (narrative events don't have positions)
          const spatialEvts = bl.detailedCombatEvents ?? bl.events ?? [];

          // Collect ALL robot names from startingPositions AND all events' positions
          // This ensures reserve robots that tag in mid-battle are included
          const robotNameSet = new Set<string>();
          if (bl.startingPositions) {
            for (const name of Object.keys(bl.startingPositions)) {
              robotNameSet.add(name);
            }
          }
          for (const event of spatialEvts) {
            if (event.positions) {
              for (const name of Object.keys(event.positions)) {
                robotNameSet.add(name);
              }
            }
          }
          const robotNames = Array.from(robotNameSet);

          // Calculate total distance moved per robot from movement events
          const totalDistance: Record<string, number> = {};
          const lastPos: Record<string, { x: number; y: number }> = {};

          // Initialize from starting positions (for active robots)
          if (bl.startingPositions) {
            for (const name of Object.keys(bl.startingPositions)) {
              totalDistance[name] = 0;
              lastPos[name] = bl.startingPositions[name];
            }
          }

          // Track first and last known positions for ALL robots
          const firstKnownPos: Record<string, { x: number; y: number }> = {};
          const lastKnownPos: Record<string, { x: number; y: number }> = {};

          // Seed from startingPositions
          if (bl.startingPositions) {
            for (const name of Object.keys(bl.startingPositions)) {
              firstKnownPos[name] = bl.startingPositions[name];
              lastKnownPos[name] = bl.startingPositions[name];
            }
          }

          for (const event of spatialEvts) {
            if (event.positions) {
              for (const name of robotNames) {
                const pos = event.positions[name];
                if (!pos) continue;

                // Track first appearance for reserves
                if (!firstKnownPos[name]) {
                  firstKnownPos[name] = pos;
                  totalDistance[name] = 0;
                }

                // Accumulate distance
                if (lastPos[name]) {
                  const dx = pos.x - lastPos[name].x;
                  const dy = pos.y - lastPos[name].y;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  if (dist > 0.01) {
                    totalDistance[name] = (totalDistance[name] || 0) + dist;
                  }
                }
                lastPos[name] = pos;
                lastKnownPos[name] = pos;
              }
            }
          }

          // Override lastKnownPos with endingPositions where available
          if (bl.endingPositions) {
            for (const name of Object.keys(bl.endingPositions)) {
              lastKnownPos[name] = bl.endingPositions[name];
            }
          }

          // Range band distribution from events with rangeBand
          const rangeBandCounts: Record<string, number> = { melee: 0, short: 0, mid: 0, long: 0 };
          let totalRangeBandEvents = 0;
          for (const event of spatialEvts) {
            if (event.rangeBand && rangeBandCounts[event.rangeBand] !== undefined) {
              rangeBandCounts[event.rangeBand]++;
              totalRangeBandEvents++;
            }
          }

          const rangeBandColors: Record<string, string> = {
            melee: 'text-red-400',
            short: 'text-yellow-400',
            mid: 'text-green-400',
            long: 'text-blue-400',
          };

          return (
            <div className="bg-surface rounded-lg mb-3 p-3">
              <h2 className="text-lg font-bold mb-2 text-blue-400">🗺️ Arena Summary</h2>
              <div className="grid grid-cols-2 gap-4 text-xs">
                {/* Arena Info */}
                <div className="space-y-1">
                  <div className="flex justify-between bg-background rounded px-2 py-1">
                    <span className="text-secondary">Arena Radius</span>
                    <span>{bl.arenaRadius} units</span>
                  </div>
                  <div className="flex justify-between bg-background rounded px-2 py-1">
                    <span className="text-secondary">Arena Diameter</span>
                    <span>{bl.arenaRadius! * 2} units</span>
                  </div>
                </div>

                {/* Distance Moved */}
                <div className="space-y-1">
                  {robotNames.map((name) => (
                    <div key={name} className="flex justify-between bg-background rounded px-2 py-1">
                      <span className="text-secondary">{name} moved</span>
                      <span>{(totalDistance[name] || 0).toFixed(1)} units</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Starting & Ending Positions */}
              {robotNames.length > 0 && (
                <div className="grid grid-cols-2 gap-4 text-xs mt-2">
                  <div className="space-y-1">
                    <div className="text-xs text-secondary font-semibold mb-1">Starting Positions</div>
                    {robotNames.map((name) => {
                      const pos = firstKnownPos[name];
                      return pos ? (
                        <div key={name} className="flex justify-between bg-background rounded px-2 py-1">
                          <span className="text-secondary">{name}</span>
                          <span className="font-mono text-xs">({pos.x.toFixed(1)}, {pos.y.toFixed(1)})</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-secondary font-semibold mb-1">Ending Positions</div>
                    {robotNames.map((name) => {
                      const pos = lastKnownPos[name];
                      return pos ? (
                        <div key={name} className="flex justify-between bg-background rounded px-2 py-1">
                          <span className="text-secondary">{name}</span>
                          <span className="font-mono text-xs">({pos.x.toFixed(1)}, {pos.y.toFixed(1)})</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Range Band Distribution */}
              {totalRangeBandEvents > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-secondary font-semibold mb-1">Range Band Distribution</div>
                  <div className="flex gap-2">
                    {(['melee', 'short', 'mid', 'long'] as const).map((band) => {
                      const count = rangeBandCounts[band];
                      const pct = totalRangeBandEvents > 0 ? (count / totalRangeBandEvents) * 100 : 0;
                      return (
                        <div key={band} className="flex-1 bg-background rounded px-2 py-1 text-center text-xs">
                          <div className={`font-semibold capitalize ${rangeBandColors[band]}`}>{band}</div>
                          <div>{pct.toFixed(0)}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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
          <div className="bg-surface p-3 rounded-lg">
            <h2 className="text-lg font-bold mb-2">Combat Messages</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {battleLog.battleLog.events && battleLog.battleLog.events.length > 0 ? (
                battleLog.battleLog.events
                  .filter((event: BattleLogEvent) => {
                    // Filter out financial/reward messages since they're now in the top summary
                    if (event.type === 'tournament_reward' || event.type === 'reward_summary' || 
                        event.type === 'reward_detail' || event.type === 'reward_breakdown') {
                      return false;
                    }
                    const message = event.message.toLowerCase();
                    return !message.includes('financial') && 
                           !message.includes('₡') && 
                           !message.includes('credits') &&
                           !message.includes('winner (') &&
                           !message.includes('loser (') &&
                           !message.includes('league base') &&
                           !message.includes('participation') &&
                           !message.includes('prestige:') &&
                           !message.includes('fame:') &&
                           !message.includes('tournament size') &&
                           !message.includes('round progress') &&
                           !message.includes('championship finals');
                  })
                  .map((event: BattleLogEvent, index: number) => {
                  // Determine event color based on type
                  let eventColor = 'border-gray-600';
                  let bgColor = 'bg-surface-elevated';
                  let icon = '';
                  
                  if (event.type === 'battle_start') {
                    eventColor = 'border-blue-500';
                    bgColor = 'bg-blue-900/20';
                  } else if (event.type === 'battle_end') {
                    eventColor = 'border-green-500';
                    bgColor = 'bg-green-900/20';
                  } else if (event.type === 'stance') {
                    eventColor = 'border-purple-500';
                    bgColor = 'bg-purple-900/20';
                  } else if (event.type === 'tag_out') {
                    eventColor = 'border-orange-500';
                    bgColor = 'bg-orange-900/20';
                    icon = '🔄';
                  } else if (event.type === 'tag_in') {
                    eventColor = 'border-cyan-500';
                    bgColor = 'bg-cyan-900/20';
                    icon = '⚡';
                  } else if (event.type === 'critical') {
                    eventColor = 'border-red-500';
                    bgColor = 'bg-red-900/20';
                  } else if (event.type === 'attack' && event.message.includes('CRITICAL')) {
                    eventColor = 'border-red-500';
                    bgColor = 'bg-red-900/20';
                  } else if (event.type === 'counter') {
                    eventColor = 'border-yellow-500';
                    bgColor = 'bg-yellow-900/20';
                  } else if (event.type === 'miss') {
                    eventColor = 'border-gray-500';
                    bgColor = 'bg-surface';
                  } else if (event.type === 'malfunction') {
                    eventColor = 'border-amber-500';
                    bgColor = 'bg-amber-900/20';
                  } else if (event.type === 'shield_break') {
                    eventColor = 'border-red-400';
                    bgColor = 'bg-red-900/15';
                  } else if (event.type === 'shield_regen') {
                    eventColor = 'border-teal-500';
                    bgColor = 'bg-teal-900/20';
                  } else if (event.type === 'yield') {
                    eventColor = 'border-yellow-400';
                    bgColor = 'bg-yellow-900/20';
                  } else if (event.type === 'destroyed') {
                    eventColor = 'border-red-600';
                    bgColor = 'bg-red-900/30';
                  } else if (event.type === 'damage_status') {
                    eventColor = 'border-orange-400';
                    bgColor = 'bg-orange-900/15';
                  } else if (event.type === 'draw') {
                    eventColor = 'border-gray-400';
                    bgColor = 'bg-surface-elevated/50';
                  }

                  return (
                    <div
                      key={index}
                      className={`${bgColor} p-3 rounded border-l-4 ${eventColor} flex items-start gap-3 transition-colors hover:bg-gray-600/50`}
                    >
                      <div className="text-secondary text-sm font-mono whitespace-nowrap flex-shrink-0 min-w-[50px]">
                        {event.timestamp.toFixed(1)}s
                      </div>
                      {icon && <div className="text-lg flex-shrink-0">{icon}</div>}
                      <div className="flex-1 text-sm leading-relaxed">{event.message}</div>
                    </div>
                  );
                })
              ) : (
                <p className="text-secondary">No combat messages available for this battle.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BattleDetailPage;
