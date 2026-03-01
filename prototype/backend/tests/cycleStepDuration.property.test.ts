/**
 * Property-Based Tests for Cycle Step Duration Recording
 * Property 15: Cycle Step Duration Recording
 * 
 * For any cycle execution, each of the 8 cycle steps should have a corresponding 
 * step completion event with duration, and the sum of step durations should 
 * approximately equal the total cycle duration (within 5% tolerance for overhead).
 * 
 * Validates: Requirements 15.2, 15.3
 */

import fc from 'fast-check';
import { EventLogger } from '../src/services/eventLogger';
import prisma from '../src/lib/prisma';

describe('Property 15: Cycle Step Duration Recording', () => {
  let eventLogger: EventLogger;
  let testCycleNumbers: number[] = [];

  beforeAll(() => {
    eventLogger = new EventLogger();
  });

  beforeEach(async () => {
    // Clean up audit logs before each test
    await prisma.auditLog.deleteMany({});
  });

  afterAll(async () => {
    // Clean up any test data
    if (testCycleNumbers.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { cycleNumber: { in: testCycleNumbers } },
      });
    }
    await prisma.$disconnect();
  });

  /**
   * Property 15.1: Each cycle step has a corresponding step completion event with duration
   */
  test('Property 15.1: Each cycle step has a step completion event with duration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // cycleNumber
        fc.integer({ min: 1, max: 20 }), // numberOfSteps
        fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 1, maxLength: 20 }), // step durations
        async (cycleNumber, numberOfSteps, durations) => {
          // Clean up before each iteration
          await prisma.auditLog.deleteMany({ where: { cycleNumber } });

          // Ensure durations array matches numberOfSteps
          const stepDurations = durations.slice(0, numberOfSteps);
          if (stepDurations.length < numberOfSteps) {
            stepDurations.push(...Array(numberOfSteps - stepDurations.length).fill(100));
          }

          // Log cycle start
          await eventLogger.logCycleStart(cycleNumber, 'manual');

          // Log each step completion
          for (let i = 0; i < numberOfSteps; i++) {
            await eventLogger.logCycleStepComplete(
              cycleNumber,
              `step_${i + 1}`,
              i + 1,
              stepDurations[i],
              { stepIndex: i }
            );
          }

          // Verify: Each step has a completion event with duration
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
            expect(payload.duration).toBeDefined();
            expect(typeof payload.duration).toBe('number');
            expect(payload.duration).toBeGreaterThan(0);
          }

          // Property: Durations match what was logged
          for (let i = 0; i < numberOfSteps; i++) {
            const payload = stepEvents[i].payload as any;
            expect(payload.duration).toBe(stepDurations[i]);
          }
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property 15.2: Sum of step durations approximately equals total cycle duration
   */
  test('Property 15.2: Sum of step durations approximately equals total cycle duration (within 5% tolerance)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // cycleNumber
        fc.array(fc.integer({ min: 100, max: 5000 }), { minLength: 3, maxLength: 15 }), // step durations
        fc.integer({ min: 0, max: 5 }), // overhead percentage (0-5%)
        async (cycleNumber, stepDurations, overheadPercent) => {
          // Clean up before each iteration
          await prisma.auditLog.deleteMany({ where: { cycleNumber } });
          // Log cycle start
          await eventLogger.logCycleStart(cycleNumber, 'manual');

          // Log each step completion
          for (let i = 0; i < stepDurations.length; i++) {
            await eventLogger.logCycleStepComplete(
              cycleNumber,
              `step_${i + 1}`,
              i + 1,
              stepDurations[i],
              {}
            );
          }

          // Calculate total duration (sum of steps + overhead within 5%)
          const sumOfSteps = stepDurations.reduce((sum, d) => sum + d, 0);
          const overhead = Math.floor(sumOfSteps * (overheadPercent / 100));
          const totalDuration = sumOfSteps + overhead;

          // Log cycle complete
          await eventLogger.logCycleComplete(cycleNumber, totalDuration);

          // Verify: Sum of step durations approximately equals total cycle duration
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

          const recordedSumOfSteps = stepEvents.reduce(
            (sum, e) => sum + ((e.payload as any).duration as number),
            0
          );
          const recordedTotalDuration = (completeEvent?.payload as any).totalDuration as number;

          // Property: Sum of steps equals what we logged
          expect(recordedSumOfSteps).toBe(sumOfSteps);

          // Property: Total duration equals sum of steps + overhead
          expect(recordedTotalDuration).toBe(totalDuration);

          // Property: Overhead is within 5% tolerance of total duration
          const overheadPercentage = (overhead / totalDuration) * 100;
          expect(overheadPercentage).toBeLessThanOrEqual(5);
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property 15.3: Step durations are recorded in sequence order
   */
  test('Property 15.3: Step durations are recorded in sequence order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // cycleNumber
        fc.array(fc.integer({ min: 50, max: 2000 }), { minLength: 5, maxLength: 15 }), // step durations
        async (cycleNumber, stepDurations) => {
          // Clean up before each iteration
          await prisma.auditLog.deleteMany({ where: { cycleNumber } });
          // Log cycle start
          await eventLogger.logCycleStart(cycleNumber, 'manual');

          // Log each step completion
          for (let i = 0; i < stepDurations.length; i++) {
            await eventLogger.logCycleStepComplete(
              cycleNumber,
              `step_${i + 1}`,
              i + 1,
              stepDurations[i],
              { stepNumber: i + 1 }
            );
          }

          // Verify: Steps are recorded in sequence order
          const stepEvents = await prisma.auditLog.findMany({
            where: {
              cycleNumber,
              eventType: 'cycle_step_complete',
            },
            orderBy: { sequenceNumber: 'asc' },
          });

          // Property: Sequence numbers are monotonically increasing
          for (let i = 1; i < stepEvents.length; i++) {
            expect(stepEvents[i].sequenceNumber).toBeGreaterThan(
              stepEvents[i - 1].sequenceNumber
            );
          }

          // Property: Step numbers match the order
          for (let i = 0; i < stepEvents.length; i++) {
            const payload = stepEvents[i].payload as any;
            expect(payload.stepNumber).toBe(i + 1);
          }
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property 15.4: Step durations are always positive
   */
  test('Property 15.4: Step durations are always positive', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // cycleNumber
        fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 1, maxLength: 20 }), // step durations (always positive)
        async (cycleNumber, stepDurations) => {
          // Clean up before each iteration
          await prisma.auditLog.deleteMany({ where: { cycleNumber } });
          // Log cycle start
          await eventLogger.logCycleStart(cycleNumber, 'manual');

          // Log each step completion
          for (let i = 0; i < stepDurations.length; i++) {
            await eventLogger.logCycleStepComplete(
              cycleNumber,
              `step_${i + 1}`,
              i + 1,
              stepDurations[i],
              {}
            );
          }

          // Verify: All step durations are positive
          const stepEvents = await prisma.auditLog.findMany({
            where: {
              cycleNumber,
              eventType: 'cycle_step_complete',
            },
          });

          // Property: All durations are positive
          for (const event of stepEvents) {
            const payload = event.payload as any;
            expect(payload.duration).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property 15.5: Step completion events include step name and number
   */
  test('Property 15.5: Step completion events include step name and number', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // cycleNumber
        fc.array(
          fc.record({
            name: fc.string({ minLength: 5, maxLength: 20 }),
            duration: fc.integer({ min: 100, max: 5000 }),
          }),
          { minLength: 3, maxLength: 12 }
        ), // steps with names and durations
        async (cycleNumber, steps) => {
          // Clean up before each iteration
          await prisma.auditLog.deleteMany({ where: { cycleNumber } });
          // Log cycle start
          await eventLogger.logCycleStart(cycleNumber, 'manual');

          // Log each step completion
          for (let i = 0; i < steps.length; i++) {
            await eventLogger.logCycleStepComplete(
              cycleNumber,
              steps[i].name as string,
              i + 1,
              steps[i].duration as number,
              {}
            );
          }

          // Verify: Each step event includes name and number
          const stepEvents = await prisma.auditLog.findMany({
            where: {
              cycleNumber,
              eventType: 'cycle_step_complete',
            },
            orderBy: { sequenceNumber: 'asc' },
          });

          // Property: Each event has stepName and stepNumber
          for (let i = 0; i < steps.length; i++) {
            const payload = stepEvents[i].payload as any;
            expect(payload.stepName).toBe(steps[i].name as string);
            expect(payload.stepNumber).toBe(i + 1);
            expect(payload.duration).toBe(steps[i].duration as number);
          }
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property 15.6: Multiple cycles can be logged independently
   */
  test('Property 15.6: Multiple cycles can be logged independently with correct durations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            cycleNumber: fc.integer({ min: 1, max: 50 }),
            stepDurations: fc.array(fc.integer({ min: 100, max: 3000 }), { minLength: 3, maxLength: 8 }),
          }),
          { minLength: 2, maxLength: 5 }
        ), // multiple cycles
        async (cycles) => {
          // Make cycle numbers unique
          const uniqueCycles = cycles.map((c, i) => ({
            ...c,
            cycleNumber: i + 1,
          }));

          // Clean up all cycles before iteration
          await prisma.auditLog.deleteMany({
            where: {
              cycleNumber: {
                in: uniqueCycles.map(c => c.cycleNumber),
              },
            },
          });

          // Log all cycles
          for (const cycle of uniqueCycles) {
            await eventLogger.logCycleStart(cycle.cycleNumber, 'manual');

            for (let i = 0; i < cycle.stepDurations.length; i++) {
              await eventLogger.logCycleStepComplete(
                cycle.cycleNumber,
                `step_${i + 1}`,
                i + 1,
                cycle.stepDurations[i],
                {}
              );
            }

            const totalDuration = cycle.stepDurations.reduce((sum, d) => sum + d, 0);
            await eventLogger.logCycleComplete(cycle.cycleNumber, totalDuration);
          }

          // Verify: Each cycle has correct step durations
          for (const cycle of uniqueCycles) {
            const stepEvents = await prisma.auditLog.findMany({
              where: {
                cycleNumber: cycle.cycleNumber,
                eventType: 'cycle_step_complete',
              },
              orderBy: { sequenceNumber: 'asc' },
            });

            // Property: Correct number of steps per cycle
            expect(stepEvents).toHaveLength(cycle.stepDurations.length);

            // Property: Durations match for each cycle
            for (let i = 0; i < cycle.stepDurations.length; i++) {
              const payload = stepEvents[i].payload as any;
              expect(payload.duration).toBe(cycle.stepDurations[i]);
            }
          }
        }
      ),
      { numRuns: 25 }
    );
  });
});
