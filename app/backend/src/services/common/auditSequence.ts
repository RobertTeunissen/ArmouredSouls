/**
 * Spec #51 — the single Sequence_Allocator for `audit_logs.sequence_number`.
 *
 * WHAT WAS WRONG
 * --------------
 * Three call sites independently did check-then-act across an `await`:
 *
 *   const last = await prisma.auditLog.findFirst({ where: { cycleNumber }, orderBy: { sequenceNumber: 'desc' } });
 *   const next = last ? last.sequenceNumber + 1 : 1;   // ← two callers both get here
 *
 * Two concurrent callers that both reach the query compute the same `next`, and
 * the second insert violates `@@unique([cycleNumber, sequenceNumber])`. In one
 * integration run this fired 3,142 times.
 *
 * CORRECTING THE OLD DIAGNOSIS
 * ----------------------------
 * `eventLogger.ts` used to describe this as a "rare race with parallel test
 * runners or multi-process deployments". It is neither, and it is not rare:
 *
 *   - `jest.config.integration.js` sets `maxWorkers: 1`
 *   - `app/ecosystem.config.js`    sets `instances: 1`
 *
 * So the collision is *intra-process*, on the async gap between the read and the
 * insert. The old wording would send an investigator hunting for a second process
 * that does not exist. It follows that the bug is reachable in production the
 * moment two request handlers log an event for the same cycle concurrently, which
 * is ordinary behaviour rather than an edge case.
 *
 * WHY IT MATTERED SILENTLY
 * ------------------------
 * `EventLogger.logEvent` caught and logged its own failures, so a collision
 * dropped an `audit_logs` row instead of failing a request. Under Spec #48,
 * `audit_logs` rows with `eventType: 'robot_repair'` are the sole
 * Repair_Spend_Source. A racy allocator therefore put silent holes in the
 * repair-spend and battle-income series that the Dashboard and several admin
 * analytics surfaces read.
 *
 * WHY NOT A POSTGRES SEQUENCE
 * ---------------------------
 * It is the cheapest fix and it is wrong here. `checkSequenceNumbers` in
 * `services/common/dataIntegrityService.ts` walks each cycle's sequence numbers
 * and reports every gap as a `sequence_number_continuity` integrity issue. A
 * sequence allocates on request and does not return values on rollback, so it
 * produces gaps by design and would make that check fire permanently. The
 * Gapless_Invariant is load-bearing.
 *
 * WHY AN ADVISORY LOCK AND NOT AN IN-PROCESS MUTEX
 * -----------------------------------------------
 * A mutex is a smaller diff and adequate while `instances: 1`, but it becomes
 * silently wrong the moment PM2 scales. `pg_advisory_xact_lock` is correct across
 * processes, keeps numbering gapless, and is the pattern this codebase already
 * uses for multi-row serialisation in team creation.
 */

import type { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';

/**
 * Advisory lock namespace for audit sequence allocation.
 *
 * Namespace 2 is taken by robot locks (`pg_advisory_xact_lock(2, robotId)` in
 * `team-battle/teamBattleService.ts`), and `league/leagueInstanceService.ts` uses
 * the single-argument form with a hashed tier name. A distinct namespace keeps
 * audit allocation from serialising against team operations.
 */
const AUDIT_SEQUENCE_LOCK_NAMESPACE = 3;

type Tx = Prisma.TransactionClient;

/**
 * Allocate a contiguous block of `count` sequence numbers for `cycleNumber` and
 * run `fn` with the first of them.
 *
 * The advisory lock is held for the remainder of the transaction, so allocation
 * and the caller's inserts commit together — no window in which a number is
 * allocated but unused, which is what keeps the Gapless_Invariant.
 *
 * Serialisation is per cycle: concurrent callers on *different* cycles do not
 * block each other.
 *
 * @param cycleNumber Cycle the audit rows belong to. Also the lock key.
 * @param count       How many consecutive numbers the caller will consume.
 * @param fn          Receives the first free sequence number.
 * @param tx          Existing transaction to join. Omit to open one.
 */
export async function withAuditSequence<T>(
  cycleNumber: number,
  count: number,
  fn: (startSequence: number, tx: Tx) => Promise<T>,
  tx?: Tx,
): Promise<T> {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`withAuditSequence: count must be a positive integer, received ${count}`);
  }

  const run = async (client: Tx): Promise<T> => {
    // Blocks until any other allocator for this cycle commits. Released
    // automatically at commit or rollback, so there is no unlock path to leak.
    await client.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_SEQUENCE_LOCK_NAMESPACE}, ${cycleNumber})`;

    const last = await client.auditLog.findFirst({
      where: { cycleNumber },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });

    const startSequence = (last?.sequenceNumber ?? 0) + 1;
    return fn(startSequence, client);
  };

  return tx ? run(tx) : prisma.$transaction((client) => run(client));
}
