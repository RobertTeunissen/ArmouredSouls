/**
 * Unit tests for Facility Transaction Logging
 * 
 * Tests that facility purchases and upgrades are logged to the audit log
 * 
 * Requirements: 1.6, 5.1
 */

import { eventLogger } from '../src/services/eventLogger';
import prisma from '../src/lib/prisma';

describe('Facility Transaction Logging', () => {
  const testUserId = 1;
  const testFacilityType = 'training_facility';
  const testCycleNumber = 1;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await prisma.auditLog.deleteMany({
      where: {
        userId: testUserId,
        eventType: { in: ['facility_purchase', 'facility_upgrade'] },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should log facility_purchase event when purchasing a new facility', async () => {
    // Log a facility purchase (level 0 -> 1)
    await eventLogger.logFacilityTransaction(
      testCycleNumber,
      testUserId,
      testFacilityType,
      0, // oldLevel
      1, // newLevel
      5000, // cost
      'purchase'
    );

    // Check that event was logged
    const events = await prisma.auditLog.findMany({
      where: {
        userId: testUserId,
        eventType: 'facility_purchase',
        cycleNumber: testCycleNumber,
      },
      orderBy: { eventTimestamp: 'desc' },
      take: 1,
    });

    expect(events.length).toBe(1);
    const event = events[0];
    
    expect(event.eventType).toBe('facility_purchase');
    expect(event.userId).toBe(testUserId);
    expect(event.cycleNumber).toBe(testCycleNumber);
    
    const payload = event.payload as any;
    expect(payload.facilityType).toBe(testFacilityType);
    expect(payload.oldLevel).toBe(0);
    expect(payload.newLevel).toBe(1);
    expect(payload.cost).toBe(5000);
    expect(payload.action).toBe('purchase');
  });

  it('should log facility_upgrade event when upgrading an existing facility', async () => {
    // Log a facility upgrade (level 1 -> 2)
    await eventLogger.logFacilityTransaction(
      testCycleNumber,
      testUserId,
      testFacilityType,
      1, // oldLevel
      2, // newLevel
      10000, // cost
      'upgrade'
    );

    // Check that event was logged
    const events = await prisma.auditLog.findMany({
      where: {
        userId: testUserId,
        eventType: 'facility_upgrade',
        cycleNumber: testCycleNumber,
      },
      orderBy: { eventTimestamp: 'desc' },
      take: 1,
    });

    expect(events.length).toBe(1);
    const event = events[0];
    
    expect(event.eventType).toBe('facility_upgrade');
    expect(event.userId).toBe(testUserId);
    expect(event.cycleNumber).toBe(testCycleNumber);
    
    const payload = event.payload as any;
    expect(payload.facilityType).toBe(testFacilityType);
    expect(payload.oldLevel).toBe(1);
    expect(payload.newLevel).toBe(2);
    expect(payload.cost).toBe(10000);
    expect(payload.action).toBe('upgrade');
  });

  it('should include all required fields in the event payload', async () => {
    // Log a facility transaction
    await eventLogger.logFacilityTransaction(
      testCycleNumber,
      testUserId,
      'repair_bay',
      2, // oldLevel
      3, // newLevel
      15000, // cost
      'upgrade'
    );

    // Get the logged event
    const events = await prisma.auditLog.findMany({
      where: {
        userId: testUserId,
        eventType: 'facility_upgrade',
        cycleNumber: testCycleNumber,
      },
      orderBy: { eventTimestamp: 'desc' },
      take: 1,
    });

    expect(events.length).toBe(1);
    const payload = events[0].payload as any;
    
    // Verify all required fields are present
    expect(payload).toHaveProperty('facilityType');
    expect(payload).toHaveProperty('oldLevel');
    expect(payload).toHaveProperty('newLevel');
    expect(payload).toHaveProperty('cost');
    expect(payload).toHaveProperty('action');
    
    // Verify cost is a positive number
    expect(payload.cost).toBeGreaterThan(0);
    expect(typeof payload.cost).toBe('number');
  });

  it('should log events with correct cycle number', async () => {
    const differentCycle = 5;
    
    // Log event in a different cycle
    await eventLogger.logFacilityTransaction(
      differentCycle,
      testUserId,
      testFacilityType,
      3, // oldLevel
      4, // newLevel
      20000, // cost
      'upgrade'
    );

    // Check that event has correct cycle number
    const events = await prisma.auditLog.findMany({
      where: {
        userId: testUserId,
        eventType: 'facility_upgrade',
        cycleNumber: differentCycle,
      },
      orderBy: { eventTimestamp: 'desc' },
      take: 1,
    });

    expect(events.length).toBe(1);
    expect(events[0].cycleNumber).toBe(differentCycle);
  });

  it('should distinguish between purchase and upgrade events', async () => {
    // Log both types of events
    await eventLogger.logFacilityTransaction(
      testCycleNumber,
      testUserId,
      'income_generator',
      0, // oldLevel
      1, // newLevel
      5000, // cost
      'purchase'
    );

    await eventLogger.logFacilityTransaction(
      testCycleNumber,
      testUserId,
      'income_generator',
      1, // oldLevel
      2, // newLevel
      10000, // cost
      'upgrade'
    );

    // Check purchase event
    const purchaseEvents = await prisma.auditLog.findMany({
      where: {
        userId: testUserId,
        eventType: 'facility_purchase',
        cycleNumber: testCycleNumber,
      },
    });

    expect(purchaseEvents.length).toBeGreaterThan(0);
    expect(purchaseEvents[purchaseEvents.length - 1].eventType).toBe('facility_purchase');

    // Check upgrade event
    const upgradeEvents = await prisma.auditLog.findMany({
      where: {
        userId: testUserId,
        eventType: 'facility_upgrade',
        cycleNumber: testCycleNumber,
      },
    });

    expect(upgradeEvents.length).toBeGreaterThan(0);
    expect(upgradeEvents[upgradeEvents.length - 1].eventType).toBe('facility_upgrade');
  });
});
