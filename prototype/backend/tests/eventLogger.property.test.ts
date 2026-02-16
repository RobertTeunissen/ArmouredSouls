/**
 * Property-Based Tests for EventLogger Service
 * 
 * Tests universal properties that should hold across all valid inputs
 * Uses fast-check for property-based testing
 */

import { PrismaClient } from '@prisma/client';
import fc from 'fast-check';
import { EventLogger, EventType, clearSequenceCache } from '../src/services/eventLogger';

const prisma = new PrismaClient();
const eventLogger = new EventLogger();

describe('EventLogger Property-Based Tests', () => {
  beforeEach(async () => {
    // Clean up audit logs before each test
    await prisma.auditLog.deleteMany({});
    // Clear sequence cache
    for (let i = 1; i <= 100; i++) {
      clearSequenceCache(i);
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Property 1: Event Logging Completeness
   * 
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**
   * 
   * For any cycle execution, all events that occur during the cycle should have 
   * corresponding audit log entries with complete payload data.
   */
  describe('Property 1: Event Logging Completeness', () => {
    it('should log all events with complete payload data', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate cycle number
          fc.integer({ min: 1, max: 100 }),
          // Generate array of events with various types
          fc.array(
            fc.record({
              eventType: fc.constantFrom(
                EventType.BATTLE_COMPLETE,
                EventType.ROBOT_REPAIR,
                EventType.ROBOT_ATTRIBUTE_UPGRADE,
                EventType.ROBOT_LEAGUE_CHANGE,
                EventType.CREDIT_CHANGE,
                EventType.PRESTIGE_CHANGE,
                EventType.PASSIVE_INCOME,
                EventType.OPERATING_COSTS,
                EventType.FACILITY_PURCHASE,
                EventType.FACILITY_UPGRADE,
                EventType.WEAPON_PURCHASE,
                EventType.WEAPON_SALE,
                EventType.TOURNAMENT_MATCH,
                EventType.TOURNAMENT_COMPLETE,
                EventType.TAG_TEAM_BATTLE,
                EventType.CYCLE_START,
                EventType.CYCLE_STEP_COMPLETE,
                EventType.CYCLE_COMPLETE
              ),
              payload: fc.record({
                // Generate various payload fields
                amount: fc.option(fc.integer({ min: -100000, max: 100000 })),
                cost: fc.option(fc.integer({ min: 0, max: 100000 })),
                oldValue: fc.option(fc.float({ min: 0, max: 100 })),
                newValue: fc.option(fc.float({ min: 0, max: 100 })),
                facilityType: fc.option(fc.constantFrom('training_academy', 'repair_bay', 'income_generator')),
                robotId: fc.option(fc.integer({ min: 1, max: 1000 })),
                userId: fc.option(fc.integer({ min: 1, max: 100 })),
                damage: fc.option(fc.integer({ min: 0, max: 10000 })),
                eloChange: fc.option(fc.integer({ min: -100, max: 100 })),
                fameChange: fc.option(fc.integer({ min: 0, max: 1000 })),
              }),
              userId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
              robotId: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          async (cycleNumber, events) => {
            // Clear any existing data for this cycle
            await prisma.auditLog.deleteMany({ where: { cycleNumber } });
            clearSequenceCache(cycleNumber);

            // Log all events
            await eventLogger.logEventBatch(
              cycleNumber,
              events.map(e => ({
                eventType: e.eventType,
                payload: e.payload,
                userId: e.userId,
                robotId: e.robotId,
              }))
            );

            // Retrieve logged events
            const loggedEvents = await prisma.auditLog.findMany({
              where: { cycleNumber },
              orderBy: { sequenceNumber: 'asc' },
            });

            // Property: All events should be logged
            expect(loggedEvents.length).toBe(events.length);

            // Property: Each event should have complete data
            for (let i = 0; i < events.length; i++) {
              const original = events[i];
              const logged = loggedEvents[i];

              // Verify event type matches
              expect(logged.eventType).toBe(original.eventType);

              // Verify payload is complete (not null/undefined)
              expect(logged.payload).toBeDefined();
              expect(logged.payload).not.toBeNull();
              expect(typeof logged.payload).toBe('object');

              // Verify userId and robotId are preserved
              expect(logged.userId).toBe(original.userId);
              expect(logged.robotId).toBe(original.robotId);

              // Verify sequence number is assigned
              expect(logged.sequenceNumber).toBe(i + 1);

              // Verify cycle number matches
              expect(logged.cycleNumber).toBe(cycleNumber);

              // Verify timestamp is present
              expect(logged.eventTimestamp).toBeDefined();
              expect(logged.eventTimestamp).toBeInstanceOf(Date);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all payload fields without data loss', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          fc.record({
            // Generate complex payload with nested structures
            simpleField: fc.string(),
            numericField: fc.integer(),
            // Use integers instead of floats to avoid precision issues with JSONB
            integerField: fc.integer(),
            booleanField: fc.boolean(),
            arrayField: fc.array(fc.integer(), { maxLength: 10 }),
            nestedObject: fc.record({
              nested1: fc.string(),
              nested2: fc.integer(),
            }),
          }),
          async (cycleNumber, payload) => {
            // Clear any existing data for this cycle
            await prisma.auditLog.deleteMany({ where: { cycleNumber } });
            clearSequenceCache(cycleNumber);

            // Log event with complex payload
            await eventLogger.logEvent(
              cycleNumber,
              EventType.CREDIT_CHANGE,
              payload
            );

            // Retrieve logged event
            const loggedEvent = await prisma.auditLog.findFirst({
              where: { cycleNumber },
            });

            // Property: All payload fields should be preserved exactly
            expect(loggedEvent).not.toBeNull();
            expect(loggedEvent!.payload).toEqual(payload);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle sequential event logging without data loss', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          fc.array(
            fc.record({
              eventType: fc.constantFrom(
                EventType.CREDIT_CHANGE,
                EventType.PRESTIGE_CHANGE,
                EventType.PASSIVE_INCOME
              ),
              payload: fc.record({
                amount: fc.integer({ min: 0, max: 10000 }),
              }),
              userId: fc.integer({ min: 1, max: 100 }),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          async (cycleNumber, events) => {
            // Clear any existing data for this cycle
            await prisma.auditLog.deleteMany({ where: { cycleNumber } });
            clearSequenceCache(cycleNumber);

            // Log events sequentially (realistic for cycle execution)
            for (const e of events) {
              await eventLogger.logEvent(
                cycleNumber,
                e.eventType,
                e.payload,
                { userId: e.userId }
              );
            }

            // Retrieve logged events
            const loggedEvents = await prisma.auditLog.findMany({
              where: { cycleNumber },
              orderBy: { sequenceNumber: 'asc' },
            });

            // Property: All events should be logged (no data loss)
            expect(loggedEvents.length).toBe(events.length);

            // Property: Sequence numbers should be unique and continuous
            const sequenceNumbers = loggedEvents.map(e => e.sequenceNumber);
            const uniqueSequences = new Set(sequenceNumbers);
            expect(uniqueSequences.size).toBe(events.length);

            // Verify sequence numbers are continuous (1, 2, 3, ...)
            for (let i = 0; i < loggedEvents.length; i++) {
              expect(sequenceNumbers).toContain(i + 1);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should log events for different event types with appropriate payloads', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }), // userId
          fc.integer({ min: 1, max: 1000 }), // robotId
          async (cycleNumber, userId, robotId) => {
            // Clear any existing data for this cycle
            await prisma.auditLog.deleteMany({ where: { cycleNumber } });
            clearSequenceCache(cycleNumber);

            // Log various event types that represent a cycle execution (sequentially)
            await eventLogger.logCycleStart(cycleNumber, 'manual');
            
            await eventLogger.logFacilityTransaction(
              cycleNumber,
              userId,
              'training_academy',
              0,
              1,
              10000,
              'purchase'
            );
            
            await eventLogger.logPassiveIncome(
              cycleNumber,
              userId,
              5000,
              3000,
              5,
              1000,
              50,
              200
            );
            
            await eventLogger.logOperatingCosts(
              cycleNumber,
              userId,
              [{ facilityType: 'training_academy', level: 1, cost: 500 }],
              500
            );
            
            await eventLogger.logCreditChange(
              cycleNumber,
              userId,
              1000,
              50000,
              'battle'
            );
            
            await eventLogger.logPrestigeChange(
              cycleNumber,
              userId,
              50,
              1050,
              'battle_victory'
            );
            
            await eventLogger.logWeaponPurchase(cycleNumber, userId, 5, 2000);
            
            await eventLogger.logAttributeUpgrade(
              cycleNumber,
              robotId,
              'combatPower',
              10.5,
              11.5,
              5000
            );
            
            await eventLogger.logCycleStepComplete(
              cycleNumber,
              'repair_robots',
              1,
              1500,
              { robotsRepaired: 5 }
            );
            
            await eventLogger.logCycleComplete(cycleNumber, 5000);
            
            const expectedEventCount = 10;

            // Retrieve logged events
            const loggedEvents = await prisma.auditLog.findMany({
              where: { cycleNumber },
              orderBy: { sequenceNumber: 'asc' },
            });

            // Property: All event types should be logged
            expect(loggedEvents.length).toBe(expectedEventCount);

            // Property: Each event should have the correct event type
            const eventTypes = loggedEvents.map(e => e.eventType);
            expect(eventTypes).toContain(EventType.CYCLE_START);
            expect(eventTypes).toContain(EventType.FACILITY_PURCHASE);
            expect(eventTypes).toContain(EventType.PASSIVE_INCOME);
            expect(eventTypes).toContain(EventType.OPERATING_COSTS);
            expect(eventTypes).toContain(EventType.CREDIT_CHANGE);
            expect(eventTypes).toContain(EventType.PRESTIGE_CHANGE);
            expect(eventTypes).toContain(EventType.WEAPON_PURCHASE);
            expect(eventTypes).toContain(EventType.ROBOT_ATTRIBUTE_UPGRADE);
            expect(eventTypes).toContain(EventType.CYCLE_STEP_COMPLETE);
            expect(eventTypes).toContain(EventType.CYCLE_COMPLETE);

            // Property: Events with userId should have correct userId
            const userEvents = loggedEvents.filter(e => e.userId !== null);
            userEvents.forEach(e => {
              expect(e.userId).toBe(userId);
            });

            // Property: Events with robotId should have correct robotId
            const robotEvents = loggedEvents.filter(e => e.robotId !== null);
            robotEvents.forEach(e => {
              expect(e.robotId).toBe(robotId);
            });

            // Property: All payloads should be non-null objects
            loggedEvents.forEach(e => {
              expect(e.payload).toBeDefined();
              expect(e.payload).not.toBeNull();
              expect(typeof e.payload).toBe('object');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Event Metadata Consistency
   * 
   * **Validates: Requirements 9.3, 15.1, 15.2, 15.3**
   * 
   * For any logged event, the audit log entry should contain a timestamp, cycle number, 
   * and sequence number, where sequence numbers are unique and monotonically increasing 
   * within each cycle.
   */
  describe('Property 2: Event Metadata Consistency', () => {
    it('should ensure all events have timestamp, cycle number, and sequence number', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // cycleNumber
          fc.array(
            fc.record({
              eventType: fc.constantFrom(
                EventType.BATTLE_COMPLETE,
                EventType.CREDIT_CHANGE,
                EventType.PASSIVE_INCOME,
                EventType.FACILITY_PURCHASE,
                EventType.CYCLE_START,
                EventType.CYCLE_COMPLETE
              ),
              payload: fc.record({
                value: fc.integer({ min: 0, max: 10000 }),
              }),
              userId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
            }),
            { minLength: 1, maxLength: 30 }
          ),
          async (cycleNumber, events) => {
            // Clear any existing data for this cycle
            await prisma.auditLog.deleteMany({ where: { cycleNumber } });
            clearSequenceCache(cycleNumber);

            // Log all events
            for (const e of events) {
              await eventLogger.logEvent(
                cycleNumber,
                e.eventType,
                e.payload,
                { userId: e.userId ?? undefined }
              );
            }

            // Retrieve logged events
            const loggedEvents = await prisma.auditLog.findMany({
              where: { cycleNumber },
              orderBy: { sequenceNumber: 'asc' },
            });

            // Property: All events should have timestamp
            for (const event of loggedEvents) {
              expect(event.eventTimestamp).toBeDefined();
              expect(event.eventTimestamp).toBeInstanceOf(Date);
              expect(event.eventTimestamp.getTime()).toBeGreaterThan(0);
            }

            // Property: All events should have cycle number
            for (const event of loggedEvents) {
              expect(event.cycleNumber).toBe(cycleNumber);
              expect(event.cycleNumber).toBeGreaterThan(0);
            }

            // Property: All events should have sequence number
            for (const event of loggedEvents) {
              expect(event.sequenceNumber).toBeDefined();
              expect(event.sequenceNumber).toBeGreaterThan(0);
            }

            // Property: Sequence numbers should be unique within cycle
            const sequenceNumbers = loggedEvents.map(e => e.sequenceNumber);
            const uniqueSequences = new Set(sequenceNumbers);
            expect(uniqueSequences.size).toBe(loggedEvents.length);

            // Property: Sequence numbers should be monotonically increasing (1, 2, 3, ...)
            for (let i = 0; i < loggedEvents.length; i++) {
              expect(loggedEvents[i].sequenceNumber).toBe(i + 1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain sequence number uniqueness across concurrent logging', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // cycleNumber
          fc.array(
            fc.record({
              eventType: fc.constantFrom(
                EventType.CREDIT_CHANGE,
                EventType.PRESTIGE_CHANGE,
                EventType.PASSIVE_INCOME
              ),
              payload: fc.record({
                amount: fc.integer({ min: 0, max: 10000 }),
              }),
              userId: fc.integer({ min: 1, max: 100 }),
            }),
            { minLength: 5, maxLength: 15 }
          ),
          async (cycleNumber, events) => {
            // Clear any existing data for this cycle
            await prisma.auditLog.deleteMany({ where: { cycleNumber } });
            clearSequenceCache(cycleNumber);

            // Log events concurrently (simulates race conditions)
            await Promise.all(
              events.map(e =>
                eventLogger.logEvent(
                  cycleNumber,
                  e.eventType,
                  e.payload,
                  { userId: e.userId }
                )
              )
            );

            // Retrieve logged events
            const loggedEvents = await prisma.auditLog.findMany({
              where: { cycleNumber },
              orderBy: { sequenceNumber: 'asc' },
            });

            // Property: All events should be logged
            expect(loggedEvents.length).toBe(events.length);

            // Property: Sequence numbers should be unique (no duplicates from race conditions)
            const sequenceNumbers = loggedEvents.map(e => e.sequenceNumber);
            const uniqueSequences = new Set(sequenceNumbers);
            expect(uniqueSequences.size).toBe(events.length);

            // Property: Sequence numbers should form a continuous range
            const sortedSequences = [...sequenceNumbers].sort((a, b) => a - b);
            for (let i = 0; i < sortedSequences.length; i++) {
              expect(sortedSequences[i]).toBe(i + 1);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain separate sequence number sequences per cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 2, maxLength: 5 }), // multiple cycle numbers
          fc.array(
            fc.record({
              eventType: fc.constantFrom(
                EventType.CYCLE_START,
                EventType.CREDIT_CHANGE,
                EventType.CYCLE_COMPLETE
              ),
              payload: fc.record({
                value: fc.integer({ min: 0, max: 1000 }),
              }),
            }),
            { minLength: 3, maxLength: 10 }
          ),
          async (cycleNumbers, eventTemplates) => {
            // Use unique cycle numbers
            const uniqueCycles = [...new Set(cycleNumbers)];
            
            // Clear any existing data for these cycles
            await prisma.auditLog.deleteMany({
              where: { cycleNumber: { in: uniqueCycles } },
            });
            uniqueCycles.forEach(c => clearSequenceCache(c));

            // Log events for each cycle
            for (const cycleNumber of uniqueCycles) {
              for (const template of eventTemplates) {
                await eventLogger.logEvent(
                  cycleNumber,
                  template.eventType,
                  template.payload
                );
              }
            }

            // Verify each cycle has its own sequence starting from 1
            for (const cycleNumber of uniqueCycles) {
              const cycleEvents = await prisma.auditLog.findMany({
                where: { cycleNumber },
                orderBy: { sequenceNumber: 'asc' },
              });

              // Property: Each cycle should have the same number of events
              expect(cycleEvents.length).toBe(eventTemplates.length);

              // Property: Each cycle's sequence should start at 1
              expect(cycleEvents[0].sequenceNumber).toBe(1);

              // Property: Sequence numbers should be continuous within each cycle
              for (let i = 0; i < cycleEvents.length; i++) {
                expect(cycleEvents[i].sequenceNumber).toBe(i + 1);
              }

              // Property: All events should have the correct cycle number
              for (const event of cycleEvents) {
                expect(event.cycleNumber).toBe(cycleNumber);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should preserve timestamp ordering relative to sequence numbers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // cycleNumber
          fc.array(
            fc.record({
              eventType: fc.constantFrom(
                EventType.CYCLE_START,
                EventType.CYCLE_STEP_COMPLETE,
                EventType.CYCLE_COMPLETE
              ),
              payload: fc.record({
                step: fc.integer({ min: 1, max: 10 }),
              }),
            }),
            { minLength: 3, maxLength: 10 }
          ),
          async (cycleNumber, events) => {
            // Clear any existing data for this cycle
            await prisma.auditLog.deleteMany({ where: { cycleNumber } });
            clearSequenceCache(cycleNumber);

            // Log events sequentially with small delays to ensure timestamp ordering
            for (const e of events) {
              await eventLogger.logEvent(cycleNumber, e.eventType, e.payload);
              // Small delay to ensure timestamps are different
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            // Retrieve logged events
            const loggedEvents = await prisma.auditLog.findMany({
              where: { cycleNumber },
              orderBy: { sequenceNumber: 'asc' },
            });

            // Property: Timestamps should be in ascending order (or equal)
            for (let i = 1; i < loggedEvents.length; i++) {
              const prevTimestamp = loggedEvents[i - 1].eventTimestamp.getTime();
              const currTimestamp = loggedEvents[i].eventTimestamp.getTime();
              expect(currTimestamp).toBeGreaterThanOrEqual(prevTimestamp);
            }

            // Property: Sequence numbers should match insertion order
            for (let i = 0; i < loggedEvents.length; i++) {
              expect(loggedEvents[i].sequenceNumber).toBe(i + 1);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle batch logging with consistent metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // cycleNumber
          fc.array(
            fc.record({
              eventType: fc.constantFrom(
                EventType.CREDIT_CHANGE,
                EventType.PRESTIGE_CHANGE,
                EventType.PASSIVE_INCOME,
                EventType.OPERATING_COSTS
              ),
              payload: fc.record({
                amount: fc.integer({ min: 0, max: 10000 }),
              }),
              userId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          async (cycleNumber, events) => {
            // Clear any existing data for this cycle
            await prisma.auditLog.deleteMany({ where: { cycleNumber } });
            clearSequenceCache(cycleNumber);

            // Log events in batch
            await eventLogger.logEventBatch(
              cycleNumber,
              events.map(e => ({
                eventType: e.eventType,
                payload: e.payload,
                userId: e.userId,
              }))
            );

            // Retrieve logged events
            const loggedEvents = await prisma.auditLog.findMany({
              where: { cycleNumber },
              orderBy: { sequenceNumber: 'asc' },
            });

            // Property: All events should be logged
            expect(loggedEvents.length).toBe(events.length);

            // Property: All events should have timestamps
            for (const event of loggedEvents) {
              expect(event.eventTimestamp).toBeDefined();
              expect(event.eventTimestamp).toBeInstanceOf(Date);
            }

            // Property: All events should have correct cycle number
            for (const event of loggedEvents) {
              expect(event.cycleNumber).toBe(cycleNumber);
            }

            // Property: Sequence numbers should be unique and continuous
            const sequenceNumbers = loggedEvents.map(e => e.sequenceNumber);
            const uniqueSequences = new Set(sequenceNumbers);
            expect(uniqueSequences.size).toBe(events.length);

            for (let i = 0; i < loggedEvents.length; i++) {
              expect(loggedEvents[i].sequenceNumber).toBe(i + 1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
