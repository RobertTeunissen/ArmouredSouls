import { PrismaClient } from '@prisma/client';
import { QueryService } from '../src/services/queryService';
import { EventLogger } from '../src/services/eventLogger';
import fc from 'fast-check';

const prisma = new PrismaClient();
const queryService = new QueryService();
const eventLogger = new EventLogger();

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
    // Clean up test data
    await prisma.auditLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Property 5.1: Cycle range filtering returns only events within range
   * 
   * For any cycle range, only events within that range should be returned.
   */
  it('cycle range filtering returns only events within range', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.integer({ min: 1, max: 50 }),
          { minLength: 5, maxLength: 20 }
        ),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        async (cycles, rangeStart, rangeEnd) => {
          // Cleanup for this iteration
          await prisma.auditLog.deleteMany({});

          // Ensure rangeStart <= rangeEnd
          const [start, end] = rangeStart <= rangeEnd 
            ? [rangeStart, rangeEnd] 
            : [rangeEnd, rangeStart];

          // Create events in various cycles
          for (const cycle of cycles) {
            await eventLogger.logCycleStart(cycle, 'manual');
          }

          // Query events in range
          const result = await queryService.queryEvents({
            cycleRange: [start, end],
          });

          // Verify all returned events are within range
          for (const event of result.events) {
            expect(event.cycleNumber).toBeGreaterThanOrEqual(start);
            expect(event.cycleNumber).toBeLessThanOrEqual(end);
          }

          // Verify count matches
          const expectedCount = cycles.filter(c => c >= start && c <= end).length;
          expect(result.events.length).toBe(expectedCount);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 5.2: User filtering returns only events for that user
   * 
   * For any user ID, only events associated with that user should be returned.
   */
  it('user filtering returns only events for that user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        fc.array(
          fc.record({
            userId: fc.integer({ min: 1, max: 20 }),
            amount: fc.integer({ min: -1000, max: 1000 }),
          }),
          { minLength: 5, maxLength: 15 }
        ),
        async (targetUserId, events) => {
          // Cleanup for this iteration
          await prisma.auditLog.deleteMany({});

          // Create events for various users
          for (const event of events) {
            await eventLogger.logCreditChange(
              1,
              event.userId,
              event.amount,
              10000 + event.amount,
              'battle'
            );
          }

          // Query events for target user
          const result = await queryService.queryEvents({
            userId: targetUserId,
          });

          // Verify all returned events belong to target user
          for (const event of result.events) {
            expect(event.userId).toBe(targetUserId);
          }

          // Verify count matches
          const expectedCount = events.filter(e => e.userId === targetUserId).length;
          expect(result.events.length).toBe(expectedCount);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 5.3: Event type filtering returns only matching types
   * 
   * For any set of event types, only events of those types should be returned.
   */
  it('event type filtering returns only matching types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom('cycle_start', 'cycle_complete', 'cycle_step_complete'),
          { minLength: 1, maxLength: 3 }
        ),
        fc.integer({ min: 5, max: 15 }),
        async (targetTypes, numCycles) => {
          // Cleanup for this iteration
          await prisma.auditLog.deleteMany({});

          // Create various event types
          let expectedCount = 0;
          for (let i = 1; i <= numCycles; i++) {
            await eventLogger.logCycleStart(i, 'manual');
            if (targetTypes.includes('cycle_start')) expectedCount++;

            await eventLogger.logCycleStepComplete(i, 'step_1', 1, 100);
            if (targetTypes.includes('cycle_step_complete')) expectedCount++;

            await eventLogger.logCycleComplete(i, 100);
            if (targetTypes.includes('cycle_complete')) expectedCount++;
          }

          // Query events by type
          const result = await queryService.queryEvents({
            eventType: targetTypes,
          });

          // Verify all returned events match target types
          for (const event of result.events) {
            expect(targetTypes).toContain(event.eventType);
          }

          // Verify count matches
          expect(result.events.length).toBe(expectedCount);
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property 5.4: Pagination returns correct subset
   * 
   * For any pagination parameters, the correct subset of events should be returned.
   */
  it('pagination returns correct subset', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 30 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 5 }),
        async (totalEvents, pageSize, pageOffset) => {
          // Cleanup for this iteration
          await prisma.auditLog.deleteMany({});

          // Create events
          for (let i = 1; i <= totalEvents; i++) {
            await eventLogger.logCycleStart(i, 'manual');
          }

          // Query with pagination
          const offset = pageOffset * pageSize;
          const result = await queryService.queryEvents({
            limit: pageSize,
            offset,
          });

          // Verify correct number of events returned
          const expectedCount = Math.min(pageSize, Math.max(0, totalEvents - offset));
          expect(result.events.length).toBe(expectedCount);

          // Verify hasMore flag
          const expectedHasMore = offset + result.events.length < totalEvents;
          expect(result.hasMore).toBe(expectedHasMore);

          // Verify total count
          expect(result.total).toBe(totalEvents);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 5.5: Sorting maintains order
   * 
   * For any sort order, events should be returned in that order.
   */
  it('sorting maintains order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.integer({ min: 1, max: 20 }),
          { minLength: 5, maxLength: 15 }
        ),
        fc.constantFrom('asc', 'desc'),
        async (cycles, sortOrder) => {
          // Cleanup for this iteration
          await prisma.auditLog.deleteMany({});

          // Create events in random cycle order
          for (const cycle of cycles) {
            await eventLogger.logCycleStart(cycle, 'manual');
          }

          // Query with sorting
          const result = await queryService.queryEvents({
            sortBy: 'cycle',
            sortOrder: sortOrder as 'asc' | 'desc',
          });

          // Verify order
          for (let i = 1; i < result.events.length; i++) {
            const prev = result.events[i - 1].cycleNumber;
            const curr = result.events[i].cycleNumber;

            if (sortOrder === 'asc') {
              expect(curr).toBeGreaterThanOrEqual(prev);
            } else {
              expect(curr).toBeLessThanOrEqual(prev);
            }
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 5.6: Combined filters are applied correctly
   * 
   * For any combination of filters, all filters should be applied.
   */
  it('combined filters are applied correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 6, max: 10 }),
        fc.array(
          fc.record({
            cycle: fc.integer({ min: 1, max: 10 }),
            userId: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 10, maxLength: 20 }
        ),
        async (targetUserId, rangeStart, rangeEnd, events) => {
          // Cleanup for this iteration
          await prisma.auditLog.deleteMany({});

          // Create events
          for (const event of events) {
            await eventLogger.logCreditChange(
              event.cycle,
              event.userId,
              100,
              10100,
              'battle'
            );
          }

          // Query with combined filters
          const result = await queryService.queryEvents({
            userId: targetUserId,
            cycleRange: [rangeStart, rangeEnd],
            eventType: ['credit_change'],
          });

          // Verify all filters are applied
          for (const event of result.events) {
            expect(event.userId).toBe(targetUserId);
            expect(event.cycleNumber).toBeGreaterThanOrEqual(rangeStart);
            expect(event.cycleNumber).toBeLessThanOrEqual(rangeEnd);
            expect(event.eventType).toBe('credit_change');
          }

          // Verify count matches
          const expectedCount = events.filter(
            e =>
              e.userId === targetUserId &&
              e.cycle >= rangeStart &&
              e.cycle <= rangeEnd
          ).length;
          expect(result.events.length).toBe(expectedCount);
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property 5.7: Empty result set handled correctly
   * 
   * For any filters that match no events, an empty result should be returned.
   */
  it('empty result set handled correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 100, max: 200 }),
        async (existingCycle, nonExistentCycle) => {
          // Cleanup for this iteration
          await prisma.auditLog.deleteMany({});

          // Create events in one cycle
          await eventLogger.logCycleStart(existingCycle, 'manual');

          // Query for non-existent cycle
          const result = await queryService.queryEvents({
            cycleNumber: nonExistentCycle,
          });

          // Verify empty result
          expect(result.events).toHaveLength(0);
          expect(result.total).toBe(0);
          expect(result.hasMore).toBe(false);
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property 5.8: Count matches filtered results
   * 
   * For any filters, the count should match the number of filtered events.
   */
  it('count matches filtered results', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            cycle: fc.integer({ min: 1, max: 20 }),
            userId: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 10, maxLength: 30 }
        ),
        fc.integer({ min: 1, max: 10 }),
        async (events, targetUserId) => {
          // Cleanup for this iteration
          await prisma.auditLog.deleteMany({});

          // Create events
          for (const event of events) {
            await eventLogger.logCreditChange(
              event.cycle,
              event.userId,
              100,
              10100,
              'battle'
            );
          }

          // Query with filters
          const result = await queryService.queryEvents({
            userId: targetUserId,
          });

          // Count with same filters
          const count = await queryService.countEvents({
            userId: targetUserId,
          });

          // Verify count matches
          expect(count).toBe(result.total);
          expect(count).toBe(result.events.length);
        }
      ),
      { numRuns: 25 }
    );
  });
});
