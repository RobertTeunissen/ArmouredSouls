/**
 * Unit tests for pre-battle repair scoping (issue #411).
 *
 * Pre-battle repair used to repair every damaged robot in the game once per
 * battle cron, which charged full price for robots that had no match that slot
 * and left no realistic window for the 50% manual repair discount.
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

import { resolveRobotIdsForEvent } from '../../../src/services/economy/repairScope';
import type { SubscribableEventType } from '../../../src/services/subscription/eventRegistry';

const ALL_EVENT_TYPES: SubscribableEventType[] = [
  'league_1v1',
  'league_2v2',
  'league_3v3',
  'tag_team',
  'koth',
  'tournament_1v1',
  'tournament_2v2',
  'tournament_3v3',
  'grand_melee',
];

beforeEach(() => {
  jest.clearAllMocks();
  mockScheduledMatchParticipantFindMany.mockResolvedValue([]);
  mockScheduledTournamentMatchFindMany.mockResolvedValue([]);
  mockTeamBattleMemberFindMany.mockResolvedValue([]);
});

describe('resolveRobotIdsForEvent — robot-scoped modes', () => {
  it.each(['league_1v1', 'koth', 'grand_melee'] as const)(
    'should read %s participants straight from the unified schedule',
    async (eventType) => {
      mockScheduledMatchParticipantFindMany.mockResolvedValue([
        { participantId: 7 },
        { participantId: 12 },
      ]);

      const ids = await resolveRobotIdsForEvent(eventType);

      expect(ids).toEqual([7, 12]);
      expect(mockScheduledMatchParticipantFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            participantType: 'robot',
            scheduledMatch: { status: 'scheduled', matchType: eventType },
          },
        }),
      );
      // No team expansion for a robot-scoped mode.
      expect(mockTeamBattleMemberFindMany).not.toHaveBeenCalled();
    },
  );

  it('should only count matches still queued, never completed ones', async () => {
    await resolveRobotIdsForEvent('league_1v1');

    const where = mockScheduledMatchParticipantFindMany.mock.calls[0][0].where;
    expect(where.scheduledMatch.status).toBe('scheduled');
  });
});

describe('resolveRobotIdsForEvent — team-scoped modes', () => {
  it.each(['league_2v2', 'league_3v3', 'tag_team'] as const)(
    'should expand %s teams to their member robots',
    async (eventType) => {
      mockScheduledMatchParticipantFindMany.mockResolvedValue([
        { participantId: 100 },
        { participantId: 200 },
      ]);
      mockTeamBattleMemberFindMany.mockResolvedValue([
        { robotId: 11 },
        { robotId: 12 },
        { robotId: 21 },
      ]);

      const ids = await resolveRobotIdsForEvent(eventType);

      // Repair is charged per robot, so team ids must never leak through.
      expect(ids).toEqual([11, 12, 21]);
      expect(mockScheduledMatchParticipantFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            participantType: 'team',
            scheduledMatch: { status: 'scheduled', matchType: eventType },
          },
        }),
      );
      expect(mockTeamBattleMemberFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teamId: { in: [100, 200] } } }),
      );
    },
  );

  it('should not query members when no team has a match queued', async () => {
    mockScheduledMatchParticipantFindMany.mockResolvedValue([]);

    const ids = await resolveRobotIdsForEvent('league_2v2');

    expect(ids).toEqual([]);
    expect(mockTeamBattleMemberFindMany).not.toHaveBeenCalled();
  });
});

describe('resolveRobotIdsForEvent — tournament modes', () => {
  it('should read 1v1 bracket participants from the tournament table', async () => {
    mockScheduledTournamentMatchFindMany.mockResolvedValue([
      { participant1Id: 3, participant2Id: 4 },
      { participant1Id: 5, participant2Id: 6 },
    ]);

    const ids = await resolveRobotIdsForEvent('tournament_1v1');

    expect(ids).toEqual([3, 4, 5, 6]);
    // Spec #49: no `isByeMatch` filter. A bracket bye is a scheduled match that
    // resolves differently, so it is scoped for repair like any other.
    expect(mockScheduledTournamentMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          participantType: 'robot',
          status: { in: ['pending', 'scheduled'] },
        },
      }),
    );
    // The unified table holds no tournament bracket rows.
    expect(mockScheduledMatchParticipantFindMany).not.toHaveBeenCalled();
  });

  // Spec #49 removed the tournament-only bye exemption. Auto-repair must now
  // cover a byed robot in every mode, so a bracket bye row is included.
  it('should include a bracket bye participant in repair scoping', async () => {
    mockScheduledTournamentMatchFindMany.mockResolvedValue([
      { participant1Id: 11, participant2Id: null }, // a bye: one side empty
      { participant1Id: 12, participant2Id: 13 },
    ]);

    const ids = await resolveRobotIdsForEvent('tournament_1v1');

    expect(ids).toContain(11);
    expect(ids).toEqual([11, 12, 13]);
  });

  // Later rounds exist as placeholders with null participants until the bracket
  // resolves, which is what keeps this to the rounds that can actually be fought.
  it('should ignore unresolved bracket placeholders', async () => {
    mockScheduledTournamentMatchFindMany.mockResolvedValue([
      { participant1Id: 3, participant2Id: 4 },
      { participant1Id: null, participant2Id: null },
      { participant1Id: 9, participant2Id: null },
    ]);

    const ids = await resolveRobotIdsForEvent('tournament_1v1');

    expect(ids).toEqual([3, 4, 9]);
  });

  it.each([
    ['tournament_2v2', 'team_2v2'],
    ['tournament_3v3', 'team_3v3'],
  ] as const)('should expand %s bracket teams to member robots', async (eventType, participantType) => {
    mockScheduledTournamentMatchFindMany.mockResolvedValue([
      { participant1Id: 50, participant2Id: 60 },
    ]);
    mockTeamBattleMemberFindMany.mockResolvedValue([{ robotId: 31 }, { robotId: 32 }]);

    const ids = await resolveRobotIdsForEvent(eventType);

    expect(ids).toEqual([31, 32]);
    expect(mockScheduledTournamentMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ participantType }) }),
    );
  });

  // A robot knocked out in round 1 stays subscribed for the rest of the bracket.
  // Scoping on the schedule rather than the subscription is what stops it being
  // charged a full-price repair every day for a match it can never fight.
  it('should return nothing once a bracket has no fightable matches left', async () => {
    mockScheduledTournamentMatchFindMany.mockResolvedValue([]);

    expect(await resolveRobotIdsForEvent('tournament_1v1')).toEqual([]);
  });
});

describe('resolveRobotIdsForEvent — general behaviour', () => {
  it('should de-duplicate a robot queued in two matches of the same type', async () => {
    mockScheduledTournamentMatchFindMany.mockResolvedValue([
      { participant1Id: 8, participant2Id: 9 },
      { participant1Id: 8, participant2Id: 10 },
    ]);

    const ids = await resolveRobotIdsForEvent('tournament_1v1');

    expect(ids).toEqual([8, 9, 10]);
  });

  it('should resolve a scope for every subscribable battle type', async () => {
    for (const eventType of ALL_EVENT_TYPES) {
      await expect(resolveRobotIdsForEvent(eventType)).resolves.toEqual([]);
    }
  });
});
