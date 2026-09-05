import { Prisma } from '../generated/prisma';
import prisma from '../src/lib/prisma';
import { QueryService } from '../src/services/common/queryService';
import fc from 'fast-check';

const queryService = new QueryService();

interface AuditFixture {
  cycleNumber: number;
  eventType: string;
  userId?: number;
  payload?: Record<string, unknown>;
}

/**
 * Inserts deterministic audit fixtures for query behavior tests.
 *
 * QueryService neither invokes EventLogger nor relies on advisory-lock allocation.
 * Supplying the required, contiguous per-cycle sequence numbers directly keeps these
 * properties focused on filtering, sorting, and pagination while dedicated event
 * logging and sequence suites continue to cover the gapless allocator.
 */
async function insertAuditFixtures(fixtures: readonly AuditFixture[]): Promise<void> {
  const nextSequenceByCycle = new Map<number, number>();

  await prisma.auditLog.createMany({
    data: fixtures.map((fixture, index) => {
      const sequenceNumber = nextSequenceByCycle.get(fixture.cycleNumber) ?? 1;
      nextSequenceByCycle.set(fixture.cycleNumber, sequenceNumber + 1);

      return {
        cycleNumber: fixture.cycleNumber,
        eventType: fixture.eventType,
        eventTimestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
        sequenceNumber,
        userId: fixture.userId,
        payload: (fixture.payload ?? {}) as Prisma.InputJsonObject,
      };
    }),
  });
}

/**
 * Property 5: Event Queryability
 *
 * For any combination of filters (cycle range, user ID, robot ID, event type, date range),
 * the query service should return all matching audit log entries in the specified order.
 *
 * Validates: Requirements 9.2, 9.5
 */
