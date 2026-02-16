/**
 * Property-Based Tests for Performance Degradation Detection
 * Property 16: Performance Degradation Detection
 * 
 * For any cycle step, if the average duration over the last 10 cycles exceeds 
 * 150% of the average duration over the previous 100 cycles, the Analytics 
 * Engine should flag it as a performance degradation.
 * 
 * Validates: Requirements 15.4
 */

import fc from 'fast-check';
import { CyclePerformanceMonitoringService } from '../src/services/cyclePerformanceMonitoringService';
import { EventLogger } from '../src/services/eventLogger';
import prisma from '../src/lib/prisma';

describe('Property 16: Performance Degradation Detection', () => {
  let service: CyclePerformanceMonitoringService;
  let eventLogger: EventLogger;

  beforeAll(() => {
    service = new CyclePerformanceMonitoringService();
    eventLogger = new EventLogger();
  });

  beforeEach(async () => {
    // Clean up audit logs before each test
    await prisma.auditLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Property 16.1: Degradation is detected when recent average exceeds 150% of baseline
   */
  test('Property 16.1: Degradation detected when recent average > 150% of baseline', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 5000 }), // baselineDuration
        fc.float({ min: Math.fround(1.51), max: Math.fround(3.0) }), // degradationMultiplier (> 1.5)
        fc.constantFrom('step_a', 'step_b', 'step_c'), // stepName
        async (baselineDuration, degradationMultiplier, stepName) => {
          // Clean up for this iteration
          await prisma.auditLog.deleteMany({});

          const recentDuration = Math.floor(baselineDuration * degradationMultiplier);

          // Create baseline data (100 cycles)
          for (let cycle = 1; cycle <= 100; cycle++) {
            await eventLogger.logCycleStepComplete(cycle, stepName, 1, baselineDuration, {});
          }

          // Create recent data (10 cycles) with degraded performance
          for (let cycle = 101; cycle <= 110; cycle++) {
            await eventLogger.logCycleStepComplete(cycle, stepName, 1, recentDuration, {});
          }

          // Add cycle complete events
          for (let cycle = 1; cycle <= 110; cycle++) {
            await eventLogger.logCycleComplete(cycle, baselineDuration);
          }

          // Property: Degradation should be detected
          const alert = await service.detectStepDegradation(stepName, 10, 100);

          expect(alert).not.toBeNull();
          expect(alert!.stepName).toBe(stepName);
          expect(alert!.currentAverageDuration).toBe(recentDuration);
          expect(alert!.baselineAverageDuration).toBe(baselineDuration);
          
          // Property: Degradation percentage should be positive
          expect(alert!.degradationPercentage).toBeGreaterThan(50);
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property 16.2: No degradation when recent average is below 150% threshold
   */
  test('Property 16.2: No degradation when recent average <= 150% of baseline', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 5000 }), // baselineDuration
        fc.float({ min: Math.fround(0.5), max: Math.fround(1.5) }), // multiplier (<= 1.5)
        fc.constantFrom('step_x', 'step_y', 'step_z'), // stepName
        async (baselineDuration, multiplier, stepName) => {
          // Clean up for this iteration
          await prisma.auditLog.deleteMany({});

          const recentDuration = Math.floor(baselineDuration * multiplier);

          // Create baseline data (100 cycles)
          for (let cycle = 1; cycle <= 100; cycle++) {
            await eventLogger.logCycleStepComplete(cycle, stepName, 1, baselineDuration, {});
          }

          // Create recent data (10 cycles) within acceptable range
          for (let cycle = 101; cycle <= 110; cycle++) {
            await eventLogger.logCycleStepComplete(cycle, stepName, 1, recentDuration, {});
          }

          // Add cycle complete events
          for (let cycle = 1; cycle <= 110; cycle++) {
            await eventLogger.logCycleComplete(cycle, baselineDuration);
          }

          // Property: No degradation should be detected
          const alert = await service.detectStepDegradation(stepName, 10, 100);

          expect(alert).toBeNull();
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property 16.3: Degradation severity is correctly classified
   */
  test('Property 16.3: Degradation severity correctly classified (warning vs critical)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 3000 }), // baselineDuration
        fc.float({ min: Math.fround(1.51), max: Math.fround(3.0) }), // degradationMultiplier
        fc.constantFrom('step_1', 'step_2', 'step_3'), // stepName
        async (baselineDuration, degradationMultiplier, stepName) => {
          // Clean up for this iteration
          await prisma.auditLog.deleteMany({});

          const recentDuration = Math.floor(baselineDuration * degradationMultiplier);
          const expectedDegradationPercent = (degradationMultiplier - 1) * 100;

          // Create baseline data
          for (let cycle = 1; cycle <= 100; cycle++) {
            await eventLogger.logCycleStepComplete(cycle, stepName, 1, baselineDuration, {});
          }

          // Create recent data with degradation
          for (let cycle = 101; cycle <= 110; cycle++) {
            await eventLogger.logCycleStepComplete(cycle, stepName, 1, recentDuration, {});
          }

          // Add cycle complete events
          for (let cycle = 1; cycle <= 110; cycle++) {
            await eventLogger.logCycleComplete(cycle, baselineDuration);
          }

          const alert = await service.detectStepDegradation(stepName, 10, 100);

          expect(alert).not.toBeNull();

          // Property: Severity matches degradation percentage
          if (expectedDegradationPercent >= 100) {
            expect(alert!.severity).toBe('critical');
          } else {
            expect(alert!.severity).toBe('warning');
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property 16.4: Multiple steps can be monitored independently
   */
  test('Property 16.4: Multiple steps monitored independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            stepName: fc.constantFrom('step_a', 'step_b', 'step_c', 'step_d'),
            baselineDuration: fc.integer({ min: 100, max: 2000 }),
            isDegraded: fc.boolean(),
          }),
          { minLength: 2, maxLength: 4 }
        ),
        async (steps) => {
          // Clean up for this iteration
          await prisma.auditLog.deleteMany({});

          // Make step names unique
          const uniqueSteps = steps.map((s, i) => ({
            ...s,
            stepName: `step_${i}`,
          }));

          // Create data for each step
          for (const step of uniqueSteps) {
            const recentDuration = step.isDegraded
              ? Math.floor(step.baselineDuration * 2.0) // 100% degradation
              : Math.floor(step.baselineDuration * 1.2); // 20% increase (no degradation)

            // Baseline
            for (let cycle = 1; cycle <= 100; cycle++) {
              await eventLogger.logCycleStepComplete(
                cycle,
                step.stepName,
                1,
                step.baselineDuration,
                {}
              );
            }

            // Recent
            for (let cycle = 101; cycle <= 110; cycle++) {
              await eventLogger.logCycleStepComplete(cycle, step.stepName, 1, recentDuration, {});
            }
          }

          // Add cycle complete events
          for (let cycle = 1; cycle <= 110; cycle++) {
            await eventLogger.logCycleComplete(cycle, 1000);
          }

          // Property: Each step is evaluated independently
          const alerts = await service.detectAllStepDegradations(10, 100);

          const expectedDegradedCount = uniqueSteps.filter((s) => s.isDegraded).length;
          expect(alerts.length).toBe(expectedDegradedCount);

          // Property: Only degraded steps are flagged
          for (const alert of alerts) {
            const step = uniqueSteps.find((s) => s.stepName === alert.stepName);
            expect(step?.isDegraded).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 16.5: Degradation detection is consistent across different baseline sizes
   */
  test('Property 16.5: Detection consistent across different baseline sizes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 500, max: 2000 }), // baselineDuration
        fc.integer({ min: 20, max: 200 }), // baselineCycles
        fc.constantFrom('test_step_a', 'test_step_b'), // stepName
        async (baselineDuration, baselineCycles, stepName) => {
          // Clean up for this iteration
          await prisma.auditLog.deleteMany({});

          const recentDuration = Math.floor(baselineDuration * 2.0); // 100% degradation

          // Create baseline data
          for (let cycle = 1; cycle <= baselineCycles; cycle++) {
            await eventLogger.logCycleStepComplete(cycle, stepName, 1, baselineDuration, {});
          }

          // Create recent data (10 cycles)
          for (let cycle = baselineCycles + 1; cycle <= baselineCycles + 10; cycle++) {
            await eventLogger.logCycleStepComplete(cycle, stepName, 1, recentDuration, {});
          }

          // Add cycle complete events
          for (let cycle = 1; cycle <= baselineCycles + 10; cycle++) {
            await eventLogger.logCycleComplete(cycle, baselineDuration);
          }

          // Property: Degradation should be detected regardless of baseline size
          const alert = await service.detectStepDegradation(stepName, 10, baselineCycles);

          expect(alert).not.toBeNull();
          expect(alert!.degradationPercentage).toBeGreaterThanOrEqual(90); // ~100% degradation
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 16.6: Degradation alerts are sorted by severity
   */
  test('Property 16.6: Alerts sorted by degradation percentage (highest first)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            stepName: fc.constantFrom('s1', 's2', 's3', 's4', 's5'),
            degradationMultiplier: fc.float({ min: Math.fround(1.6), max: Math.fround(3.0) }),
          }),
          { minLength: 3, maxLength: 5 }
        ),
        async (steps) => {
          // Clean up for this iteration
          await prisma.auditLog.deleteMany({});

          // Make step names unique and assign baseline
          const uniqueSteps = steps.map((s, i) => ({
            stepName: `step_${i}`,
            baselineDuration: 1000,
            degradationMultiplier: s.degradationMultiplier,
          }));

          // Create data for each step
          for (const step of uniqueSteps) {
            const recentDuration = Math.floor(step.baselineDuration * step.degradationMultiplier);

            // Baseline
            for (let cycle = 1; cycle <= 100; cycle++) {
              await eventLogger.logCycleStepComplete(
                cycle,
                step.stepName,
                1,
                step.baselineDuration,
                {}
              );
            }

            // Recent
            for (let cycle = 101; cycle <= 110; cycle++) {
              await eventLogger.logCycleStepComplete(cycle, step.stepName, 1, recentDuration, {});
            }
          }

          // Add cycle complete events
          for (let cycle = 1; cycle <= 110; cycle++) {
            await eventLogger.logCycleComplete(cycle, 1000);
          }

          const alerts = await service.detectAllStepDegradations(10, 100);

          // Property: Alerts are sorted by degradation percentage (descending)
          for (let i = 1; i < alerts.length; i++) {
            expect(alerts[i - 1].degradationPercentage).toBeGreaterThanOrEqual(
              alerts[i].degradationPercentage
            );
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
