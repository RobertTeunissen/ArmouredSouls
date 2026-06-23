/**
 * Unit tests for SchedulingService.
 *
 * Tests:
 * - createMatch: single row insertion for various match types, participant creation, bye match, metadata fields
 * - completeMatch: status update and battleId linking
 * - cancelMatch: status update and cancelReason setting
 * - getUpcomingForRobot: robot-filtered queries with optional matchType filter
 * - getUpcomingForTeam: team-filtered queries restricted to team match types
 *
 * _Requirements: 1.7, 1.8, 1.9, 2.2, 2.3, 2.4, 2.5_
 */

// Mock prisma
jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    scheduledMatch: {
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
    },
    scheduledMatchParticipant: {
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import schedulingService from '../schedulingService';
import { MatchType } from '../../../../generated/prisma';

const mockPrisma = jest.requireMock('../../../lib/prisma').default;

describe('SchedulingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Make $transaction pass the mock prisma as the tx argument to the callback
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma));
  });

  describe('createMatch', () => {
    it('should create exactly one match row for league_1v1', async () => {
      const createdMatch = {
        id: 1,
        matchType: MatchType.league_1v1,
        status: 'scheduled',
        scheduledFor: new Date('2025-01-15T08:00:00Z'),
        battleId: null,
        tournamentId: null,
        round: null,
        matchNumber: null,
        isByeMatch: null,
        leagueType: 'bronze',
        leagueInstanceId: 'bronze_1',
        scoreThreshold: null,
        timeLimit: null,
        zoneRadius: null,
        cancelReason: null,
      };

      const fullMatch = {
        ...createdMatch,
        participants: [
          { id: 1, scheduledMatchId: 1, participantType: 'robot', participantId: 101, slot: 1 },
          { id: 2, scheduledMatchId: 1, participantType: 'robot', participantId: 102, slot: 2 },
        ],
      };

      mockPrisma.scheduledMatch.create.mockResolvedValue(createdMatch);
      mockPrisma.scheduledMatchParticipant.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.scheduledMatch.findUniqueOrThrow.mockResolvedValue(fullMatch);

      const result = await schedulingService.createMatch({
        matchType: MatchType.league_1v1,
        scheduledFor: new Date('2025-01-15T08:00:00Z'),
        participants: [
          { participantType: 'robot', participantId: 101, slot: 1 },
          { participantType: 'robot', participantId: 102, slot: 2 },
        ],
        leagueType: 'bronze',
        leagueInstanceId: 'bronze_1',
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.scheduledMatch.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.scheduledMatchParticipant.createMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.scheduledMatchParticipant.createMany).toHaveBeenCalledWith({
        data: [
          { scheduledMatchId: 1, participantType: 'robot', participantId: 101, slot: 1 },
          { scheduledMatchId: 1, participantType: 'robot', participantId: 102, slot: 2 },
        ],
      });
      expect(result).toEqual(fullMatch);
      expect(result.participants).toHaveLength(2);
    });

    it('should create exactly one match row for koth with 6 participants', async () => {
      const createdMatch = {
        id: 2,
        matchType: MatchType.koth,
        status: 'scheduled',
        scheduledFor: new Date('2025-01-15T13:00:00Z'),
        battleId: null,
        tournamentId: null,
        round: null,
        matchNumber: null,
        isByeMatch: null,
        leagueType: null,
        leagueInstanceId: null,
        scoreThreshold: 100,
        timeLimit: 120,
        zoneRadius: 50,
        cancelReason: null,
      };

      const participants = Array.from({ length: 6 }, (_, i) => ({
        id: i + 10,
        scheduledMatchId: 2,
        participantType: 'robot',
        participantId: 200 + i,
        slot: i + 1,
      }));

      const fullMatch = { ...createdMatch, participants };

      mockPrisma.scheduledMatch.create.mockResolvedValue(createdMatch);
      mockPrisma.scheduledMatchParticipant.createMany.mockResolvedValue({ count: 6 });
      mockPrisma.scheduledMatch.findUniqueOrThrow.mockResolvedValue(fullMatch);

      const result = await schedulingService.createMatch({
        matchType: MatchType.koth,
        scheduledFor: new Date('2025-01-15T13:00:00Z'),
        participants: Array.from({ length: 6 }, (_, i) => ({
          participantType: 'robot' as const,
          participantId: 200 + i,
          slot: i + 1,
        })),
        scoreThreshold: 100,
        timeLimit: 120,
        zoneRadius: 50,
      });

      expect(mockPrisma.scheduledMatch.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.scheduledMatchParticipant.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ scheduledMatchId: 2, slot: 1 }),
          expect.objectContaining({ scheduledMatchId: 2, slot: 6 }),
        ]),
      });
      expect(result.participants).toHaveLength(6);
    });

    it('should create exactly one match row for tournament_2v2 with tournament metadata', async () => {
      const createdMatch = {
        id: 3,
        matchType: MatchType.tournament_2v2,
        status: 'scheduled',
        scheduledFor: new Date('2025-01-15T15:00:00Z'),
        battleId: null,
        tournamentId: 42,
        round: 2,
        matchNumber: 3,
        isByeMatch: false,
        leagueType: null,
        leagueInstanceId: null,
        scoreThreshold: null,
        timeLimit: null,
        zoneRadius: null,
        cancelReason: null,
      };

      const fullMatch = {
        ...createdMatch,
        participants: [
          { id: 20, scheduledMatchId: 3, participantType: 'team', participantId: 301, slot: 1 },
          { id: 21, scheduledMatchId: 3, participantType: 'team', participantId: 302, slot: 2 },
        ],
      };

      mockPrisma.scheduledMatch.create.mockResolvedValue(createdMatch);
      mockPrisma.scheduledMatchParticipant.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.scheduledMatch.findUniqueOrThrow.mockResolvedValue(fullMatch);

      const result = await schedulingService.createMatch({
        matchType: MatchType.tournament_2v2,
        scheduledFor: new Date('2025-01-15T15:00:00Z'),
        participants: [
          { participantType: 'team', participantId: 301, slot: 1 },
          { participantType: 'team', participantId: 302, slot: 2 },
        ],
        tournamentId: 42,
        round: 2,
        matchNumber: 3,
        isByeMatch: false,
      });

      expect(mockPrisma.scheduledMatch.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.scheduledMatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchType: MatchType.tournament_2v2,
          tournamentId: 42,
          round: 2,
          matchNumber: 3,
          isByeMatch: false,
        }),
      });
      expect(result.participants).toHaveLength(2);
    });

    it('should create one participant for bye matches', async () => {
      const createdMatch = {
        id: 4,
        matchType: MatchType.tournament_1v1,
        status: 'scheduled',
        scheduledFor: new Date('2025-01-15T10:00:00Z'),
        battleId: null,
        tournamentId: 10,
        round: 1,
        matchNumber: 4,
        isByeMatch: true,
        leagueType: null,
        leagueInstanceId: null,
        scoreThreshold: null,
        timeLimit: null,
        zoneRadius: null,
        cancelReason: null,
      };

      const fullMatch = {
        ...createdMatch,
        participants: [
          { id: 30, scheduledMatchId: 4, participantType: 'robot', participantId: 501, slot: 1 },
        ],
      };

      mockPrisma.scheduledMatch.create.mockResolvedValue(createdMatch);
      mockPrisma.scheduledMatchParticipant.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.scheduledMatch.findUniqueOrThrow.mockResolvedValue(fullMatch);

      const result = await schedulingService.createMatch({
        matchType: MatchType.tournament_1v1,
        scheduledFor: new Date('2025-01-15T10:00:00Z'),
        participants: [
          { participantType: 'robot', participantId: 501, slot: 1 },
        ],
        tournamentId: 10,
        round: 1,
        matchNumber: 4,
        isByeMatch: true,
      });

      expect(mockPrisma.scheduledMatchParticipant.createMany).toHaveBeenCalledWith({
        data: [
          { scheduledMatchId: 4, participantType: 'robot', participantId: 501, slot: 1 },
        ],
      });
      expect(result.participants).toHaveLength(1);
    });

    it('should set league metadata for league match types', async () => {
      const createdMatch = {
        id: 5,
        matchType: MatchType.league_2v2,
        status: 'scheduled',
        scheduledFor: new Date('2025-01-15T09:00:00Z'),
        battleId: null,
        tournamentId: null,
        round: null,
        matchNumber: null,
        isByeMatch: null,
        leagueType: 'silver',
        leagueInstanceId: 'silver_2',
        scoreThreshold: null,
        timeLimit: null,
        zoneRadius: null,
        cancelReason: null,
      };

      const fullMatch = {
        ...createdMatch,
        participants: [
          { id: 40, scheduledMatchId: 5, participantType: 'team', participantId: 601, slot: 1 },
          { id: 41, scheduledMatchId: 5, participantType: 'team', participantId: 602, slot: 2 },
        ],
      };

      mockPrisma.scheduledMatch.create.mockResolvedValue(createdMatch);
      mockPrisma.scheduledMatchParticipant.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.scheduledMatch.findUniqueOrThrow.mockResolvedValue(fullMatch);

      await schedulingService.createMatch({
        matchType: MatchType.league_2v2,
        scheduledFor: new Date('2025-01-15T09:00:00Z'),
        participants: [
          { participantType: 'team', participantId: 601, slot: 1 },
          { participantType: 'team', participantId: 602, slot: 2 },
        ],
        leagueType: 'silver',
        leagueInstanceId: 'silver_2',
      });

      expect(mockPrisma.scheduledMatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchType: MatchType.league_2v2,
          leagueType: 'silver',
          leagueInstanceId: 'silver_2',
          tournamentId: null,
          round: null,
          matchNumber: null,
          isByeMatch: null,
        }),
      });
    });

    it('should set KotH metadata for koth match type', async () => {
      const createdMatch = {
        id: 6,
        matchType: MatchType.koth,
        status: 'scheduled',
        scheduledFor: new Date('2025-01-15T13:00:00Z'),
        battleId: null,
        tournamentId: null,
        round: null,
        matchNumber: null,
        isByeMatch: null,
        leagueType: null,
        leagueInstanceId: null,
        scoreThreshold: 150,
        timeLimit: 180,
        zoneRadius: 75,
        cancelReason: null,
      };

      const fullMatch = {
        ...createdMatch,
        participants: [
          { id: 50, scheduledMatchId: 6, participantType: 'robot', participantId: 701, slot: 1 },
          { id: 51, scheduledMatchId: 6, participantType: 'robot', participantId: 702, slot: 2 },
        ],
      };

      mockPrisma.scheduledMatch.create.mockResolvedValue(createdMatch);
      mockPrisma.scheduledMatchParticipant.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.scheduledMatch.findUniqueOrThrow.mockResolvedValue(fullMatch);

      await schedulingService.createMatch({
        matchType: MatchType.koth,
        scheduledFor: new Date('2025-01-15T13:00:00Z'),
        participants: [
          { participantType: 'robot', participantId: 701, slot: 1 },
          { participantType: 'robot', participantId: 702, slot: 2 },
        ],
        scoreThreshold: 150,
        timeLimit: 180,
        zoneRadius: 75,
      });

      expect(mockPrisma.scheduledMatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchType: MatchType.koth,
          scoreThreshold: 150,
          timeLimit: 180,
          zoneRadius: 75,
          leagueType: null,
          leagueInstanceId: null,
          tournamentId: null,
        }),
      });
    });

    it('should set tournament metadata for tournament match types', async () => {
      const createdMatch = {
        id: 7,
        matchType: MatchType.tournament_3v3,
        status: 'scheduled',
        scheduledFor: new Date('2025-01-15T18:00:00Z'),
        battleId: null,
        tournamentId: 99,
        round: 3,
        matchNumber: 7,
        isByeMatch: false,
        leagueType: null,
        leagueInstanceId: null,
        scoreThreshold: null,
        timeLimit: null,
        zoneRadius: null,
        cancelReason: null,
      };

      const fullMatch = {
        ...createdMatch,
        participants: [
          { id: 60, scheduledMatchId: 7, participantType: 'team', participantId: 801, slot: 1 },
          { id: 61, scheduledMatchId: 7, participantType: 'team', participantId: 802, slot: 2 },
        ],
      };

      mockPrisma.scheduledMatch.create.mockResolvedValue(createdMatch);
      mockPrisma.scheduledMatchParticipant.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.scheduledMatch.findUniqueOrThrow.mockResolvedValue(fullMatch);

      await schedulingService.createMatch({
        matchType: MatchType.tournament_3v3,
        scheduledFor: new Date('2025-01-15T18:00:00Z'),
        participants: [
          { participantType: 'team', participantId: 801, slot: 1 },
          { participantType: 'team', participantId: 802, slot: 2 },
        ],
        tournamentId: 99,
        round: 3,
        matchNumber: 7,
        isByeMatch: false,
      });

      expect(mockPrisma.scheduledMatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchType: MatchType.tournament_3v3,
          tournamentId: 99,
          round: 3,
          matchNumber: 7,
          isByeMatch: false,
          leagueType: null,
          leagueInstanceId: null,
        }),
      });
    });
  });

  describe('completeMatch', () => {
    it('should update status to completed and set battleId', async () => {
      mockPrisma.scheduledMatch.update.mockResolvedValue({
        id: 1,
        status: 'completed',
        battleId: 555,
      });

      await schedulingService.completeMatch(1, 555);

      expect(mockPrisma.scheduledMatch.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.scheduledMatch.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'completed',
          battleId: 555,
        },
      });
    });
  });

  describe('cancelMatch', () => {
    it('should update status to cancelled and set cancelReason', async () => {
      mockPrisma.scheduledMatch.update.mockResolvedValue({
        id: 2,
        status: 'cancelled',
        cancelReason: 'Insufficient participants',
      });

      await schedulingService.cancelMatch(2, 'Insufficient participants');

      expect(mockPrisma.scheduledMatch.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.scheduledMatch.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: {
          status: 'cancelled',
          cancelReason: 'Insufficient participants',
        },
      });
    });
  });

  describe('getUpcomingForRobot', () => {
    it('should return scheduled matches for a robot', async () => {
      const scheduledMatch = {
        id: 10,
        matchType: MatchType.league_1v1,
        status: 'scheduled',
        scheduledFor: new Date('2025-01-16T08:00:00Z'),
        participants: [
          { id: 1, scheduledMatchId: 10, participantType: 'robot', participantId: 101, slot: 1 },
          { id: 2, scheduledMatchId: 10, participantType: 'robot', participantId: 102, slot: 2 },
        ],
      };

      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([
        {
          id: 1,
          scheduledMatchId: 10,
          participantType: 'robot',
          participantId: 101,
          slot: 1,
          scheduledMatch: scheduledMatch,
        },
      ]);

      const result = await schedulingService.getUpcomingForRobot(101);

      expect(mockPrisma.scheduledMatchParticipant.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.scheduledMatchParticipant.findMany).toHaveBeenCalledWith({
        where: {
          participantType: 'robot',
          participantId: 101,
          scheduledMatch: {
            status: 'scheduled',
          },
        },
        include: {
          scheduledMatch: {
            include: { participants: true },
          },
        },
        orderBy: {
          scheduledMatch: { scheduledFor: 'asc' },
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(scheduledMatch);
    });

    it('should filter by matchTypes when provided', async () => {
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([]);

      await schedulingService.getUpcomingForRobot(101, [MatchType.league_1v1, MatchType.koth]);

      expect(mockPrisma.scheduledMatchParticipant.findMany).toHaveBeenCalledWith({
        where: {
          participantType: 'robot',
          participantId: 101,
          scheduledMatch: {
            status: 'scheduled',
            matchType: { in: [MatchType.league_1v1, MatchType.koth] },
          },
        },
        include: {
          scheduledMatch: {
            include: { participants: true },
          },
        },
        orderBy: {
          scheduledMatch: { scheduledFor: 'asc' },
        },
      });
    });

    it('should return empty array when no matches found', async () => {
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([]);

      const result = await schedulingService.getUpcomingForRobot(999);

      expect(result).toEqual([]);
    });
  });

  describe('getUpcomingForTeam', () => {
    it('should return team-based matches for a team', async () => {
      const scheduledMatch = {
        id: 20,
        matchType: MatchType.league_2v2,
        status: 'scheduled',
        scheduledFor: new Date('2025-01-16T09:00:00Z'),
        participants: [
          { id: 10, scheduledMatchId: 20, participantType: 'team', participantId: 301, slot: 1 },
          { id: 11, scheduledMatchId: 20, participantType: 'team', participantId: 302, slot: 2 },
        ],
      };

      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([
        {
          id: 10,
          scheduledMatchId: 20,
          participantType: 'team',
          participantId: 301,
          slot: 1,
          scheduledMatch: scheduledMatch,
        },
      ]);

      const result = await schedulingService.getUpcomingForTeam(301);

      expect(mockPrisma.scheduledMatchParticipant.findMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(scheduledMatch);
    });

    it('should only include team match types', async () => {
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([]);

      await schedulingService.getUpcomingForTeam(301);

      expect(mockPrisma.scheduledMatchParticipant.findMany).toHaveBeenCalledWith({
        where: {
          participantType: 'team',
          participantId: 301,
          scheduledMatch: {
            status: 'scheduled',
            matchType: {
              in: [
                MatchType.league_2v2,
                MatchType.league_3v3,
                MatchType.tag_team,
                MatchType.tournament_2v2,
                MatchType.tournament_3v3,
              ],
            },
          },
        },
        include: {
          scheduledMatch: {
            include: { participants: true },
          },
        },
        orderBy: {
          scheduledMatch: { scheduledFor: 'asc' },
        },
      });
    });
  });
});
