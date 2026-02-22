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
  robotPurchases: number;
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
      // NEW: Each battle_complete event represents ONE robot's battle
      
      // Get battle_complete events - each event is for one robot
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
            robotPurchases: 0,
            attributeUpgrades: 0,
            totalPurchases: 0,
            netProfit: 0,
            balance: 0,
          };
          metricsMap.set(userId, metric);
        }
        return metric;
      };

      // Process battle_complete events - MUCH SIMPLER NOW!
      // Each event is for ONE robot, with userId and robotId in columns
      battleCompleteEvents.forEach((event: any) => {
        if (!event.userId) {
          console.log(`[CycleSnapshotService] WARNING: battle_complete event ${event.id} has no userId`);
          return; // Skip invalid events
        }
        
        const metric = getOrCreateMetric(event.userId);
        const payload = event.payload as any;
        
        // Debug logging
        console.log(`[CycleSnapshotService] Processing battle_complete for user ${event.userId}: credits=${payload.credits}, streaming=${payload.streamingRevenue}, prestige=${payload.prestige}`);
        
        // Aggregate data from this battle
        metric.battlesParticipated++;
        metric.totalCreditsEarned += payload.credits || 0;
        metric.totalPrestigeEarned += payload.prestige || 0;
        metric.streamingIncome += payload.streamingRevenue || 0;
        metric.totalRepairCosts += payload.repairCost || 0;
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

      // Add purchase costs (weapons, facilities, robots, attribute upgrades)
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

      const robotPurchaseEvents = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: 'robot_purchase',
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

      // Aggregate robot purchases
      robotPurchaseEvents.forEach((event: any) => {
        if (!event.userId) return;
        const metric = getOrCreateMetric(event.userId);
        const payload = event.payload as any;
        metric.robotPurchases += payload.cost || 0;
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

      // Calculate total purchases and net profit, and fetch end-of-cycle balances from audit log
      // NEW: Read balances from cycle_end_balance events (logged before snapshot creation)
      const cycleEndBalanceEvents = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: 'cycle_end_balance',
        },
      });

      // Create map of userId -> balance from cycle_end_balance events
      const balanceMap = new Map<number, number>();
      cycleEndBalanceEvents.forEach((event: any) => {
        if (event.userId && event.payload) {
          balanceMap.set(event.userId, event.payload.balance || 0);
        }
      });

      console.log(`[CycleSnapshotService] Found ${cycleEndBalanceEvents.length} cycle_end_balance events for cycle ${cycleNumber}`);
      
      metricsMap.forEach(metric => {
        metric.totalPurchases = 
          metric.weaponPurchases +
          metric.facilityPurchases +
          metric.robotPurchases +
          metric.attributeUpgrades;

        metric.netProfit = 
          metric.totalCreditsEarned +
          metric.merchandisingIncome +
          metric.streamingIncome -
          metric.totalRepairCosts -
          metric.operatingCosts -
          metric.totalPurchases;
        
        // Store the user's balance at the end of this cycle FROM AUDIT LOG
        metric.balance = balanceMap.get(metric.userId) || 0;
      });

      return Array.from(metricsMap.values());
    }

  /**
   * Aggregate robot metrics from AuditLog battle_complete events
   * Single source of truth: AuditLog
   */
  private async aggregateRobotMetrics(cycleNumber: number): Promise<RobotMetric[]> {
    // Get battle_complete events - each event is for one robot
    const battleCompleteEvents = await prisma.auditLog.findMany({
      where: {
        cycleNumber,
        eventType: 'battle_complete',
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

    // Process each battle_complete event
    battleCompleteEvents.forEach((event: any) => {
      if (!event.robotId) return; // Skip invalid events
      
      let robotMetric = metricsMap.get(event.robotId);
      if (!robotMetric) {
        robotMetric = initMetric(event.robotId);
        metricsMap.set(event.robotId, robotMetric);
      }

      const payload = event.payload as any;
      
      // Aggregate battle participation
      robotMetric.battlesParticipated++;
      
      // Aggregate results
      if (payload.result === 'win') robotMetric.wins++;
      else if (payload.result === 'loss') robotMetric.losses++;
      else if (payload.result === 'draw') robotMetric.draws++;
      
      // Aggregate combat stats
      robotMetric.damageDealt += payload.damageDealt || 0;
      robotMetric.creditsEarned += payload.credits || 0;
      robotMetric.eloChange += payload.eloChange || 0;
      robotMetric.fameChange += payload.fame || 0;
      
      // Track kills and destructions
      if (payload.destroyed) robotMetric.destructions++;
      // Note: kills are tracked when opponent is destroyed, which we can't determine from single event
      // We'll need to query opponent events or accept this limitation
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
    
    // Calculate damage received by looking at opponent's damageDealt
    // For each battle, we need to find the opponent's event
    const battleEventsByBattle = new Map<number, any[]>();
    battleCompleteEvents.forEach((event: any) => {
      const battleId = event.battleId;
      if (!battleId) return;
      
      if (!battleEventsByBattle.has(battleId)) {
        battleEventsByBattle.set(battleId, []);
      }
      battleEventsByBattle.get(battleId)!.push(event);
    });
    
    // Now process damage received and kills
    battleEventsByBattle.forEach((events) => {
      if (events.length !== 2 && events.length !== 4) return; // Should be 2 for 1v1/tournament, 4 for tag team
      
      events.forEach((event: any) => {
        const robotMetric = metricsMap.get(event.robotId);
        if (!robotMetric) return;
        
        const payload = event.payload as any;
        
        // Find opponent(s) in the same battle
        const opponents = events.filter(e => e.robotId !== event.robotId);
        opponents.forEach((oppEvent: any) => {
          const oppPayload = oppEvent.payload as any;
          
          // Add opponent's damage as damage received
          robotMetric.damageReceived += oppPayload.damageDealt || 0;
          
          // If opponent was destroyed, count as a kill
          if (oppPayload.destroyed) {
            robotMetric.kills++;
          }
        });
      });
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
