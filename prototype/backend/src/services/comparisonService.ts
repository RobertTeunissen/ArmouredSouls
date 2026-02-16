import { cycleSnapshotService } from './cycleSnapshotService';

/**
 * ComparisonService
 * 
 * Responsibility: Compare cycle data for historical analysis
 * 
 * This service provides cycle-to-cycle comparison functionality:
 * 1. Retrieves snapshots for current and comparison cycles
 * 2. Calculates absolute deltas between metrics
 * 3. Calculates percentage changes
 * 4. Handles missing data gracefully
 * 
 * Requirements: 6.1, 6.2, 6.3
 */

interface StableMetric {
  userId: number;
  battlesParticipated: number;
  totalCreditsEarned: number;
  totalPrestigeEarned: number;
  totalRepairCosts: number;
  merchandisingIncome: number;
  streamingIncome: number;
  operatingCosts: number;
  netProfit: number;
}

interface RobotMetric {
  robotId: number;
  battlesParticipated: number;
  wins: number;
  losses: number;
  draws: number;
  damageDealt: number;
  damageReceived: number;
  creditsEarned: number;
  eloChange: number;
  fameChange: number;
}

interface MetricComparison {
  current: number;
  comparison: number;
  delta: number;
  percentChange: number | null;
}

interface StableComparison {
  userId: number;
  battlesParticipated: MetricComparison;
  totalCreditsEarned: MetricComparison;
  totalPrestigeEarned: MetricComparison;
  totalRepairCosts: MetricComparison;
  merchandisingIncome: MetricComparison;
  streamingIncome: MetricComparison;
  operatingCosts: MetricComparison;
  netProfit: MetricComparison;
}

interface RobotComparison {
  robotId: number;
  battlesParticipated: MetricComparison;
  wins: MetricComparison;
  losses: MetricComparison;
  draws: MetricComparison;
  damageDealt: MetricComparison;
  damageReceived: MetricComparison;
  creditsEarned: MetricComparison;
  eloChange: MetricComparison;
  fameChange: MetricComparison;
}

interface ComparisonResult {
  currentCycle: number;
  comparisonCycle: number;
  stableComparisons: StableComparison[];
  robotComparisons: RobotComparison[];
  unavailableMetrics?: string[];
}

export class ComparisonService {
  /**
   * Compare two cycles for a specific user
   * Returns comparison of all stable and robot metrics
   */
  async compareCycles(
    currentCycle: number,
    comparisonCycle: number,
    userId?: number
  ): Promise<ComparisonResult> {
    console.log(`[ComparisonService] Comparing cycle ${currentCycle} vs ${comparisonCycle}`);

    // Retrieve snapshots
    const currentSnapshot = await cycleSnapshotService.getSnapshot(currentCycle);
    const comparisonSnapshot = await cycleSnapshotService.getSnapshot(comparisonCycle);

    // Handle missing snapshots
    if (!currentSnapshot) {
      throw new Error(`Current cycle ${currentCycle} snapshot not found`);
    }

    if (!comparisonSnapshot) {
      return {
        currentCycle,
        comparisonCycle,
        stableComparisons: [],
        robotComparisons: [],
        unavailableMetrics: ['all'],
      };
    }

    // Filter by userId if provided
    const currentStableMetrics = userId
      ? currentSnapshot.stableMetrics.filter(m => m.userId === userId)
      : currentSnapshot.stableMetrics;

    const comparisonStableMetrics = userId
      ? comparisonSnapshot.stableMetrics.filter(m => m.userId === userId)
      : comparisonSnapshot.stableMetrics;

    // Compare stable metrics
    const stableComparisons = this.compareStableMetrics(
      currentStableMetrics,
      comparisonStableMetrics
    );

    // Compare robot metrics (filter by user's robots if userId provided)
    let currentRobotMetrics = currentSnapshot.robotMetrics;
    let comparisonRobotMetrics = comparisonSnapshot.robotMetrics;

    if (userId) {
      // Get robot IDs for this user from stable metrics
      const userRobotIds = new Set<number>();
      currentStableMetrics.forEach(m => {
        currentSnapshot.robotMetrics
          .filter(r => r.robotId)
          .forEach(r => userRobotIds.add(r.robotId));
      });

      currentRobotMetrics = currentRobotMetrics.filter(m => userRobotIds.has(m.robotId));
      comparisonRobotMetrics = comparisonRobotMetrics.filter(m => userRobotIds.has(m.robotId));
    }

    const robotComparisons = this.compareRobotMetrics(
      currentRobotMetrics,
      comparisonRobotMetrics
    );

    return {
      currentCycle,
      comparisonCycle,
      stableComparisons,
      robotComparisons,
    };
  }

