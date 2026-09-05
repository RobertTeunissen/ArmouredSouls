/**
 * Deferred, non-critical background work — fire-and-forget in production, awaitable in tests.
 *
 * The KotH and Grand Melee orchestrators defer achievement evaluation off the battle's
 * critical path with `setImmediate`, which is a sound latency choice: awarding an achievement
 * must not slow down or fail a battle. The problem is that nothing could ever wait for it.
 *
 * ─── What that cost (Spec #51) ───────────────────────────────────────────────
 *
 * A test finishes, its teardown deletes the users and robots it created, and the deferred
 * callback then runs against rows that no longer exist. In one Heavy_Tier run that produced,
 * from a single runner:
 *
 *   78  Foreign key constraint violated on `league_history_user_id_fkey`
 *   15  Unique constraint failed on (`cycle_number`, `sequence_number`)
 *    8  Unique constraint failed on (`user_id`, `achievement_id`)
 *
 * and — because the backlog keeps executing while the next suite runs — two suites that
 * normally finish in seconds took 1,791s and 1,027s, blowing their 120s per-test timeout and
 * failing a deploy from `main`. Every one of those errors looks like a race in the code under
 * test. None of them was: they are last cycle's homework being marked during this cycle's
 * lesson.
 *
 * The audit-sequence collisions are worth calling out, because they are the same symptom
 * Spec #51's advisory-lock allocator exists to prevent. The allocator is not at fault here.
 * It serialises concurrent allocations correctly; what it cannot do is stop a deferred write
 * from targeting a cycle whose `audit_logs` rows a test has since deleted and replayed.
 *
 * ─── The contract ────────────────────────────────────────────────────────────
 *
 * `defer` keeps the fire-and-forget semantics exactly: it never throws into its caller, and
 * the caller does not wait. It only additionally REGISTERS the work, so a test can await the
 * backlog before tearing its fixtures down. Production never calls `flushDeferredWork`, so
 * nothing about its behaviour changes.
 *
 * `tests/setup.ts` flushes in a global `afterEach`, so no individual suite has to remember.
 *
 * @module services/common/deferredWork
 */

import logger from '../../config/logger';

/** Work that has been scheduled and has not finished yet. */
const pending = new Set<Promise<void>>();

/**
 * Schedule non-critical work to run after the current task, without waiting for it.
 *
 * Failures are logged and swallowed — deferred work is by definition work whose failure must
 * not affect the operation that scheduled it. `label` names the work in that log line.
 */
export function defer(label: string, work: () => Promise<void>): void {
  const tracked = new Promise<void>((resolve) => {
    setImmediate(async () => {
      try {
        await work();
      } catch (error) {
        logger.error(`[DeferredWork] ${label} failed: ${error}`);
      } finally {
        resolve();
      }
    });
  });

  pending.add(tracked);
  void tracked.finally(() => pending.delete(tracked));
}

/**
 * Await every scheduled deferred task, including any scheduled by those tasks.
 *
 * Loops rather than awaiting once, because a deferred task may itself defer more work. Safe
 * to call when nothing is pending — it returns immediately.
 *
 * Intended for tests. Calling it in a request path would reintroduce the latency `defer`
 * exists to avoid.
 */
export async function flushDeferredWork(): Promise<void> {
  while (pending.size > 0) {
    await Promise.all([...pending]);
  }
}

/** Number of tasks still outstanding. Exposed for assertions and diagnostics. */
export function pendingDeferredCount(): number {
  return pending.size;
}
