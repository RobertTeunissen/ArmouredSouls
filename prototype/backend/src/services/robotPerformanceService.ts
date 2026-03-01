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

import prisma from '../lib/prisma';
import { cycleSnapshotService } from './cycleSnapshotService';

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
   * Get robot performance summary for a cycle range
   * Queries Battle table and aggregates statistics
   */
  async getRobotPerformanceSummary(
    robotId: number,
    cycleRange: [number, number]
  ): Promise<RobotPerformanceSummary> {
    const [startCycle, endCycle] = cycleRange;

    // Try to use cycle snapshots first (more efficient)
    const snapshots = await cycleSnapshotService.getSnapshotRange(startCycle, endCycle);
    
    if (snapshots.length > 0) {
      return this.aggregateFromSnapshots(robotId, cycleRange, snapshots);
    }

    // Fallback to querying Battle table directly
    return this.aggregateFromBattles(robotId, cycleRange);
  }

  /**
   * Aggregate performance data from cycle snapshots
   */
  private async aggregateFromSnapshots(
    robotId: number,
    cycleRange: [number, number],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    snapshots: any[]
  ): Promise<RobotPerformanceSummary> {
    let battlesParticipated = 0;
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let damageDealt = 0;
    let damageReceived = 0;
    let totalCreditsEarned = 0;
    let totalFameEarned = 0;
    let totalRepairCosts = 0;
    let kills = 0;
    let destructions = 0;
    let eloChange = 0;
    let eloStart = 0;
    let eloEnd = 0;

    // Aggregate metrics from snapshots
    for (const snapshot of snapshots) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const robotMetrics = snapshot.robotMetrics as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const robotMetric = robotMetrics.find((m: any) => m.robotId === robotId);

      if (robotMetric) {
        battlesParticipated += robotMetric.battlesParticipated;
        wins += robotMetric.wins;
        losses += robotMetric.losses;
        draws += robotMetric.draws;
        damageDealt += robotMetric.damageDealt;
        damageReceived += robotMetric.damageReceived;
        totalCreditsEarned += robotMetric.creditsEarned;
        totalFameEarned += robotMetric.fameChange;
        totalRepairCosts += robotMetric.repairCosts || 0;
        kills += robotMetric.kills || 0;
        destructions += robotMetric.destructions || 0;
        eloChange += robotMetric.eloChange;
      }
    }

    // Get ELO start and end values from BattleParticipant table
    const firstBattle = await this.getFirstBattleInRange(robotId, cycleRange);
    const lastBattle = await this.getLastBattleInRange(robotId, cycleRange);

    if (firstBattle) {
      eloStart = firstBattle.eloBefore;
    }

    if (lastBattle) {
      eloEnd = lastBattle.eloAfter;
    }

    // Calculate win rate
    const totalGames = wins + losses + draws;
    const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

    return {
      robotId,
      cycleRange,
      battlesParticipated,
      wins,
      losses,
      draws,
      winRate: Math.round(winRate * 100) / 100, // Round to 2 decimal places
      damageDealt,
      damageReceived,
      totalCreditsEarned,
      totalFameEarned,
      totalRepairCosts,
      kills,
      destructions,
      eloChange,
      eloStart,
      eloEnd,
    };
  }

  /**
   * Aggregate performance data directly from Battle table
   */
  private async aggregateFromBattles(
    robotId: number,
    cycleRange: [number, number]
  ): Promise<RobotPerformanceSummary> {
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

    // Aggregate statistics
    const battlesParticipated = participants.length;
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let damageDealt = 0;
    let damageReceived = 0;
    let totalCreditsEarned = 0;
    let totalFameEarned = 0;
    let totalRepairCosts = 0;
    let kills = 0;
    let destructions = 0;
    let eloChange = 0;
    let eloStart = 0;
    let eloEnd = 0;

    participants.forEach((participant, index) => {
      // Track ELO
      if (index === 0) {
        eloStart = participant.eloBefore;
      }
      if (index === participants.length - 1) {
        eloEnd = participant.eloAfter;
      }

      // Aggregate ELO change
      eloChange += participant.eloAfter - participant.eloBefore;

      // Track wins/losses/draws
      if (participant.battle.winnerId === robotId) {
        wins++;
      } else if (participant.battle.winnerId === null) {
        draws++;
      } else {
        losses++;
      }

      // Aggregate stats from participant
      totalCreditsEarned += participant.credits;
      damageDealt += participant.damageDealt;
      totalFameEarned += participant.fameAwarded;
      
      if (participant.destroyed) destructions++;
      
      // Note: damageReceived and kills require looking at other participants in the same battle
      // We'll calculate these in a second pass
    });

    // Second pass: calculate damage received and kills by looking at opponents
    const battleIds = participants.map(p => p.battleId);
    const allParticipantsInBattles = await prisma.battleParticipant.findMany({
      where: {
        battleId: { in: battleIds },
      },
      select: {
        battleId: true,
        robotId: true,
        damageDealt: true,
        destroyed: true,
      },
    });

    // Group by battle
    const participantsByBattle = new Map<number, typeof allParticipantsInBattles>();
    allParticipantsInBattles.forEach(p => {
      if (!participantsByBattle.has(p.battleId)) {
        participantsByBattle.set(p.battleId, []);
      }
      participantsByBattle.get(p.battleId)!.push(p);
    });

    // Calculate damage received and kills
    participants.forEach(participant => {
      const battleParticipants = participantsByBattle.get(participant.battleId) || [];
      const opponents = battleParticipants.filter(p => p.robotId !== robotId);
      
      opponents.forEach(opponent => {
        damageReceived += opponent.damageDealt;
        if (opponent.destroyed) kills++;
      });
    });

    // Get repair costs from audit log
    const repairEvents = await prisma.auditLog.findMany({
      where: {
        robotId,
        eventType: 'robot_repair',
        eventTimestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repairEvents.forEach((event: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = event.payload as any;
      totalRepairCosts += payload.cost || 0;
    });

    // Calculate win rate
    const totalGames = wins + losses + draws;
    const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

    return {
      robotId,
      cycleRange,
      battlesParticipated,
      wins,
      losses,
      draws,
      winRate: Math.round(winRate * 100) / 100, // Round to 2 decimal places
      damageDealt,
      damageReceived,
      totalCreditsEarned,
      totalFameEarned,
      totalRepairCosts,
      kills,
      destructions,
      eloChange,
      eloStart,
      eloEnd,
    };
  }

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

    // Group participants by cycle
    const participantsByCycle = new Map<number, typeof participants>();
    
    for (const participant of participants) {
      const cycleNumber = await this.getCycleNumberForBattle(participant.battle.createdAt);
      if (!participantsByCycle.has(cycleNumber)) {
        participantsByCycle.set(cycleNumber, []);
      }
      participantsByCycle.get(cycleNumber)!.push(participant);
    }

    // Extract metric value from participant based on metric type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractMetricValue = (participant: any, metric: RobotMetric): number => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getStartingValue = (participant: any, metric: RobotMetric): number => {
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
   * Get ELO progression data for a robot over a cycle range
   * Convenience wrapper around getRobotMetricProgression for backward compatibility
   */
  async getELOProgression(
    robotId: number,
    cycleRange: [number, number]
  ): Promise<ELOProgressionData> {
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

    // Build ELO progression data points
    const dataPoints: ELODataPoint[] = [];
    let startElo = 0;
    let endElo = 0;
    let totalChange = 0;

    // Group participants by cycle
    const participantsByCycle = new Map<number, typeof participants>();
    
    for (const participant of participants) {
      const cycleNumber = await this.getCycleNumberForBattle(participant.battle.createdAt);
      if (!participantsByCycle.has(cycleNumber)) {
        participantsByCycle.set(cycleNumber, []);
      }
      participantsByCycle.get(cycleNumber)!.push(participant);
    }

    // Create data points per cycle
    for (let cycle = startCycle; cycle <= endCycle; cycle++) {
      const cycleParticipants = participantsByCycle.get(cycle) || [];
      
      if (cycleParticipants.length === 0) continue;

      // Get ELO at end of cycle (from last participant)
      const lastParticipant = cycleParticipants[cycleParticipants.length - 1];
      const elo = lastParticipant.eloAfter;

      // Calculate total change in this cycle
      let cycleChange = 0;
      for (const participant of cycleParticipants) {
        cycleChange += participant.eloAfter - participant.eloBefore;
      }

      dataPoints.push({
        cycleNumber: cycle,
        elo,
        change: cycleChange,
      });

      totalChange += cycleChange;
    }

    // Get start and end ELO
    if (participants.length > 0) {
      const firstParticipant = participants[0];
      const lastParticipant = participants[participants.length - 1];
      
      startElo = firstParticipant.eloBefore;
      endElo = lastParticipant.eloAfter;
    }

    const averageChange = dataPoints.length > 0 
      ? totalChange / dataPoints.length 
      : 0;

    return {
      robotId,
      cycleRange,
      dataPoints,
      startElo,
      endElo,
      totalChange,
      averageChange: Math.round(averageChange * 100) / 100,
    };
  }

  /**
   * Get the first battle for a robot in a cycle range
   */
  private async getFirstBattleInRange(
    robotId: number,
    cycleRange: [number, number]
  ) {
    const [startCycle, endCycle] = cycleRange;
    const startTime = await this.getCycleStartTime(startCycle);
    const endTime = await this.getCycleEndTime(endCycle);

    return prisma.battleParticipant.findFirst({
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
        battle: true,
      },
      orderBy: {
        battle: {
          createdAt: 'asc',
        },
      },
    });
  }

  /**
   * Get the last battle for a robot in a cycle range
   */
  private async getLastBattleInRange(
    robotId: number,
    cycleRange: [number, number]
  ) {
    const [startCycle, endCycle] = cycleRange;
    const startTime = await this.getCycleStartTime(startCycle);
    const endTime = await this.getCycleEndTime(endCycle);

    return prisma.battleParticipant.findFirst({
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
        battle: true,
      },
      orderBy: {
        battle: {
          createdAt: 'desc',
        },
      },
    });
  }

  /**
   * Get cycle start time from audit log
   */
  private async getCycleStartTime(cycleNumber: number): Promise<Date> {
    const event = await prisma.auditLog.findFirst({
      where: {
        cycleNumber,
        eventType: 'cycle_start',
      },
    });

    if (!event) {
      // Fallback: use earliest battle in cycle
      const snapshot = await prisma.cycleSnapshot.findUnique({
        where: { cycleNumber },
      });
      
      if (snapshot) {
        return snapshot.startTime;
      }

      throw new Error(`Cycle ${cycleNumber} start time not found`);
    }

    return event.eventTimestamp;
  }

  /**
   * Get cycle end time from audit log
   */
  private async getCycleEndTime(cycleNumber: number): Promise<Date> {
    const event = await prisma.auditLog.findFirst({
      where: {
        cycleNumber,
        eventType: 'cycle_complete',
      },
    });

    if (!event) {
      // Fallback: use latest battle in cycle
      const snapshot = await prisma.cycleSnapshot.findUnique({
        where: { cycleNumber },
      });
      
      if (snapshot) {
        return snapshot.endTime;
      }

      throw new Error(`Cycle ${cycleNumber} end time not found`);
    }

    return event.eventTimestamp;
  }

  /**
   * Get cycle number for a battle timestamp
   */
  private async getCycleNumberForBattle(timestamp: Date): Promise<number> {
    // Find the cycle that contains this timestamp
    const snapshot = await prisma.cycleSnapshot.findFirst({
      where: {
        startTime: {
          lte: timestamp,
        },
        endTime: {
          gte: timestamp,
        },
      },
    });

    if (snapshot) {
      return snapshot.cycleNumber;
    }

    // Fallback: find from audit log
    const event = await prisma.auditLog.findFirst({
      where: {
        eventType: 'cycle_start',
        eventTimestamp: {
          lte: timestamp,
        },
      },
      orderBy: {
        eventTimestamp: 'desc',
      },
    });

    if (event) {
      return event.cycleNumber;
    }

    // Last resort: return 1 (assume first cycle)
    return 1;
  }
}

// Export singleton instance
export const robotPerformanceService = new RobotPerformanceService();