  /**
   * Compare stable metrics between two cycles
   */
  private compareStableMetrics(
    current: StableMetric[],
    comparison: StableMetric[]
  ): StableComparison[] {
    const comparisons: StableComparison[] = [];

    // Create a map of comparison metrics by userId
    const comparisonMap = new Map<number, StableMetric>();
    comparison.forEach(m => comparisonMap.set(m.userId, m));

    // Compare each current metric with its comparison
    current.forEach(currentMetric => {
      const comparisonMetric = comparisonMap.get(currentMetric.userId);

      // If no comparison data exists, use zeros
      const comparisonData: StableMetric = comparisonMetric || {
        userId: currentMetric.userId,
        battlesParticipated: 0,
        totalCreditsEarned: 0,
        totalPrestigeEarned: 0,
        totalRepairCosts: 0,
        merchandisingIncome: 0,
        streamingIncome: 0,
        operatingCosts: 0,
        netProfit: 0,
      };

      comparisons.push({
        userId: currentMetric.userId,
        battlesParticipated: this.compareMetric(
          currentMetric.battlesParticipated,
          comparisonData.battlesParticipated
        ),
        totalCreditsEarned: this.compareMetric(
          currentMetric.totalCreditsEarned,
          comparisonData.totalCreditsEarned
        ),
        totalPrestigeEarned: this.compareMetric(
          currentMetric.totalPrestigeEarned,
          comparisonData.totalPrestigeEarned
        ),
        totalRepairCosts: this.compareMetric(
          currentMetric.totalRepairCosts,
          comparisonData.totalRepairCosts
        ),
        merchandisingIncome: this.compareMetric(
          currentMetric.merchandisingIncome,
          comparisonData.merchandisingIncome
        ),
        streamingIncome: this.compareMetric(
          currentMetric.streamingIncome,
          comparisonData.streamingIncome
        ),
        operatingCosts: this.compareMetric(
          currentMetric.operatingCosts,
          comparisonData.operatingCosts
        ),
        netProfit: this.compareMetric(
          currentMetric.netProfit,
          comparisonData.netProfit
        ),
      });
    });

    return comparisons;
  }

  /**
   * Compare robot metrics between two cycles
   */
  private compareRobotMetrics(
    current: RobotMetric[],
    comparison: RobotMetric[]
  ): RobotComparison[] {
    const comparisons: RobotComparison[] = [];

    // Create a map of comparison metrics by robotId
    const comparisonMap = new Map<number, RobotMetric>();
    comparison.forEach(m => comparisonMap.set(m.robotId, m));

    // Compare each current metric with its comparison
    current.forEach(currentMetric => {
      const comparisonMetric = comparisonMap.get(currentMetric.robotId);

      // If no comparison data exists, use zeros
      const comparisonData: RobotMetric = comparisonMetric || {
        robotId: currentMetric.robotId,
        battlesParticipated: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        damageDealt: 0,
        damageReceived: 0,
        creditsEarned: 0,
        eloChange: 0,
        fameChange: 0,
      };

      comparisons.push({
        robotId: currentMetric.robotId,
        battlesParticipated: this.compareMetric(
          currentMetric.battlesParticipated,
          comparisonData.battlesParticipated
        ),
        wins: this.compareMetric(
          currentMetric.wins,
          comparisonData.wins
        ),
        losses: this.compareMetric(
          currentMetric.losses,
          comparisonData.losses
        ),
        draws: this.compareMetric(
          currentMetric.draws,
          comparisonData.draws
        ),
        damageDealt: this.compareMetric(
          currentMetric.damageDealt,
          comparisonData.damageDealt
        ),
        damageReceived: this.compareMetric(
          currentMetric.damageReceived,
          comparisonData.damageReceived
        ),
        creditsEarned: this.compareMetric(
          currentMetric.creditsEarned,
          comparisonData.creditsEarned
        ),
        eloChange: this.compareMetric(
          currentMetric.eloChange,
          comparisonData.eloChange
        ),
        fameChange: this.compareMetric(
          currentMetric.fameChange,
          comparisonData.fameChange
        ),
      });
    });

    return comparisons;
  }

  /**
   * Compare a single metric value
   * Calculates delta and percentage change
   */
  private compareMetric(current: number, comparison: number): MetricComparison {
    const delta = current - comparison;
    
    // Calculate percentage change
    // If comparison is 0, percentage change is null (undefined/infinite)
    let percentChange: number | null = null;
    if (comparison !== 0) {
      percentChange = (delta / comparison) * 100;
    } else if (current !== 0) {
      // If comparison is 0 but current is not, it's infinite growth
      percentChange = null;
    }

    return {
      current,
      comparison,
      delta,
      percentChange,
    };
  }

  /**
   * Get available cycle range for comparisons
   * Returns the min and max cycle numbers that have snapshots
   */
  async getAvailableCycleRange(): Promise<{ min: number; max: number } | null> {
    const snapshots = await cycleSnapshotService.getSnapshotRange(1, 999999);
    
    if (snapshots.length === 0) {
      return null;
    }

    const cycleNumbers = snapshots.map(s => s.cycleNumber);
    return {
      min: Math.min(...cycleNumbers),
      max: Math.max(...cycleNumbers),
    };
  }
}

// Export singleton instance
export const comparisonService = new ComparisonService();
