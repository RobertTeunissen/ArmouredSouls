/**
 * Unit tests for eventScheduleScope.ts
 *
 * One module answers "is there a queued match?" from both directions:
 * pre-battle repair asks who fights an event next, subscription accounting asks
 * which events a robot still owes a match to. Both read the same scope map, so
 * these tests guard the map's completeness as much as the queries.
 */

const mockScheduledMatchParticipantFindMany = jest.fn();
const mockScheduledTournamentMatchFindMany = jest.fn();
const mockTeamBattleMemberFindMany = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    scheduledMatchParticipant: {
      findMany: (...args: unknown[]) => mockScheduledMatchParticipantFindMany(...args),
    },
    scheduledTournamentMatch: {
      findMany: (...args: unknown[]) => mockScheduledTournamentMatchFindMany(...args),
    },
    teamBattleMember: {
      findMany: (...args: unknown[]) => mockTeamBattleMemberFindMany(...args),
    },
  },
}));

import {
  EVENT_SCHEDULE_SCOPES,
  resolveOutstandingEventsForRobot,
  resolveOutstandingEventsForRobots,
} from '../../../src/services/scheduling/eventScheduleScope';
import { SUBSCRIBABLE_EVENT_TYPES } from '../../../src/services/subscription/eventRegistry';

beforeEach(() => {
  jest.clearAllMocks();
  mockScheduledMatchParticipantFindMany.mockResolvedValue([]);
  mockScheduledTournamentMatchFindMany.mockResolvedValue([]);
  mockTeamBattleMemberFindMany.mockResolvedValue([]);
});

describe('EVENT_SCHEDULE_SCOPES', () => {
  it('should declare a schedule source for every subscribable event', () => {
    // The Record type enforces this at compile time; asserting it at runtime
    // catches a mode added to the tuple but wired up with a stale cast.
    for (const eventType of SUBSCRIBABLE_EVENT_TYPES) {
      expect(EVENT_SCHEDULE_SCOPES[eventType]).toBeDefined();
    }
    expect(Object.keys(EVENT_SCHEDULE_SCOPES).sort()).toEqual([...SUBSCRIBABLE_EVENT_TYPES].sort());
  });
});

describe('resolveOutstandingEventsForRobot — solo modes', () => {
  it('should report a robot-scoped mode when the robot has a scheduled match', async () => {
    mockScheduledMatchParticipantFindMany.mockResolvedValue([
      { participantType: 'robot', participantId: 5, scheduledMatch: { matchType: 'grand_melee' } },
    ]);

    await expect(resolveOutstandingEventsForRobot(5)).resolves.toEqual(['grand_melee']);
  });

  it('should report nothing when the schedule is empty', async () => {
    await expect(resolveOutstandingEventsForRobot(5)).resolves.toEqual([]);
  });

  it('should collapse several matches of the same mode into one entry', async () => {
    mockScheduledMatchParticipantFindMany.mockResolvedValue([
      { participantType: 'robot', participantId: 5, scheduledMatch: { matchType: 'koth' } },
      { participantType: 'robot', participantId: 5, scheduledMatch: { matchType: 'koth' } },
    ]);

    await expect(resolveOutstandingEventsForRobot(5)).resolves.toEqual(['koth']);
  });
});

describe('resolveOutstandingEventsForRobot — team modes', () => {
  it('should attribute a team match to the member robot', async () => {
    mockTeamBattleMemberFindMany.mockResolvedValue([{ robotId: 5, teamId: 77 }]);
    mockScheduledMatchParticipantFindMany.mockResolvedValue([
      { participantType: 'team', participantId: 77, scheduledMatch: { matchType: 'league_2v2' } },
    ]);

    await expect(resolveOutstandingEventsForRobot(5)).resolves.toEqual(['league_2v2']);
  });

  it('should not look for team matches when the robot is on no team', async () => {
    await resolveOutstandingEventsForRobot(5);

    const [call] = mockScheduledMatchParticipantFindMany.mock.calls;
    expect(call[0].where.OR).toHaveLength(1);
    expect(call[0].where.OR[0].participantType).toBe('robot');
  });
});

