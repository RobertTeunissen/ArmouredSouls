/**
 * RobotPerformanceService
 * 
 * Responsibility: Query and aggregate robot performance data from Battle table and cycle snapshots
 * 
 * This service provides:
 * 1. Battle statistics for a specific robot over a cycle range
 * 2. Win rates and earnings calculations
 * 3. ELO progression data
 * 4. Damage dealt/received aggregation
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';

/** BattleParticipant with included battle select fields, as returned by metric progression queries */
type ParticipantWithBattle = Prisma.BattleParticipantGetPayload<{
  include: {
    battle: {
      select: {
        id: true;
        winnerId: true;
        createdAt: true;
      };
    };
  };
}>;

/**
 * Robot performance summary interface
 */
export interface RobotPerformanceSummary {
  robotId: number;
  cycleRange: [number, number];
  battlesParticipated: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // Percentage (0-100)
  damageDealt: number;
  damageReceived: number;
  totalCreditsEarned: number;
  totalFameEarned: number;
  totalRepairCosts: number;
  kills: number;
  destructions: number;
  eloChange: number;
  eloStart: number;
  eloEnd: number;
}

/**
 * ELO progression data point
 */
export interface ELODataPoint {
  cycleNumber: number;
  elo: number;
  change: number;
}

/**
 * ELO progression data
 */
export interface ELOProgressionData {
  robotId: number;
  cycleRange: [number, number];
  dataPoints: ELODataPoint[];
  startElo: number;
  endElo: number;
  totalChange: number;
  averageChange: number;
}

/**
 * Supported metrics for progression tracking
 */
export type RobotMetric = 'elo' | 'fame' | 'damageDealt' | 'damageReceived' | 'wins' | 'losses' | 'draws' | 'kills' | 'creditsEarned';

/**
 * Generic metric progression data point
 */
export interface MetricDataPoint {
  cycleNumber: number;
  value: number;
  change: number;
}

/**
 * Generic metric progression data
 */
export interface MetricProgressionData {
  robotId: number;
  metric: RobotMetric;
  cycleRange: [number, number];
  dataPoints: MetricDataPoint[];
  startValue: number;
  endValue: number;
  totalChange: number;
  averageChange: number;
  movingAverage?: number[]; // Optional moving average values
}

export class RobotPerformanceService {

