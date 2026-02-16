/**
 * Cycle Performance Monitoring Service
 * 
 * Detects performance degradation by analyzing cycle step durations over time.
 * Identifies slow steps and trends to help optimize cycle execution.
 * 
 * Requirements: 15.4
 */

import prisma from '../lib/prisma';

/**
 * Performance degradation alert
 */
export interface PerformanceDegradationAlert {
  stepName: string;
  currentAverageDuration: number;
  baselineAverageDuration: number;
  degradationPercentage: number;
  lastNCycles: number;
  baselineCycles: number;
  severity: 'warning' | 'critical';
}

/**
 * Cycle performance metrics
 */
export interface CyclePerformanceMetrics {
  cycleRange: [number, number];
  totalCycles: number;
  stepMetrics: {
    stepName: string;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    totalExecutions: number;
    trend: 'improving' | 'stable' | 'degrading';
  }[];
  slowestSteps: {
    stepName: string;
    averageDuration: number;
  }[];
  degradationAlerts: PerformanceDegradationAlert[];
}

/**
 * Step performance data
 */
interface StepPerformanceData {
  stepName: string;
  durations: number[];
  averageDuration: number;
}

/**
 * Cycle Performance Monitoring Service
 */
export class CyclePerformanceMonitoringService {
  /**
   * Detect performance degradation for a specific step
   * 
   * Compares the average duration over the last N cycles against the baseline
   * (previous M cycles). If the recent average exceeds 150% of the baseline,
   * it's flagged as degradation.
   */
  async detectStepDegradation(
    stepName: string,
    lastNCycles: number = 10,
    baselineCycles: number = 100
  ): Promise<PerformanceDegradationAlert | null> {
    // Get the most recent cycle number
    const latestCycle = await prisma.auditLog.findFirst({
      where: { eventType: 'cycle_complete' },
      orderBy: { cycleNumber: 'desc' },
      select: { cycleNumber: true },
    });

    if (!latestCycle) {
      return null;
    }

    const currentCycle = latestCycle.cycleNumber;

    // Get recent step durations (last N cycles)
    const recentSteps = await prisma.auditLog.findMany({
      where: {
        eventType: 'cycle_step_complete',
        cycleNumber: {
          gte: currentCycle - lastNCycles + 1,
          lte: currentCycle,
        },
        payload: {
          path: ['stepName'],
          equals: stepName,
        },
      },
      select: {
        payload: true,
      },
    });

    if (recentSteps.length === 0) {
      return null;
    }

    // Get baseline step durations (previous M cycles before the recent N)
    const baselineSteps = await prisma.auditLog.findMany({
      where: {
        eventType: 'cycle_step_complete',
        cycleNumber: {
          gte: currentCycle - lastNCycles - baselineCycles + 1,
          lt: currentCycle - lastNCycles + 1,
        },
        payload: {
          path: ['stepName'],
          equals: stepName,
        },
      },
      select: {
        payload: true,
      },
    });

    if (baselineSteps.length === 0) {
      return null; // Not enough baseline data
    }

    // Calculate averages
    const recentAverage =
      recentSteps.reduce((sum, s) => sum + ((s.payload as any).duration as number), 0) /
      recentSteps.length;

    const baselineAverage =
      baselineSteps.reduce((sum, s) => sum + ((s.payload as any).duration as number), 0) /
      baselineSteps.length;

    // Check for degradation (recent average > 150% of baseline)
    const degradationThreshold = baselineAverage * 1.5;
    const degradationPercentage = ((recentAverage - baselineAverage) / baselineAverage) * 100;

    if (recentAverage > degradationThreshold) {
      return {
        stepName,
        currentAverageDuration: Math.round(recentAverage),
        baselineAverageDuration: Math.round(baselineAverage),
        degradationPercentage: Math.round(degradationPercentage * 10) / 10,
        lastNCycles,
        baselineCycles,
        severity: degradationPercentage >= 100 ? 'critical' : 'warning', // >= 100% is critical
      };
    }

    return null;
  }

  /**
   * Detect degradation across all cycle steps
   */
  async detectAllStepDegradations(
    lastNCycles: number = 10,
    baselineCycles: number = 100
  ): Promise<PerformanceDegradationAlert[]> {
    // Get all unique step names
    const steps = await prisma.auditLog.findMany({
      where: {
        eventType: 'cycle_step_complete',
      },
      select: {
        payload: true,
      },
      distinct: ['payload'],
    });

    const uniqueStepNames = new Set<string>();
    for (const step of steps) {
      const stepName = (step.payload as any).stepName;
      if (stepName) {
        uniqueStepNames.add(stepName);
      }
    }

    // Check each step for degradation
    const alerts: PerformanceDegradationAlert[] = [];
    for (const stepName of uniqueStepNames) {
      const alert = await this.detectStepDegradation(stepName, lastNCycles, baselineCycles);
      if (alert) {
        alerts.push(alert);
      }
    }

    // Sort by degradation percentage (highest first)
    return alerts.sort((a, b) => b.degradationPercentage - a.degradationPercentage);
  }

