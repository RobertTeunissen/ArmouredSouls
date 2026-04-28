/**
 * Unit tests for AdminAuditLogService.
 *
 * Tests recordAction (fire-and-forget with error handling),
 * getEntries with filters, and pagination logic.
 *
 * _Requirements: 19.1, 19.2_
 */

// ── Mocks (must be before imports) ──────────────────────────────────

const mockPrisma = {
  adminAuditLog: {
    create: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
};

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { recordAction, getEntries } from '../adminAuditLogService';

// ── Test setup ──────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.adminAuditLog.create.mockResolvedValue({});
  mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
  mockPrisma.adminAuditLog.count.mockResolvedValue(0);
});

// ── Tests: recordAction ─────────────────────────────────────────────

describe('recordAction', () => {
  it('should call prisma.adminAuditLog.create with correct data', async () => {
    const createPromise = Promise.resolve({ id: 1 });
    mockPrisma.adminAuditLog.create.mockReturnValue(createPromise);

    recordAction(1, 'matchmaking_run', 'success', { matchesCreated: 5 });

    // Wait for the fire-and-forget promise to settle
    await createPromise;

    expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        adminUserId: 1,
        operationType: 'matchmaking_run',
        operationResult: 'success',
        resultSummary: { matchesCreated: 5 },
      },
    });
  });

  it('should pass the adminUserId correctly', async () => {
    const createPromise = Promise.resolve({ id: 2 });
    mockPrisma.adminAuditLog.create.mockReturnValue(createPromise);

    recordAction(42, 'bulk_cycles', 'success', { cyclesRun: 10 });

    await createPromise;

    expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ adminUserId: 42 }),
      })
    );
  });

  it('should pass operationType and operationResult correctly', async () => {
    const createPromise = Promise.resolve({ id: 3 });
    mockPrisma.adminAuditLog.create.mockReturnValue(createPromise);

    recordAction(1, 'battles_run', 'failure', { error: 'timeout' });

    await createPromise;

    expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operationType: 'battles_run',
          operationResult: 'failure',
        }),
      })
    );
  });

  it('should not throw when prisma.create rejects (fire-and-forget)', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const rejection = Promise.reject(new Error('DB connection lost'));
    // Attach a catch to prevent unhandled rejection in the mock itself
    const catchableRejection = { ...rejection, catch: rejection.catch.bind(rejection) };
    mockPrisma.adminAuditLog.create.mockReturnValue(rejection);

    // recordAction should not throw
    expect(() => {
      recordAction(1, 'matchmaking_run', 'success', {});
    }).not.toThrow();

    // Wait for the rejection to be caught internally
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to write admin audit log entry:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('should log the error message when create fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const dbError = new Error('unique constraint violation');
    mockPrisma.adminAuditLog.create.mockReturnValue(Promise.reject(dbError));

    recordAction(1, 'test_op', 'success', {});

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to write admin audit log entry:',
      dbError
    );

    consoleSpy.mockRestore();
  });
});

// ── Tests: getEntries ───────────────────────────────────────────────

