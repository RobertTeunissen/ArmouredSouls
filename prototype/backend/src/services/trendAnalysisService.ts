import { cycleSnapshotService } from './cycleSnapshotService';

/**
 * TrendAnalysisService
 * 
 * Responsibility: Analyze time-series data from cycle snapshots
 * 
 * This service provides:
 * 1. Time-series data extraction for various metrics
 * 2. Moving average calculations (3-cycle and 7-cycle)
 * 3. Trend line computation using linear regression
 * 4. Cumulative progression tracking (ELO, net profit)
 * 
 * Requirements: 7.5
 */

interface TimeSeriesDataPoint {
  cycleNumber: number;
  value: number;
  timestamp: Date;
}

interface MovingAveragePoint {
  cycleNumber: number;
  value: number;
  average: number;
}

interface TrendLine {
  slope: number;
  intercept: number;
  points: Array<{ cycleNumber: number; value: number }>;
}

interface TrendAnalysisResult {
  metric: string;
  cycleRange: [number, number];
  data: TimeSeriesDataPoint[];
  movingAverage3?: MovingAveragePoint[];
  movingAverage7?: MovingAveragePoint[];
  trendLine?: TrendLine;
}

type MetricType = 
  | 'income' 
  | 'expenses' 
  | 'netProfit' 
  | 'elo' 
  | 'fame' 
  | 'wins' 
  | 'losses' 
  | 'damageDealt' 
  | 'damageReceived';

export class TrendAnalysisService {
  /**
   * Analyze a metric over a cycle range
   * 
   * @param userId - User ID for stable-level metrics (null for robot-level)
   * @param robotId - Robot ID for robot-level metrics (null for stable-level)
   * @param metric - The metric to analyze
   * @param cycleRange - [startCycle, endCycle]
   * @param includeMovingAverage - Whether to calculate moving averages
   * @param includeTrendLine - Whether to calculate trend line
   */
  async analyzeTrend(
    userId: number | null,
    robotId: number | null,
    metric: MetricType,
    cycleRange: [number, number],
    includeMovingAverage: boolean = false,
    includeTrendLine: boolean = false
  ): Promise<TrendAnalysisResult> {
    const [startCycle, endCycle] = cycleRange;
    
    // Get snapshots for the cycle range
    const snapshots = await cycleSnapshotService.getSnapshotRange(startCycle, endCycle);
    
    // Extract time-series data based on metric type
    const data = this.extractTimeSeriesData(snapshots, userId, robotId, metric);
    
    const result: TrendAnalysisResult = {
      metric,
      cycleRange,
      data,
    };
    
    // Calculate moving averages if requested
    if (includeMovingAverage && data.length > 0) {
      result.movingAverage3 = this.calculateMovingAverage(data, 3);
      result.movingAverage7 = this.calculateMovingAverage(data, 7);
    }
    
    // Calculate trend line if requested
    if (includeTrendLine && data.length >= 2) {
      result.trendLine = this.calculateTrendLine(data);
    }
    
    return result;
  }
  
  /**
   * Extract time-series data from snapshots for a specific metric
   */
  private extractTimeSeriesData(
    snapshots: any[],
    userId: number | null,
    robotId: number | null,
    metric: MetricType
  ): TimeSeriesDataPoint[] {
    const dataPoints: TimeSeriesDataPoint[] = [];
    
    for (const snapshot of snapshots) {
      let value: number | undefined;
      
      if (userId !== null) {
        // Stable-level metrics
        const stableMetric = snapshot.stableMetrics?.find((m: any) => m.userId === userId);
        if (stableMetric) {
          value = this.extractStableMetricValue(stableMetric, metric);
        }
      } else if (robotId !== null) {
        // Robot-level metrics
        const robotMetric = snapshot.robotMetrics?.find((m: any) => m.robotId === robotId);
        if (robotMetric) {
          value = this.extractRobotMetricValue(robotMetric, metric);
        }
      }
      
      if (value !== undefined) {
        dataPoints.push({
          cycleNumber: snapshot.cycleNumber,
          value,
          timestamp: snapshot.endTime,
        });
      }
    }
    
    return dataPoints;
  }
  
  /**
   * Extract value from stable metric based on metric type
   */
  private extractStableMetricValue(stableMetric: any, metric: MetricType): number {
    switch (metric) {
      case 'income':
        return (stableMetric.totalCreditsEarned || 0) + 
               (stableMetric.merchandisingIncome || 0) + 
               (stableMetric.streamingIncome || 0);
      case 'expenses':
        return (stableMetric.totalRepairCosts || 0) + 
               (stableMetric.operatingCosts || 0);
      case 'netProfit':
        return stableMetric.netProfit || 0;
      default:
        return 0;
    }
  }
  