  /**
   * Get performance metrics for a cycle range
   */
  async getCyclePerformanceMetrics(
    startCycle: number,
    endCycle: number
  ): Promise<CyclePerformanceMetrics> {
    // Get all step completion events in the range
    const stepEvents = await prisma.auditLog.findMany({
      where: {
        eventType: 'cycle_step_complete',
        cycleNumber: {
          gte: startCycle,
          lte: endCycle,
        },
      },
      select: {
        cycleNumber: true,
        payload: true,
      },
      orderBy: {
        cycleNumber: 'asc',
      },
    });

    // Group by step name
    const stepDataMap = new Map<string, StepPerformanceData>();

    for (const event of stepEvents) {
      const payload = event.payload as any;
      const stepName = payload.stepName as string;
      const duration = payload.duration as number;

      if (!stepDataMap.has(stepName)) {
        stepDataMap.set(stepName, {
          stepName,
          durations: [],
          averageDuration: 0,
        });
      }

      stepDataMap.get(stepName)!.durations.push(duration);
    }

    // Calculate metrics for each step
    const stepMetrics = Array.from(stepDataMap.values()).map((data) => {
      const durations = data.durations;
      const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);

      // Determine trend (compare first half vs second half)
      const midpoint = Math.floor(durations.length / 2);
      if (midpoint === 0) {
        // Not enough data for trend
        return {
          stepName: data.stepName,
          averageDuration: Math.round(average),
          minDuration: min,
          maxDuration: max,
          totalExecutions: durations.length,
          trend: 'stable' as const,
        };
      }

      const firstHalfAvg =
        durations.slice(0, midpoint).reduce((sum, d) => sum + d, 0) / midpoint;
      const secondHalfAvg =
        durations.slice(midpoint).reduce((sum, d) => sum + d, 0) / (durations.length - midpoint);

      let trend: 'improving' | 'stable' | 'degrading' = 'stable';
      const trendThreshold = 0.05; // 5% change threshold (more sensitive)

      if (secondHalfAvg < firstHalfAvg * (1 - trendThreshold)) {
        trend = 'improving';
      } else if (secondHalfAvg > firstHalfAvg * (1 + trendThreshold)) {
        trend = 'degrading';
      }

      return {
        stepName: data.stepName,
        averageDuration: Math.round(average),
        minDuration: min,
        maxDuration: max,
        totalExecutions: durations.length,
        trend,
      };
    });

    // Identify slowest steps (top 5)
    const slowestSteps = [...stepMetrics]
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 5)
      .map((s) => ({
        stepName: s.stepName,
        averageDuration: s.averageDuration,
      }));

    // Detect degradation alerts
    const degradationAlerts = await this.detectAllStepDegradations(10, 100);

    return {
      cycleRange: [startCycle, endCycle],
      totalCycles: endCycle - startCycle + 1,
      stepMetrics,
      slowestSteps,
      degradationAlerts,
    };
  }

  /**
   * Identify slow steps in a specific cycle
   */
  async identifySlowSteps(
    cycleNumber: number,
    thresholdMs: number = 5000
  ): Promise<{ stepName: string; duration: number; stepNumber: number }[]> {
    const stepEvents = await prisma.auditLog.findMany({
      where: {
        eventType: 'cycle_step_complete',
        cycleNumber,
      },
      select: {
        payload: true,
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });

    const slowSteps = stepEvents
      .map((event) => {
        const payload = event.payload as any;
        return {
          stepName: payload.stepName as string,
          duration: payload.duration as number,
          stepNumber: payload.stepNumber as number,
        };
      })
      .filter((step) => step.duration > thresholdMs)
      .sort((a, b) => b.duration - a.duration);

    return slowSteps;
  }

  /**
   * Get cycle execution trend (improving, stable, or degrading)
   */
  async getCycleExecutionTrend(lastNCycles: number = 20): Promise<{
    trend: 'improving' | 'stable' | 'degrading';
    averageDuration: number;
    recentAverageDuration: number;
    baselineAverageDuration: number;
    changePercentage: number;
  }> {
    // Get the most recent cycle number
    const latestCycle = await prisma.auditLog.findFirst({
      where: { eventType: 'cycle_complete' },
      orderBy: { cycleNumber: 'desc' },
      select: { cycleNumber: true },
    });

    if (!latestCycle) {
      throw new Error('No cycle data available');
    }

    const currentCycle = latestCycle.cycleNumber;

    // Get cycle complete events for the last N cycles
    const cycleEvents = await prisma.auditLog.findMany({
      where: {
        eventType: 'cycle_complete',
        cycleNumber: {
          gte: currentCycle - lastNCycles + 1,
          lte: currentCycle,
        },
      },
      select: {
        cycleNumber: true,
        payload: true,
      },
      orderBy: {
        cycleNumber: 'asc',
      },
    });

    if (cycleEvents.length < 2) {
      throw new Error('Not enough cycle data for trend analysis');
    }

    const durations = cycleEvents.map((e) => (e.payload as any).totalDuration as number);
    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;

    // Compare first half vs second half
    const midpoint = Math.floor(durations.length / 2);
    const baselineAvg = durations.slice(0, midpoint).reduce((sum, d) => sum + d, 0) / midpoint;
    const recentAvg =
      durations.slice(midpoint).reduce((sum, d) => sum + d, 0) / (durations.length - midpoint);

    const changePercentage = ((recentAvg - baselineAvg) / baselineAvg) * 100;
    const trendThreshold = 10; // 10% change threshold

    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (changePercentage < -trendThreshold) {
      trend = 'improving';
    } else if (changePercentage > trendThreshold) {
      trend = 'degrading';
    }

    return {
      trend,
      averageDuration: Math.round(averageDuration),
      recentAverageDuration: Math.round(recentAvg),
      baselineAverageDuration: Math.round(baselineAvg),
      changePercentage: Math.round(changePercentage * 10) / 10,
    };
  }
}

// Export singleton instance
export const cyclePerformanceMonitoringService = new CyclePerformanceMonitoringService();
