import type { BattleLogResponse, BattleLogEvent } from '../../utils/matchmakingApi';
import type { PlaybackCombatResult, PlaybackCombatEvent, PlaybackRobotInfo, KothPlaybackData } from '../BattlePlaybackViewer/types';

interface BattlePlaybackData {
  showPlaybackViewer: boolean;
  playbackResult: PlaybackCombatResult | null;
  robot1PlaybackInfo: PlaybackRobotInfo | null;
  robot2PlaybackInfo: PlaybackRobotInfo | null;
  extraPlaybackRobots: PlaybackRobotInfo[] | undefined;
  narrativePlaybackEvents: PlaybackCombatEvent[] | undefined;
  isTagTeam: boolean;
  isKoth: boolean;
  kothPlaybackData: KothPlaybackData | undefined;
}

export function useBattlePlaybackData(battleLog: BattleLogResponse): BattlePlaybackData {
  const hasSpatialData = !!battleLog.battleLog.arenaRadius && battleLog.battleLog.arenaRadius > 0;
  const isTagTeam = battleLog.battleType === 'tag_team';
  const isKoth = battleLog.battleType === 'koth';
  const is1v1 = !isTagTeam && !isKoth && !!battleLog.robot1 && !!battleLog.robot2;
  const showPlaybackViewer = hasSpatialData && (is1v1 || isTagTeam || isKoth);

  const spatialEvents = battleLog.battleLog.detailedCombatEvents ?? battleLog.battleLog.events;

  const playbackResult: PlaybackCombatResult | null = showPlaybackViewer ? {
    winnerId: battleLog.winner === 'robot1' ? 1 : battleLog.winner === 'robot2' ? 2 : null,
    robot1FinalHP: battleLog.robot1?.finalHP ?? 0,
    robot2FinalHP: battleLog.robot2?.finalHP ?? 0,
    durationSeconds: battleLog.duration + 1.0,
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

  const firstSpatialEvent = spatialEvents.find((e: BattleLogEvent) => e.robot1HP !== undefined);
  const startingRobot1HP = firstSpatialEvent?.robot1HP;
  const startingRobot2HP = firstSpatialEvent?.robot2HP;
  const startingRobot1Shield = firstSpatialEvent?.robot1Shield;
  const startingRobot2Shield = firstSpatialEvent?.robot2Shield;

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

  const kothPlaybackData: KothPlaybackData | undefined = (() => {
    if (!isKoth || !battleLog.kothData) return undefined;
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

  return {
    showPlaybackViewer,
    playbackResult,
    robot1PlaybackInfo,
    robot2PlaybackInfo,
    extraPlaybackRobots,
    narrativePlaybackEvents,
    isTagTeam,
    isKoth,
    kothPlaybackData,
  };
}
