import { PrismaClient } from '@prisma/client';
import { QueryService } from '../src/services/queryService';
import { EventLogger } from '../src/services/eventLogger';

const prisma = new PrismaClient();
const queryService = new QueryService();
const eventLogger = new EventLogger();

describe('QueryService', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('queryEvents', () => {
    /**
     * Validates: Requirements 9.2, 9.5
     */
    it('should query events by cycle number', async () => {
      // Create events in multiple cycles
      await eventLogger.logCycleStart(1, 'manual');
      await eventLogger.logCycleStart(2, 'manual');
      await eventLogger.logCycleStart(3, 'manual');

      // Query cycle 2
      const result = await queryService.queryEvents({ cycleNumber: 2 });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].cycleNumber).toBe(2);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    /**
     * Validates: Requirements 9.2, 9.5
     */
    it('should query events by cycle range', async () => {
      // Create events in multiple cycles
      for (let cycle = 1; cycle <= 5; cycle++) {
        await eventLogger.logCycleStart(cycle, 'manual');
      }

      // Query cycles 2-4
      const result = await queryService.queryEvents({ cycleRange: [2, 4] });

      expect(result.events).toHaveLength(3);
      expect(result.events[0].cycleNumber).toBe(2);
      expect(result.events[2].cycleNumber).toBe(4);
      expect(result.total).toBe(3);
    });

    /**
     * Validates: Requirements 9.2, 9.5
     */
    it('should query events by user ID', async () => {
      const userId1 = 1;
      const userId2 = 2;

      // Create events for different users
      await eventLogger.logCreditChange(1, userId1, 100, 1100, 'battle');
      await eventLogger.logCreditChange(1, userId2, 200, 1200, 'battle');
      await eventLogger.logCreditChange(1, userId1, 50, 1150, 'battle');

      // Query user 1
      const result = await queryService.queryEvents({ userId: userId1 });

      expect(result.events).toHaveLength(2);
      expect(result.events.every(e => e.userId === userId1)).toBe(true);
    });

    /**
     * Validates: Requirements 9.2, 9.5
     */
    it('should query events by robot ID', async () => {
      const robotId1 = 10;
      const robotId2 = 20;

      // Create events for different robots
      await eventLogger.logAttributeUpgrade(1, robotId1, 'speed', 5, 6, 100);
      await eventLogger.logAttributeUpgrade(1, robotId2, 'armor', 3, 4, 150);
      await eventLogger.logAttributeUpgrade(1, robotId1, 'power', 7, 8, 200);

      // Query robot 1
      const result = await queryService.queryEvents({ robotId: robotId1 });

      expect(result.events).toHaveLength(2);
      expect(result.events.every(e => e.robotId === robotId1)).toBe(true);
    });

    /**
     * Validates: Requirements 9.2, 9.5
     */
    it('should query events by event type', async () => {
      // Create different event types
      await eventLogger.logCycleStart(1, 'manual');
      await eventLogger.logCycleStepComplete(1, 'step_1', 1, 100);
      await eventLogger.logCycleComplete(1, 100);
      await eventLogger.logCycleStart(2, 'manual');

      // Query only cycle_start events
      const result = await queryService.queryEvents({
        eventType: ['cycle_start'],
      });

      expect(result.events).toHaveLength(2);
      expect(result.events.every(e => e.eventType === 'cycle_start')).toBe(true);
    });

    /**
     * Validates: Requirements 9.2, 9.5
     */
    it('should query events by multiple event types', async () => {
      // Create different event types
      await eventLogger.logCycleStart(1, 'manual');
      await eventLogger.logCycleStepComplete(1, 'step_1', 1, 100);
      await eventLogger.logCycleComplete(1, 100);

      // Query cycle_start and cycle_complete
      const result = await queryService.queryEvents({
        eventType: ['cycle_start', 'cycle_complete'],
      });

      expect(result.events).toHaveLength(2);
      expect(result.events.some(e => e.eventType === 'cycle_start')).toBe(true);
      expect(result.events.some(e => e.eventType === 'cycle_complete')).toBe(true);
    });

    /**
     * Validates: Requirements 9.5
     */
    it('should support pagination with limit and offset', async () => {
      // Create 10 events
      for (let i = 1; i <= 10; i++) {
        await eventLogger.logCycleStart(i, 'manual');
      }

      // Get first page (5 events)
      const page1 = await queryService.queryEvents({ limit: 5, offset: 0 });
      expect(page1.events).toHaveLength(5);
      expect(page1.total).toBe(10);
      expect(page1.hasMore).toBe(true);

      // Get second page (5 events)
      const page2 = await queryService.queryEvents({ limit: 5, offset: 5 });
      expect(page2.events).toHaveLength(5);
      expect(page2.total).toBe(10);
      expect(page2.hasMore).toBe(false);
    });

    /**
     * Validates: Requirements 9.5
     */
    it('should support sorting by timestamp', async () => {
      // Create events with different timestamps
      const now = new Date();
      await eventLogger.logCycleStart(1, 'manual');
      await new Promise(resolve => setTimeout(resolve, 10));
      await eventLogger.logCycleStart(2, 'manual');
      await new Promise(resolve => setTimeout(resolve, 10));
      await eventLogger.logCycleStart(3, 'manual');

      // Sort by timestamp descending
      const result = await queryService.queryEvents({
        sortBy: 'timestamp',
        sortOrder: 'desc',
      });

      expect(result.events).toHaveLength(3);
      expect(result.events[0].cycleNumber).toBe(3);
      expect(result.events[2].cycleNumber).toBe(1);
    });

    /**
     * Validates: Requirements 9.5
     */
    it('should combine multiple filters', async () => {
      const userId = 1;

      // Create events
      await eventLogger.logCreditChange(1, userId, 100, 1100, 'battle');
      await eventLogger.logCreditChange(2, userId, 200, 1300, 'battle');
      await eventLogger.logCreditChange(3, userId, 50, 1350, 'repair');
      await eventLogger.logPrestigeChange(2, userId, 10, 110, 'battle');

      // Query: user 1, cycles 1-2, event type credit_change
      const result = await queryService.queryEvents({
        userId,
        cycleRange: [1, 2],
        eventType: ['credit_change'],
      });

      expect(result.events).toHaveLength(2);
      expect(result.events.every(e => e.userId === userId)).toBe(true);
      expect(result.events.every(e => e.eventType === 'credit_change')).toBe(true);
      expect(result.events.every(e => e.cycleNumber >= 1 && e.cycleNumber <= 2)).toBe(true);
    });
  });

  describe('getEventsByCycle', () => {
    /**
     * Validates: Requirements 9.2, 9.5
     */
    it('should get all events for a specific cycle', async () => {
      await eventLogger.logCycleStart(1, 'manual');
      await eventLogger.logCycleStepComplete(1, 'step_1', 1, 100);
      await eventLogger.logCycleComplete(1, 100);

      const events = await queryService.getEventsByCycle(1);

      expect(events).toHaveLength(3);
      expect(events.every(e => e.cycleNumber === 1)).toBe(true);
    });
  });

  describe('getEventsByUser', () => {
    /**
     * Validates: Requirements 9.2, 9.5
     */
    it('should get all events for a specific user', async () => {
      const userId = 5;

      await eventLogger.logCreditChange(1, userId, 100, 1100, 'battle');
      await eventLogger.logCreditChange(2, userId, 200, 1300, 'battle');
      await eventLogger.logPrestigeChange(1, userId, 10, 110, 'battle');

      const events = await queryService.getEventsByUser(userId);

      expect(events).toHaveLength(3);
      expect(events.every(e => e.userId === userId)).toBe(true);
    });

    /**
     * Validates: Requirements 9.2, 9.5
     */
    it('should get user events within cycle range', async () => {
      const userId = 5;

      await eventLogger.logCreditChange(1, userId, 100, 1100, 'battle');
      await eventLogger.logCreditChange(2, userId, 200, 1300, 'battle');
      await eventLogger.logCreditChange(3, userId, 50, 1350, 'battle');

      const events = await queryService.getEventsByUser(userId, [1, 2]);

      expect(events).toHaveLength(2);
      expect(events.every(e => e.cycleNumber >= 1 && e.cycleNumber <= 2)).toBe(true);
    });
  });

  describe('getEventsByRobot', () => {
    /**
     * Validates: Requirements 9.2, 9.5
     */
    it('should get all events for a specific robot', async () => {
      const robotId = 15;

      await eventLogger.logAttributeUpgrade(1, robotId, 'speed', 5, 6, 100);
      await eventLogger.logAttributeUpgrade(2, robotId, 'armor', 3, 4, 150);

      const events = await queryService.getEventsByRobot(robotId);

      expect(events).toHaveLength(2);
      expect(events.every(e => e.robotId === robotId)).toBe(true);
    });
  });

  describe('getEventsByType', () => {
    /**
     * Validates: Requirements 9.2, 9.5
     */
    it('should get events by type', async () => {
      await eventLogger.logCycleStart(1, 'manual');
      await eventLogger.logCycleStart(2, 'manual');
      await eventLogger.logCycleComplete(1, 100);

      const events = await queryService.getEventsByType(['cycle_start']);

      expect(events).toHaveLength(2);
      expect(events.every(e => e.eventType === 'cycle_start')).toBe(true);
    });
  });

  describe('getPaginatedEvents', () => {
    /**
     * Validates: Requirements 9.5
     */
    it('should paginate events correctly', async () => {
      // Create 25 events
      for (let i = 1; i <= 25; i++) {
        await eventLogger.logCycleStart(i, 'manual');
      }

      // Get page 1 (10 events per page)
      const page1 = await queryService.getPaginatedEvents({}, 1, 10);
      expect(page1.events).toHaveLength(10);
      expect(page1.hasMore).toBe(true);

      // Get page 2
      const page2 = await queryService.getPaginatedEvents({}, 2, 10);
      expect(page2.events).toHaveLength(10);
      expect(page2.hasMore).toBe(true);

      // Get page 3
      const page3 = await queryService.getPaginatedEvents({}, 3, 10);
      expect(page3.events).toHaveLength(5);
      expect(page3.hasMore).toBe(false);
    });
  });

  describe('getEventStatistics', () => {
    /**
     * Validates: Requirements 9.2
     */
    it('should calculate event statistics', async () => {
      const userId1 = 1;
      const userId2 = 2;
      const robotId1 = 10;

      // Create various events
      await eventLogger.logCycleStart(1, 'manual');
      await eventLogger.logCycleStart(2, 'manual');
      await eventLogger.logCreditChange(1, userId1, 100, 1100, 'battle');
      await eventLogger.logCreditChange(2, userId2, 200, 1200, 'battle');
      await eventLogger.logAttributeUpgrade(1, robotId1, 'speed', 5, 6, 100);

      const stats = await queryService.getEventStatistics([1, 2]);

      expect(stats.totalEvents).toBe(5);
      expect(stats.eventsByType['cycle_start']).toBe(2);
      expect(stats.eventsByType['credit_change']).toBe(2);
      expect(stats.eventsByType['attribute_upgrade']).toBe(1);
      expect(stats.eventsByCycle[1]).toBe(3);
      expect(stats.eventsByCycle[2]).toBe(2);
      expect(stats.uniqueUsers).toBe(2);
      expect(stats.uniqueRobots).toBe(1);
    });
  });

  describe('getRecentEvents', () => {
    /**
     * Validates: Requirements 9.5
     */
    it('should get most recent events', async () => {
      // Create events in multiple cycles
      for (let i = 1; i <= 5; i++) {
        await eventLogger.logCycleStart(i, 'manual');
      }

      const recent = await queryService.getRecentEvents(3);

      expect(recent).toHaveLength(3);
      expect(recent[0].cycleNumber).toBe(5); // Most recent first
      expect(recent[2].cycleNumber).toBe(3);
    });
  });

  describe('countEvents', () => {
    /**
     * Validates: Requirements 9.5
     */
    it('should count events matching filters', async () => {
      const userId = 1;

      await eventLogger.logCreditChange(1, userId, 100, 1100, 'battle');
      await eventLogger.logCreditChange(2, userId, 200, 1300, 'battle');
      await eventLogger.logPrestigeChange(1, userId, 10, 110, 'battle');

      const count = await queryService.countEvents({
        userId,
        eventType: ['credit_change'],
      });

      expect(count).toBe(2);
    });
  });
});
