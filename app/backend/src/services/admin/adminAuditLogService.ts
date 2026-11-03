import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import type { Prisma } from '../../../generated/prisma';

/**
 * Records admin actions in `admin_audit_logs` (fire-and-forget: errors are
 * logged, never thrown). The Admin actions page reads them through
 * `services/admin/admin-actions`. Operation names and their plain
 * descriptions: `admin-actions/adminActionCatalogue.ts`.
 */

function logFailure(adminUserId: number, operationType: string, err: unknown): void {
  logger.error('Failed to write admin audit log entry', {
    adminUserId,
    operationType,
    err: err instanceof Error ? err.message : String(err),
  });
}

/**
 * Record an admin action to the audit log.
 * Uses fire-and-forget: logs errors via the application logger but never
 * throws (not even synchronously), so the calling operation is not affected
 * by audit write failures.
 */
export function recordAction(
  adminUserId: number,
  operationType: string,
  operationResult: 'success' | 'failure',
  resultSummary: Record<string, unknown>
): void {
  try {
    prisma.adminAuditLog
      .create({
        data: {
          adminUserId,
          operationType,
          operationResult,
          resultSummary: resultSummary as Prisma.InputJsonValue,
        },
      })
      .catch((err: unknown) => logFailure(adminUserId, operationType, err));
  } catch (err) {
    logFailure(adminUserId, operationType, err);
  }
}
