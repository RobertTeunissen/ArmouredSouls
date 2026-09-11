import logger from '../../config/logger';
import type { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import type {
  CycleEventPayload,
  RobotMetric,
  StableMetric,
  StepDuration,
} from '../../types/snapshotTypes';
import { formatProcessMemoryUsage } from '../../utils/process-memory';
import { readRepairChargedCredits } from '../economy/repairPayloadKeys';

const AUDIT_LOG_PAGE_SIZE = 200;

const SNAPSHOT_EVENT_SELECT = {
  sequenceNumber: true,
  eventType: true,
  userId: true,
  robotId: true,
  battleId: true,
  payload: true,
} as const;

type SnapshotAuditEvent = Prisma.AuditLogGetPayload<{
  select: typeof SNAPSHOT_EVENT_SELECT;
}>;

interface BattleMetricEvent {
  robotId: number;
  damageDealt: number;
  destroyed: boolean;
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

interface AggregatedCycleMetrics {
  stableMetrics: StableMetric[];
  robotMetrics: RobotMetric[];
}

/** Fields that can be selectively fetched to avoid overfetching large JSON columns. */
export type SnapshotField = 'stableMetrics' | 'robotMetrics' | 'stepDurations';

/** Snapshot with only the requested JSON fields populated (scalars always included). */
export type PartialSnapshot = Pick<
  CycleSnapshot,
  'cycleNumber' | 'triggerType' | 'startTime' | 'endTime' | 'duration'
> & Partial<Pick<CycleSnapshot, 'stableMetrics' | 'robotMetrics' | 'stepDurations'>>;

function createStableMetric(userId: number): StableMetric {
  return {
    userId,
    battlesParticipated: 0,
    totalCreditsEarned: 0,
    totalPrestigeEarned: 0,
    cycleRepairCreditsPaid: 0,
    merchandisingIncome: 0,
    streamingIncome: 0,
    operatingCosts: 0,
    weaponPurchases: 0,
    facilityPurchases: 0,
    robotPurchases: 0,
    attributeUpgrades: 0,
    totalPurchases: 0,
    achievementRewards: 0,
    netProfit: 0,
    balance: 0,
  };
}

function createRobotMetric(robotId: number): RobotMetric {
  return {
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
  };
}

/** Aggregate cycle audit evidence into the permanent CycleSnapshot JSON documents. */
export class CycleSnapshotService {
  async createSnapshot(cycleNumber: number): Promise<CycleSnapshot> {
    logger.info(
      `[CycleSnapshotService] cycle=${cycleNumber} started ${formatProcessMemoryUsage()}`,
    );

    const cycleStartEvent = await prisma.auditLog.findFirst({
      where: { cycleNumber, eventType: 'cycle_start' },
    });
    const cycleCompleteEvent = await prisma.auditLog.findFirst({
      where: { cycleNumber, eventType: 'cycle_complete' },
    });

    if (!cycleStartEvent || !cycleCompleteEvent) {
      logger.warn(
        `[CycleSnapshot] Cycle ${cycleNumber} missing `
        + `${!cycleStartEvent ? 'start' : 'complete'} event — using fallback timestamps`,
      );
    }

    const startTime = cycleStartEvent?.eventTimestamp ?? new Date();
    const endTime = cycleCompleteEvent?.eventTimestamp ?? new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const triggerType = cycleStartEvent
      ? ((cycleStartEvent.payload as unknown as CycleEventPayload).triggerType || 'manual')
      : 'manual';

    const { stableMetrics, robotMetrics } = await this.aggregateCycleMetrics(cycleNumber);
    logger.info(
      `[CycleSnapshotService] cycle=${cycleNumber} metricsAggregated `
      + `stables=${stableMetrics.length} robots=${robotMetrics.length} `
      + formatProcessMemoryUsage(),
    );
    const stepDurations = await this.getStepDurations(cycleNumber);

    const totalBattles = robotMetrics.reduce(
      (sum, metric) => sum + metric.battlesParticipated,
      0,
    ) / 2;
    const totalCreditsTransacted = stableMetrics.reduce(
      (sum, metric) => sum + metric.totalCreditsEarned,
      0,
    );
    const totalPrestigeAwarded = stableMetrics.reduce(
      (sum, metric) => sum + metric.totalPrestigeEarned,
      0,
    );

    logger.info(
      `[CycleSnapshotService] cycle=${cycleNumber} insertingSnapshot `
      + formatProcessMemoryUsage(),
    );
    const snapshotData = {
      cycleNumber,
      triggerType,
      startTime,
      endTime,
      durationMs: duration,
      stableMetrics: stableMetrics as unknown as Prisma.InputJsonValue,
      robotMetrics: robotMetrics as unknown as Prisma.InputJsonValue,
      stepDurations: stepDurations as unknown as Prisma.InputJsonValue,
      totalBattles: Math.floor(totalBattles),
      totalCreditsTransacted: BigInt(totalCreditsTransacted),
      totalPrestigeAwarded,
    };
    await prisma.cycleSnapshot.upsert({
      where: { cycleNumber },
      create: snapshotData,
      update: snapshotData,
      // Avoid deserializing the three large JSON documents back into Node.
      select: { id: true },
    });

    logger.info(
      `[CycleSnapshotService] cycle=${cycleNumber} complete ${formatProcessMemoryUsage()}`,
    );

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

  private async forEachAuditLogPage(
    cycleNumber: number,
    eventTypes: readonly string[],
    consumer: (events: readonly SnapshotAuditEvent[]) => void | Promise<void>,
  ): Promise<number> {
    let afterSequenceNumber: number | undefined;
    let eventsProcessed = 0;

    while (true) {
      const events = await prisma.auditLog.findMany({
        where: {
          cycleNumber,
          eventType: eventTypes.length === 1
            ? eventTypes[0]
            : { in: [...eventTypes] },
          ...(afterSequenceNumber === undefined
            ? {}
            : { sequenceNumber: { gt: afterSequenceNumber } }),
        },
        select: SNAPSHOT_EVENT_SELECT,
        orderBy: { sequenceNumber: 'asc' },
        take: AUDIT_LOG_PAGE_SIZE,
      });
      if (events.length === 0) break;

      await consumer(events);
      eventsProcessed += events.length;
      afterSequenceNumber = events[events.length - 1].sequenceNumber;
      if (events.length < AUDIT_LOG_PAGE_SIZE) break;
    }

    return eventsProcessed;
  }

  private async aggregateCycleMetrics(cycleNumber: number): Promise<AggregatedCycleMetrics> {
    const stableMetricsMap = new Map<number, StableMetric>();
    const robotMetricsMap = new Map<number, RobotMetric>();

    const getStableMetric = (userId: number): StableMetric => {
      let metric = stableMetricsMap.get(userId);
      if (!metric) {
        metric = createStableMetric(userId);
        stableMetricsMap.set(userId, metric);
      }
      return metric;
    };
    const getRobotMetric = (robotId: number): RobotMetric => {
      let metric = robotMetricsMap.get(robotId);
      if (!metric) {
        metric = createRobotMetric(robotId);
        robotMetricsMap.set(robotId, metric);
      }
      return metric;
    };

    const battleEventCount = await this.forEachAuditLogPage(
      cycleNumber,
      ['battle_complete'],
      (events) => {
        for (const event of events) {
          const payload = event.payload as unknown as CycleEventPayload;
          if (event.userId !== null) {
            const stableMetric = getStableMetric(event.userId);
            stableMetric.battlesParticipated++;
            stableMetric.totalCreditsEarned += payload.credits || 0;
            stableMetric.totalPrestigeEarned += payload.prestige || 0;
            stableMetric.streamingIncome += payload.streamingRevenue || 0;
          }
          if (event.robotId !== null) {
            const robotMetric = getRobotMetric(event.robotId);
            robotMetric.battlesParticipated++;
            if (payload.result === 'win') robotMetric.wins++;
            if (payload.result === 'loss') robotMetric.losses++;
            if (payload.result === 'draw') robotMetric.draws++;
            robotMetric.damageDealt += payload.damageDealt || 0;
            robotMetric.creditsEarned += payload.credits || 0;
            robotMetric.eloChange += payload.eloChange || 0;
            robotMetric.fameChange += payload.fame || 0;
            if (payload.destroyed) robotMetric.destructions++;
          }
        }
      },
    );
    logger.info(
      `[CycleSnapshotService] cycle=${cycleNumber} battleEvents=${battleEventCount} `
      + formatProcessMemoryUsage(),
    );

    const balanceMap = new Map<number, number>();
    const supportingEventTypes = [
      'passive_income',
      'operating_costs',
      'robot_repair',
      'weapon_purchase',
      'facility_purchase',
      'facility_upgrade',
      'robot_purchase',
      'attribute_upgrade',
      'cycle_end_balance',
      'achievement_unlock',
    ] as const;

    const supportingEventCount = await this.forEachAuditLogPage(
      cycleNumber,
      supportingEventTypes,
      async (events) => {
        const attributeUpgradeEvents: SnapshotAuditEvent[] = [];

        for (const event of events) {
          const payload = event.payload as unknown as CycleEventPayload;
          if (event.eventType === 'attribute_upgrade') {
            attributeUpgradeEvents.push(event);
            continue;
          }
          if (event.eventType === 'cycle_end_balance') {
            if (event.userId !== null) balanceMap.set(event.userId, payload.balance || 0);
            continue;
          }
          if (event.userId === null) continue;

          const stableMetric = getStableMetric(event.userId);
          switch (event.eventType) {
            case 'passive_income':
              stableMetric.merchandisingIncome += payload.merchandising || 0;
              stableMetric.streamingIncome += payload.streaming || 0;
              break;
            case 'operating_costs':
              stableMetric.operatingCosts += payload.totalCost || 0;
              break;
            case 'robot_repair': {
              const charged = readRepairChargedCredits(
                event.payload as unknown as Record<string, unknown>,
              );
              if (charged === null) break;
              stableMetric.cycleRepairCreditsPaid += charged;
              if (event.robotId !== null) {
                const robotMetric = robotMetricsMap.get(event.robotId);
                if (robotMetric) robotMetric.repairCosts += charged;
              }
              break;
            }
            case 'weapon_purchase':
              stableMetric.weaponPurchases += payload.cost || 0;
              break;
            case 'facility_purchase':
            case 'facility_upgrade':
              stableMetric.facilityPurchases += payload.cost || 0;
              break;
            case 'robot_purchase':
              stableMetric.robotPurchases += payload.cost || 0;
              break;
            case 'achievement_unlock':
              stableMetric.achievementRewards += payload.rewardCredits || 0;
              break;
          }
        }

        const robotIds = [
          ...new Set(
            attributeUpgradeEvents
              .map((event) => event.robotId)
              .filter((robotId): robotId is number => robotId !== null),
          ),
        ];
        if (robotIds.length === 0) return;

        const robots = await prisma.robot.findMany({
          where: { id: { in: robotIds } },
          select: { id: true, userId: true },
        });
        const robotOwnerMap = new Map(robots.map((robot) => [robot.id, robot.userId]));
        for (const event of attributeUpgradeEvents) {
          if (event.robotId === null) continue;
          const userId = robotOwnerMap.get(event.robotId);
          if (userId === undefined) continue;
          const payload = event.payload as unknown as CycleEventPayload;
          getStableMetric(userId).attributeUpgrades += payload.cost || 0;
        }
      },
    );

    await this.aggregateOpponentMetrics(cycleNumber, robotMetricsMap);

    for (const metric of stableMetricsMap.values()) {
      metric.totalPurchases = metric.weaponPurchases
        + metric.facilityPurchases
        + metric.robotPurchases
        + metric.attributeUpgrades;
      metric.netProfit = metric.totalCreditsEarned
        + metric.merchandisingIncome
        + metric.streamingIncome
        + metric.achievementRewards
        - metric.cycleRepairCreditsPaid
        - metric.operatingCosts
        - metric.totalPurchases;
      metric.balance = balanceMap.get(metric.userId) || 0;
    }

    logger.info(
      `[CycleSnapshotService] cycle=${cycleNumber} supportingEvents=${supportingEventCount} `
      + formatProcessMemoryUsage(),
    );
    return {
      stableMetrics: Array.from(stableMetricsMap.values()),
      robotMetrics: Array.from(robotMetricsMap.values()),
    };
  }

  private async aggregateOpponentMetrics(
    cycleNumber: number,
    robotMetricsMap: Map<number, RobotMetric>,
  ): Promise<void> {
    let afterBattleId: number | undefined;
    let afterSequenceNumber: number | undefined;
    let currentBattleId: number | undefined;
    let currentBattleEvents: BattleMetricEvent[] = [];

    const applyBattleMetrics = (): void => {
      if (currentBattleEvents.length !== 2 && currentBattleEvents.length !== 4) return;
      for (const event of currentBattleEvents) {
        const robotMetric = robotMetricsMap.get(event.robotId);
        if (!robotMetric) continue;
        for (const opponent of currentBattleEvents) {
          if (opponent.robotId === event.robotId) continue;
          robotMetric.damageReceived += opponent.damageDealt;
          if (opponent.destroyed) robotMetric.kills++;
        }
      }
    };

    while (true) {
      const where: Prisma.AuditLogWhereInput = {
        cycleNumber,
        eventType: 'battle_complete',
        battleId: { not: null },
      };
      if (afterBattleId !== undefined && afterSequenceNumber !== undefined) {
        where.OR = [
          { battleId: { gt: afterBattleId } },
          { battleId: afterBattleId, sequenceNumber: { gt: afterSequenceNumber } },
        ];
      }

      const events = await prisma.auditLog.findMany({
        where,
        select: SNAPSHOT_EVENT_SELECT,
        orderBy: [{ battleId: 'asc' }, { sequenceNumber: 'asc' }],
        take: AUDIT_LOG_PAGE_SIZE,
      });
      if (events.length === 0) break;

      for (const event of events) {
        if (event.battleId === null || event.robotId === null) continue;
        if (currentBattleId !== undefined && event.battleId !== currentBattleId) {
          applyBattleMetrics();
          currentBattleEvents = [];
        }
        currentBattleId = event.battleId;
        const payload = event.payload as unknown as CycleEventPayload;
        currentBattleEvents.push({
          robotId: event.robotId,
          damageDealt: payload.damageDealt || 0,
          destroyed: payload.destroyed === true,
        });
      }

      const lastEvent = events[events.length - 1];
      if (lastEvent.battleId === null) break;
      afterBattleId = lastEvent.battleId;
      afterSequenceNumber = lastEvent.sequenceNumber;
      if (events.length < AUDIT_LOG_PAGE_SIZE) break;
    }

    applyBattleMetrics();
  }

  private async getStepDurations(cycleNumber: number): Promise<StepDuration[]> {
    const stepDurations: StepDuration[] = [];
    await this.forEachAuditLogPage(cycleNumber, ['cycle_step_complete'], (events) => {
      for (const event of events) {
        const payload = event.payload as unknown as CycleEventPayload;
        stepDurations.push({
          stepName: payload.stepName as string,
          duration: payload.duration as number,
        });
      }
    });
    return stepDurations;
  }

  private async getCycleStartTime(cycleNumber: number): Promise<Date> {
    const event = await prisma.auditLog.findFirst({
      where: { cycleNumber, eventType: 'cycle_start' },
    });
    if (event) return event.eventTimestamp;

    const snapshot = await prisma.cycleSnapshot.findUnique({ where: { cycleNumber } });
    return snapshot?.startTime ?? new Date(0);
  }

  private async getCycleEndTime(cycleNumber: number): Promise<Date> {
    const event = await prisma.auditLog.findFirst({
      where: { cycleNumber, eventType: 'cycle_complete' },
    });
    if (event) return event.eventTimestamp;

    const snapshot = await prisma.cycleSnapshot.findUnique({ where: { cycleNumber } });
    return snapshot?.endTime ?? new Date();
  }

  async getSnapshot(cycleNumber: number): Promise<CycleSnapshot | null> {
    const snapshot = await prisma.cycleSnapshot.findUnique({ where: { cycleNumber } });
    if (!snapshot) return null;

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

  async getSnapshotRange(startCycle: number, endCycle: number): Promise<CycleSnapshot[]>;
  async getSnapshotRange(
    startCycle: number,
    endCycle: number,
    fields: SnapshotField[],
  ): Promise<PartialSnapshot[]>;
  async getSnapshotRange(
    startCycle: number,
    endCycle: number,
    fields?: SnapshotField[],
  ): Promise<CycleSnapshot[] | PartialSnapshot[]> {
    const where = { cycleNumber: { gte: startCycle, lte: endCycle } };
    const orderBy = { cycleNumber: 'asc' as const };

    if (fields) {
      const select: Record<string, boolean> = {
        cycleNumber: true,
        triggerType: true,
        startTime: true,
        endTime: true,
        durationMs: true,
      };
      for (const field of fields) select[field] = true;

      const snapshots = await prisma.cycleSnapshot.findMany({ where, orderBy, select });
      return snapshots.map((snapshot: Record<string, unknown>) => {
        const result: PartialSnapshot = {
          cycleNumber: snapshot.cycleNumber as number,
          triggerType: snapshot.triggerType as 'manual' | 'scheduled',
          startTime: snapshot.startTime as Date,
          endTime: snapshot.endTime as Date,
          duration: snapshot.durationMs as number,
        };
        if (select.stableMetrics) {
          result.stableMetrics = snapshot.stableMetrics as unknown as StableMetric[];
        }
        if (select.robotMetrics) {
          result.robotMetrics = snapshot.robotMetrics as unknown as RobotMetric[];
        }
        if (select.stepDurations) {
          result.stepDurations = snapshot.stepDurations as unknown as StepDuration[];
        }
        return result;
      });
    }

    const snapshots = await prisma.cycleSnapshot.findMany({ where, orderBy });
    return snapshots.map((snapshot) => ({
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

export const cycleSnapshotService = new CycleSnapshotService();
