/**
 * Unit tests for CycleSnapshotService
 * 
 * Tests snapshot creation, retrieval, and aggregation logic
 */

import { cycleSnapshotService } from '../src/services/cycleSnapshotService';
import { eventLogger } from '../src/services/eventLogger';
import { EventType } from '../src/services/eventLogger';
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

  it('should throw error if cycle is incomplete (missing start event)', async () => {
    const incompleteCycle = testCycleNumber + 1;

    // Only log complete event, no start event
    await eventLogger.logCycleComplete(incompleteCycle, 100);

    await expect(
      cycleSnapshotService.createSnapshot(incompleteCycle)
    ).rejects.toThrow('incomplete');

    // Clean up
    await prisma.auditLog.deleteMany({
      where: { cycleNumber: incompleteCycle },
    });
  });

  it('should throw error if cycle is incomplete (missing complete event)', async () => {
    const incompleteCycle = testCycleNumber + 2;

    // Only log start event, no complete event
    await eventLogger.logCycleStart(incompleteCycle, 'manual');

    await expect(
      cycleSnapshotService.createSnapshot(incompleteCycle)
    ).rejects.toThrow('incomplete');

    // Clean up
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
});
