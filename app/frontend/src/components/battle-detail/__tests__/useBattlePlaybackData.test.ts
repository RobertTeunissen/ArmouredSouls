import { describe, it, expect } from 'vitest';
import { useBattlePlaybackData } from '../useBattlePlaybackData';
import type { BattleLogEvent, BattleLogParticipant, BattleLogResponse } from '../../../utils/matchmakingApi';

// `useBattlePlaybackData` uses no React hooks: it maps a battle log to the
// playback viewer's inputs, so it is called directly here.

function event(timestamp: number, extra: Partial<BattleLogEvent> = {}): BattleLogEvent {
  return { timestamp, type: 'attack', message: `t${timestamp}`, ...extra };
}

function log(overrides: Partial<BattleLogResponse> = {}, battleLog: Partial<BattleLogResponse['battleLog']> = {}): BattleLogResponse {
  return {
    battleId: 1, createdAt: '2026-11-01T00:00:00Z', battleType: 'league_1v1', leagueType: 'bronze', duration: 30,
    winner: 'robot1',
    robot1: { id: 1, name: 'Alpha', owner: 'A', maxHP: 200, maxShield: 40, eloBefore: 1200, eloAfter: 1210, finalHP: 50, damageDealt: 300 },
    robot2: { id: 2, name: 'Bravo', owner: 'B', maxHP: 180, maxShield: 20, eloBefore: 1200, eloAfter: 1190, finalHP: 0, damageDealt: 150 },
    battleLog: { arenaRadius: 20, events: [event(0), event(1)], ...battleLog },
    ...overrides,
  } as BattleLogResponse;
}

function participant(robotId: number, robotName: string, team: number, maxHP = 100): BattleLogParticipant {
  return { robotId, robotName, team, maxHP, maxShield: 10 } as BattleLogParticipant;
}