describe('resolveOutstandingEventsForRobot — tournament brackets', () => {
  it('should report the bracket while the robot is still alive in it', async () => {
    mockScheduledTournamentMatchFindMany.mockResolvedValue([
      { participantType: 'robot', participant1Id: 5, participant2Id: 9 },
    ]);

    await expect(resolveOutstandingEventsForRobot(5)).resolves.toEqual(['tournament_1v1']);
  });

  it('should free the slot once the robot is eliminated', async () => {
    // Elimination leaves no unresolved match: the query filters on winnerId null
    // and active tournaments, so an eliminated robot matches nothing. This is what
    // lets a player knocked out in round 2 use the robot elsewhere immediately.
    mockScheduledTournamentMatchFindMany.mockResolvedValue([]);

    await expect(resolveOutstandingEventsForRobot(5)).resolves.toEqual([]);
  });

  it('should only consider unresolved matches in active tournaments', async () => {
    await resolveOutstandingEventsForRobot(5);

    const [call] = mockScheduledTournamentMatchFindMany.mock.calls;
    expect(call[0].where).toMatchObject({
      status: { in: ['pending', 'scheduled'] },
      tournament: { status: 'active' },
      winnerId: null,
    });
  });

  it('should ignore the opposing participant in a bracket match', async () => {
    mockScheduledTournamentMatchFindMany.mockResolvedValue([
      { participantType: 'robot', participant1Id: 5, participant2Id: 9 },
    ]);

    const byRobot = await resolveOutstandingEventsForRobots([5]);

    expect(byRobot.get(5)).toEqual(['tournament_1v1']);
    expect(byRobot.has(9)).toBe(false);
  });
});

describe('resolveOutstandingEventsForRobots — batching', () => {
  it('should return an entry for every requested robot, even idle ones', async () => {
    const byRobot = await resolveOutstandingEventsForRobots([1, 2, 3]);

    expect([...byRobot.keys()]).toEqual([1, 2, 3]);
    expect(byRobot.get(2)).toEqual([]);
  });

  it('should return an empty map without querying for an empty roster', async () => {
    const byRobot = await resolveOutstandingEventsForRobots([]);

    expect(byRobot.size).toBe(0);
    expect(mockScheduledMatchParticipantFindMany).not.toHaveBeenCalled();
    expect(mockTeamBattleMemberFindMany).not.toHaveBeenCalled();
  });

  it('should give every member of a team the team obligation', async () => {
    mockTeamBattleMemberFindMany.mockResolvedValue([
      { robotId: 1, teamId: 77 },
      { robotId: 2, teamId: 77 },
    ]);
    mockScheduledMatchParticipantFindMany.mockResolvedValue([
      { participantType: 'team', participantId: 77, scheduledMatch: { matchType: 'tag_team' } },
    ]);

    const byRobot = await resolveOutstandingEventsForRobots([1, 2]);

    expect(byRobot.get(1)).toEqual(['tag_team']);
    expect(byRobot.get(2)).toEqual(['tag_team']);
  });

  it('should combine solo, team and bracket obligations for one robot', async () => {
    mockTeamBattleMemberFindMany.mockResolvedValue([{ robotId: 1, teamId: 77 }]);
    mockScheduledMatchParticipantFindMany.mockResolvedValue([
      { participantType: 'robot', participantId: 1, scheduledMatch: { matchType: 'league_1v1' } },
      { participantType: 'team', participantId: 77, scheduledMatch: { matchType: 'league_3v3' } },
    ]);
    mockScheduledTournamentMatchFindMany.mockResolvedValue([
      { participantType: 'team_3v3', participant1Id: 77, participant2Id: null },
    ]);

    const byRobot = await resolveOutstandingEventsForRobots([1]);

    expect(byRobot.get(1)!.sort()).toEqual(['league_1v1', 'league_3v3', 'tournament_3v3']);
  });

  it('should read the whole roster in a bounded number of queries', async () => {
    // Four queries regardless of roster size — the Booking Office matrix asks for
    // every robot at once, and this used to be three queries per robot.
    mockTeamBattleMemberFindMany.mockResolvedValue([{ robotId: 1, teamId: 77 }]);

    await resolveOutstandingEventsForRobots([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    expect(mockTeamBattleMemberFindMany).toHaveBeenCalledTimes(1);
    expect(mockScheduledMatchParticipantFindMany).toHaveBeenCalledTimes(1);
    expect(mockScheduledTournamentMatchFindMany).toHaveBeenCalledTimes(1);
  });
});