describe('Property 5: Event Queryability', () => {
  beforeEach(async () => {
    await prisma.auditLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('cycle range filtering returns only events within range', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 5, maxLength: 20 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        async (cycles, rangeStart, rangeEnd) => {
          await prisma.auditLog.deleteMany({});
          const [start, end] = rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];

          await insertAuditFixtures(cycles.map((cycle) => ({
            cycleNumber: cycle,
            eventType: 'cycle_start',
            payload: { triggerType: 'manual' },
          })));

          const result = await queryService.queryEvents({ cycleRange: [start, end] });

          for (const event of result.events) {
            expect(event.cycleNumber).toBeGreaterThanOrEqual(start);
            expect(event.cycleNumber).toBeLessThanOrEqual(end);
          }

          expect(result.events.length).toBe(cycles.filter((cycle) => cycle >= start && cycle <= end).length);
        },
      ),
      { numRuns: 15 },
    );
  });

  it('user filtering returns only events for that user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        fc.array(
          fc.record({
            userId: fc.integer({ min: 1, max: 20 }),
            amount: fc.integer({ min: -1000, max: 1000 }),
          }),
          { minLength: 5, maxLength: 15 },
        ),
        async (targetUserId, events) => {
          await prisma.auditLog.deleteMany({});
          await insertAuditFixtures(events.map((event) => ({
            cycleNumber: 1,
            eventType: 'credit_change',
            userId: event.userId,
            payload: { amount: event.amount, newBalance: 10000 + event.amount, source: 'battle' },
          })));

          const result = await queryService.queryEvents({ userId: targetUserId });

          for (const event of result.events) {
            expect(event.userId).toBe(targetUserId);
          }

          expect(result.events.length).toBe(events.filter((event) => event.userId === targetUserId).length);
        },
      ),
      { numRuns: 15 },
    );
  });

  it('event type filtering returns only matching types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom('cycle_start', 'cycle_complete', 'cycle_step_complete'), { minLength: 1, maxLength: 3 }),
        fc.integer({ min: 5, max: 15 }),
        async (targetTypes, numCycles) => {
          await prisma.auditLog.deleteMany({});
          const fixtures: AuditFixture[] = [];

          for (let cycle = 1; cycle <= numCycles; cycle += 1) {
            fixtures.push(
              { cycleNumber: cycle, eventType: 'cycle_start', payload: { triggerType: 'manual' } },
              { cycleNumber: cycle, eventType: 'cycle_step_complete', payload: { stepName: 'step_1', stepNumber: 1, duration: 100 } },
              { cycleNumber: cycle, eventType: 'cycle_complete', payload: { totalDuration: 100 } },
            );
          }
          await insertAuditFixtures(fixtures);

          const result = await queryService.queryEvents({ eventType: targetTypes });

          for (const event of result.events) {
            expect(targetTypes).toContain(event.eventType);
          }

          expect(result.events.length).toBe(numCycles * new Set(targetTypes).size);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('pagination returns correct subset', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 30 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 5 }),
        async (totalEvents, pageSize, pageOffset) => {
          await prisma.auditLog.deleteMany({});
          await insertAuditFixtures(Array.from({ length: totalEvents }, (_, index) => ({
            cycleNumber: index + 1,
            eventType: 'cycle_start',
            payload: { triggerType: 'manual' },
          })));

          const offset = pageOffset * pageSize;
          const result = await queryService.queryEvents({ limit: pageSize, offset });
          const expectedCount = Math.min(pageSize, Math.max(0, totalEvents - offset));

          expect(result.events.length).toBe(expectedCount);
          expect(result.hasMore).toBe(offset + result.events.length < totalEvents);
          expect(result.total).toBe(totalEvents);
        },
      ),
      { numRuns: 15 },
    );
  });

  it('sorting maintains order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 5, maxLength: 15 }),
        fc.constantFrom('asc', 'desc'),
        async (cycles, sortOrder) => {
          await prisma.auditLog.deleteMany({});
          await insertAuditFixtures(cycles.map((cycle) => ({
            cycleNumber: cycle,
            eventType: 'cycle_start',
            payload: { triggerType: 'manual' },
          })));

          const result = await queryService.queryEvents({ sortBy: 'cycle', sortOrder: sortOrder as 'asc' | 'desc' });

          for (let index = 1; index < result.events.length; index += 1) {
            const previous = result.events[index - 1].cycleNumber;
            const current = result.events[index].cycleNumber;
            if (sortOrder === 'asc') {
              expect(current).toBeGreaterThanOrEqual(previous);
            } else {
              expect(current).toBeLessThanOrEqual(previous);
            }
          }
        },
      ),
      { numRuns: 15 },
    );
  });

  it('combined filters are applied correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 6, max: 10 }),
        fc.array(
          fc.record({ cycle: fc.integer({ min: 1, max: 10 }), userId: fc.integer({ min: 1, max: 10 }) }),
          { minLength: 10, maxLength: 20 },
        ),
        async (targetUserId, rangeStart, rangeEnd, events) => {
          await prisma.auditLog.deleteMany({});
          await insertAuditFixtures(events.map((event) => ({
            cycleNumber: event.cycle,
            eventType: 'credit_change',
            userId: event.userId,
            payload: { amount: 100, newBalance: 10100, source: 'battle' },
          })));

          const result = await queryService.queryEvents({
            userId: targetUserId,
            cycleRange: [rangeStart, rangeEnd],
            eventType: ['credit_change'],
          });

          for (const event of result.events) {
            expect(event.userId).toBe(targetUserId);
            expect(event.cycleNumber).toBeGreaterThanOrEqual(rangeStart);
            expect(event.cycleNumber).toBeLessThanOrEqual(rangeEnd);
            expect(event.eventType).toBe('credit_change');
          }

          const expectedCount = events.filter((event) => (
            event.userId === targetUserId && event.cycle >= rangeStart && event.cycle <= rangeEnd
          )).length;
          expect(result.events.length).toBe(expectedCount);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('empty result set handled correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 100, max: 200 }),
        async (existingCycle, nonExistentCycle) => {
          await prisma.auditLog.deleteMany({});
          await insertAuditFixtures([{
            cycleNumber: existingCycle,
            eventType: 'cycle_start',
            payload: { triggerType: 'manual' },
          }]);

          const result = await queryService.queryEvents({ cycleNumber: nonExistentCycle });
          expect(result.events).toHaveLength(0);
          expect(result.total).toBe(0);
          expect(result.hasMore).toBe(false);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('count matches filtered results', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({ cycle: fc.integer({ min: 1, max: 20 }), userId: fc.integer({ min: 1, max: 10 }) }),
          { minLength: 10, maxLength: 30 },
        ),
        fc.integer({ min: 1, max: 10 }),
        async (events, targetUserId) => {
          await prisma.auditLog.deleteMany({});
          await insertAuditFixtures(events.map((event) => ({
            cycleNumber: event.cycle,
            eventType: 'credit_change',
            userId: event.userId,
            payload: { amount: 100, newBalance: 10100, source: 'battle' },
          })));

          const result = await queryService.queryEvents({ userId: targetUserId });
          const count = await queryService.countEvents({ userId: targetUserId });

          expect(count).toBe(result.total);
          expect(count).toBe(result.events.length);
        },
      ),
      { numRuns: 25 },
    );
  });
});