describe('useBattlePlaybackData', () => {
  it('hides the viewer for battles without spatial data', () => {
    const data = useBattlePlaybackData(log({}, { arenaRadius: undefined }));
    expect(data.showPlaybackViewer).toBe(false);
    expect(data.playbackResult).toBeNull();
    expect(data.robot1PlaybackInfo).toBeNull();
    expect(data.narrativePlaybackEvents).toBeUndefined();
  });

  it('builds a 1v1 playback with the winner, a one-second tail and the arena', () => {
    const data = useBattlePlaybackData(log({}, {
      startingPositions: { Alpha: { x: -5, y: 0 } },
      detailedCombatEvents: [event(0.5, { robot1HP: 190, robot2HP: 170, robot1Shield: 30, robot2Shield: 15, kpiData: { a: 1 } })],
    }));

    expect(data.showPlaybackViewer).toBe(true);
    expect(data.playbackResult).toMatchObject({
      winnerId: 1, robot1FinalHP: 50, robot2FinalHP: 0, durationSeconds: 31, isDraw: false, arenaRadius: 20,
      startingPositions: { Alpha: { x: -5, y: 0 } },
    });
    // Detailed simulator events win over the summary events.
    expect(data.playbackResult!.events).toHaveLength(1);
    expect(data.playbackResult!.events[0].kpiData).toEqual({ a: 1 });
    expect(data.narrativePlaybackEvents![0]).not.toHaveProperty('kpiData');
    // Starting HP and shield come from the first event that carries them.
    expect(data.robot1PlaybackInfo).toEqual({ name: 'Alpha', teamIndex: 0, maxHP: 190, maxShield: 30 });
    expect(data.robot2PlaybackInfo).toEqual({ name: 'Bravo', teamIndex: 1, maxHP: 170, maxShield: 15 });
    expect(data.extraPlaybackRobots).toBeUndefined();
    expect(data.kothPlaybackData).toBeUndefined();
  });

  it('marks a draw and falls back to the robots\' max HP', () => {
    const data = useBattlePlaybackData(log({ winner: null }));
    expect(data.playbackResult).toMatchObject({ winnerId: null, isDraw: true });
    expect(data.robot1PlaybackInfo).toEqual({ name: 'Alpha', teamIndex: 0, maxHP: 200, maxShield: 40 });
  });

  it('adds the tag-team reserves as extra robots', () => {
    const data = useBattlePlaybackData(log({
      battleType: 'tag_team',
      tagTeam: {
        team1: { activeRobot: { id: 1, name: 'Alpha', owner: 'A', maxHP: 200 }, reserveRobot: { id: 3, name: 'Gamma', owner: 'A', maxHP: 150 } },
        team2: { activeRobot: { id: 2, name: 'Bravo', owner: 'B' }, reserveRobot: null },
      },
    } as unknown as Partial<BattleLogResponse>));

    expect(data.isTagTeam).toBe(true);
    expect(data.robot1PlaybackInfo?.name).toBe('Alpha');
    expect(data.robot2PlaybackInfo).toEqual({ name: 'Bravo', teamIndex: 1, maxHP: 100, maxShield: 0 });
    expect(data.extraPlaybackRobots).toEqual([{ name: 'Gamma', teamIndex: 0, maxHP: 150, maxShield: 0 }]);
  });

  it('puts the first robot of each team up front and the rest in extras for team battles', () => {
    const data = useBattlePlaybackData(log({
      battleType: 'league_3v3',
      participants: [
        participant(1, 'A1', 1), participant(2, 'A2', 1), participant(3, 'A3', 1),
        participant(4, 'B1', 2, 120), participant(5, 'B2', 2), participant(6, 'B3', 2),
      ],
    }));

    expect(data.robot1PlaybackInfo?.name).toBe('A1');
    expect(data.robot2PlaybackInfo).toEqual({ name: 'B1', teamIndex: 1, maxHP: 120, maxShield: 10 });
    expect(data.extraPlaybackRobots?.map((r) => [r.name, r.teamIndex])).toEqual([['A2', 0], ['A3', 0], ['B2', 1], ['B3', 1]]);
  });

  it('gives every KotH robot its own colour slot and maps ids to names', () => {
    const kothParticipants = [
      { robotId: 11, robotName: 'King' }, { robotId: 12, robotName: 'Queen' }, { robotId: 13, robotName: 'Jack' },
    ];
    const data = useBattlePlaybackData(log({
      battleType: 'koth',
      kothParticipants,
      kothData: { participantCount: 3, scoreThreshold: 30, zoneRadius: 5, colorPalette: ['#f00', '#0f0', '#00f'] },
    } as unknown as Partial<BattleLogResponse>, {
      events: [event(0, { robotHP: { King: 300, Queen: 250, Jack: 200 }, robotShield: { King: 50 } })],
    }));

    expect(data.isKoth).toBe(true);
    expect(data.robot1PlaybackInfo).toEqual({ name: 'King', teamIndex: 0, maxHP: 300, maxShield: 50 });
    expect(data.robot2PlaybackInfo).toEqual({ name: 'Queen', teamIndex: 1, maxHP: 250, maxShield: 0 });
    expect(data.extraPlaybackRobots).toEqual([{ name: 'Jack', teamIndex: 2, maxHP: 200, maxShield: 0 }]);
    expect(data.kothPlaybackData).toEqual({
      isKoth: true, participantCount: 3, scoreThreshold: 30, zoneRadius: 5, colorPalette: ['#f00', '#0f0', '#00f'],
      robotIdToName: { 11: 'King', 12: 'Queen', 13: 'Jack' },
    });
  });

  it('prefers the stored placements for KotH robot names', () => {
    const data = useBattlePlaybackData(log({
      battleType: 'koth',
      kothParticipants: [{ robotId: 11, robotName: 'Old Name' }],
      kothData: { participantCount: 1, scoreThreshold: 30 },
    } as unknown as Partial<BattleLogResponse>, { placements: [{ robotId: 11, robotName: 'King', zoneScore: 30, zoneTime: 10, kills: 0, destroyed: false }] }));
    expect(data.kothPlaybackData?.robotIdToName).toEqual({ 11: 'King' });
  });

  it('plays Grand Melee like KotH without zone data', () => {
    const data = useBattlePlaybackData(log({
      battleType: 'grand_melee',
      kothParticipants: [{ robotId: 1, robotName: 'One' }, { robotId: 2, robotName: 'Two' }],
    } as unknown as Partial<BattleLogResponse>));
    expect(data.showPlaybackViewer).toBe(true);
    expect(data.isKoth).toBe(false);
    expect(data.kothPlaybackData).toBeUndefined();
    expect(data.robot2PlaybackInfo?.name).toBe('Two');
  });
});
