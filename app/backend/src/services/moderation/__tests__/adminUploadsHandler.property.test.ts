/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Property-based test for admin uploads pagination consistency.
 *
 * Property 17: Admin uploads pagination consistency
 * For any set of image_upload_success AuditLog entries and valid pagination params,
 * the handler SHALL return exactly min(limit, remaining) entries and total SHALL
 * equal the total matching entries.
 *
 * **Validates: Requirements 13.1, 13.5**
 */

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    auditLog: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    robot: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../orphanCleanupJob', () => ({
  runOrphanCleanup: jest.fn(),
}));

import * as fc from 'fast-check';
import prisma from '../../../lib/prisma';
import { handleAdminUploads } from '../adminUploadsHandler';
import { AuthRequest } from '../../../middleware/auth';

/** Create a mock AuditLog entry */
function makeLog(index: number, userId: number) {
  // Use a base timestamp and add index as milliseconds to avoid invalid dates
  const baseTime = new Date('2025-01-15T10:00:00Z').getTime();
  return {
    id: BigInt(index + 1),
    cycleNumber: 0,
    eventType: 'image_upload_success',
    eventTimestamp: new Date(baseTime + index * 1000),
    sequenceNumber: index + 1,
    userId,
    robotId: null,
    battleId: null,
    payload: {
      robotId: index + 100,
      imageUrl: `/uploads/user-robots/${userId}/${index}.webp`,
      fileSize: 1024 * (index + 1),
    },
    metadata: null,
  };
}

function mockReq(query: Record<string, string> = {}): AuthRequest {
  return {
    user: { userId: 1, role: 'admin' },
    query,
  } as unknown as AuthRequest;
}

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('Property 17: Admin uploads pagination consistency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return exactly min(limit, remaining) entries and correct total for any pagination params', async () => {
    await fc.assert(
      fc.asyncProperty(
        // totalEntries: 0..100
        fc.integer({ min: 0, max: 100 }),
        // page: 1..20
        fc.integer({ min: 1, max: 20 }),
        // limit: 1..200
        fc.integer({ min: 1, max: 200 }),
        async (totalEntries: number, page: number, limit: number) => {
          // Calculate expected page size
          const skip = (page - 1) * limit;
          const remaining = Math.max(0, totalEntries - skip);
          const expectedPageSize = Math.min(limit, remaining);

          // Generate the mock logs for this page
          const pageLogs = Array.from({ length: expectedPageSize }, (_, i) =>
            makeLog(skip + i, 42)
          );

          // Mock prisma.$transaction to return [total, pageLogs]
          (prisma.$transaction as jest.Mock).mockResolvedValue([totalEntries, pageLogs]);
          (prisma.user.findMany as jest.Mock).mockResolvedValue(
            pageLogs.length > 0 ? [{ id: 42, username: 'testuser' }] : []
          );
          const robotIds = pageLogs.map((l) => (l.payload as any).robotId);
          (prisma.robot.findMany as jest.Mock).mockResolvedValue(
            [...new Set(robotIds)].map((id) => ({ id, name: `Robot${id}` }))
          );

          const req = mockReq({ page: String(page), limit: String(limit) });
          const res = mockRes();

          await handleAdminUploads(req, res);

          expect(res.status).toHaveBeenCalledWith(200);
          const body = res.json.mock.calls[0][0];

          // Property: total equals the total matching entries
          expect(body.total).toBe(totalEntries);

          // Property: page size is exactly min(limit, remaining)
          expect(body.uploads.length).toBe(expectedPageSize);

          // Property: page and limit are echoed back correctly
          expect(body.page).toBe(page);
          // Limit is capped at 200 by the handler
          expect(body.limit).toBe(Math.min(limit, 200));
        }
      ),
      { numRuns: 50 }
    );
  });
});
