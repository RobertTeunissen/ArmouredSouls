import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { StableMetric } from '../../types/snapshotTypes';
import { readCycleRepairSpend } from '../economy/repairPayloadKeys';
import { collectFinancialIntegrityIssues } from './financialIntegrityDiagnostics';
import {
  classifyCycle,
  getFinancialRolloutState,
  type CutoverClassification,
  type FinancialRolloutState,
} from '../migration/financialRollout';

export type IntegrityIssueType =
  | 'credit_mismatch'
  | 'sequence_gap'
  | 'missing_events'
  | 'invalid_data'
  | 'unpaired_ledger'
  | 'unpaired_financial_audit'
  | 'duplicate_identity'
  | 'identity_conflict'
  | 'invalid_taxonomy'
  | 'invalid_breakdown'
  | 'balance_after_inconsistency'
  | 'repair_subtype_mismatch'
  | 'missing_settlement_component'
  | 'prestige_source_gap'
  | 'uncovered_direct_writer';

export interface IntegrityIssue {
  type: IntegrityIssueType;
  severity: 'warning' | 'error';
  message: string;
  details: Record<string, unknown>;
  /** Pre-cutover findings are explicitly outside the new completeness claim. */
  evidenceBoundary?: CutoverClassification;
  completenessClaim?: 'included' | 'outside';
}

export interface IntegrityReport {
  cycleNumber: number;
  isValid: boolean;
  issues: IntegrityIssue[];
  timestamp: Date;
  checksPerformed: string[];
  evidenceBoundary: CutoverClassification;
  completenessClaim: 'included' | 'outside';
  rolloutPhase: FinancialRolloutState['phase'];
  cutoverCycle: number | null;
}

export class DataIntegrityService {
  /**
   * Validate data integrity for a specific cycle
   * Checks credit consistency, sequence numbers, and event completeness
   */
  async validateCycleIntegrity(cycleNumber: number): Promise<IntegrityReport> {
    const issues: IntegrityIssue[] = [];
    const checksPerformed: string[] = [];
    const rollout = await getFinancialRolloutState();
    const evidenceBoundary = classifyCycle(cycleNumber, rollout);

    // Check 1: Credit sum consistency
    checksPerformed.push('credit_sum_consistency');
    const creditIssues = await this.checkCreditConsistency(cycleNumber);
    issues.push(...creditIssues);

    // Check 2: Sequence number continuity
    checksPerformed.push('sequence_number_continuity');
    const sequenceIssues = await this.checkSequenceNumbers(cycleNumber);
    issues.push(...sequenceIssues);

    // Check 3: Event completeness
    checksPerformed.push('event_completeness');
    const completenessIssues = await this.checkEventCompleteness(cycleNumber);
    issues.push(...completenessIssues);

    // Check 4: Forward-only financial evidence. The diagnostic is intentionally
    // skipped before cutover; those rows remain Legacy_Record history outside
    // the completeness claim and are never paired or reconstructed.
    checksPerformed.push('financial_reconciliation_boundary');
    if (evidenceBoundary === 'post_cutover') {
      const financialIssues = await collectFinancialIntegrityIssues(cycleNumber, rollout);
      issues.push(...financialIssues);
    }

    const labeledIssues = issues.map((currentIssue) => ({
      ...currentIssue,
      evidenceBoundary: currentIssue.evidenceBoundary ?? evidenceBoundary,
      completenessClaim: currentIssue.completenessClaim
        ?? (evidenceBoundary === 'post_cutover' ? 'included' : 'outside'),
    }));

    return {
      cycleNumber,
      isValid: labeledIssues.filter((currentIssue) => currentIssue.severity === 'error').length === 0,
      issues: labeledIssues,
      timestamp: new Date(),
      checksPerformed,
      evidenceBoundary,
      completenessClaim: evidenceBoundary === 'post_cutover' ? 'included' : 'outside',
      rolloutPhase: rollout.phase,
      cutoverCycle: rollout.cutoverCycle,
    };
  }

  /**
   * Check that credit changes sum to expected balance deltas
   * Validates Requirement 9.4
   */
  private async checkCreditConsistency(cycleNumber: number): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    // Get all users who had credit changes in this cycle
    const creditEvents = await prisma.auditLog.findMany({
      where: {
        cycleNumber,
        eventType: 'credit_change',
      },
      select: {
        userId: true,
        payload: true,
      },
    });

    // Group by user
    const userCreditChanges = new Map<number, number[]>();
    for (const event of creditEvents) {
      const userId = event.userId!;
      const amount = (event.payload as unknown as Record<string, unknown>).amount as number;
      
      if (!userCreditChanges.has(userId)) {
        userCreditChanges.set(userId, []);
      }
      userCreditChanges.get(userId)!.push(amount);
    }