  /**
   * Get metric progression data for a robot over a cycle range
   * Supports multiple metrics: elo, fame, damageDealt, damageReceived, wins, losses, creditsEarned
   */
  async getRobotMetricProgression(
    robotId: number,
    metric: RobotMetric,
    cycleRange: [number, number]
  ): Promise<MetricProgressionData> {
    const [startCycle, endCycle] = cycleRange;

    // Get cycle time range
    const startTime = await this.getCycleStartTime(startCycle);
    const endTime = await this.getCycleEndTime(endCycle);

    // Query all battle participants for this robot in the cycle range
    const participants = await prisma.battleParticipant.findMany({
      where: {
        robotId,
        battle: {
          createdAt: {
            gte: startTime,
            lte: endTime,
          },
        },
      },
      include: {
        battle: {
          select: {
            id: true,
            winnerId: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        battle: {
          createdAt: 'asc',
        },
      },
    });

    // Build metric progression data points
    const dataPoints: MetricDataPoint[] = [];
    let startValue = 0;
    let endValue = 0;
    let totalChange = 0;

    // Group participants by cycle (batch query to avoid N+1)
    const participantsByCycle = new Map<number, typeof participants>();
    const timestamps = participants.map(p => p.battle.createdAt);
    const cycleMap = await this.batchGetCycleNumbers(timestamps);
    
    for (let i = 0; i < participants.length; i++) {
      const cycleNumber = cycleMap.get(i) ?? 1;
      if (!participantsByCycle.has(cycleNumber)) {
        participantsByCycle.set(cycleNumber, []);
      }
      participantsByCycle.get(cycleNumber)!.push(participants[i]);
    }

    // Extract metric value from participant based on metric type
    const extractMetricValue = (participant: ParticipantWithBattle, metric: RobotMetric): number => {
      switch (metric) {
        case 'elo':
          return participant.eloAfter;
        case 'fame':
          return participant.fameAwarded;
        case 'damageDealt':
          return participant.damageDealt;
        case 'damageReceived':
          // Note: damageReceived not directly stored, would need to query opponents
          return 0; // Will calculate separately if needed
        case 'wins':
          return participant.battle.winnerId === robotId ? 1 : 0;
        case 'losses':
          return participant.battle.winnerId !== null && participant.battle.winnerId !== robotId ? 1 : 0;
        case 'draws':
          return participant.battle.winnerId === null ? 1 : 0;
        case 'kills':
          // Would need to check if opponents were destroyed
          return 0; // Will calculate separately if needed
        case 'creditsEarned':
          return participant.credits;
        default:
          return 0;
      }
    };

    // Get starting value for the metric
    const getStartingValue = (participant: ParticipantWithBattle, metric: RobotMetric): number => {
      if (metric === 'elo') {
        return participant.eloBefore;
      }
      return 0; // For cumulative metrics, start at 0
    };

    // Create data points per cycle
    let cumulativeValue = 0;
    let isFirstParticipant = true;

    for (let cycle = startCycle; cycle <= endCycle; cycle++) {
      const cycleParticipants = participantsByCycle.get(cycle) || [];
      
      if (cycleParticipants.length === 0) continue;

      // Calculate total change in this cycle
      let cycleChange = 0;
      let cycleEndValue = 0;

      for (const participant of cycleParticipants) {
        // Set starting value from first participant
        if (isFirstParticipant) {
          startValue = getStartingValue(participant, metric);
          if (metric !== 'elo') {
            cumulativeValue = startValue;
          }
          isFirstParticipant = false;
        }

        // Extract metric value
        const value = extractMetricValue(participant, metric);

        if (metric === 'elo') {
          // For ELO, track the change
          cycleChange += participant.eloAfter - participant.eloBefore;
          cycleEndValue = participant.eloAfter;
        } else {
          // For cumulative metrics (fame, damage, wins, losses, credits), accumulate
          cycleChange += value;
          cumulativeValue += value;
          cycleEndValue = cumulativeValue;
        }
      }

      dataPoints.push({
        cycleNumber: cycle,
        value: cycleEndValue,
        change: cycleChange,
      });

      totalChange += cycleChange;
    }

    // Get start and end values
    if (participants.length > 0) {
      const firstParticipant = participants[0];
      const lastParticipant = participants[participants.length - 1];
      
      startValue = getStartingValue(firstParticipant, metric);
      
      if (metric === 'elo') {
        endValue = lastParticipant.eloAfter;
      } else {
        // For cumulative metrics, end value is the cumulative total
        endValue = cumulativeValue;
      }
    }

    const averageChange = dataPoints.length > 0 
      ? totalChange / dataPoints.length 
      : 0;

    // Calculate moving average (simple 3-period moving average)
    const movingAverage: number[] = [];
    for (let i = 0; i < dataPoints.length; i++) {
      if (i < 2) {
        movingAverage.push(dataPoints[i].value);
      } else {
        const avg = (dataPoints[i - 2].value + dataPoints[i - 1].value + dataPoints[i].value) / 3;
        movingAverage.push(Math.round(avg * 100) / 100);
      }
    }

    return {
      robotId,
      metric,
      cycleRange,
      dataPoints,
      startValue,
      endValue,
      totalChange,
      averageChange: Math.round(averageChange * 100) / 100,
      movingAverage,
    };
  }

  /**
   * Get cycle start time from audit log or fallback to epoch
   * 
   * Returns the start time for a cycle. If no audit log or snapshot exists,
   * returns epoch (very old date) to allow queries to work for cycles without
   * explicit start time records. This enables analytics to display completed
   * cycles even when cycle metadata is missing.
   */
  private async getCycleStartTime(cycleNumber: number): Promise<Date> {
    const event = await prisma.auditLog.findFirst({
      where: {
        cycleNumber,
        eventType: 'cycle_start',
      },
    });

    if (!event) {
      // Fallback: use cycle snapshot start time
      const snapshot = await prisma.cycleSnapshot.findUnique({
        where: { cycleNumber },
      });
      
      if (snapshot) {
        return snapshot.startTime;
      }

      // Final fallback: return epoch (very old date) to allow queries to work
      // This enables analytics for cycles without audit logs or snapshots
      return new Date(0);
    }

    return event.eventTimestamp;
  }

  /**
   * Get cycle end time from audit log or fallback to current time
   * 
   * Returns the end time for a cycle. If no audit log or snapshot exists,
   * returns current time to allow queries to work for incomplete cycles.
   * This enables analytics to display in-progress cycles.
   */
  private async getCycleEndTime(cycleNumber: number): Promise<Date> {
    const event = await prisma.auditLog.findFirst({
      where: {
        cycleNumber,
        eventType: 'cycle_complete',
      },
    });

    if (!event) {
      // Fallback: use cycle snapshot end time
      const snapshot = await prisma.cycleSnapshot.findUnique({
        where: { cycleNumber },
      });
      
      if (snapshot) {
        return snapshot.endTime;
      }

      // Final fallback: use current time for incomplete cycles
      // This allows analytics to work for cycles that are in progress
      return new Date();
    }

    return event.eventTimestamp;
  }

  /**
   * Get cycle number for a battle timestamp
   */
  private async getCycleNumberForBattle(timestamp: Date): Promise<number> {
    const result = await this.batchGetCycleNumbers([timestamp]);
    return result.get(0) ?? 1;
  }

  /**
   * Batch-resolve cycle numbers for multiple battle timestamps.
   * Pre-fetches all cycle snapshots in a single query and does in-memory lookups,
   * avoiding N+1 queries when processing many participants.
   */
  private async batchGetCycleNumbers(timestamps: Date[]): Promise<Map<number, number>> {
    if (timestamps.length === 0) return new Map();

    const minTime = new Date(Math.min(...timestamps.map(t => t.getTime())));
    const maxTime = new Date(Math.max(...timestamps.map(t => t.getTime())));

    // Fetch all snapshots that could contain any of these timestamps
    const snapshots = await prisma.cycleSnapshot.findMany({
      where: {
        startTime: { lte: maxTime },
        endTime: { gte: minTime },
      },
      select: { cycleNumber: true, startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
    });

    // Build a map from timestamp index → cycle number
    const result = new Map<number, number>();
    const unresolvedIndices: number[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      // Binary search for the snapshot containing this timestamp (snapshots sorted by startTime asc)
      let lo = 0, hi = snapshots.length - 1;
      let found = false;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (snapshots[mid].startTime <= ts && snapshots[mid].endTime >= ts) {
          result.set(i, snapshots[mid].cycleNumber);
          found = true;
          break;
        } else if (snapshots[mid].startTime > ts) {
          hi = mid - 1;
        } else {
          lo = mid + 1;
        }
      }
      if (!found) {
        unresolvedIndices.push(i);
      }
    }

    // Fallback: resolve unmatched timestamps from audit log (same as getCycleNumberForBattle)
    if (unresolvedIndices.length > 0) {
      const auditEvents = await prisma.auditLog.findMany({
        where: {
          eventType: 'cycle_start',
          eventTimestamp: { lte: maxTime },
        },
        select: { cycleNumber: true, eventTimestamp: true },
        orderBy: { eventTimestamp: 'asc' },
      });

      for (const i of unresolvedIndices) {
        const ts = timestamps[i];
        // Find the latest cycle_start event at or before this timestamp
        let cycleNumber = 1;
        for (const event of auditEvents) {
          if (event.eventTimestamp <= ts) {
            cycleNumber = event.cycleNumber;
          } else {
            break;
          }
        }
        result.set(i, cycleNumber);
      }
    }

    return result;
  }
}

// Export singleton instance
export const robotPerformanceService = new RobotPerformanceService();
