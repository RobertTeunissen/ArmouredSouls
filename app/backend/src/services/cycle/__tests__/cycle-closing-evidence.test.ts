const mockUserFindMany = jest.fn();
const mockAuditFindMany = jest.fn();
const mockLogEventBatch = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findMany: mockUserFindMany },
    auditLog: { findMany: mockAuditFindMany },
  },
}));

jest.mock('../../common/eventLogger', () => ({
  EventType: { CYCLE_END_BALANCE: 'cycle_end_balance' },
  eventLogger: { logEventBatch: mockLogEventBatch },
}));

import { logCycleEndBalances } from '../cycle-closing-evidence';

function balanceUser(id: number) {
  return {
    id,
    username: `user-${id}`,
    stableName: null,
    currency: 1000 + id,
  };
}

function balanceSourceEventId(cycleNumber: number, userId: number): string {
  return `cycle-end-balance:${cycleNumber}:${userId}`;
}

describe('cycle closing evidence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditFindMany.mockResolvedValue([]);
    mockLogEventBatch.mockResolvedValue(undefined);
  });

  it('should capture watermarked balances in bounded keyset-ordered batches', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => balanceUser(index + 1));
    const finalUser = { ...balanceUser(101), stableName: 'Final Stable' };
    mockUserFindMany
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([finalUser]);

    const usersLogged = await logCycleEndBalances(44, 101);

    expect(usersLogged).toBe(101);
    expect(mockUserFindMany).toHaveBeenCalledTimes(2);
    expect(mockUserFindMany.mock.calls[0][0]).toMatchObject({
      where: { id: { lte: 101 } },
      orderBy: { id: 'asc' },
      take: 100,
    });
    expect(mockUserFindMany.mock.calls[1][0]).toMatchObject({
      where: { id: { lte: 101, gt: 100 } },
      take: 100,
    });
    expect(mockLogEventBatch).toHaveBeenCalledTimes(2);
    expect(mockLogEventBatch.mock.calls[0][1]).toHaveLength(100);
    expect(mockLogEventBatch.mock.calls[1][1]).toEqual([
      {
        eventType: 'cycle_end_balance',
        sourceEventId: balanceSourceEventId(44, finalUser.id),
        payload: {
          username: finalUser.username,
          stableName: finalUser.stableName,
          balance: finalUser.currency,
        },
        userId: finalUser.id,
      },
    ]);
  });

  it('should resume after a failed page without duplicating committed evidence', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => balanceUser(index + 1));
    const finalUser = balanceUser(101);
    mockUserFindMany
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([finalUser]);
    mockLogEventBatch
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('page two unavailable'));

    await expect(logCycleEndBalances(46, 101)).rejects.toThrow('page two unavailable');

    mockUserFindMany
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([finalUser]);
    mockAuditFindMany
      .mockResolvedValueOnce(firstPage.map((user) => ({
        sourceEventId: balanceSourceEventId(46, user.id),
      })))
      .mockResolvedValueOnce([]);

    await expect(logCycleEndBalances(46, 101)).resolves.toBe(101);
    expect(mockLogEventBatch).toHaveBeenCalledTimes(3);
    expect(mockLogEventBatch.mock.calls[2][1]).toEqual([
      expect.objectContaining({
        sourceEventId: balanceSourceEventId(46, finalUser.id),
        userId: finalUser.id,
      }),
    ]);
  });

  it('should not query or allocate an audit sequence for an empty cohort', async () => {
    await expect(logCycleEndBalances(45, null)).resolves.toBe(0);
    expect(mockUserFindMany).not.toHaveBeenCalled();
    expect(mockLogEventBatch).not.toHaveBeenCalled();
  });
});
