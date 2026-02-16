/**
 * Unit tests for EventLogger service
 * 
 * Tests event logging, validation, sequence numbers, and batch operations
 */

import { PrismaClient } from '@prisma/client';
import { EventLogger, EventType, clearSequenceCache } from '../src/services/eventLogger';

const prisma = new PrismaClient();
const eventLogger = new EventLogger();

describe('EventLogger Service', () => {
  beforeEach(async () => {
    // Clean up audit logs before each test
    await prisma.auditLog.deleteMany({});
    // Clear sequence cache
    clearSequenceCache(1);
    clearSequenceCache(2);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Single Event Logging', () => {
    it('should log a single event with correct sequence number', async () => {
      const cycleNumber = 1;
      const payload = { test: 'data', value: 123 };

      await eventLogger.logEvent(cycleNumber, EventType.CYCLE_START, payload);

      const events = await prisma.auditLog.findMany({
        where: { cycleNumber },
      });

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe(EventType.CYCLE_START);
      expect(events[0].sequenceNumber).toBe(1);
      expect(events[0].payload).toEqual(payload);
    });

    it('should increment sequence numbers correctly', async () => {
      const cycleNumber = 1;

      await eventLogger.logEvent(cycleNumber, EventType.CYCLE_START, { step: 1 });
      await eventLogger.logEvent(cycleNumber, EventType.CYCLE_STEP_COMPLETE, { step: 2 });
      await eventLogger.logEvent(cycleNumber, EventType.CYCLE_COMPLETE, { step: 3 });

      const events = await prisma.auditLog.findMany({
        where: { cycleNumber },
        orderBy: { sequenceNumber: 'asc' },
      });

      expect(events).toHaveLength(3);
      expect(events[0].sequenceNumber).toBe(1);
      expect(events[1].sequenceNumber).toBe(2);
      expect(events[2].sequenceNumber).toBe(3);
    });

    it('should store userId and robotId when provided', async () => {
      const cycleNumber = 1;
      const userId = 42;
      const robotId = 100;

      await eventLogger.logEvent(
        cycleNumber,
        EventType.CREDIT_CHANGE,
        { amount: 1000, newBalance: 5000 },
        { userId, robotId }
      );

      const event = await prisma.auditLog.findFirst({
        where: { cycleNumber },
      });

      expect(event).not.toBeNull();
      expect(event!.userId).toBe(userId);
      expect(event!.robotId).toBe(robotId);
    });

    it('should store metadata when provided', async () => {
      const cycleNumber = 1;
      const metadata = {
        formula: 'income = base * multiplier',
        inputs: { base: 100, multiplier: 1.5 },
        output: 150,
      };

      await eventLogger.logEvent(
        cycleNumber,
        EventType.PASSIVE_INCOME,
        { income: 150 },
        { userId: 1, metadata }
      );

      const event = await prisma.auditLog.findFirst({
        where: { cycleNumber },
      });

      expect(event).not.toBeNull();
      expect(event!.metadata).toEqual(metadata);
    });

    it('should throw error for invalid payload', async () => {
      const cycleNumber = 1;

      await expect(
        eventLogger.logEvent(cycleNumber, EventType.CYCLE_START, null as any)
      ).rejects.toThrow('Invalid payload');
    });
  });

  describe('Batch Event Logging', () => {
    it('should log multiple events in a batch', async () => {
      const cycleNumber = 1;
      const events = [
        { eventType: EventType.CYCLE_START, payload: { step: 1 } },
        { eventType: EventType.CYCLE_STEP_COMPLETE, payload: { step: 2 } },
        { eventType: EventType.CYCLE_COMPLETE, payload: { step: 3 } },
      ];

      await eventLogger.logEventBatch(cycleNumber, events);

      const storedEvents = await prisma.auditLog.findMany({
        where: { cycleNumber },
        orderBy: { sequenceNumber: 'asc' },
      });

      expect(storedEvents).toHaveLength(3);
      expect(storedEvents[0].sequenceNumber).toBe(1);
      expect(storedEvents[1].sequenceNumber).toBe(2);
      expect(storedEvents[2].sequenceNumber).toBe(3);
    });

    it('should handle empty batch gracefully', async () => {
      const cycleNumber = 1;

      await eventLogger.logEventBatch(cycleNumber, []);

      const events = await prisma.auditLog.findMany({
        where: { cycleNumber },
      });

      expect(events).toHaveLength(0);
    });

    it('should validate all payloads before inserting', async () => {
      const cycleNumber = 1;
      const events = [
        { eventType: EventType.CYCLE_START, payload: { step: 1 } },
        { eventType: EventType.CYCLE_STEP_COMPLETE, payload: null as any },
      ];

      await expect(
        eventLogger.logEventBatch(cycleNumber, events)
      ).rejects.toThrow('Invalid payload');

      // Verify no events were inserted
      const storedEvents = await prisma.auditLog.findMany({
        where: { cycleNumber },
      });
      expect(storedEvents).toHaveLength(0);
    });
  });

  describe('Cycle Event Helpers', () => {
    it('should log cycle start event', async () => {
      const cycleNumber = 1;

      await eventLogger.logCycleStart(cycleNumber, 'manual');

      const event = await prisma.auditLog.findFirst({
        where: { cycleNumber, eventType: EventType.CYCLE_START },
      });

      expect(event).not.toBeNull();
      expect(event!.payload).toHaveProperty('triggerType', 'manual');
      expect(event!.payload).toHaveProperty('timestamp');
    });

    it('should log cycle step complete event', async () => {
      const cycleNumber = 1;

      await eventLogger.logCycleStepComplete(
        cycleNumber,
        'repair_robots',
        1,
        1500,
        { robotsRepaired: 5 }
      );

      const event = await prisma.auditLog.findFirst({
        where: { cycleNumber, eventType: EventType.CYCLE_STEP_COMPLETE },
      });

      expect(event).not.toBeNull();
      expect(event!.payload).toMatchObject({
        stepName: 'repair_robots',
        stepNumber: 1,
        duration: 1500,
        summary: { robotsRepaired: 5 },
      });
    });

    it('should log cycle complete event and clear cache', async () => {
      const cycleNumber = 1;

      // Log some events first
      await eventLogger.logCycleStart(cycleNumber, 'manual');
      await eventLogger.logCycleStepComplete(cycleNumber, 'step1', 1, 1000);

      // Complete the cycle
      await eventLogger.logCycleComplete(cycleNumber, 5000);

      const event = await prisma.auditLog.findFirst({
        where: { cycleNumber, eventType: EventType.CYCLE_COMPLETE },
      });

      expect(event).not.toBeNull();
      expect(event!.payload).toHaveProperty('totalDuration', 5000);
      expect(event!.payload).toHaveProperty('timestamp');
    });
  });

  describe('Facility Event Helpers', () => {
    it('should log facility purchase', async () => {
      const cycleNumber = 1;
      const userId = 1;

      await eventLogger.logFacilityTransaction(
        cycleNumber,
        userId,
        'training_academy',
        0,
        1,
        10000,
        'purchase'
      );

      const event = await prisma.auditLog.findFirst({
        where: { cycleNumber, eventType: EventType.FACILITY_PURCHASE },
      });

      expect(event).not.toBeNull();
      expect(event!.userId).toBe(userId);
      expect(event!.payload).toMatchObject({
        facilityType: 'training_academy',
        oldLevel: 0,
        newLevel: 1,
        cost: 10000,
        action: 'purchase',
      });
    });

    it('should log facility upgrade', async () => {
      const cycleNumber = 1;
      const userId = 1;

      await eventLogger.logFacilityTransaction(
        cycleNumber,
        userId,
        'training_academy',
        1,
        2,
        15000,
        'upgrade'
      );

      const event = await prisma.auditLog.findFirst({
        where: { cycleNumber, eventType: EventType.FACILITY_UPGRADE },
      });

      expect(event).not.toBeNull();
      expect(event!.userId).toBe(userId);
      expect(event!.payload).toMatchObject({
        facilityType: 'training_academy',
        oldLevel: 1,
        newLevel: 2,
        cost: 15000,
        action: 'upgrade',
      });
    });
  });

  describe('Economic Event Helpers', () => {
    it('should log passive income', async () => {
      const cycleNumber = 1;
      const userId = 1;

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

      const event = await prisma.auditLog.findFirst({
        where: { cycleNumber, eventType: EventType.PASSIVE_INCOME },
      });

      expect(event).not.toBeNull();
      expect(event!.userId).toBe(userId);
      expect(event!.payload).toMatchObject({
        merchandising: 5000,
        streaming: 3000,
        totalIncome: 8000,
        facilityLevel: 5,
        prestige: 1000,
        totalBattles: 50,
        totalFame: 200,
      });
    });

    it('should log operating costs', async () => {
      const cycleNumber = 1;
      const userId = 1;
      const costs = [
        { facilityType: 'training_academy', level: 5, cost: 500 },
        { facilityType: 'repair_bay', level: 3, cost: 300 },
      ];

      await eventLogger.logOperatingCosts(cycleNumber, userId, costs, 800);

      const event = await prisma.auditLog.findFirst({
        where: { cycleNumber, eventType: EventType.OPERATING_COSTS },
      });

      expect(event).not.toBeNull();
      expect(event!.userId).toBe(userId);
      expect(event!.payload).toMatchObject({
        costs,
        totalCost: 800,
      });
    });

    it('should log credit change', async () => {
      const cycleNumber = 1;
      const userId = 1;

      await eventLogger.logCreditChange(
        cycleNumber,
        userId,
        1000,
        5000,
        'battle',
        123
      );

      const event = await prisma.auditLog.findFirst({
        where: { cycleNumber, eventType: EventType.CREDIT_CHANGE },
      });

      expect(event).not.toBeNull();
      expect(event!.userId).toBe(userId);
      expect(event!.payload).toMatchObject({
        amount: 1000,
        newBalance: 5000,
        source: 'battle',
        referenceEventId: 123,
      });
    });

    it('should log prestige change', async () => {
      const cycleNumber = 1;
      const userId = 1;

      await eventLogger.logPrestigeChange(
        cycleNumber,
        userId,
        50,
        1050,
        'battle_victory'
      );

      const event = await prisma.auditLog.findFirst({
        where: { cycleNumber, eventType: EventType.PRESTIGE_CHANGE },
      });

      expect(event).not.toBeNull();
      expect(event!.userId).toBe(userId);
      expect(event!.payload).toMatchObject({
        amount: 50,
        newTotal: 1050,
        source: 'battle_victory',
      });
    });
  });

  describe('Weapon Event Helpers', () => {
    it('should log weapon purchase', async () => {
      const cycleNumber = 1;
      const userId = 1;

      await eventLogger.logWeaponPurchase(cycleNumber, userId, 5, 2000);

      const event = await prisma.auditLog.findFirst({
        where: { cycleNumber, eventType: EventType.WEAPON_PURCHASE },
      });

      expect(event).not.toBeNull();
      expect(event!.userId).toBe(userId);
      expect(event!.payload).toMatchObject({
        weaponId: 5,
        cost: 2000,
      });
    });

    it('should log weapon sale', async () => {
      const cycleNumber = 1;
      const userId = 1;

      await eventLogger.logWeaponSale(cycleNumber, userId, 5, 1000);

      const event = await prisma.auditLog.findFirst({
        where: { cycleNumber, eventType: EventType.WEAPON_SALE },
      });

      expect(event).not.toBeNull();
      expect(event!.userId).toBe(userId);
      expect(event!.payload).toMatchObject({
        weaponId: 5,
        salePrice: 1000,
      });
    });
  });

  describe('Robot Event Helpers', () => {
    it('should log attribute upgrade', async () => {
      const cycleNumber = 1;
      const robotId = 10;

      await eventLogger.logAttributeUpgrade(
        cycleNumber,
        robotId,
        'combatPower',
        10.5,
        11.5,
        5000
      );

      const event = await prisma.auditLog.findFirst({
        where: { cycleNumber, eventType: EventType.ROBOT_ATTRIBUTE_UPGRADE },
      });

      expect(event).not.toBeNull();
      expect(event!.robotId).toBe(robotId);
      expect(event!.payload).toMatchObject({
        attributeName: 'combatPower',
        oldValue: 10.5,
        newValue: 11.5,
        cost: 5000,
      });
    });
  });

  describe('Sequence Number Management', () => {
    it('should maintain separate sequence numbers per cycle', async () => {
      // Log events in cycle 1
      await eventLogger.logEvent(1, EventType.CYCLE_START, { cycle: 1 });
      await eventLogger.logEvent(1, EventType.CYCLE_COMPLETE, { cycle: 1 });

      // Log events in cycle 2
      await eventLogger.logEvent(2, EventType.CYCLE_START, { cycle: 2 });
      await eventLogger.logEvent(2, EventType.CYCLE_COMPLETE, { cycle: 2 });

      const cycle1Events = await prisma.auditLog.findMany({
        where: { cycleNumber: 1 },
        orderBy: { sequenceNumber: 'asc' },
      });

      const cycle2Events = await prisma.auditLog.findMany({
        where: { cycleNumber: 2 },
        orderBy: { sequenceNumber: 'asc' },
      });

      // Both cycles should start at sequence 1
      expect(cycle1Events[0].sequenceNumber).toBe(1);
      expect(cycle1Events[1].sequenceNumber).toBe(2);
      expect(cycle2Events[0].sequenceNumber).toBe(1);
      expect(cycle2Events[1].sequenceNumber).toBe(2);
    });

    it('should resume sequence numbers from database on restart', async () => {
      // Simulate existing events in database
      await prisma.auditLog.create({
        data: {
          cycleNumber: 1,
          eventType: EventType.CYCLE_START,
          sequenceNumber: 1,
          payload: { test: 'existing' },
        },
      });

      await prisma.auditLog.create({
        data: {
          cycleNumber: 1,
          eventType: EventType.CYCLE_STEP_COMPLETE,
          sequenceNumber: 2,
          payload: { test: 'existing' },
        },
      });

      // Clear cache to simulate restart
      clearSequenceCache(1);

      // Log new event
      await eventLogger.logEvent(1, EventType.CYCLE_COMPLETE, { test: 'new' });

      const events = await prisma.auditLog.findMany({
        where: { cycleNumber: 1 },
        orderBy: { sequenceNumber: 'asc' },
      });

      expect(events).toHaveLength(3);
      expect(events[2].sequenceNumber).toBe(3);
    });
  });
});
