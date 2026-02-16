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
      const robotMetrics = snapshot.robotMetrics as any[];
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

    // Get ELO start and end values from Battle table
    const firstBattle = await this.getFirstBattleInRange(robotId, cycleRange);
    const lastBattle = await this.getLastBattleInRange(robotId, cycleRange);

    if (firstBattle) {
      eloStart = firstBattle.robot1Id === robotId 
        ? firstBattle.robot1ELOBefore 
        : firstBattle.robot2ELOBefore;
    }

    if (lastBattle) {
      eloEnd = lastBattle.robot1Id === robotId 
        ? lastBattle.robot1ELOAfter 
        : lastBattle.robot2ELOAfter;
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

    // Query all battles for this robot in the cycle range
    const battles = await prisma.battle.findMany({
      where: {
        OR: [
          { robot1Id: robotId },
          { robot2Id: robotId },
        ],
        createdAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Aggregate statistics
    let battlesParticipated = battles.length;
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

    battles.forEach((battle, index) => {
      const isRobot1 = battle.robot1Id === robotId;

      // Track ELO
      if (index === 0) {
        eloStart = isRobot1 ? battle.robot1ELOBefore : battle.robot2ELOBefore;
      }
      if (index === battles.length - 1) {
        eloEnd = isRobot1 ? battle.robot1ELOAfter : battle.robot2ELOAfter;
      }

      // Aggregate ELO change
      if (isRobot1) {
        eloChange += battle.robot1ELOAfter - battle.robot1ELOBefore;
      } else {
        eloChange += battle.robot2ELOAfter - battle.robot2ELOBefore;
      }

      // Track wins/losses/draws
      if (battle.winnerId === robotId) {
        wins++;
        totalCreditsEarned += battle.winnerReward || 0;
      } else if (battle.winnerId === null) {
        draws++;
        totalCreditsEarned += isRobot1 ? (battle.loserReward || 0) : (battle.loserReward || 0);
      } else {
        losses++;
        totalCreditsEarned += isRobot1 ? (battle.loserReward || 0) : (battle.loserReward || 0);
      }

      // Track damage, repair costs, kills, and destructions
      if (isRobot1) {
        damageDealt += battle.robot1DamageDealt;
        damageReceived += battle.robot2DamageDealt;
        totalFameEarned += battle.robot1FameAwarded;
        totalRepairCosts += battle.robot1RepairCost || 0;
        if (battle.robot2Destroyed) kills++;
        if (battle.robot1Destroyed) destructions++;
      } else {
        damageDealt += battle.robot2DamageDealt;
        damageReceived += battle.robot1DamageDealt;
        totalFameEarned += battle.robot2FameAwarded;
        totalRepairCosts += battle.robot2RepairCost || 0;
        if (battle.robot1Destroyed) kills++;
        if (battle.robot2Destroyed) destructions++;
      }
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

    // Query all battles for this robot in the cycle range
    const battles = await prisma.battle.findMany({
      where: {
        OR: [
          { robot1Id: robotId },
          { robot2Id: robotId },
        ],
        createdAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Build metric progression data points
    const dataPoints: MetricDataPoint[] = [];
    let startValue = 0;
    let endValue = 0;
    let totalChange = 0;

    // Group battles by cycle
    const battlesByCycle = new Map<number, typeof battles>();
    
    for (const battle of battles) {
      const cycleNumber = await this.getCycleNumberForBattle(battle.createdAt);
      if (!battlesByCycle.has(cycleNumber)) {
        battlesByCycle.set(cycleNumber, []);
      }
      battlesByCycle.get(cycleNumber)!.push(battle);
    }

    // Extract metric value from battle based on metric type
    const extractMetricValue = (battle: any, isRobot1: boolean, metric: RobotMetric): number => {
      switch (metric) {
        case 'elo':
          return isRobot1 ? battle.robot1ELOAfter : battle.robot2ELOAfter;
        case 'fame':
          return isRobot1 ? battle.robot1FameAwarded : battle.robot2FameAwarded;
        case 'damageDealt':
          return isRobot1 ? battle.robot1DamageDealt : battle.robot2DamageDealt;
        case 'damageReceived':
          return isRobot1 ? battle.robot2DamageDealt : battle.robot1DamageDealt;
        case 'wins':
          return battle.winnerId === robotId ? 1 : 0;
        case 'losses':
          return battle.winnerId !== null && battle.winnerId !== robotId ? 1 : 0;
        case 'draws':
          return battle.winnerId === null ? 1 : 0;
        case 'kills':
          // A kill is when the opponent robot is destroyed (finalHP = 0)
          const opponentFinalHP = isRobot1 ? battle.robot2FinalHP : battle.robot1FinalHP;
          return opponentFinalHP === 0 ? 1 : 0;
        case 'creditsEarned':
          if (battle.winnerId === robotId) {
            return battle.winnerReward || 0;
          } else {
            return battle.loserReward || 0;
          }
        default:
          return 0;
      }
    };

    // Get starting value for the metric
    const getStartingValue = (battle: any, isRobot1: boolean, metric: RobotMetric): number => {
      if (metric === 'elo') {
        return isRobot1 ? battle.robot1ELOBefore : battle.robot2ELOBefore;
      }
      return 0; // For cumulative metrics, start at 0
    };

    // Create data points per cycle
    let cumulativeValue = 0;
    let isFirstBattle = true;

    for (let cycle = startCycle; cycle <= endCycle; cycle++) {
      const cycleBattles = battlesByCycle.get(cycle) || [];
      
      if (cycleBattles.length === 0) continue;

      // Calculate total change in this cycle
      let cycleChange = 0;
      let cycleEndValue = 0;

      for (const battle of cycleBattles) {
        const isRobot1 = battle.robot1Id === robotId;
        
        // Set starting value from first battle
        if (isFirstBattle) {
          startValue = getStartingValue(battle, isRobot1, metric);
          if (metric !== 'elo') {
            cumulativeValue = startValue;
          }
          isFirstBattle = false;
        }

        // Extract metric value
        const value = extractMetricValue(battle, isRobot1, metric);

        if (metric === 'elo') {
          // For ELO, track the change
          const eloBefore = isRobot1 ? battle.robot1ELOBefore : battle.robot2ELOBefore;
          const eloAfter = isRobot1 ? battle.robot1ELOAfter : battle.robot2ELOAfter;
          cycleChange += eloAfter - eloBefore;
          cycleEndValue = eloAfter;
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
    if (battles.length > 0) {
      const firstBattle = battles[0];
      const lastBattle = battles[battles.length - 1];
      const isFirstRobot1 = firstBattle.robot1Id === robotId;
      const isLastRobot1 = lastBattle.robot1Id === robotId;
      
      startValue = getStartingValue(firstBattle, isFirstRobot1, metric);
      
      if (metric === 'elo') {
        endValue = isLastRobot1 ? lastBattle.robot1ELOAfter : lastBattle.robot2ELOAfter;
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

    // Query all battles for this robot in the cycle range
    const battles = await prisma.battle.findMany({
      where: {
        OR: [
          { robot1Id: robotId },
          { robot2Id: robotId },
        ],
        createdAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Build ELO progression data points
    const dataPoints: ELODataPoint[] = [];
    let startElo = 0;
    let endElo = 0;
    let totalChange = 0;

    // Group battles by cycle
    const battlesByCycle = new Map<number, typeof battles>();
    
    for (const battle of battles) {
      const cycleNumber = await this.getCycleNumberForBattle(battle.createdAt);
      if (!battlesByCycle.has(cycleNumber)) {
        battlesByCycle.set(cycleNumber, []);
      }
      battlesByCycle.get(cycleNumber)!.push(battle);
    }

    // Create data points per cycle
    for (let cycle = startCycle; cycle <= endCycle; cycle++) {
      const cycleBattles = battlesByCycle.get(cycle) || [];
      
      if (cycleBattles.length === 0) continue;

      // Get ELO at end of cycle (from last battle)
      const lastBattle = cycleBattles[cycleBattles.length - 1];
      const isRobot1 = lastBattle.robot1Id === robotId;
      const elo = isRobot1 ? lastBattle.robot1ELOAfter : lastBattle.robot2ELOAfter;

      // Calculate total change in this cycle
      let cycleChange = 0;
      for (const battle of cycleBattles) {
        const isR1 = battle.robot1Id === robotId;
        if (isR1) {
          cycleChange += battle.robot1ELOAfter - battle.robot1ELOBefore;
        } else {
          cycleChange += battle.robot2ELOAfter - battle.robot2ELOBefore;
        }
      }

      dataPoints.push({
        cycleNumber: cycle,
        elo,
        change: cycleChange,
      });

      totalChange += cycleChange;
    }

    // Get start and end ELO
    if (battles.length > 0) {
      const firstBattle = battles[0];
      const lastBattle = battles[battles.length - 1];
      
      startElo = firstBattle.robot1Id === robotId 
        ? firstBattle.robot1ELOBefore 
        : firstBattle.robot2ELOBefore;
      
      endElo = lastBattle.robot1Id === robotId 
        ? lastBattle.robot1ELOAfter 
        : lastBattle.robot2ELOAfter;
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

    return prisma.battle.findFirst({
      where: {
        OR: [
          { robot1Id: robotId },
          { robot2Id: robotId },
        ],
        createdAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: {
        createdAt: 'asc',
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

    return prisma.battle.findFirst({
      where: {
        OR: [
          { robot1Id: robotId },
          { robot2Id: robotId },
        ],
        createdAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: {
        createdAt: 'desc',
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
