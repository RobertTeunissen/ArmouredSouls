/**
 * Unit tests for AdminAuditLogService.
 *
 * Tests recordAction (fire-and-forget with error handling). Reading the
 * entries is the Admin actions service (adminActions.test.ts).
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

// Mock the structured logger so we can assert error logging without touching
// console.* (the service was migrated from console.error to logger.error).
const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { recordAction } from '../adminAuditLogService';

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
    const rejection = Promise.reject(new Error('DB connection lost'));
    // Attach a catch to prevent unhandled rejection in the mock itself
    rejection.catch(() => {});
    mockPrisma.adminAuditLog.create.mockReturnValue(rejection);

    // recordAction should not throw
    expect(() => {
      recordAction(1, 'matchmaking_run', 'success', {});
    }).not.toThrow();

    // Wait for the rejection to be caught internally
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to write admin audit log entry',
      expect.objectContaining({
        adminUserId: 1,
        operationType: 'matchmaking_run',
        err: 'DB connection lost',
      })
    );
  });

  it('does not throw when create itself throws synchronously', () => {
    mockPrisma.adminAuditLog.create.mockImplementation(() => {
      throw new TypeError('adminAuditLog is not available');
    });

    expect(() => recordAction(1, 'password_reset', 'success', {})).not.toThrow();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to write admin audit log entry',
      expect.objectContaining({ operationType: 'password_reset', err: 'adminAuditLog is not available' }),
    );
  });

  it('should log the error message when create fails', async () => {
    const dbError = new Error('unique constraint violation');
    mockPrisma.adminAuditLog.create.mockReturnValue(Promise.reject(dbError));

    recordAction(1, 'test_op', 'success', {});

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to write admin audit log entry',
      expect.objectContaining({
        adminUserId: 1,
        operationType: 'test_op',
        err: 'unique constraint violation',
      })
    );
  });
});
