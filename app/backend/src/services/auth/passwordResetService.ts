/**
 * Password Reset Service
 *
 * Encapsulates the full password reset transaction: hash update, session
 * invalidation (via tokenVersion increment), and audit log creation — all
 * within a single Prisma interactive transaction for atomicity.
 *
 * This service is intentionally decoupled from the admin context. The
 * {@link ResetInitiator} interface accepts a generic `resetType` string,
 * so future reset flows (e.g., email-token self-service) can call
 * {@link resetPassword} without modification.
 *
 * @module services/auth/passwordResetService
 *
 * @example Admin reset (current)
 * ```ts
 * await resetPassword(targetUserId, newPassword, {
 *   initiatorId: adminUser.id,
 *   resetType: 'admin',
 * });
 * ```
 *
 * @example Future: email-token self-service reset
 * ```ts
 * await resetPassword(targetUserId, newPassword, {
 *   initiatorId: targetUserId,   // user resets their own password
 *   resetType: 'self_service',
 * });
 * ```
 */

import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';
import { hashPassword } from './passwordService';
import { AuthError, AuthErrorCode } from '../../errors/authErrors';

/**
 * Describes who or what triggered the password reset.
 *
 * For admin resets, `initiatorId` is the admin's user ID and `resetType`
 * is `"admin"`. Future flows can use different reset types (e.g.,
 * `"self_service"`) without changing the service interface.
 */
export interface ResetInitiator {
  /** The user ID of whoever triggered the reset (admin, or the user themselves). */
  initiatorId: number;
  /** Distinguishes reset origins in the audit log (e.g., `"admin"`, `"self_service"`). */
  resetType: string;
}

/**
 * The result of a successful password reset.
 */
export interface ResetResult {
  /** The target user's ID. */
  userId: number;
  /** The target user's username. */
  username: string;
}

/**
 * Resets a user's password within a single Prisma interactive transaction.
 *
 * Atomically:
 * 1. Looks up the target user (throws 404 if not found)
 * 2. Hashes the new password via {@link hashPassword}
 * 3. Updates `passwordHash` and increments `tokenVersion` by 1
 *    (invalidating all existing JWT sessions)
 * 4. Writes an {@link AuditLog} entry with `eventType: "admin_password_reset"`
 *
 * The audit log payload contains only the initiator ID, target user ID, and
 * reset type — never the password or its hash.
 *
 * @param targetUserId - The ID of the user whose password is being reset
 * @param newPassword - The new plaintext password (caller must validate via `validatePassword()` first)
 * @param initiator - Who/what triggered the reset and the reset type
 * @returns The target user's ID and username
 * @throws {AuthError} `USER_NOT_FOUND` (404) if `targetUserId` doesn't exist
 * @throws {Error} If the transaction fails (Prisma auto-rollback)
 */
export async function resetPassword(
  targetUserId: number,
  newPassword: string,
  initiator: ResetInitiator,
): Promise<ResetResult> {
  return prisma.$transaction(async (tx) => {
    // 1. Look up the target user
    const user = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, tokenVersion: true },
    });

    if (!user) {
      throw new AuthError(
        AuthErrorCode.USER_NOT_FOUND,
        'User not found',
        404,
      );
    }

    // 2. Hash the new password
    const newHash = await hashPassword(newPassword);

    // 3. Update passwordHash and increment tokenVersion
    await tx.user.update({
      where: { id: targetUserId },
      data: {
        passwordHash: newHash,
        tokenVersion: user.tokenVersion + 1,
      },
    });

    // 4. Generate a unique sequence number for cycleNumber 0
    const lastEntry = await tx.auditLog.findFirst({
      where: { cycleNumber: 0 },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });
    const sequenceNumber = lastEntry ? lastEntry.sequenceNumber + 1 : 1;

    // 5. Write audit log entry — no password or hash in payload
    await tx.auditLog.create({
      data: {
        cycleNumber: 0,
        eventType: 'admin_password_reset',
        sequenceNumber,
        userId: initiator.initiatorId,
        payload: {
          adminId: initiator.initiatorId,
          targetUserId,
          resetType: initiator.resetType,
        } satisfies Prisma.JsonObject,
      },
    });

    return {
      userId: user.id,
      username: user.username,
    };
  });
}
