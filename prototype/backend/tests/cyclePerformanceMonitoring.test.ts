/**
 * Cycle Performance Monitoring Service Tests
 * Tests for performance degradation detection and cycle performance metrics
 * Validates Requirement 15.4
 */

import { CyclePerformanceMonitoringService } from '../src/services/cyclePerformanceMonitoringService';
import { EventLogger } from '../src/services/eventLogger';
import prisma from '../src/lib/prisma';

describe('Cycle Performance Monitoring Service', () => {
  let service: CyclePerformanceMonitoringService;
  let eventLogger: EventLogger;

  beforeAll(() => {
    service = new CyclePerformanceMonitoringService();
    eventLogger = new EventLogger();
  });

  beforeEach(async () => {
    // Clean up audit logs
    await prisma.auditLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('detectStepDegradation', () => {
    it('should detect performance degradation when recent average exceeds 150% of baseline', async () => {
      const stepName = 'execute_battles';

      // Create baseline data (cycles 1-100) with average duration of 1000ms
      for (let cycle = 1; cycle <= 100; cycle++) {
        await eventLogger.logCycleStart(cycle, 'manual');
        await eventLogger.logCycleStepComplete(cycle, stepName, 1, 1000, {});
        await eventLogger.logCycleComplete(cycle, 1000);
      }

      // Create recent data (cycles 101-110) with average duration of 2000ms (200% of baseline)
      for (let cycle = 101; cycle <= 110; cycle++) {
        await eventLogger.logCycleStart(cycle, 'manual');
        await eventLogger.logCycleStepComplete(cycle, stepName, 1, 2000, {});
        await eventLogger.logCycleComplete(cycle, 2000);
      }

      const alert = await service.detectStepDegradation(stepName, 10, 100);

      expect(alert).not.toBeNull();
      expect(alert!.stepName).toBe(stepName);
      expect(alert!.currentAverageDuration).toBe(2000);
      expect(alert!.baselineAverageDuration).toBe(1000);
      expect(alert!.degradationPercentage).toBe(100);
      expect(alert!.severity).toBe('critical'); // > 100% degradation
    });

    it('should not detect degradation when recent average is within threshold', async () => {
      const stepName = 'repair_robots';

      // Create baseline data with average duration of 1000ms
      for (let cycle = 1; cycle <= 100; cycle++) {
        await eventLogger.logCycleStart(cycle, 'manual');
        await eventLogger.logCycleStepComplete(cycle, stepName, 1, 1000, {});
        await eventLogger.logCycleComplete(cycle, 1000);
      }

      // Create recent data with average duration of 1200ms (120% of baseline, below 150% threshold)
      for (let cycle = 101; cycle <= 110; cycle++) {
        await eventLogger.logCycleStart(cycle, 'manual');
        await eventLogger.logCycleStepComplete(cycle, stepName, 1, 1200, {});
        await eventLogger.logCycleComplete(cycle, 1200);
      }

      const alert = await service.detectStepDegradation(stepName, 10, 100);

      expect(alert).toBeNull();
    });

    it('should return null when there is no baseline data', async () => {
      const stepName = 'matchmaking';

      // Only create recent data (no baseline)
      for (let cycle = 1; cycle <= 10; cycle++) {
        await eventLogger.logCycleStart(cycle, 'manual');
        await eventLogger.logCycleStepComplete(cycle, stepName, 1, 1000, {});
        await eventLogger.logCycleComplete(cycle, 1000);
      }

      const alert = await service.detectStepDegradation(stepName, 10, 100);

      expect(alert).toBeNull();
    });

    it('should classify degradation severity correctly', async () => {
      const stepName = 'tournament_execution';

      // Baseline: 1000ms
      for (let cycle = 1; cycle <= 100; cycle++) {
        await eventLogger.logCycleStart(cycle, 'manual');
        await eventLogger.logCycleStepComplete(cycle, stepName, 1, 1000, {});
        await eventLogger.logCycleComplete(cycle, 1000);
      }

      // Recent: 1800ms (80% degradation - warning level)
      for (let cycle = 101; cycle <= 110; cycle++) {
        await eventLogger.logCycleStart(cycle, 'manual');
        await eventLogger.logCycleStepComplete(cycle, stepName, 1, 1800, {});
        await eventLogger.logCycleComplete(cycle, 1800);
      }

      const alert = await service.detectStepDegradation(stepName, 10, 100);

      expect(alert).not.toBeNull();
      expect(alert!.severity).toBe('warning'); // < 100% degradation
    });
  });

  describe('detectAllStepDegradations', () => {
    it('should detect degradation across multiple steps', async () => {
      // Create baseline and recent data for multiple steps
      const steps = [
        { name: 'step1', baseline: 1000, recent: 2000 }, // Degraded
        { name: 'step2', baseline: 500, recent: 600 }, // Not degraded
        { name: 'step3', baseline: 2000, recent: 4000 }, // Degraded
      ];

      for (const step of steps) {
        // Baseline
        for (let cycle = 1; cycle <= 100; cycle++) {
          await eventLogger.logCycleStepComplete(cycle, step.name, 1, step.baseline, {});
        }

        // Recent
        for (let cycle = 101; cycle <= 110; cycle++) {
          await eventLogger.logCycleStepComplete(cycle, step.name, 1, step.recent, {});
        }
      }

      // Add cycle complete events
      for (let cycle = 1; cycle <= 110; cycle++) {
        await eventLogger.logCycleComplete(cycle, 5000);
      }

      const alerts = await service.detectAllStepDegradations(10, 100);

      expect(alerts.length).toBe(2); // Only step1 and step3 should be flagged
      expect(alerts[0].stepName).toBe('step3'); // Highest degradation first
      expect(alerts[1].stepName).toBe('step1');
    });
  });

  describe('getCyclePerformanceMetrics', () => {
    it('should calculate performance metrics for a cycle range', async () => {
      // Create data for cycles 1-20
      for (let cycle = 1; cycle <= 20; cycle++) {
        await eventLogger.logCycleStart(cycle, 'manual');
        await eventLogger.logCycleStepComplete(cycle, 'step1', 1, 1000 + cycle * 10, {});
        await eventLogger.logCycleStepComplete(cycle, 'step2', 2, 500, {});
        await eventLogger.logCycleComplete(cycle, 1500 + cycle * 10);
      }

      const metrics = await service.getCyclePerformanceMetrics(1, 20);

      expect(metrics.cycleRange).toEqual([1, 20]);
      expect(metrics.totalCycles).toBe(20);
      expect(metrics.stepMetrics).toHaveLength(2);

      const step1Metrics = metrics.stepMetrics.find((s) => s.stepName === 'step1');
      expect(step1Metrics).toBeDefined();
      expect(step1Metrics!.totalExecutions).toBe(20);
      expect(step1Metrics!.averageDuration).toBeGreaterThan(1000);
      expect(step1Metrics!.trend).toBe('degrading'); // Duration increases over time
    });

    it('should identify slowest steps', async () => {
      // Create steps with different durations
      for (let cycle = 1; cycle <= 10; cycle++) {
        await eventLogger.logCycleStepComplete(cycle, 'fast_step', 1, 100, {});
        await eventLogger.logCycleStepComplete(cycle, 'medium_step', 2, 500, {});
        await eventLogger.logCycleStepComplete(cycle, 'slow_step', 3, 2000, {});
      }

      const metrics = await service.getCyclePerformanceMetrics(1, 10);

      expect(metrics.slowestSteps).toHaveLength(3);
      expect(metrics.slowestSteps[0].stepName).toBe('slow_step');
      expect(metrics.slowestSteps[0].averageDuration).toBe(2000);
    });
  });

  describe('identifySlowSteps', () => {
    it('should identify steps exceeding threshold in a specific cycle', async () => {
      const cycleNumber = 1;

      await eventLogger.logCycleStart(cycleNumber, 'manual');
      await eventLogger.logCycleStepComplete(cycleNumber, 'fast_step', 1, 100, {});
      await eventLogger.logCycleStepComplete(cycleNumber, 'slow_step', 2, 6000, {});
      await eventLogger.logCycleStepComplete(cycleNumber, 'very_slow_step', 3, 10000, {});
      await eventLogger.logCycleComplete(cycleNumber, 16100);

      const slowSteps = await service.identifySlowSteps(cycleNumber, 5000);

      expect(slowSteps).toHaveLength(2);
      expect(slowSteps[0].stepName).toBe('very_slow_step');
      expect(slowSteps[0].duration).toBe(10000);
      expect(slowSteps[1].stepName).toBe('slow_step');
      expect(slowSteps[1].duration).toBe(6000);
    });

    it('should return empty array when no steps exceed threshold', async () => {
      const cycleNumber = 1;

      await eventLogger.logCycleStart(cycleNumber, 'manual');
      await eventLogger.logCycleStepComplete(cycleNumber, 'step1', 1, 1000, {});
      await eventLogger.logCycleStepComplete(cycleNumber, 'step2', 2, 2000, {});
      await eventLogger.logCycleComplete(cycleNumber, 3000);

      const slowSteps = await service.identifySlowSteps(cycleNumber, 5000);

      expect(slowSteps).toHaveLength(0);
    });
  });

  describe('getCycleExecutionTrend', () => {
    it('should detect improving trend when recent cycles are faster', async () => {
      // First half: slower cycles (2000ms)
      for (let cycle = 1; cycle <= 10; cycle++) {
        await eventLogger.logCycleStart(cycle, 'manual');
        await eventLogger.logCycleComplete(cycle, 2000);
      }

      // Second half: faster cycles (1000ms)
      for (let cycle = 11; cycle <= 20; cycle++) {
        await eventLogger.logCycleStart(cycle, 'manual');
        await eventLogger.logCycleComplete(cycle, 1000);
      }

      const trend = await service.getCycleExecutionTrend(20);

      expect(trend.trend).toBe('improving');
      expect(trend.baselineAverageDuration).toBe(2000);
      expect(trend.recentAverageDuration).toBe(1000);
      expect(trend.changePercentage).toBe(-50);
    });

    it('should detect degrading trend when recent cycles are slower', async () => {
      // First half: faster cycles (1000ms)
      for (let cycle = 1; cycle <= 10; cycle++) {
        await eventLogger.logCycleStart(cycle, 'manual');
        await eventLogger.logCycleComplete(cycle, 1000);
      }

      // Second half: slower cycles (2000ms)
      for (let cycle = 11; cycle <= 20; cycle++) {
        await eventLogger.logCycleStart(cycle, 'manual');
        await eventLogger.logCycleComplete(cycle, 2000);
      }

      const trend = await service.getCycleExecutionTrend(20);

      expect(trend.trend).toBe('degrading');
      expect(trend.baselineAverageDuration).toBe(1000);
      expect(trend.recentAverageDuration).toBe(2000);
      expect(trend.changePercentage).toBe(100);
    });

    it('should detect stable trend when durations are consistent', async () => {
      // All cycles: consistent duration (1500ms)
      for (let cycle = 1; cycle <= 20; cycle++) {
        await eventLogger.logCycleStart(cycle, 'manual');
        await eventLogger.logCycleComplete(cycle, 1500);
      }

      const trend = await service.getCycleExecutionTrend(20);

      expect(trend.trend).toBe('stable');
      expect(trend.changePercentage).toBe(0);
    });
  });
});
