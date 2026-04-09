/**
 * Trend Helpers
 *
 * Shared statistical helpers for analytics endpoints:
 * moving averages and linear regression trend lines.
 */

export interface TrendLine {
  slope: number;
  intercept: number;
  points: Array<{ cycleNumber: number; value: number }>;
}

interface DataPointLike {
  cycleNumber: number;
}

/**
 * Calculate a 3-period moving average from ELO data points.
 */
export function calculateEloMovingAverage(
  dataPoints: Array<DataPointLike & { elo: number }>,
): number[] {
  const result: number[] = [];
  for (let i = 0; i < dataPoints.length; i++) {
    if (i < 2) {
      result.push(dataPoints[i].elo);
    } else {
      const avg =
        (dataPoints[i - 2].elo + dataPoints[i - 1].elo + dataPoints[i].elo) / 3;
      result.push(Math.round(avg * 100) / 100);
    }
  }
  return result;
}

/**
 * Calculate a linear regression trend line from data points.
 */
export function calculateTrendLine(
  dataPoints: Array<{ cycleNumber: number; value: number }>,
): TrendLine {
  const n = dataPoints.length;
  if (n === 0) {
    return { slope: 0, intercept: 0, points: [] };
  }

  const sumX = dataPoints.reduce((s, dp) => s + dp.cycleNumber, 0);
  const sumY = dataPoints.reduce((s, dp) => s + dp.value, 0);
  const sumXY = dataPoints.reduce((s, dp) => s + dp.cycleNumber * dp.value, 0);
  const sumX2 = dataPoints.reduce((s, dp) => s + dp.cycleNumber * dp.cycleNumber, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    // All x-values are identical — flat line at the mean
    const mean = sumY / n;
    return {
      slope: 0,
      intercept: Math.round(mean * 100) / 100,
      points: dataPoints.map((dp) => ({ cycleNumber: dp.cycleNumber, value: Math.round(mean * 100) / 100 })),
    };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const points = dataPoints.map((dp) => ({
    cycleNumber: dp.cycleNumber,
    value: Math.round((slope * dp.cycleNumber + intercept) * 100) / 100,
  }));

  return {
    slope: Math.round(slope * 100) / 100,
    intercept: Math.round(intercept * 100) / 100,
    points,
  };
}
