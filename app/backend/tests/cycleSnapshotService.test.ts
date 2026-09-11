/**
 * Unit tests for CycleSnapshotService
 * 
 * Tests snapshot creation, retrieval, and aggregation logic
 */

import { cycleSnapshotService } from '../src/services/cycle/cycleSnapshotService';
import { eventLogger } from '../src/services/common/eventLogger';
import { EventType } from '../src/services/common/eventLogger';
import prisma from '../src/lib/prisma';

describe('CycleSnapshotService', () => {
  const testCycleNumber = 9999;
  const testUserId = 1;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.cycleSnapshot.deleteMany({
      where: { cycleNumber: testCycleNumber },
    });
    await prisma.auditLog.deleteMany({
      where: { cycleNumber: testCycleNumber },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.cycleSnapshot.deleteMany({
      where: { cycleNumber: testCycleNumber },
    });
    await prisma.auditLog.deleteMany({
      where: { cycleNumber: testCycleNumber },
    });
    await prisma.$disconnect();
  });

  it('should create a cycle snapshot with cycle start and complete events', async () => {
    // Log cycle start
    await eventLogger.logCycleStart(testCycleNumber, 'manual');

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    // Log cycle complete
    await eventLogger.logCycleComplete(testCycleNumber, 100);

    // Create snapshot
    const snapshot = await cycleSnapshotService.createSnapshot(testCycleNumber);

    // Verify snapshot structure
    expect(snapshot).toBeDefined();
    expect(snapshot.cycleNumber).toBe(testCycleNumber);
    expect(snapshot.triggerType).toBe('manual');
    expect(snapshot.startTime).toBeInstanceOf(Date);
    expect(snapshot.endTime).toBeInstanceOf(Date);
    expect(snapshot.duration).toBeGreaterThan(0);
    expect(Array.isArray(snapshot.stableMetrics)).toBe(true);
    expect(Array.isArray(snapshot.robotMetrics)).toBe(true);
    expect(Array.isArray(snapshot.stepDurations)).toBe(true);
  });

  it('should retrieve a snapshot by cycle number', async () => {
    const snapshot = await cycleSnapshotService.getSnapshot(testCycleNumber);

    expect(snapshot).toBeDefined();
    expect(snapshot?.cycleNumber).toBe(testCycleNumber);
  });

  it('should return null for non-existent snapshot', async () => {
    const snapshot = await cycleSnapshotService.getSnapshot(99999999);

    expect(snapshot).toBeNull();
  });

  it('should retrieve snapshots for a range of cycles', async () => {
    const snapshots = await cycleSnapshotService.getSnapshotRange(
      testCycleNumber,
      testCycleNumber
    );

    expect(Array.isArray(snapshots)).toBe(true);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].cycleNumber).toBe(testCycleNumber);
  });

  // An incomplete cycle no longer rejects. `createSnapshot` tolerates a missing
  // cycle_start or cycle_complete event, logs a warning and falls back to the current
  // time, because bulk cycle runs and manual triggers legitimately produce cycles with
  // no start event. These two tests asserted a rejection matching /incomplete/ — a
  // message the service has not produced since that change.
  it('should snapshot a cycle with no start event, using fallback timestamps', async () => {
    const incompleteCycle = testCycleNumber + 1;
    await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber: incompleteCycle } });

    // Only log complete event, no start event
    await eventLogger.logCycleComplete(incompleteCycle, 100);

    const snapshot = await cycleSnapshotService.createSnapshot(incompleteCycle);
    expect(snapshot.cycleNumber).toBe(incompleteCycle);
    expect(snapshot.startTime).toBeInstanceOf(Date);
    expect(snapshot.endTime).toBeInstanceOf(Date);

    // Clean up
    await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber: incompleteCycle } });
    await prisma.auditLog.deleteMany({
      where: { cycleNumber: incompleteCycle },
    });
  });

  it('should snapshot a cycle with no complete event, using fallback timestamps', async () => {
    const incompleteCycle = testCycleNumber + 2;
    await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber: incompleteCycle } });

    // Only log start event, no complete event
    await eventLogger.logCycleStart(incompleteCycle, 'manual');

    const snapshot = await cycleSnapshotService.createSnapshot(incompleteCycle);
    expect(snapshot.cycleNumber).toBe(incompleteCycle);
    expect(snapshot.startTime).toBeInstanceOf(Date);
    expect(snapshot.endTime).toBeInstanceOf(Date);

    // Clean up
    await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber: incompleteCycle } });
    await prisma.auditLog.deleteMany({
      where: { cycleNumber: incompleteCycle },
    });
  });

  it('should aggregate step durations from cycle step events', async () => {
    const cycleWithSteps = testCycleNumber + 3;

    // Log cycle events
    await eventLogger.logCycleStart(cycleWithSteps, 'manual');
    await eventLogger.logCycleStepComplete(cycleWithSteps, 'repair', 1, 50);
    await eventLogger.logCycleStepComplete(cycleWithSteps, 'battles', 2, 200);
    await eventLogger.logCycleComplete(cycleWithSteps, 250);

    // Create snapshot
    const snapshot = await cycleSnapshotService.createSnapshot(cycleWithSteps);

    // Verify step durations
    expect(snapshot.stepDurations).toHaveLength(2);
    expect(snapshot.stepDurations[0].stepName).toBe('repair');
    expect(snapshot.stepDurations[0].duration).toBe(50);
    expect(snapshot.stepDurations[1].stepName).toBe('battles');
    expect(snapshot.stepDurations[1].duration).toBe(200);

    // Clean up
    await prisma.cycleSnapshot.deleteMany({
      where: { cycleNumber: cycleWithSteps },
    });
    await prisma.auditLog.deleteMany({
      where: { cycleNumber: cycleWithSteps },
    });
  });

  it('should preserve aggregation across an audit-log page boundary', async () => {
    const pagedCycle = testCycleNumber + 4;
    const pagedUserId = 700001;
    const pagedRobotId = 500001;
    await eventLogger.logCycleStart(pagedCycle, 'manual');
    await eventLogger.logEventBatch(
      pagedCycle,
      Array.from({ length: 205 }, () => ({
        eventType: EventType.BATTLE_COMPLETE,
        payload: {
          credits: 3,
          prestige: 2,
          streamingRevenue: 1,
          result: 'win' as const,
          damageDealt: 4,
          eloChange: 1,
          fame: 1,
          destroyed: false,
        },
        userId: pagedUserId,
        robotId: pagedRobotId,
      })),
    );
    await eventLogger.logCycleComplete(pagedCycle, 100);

    const snapshot = await cycleSnapshotService.createSnapshot(pagedCycle);
    const stableMetric = snapshot.stableMetrics.find(
      (metric) => metric.userId === pagedUserId,
    );
    const robotMetric = snapshot.robotMetrics.find(
      (metric) => metric.robotId === pagedRobotId,
    );

    expect(stableMetric).toMatchObject({
      battlesParticipated: 205,
      totalCreditsEarned: 615,
      totalPrestigeEarned: 410,
      streamingIncome: 205,
    });
    expect(robotMetric).toMatchObject({
      battlesParticipated: 205,
      wins: 205,
      damageDealt: 820,
      creditsEarned: 615,
    });
    const persistedSnapshot = await cycleSnapshotService.getSnapshot(pagedCycle);
    expect(persistedSnapshot?.stableMetrics).toContainEqual(
      expect.objectContaining({
        userId: pagedUserId,
        totalCreditsEarned: 615,
      }),
    );

    await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber: pagedCycle } });
    await prisma.auditLog.deleteMany({ where: { cycleNumber: pagedCycle } });
  });

  it('should carry opponent groups and repair evidence across page boundaries', async () => {
    const boundaryCycle = testCycleNumber + 5;
    const userId = 700002;
    const robotA = 500002;
    const robotB = 500003;
    const fillerEvents = Array.from({ length: 199 }, (_, index) => ({
      eventType: EventType.BATTLE_COMPLETE,
      battleId: index + 1,
      payload: { result: 'draw' as const, damageDealt: 1, destroyed: false },
      userId,
      robotId: 600000 + index,
    }));

    await eventLogger.logCycleStart(boundaryCycle, 'manual');
    await eventLogger.logEventBatch(boundaryCycle, [
      ...fillerEvents,
      {
        eventType: EventType.BATTLE_COMPLETE,
        battleId: 999999,
        payload: { result: 'win' as const, damageDealt: 11, destroyed: false },
        userId,
        robotId: robotA,
      },
      {
        eventType: EventType.BATTLE_COMPLETE,
        battleId: 999999,
        payload: { result: 'loss' as const, damageDealt: 13, destroyed: true },
        userId,
        robotId: robotB,
      },
    ]);
    await eventLogger.logEventBatch(
      boundaryCycle,
      Array.from({ length: 205 }, () => ({
        eventType: EventType.ROBOT_REPAIR,
        payload: { creditsCharged: 1, repairType: 'automatic' },
        userId,
        robotId: robotA,
      })),
    );
    await eventLogger.logEvent(
      boundaryCycle,
      EventType.CYCLE_END_BALANCE,
      { balance: 9999 },
      { userId },
    );
    await eventLogger.logCycleComplete(boundaryCycle, 100);

    const snapshot = await cycleSnapshotService.createSnapshot(boundaryCycle);
    const stableMetric = snapshot.stableMetrics.find((metric) => metric.userId === userId);
    const robotAMetric = snapshot.robotMetrics.find((metric) => metric.robotId === robotA);
    const robotBMetric = snapshot.robotMetrics.find((metric) => metric.robotId === robotB);

    expect(stableMetric).toMatchObject({
      cycleRepairCreditsPaid: 205,
      balance: 9999,
    });
    expect(robotAMetric).toMatchObject({
      repairCosts: 205,
      damageReceived: 13,
      kills: 1,
    });
    expect(robotBMetric).toMatchObject({
      damageReceived: 11,
      kills: 0,
    });

    await expect(cycleSnapshotService.createSnapshot(boundaryCycle)).resolves.toBeDefined();
    await expect(prisma.cycleSnapshot.count({ where: { cycleNumber: boundaryCycle } }))
      .resolves.toBe(1);
    const persistedSnapshot = await cycleSnapshotService.getSnapshot(boundaryCycle);
    expect(persistedSnapshot?.stableMetrics).toContainEqual(
      expect.objectContaining({
        userId,
        cycleRepairCreditsPaid: 205,
        balance: 9999,
      }),
    );
    expect(persistedSnapshot?.robotMetrics).toContainEqual(
      expect.objectContaining({
        robotId: robotA,
        repairCosts: 205,
        damageReceived: 13,
      }),
    );

    await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber: boundaryCycle } });
    await prisma.auditLog.deleteMany({ where: { cycleNumber: boundaryCycle } });
  });
});
