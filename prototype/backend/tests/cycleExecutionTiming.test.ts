/**
 * Cycle Execution Timing Tests
 * Tests for cycle_start, cycle_step_complete, and cycle_complete event logging
 * Validates Requirements 11.1, 11.2, 15.1, 15.2, 15.3
 */

import { EventLogger } from '../src/services/eventLogger';
import prisma from '../src/lib/prisma';

describe('Cycle Execution Timing', () => {
  let eventLogger: EventLogger;

  beforeAll(() => {
    eventLogger = new EventLogger();
  });

  beforeEach(async () => {
    // Clean up audit logs
    await prisma.auditLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('logCycleStart', () => {
    it('should log cycle start with manual trigger type', async () => {
      const cycleNumber = 1;
      
      await eventLogger.logCycleStart(cycleNumber, 'manual');
      
      const events = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: 'cycle_start',
        },
      });
      
      expect(events).toHaveLength(1);
      expect(events[0].payload).toMatchObject({
        triggerType: 'manual',
      });
      expect((events[0].payload as any).timestamp).toBeDefined();
    });

    it('should log cycle start with scheduled trigger type', async () => {
      const cycleNumber = 2;
      
      await eventLogger.logCycleStart(cycleNumber, 'scheduled');
      
      const events = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: 'cycle_start',
        },
      });
      
      expect(events).toHaveLength(1);
      expect(events[0].payload).toMatchObject({
        triggerType: 'scheduled',
      });
    });
  });

  describe('logCycleStepComplete', () => {
    it('should log cycle step completion with duration', async () => {
      const cycleNumber = 1;
      const stepName = 'execute_league_battles';
      const stepNumber = 1;
      const durationMs = 1234;
      
      await eventLogger.logCycleStepComplete(
        cycleNumber,
        stepName,
        stepNumber,
        durationMs,
        { battlesExecuted: 10 }
      );
      
      const events = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: 'cycle_step_complete',
        },
      });
      
      expect(events).toHaveLength(1);
      expect(events[0].payload).toMatchObject({
        stepName,
        stepNumber,
        duration: durationMs,
        summary: { battlesExecuted: 10 },
      });
    });

    it('should log multiple cycle steps in sequence', async () => {
      const cycleNumber = 1;
      
      await eventLogger.logCycleStepComplete(cycleNumber, 'step1', 1, 100, {});
      await eventLogger.logCycleStepComplete(cycleNumber, 'step2', 2, 200, {});
      await eventLogger.logCycleStepComplete(cycleNumber, 'step3', 3, 300, {});
      
      const events = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: 'cycle_step_complete',
        },
        orderBy: { sequenceNumber: 'asc' },
      });
      
      expect(events).toHaveLength(3);
      expect((events[0].payload as any).stepName).toBe('step1');
      expect((events[1].payload as any).stepName).toBe('step2');
      expect((events[2].payload as any).stepName).toBe('step3');
    });

    it('should handle empty summary object', async () => {
      const cycleNumber = 1;
      
      await eventLogger.logCycleStepComplete(cycleNumber, 'test_step', 1, 500);
      
      const events = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: 'cycle_step_complete',
        },
      });
      
      expect(events).toHaveLength(1);
      expect((events[0].payload as any).summary).toEqual({});
    });
  });

  describe('logCycleComplete', () => {
    it('should log cycle completion with total duration', async () => {
      const cycleNumber = 1;
      const totalDurationMs = 5000;
      
      await eventLogger.logCycleComplete(cycleNumber, totalDurationMs);
      
      const events = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: 'cycle_complete',
        },
      });
      
      expect(events).toHaveLength(1);
      expect(events[0].payload).toMatchObject({
        totalDuration: totalDurationMs,
      });
      expect((events[0].payload as any).timestamp).toBeDefined();
    });
  });

  describe('Complete cycle timing flow', () => {
    it('should log complete cycle with start, steps, and complete events', async () => {
      const cycleNumber = 1;
      
      // Log cycle start
      await eventLogger.logCycleStart(cycleNumber, 'manual');
      
      // Log multiple steps
      await eventLogger.logCycleStepComplete(cycleNumber, 'execute_battles', 1, 1000, { battles: 5 });
      await eventLogger.logCycleStepComplete(cycleNumber, 'repair_robots', 2, 500, { repaired: 10 });
      await eventLogger.logCycleStepComplete(cycleNumber, 'matchmaking', 3, 300, { matches: 8 });
      
      // Log cycle complete
      await eventLogger.logCycleComplete(cycleNumber, 1800);
      
      // Verify all events logged
      const allEvents = await prisma.auditLog.findMany({
        where: { cycleNumber },
        orderBy: { sequenceNumber: 'asc' },
      });
      
      expect(allEvents).toHaveLength(5);
      expect(allEvents[0].eventType).toBe('cycle_start');
      expect(allEvents[1].eventType).toBe('cycle_step_complete');
      expect(allEvents[2].eventType).toBe('cycle_step_complete');
      expect(allEvents[3].eventType).toBe('cycle_step_complete');
      expect(allEvents[4].eventType).toBe('cycle_complete');
    });

    it('should maintain sequence number ordering within cycle', async () => {
      const cycleNumber = 1;
      
      await eventLogger.logCycleStart(cycleNumber, 'manual');
      await eventLogger.logCycleStepComplete(cycleNumber, 'step1', 1, 100, {});
      await eventLogger.logCycleStepComplete(cycleNumber, 'step2', 2, 200, {});
      await eventLogger.logCycleComplete(cycleNumber, 300);
      
      const events = await prisma.auditLog.findMany({
        where: { cycleNumber },
        orderBy: { sequenceNumber: 'asc' },
      });
      
      // Verify sequence numbers are monotonically increasing
      for (let i = 1; i < events.length; i++) {
        expect(events[i].sequenceNumber).toBeGreaterThan(events[i - 1].sequenceNumber);
      }
    });
  });

  describe('Step duration recording', () => {
    it('should record accurate step durations', async () => {
      const cycleNumber = 1;
      const durations = [100, 250, 500, 1000];
      
      for (let i = 0; i < durations.length; i++) {
        await eventLogger.logCycleStepComplete(
          cycleNumber,
          `step${i + 1}`,
          i + 1,
          durations[i],
          {}
        );
      }
      
      const events = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: 'cycle_step_complete',
        },
        orderBy: { sequenceNumber: 'asc' },
      });
      
      expect(events).toHaveLength(durations.length);
      events.forEach((event, index) => {
        expect((event.payload as any).duration).toBe(durations[index]);
      });
    });

    it('should sum step durations approximately equal to total cycle duration', async () => {
      const cycleNumber = 1;
      const stepDurations = [1000, 500, 300, 200];
      const totalDuration = stepDurations.reduce((sum, d) => sum + d, 0);
      
      await eventLogger.logCycleStart(cycleNumber, 'manual');
      
      for (let i = 0; i < stepDurations.length; i++) {
        await eventLogger.logCycleStepComplete(
          cycleNumber,
          `step${i + 1}`,
          i + 1,
          stepDurations[i],
          {}
        );
      }
      
      await eventLogger.logCycleComplete(cycleNumber, totalDuration);
      
      const stepEvents = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: 'cycle_step_complete',
        },
      });
      
      const completeEvent = await prisma.auditLog.findFirst({
        where: {
          cycleNumber,
          eventType: 'cycle_complete',
        },
      });
      
      const sumOfSteps = stepEvents.reduce((sum, e) => sum + ((e.payload as any).duration as number), 0);
      expect(sumOfSteps).toBe((completeEvent?.payload as any).totalDuration);
    });
  });

  describe('Trigger type recording', () => {
    it('should record manual trigger type correctly', async () => {
      const cycleNumber = 1;
      
      await eventLogger.logCycleStart(cycleNumber, 'manual');
      
      const event = await prisma.auditLog.findFirst({
        where: {
          cycleNumber,
          eventType: 'cycle_start',
        },
      });
      
      expect((event?.payload as any).triggerType).toBe('manual');
    });

    it('should record scheduled trigger type correctly', async () => {
      const cycleNumber = 2;
      
      await eventLogger.logCycleStart(cycleNumber, 'scheduled');
      
      const event = await prisma.auditLog.findFirst({
        where: {
          cycleNumber,
          eventType: 'cycle_start',
        },
      });
      
      expect((event?.payload as any).triggerType).toBe('scheduled');
    });
  });
});
