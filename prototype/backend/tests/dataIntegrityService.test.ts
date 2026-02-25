import prisma from '../src/lib/prisma';
import { DataIntegrityService } from '../src/services/dataIntegrityService';
import { EventLogger } from '../src/services/eventLogger';

const integrityService = new DataIntegrityService();
const eventLogger = new EventLogger();

describe('DataIntegrityService', () => {
  let testCycleNumbers: number[] = [];
  let testUserIds: number[] = [];
  let cycleCounter = 10000; // Start from a safe base number

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up test data in correct order
    if (testCycleNumbers.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { cycleNumber: { in: testCycleNumbers } },
      });
      await prisma.cycleSnapshot.deleteMany({
        where: { cycleNumber: { in: testCycleNumbers } },
      });
    }

    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    }

    testCycleNumbers = [];
    testUserIds = [];
  });

  describe('validateCycleIntegrity', () => {
    /**
     * Validates: Requirements 9.2, 9.4
     */
    it('should pass validation for a complete, valid cycle', async () => {
      const cycleNumber = cycleCounter++;
      testCycleNumbers.push(cycleNumber);

      // Create complete cycle events
      await eventLogger.logCycleStart(cycleNumber, 'manual');
      
      for (let i = 1; i <= 13; i++) {
        await eventLogger.logCycleStepComplete(cycleNumber, `step_${i}`, i, 100);
      }
      
      await eventLogger.logCycleComplete(cycleNumber, 1300);

      // Validate
      const report = await integrityService.validateCycleIntegrity(cycleNumber);

      expect(report.isValid).toBe(true);
      expect(report.issues).toHaveLength(0);
      expect(report.cycleNumber).toBe(cycleNumber);
      expect(report.checksPerformed).toContain('credit_sum_consistency');
      expect(report.checksPerformed).toContain('sequence_number_continuity');
      expect(report.checksPerformed).toContain('event_completeness');
    });

    /**
     * Validates: Requirements 9.2
     */
    it('should detect missing cycle_start event', async () => {
      const cycleNumber = cycleCounter++;
      testCycleNumbers.push(cycleNumber);

      // Create cycle without start event
      await eventLogger.logCycleStepComplete(cycleNumber, 'step_1', 1, 100);
      await eventLogger.logCycleComplete(cycleNumber, 100);

      const report = await integrityService.validateCycleIntegrity(cycleNumber);

      expect(report.isValid).toBe(false);
      expect(report.issues.length).toBeGreaterThanOrEqual(1);
      
      const startIssue = report.issues.find(i => i.message.includes('cycle_start'));
      expect(startIssue).toBeDefined();
      expect(startIssue!.type).toBe('missing_events');
      expect(startIssue!.severity).toBe('error');
    });

    /**
     * Validates: Requirements 9.2
     */
    it('should detect missing cycle_complete event', async () => {
      const cycleNumber = cycleCounter++;
      testCycleNumbers.push(cycleNumber);

      // Create cycle without complete event
      await eventLogger.logCycleStart(cycleNumber, 'manual');
      await eventLogger.logCycleStepComplete(cycleNumber, 'step_1', 1, 100);

      const report = await integrityService.validateCycleIntegrity(cycleNumber);

      expect(report.isValid).toBe(true); // Warning, not error
      expect(report.issues).toHaveLength(2); // Missing complete + incomplete steps
      
      const completeIssue = report.issues.find(i => i.message.includes('cycle_complete'));
      expect(completeIssue).toBeDefined();
      expect(completeIssue!.severity).toBe('warning');
    });

    /**
     * Validates: Requirements 9.2
     */
    it('should detect incomplete cycle steps', async () => {
      const cycleNumber = cycleCounter++;
      testCycleNumbers.push(cycleNumber);

      // Create cycle with only 3 steps (expect at least 8)
      await eventLogger.logCycleStart(cycleNumber, 'manual');
      await eventLogger.logCycleStepComplete(cycleNumber, 'step_1', 1, 100);
      await eventLogger.logCycleStepComplete(cycleNumber, 'step_2', 2, 100);
      await eventLogger.logCycleStepComplete(cycleNumber, 'step_3', 3, 100);
      await eventLogger.logCycleComplete(cycleNumber, 300);

      const report = await integrityService.validateCycleIntegrity(cycleNumber);

      expect(report.isValid).toBe(true); // Warning, not error
      
      const stepsIssue = report.issues.find(i => i.message.includes('Incomplete cycle steps'));
      expect(stepsIssue).toBeDefined();
      expect(stepsIssue!.severity).toBe('warning');
      expect(stepsIssue!.details.expectedSteps).toBe(8);
      expect(stepsIssue!.details.actualSteps).toBe(3);
    });
  });

  describe('checkSequenceNumbers', () => {
    /**
     * Validates: Requirements 9.3
     */
    it('should detect sequence number gaps', async () => {
      const cycleNumber = cycleCounter++;
      testCycleNumbers.push(cycleNumber);

      // Create events with gaps in sequence numbers
      await prisma.auditLog.create({
        data: {
          cycleNumber,
          eventType: 'cycle_start',
          eventTimestamp: new Date(),
          sequenceNumber: 1,
          payload: {},
        },
      });

      await prisma.auditLog.create({
        data: {
          cycleNumber,
          eventType: 'cycle_step_complete',
          eventTimestamp: new Date(),
          sequenceNumber: 3, // Gap: missing sequence 2
          payload: {},
        },
      });

      await prisma.auditLog.create({
        data: {
          cycleNumber,
          eventType: 'cycle_complete',
          eventTimestamp: new Date(),
          sequenceNumber: 5, // Gap: missing sequence 4
          payload: {},
        },
      });

      const report = await integrityService.validateCycleIntegrity(cycleNumber);

      const sequenceIssue = report.issues.find(i => i.type === 'sequence_gap');
      expect(sequenceIssue).toBeDefined();
      expect(sequenceIssue!.severity).toBe('warning');
      expect(sequenceIssue!.details.missingSequenceNumbers).toEqual([2, 4]);
      expect(sequenceIssue!.details.totalGaps).toBe(2);
    });

    /**
     * Validates: Requirements 9.3
     */
    it('should pass with continuous sequence numbers', async () => {
      const cycleNumber = cycleCounter++;
      testCycleNumbers.push(cycleNumber);

      // Create events with continuous sequence numbers
      for (let i = 1; i <= 5; i++) {
        await prisma.auditLog.create({
          data: {
            cycleNumber,
            eventType: 'cycle_step_complete',
            eventTimestamp: new Date(),
            sequenceNumber: i,
            payload: {},
          },
        });
      }

      const report = await integrityService.validateCycleIntegrity(cycleNumber);

      const sequenceIssue = report.issues.find(i => i.type === 'sequence_gap');
      expect(sequenceIssue).toBeUndefined();
    });
  });

  describe('checkCreditConsistency', () => {
    /**
     * Validates: Requirements 9.4
     */
    it('should detect credit sum mismatch', async () => {
      const cycleNumber = cycleCounter++;
      const userId = 900000 + cycleNumber; // Unique user ID
      testCycleNumbers.push(cycleNumber);
      testUserIds.push(userId);

      // Create cycle snapshot with expected metrics
      await prisma.cycleSnapshot.create({
        data: {
          cycleNumber,
          triggerType: 'manual',
          startTime: new Date(),
          endTime: new Date(),
          durationMs: 1000,
          stableMetrics: [
            {
              userId,
              totalCreditsEarned: 1000,
              totalRepairCosts: 200,
              operatingCosts: 100,
              netProfit: 700, // Expected net: 1000 - 200 - 100 = 700
            },
          ],
          robotMetrics: [],
          stepDurations: [],
        },
      });

      // Log credit changes that don't match
      await eventLogger.logCreditChange(cycleNumber, userId, 500, 10500, 'battle'); // Only 500 instead of 700

      const report = await integrityService.validateCycleIntegrity(cycleNumber);

      const creditIssue = report.issues.find(i => i.type === 'credit_mismatch');
      expect(creditIssue).toBeDefined();
      expect(creditIssue!.severity).toBe('error');
      expect(creditIssue!.details.userId).toBe(userId);
      expect(creditIssue!.details.sumOfChanges).toBe(500);
      expect(creditIssue!.details.expectedNetChange).toBe(700);
      expect(creditIssue!.details.difference).toBe(-200);
    });

    /**
     * Validates: Requirements 9.4
     */
    it('should pass with matching credit sums', async () => {
      const cycleNumber = cycleCounter++;
      const userId = 900000 + cycleNumber; // Unique user ID
      testCycleNumbers.push(cycleNumber);
      testUserIds.push(userId);

      // Create cycle snapshot
      await prisma.cycleSnapshot.create({
        data: {
          cycleNumber,
          triggerType: 'manual',
          startTime: new Date(),
          endTime: new Date(),
          durationMs: 1000,
          stableMetrics: [
            {
              userId,
              totalCreditsEarned: 1000,
              totalRepairCosts: 200,
              operatingCosts: 100,
              netProfit: 700,
            },
          ],
          robotMetrics: [],
          stepDurations: [],
        },
      });

      // Log matching credit changes
      await eventLogger.logCreditChange(cycleNumber, userId, 1000, 11000, 'battle');
      await eventLogger.logCreditChange(cycleNumber, userId, -200, 10800, 'repair');
      await eventLogger.logCreditChange(cycleNumber, userId, -100, 10700, 'other');

      const report = await integrityService.validateCycleIntegrity(cycleNumber);

      const creditIssue = report.issues.find(i => i.type === 'credit_mismatch');
      expect(creditIssue).toBeUndefined();
    });

    /**
     * Validates: Requirements 9.4
     */
    it('should allow 1 credit tolerance for rounding', async () => {
      const cycleNumber = cycleCounter++;
      const userId = 900000 + cycleNumber; // Unique user ID
      testCycleNumbers.push(cycleNumber);
      testUserIds.push(userId);

      // Create cycle snapshot
      await prisma.cycleSnapshot.create({
        data: {
          cycleNumber,
          triggerType: 'manual',
          startTime: new Date(),
          endTime: new Date(),
          durationMs: 1000,
          stableMetrics: [
            {
              userId,
              totalCreditsEarned: 1000,
              totalRepairCosts: 200,
              operatingCosts: 100,
              netProfit: 700,
            },
          ],
          robotMetrics: [],
          stepDurations: [],
        },
      });

      // Log credit changes with 1 credit rounding difference
      await eventLogger.logCreditChange(cycleNumber, userId, 701, 10701, 'battle'); // 701 instead of 700

      const report = await integrityService.validateCycleIntegrity(cycleNumber);

      const creditIssue = report.issues.find(i => i.type === 'credit_mismatch');
      expect(creditIssue).toBeUndefined(); // Should pass with 1 credit tolerance
    });
  });

  describe('validateCycleRange', () => {
    /**
     * Validates: Requirements 9.2, 9.4
     */
    it('should validate multiple cycles', async () => {
      const baseCycle = cycleCounter;
      const cycles = [cycleCounter++, cycleCounter++, cycleCounter++];
      testCycleNumbers.push(...cycles);

      // Create 3 cycles
      for (const cycle of cycles) {
        await eventLogger.logCycleStart(cycle, 'manual');
        await eventLogger.logCycleStepComplete(cycle, 'step_1', 1, 100);
        await eventLogger.logCycleComplete(cycle, 100);
      }

      const reports = await integrityService.validateCycleRange(cycles[0], cycles[2]);

      expect(reports).toHaveLength(3);
      expect(reports[0].cycleNumber).toBe(cycles[0]);
      expect(reports[1].cycleNumber).toBe(cycles[1]);
      expect(reports[2].cycleNumber).toBe(cycles[2]);
    });
  });

  describe('getIntegritySummary', () => {
    /**
     * Validates: Requirements 9.2, 9.4
     */
    it('should provide summary of integrity issues', async () => {
      const cycle1 = cycleCounter++;
      const cycle2 = cycleCounter++;
      const cycle3 = cycleCounter++;
      testCycleNumbers.push(cycle1, cycle2, cycle3);

      // Create cycle 1 with no issues
      await eventLogger.logCycleStart(cycle1, 'manual');
      for (let i = 1; i <= 13; i++) {
        await eventLogger.logCycleStepComplete(cycle1, `step_${i}`, i, 100);
      }
      await eventLogger.logCycleComplete(cycle1, 1300);

      // Create cycle 2 with missing start event
      await eventLogger.logCycleStepComplete(cycle2, 'step_1', 1, 100);
      await eventLogger.logCycleComplete(cycle2, 100);

      // Create cycle 3 with sequence gap
      await prisma.auditLog.create({
        data: {
          cycleNumber: cycle3,
          eventType: 'cycle_start',
          eventTimestamp: new Date(),
          sequenceNumber: 1,
          payload: {},
        },
      });
      await prisma.auditLog.create({
        data: {
          cycleNumber: cycle3,
          eventType: 'cycle_complete',
          eventTimestamp: new Date(),
          sequenceNumber: 3, // Gap: missing sequence 2
          payload: {},
        },
      });

      const summary = await integrityService.getIntegritySummary(cycle1, cycle3);

      expect(summary.totalCycles).toBe(3);
      expect(summary.validCycles).toBeGreaterThanOrEqual(1); // At least cycle 1 is valid
      expect(summary.invalidCycles).toBeGreaterThanOrEqual(1); // At least one cycle has errors
      expect(summary.totalIssues).toBeGreaterThan(0);
      expect(summary.issuesByType).toHaveProperty('missing_events');
      expect(summary.issuesBySeverity).toHaveProperty('error');
      expect(summary.issuesBySeverity).toHaveProperty('warning');
    });
  });
});
