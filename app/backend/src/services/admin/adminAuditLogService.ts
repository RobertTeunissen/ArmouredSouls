import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';

/**
 * Service for recording and querying admin audit trail entries.
 * Provides fire-and-forget recording (errors are logged, never thrown)
 * and paginated querying with filtering support.
 */

/**
 * Record an admin action to the audit log.
 * Uses fire-and-forget: logs errors to console but never throws,
 * so the calling operation is not affected by audit write failures.
 */
export function recordAction(
  adminUserId: number,
  operationType: string,
  operationResult: 'success' | 'failure',
  resultSummary: Record<string, unknown>
): void {
  prisma.adminAuditLog
    .create({
      data: {
        adminUserId,
        operationType,
        operationResult,
        resultSummary: resultSummary as Prisma.InputJsonValue,
      },
    })
    .catch((err: unknown) => {
      console.error('Failed to write admin audit log entry:', err);
    });
}

export interface GetEntriesParams {
  page?: number;
  pageSize?: number;
  operationType?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface AuditLogEntry {
  id: number;
  adminUserId: number;
  operationType: string;
  operationResult: string;
  resultSummary: Prisma.JsonValue;
  createdAt: Date;
}

export interface GetEntriesResult {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Get paginated audit log entries with optional filtering.
 * Supports filtering by operationType and date range (startDate/endDate).
 * Results are sorted by createdAt descending (most recent first).
 */
export async function getEntries(params: GetEntriesParams = {}): Promise<GetEntriesResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Prisma.AdminAuditLogWhereInput = {};

  if (params.operationType) {
    where.operationType = params.operationType;
  }

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      where.createdAt.gte = params.startDate;
    }
    if (params.endDate) {
      where.createdAt.lte = params.endDate;
    }
  }

  const [entries, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  return {
    entries,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
