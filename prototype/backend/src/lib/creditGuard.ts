/**
 * Credit Guard — Prevents race-condition exploits on currency spending.
 *
 * Uses SELECT ... FOR UPDATE to acquire a row-level lock on the user row,
 * serializing concurrent transactions for the same user. This ensures that
 * only one purchase can read + decrement the balance at a time.
 */

import type { Prisma } from '../../generated/prisma';

interface LockedUser {
  id: number;
  currency: number;
}

/**
 * Acquires an exclusive row-level lock on the user's row within a Prisma
 * interactive transaction, then returns the freshly-read currency balance.
 *
 * Any concurrent transaction calling this for the same userId will block
 * until this transaction commits or rolls back.
 *
 * @param tx  - The Prisma transaction client
 * @param userId - The user whose row should be locked
 * @returns The locked user row with current currency
 */
export async function lockUserForSpending(
  tx: Prisma.TransactionClient,
  userId: number
): Promise<LockedUser> {
  // FOR UPDATE acquires a row-level exclusive lock in PostgreSQL.
  // Other transactions attempting the same lock will wait until this one completes.
  const rows = await tx.$queryRaw<LockedUser[]>`
    SELECT id, currency FROM "users" WHERE id = ${userId} FOR UPDATE
  `;

  if (!rows || rows.length === 0) {
    throw new Error(`User ${userId} not found`);
  }

  return rows[0];
}