    // Validate each user's credit changes
    for (const [userId, changes] of userCreditChanges.entries()) {
      const sumOfChanges = changes.reduce((sum, change) => sum + change, 0);
      
      // Get user's balance changes from snapshot if available
      const snapshot = await prisma.cycleSnapshot.findUnique({
        where: { cycleNumber },
      });

      if (snapshot) {
        const stableMetrics = (snapshot.stableMetrics as unknown as StableMetric[]) || [];
        const userMetrics = stableMetrics.find((m) => m.userId === userId);
        
        if (userMetrics) {
          const expectedNetChange = 
            userMetrics.totalCreditsEarned - 
            readCycleRepairSpend(userMetrics as unknown as Record<string, unknown>) - 
            userMetrics.operatingCosts;
          
          // Allow 1 credit tolerance for rounding
          if (Math.abs(sumOfChanges - expectedNetChange) > 1) {
            issues.push({
              type: 'credit_mismatch',
              severity: 'error',
              message: `Credit sum mismatch for user ${userId} in cycle ${cycleNumber}`,
              details: {
                userId,
                sumOfChanges,
                expectedNetChange,
                difference: sumOfChanges - expectedNetChange,
              },
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Check that sequence numbers are continuous within a cycle
   * Validates Requirement 9.3
   */
  private async checkSequenceNumbers(cycleNumber: number): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    const events = await prisma.auditLog.findMany({
      where: { cycleNumber },
      select: { sequenceNumber: true },
      orderBy: { sequenceNumber: 'asc' },
    });

    if (events.length === 0) {
      return issues;
    }

    const sequenceNumbers = events.map(e => e.sequenceNumber);
    const gaps: number[] = [];

    for (let i = 1; i < sequenceNumbers.length; i++) {
      const expected = sequenceNumbers[i - 1] + 1;
      const actual = sequenceNumbers[i];
      
      if (actual !== expected) {
        gaps.push(expected);
      }
    }

    if (gaps.length > 0) {
      issues.push({
        type: 'sequence_gap',
        severity: 'warning',
        message: `Sequence number gaps detected in cycle ${cycleNumber}`,
        details: {
          cycleNumber,
          missingSequenceNumbers: gaps,
          totalGaps: gaps.length,
        },
      });
    }

    return issues;
  }

  /**
   * Check that expected events exist for the cycle
   * Validates Requirement 9.2
   */
  private async checkEventCompleteness(cycleNumber: number): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    // Check for cycle start event
    const cycleStartEvent = await prisma.auditLog.findFirst({
      where: {
        cycleNumber,
        eventType: 'cycle_start',
      },
    });

    if (!cycleStartEvent) {
      issues.push({
        type: 'missing_events',
        severity: 'error',
        message: `Missing cycle_start event for cycle ${cycleNumber}`,
        details: { cycleNumber, missingEventType: 'cycle_start' },
      });
    }

    // Check for cycle complete event
    const cycleCompleteEvent = await prisma.auditLog.findFirst({
      where: {
        cycleNumber,
        eventType: 'cycle_complete',
      },
    });

    if (!cycleCompleteEvent) {
      issues.push({
        type: 'missing_events',
        severity: 'warning',
        message: `Missing cycle_complete event for cycle ${cycleNumber}`,
        details: { cycleNumber, missingEventType: 'cycle_complete' },
      });
    }

    // Check for cycle step events
    const stepEvents = await prisma.auditLog.count({
      where: {
        cycleNumber,
        eventType: 'cycle_step_complete',
      },
    });

    // Expect at least 8 cycle steps (based on design doc)
    if (stepEvents < 8) {
      issues.push({
        type: 'missing_events',
        severity: 'warning',
        message: `Incomplete cycle steps for cycle ${cycleNumber}`,
        details: {
          cycleNumber,
          expectedSteps: 8,
          actualSteps: stepEvents,
        },
      });
    }

    return issues;
  }

  /**
   * Validate integrity across multiple cycles
   */
  async validateCycleRange(startCycle: number, endCycle: number): Promise<IntegrityReport[]> {
    const reports: IntegrityReport[] = [];

    for (let cycle = startCycle; cycle <= endCycle; cycle++) {
      const report = await this.validateCycleIntegrity(cycle);
      reports.push(report);
    }

    return reports;
  }

  /**
   * Get summary of integrity issues across cycles
   */
  async getIntegritySummary(startCycle: number, endCycle: number): Promise<{
    totalCycles: number;
    validCycles: number;
    invalidCycles: number;
    totalIssues: number;
    issuesByType: Record<string, number>;
    issuesBySeverity: Record<string, number>;
  }> {
    const reports = await this.validateCycleRange(startCycle, endCycle);

    const summary = {
      totalCycles: reports.length,
      validCycles: reports.filter(r => r.isValid).length,
      invalidCycles: reports.filter(r => !r.isValid).length,
      totalIssues: reports.reduce((sum, r) => sum + r.issues.length, 0),
      issuesByType: {} as Record<string, number>,
      issuesBySeverity: {} as Record<string, number>,
    };

    for (const report of reports) {
      for (const issue of report.issues) {
        summary.issuesByType[issue.type] = (summary.issuesByType[issue.type] || 0) + 1;
        summary.issuesBySeverity[issue.severity] = (summary.issuesBySeverity[issue.severity] || 0) + 1;
      }
    }

    return summary;
  }

  /**
   * Flag a cycle for manual review
   */
  async flagCycleForReview(cycleNumber: number, reason: string): Promise<void> {
    // Store flag in database (could be a separate table or metadata field)
    logger.warn(`[DataIntegrity] Cycle ${cycleNumber} flagged for review: ${reason}`);
    
    // In a production system, this would:
    // 1. Create a database record for manual review
    // 2. Send alert to administrators
    // 3. Mark cycle snapshot with review flag
  }
}
