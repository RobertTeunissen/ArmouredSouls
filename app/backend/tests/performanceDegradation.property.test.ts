/**
 * Property-Based Tests for Performance Degradation Detection
 * Property 16: Performance Degradation Detection
 * 
 * For any cycle step, if the average duration over the last 10 cycles exceeds 
 * 150% of the average duration over the previous 100 cycles, the Analytics 
 * Engine should flag it as a performance degradation.
 * 
 * Validates: Requirements 15.4
 *
 * Every `fc.float` here passes `noNaN: true`. fast-check generates NaN from a bounded
 * `fc.float`/`fc.double` unless told not to, and NaN is not a value a duration multiplier
 * can take — durations are measured milliseconds. Without it, `Math.floor(baseline * NaN)`
 * produced a NaN duration, the service found no degradation, and Property 16.1 failed on
 * roughly one run in three: seed 1966233560 gave the counterexample [100, NaN, "step_a"].
 * Property 16.2 hid the same defect because it asserts the alert IS null, which NaN
 * satisfies for the wrong reason.
 */

import fc from 'fast-check';
import { CyclePerformanceMonitoringService } from '../src/services/cycle/cyclePerformanceMonitoringService';
import { EventLogger } from '../src/services/common/eventLogger';
import prisma from '../src/lib/prisma';

/**
 * This suite writes roughly 13,000 `audit_logs` rows: six properties x 10 runs x ~220
 * events, each event taking the Spec #51 advisory lock to allocate its sequence number.
 * It measures around 38s on a quiet machine, which leaves no headroom under the tier's
 * 60s default and made it the second-most likely suite in the tier to time out under
 * load. The timeout is raised rather than the run count reduced — a timeout is not an
 * assertion, and cutting `numRuns` would cut the coverage this property exists for.
 */
jest.setTimeout(180_000);

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
        fc.float({ min: Math.fround(1.52), max: Math.fround(3.0), noNaN: true, noDefaultInfinity: true }), // degradationMultiplier (> 1.5, with margin for Math.floor)
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
      { numRuns: 10 }
    );
  });

  /**
   * Property 16.2: No degradation when recent average is below 150% threshold
   */
  test('Property 16.2: No degradation when recent average <= 150% of baseline', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 5000 }), // baselineDuration
        fc.float({ min: Math.fround(0.5), max: Math.fround(1.5), noNaN: true, noDefaultInfinity: true }), // multiplier (<= 1.5)
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
      { numRuns: 10 }
    );
  });

  /**
   * Property 16.3: Degradation severity is correctly classified
   */
  test('Property 16.3: Degradation severity correctly classified (warning vs critical)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 3000 }), // baselineDuration
        // Lower bound 1.55, not 1.51. The service alerts only when the recent average
        // is STRICTLY above 1.5x the baseline, and two roundings sit between the
        // multiplier and that comparison: Math.fround(1.51) is 1.5099999904632568, and
        // Math.floor then pulls the duration down again. At baseline 100 that produced
        // exactly 150 — not greater than the 150 threshold — so no alert was raised and
        // the property failed on its own generator rather than on the service. 1.55
        // clears the threshold for every baseline in range: 0.05 x 100 = 5 exceeds the
        // most a floor can remove.
        fc.float({ min: Math.fround(1.55), max: Math.fround(3.0), noNaN: true, noDefaultInfinity: true }), // degradationMultiplier
        fc.constantFrom('step_1', 'step_2', 'step_3'), // stepName
        async (baselineDuration, degradationMultiplier, stepName) => {
          // Clean up for this iteration
          await prisma.auditLog.deleteMany({});

          const recentDuration = Math.floor(baselineDuration * degradationMultiplier);
          // The precondition this property depends on, stated rather than assumed.
          expect(recentDuration).toBeGreaterThan(baselineDuration * 1.5);
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
      { numRuns: 10 }
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
      { numRuns: 10 }
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
      { numRuns: 10 }
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
            degradationMultiplier: fc.float({ min: Math.fround(1.6), max: Math.fround(3.0), noNaN: true, noDefaultInfinity: true }),
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
      { numRuns: 10 }
    );
  });
});
