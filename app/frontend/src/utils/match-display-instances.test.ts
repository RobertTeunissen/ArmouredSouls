import { describe, expect, it } from 'vitest';
import type { BattleHistory, BattleParticipantData, ScheduledMatch } from './matchmakingApi';
import {
  expandBattleDisplayInstances,
  expandUpcomingMatchInstances,
} from './match-display-instances';

function makeParticipant(
  robotId: number,
  userId: number,
  team: number,
): BattleParticipantData {
  return {
    robotId,
    team,
    role: null,
    eloBefore: 1200,
    eloAfter: 1210,
    finalHP: 100,
    credits: 10,
    streamingRevenue: 1,
    prestigeAwarded: 2,
    fameAwarded: 3,
    damageDealt: 20,
    placement: null,
    yielded: false,
    destroyed: false,
    robot: {
      id: robotId,
      name: `Robot ${robotId}`,
      userId,
      user: { username: `user-${userId}` },
    },
  };
}

function makeBattle(
  battleType: string,
  participants: BattleParticipantData[],
): BattleHistory {
  return {
    id: 42,
    battleType,
    robot1Id: participants[0]?.robotId ?? 1,
    robot2Id: participants[1]?.robotId ?? null,
    winnerId: participants[0]?.robotId ?? null,
    createdAt: '2026-06-01T12:00:00Z',
    durationSeconds: 30,
    robot1ELOBefore: 1200,
    robot1ELOAfter: 1210,
    robot2ELOBefore: 1200,
    robot2ELOAfter: 1190,
    robot1FinalHP: 100,
    robot2FinalHP: 0,
    winnerReward: 100,
    loserReward: 20,
    robot1: participants[0]?.robot ?? {
      id: 1,
      name: 'Robot 1',
      userId: 99,
      user: { username: 'user-99' },
    },
    robot2: participants[1]?.robot ?? null,
    participants,
  };
}

function makeMatch(overrides: Partial<ScheduledMatch> = {}): ScheduledMatch {
  return {
    id: 'scheduled-42',
    matchType: 'league_1v1',
    leagueType: 'bronze',
    scheduledFor: '2026-06-01T12:00:00Z',
    status: 'scheduled',
    robot1: null,
    robot2: null,
    teamBattleTeam1: undefined,
    teamBattleTeam2: null,
    ...overrides,
  };
}

function makeRobot(id: number, userId: number) {
  return {
    id,
    name: `Robot ${id}`,
    elo: 1200,
    currentHP: 100,
    maxHP: 100,
    userId,
    user: { username: `user-${userId}` },
  };
}

function makeTeam(id: number, userId: number, size = 3) {
  return {
    id,
    teamName: `Team ${id}`,
    teamSize: size,
    teamLp: 100,
    teamLeague: 'bronze',
    members: Array.from({ length: size }, (_, index) => ({
      robotId: id * 10 + index,
      robotName: `Robot ${id * 10 + index}`,
      robotElo: 1200,
      userId,
      user: { username: `user-${userId}` },
    })),
    combinedELO: size * 1200,
  };
}