describe('getEntries', () => {
  const sampleEntries = [
    {
      id: 1,
      adminUserId: 1,
      operationType: 'matchmaking_run',
      operationResult: 'success',
      resultSummary: { matchesCreated: 5 },
      createdAt: new Date('2025-01-15T10:00:00Z'),
    },
    {
      id: 2,
      adminUserId: 1,
      operationType: 'battles_run',
      operationResult: 'success',
      resultSummary: { battlesExecuted: 10 },
      createdAt: new Date('2025-01-15T11:00:00Z'),
    },
  ];

  describe('with no filters', () => {
    it('should return paginated results with default page and pageSize', async () => {
      mockPrisma.adminAuditLog.findMany.mockResolvedValue(sampleEntries);
      mockPrisma.adminAuditLog.count.mockResolvedValue(2);

      const result = await getEntries();

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(25);
      expect(result.entries).toEqual(sampleEntries);
      expect(result.total).toBe(2);
    });

    it('should call findMany with empty where clause', async () => {
      mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.adminAuditLog.count.mockResolvedValue(0);

      await getEntries();

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });

    it('should order by createdAt descending', async () => {
      mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.adminAuditLog.count.mockResolvedValue(0);

      await getEntries();

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  describe('with operationType filter', () => {
    it('should include operationType in where clause', async () => {
      mockPrisma.adminAuditLog.findMany.mockResolvedValue([sampleEntries[0]]);
      mockPrisma.adminAuditLog.count.mockResolvedValue(1);

      await getEntries({ operationType: 'matchmaking_run' });

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { operationType: 'matchmaking_run' },
        })
      );
    });

    it('should pass the same where clause to count', async () => {
      mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.adminAuditLog.count.mockResolvedValue(0);

      await getEntries({ operationType: 'bulk_cycles' });

      expect(mockPrisma.adminAuditLog.count).toHaveBeenCalledWith({
        where: { operationType: 'bulk_cycles' },
      });
    });
  });

  describe('with date range filter', () => {
    it('should include startDate as gte in where clause', async () => {
      const startDate = new Date('2025-01-01T00:00:00Z');
      mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.adminAuditLog.count.mockResolvedValue(0);

      await getEntries({ startDate });

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdAt: { gte: startDate } },
        })
      );
    });

    it('should include endDate as lte in where clause', async () => {
      const endDate = new Date('2025-01-31T23:59:59Z');
      mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.adminAuditLog.count.mockResolvedValue(0);

      await getEntries({ endDate });

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdAt: { lte: endDate } },
        })
      );
    });

    it('should include both startDate and endDate when both provided', async () => {
      const startDate = new Date('2025-01-01T00:00:00Z');
      const endDate = new Date('2025-01-31T23:59:59Z');
      mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.adminAuditLog.count.mockResolvedValue(0);

      await getEntries({ startDate, endDate });

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdAt: { gte: startDate, lte: endDate } },
        })
      );
    });

    it('should combine operationType with date range', async () => {
      const startDate = new Date('2025-01-01T00:00:00Z');
      mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.adminAuditLog.count.mockResolvedValue(0);

      await getEntries({ operationType: 'battles_run', startDate });

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            operationType: 'battles_run',
            createdAt: { gte: startDate },
          },
        })
      );
    });
  });

  describe('pagination', () => {
    it('should use custom page and pageSize', async () => {
      mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.adminAuditLog.count.mockResolvedValue(100);

      const result = await getEntries({ page: 3, pageSize: 10 });

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
    });

    it('should calculate skip correctly (page 1)', async () => {
      mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.adminAuditLog.count.mockResolvedValue(0);

      await getEntries({ page: 1, pageSize: 25 });

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 25,
        })
      );
    });

    it('should calculate skip correctly (page 3, pageSize 10)', async () => {
      mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.adminAuditLog.count.mockResolvedValue(50);

      await getEntries({ page: 3, pageSize: 10 });

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
    });

    it('should calculate totalPages correctly (exact division)', async () => {
      mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.adminAuditLog.count.mockResolvedValue(50);

      const result = await getEntries({ page: 1, pageSize: 10 });

      expect(result.totalPages).toBe(5);
    });

    it('should calculate totalPages correctly (with remainder)', async () => {
      mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.adminAuditLog.count.mockResolvedValue(51);

      const result = await getEntries({ page: 1, pageSize: 10 });

      expect(result.totalPages).toBe(6);
    });

    it('should return totalPages 0 when there are no entries', async () => {
      mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.adminAuditLog.count.mockResolvedValue(0);

      const result = await getEntries();

      expect(result.totalPages).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should return totalPages 1 when entries fit in one page', async () => {
      mockPrisma.adminAuditLog.findMany.mockResolvedValue(sampleEntries);
      mockPrisma.adminAuditLog.count.mockResolvedValue(2);

      const result = await getEntries({ pageSize: 25 });

      expect(result.totalPages).toBe(1);
    });
  });
});
