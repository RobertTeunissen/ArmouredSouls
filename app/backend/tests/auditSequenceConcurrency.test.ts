/**
 * Spec #51 — regression tests for the Sequence_Allocator.
 *
 * These live in the Integration_Tier deliberately. The defect being covered is a
 * check-then-act race resolved by `pg_advisory_xact_lock`, which is real
 * PostgreSQL behaviour that a mocked Prisma client cannot exercise. A mocked
 * version of this test would pass against the broken code — which is a large part
 * of why the defect survived as long as it did.
 *
 * Before this change, `getNextSequenceNumber` read the current maximum and
 * incremented it across an `await`. Two concurrent callers both computed the same
 * next value and the second insert violated
 * `@@unique([cycleNumber, sequenceNumber])`. Because `logEvent` caught its own
 * failures, the row was dropped silently rather than surfacing as an error, which
 * put holes in the Repair_Spend_Source that Spec #48 made authoritative.
 */

import prisma from '../src/lib/prisma';
import { EventLogger, EventType } from '../src/services/common/eventLogger';
import { withAuditSequence } from '../src/services/common/auditSequence';
import { DataIntegrityService } from '../src/services/common/dataIntegrityService';

const eventLogger = new EventLogger();

// High cycle numbers so these cannot collide with fixture or seed data.
const CYCLE = 990051;
const OTHER_CYCLE = 990052;

async function clearCycles(): Promise<void> {
  await prisma.auditLog.deleteMany({
    where: { cycleNumber: { in: [CYCLE, OTHER_CYCLE] } },
  });
}

async function sequencesFor(cycleNumber: number): Promise<number[]> {
  const rows = await prisma.auditLog.findMany({
    where: { cycleNumber },
    orderBy: { sequenceNumber: 'asc' },
    select: { sequenceNumber: true },
  });
  return rows.map((r) => r.sequenceNumber);
}

describe('Sequence_Allocator concurrency (Spec #51)', () => {
  beforeEach(clearCycles);
  afterAll(async () => {
    await clearCycles();
  });

  it('should assign every concurrent logEvent a distinct sequence number when they target one cycle', async () => {
    const CONCURRENCY = 25;

    await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        eventLogger.logEvent(CYCLE, EventType.CYCLE_STEP_COMPLETE, { index: i }),
      ),
    );

    const sequences = await sequencesFor(CYCLE);

    expect(sequences).toHaveLength(CONCURRENCY);
    expect(new Set(sequences).size).toBe(CONCURRENCY);
  });

  it('should preserve the Gapless_Invariant under concurrent writes', async () => {
    const CONCURRENCY = 25;

    await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        eventLogger.logEvent(CYCLE, EventType.CYCLE_STEP_COMPLETE, { index: i }),
      ),
    );

    const sequences = await sequencesFor(CYCLE);

    // Exactly {1..n}: this is what checkSequenceNumbers asserts, and it is why a
    // Postgres sequence is not an acceptable implementation.
    expect(sequences).toEqual(Array.from({ length: CONCURRENCY }, (_, i) => i + 1));
  });

  it('should drop no audit row when many events are logged concurrently', async () => {
    const CONCURRENCY = 40;

    await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        eventLogger.logEvent(CYCLE, EventType.CREDIT_CHANGE, { index: i }),
      ),
    );

    const count = await prisma.auditLog.count({ where: { cycleNumber: CYCLE } });
    expect(count).toBe(CONCURRENCY);
  });

  it('should report no sequence_number_continuity issue after a concurrent write burst', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        eventLogger.logEvent(CYCLE, EventType.CYCLE_STEP_COMPLETE, { index: i }),
      ),
    );

    const service = new DataIntegrityService();
    const report = await service.validateCycleIntegrity(CYCLE);

    // Only the continuity check is under test here. The same report also carries
    // credit and event-completeness issues for a synthetic cycle, which are
    // expected and irrelevant to the Gapless_Invariant.
    expect(report.checksPerformed).toContain('sequence_number_continuity');
    expect(report.issues.filter((issue) => issue.type === 'sequence_gap')).toEqual([]);
  });

  it('should allocate a contiguous block for a batch', async () => {
    await eventLogger.logEventBatch(CYCLE, [
      { eventType: EventType.CYCLE_START, payload: { n: 1 } },
      { eventType: EventType.CYCLE_STEP_COMPLETE, payload: { n: 2 } },
      { eventType: EventType.CYCLE_COMPLETE, payload: { n: 3 } },
    ]);

    expect(await sequencesFor(CYCLE)).toEqual([1, 2, 3]);
  });

  it('should interleave batches and single events without collision', async () => {
    await Promise.all([
      eventLogger.logEventBatch(CYCLE, [
        { eventType: EventType.CYCLE_START, payload: { n: 1 } },
        { eventType: EventType.CYCLE_STEP_COMPLETE, payload: { n: 2 } },
      ]),
      eventLogger.logEvent(CYCLE, EventType.CREDIT_CHANGE, { n: 3 }),
      eventLogger.logEventBatch(CYCLE, [
        { eventType: EventType.PRESTIGE_CHANGE, payload: { n: 4 } },
        { eventType: EventType.PASSIVE_INCOME, payload: { n: 5 } },
      ]),
    ]);

    expect(await sequencesFor(CYCLE)).toEqual([1, 2, 3, 4, 5]);
  });

  it('should not serialise allocation across different cycles', async () => {
    // The lock key is the cycle number, so concurrent writers on two cycles must
    // both complete rather than one blocking the other. Each cycle numbers from 1
    // independently.
    await Promise.all([
      ...Array.from({ length: 10 }, (_, i) =>
        eventLogger.logEvent(CYCLE, EventType.CYCLE_STEP_COMPLETE, { index: i }),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        eventLogger.logEvent(OTHER_CYCLE, EventType.CYCLE_STEP_COMPLETE, { index: i }),
      ),
    ]);

    expect(await sequencesFor(CYCLE)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    expect(await sequencesFor(OTHER_CYCLE)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
  });

  it('should resume numbering from existing rows rather than restarting', async () => {
    await prisma.auditLog.create({
      data: {
        cycleNumber: CYCLE,
        eventType: EventType.CYCLE_START,
        sequenceNumber: 7,
        payload: { seeded: true },
      },
    });

    await eventLogger.logEvent(CYCLE, EventType.CYCLE_COMPLETE, { after: true });

    expect(await sequencesFor(CYCLE)).toEqual([7, 8]);
  });

  it('should reject a non-positive allocation count', async () => {
    await expect(
      withAuditSequence(CYCLE, 0, async () => undefined),
    ).rejects.toThrow(/positive integer/);
  });
});