describe('expandBattleDisplayInstances', () => {
  it('should keep one same-side instance for one, two, or three owned participants', () => {
    const battle = makeBattle('league_3v3', [
      makeParticipant(10, 7, 1),
      makeParticipant(11, 7, 1),
      makeParticipant(12, 7, 1),
      makeParticipant(20, 8, 2),
    ]);

    const instances = expandBattleDisplayInstances(battle, { userId: 7 });

    expect(instances).toHaveLength(1);
    expect(instances[0]).toMatchObject({
      displayInstanceKey: 'battle:42:team:1',
      perspectiveRobotId: 10,
      perspectiveRobotIds: [10, 11, 12],
      perspectiveTeamId: 1,
    });
  });

  it('should create separate instances for opposite same-stable non-FFA sides', () => {
    const battle = makeBattle('league_1v1', [
      makeParticipant(10, 7, 1),
      makeParticipant(20, 7, 2),
      makeParticipant(30, 8, 1),
    ]);

    const instances = expandBattleDisplayInstances(battle, { userId: 7 });

    expect(instances.map(instance => instance.displayInstanceKey)).toEqual([
      'battle:42:team:1',
      'battle:42:team:2',
    ]);
    expect(new Set(instances.map(instance => instance.displayInstanceKey)).size).toBe(2);
  });

  it('should create one instance per owned Placement_Mode robot', () => {
    const battle = makeBattle('grand_melee', [
      makeParticipant(10, 7, 1),
      makeParticipant(11, 7, 1),
      makeParticipant(12, 8, 1),
    ]);

    const instances = expandBattleDisplayInstances(battle, { userId: 7 });

    expect(instances.map(instance => instance.displayInstanceKey)).toEqual([
      'battle:42:robot:10',
      'battle:42:robot:11',
    ]);
    expect(instances.every(instance => instance.perspectiveRobotIds.length === 1)).toBe(true);
  });

  it('should retain only the selected robot perspective for Robot Detail', () => {
    const battle = makeBattle('league_3v3', [
      makeParticipant(10, 7, 1),
      makeParticipant(11, 7, 1),
      makeParticipant(20, 8, 2),
    ]);

    const instances = expandBattleDisplayInstances(battle, { robotId: 11 });

    expect(instances).toHaveLength(1);
    expect(instances[0].perspectiveRobotId).toBe(11);
    expect(instances[0].perspectiveRobotIds).toEqual([11]);
  });

  it('should return no instances when the requested robot or user is absent', () => {
    const battle = makeBattle('league_1v1', [makeParticipant(10, 7, 1)]);

    expect(expandBattleDisplayInstances(battle, { robotId: 999 })).toEqual([]);
    expect(expandBattleDisplayInstances(battle, { userId: 999 })).toEqual([]);
  });
});

describe('expandUpcomingMatchInstances', () => {
  it('should create one instance per owned robot in an opposite-side 1v1 schedule', () => {
    const match = makeMatch({
      robot1: makeRobot(10, 7),
      robot2: makeRobot(20, 7),
    });

    const instances = expandUpcomingMatchInstances(match, 7);

    expect(instances).toHaveLength(2);
    expect(instances.map(instance => instance.displayInstanceKey)).toEqual([
      'match:scheduled-42:robot:10',
      'match:scheduled-42:robot:20',
    ]);
  });

  it('should keep one instance for all same-stable 3v3 team members', () => {
    const match = makeMatch({
      matchType: 'league_3v3',
      teamBattleTeam1: makeTeam(101, 7),
      teamBattleTeam2: makeTeam(202, 8),
    });

    const instances = expandUpcomingMatchInstances(match, 7);

    expect(instances).toHaveLength(1);
    expect(instances[0]).toMatchObject({
      displayInstanceKey: 'match:scheduled-42:team:101',
      perspectiveTeamId: 101,
      perspectiveRobotId: 1010,
      perspectiveRobotIds: [1010, 1011, 1012],
    });
  });

  it('should create one instance for each owned FFA robot', () => {
    const match = makeMatch({
      matchType: 'grand_melee',
      kothParticipants: [
        { id: 10, name: 'Robot 10', elo: 1200, userId: 7 },
        { id: 11, name: 'Robot 11', elo: 1200, userId: 7 },
        { id: 20, name: 'Robot 20', elo: 1200, userId: 8 },
      ],
      kothParticipantCount: 3,
    });

    const instances = expandUpcomingMatchInstances(match, 7);

    expect(instances).toHaveLength(2);
    expect(instances.map(instance => instance.perspectiveRobotId)).toEqual([10, 11]);
    expect(new Set(instances.map(instance => instance.displayInstanceKey)).size).toBe(2);
  });

  it('should preserve a real one-sided robot subject for an upcoming bye', () => {
    const match = makeMatch({
      isByeMatch: true,
      byeRewardCredits: 25,
      byeRewardStatus: 'expected',
      robot1: makeRobot(10, 7),
      robot2: null,
    });

    const instances = expandUpcomingMatchInstances(match, 7);

    expect(instances).toHaveLength(1);
    expect(instances[0]).toMatchObject({
      perspectiveRobotId: 10,
      perspectiveRobotIds: [10],
      isByeMatch: true,
      byeRewardCredits: 25,
      byeRewardStatus: 'expected',
    });
  });
});
