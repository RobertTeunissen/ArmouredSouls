/**
 * Integration test for EventLogger service
 * 
 * Tests the EventLogger with actual database operations
 */

import prisma from '../src/lib/prisma';
import { eventLogger, EventType } from '../src/services/eventLogger';

describe('EventLogger Integration', () => {
  beforeEach(async () => {
    // Clean up audit logs before each test
    await prisma.auditLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should successfully log events to the database', async () => {
    const cycleNumber = 1;

    // Log a cycle start event
    await eventLogger.logCycleStart(cycleNumber, 'manual');

    // Log a facility transaction
    await eventLogger.logFacilityTransaction(
      cycleNumber,
      1,
      'training_academy',
      0,
      1,
      10000,
      'purchase'
    );

    // Log passive income
    await eventLogger.logPassiveIncome(
      cycleNumber,
      1,
      5000,
      3000,
      5,
      1000,
      50,
      200
    );

    // Log cycle complete
    await eventLogger.logCycleComplete(cycleNumber, 5000);

    // Verify all events were logged
    const events = await prisma.auditLog.findMany({
      where: { cycleNumber },
      orderBy: { sequenceNumber: 'asc' },
    });

    expect(events).toHaveLength(4);
    expect(events[0].eventType).toBe(EventType.CYCLE_START);
    expect(events[1].eventType).toBe(EventType.FACILITY_PURCHASE);
    expect(events[2].eventType).toBe(EventType.PASSIVE_INCOME);
    expect(events[3].eventType).toBe(EventType.CYCLE_COMPLETE);

    // Verify sequence numbers are correct
    expect(events[0].sequenceNumber).toBe(1);
    expect(events[1].sequenceNumber).toBe(2);
    expect(events[2].sequenceNumber).toBe(3);
    expect(events[3].sequenceNumber).toBe(4);
  });

  it('should handle batch logging efficiently', async () => {
    const cycleNumber = 2;
    const batchSize = 100;

    const events = Array.from({ length: batchSize }, (_, i) => ({
      eventType: EventType.CREDIT_CHANGE,
      payload: {
        amount: i * 100,
        newBalance: 10000 + i * 100,
        source: 'battle',
      },
      userId: 1,
    }));

    const startTime = Date.now();
    await eventLogger.logEventBatch(cycleNumber, events);
    const duration = Date.now() - startTime;

    // Verify all events were logged
    const storedEvents = await prisma.auditLog.findMany({
      where: { cycleNumber },
    });

    expect(storedEvents).toHaveLength(batchSize);
    
    // Batch insert should be fast (< 1 second for 100 events)
    expect(duration).toBeLessThan(1000);
  });
});
