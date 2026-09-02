import prisma from '../../../lib/prisma';
import { resolveByeEvent } from '../../battle/byeResolutionService';
import {
  advanceWinnersToNextRound,
  completeByeMatch,
} from '../tournamentService';

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    tournament: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    robot: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    teamBattle: {
      findUnique: jest.fn(),
    },
    scheduledTournamentMatch: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../battle/byeResolutionService', () => ({
  resolveByeEvent: jest.fn(),
}));

jest.mock('../../battle/baseOrchestrator', () => ({
  getCurrentCycleNumber: jest.fn().mockResolvedValue(12),
}));

describe('tournament bye lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should link the resolved Bye_Record before completing the scheduling row', async () => {
    (prisma.tournament.findUnique as jest.Mock).mockResolvedValue({
      id: 7,
      participantType: 'robot',
      totalParticipants: 8,
      maxRounds: 3,
    });
    (prisma.robot.findUnique as jest.Mock).mockResolvedValue({
      id: 101,
      userId: 55,
    });
    (prisma.robot.findMany as jest.Mock).mockResolvedValue([
      { id: 101, name: 'Winner', userId: 55, currentHP: 80, maxHP: 100, elo: 1200 },
    ]);
    (resolveByeEvent as jest.Mock).mockResolvedValue({
      battleId: 9001,
      creditsPaid: 30,
      alreadyResolved: false,
    });

    const result = await completeByeMatch({
      id: 44,
      tournamentId: 7,
      round: 1,
      matchNumber: 1,
      participantType: 'robot',
      participant1Id: 101,
      participant2Id: null,
      winnerId: null,
      battleId: null,
      status: 'pending',
      isByeMatch: true,
      createdAt: new Date(),
      completedAt: null,
    }, 101);

    expect(result).toBe(true);
    expect(resolveByeEvent).toHaveBeenCalledTimes(1);
    expect(prisma.scheduledTournamentMatch.update).toHaveBeenCalledWith({
      where: { id: 44 },
      data: {
        winnerId: 101,
        status: 'completed',
        isByeMatch: true,
        battleId: 9001,
        completedAt: expect.any(Date),
      },
    });
  });

  it('should leave a one-sided next-round match pending and never resolve it during advancement', async () => {
    const completedMatches = [
      {
        id: 1,
        tournamentId: 7,
        round: 1,
        matchNumber: 1,
        participant1Id: 101,
        participant2Id: 201,
        winnerId: 101,
        battleId: 8001,
        status: 'completed',
        isByeMatch: false,
      },
      {
        id: 4,
        tournamentId: 7,
        round: 1,
        matchNumber: 2,
        participant1Id: 102,
        participant2Id: 202,
        winnerId: 102,
        battleId: 8002,
        status: 'completed',
        isByeMatch: false,
      },
      {
        id: 5,
        tournamentId: 7,
        round: 1,
        matchNumber: 3,
        participant1Id: 103,
        participant2Id: 203,
        winnerId: 103,
        battleId: 8003,
        status: 'completed',
        isByeMatch: false,
      },
    ];
    const nextRoundMatches = [
      {
        id: 2,
        tournamentId: 7,
        round: 2,
        matchNumber: 1,
        participant1Id: null,
        participant2Id: null,
        winnerId: null,
        battleId: null,
        status: 'pending',
        isByeMatch: false,
      },
      {
        id: 3,
        tournamentId: 7,
        round: 2,
        matchNumber: 2,
        participant1Id: null,
        participant2Id: null,
        winnerId: null,
        battleId: null,
        status: 'pending',
        isByeMatch: false,
      },
    ];

    (prisma.tournament.findUnique as jest.Mock).mockResolvedValue({
      id: 7,
      currentRound: 1,
    });
    (prisma.scheduledTournamentMatch.findMany as jest.Mock)
      .mockResolvedValueOnce(completedMatches)
      .mockResolvedValueOnce(completedMatches)
      .mockResolvedValueOnce(nextRoundMatches);
    (prisma.scheduledTournamentMatch.update as jest.Mock).mockResolvedValue({});
    (prisma.tournament.update as jest.Mock).mockResolvedValue({});

    await advanceWinnersToNextRound(7);

    expect(resolveByeEvent).not.toHaveBeenCalled();
    expect(prisma.scheduledTournamentMatch.update).toHaveBeenNthCalledWith(2, {
      where: { id: 3 },
      data: {
        participant1Id: 103,
        participant2Id: null,
        winnerId: null,
        battleId: null,
        status: 'pending',
        isByeMatch: true,
        completedAt: null,
      },
    });
    expect(prisma.tournament.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { currentRound: 2 },
    });
  });
});