  /**
   * Extract value from robot metric based on metric type
   */
  private extractRobotMetricValue(robotMetric: any, metric: MetricType): number {
    switch (metric) {
      case 'elo':
        return robotMetric.eloChange || 0;
      case 'fame':
        return robotMetric.fameChange || 0;
      case 'wins':
        return robotMetric.wins || 0;
      case 'losses':
        return robotMetric.losses || 0;
      case 'damageDealt':
        return robotMetric.damageDealt || 0;
      case 'damageReceived':
        return robotMetric.damageReceived || 0;
      default:
        return 0;
    }
  }
  
  /**
   * Calculate moving average for a given window size
   * 
   * @param data - Time-series data points
   * @param windowSize - Size of the moving average window (e.g., 3, 7)
   * @returns Array of moving average points
   */
  private calculateMovingAverage(
    data: TimeSeriesDataPoint[],
    windowSize: number
  ): MovingAveragePoint[] {
    if (data.length < windowSize) {
      return [];
    }
    
    const movingAverages: MovingAveragePoint[] = [];
    
    for (let i = windowSize - 1; i < data.length; i++) {
      const window = data.slice(i - windowSize + 1, i + 1);
      const sum = window.reduce((acc, point) => acc + point.value, 0);
      const average = sum / windowSize;
      
      movingAverages.push({
        cycleNumber: data[i].cycleNumber,
        value: data[i].value,
        average,
      });
    }
    
    return movingAverages;
  }
  
  /**
   * Calculate trend line using linear regression
   * 
   * Uses least squares method to fit a line: y = mx + b
   * where m is the slope and b is the intercept
   * 
   * @param data - Time-series data points
   * @returns Trend line with slope, intercept, and predicted points
   */
  private calculateTrendLine(data: TimeSeriesDataPoint[]): TrendLine | undefined {
    if (data.length < 2) {
      return undefined;
    }
    
    const n = data.length;
    
    // Use cycle numbers as x values
    const x = data.map(d => d.cycleNumber);
    const y = data.map(d => d.value);
    
    // Calculate means
    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.reduce((sum, val) => sum + val, 0) / n;
    
    // Calculate slope (m) and intercept (b)
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (y[i] - yMean);
      denominator += (x[i] - xMean) * (x[i] - xMean);
    }
    
    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = yMean - slope * xMean;
    
    // Generate trend line points
    const points = data.map(d => ({
      cycleNumber: d.cycleNumber,
      value: slope * d.cycleNumber + intercept,
    }));
    
    return {
      slope,
      intercept,
      points,
    };
  }
  
  /**
   * Get cumulative ELO progression for a robot
   * 
   * This calculates the running total of ELO changes over time,
   * showing the robot's ELO progression relative to its starting point.
   * 
   * @param robotId - Robot ID
   * @param cycleRange - [startCycle, endCycle]
   * @returns Array of cumulative ELO data points
   */
  async getCumulativeELOProgression(
    robotId: number,
    cycleRange: [number, number]
  ): Promise<TimeSeriesDataPoint[]> {
    const [startCycle, endCycle] = cycleRange;
    const snapshots = await cycleSnapshotService.getSnapshotRange(startCycle, endCycle);
    
    const dataPoints: TimeSeriesDataPoint[] = [];
    let cumulativeELO = 0;
    
    for (const snapshot of snapshots) {
      const robotMetric = snapshot.robotMetrics?.find((m: any) => m.robotId === robotId);
      
      if (robotMetric) {
        cumulativeELO += robotMetric.eloChange || 0;
        
        dataPoints.push({
          cycleNumber: snapshot.cycleNumber,
          value: cumulativeELO,
          timestamp: snapshot.endTime,
        });
      }
    }
    
    return dataPoints;
  }
  
  /**
   * Get cumulative net profit for a user
   * 
   * This calculates the running total of net profit over time,
   * showing the user's wealth accumulation.
   * 
   * @param userId - User ID
   * @param cycleRange - [startCycle, endCycle]
   * @returns Array of cumulative net profit data points
   */
  async getCumulativeNetProfit(
    userId: number,
    cycleRange: [number, number]
  ): Promise<TimeSeriesDataPoint[]> {
    const [startCycle, endCycle] = cycleRange;
    const snapshots = await cycleSnapshotService.getSnapshotRange(startCycle, endCycle);
    
    const dataPoints: TimeSeriesDataPoint[] = [];
    let cumulativeProfit = 0;
    
    for (const snapshot of snapshots) {
      const stableMetric = snapshot.stableMetrics?.find((m: any) => m.userId === userId);
      
      if (stableMetric) {
        cumulativeProfit += stableMetric.netProfit || 0;
        
        dataPoints.push({
          cycleNumber: snapshot.cycleNumber,
          value: cumulativeProfit,
          timestamp: snapshot.endTime,
        });
      }
    }
    
    return dataPoints;
  }
}

// Export singleton instance
export const trendAnalysisService = new TrendAnalysisService();
