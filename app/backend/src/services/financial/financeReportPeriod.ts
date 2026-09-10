import type { Prisma } from '../../../generated/prisma';
import { FinancialError, FinancialErrorCode } from '../../errors';
import type {
  ReportLimitation,
  ReportPeriodMetadata,
  ReportPeriodSelection,
} from '../../types';
import { resolveCanonicalCycleIdentity } from '../cycle/canonicalCycleIdentity';

interface NormalizedPeriodResult {
  period: ReportPeriodMetadata;
  limitations: ReportLimitation[];
}

async function cycleBoundary(
  tx: Prisma.TransactionClient,
  cycleNumber: number,
  fallback: Date,
): Promise<Date> {
  if (cycleNumber <= 1) return fallback;
  const priorComplete = await tx.auditLog.findFirst({
    where: { cycleNumber: cycleNumber - 1, eventType: 'cycle_complete' },
    orderBy: [{ sequenceNumber: 'desc' }],
    select: { eventTimestamp: true },
  });
  return priorComplete?.eventTimestamp ?? fallback;
}

export async function normalizeFinanceReportPeriod(
  tx: Prisma.TransactionClient,
  selection: ReportPeriodSelection,
  asOf: Date,
): Promise<NormalizedPeriodResult> {
  const identity = await resolveCanonicalCycleIdentity(tx);
  const limitations: ReportLimitation[] = [];
  const expectedCompetitiveActive = identity.competitiveCyclesCompleted + 1;
  if (identity.phase === 'competitive' && expectedCompetitiveActive !== identity.activeCycle) {
    limitations.push({
      code: 'cycle_identity_mismatch',
      message: 'Financial and competitive cycle identities disagree; the report uses retained financial identity without guessing.',
    });
  }

  let scope: ReportPeriodMetadata['scope'];
  let fromCycle: number;
  let toCycle: number;
  let containsCurrentCycle = false;

  if (selection.fromCycle !== undefined || selection.toCycle !== undefined) {
    scope = 'custom';
    fromCycle = selection.fromCycle ?? 1;
    toCycle = selection.toCycle ?? fromCycle;
    if (fromCycle < 1 || toCycle < fromCycle || toCycle > identity.completedCycles) {
      const message = identity.completedCycles < 1
        ? 'No completed financial cycles are available yet. Use Current cycle, or try again after Cycle 1 closes.'
        : `Completed cycle range must be between 1 and ${identity.completedCycles}`;
      throw new FinancialError(FinancialErrorCode.INVALID_REPORT_PERIOD, message);
    }
  } else {
    scope = selection.scope ?? 'current';
    switch (scope) {
      case 'current':
        fromCycle = identity.activeCycle;
        toCycle = identity.activeCycle;
        containsCurrentCycle = true;
        break;
      case 'season_to_date':
        fromCycle = 1;
        toCycle = identity.activeCycle;
        containsCurrentCycle = true;
        break;
      case 'last_completed':
        if (identity.completedCycles < 1) {
          fromCycle = 1;
          toCycle = 1;
          limitations.push({ code: 'missing_period_boundary', message: 'No completed financial cycle is available yet.' });
        } else {
          fromCycle = identity.completedCycles;
          toCycle = identity.completedCycles;
        }
        break;
      case 'last_seven':
        if (identity.completedCycles < 1) {
          fromCycle = 1;
          toCycle = 1;
          limitations.push({ code: 'missing_period_boundary', message: 'No completed financial history is available yet.' });
        } else {
          fromCycle = Math.max(1, identity.completedCycles - 6);
          toCycle = identity.completedCycles;
        }
        break;
      default:
        fromCycle = identity.activeCycle;
        toCycle = identity.activeCycle;
        containsCurrentCycle = true;
    }
  }

  const startsAt = await cycleBoundary(tx, fromCycle, identity.seasonStartedAt);
  const endsAt = containsCurrentCycle
    ? asOf
    : (await tx.auditLog.findFirst({
      where: { cycleNumber: toCycle, eventType: 'cycle_complete' },
      orderBy: [{ sequenceNumber: 'desc' }],
      select: { eventTimestamp: true },
    }))?.eventTimestamp ?? asOf;

  return {
    period: {
      seasonNumber: identity.seasonNumber,
      scope,
      fromCycle,
      toCycle,
      activeCycle: identity.activeCycle,
      phase: identity.phase,
      containsCurrentCycle,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      asOf: asOf.toISOString(),
      finality: containsCurrentCycle ? 'current_provisional' : 'completed_historical',
    },
    limitations,
  };
}
