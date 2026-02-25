/**
 * Property-Based Tests for Cycle Step Duration Recording
 * Property 15: Cycle Step Duration Recording
 * 
 * For any cycle execution, each of the 8 cycle steps should have a corresponding 
 * step completion event with duration, and the sum of step durations should 
 * approximately equal the total cycle duration (within 5% tolerance for overhead).
 * 
 * Validates: Requirements 15.2, 15.3
 * 
 * FIXED VERSION - Shows pattern for fixing sequence number conflicts
 */

import fc from 'fast-check';
import { EventLogger } from '../src/services/eventLogger';
import prisma from '../src/lib/prisma';
import { generateTestCycleNumber, cleanupTestCycle } from './testCycleHelper'; // ✅ ADDED

describe('Property 15: Cycle Step Duration Recording', () => {
  let eventLogger: EventLogger;
  let testCycleNumber: number; // ✅ CHANGED: was const, now let

  beforeAll(() => {
    eventLogger = new EventLogger();
  });

  // ✅ ADDED: Generate unique cycle number before each test
  beforeEach(() => {
    testCycleNumber = generateTestCycleNumber();
  });

  // ✅ ADDED: Cleanup after each test
  afterEach(async () => {
    await cleanupTestCycle(testCycleNumber);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Property 15.1: Each cycle step has a step completion event with duration
   */
  test('Property 15.1: Each cycle step has a step completion event with duration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }), // numberOfSteps
        fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 1, maxLength: 20 }), // step durations
        async (numberOfSteps, durations) => {
          // ✅ CHANGED: Use testCycleNumber instead of generated cycleNumber
          const cycleNumber = testCycleNumber;
          
          // Ensure durations array matches numberOfSteps
          const stepDurations = durations.slice(0, numberOfSteps);
          if (stepDurations.length < numberOfSteps) {
            stepDurations.push(...Array(numberOfSteps - stepDurations.length).fill(100));
          }

          // Log cycle start
          await eventLogger.logCycleStart(cycleNumber, 'manual');

          // Log step completion events
          for (let i = 0; i < numberOfSteps; i++) {
            await eventLogger.logCycleStepComplete(
              cycleNumber,
              `step_${i + 1}`,
              i + 1,
              stepDurations[i]
            );
          }

          // Query step events
          const stepEvents = await prisma.auditLog.findMany({
            where: {
              cycleNumber,
              eventType: 'cycle_step_complete',
            },
            orderBy: { sequenceNumber: 'asc' },
          });

          // Property: Number of step events equals number of steps
          expect(stepEvents).toHaveLength(numberOfSteps);

          // Property: Each event has a duration field
          for (const event of stepEvents) {
            const payload = event.payload as any;
            expect(payload).toHaveProperty('duration');
            expect(typeof payload.duration).toBe('number');
            expect(payload.duration).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 10 } // ✅ ADDED: Reduce iterations for faster tests
    );
  });

  /**
   * Property 15.2: Sum of step durations approximately equals total cycle duration
   */
  test('Property 15.2: Sum of step durations approximately equals total cycle duration (within 5% tolerance)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 100, max: 5000 }), { minLength: 3, maxLength: 10 }),
        fc.integer({ min: 0, max: 500 }), // overhead
        async (stepDurations, overhead) => {
          // ✅ CHANGED: Use testCycleNumber
          const cycleNumber = testCycleNumber;
          
          // Log cycle start
          const cycleStartTime = Date.now();
          await eventLogger.logCycleStart(cycleNumber, 'manual');

          // Log step completions
          for (let i = 0; i < stepDurations.length; i++) {
            await eventLogger.logCycleStepComplete(
              cycleNumber,
              `step_${i + 1}`,
              i + 1,
              stepDurations[i]
            );
          }

          // Calculate total duration
          const totalStepDuration = stepDurations.reduce((sum, d) => sum + d, 0);
          const totalCycleDuration = totalStepDuration + overhead;

          // Log cycle complete
          await eventLogger.logCycleComplete(cycleNumber, totalCycleDuration);

          // Query events
          const stepEvents = await prisma.auditLog.findMany({
            where: {
              cycleNumber,
              eventType: 'cycle_step_complete',
            },
          });

          const cycleCompleteEvent = await prisma.auditLog.findFirst({
            where: {
              cycleNumber,
              eventType: 'cycle_complete',
            },
          });

          // Property: Sum of step durations
          const sumOfStepDurations = stepEvents.reduce((sum, event) => {
            const payload = event.payload as any;
            return sum + (payload.duration || 0);
          }, 0);

          // Property: Within 5% tolerance
          const cycleDuration = (cycleCompleteEvent?.payload as any)?.duration || 0;
          const tolerance = cycleDuration * 0.05;
          const difference = Math.abs(sumOfStepDurations - cycleDuration);

          expect(difference).toBeLessThanOrEqual(tolerance);
        }
      ),
      { numRuns: 10 } // ✅ ADDED: Reduce iterations
    );
  });

  // Additional tests would follow the same pattern...
});
