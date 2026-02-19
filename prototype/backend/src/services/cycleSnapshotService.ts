import prisma from '../lib/prisma';

/**
 * CycleSnapshotService
 * 
 * Responsibility: Aggregate events per cycle for efficient historical queries
 * 
 * This service creates pre-aggregated snapshots of cycle data by:
 * 1. Querying the Battle table for battle-related metrics
 * 2. Querying the AuditLog table for gap events (passive income, operating costs, etc.)
 * 3. Computing aggregated metrics per stable (user) and per robot
 * 4. Storing the snapshot in the CycleSnapshot table
 * 
 * Requirements: 10.1, 10.5
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
  weaponPurchases: number;
  facilityPurchases: number;
  attributeUpgrades: number;
  totalPurchases: number;
  netProfit: number;
  balance: number;
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
  repairCosts: number;
  kills: number;
  destructions: number;
  eloChange: number;
  fameChange: number;
}

interface StepDuration {
  stepName: string;
  duration: number;
}

interface CycleSnapshot {
  cycleNumber: number;
  triggerType: 'manual' | 'scheduled';
  startTime: Date;
  endTime: Date;
  duration: number;
  stableMetrics: StableMetric[];
  robotMetrics: RobotMetric[];
  stepDurations: StepDuration[];
}

export class CycleSnapshotService {
  /**
   * Create a snapshot for a completed cycle
   * Aggregates data from Battle table and AuditLog gap events
   */
  async createSnapshot(cycleNumber: number): Promise<CycleSnapshot> {
    console.log(`[CycleSnapshotService] Creating snapshot for cycle ${cycleNumber}`);

    // Get cycle timing from audit log events
    const cycleStartEvent = await prisma.auditLog.findFirst({
      where: {
        cycleNumber,
        eventType: 'cycle_start',
      },
    });

    const cycleCompleteEvent = await prisma.auditLog.findFirst({
      where: {
        cycleNumber,
        eventType: 'cycle_complete',
      },
    });

    if (!cycleStartEvent || !cycleCompleteEvent) {
      throw new Error(`Cycle ${cycleNumber} is incomplete - missing start or complete events`);
    }

    const startTime = cycleStartEvent.eventTimestamp;
    const endTime = cycleCompleteEvent.eventTimestamp;
    const duration = endTime.getTime() - startTime.getTime();
    const triggerType = (cycleStartEvent.payload as any).triggerType || 'manual';

    // Aggregate stable metrics
    const stableMetrics = await this.aggregateStableMetrics(cycleNumber);

    // Aggregate robot metrics
    const robotMetrics = await this.aggregateRobotMetrics(cycleNumber);

    // Get step durations
    const stepDurations = await this.getStepDurations(cycleNumber);

    // Calculate summary statistics
    const totalBattles = robotMetrics.reduce((sum, m) => sum + m.battlesParticipated, 0) / 2; // Divide by 2 since each battle involves 2 robots
    const totalCreditsTransacted = stableMetrics.reduce((sum, m) => sum + m.totalCreditsEarned, 0);
    const totalPrestigeAwarded = stableMetrics.reduce((sum, m) => sum + m.totalPrestigeEarned, 0);

    // Store snapshot in database
    const snapshot = await prisma.cycleSnapshot.create({
      data: {
        cycleNumber,
        triggerType,
        startTime,
        endTime,
        durationMs: duration,
        stableMetrics: stableMetrics as any,
        robotMetrics: robotMetrics as any,
        stepDurations: stepDurations as any,
        totalBattles: Math.floor(totalBattles),
        totalCreditsTransacted: BigInt(totalCreditsTransacted),
        totalPrestigeAwarded,
      },
    });

    console.log(`[CycleSnapshotService] Snapshot created for cycle ${cycleNumber}`);

    return {
      cycleNumber,
      triggerType: triggerType as 'manual' | 'scheduled',
      startTime,
      endTime,
      duration,
      stableMetrics,
      robotMetrics,
      stepDurations,
    };
  }

  /**
   * Aggregate stable (user) metrics from Battle table and AuditLog gap events
   */
  private async aggregateStableMetrics(cycleNumber: number): Promise<StableMetric[]> {
      // Use audit log as SINGLE source of truth - all data comes from events
      
      // Get battle_complete events - these contain ALL battle data
      const battleCompleteEvents = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: 'battle_complete',
        },
      });

      console.log(`[CycleSnapshotService] Found ${battleCompleteEvents.length} battle_complete events for cycle ${cycleNumber}`);

      // Get passive income and operating costs from audit log
      const passiveIncomeEvents = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: 'passive_income',
        },
      });

      const operatingCostsEvents = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: 'operating_costs',
        },
      });

      // Build metrics per user
      const metricsMap = new Map<number, StableMetric>();

      // Helper to get or create metric for a user
      const getOrCreateMetric = (userId: number): StableMetric => {
        let metric = metricsMap.get(userId);
        if (!metric) {
          metric = {
            userId,
            battlesParticipated: 0,
            totalCreditsEarned: 0,
            totalPrestigeEarned: 0,
            totalRepairCosts: 0,
            merchandisingIncome: 0,
            streamingIncome: 0,
            operatingCosts: 0,
            weaponPurchases: 0,
            facilityPurchases: 0,
            attributeUpgrades: 0,
            totalPurchases: 0,
            netProfit: 0,
            balance: 0,
          };
          metricsMap.set(userId, metric);
        }
        return metric;
      };

      // Process battle_complete events - extract ALL data from audit log
      // First pass: Get robot -> user mapping
      const robotToUserMap = new Map<number, number>();
      
      for (const event of battleCompleteEvents) {
        const payload = event.payload as any;
        if (!payload.robot1Id || !payload.robot2Id) continue;

        // Get robot ownership
        const robot1 = await prisma.robot.findUnique({
          where: { id: payload.robot1Id },
          select: { userId: true },
        });
        const robot2 = await prisma.robot.findUnique({
          where: { id: payload.robot2Id },
          select: { userId: true },
        });

        if (robot1) robotToUserMap.set(payload.robot1Id, robot1.userId);
        if (robot2) robotToUserMap.set(payload.robot2Id, robot2.userId);
      }

      // Second pass: Aggregate all data from battle_complete events
      battleCompleteEvents.forEach((event: any) => {
        const payload = event.payload as any;
        if (!payload.robot1Id || !payload.robot2Id) return;

        const robot1UserId = robotToUserMap.get(payload.robot1Id);
        const robot2UserId = robotToUserMap.get(payload.robot2Id);

        if (!robot1UserId || !robot2UserId) return;

        // Robot 1 owner metrics
        const metric1 = getOrCreateMetric(robot1UserId);
        metric1.battlesParticipated++;
        metric1.totalPrestigeEarned += payload.robot1PrestigeAwarded || 0;
        metric1.streamingIncome += payload.streamingRevenue1 || 0;
        metric1.totalRepairCosts += payload.robot1RepairCost || 0;

        // Credits earned by robot1
        if (payload.winnerId === payload.robot1Id) {
          metric1.totalCreditsEarned += payload.winnerReward || 0;
        } else if (!payload.isDraw) {
          metric1.totalCreditsEarned += payload.loserReward || 0;
        }

        // Robot 2 owner metrics
        const metric2 = getOrCreateMetric(robot2UserId);
        metric2.battlesParticipated++;
        metric2.totalPrestigeEarned += payload.robot2PrestigeAwarded || 0;
        metric2.streamingIncome += payload.streamingRevenue2 || 0;
        metric2.totalRepairCosts += payload.robot2RepairCost || 0;

        // Credits earned by robot2
        if (payload.winnerId === payload.robot2Id) {
          metric2.totalCreditsEarned += payload.winnerReward || 0;
        } else if (!payload.isDraw) {
          metric2.totalCreditsEarned += payload.loserReward || 0;
        }
      });

      // Add passive income (merchandising)
      passiveIncomeEvents.forEach((event: any) => {
        if (!event.userId) return;
        const metric = getOrCreateMetric(event.userId);
        const payload = event.payload as any;
        metric.merchandisingIncome += payload.merchandising || 0;
      });

      // Add operating costs
      operatingCostsEvents.forEach((event: any) => {
        if (!event.userId) return;
        const metric = getOrCreateMetric(event.userId);
        const payload = event.payload as any;
        metric.operatingCosts += payload.totalCost || 0;
      });

      // Add repair costs from audit log (if not already in battle_complete)
      const repairEvents = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: 'robot_repair',
        },
      });

      repairEvents.forEach((event: any) => {
        if (!event.userId) return;
        const metric = getOrCreateMetric(event.userId);
        const payload = event.payload as any;
        metric.totalRepairCosts += payload.cost || 0;
      });

      // Add purchase costs (weapons, facilities, attribute upgrades)
      const weaponPurchaseEvents = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: 'weapon_purchase',
        },
      });

      const facilityPurchaseEvents = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: { in: ['facility_purchase', 'facility_upgrade'] },
        },
      });

      const attributeUpgradeEvents = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: 'attribute_upgrade',
        },
      });

      // Aggregate weapon purchases
      weaponPurchaseEvents.forEach((event: any) => {
        if (!event.userId) return;
        const metric = getOrCreateMetric(event.userId);
        const payload = event.payload as any;
        metric.weaponPurchases += payload.cost || 0;
      });

      // Aggregate facility purchases
      facilityPurchaseEvents.forEach((event: any) => {
        if (!event.userId) return;
        const metric = getOrCreateMetric(event.userId);
        const payload = event.payload as any;
        metric.facilityPurchases += payload.cost || 0;
      });

      // Aggregate attribute upgrades
      for (const event of attributeUpgradeEvents) {
        if (!event.robotId) continue;

        // Get robot owner from database
        const robot = await prisma.robot.findUnique({
          where: { id: event.robotId },
          select: { userId: true },
        });

        if (!robot) continue;

        const metric = getOrCreateMetric(robot.userId);
        const payload = event.payload as any;
        metric.attributeUpgrades += payload.cost || 0;
      }

      // Calculate total purchases and net profit, and fetch final balances
      const userIdsArray = Array.from(metricsMap.keys());
      const users = await prisma.user.findMany({
        where: { id: { in: userIdsArray } },
        select: { id: true, currency: true }
      });
      
      const balanceMap = new Map(users.map(u => [u.id, u.currency]));
      
      metricsMap.forEach(metric => {
        metric.totalPurchases = 
          metric.weaponPurchases +
          metric.facilityPurchases +
          metric.attributeUpgrades;

        metric.netProfit = 
          metric.totalCreditsEarned +
          metric.merchandisingIncome +
          metric.streamingIncome -
          metric.totalRepairCosts -
          metric.operatingCosts -
          metric.totalPurchases;
        
        // Store the user's balance at the end of this cycle
        metric.balance = balanceMap.get(metric.userId) || 0;
      });

      return Array.from(metricsMap.values());
    }

  /**
   * Aggregate robot metrics from Battle table
   */
  private async aggregateRobotMetrics(cycleNumber: number): Promise<RobotMetric[]> {
    // Get all battles for this cycle
    const battles = await prisma.battle.findMany({
      where: {
        createdAt: {
          gte: await this.getCycleStartTime(cycleNumber),
          lte: await this.getCycleEndTime(cycleNumber),
        },
      },
    });

    // Build metrics per robot
    const metricsMap = new Map<number, RobotMetric>();

    const initMetric = (robotId: number): RobotMetric => ({
      robotId,
      battlesParticipated: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      damageDealt: 0,
      damageReceived: 0,
      creditsEarned: 0,
      repairCosts: 0,
      kills: 0,
      destructions: 0,
      eloChange: 0,
      fameChange: 0,
    });

    battles.forEach(battle => {
      // Process robot1
      let robot1Metric = metricsMap.get(battle.robot1Id);
      if (!robot1Metric) {
        robot1Metric = initMetric(battle.robot1Id);
        metricsMap.set(battle.robot1Id, robot1Metric);
      }

      robot1Metric.battlesParticipated++;
      robot1Metric.damageDealt += battle.robot1DamageDealt;
      robot1Metric.damageReceived += battle.robot2DamageDealt;
      // Note: Repair costs now tracked via audit log, not battle table
      robot1Metric.eloChange += battle.robot1ELOAfter - battle.robot1ELOBefore;
      robot1Metric.fameChange += battle.robot1FameAwarded;
      if (battle.robot2Destroyed) robot1Metric.kills++;
      if (battle.robot1Destroyed) robot1Metric.destructions++;

      if (battle.winnerId === battle.robot1Id) {
        robot1Metric.wins++;
        robot1Metric.creditsEarned += battle.winnerReward || 0;
      } else if (battle.winnerId === null) {
        robot1Metric.draws++;
        robot1Metric.creditsEarned += battle.loserReward || 0;
      } else {
        robot1Metric.losses++;
        robot1Metric.creditsEarned += battle.loserReward || 0;
      }

      // Process robot2
      let robot2Metric = metricsMap.get(battle.robot2Id);
      if (!robot2Metric) {
        robot2Metric = initMetric(battle.robot2Id);
        metricsMap.set(battle.robot2Id, robot2Metric);
      }

      robot2Metric.battlesParticipated++;
      robot2Metric.damageDealt += battle.robot2DamageDealt;
      robot2Metric.damageReceived += battle.robot1DamageDealt;
      // Note: Repair costs now tracked via audit log, not battle table
      robot2Metric.eloChange += battle.robot2ELOAfter - battle.robot2ELOBefore;
      robot2Metric.fameChange += battle.robot2FameAwarded;
      if (battle.robot1Destroyed) robot2Metric.kills++;
      if (battle.robot2Destroyed) robot2Metric.destructions++;

      if (battle.winnerId === battle.robot2Id) {
        robot2Metric.wins++;
        robot2Metric.creditsEarned += battle.winnerReward || 0;
      } else if (battle.winnerId === null) {
        robot2Metric.draws++;
        robot2Metric.creditsEarned += battle.loserReward || 0;
      } else {
        robot2Metric.losses++;
        robot2Metric.creditsEarned += battle.loserReward || 0;
      }
    });

    // Add repair costs from audit log
    const repairEvents = await prisma.auditLog.findMany({
      where: {
        cycleNumber,
        eventType: 'robot_repair',
      },
    });

    repairEvents.forEach((event: any) => {
      if (!event.robotId) return;

      const robotMetric = metricsMap.get(event.robotId);
      if (robotMetric) {
        const payload = event.payload as any;
        robotMetric.repairCosts += payload.cost || 0;
      }
    });

    return Array.from(metricsMap.values());
  }

  /**
   * Get step durations from audit log
   */
  private async getStepDurations(cycleNumber: number): Promise<StepDuration[]> {
    const stepEvents = await prisma.auditLog.findMany({
      where: {
        cycleNumber,
        eventType: 'cycle_step_complete',
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });

    return stepEvents.map((event: any) => {
      const payload = event.payload as any;
      return {
        stepName: payload.stepName,
        duration: payload.duration,
      };
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
      throw new Error(`Cycle ${cycleNumber} start event not found`);
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
      throw new Error(`Cycle ${cycleNumber} complete event not found`);
    }

    return event.eventTimestamp;
  }

  /**
   * Get a snapshot for a specific cycle
   */
  async getSnapshot(cycleNumber: number): Promise<CycleSnapshot | null> {
    const snapshot = await prisma.cycleSnapshot.findUnique({
      where: { cycleNumber },
    });

    if (!snapshot) {
      return null;
    }

    return {
      cycleNumber: snapshot.cycleNumber,
      triggerType: snapshot.triggerType as 'manual' | 'scheduled',
      startTime: snapshot.startTime,
      endTime: snapshot.endTime,
      duration: snapshot.durationMs,
      stableMetrics: snapshot.stableMetrics as unknown as StableMetric[],
      robotMetrics: snapshot.robotMetrics as unknown as RobotMetric[],
      stepDurations: snapshot.stepDurations as unknown as StepDuration[],
    };
  }

  /**
   * Get snapshots for a range of cycles
   */
  async getSnapshotRange(startCycle: number, endCycle: number): Promise<CycleSnapshot[]> {
    const snapshots = await prisma.cycleSnapshot.findMany({
      where: {
        cycleNumber: {
          gte: startCycle,
          lte: endCycle,
        },
      },
      orderBy: {
        cycleNumber: 'asc',
      },
    });

    return snapshots.map((snapshot: any) => ({
      cycleNumber: snapshot.cycleNumber,
      triggerType: snapshot.triggerType as 'manual' | 'scheduled',
      startTime: snapshot.startTime,
      endTime: snapshot.endTime,
      duration: snapshot.durationMs,
      stableMetrics: snapshot.stableMetrics as unknown as StableMetric[],
      robotMetrics: snapshot.robotMetrics as unknown as RobotMetric[],
      stepDurations: snapshot.stepDurations as unknown as StepDuration[],
    }));
  }
}

// Export singleton instance
export const cycleSnapshotService = new CycleSnapshotService();
