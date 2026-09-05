import prisma from '../../lib/prisma';
import {
  isTransactionType,
  validateFinancialBreakdown,
  type TransactionType,
} from '../../types';
import {
  checkDirectWriterCoverage,
} from '../migration/directWriterCoverage';
import type { FinancialRolloutState } from '../migration/financialRollout';

export type FinancialIntegrityIssueType =
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

export interface FinancialIntegrityIssue {
  type: FinancialIntegrityIssueType;
  severity: 'error';
  message: string;
  details: Record<string, unknown>;
  evidenceBoundary: 'post_cutover';
  completenessClaim: 'included';
}

type JsonRecord = Record<string, unknown>;

type LedgerRow = {
  id: number;
  cycleNumber: number;
  userId: number;
  robotId: number | null;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  description: string;
  metadata: unknown;
  financialEventId: string | null;
  createdAt: Date;
};

type AuditRow = {
  id: bigint;
  cycleNumber: number;
  userId: number | null;
  robotId: number | null;
  eventType: string;
  payload: unknown;
  metadata: unknown;
  financialEventId: string | null;
  sourceEventId: string | null;
  eventTimestamp: Date;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function issue(
  type: FinancialIntegrityIssueType,
  message: string,
  details: Record<string, unknown>,
): FinancialIntegrityIssue {
  return {
    type,
    severity: 'error',
    message,
    details,
    evidenceBoundary: 'post_cutover',
    completenessClaim: 'included',
  };
}

function rowsByIdentity<T>(rows: readonly T[], getIdentity: (row: T) => string | null): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const identity = getIdentity(row);
    if (identity === null) continue;
    const existing = grouped.get(identity) ?? [];
    existing.push(row);
    grouped.set(identity, existing);
  }
  return grouped;
}

function addDuplicateIdentityIssues(
  issues: FinancialIntegrityIssue[],
  source: 'ledger' | 'financial_audit' | 'prestige',
  grouped: ReadonlyMap<string, readonly unknown[]>,
): void {
  for (const [identity, rows] of grouped.entries()) {
    if (rows.length > 1) {
      issues.push(issue(
        'duplicate_identity',
        `Duplicate ${source} identity ${identity} exists in the post-cutover period`,
        { source, identity, count: rows.length },
      ));
    }
  }
}

function addInvalidBreakdownIssue(
  issues: FinancialIntegrityIssue[],
  source: 'ledger' | 'financial_audit',
  identity: string | null,
  transactionType: string,
): void {
  issues.push(issue(
    'invalid_breakdown',
    `Post-cutover ${source} identity ${identity} has invalid ${transactionType} breakdown metadata`,
    { source, financialEventId: identity, transactionType },
  ));
}

function addInvalidTaxonomyIssue(
  issues: FinancialIntegrityIssue[],
  source: 'ledger' | 'financial_audit',
  identity: string | null,
  transactionType: unknown,
): void {
  issues.push(issue(
    'invalid_taxonomy',
    `Post-cutover ${source} row has an unknown transaction taxonomy value`,
    { source, financialEventId: identity, transactionType },
  ));
}

function validateLedgerRows(
  rows: readonly LedgerRow[],
  issues: FinancialIntegrityIssue[],
): void {
  for (const row of rows) {
    if (row.financialEventId === null) continue;
    if (!isTransactionType(row.transactionType)) {
      addInvalidTaxonomyIssue(issues, 'ledger', row.financialEventId, row.transactionType);
      continue;
    }
    if (!validateFinancialBreakdown(row.metadata, row.transactionType)) {
      addInvalidBreakdownIssue(issues, 'ledger', row.financialEventId, row.transactionType);
    }
  }
}

function validateFinancialAuditRows(
  rows: readonly AuditRow[],
  issues: FinancialIntegrityIssue[],
): void {
  for (const row of rows) {
    const payload = isRecord(row.payload) ? row.payload : null;
    const transactionType = payload?.transactionType;
    if (!isTransactionType(transactionType)) {
      addInvalidTaxonomyIssue(issues, 'financial_audit', row.financialEventId, transactionType);
      continue;
    }
    if (!validateFinancialBreakdown(payload?.breakdown, transactionType)) {
      addInvalidBreakdownIssue(issues, 'financial_audit', row.financialEventId, transactionType);
    }
  }
}

function addPairIssues(
  ledgerRows: readonly LedgerRow[],
  auditRows: readonly AuditRow[],
  issues: FinancialIntegrityIssue[],
): void {
  const ledgers = rowsByIdentity(ledgerRows, (row) => row.financialEventId);
  const audits = rowsByIdentity(auditRows, (row) => row.financialEventId);

  addDuplicateIdentityIssues(issues, 'ledger', ledgers);
  addDuplicateIdentityIssues(issues, 'financial_audit', audits);

  for (const row of ledgerRows) {
    if (row.financialEventId === null) {
      issues.push(issue(
        'unpaired_ledger',
        `Post-cutover ledger row ${row.id} has no Financial_Event identity`,
        { ledgerId: row.id, userId: row.userId, cycleNumber: row.cycleNumber },
      ));
      continue;
    }
    const matchingAudits = audits.get(row.financialEventId) ?? [];
    if (matchingAudits.length === 0) {
      issues.push(issue(
        'unpaired_ledger',
        `Post-cutover ledger row ${row.id} has no paired financial audit row`,
        { ledgerId: row.id, financialEventId: row.financialEventId },
      ));
    }
  }

  for (const row of auditRows) {
    if (row.financialEventId === null) {
      issues.push(issue(
        'unpaired_financial_audit',
        `Post-cutover financial audit row ${row.id.toString()} has no Financial_Event identity`,
        { auditLogId: row.id.toString(), cycleNumber: row.cycleNumber },
      ));
      continue;
    }
    const matchingLedgers = ledgers.get(row.financialEventId) ?? [];
    if (matchingLedgers.length === 0) {
      issues.push(issue(
        'unpaired_financial_audit',
        `Post-cutover financial audit row ${row.id.toString()} has no paired ledger row`,
        { auditLogId: row.id.toString(), financialEventId: row.financialEventId },
      ));
    }
  }

  for (const [identity, ledgerMatches] of ledgers.entries()) {
    const auditMatches = audits.get(identity) ?? [];
    if (ledgerMatches.length !== 1 || auditMatches.length !== 1) continue;
    const ledger = ledgerMatches[0];
    const auditPayload = isRecord(auditMatches[0].payload) ? auditMatches[0].payload : null;
    if (
      auditPayload?.financialEventId !== identity
      || auditPayload.transactionType !== ledger.transactionType
      || auditPayload.amount !== ledger.amount
      || auditPayload.balanceAfter !== ledger.balanceAfter
      || auditPayload.description !== ledger.description
      || canonicalJson(auditPayload.breakdown) !== canonicalJson(ledger.metadata)
      || auditMatches[0].userId !== ledger.userId
      || auditMatches[0].robotId !== ledger.robotId
    ) {
      issues.push(issue(
        'identity_conflict',
        `Ledger and financial audit facts conflict for Financial_Event ${identity}`,
        { financialEventId: identity, ledgerId: ledger.id, auditLogId: auditMatches[0].id.toString() },
      ));
    }
  }
}

function addBalanceAfterIssues(
  ledgerRows: readonly LedgerRow[],
  issues: FinancialIntegrityIssue[],
): void {
  const rowsByUser = new Map<number, LedgerRow[]>();
  for (const row of ledgerRows) {
    if (row.financialEventId === null) continue;
    const rows = rowsByUser.get(row.userId) ?? [];
    rows.push(row);
    rowsByUser.set(row.userId, rows);
  }

  for (const [userId, rows] of rowsByUser.entries()) {
    rows.sort((left, right) => {
      const timestampDifference = left.createdAt.getTime() - right.createdAt.getTime();
      return timestampDifference !== 0 ? timestampDifference : left.id - right.id;
    });
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const current = rows[index];
      if (current.balanceAfter - current.amount !== previous.balanceAfter) {
        issues.push(issue(
          'balance_after_inconsistency',
          `Post-cutover balanceAfter chain is inconsistent for user ${userId}`,
          {
            userId,
            previousLedgerId: previous.id,
            currentLedgerId: current.id,
            previousBalanceAfter: previous.balanceAfter,
            currentAmount: current.amount,
            currentBalanceAfter: current.balanceAfter,
          },
        ));
      }
    }
  }
}

function addRepairIssues(
  ledgerRows: readonly LedgerRow[],
  financialAudits: readonly AuditRow[],
  repairDomainRows: readonly AuditRow[],
  issues: FinancialIntegrityIssue[],
): void {
  const domainByIdentity = rowsByIdentity(repairDomainRows, (row) => row.sourceEventId);
  const auditByIdentity = rowsByIdentity(financialAudits, (row) => row.financialEventId);

  for (const ledger of ledgerRows.filter((row) => row.transactionType === 'repair_cost')) {
    const identity = ledger.financialEventId;
    if (identity === null) continue;
    const ledgerBreakdown = isRecord(ledger.metadata) ? ledger.metadata : null;
    const ledgerRepairType = ledgerBreakdown?.repairType;
    const financialAudit = auditByIdentity.get(identity)?.[0];
    const financialPayload = financialAudit && isRecord(financialAudit.payload)
      ? financialAudit.payload
      : null;
    const financialBreakdown = isRecord(financialPayload?.breakdown)
      ? financialPayload.breakdown
      : null;
    const domain = domainByIdentity.get(identity)?.[0];
    const domainPayload = domain && isRecord(domain.payload) ? domain.payload : null;

    if (
      (ledgerRepairType !== 'manual' && ledgerRepairType !== 'automatic')
      || financialBreakdown?.repairType !== ledgerRepairType
      || domainPayload?.repairType !== ledgerRepairType
      || !domain
    ) {
      issues.push(issue(
        'repair_subtype_mismatch',
        `Repair Financial_Event ${identity} is missing a consistent repair subtype/domain row`,
        {
          financialEventId: identity,
          ledgerRepairType,
          financialAuditRepairType: financialBreakdown?.repairType,
          domainRepairType: domainPayload?.repairType,
          hasRobotRepairDomainRow: Boolean(domain),
        },
      ));
    }
  }
}

async function snapshotUserIds(cycleNumber: number): Promise<Set<number>> {
  const snapshot = await prisma.cycleSnapshot.findUnique({
    where: { cycleNumber },
    select: { stableMetrics: true },
  });
  const userIds = new Set<number>();
  if (!snapshot || !Array.isArray(snapshot.stableMetrics)) return userIds;
  for (const metric of snapshot.stableMetrics) {
    if (isRecord(metric) && Number.isInteger(metric.userId)) userIds.add(metric.userId as number);
  }
  return userIds;
}

function addSettlementIssues(
  ledgerRows: readonly LedgerRow[],
  settlementDomainRows: readonly AuditRow[],
  stableIds: ReadonlySet<number>,
  issues: FinancialIntegrityIssue[],
): void {
  const applicableUsers = new Set<number>(stableIds);
  for (const row of ledgerRows) {
    if (row.transactionType === 'passive_income' || row.transactionType === 'operating_costs') {
      applicableUsers.add(row.userId);
    }
  }
  for (const row of settlementDomainRows) {
    if (row.userId !== null) applicableUsers.add(row.userId);
  }

  const byUser = new Map<number, Set<TransactionType>>();
  for (const row of ledgerRows) {
    if (row.transactionType !== 'passive_income' && row.transactionType !== 'operating_costs') continue;
    const components = byUser.get(row.userId) ?? new Set<TransactionType>();
    components.add(row.transactionType);
    byUser.set(row.userId, components);
  }

  for (const userId of applicableUsers) {
    const components = byUser.get(userId) ?? new Set<TransactionType>();
    for (const component of ['passive_income', 'operating_costs'] as const) {
      if (!components.has(component)) {
        issues.push(issue(
          'missing_settlement_component',
          `Settlement cycle ${ledgerRows[0]?.cycleNumber ?? 'unknown'} is missing ${component} for user ${userId}`,
          { cycleNumber: ledgerRows[0]?.cycleNumber, userId, component },
        ));
      }
    }
  }
}

function addPrestigeIssues(
  prestigeRows: readonly AuditRow[],
  issues: FinancialIntegrityIssue[],
): void {
  const grouped = rowsByIdentity(prestigeRows, (row) => row.sourceEventId);
  addDuplicateIdentityIssues(issues, 'prestige', grouped);

  for (const row of prestigeRows) {
    const payload = isRecord(row.payload) ? row.payload : null;
    const validSource = payload?.source === 'battle' || payload?.source === 'achievement';
    const validAmount = Number.isInteger(payload?.amount) && (payload?.amount as number) > 0;
    const validResult = Number.isInteger(payload?.resultingPrestige);
    if (
      row.sourceEventId === null
      || payload?.sourceEventId !== row.sourceEventId
      || !validSource
      || !validAmount
      || !validResult
      || payload?.userId !== row.userId
      || payload?.cycleNumber !== row.cycleNumber
    ) {
      issues.push(issue(
        'prestige_source_gap',
        `Post-cutover prestige_change row ${row.id.toString()} has an incomplete source identity or result`,
        {
          auditLogId: row.id.toString(),
          sourceEventId: row.sourceEventId,
          userId: row.userId,
          cycleNumber: row.cycleNumber,
        },
      ));
    }
  }
}

function addDirectWriterIssues(
  issues: FinancialIntegrityIssue[],
  workspaceRoot?: string,
): void {
  const result = checkDirectWriterCoverage(workspaceRoot);
  for (const writer of result.uncovered) {
    issues.push(issue(
      'uncovered_direct_writer',
      `Production direct User.currency writer is outside Coverage_Manifest's post-cutover policy: ${writer.file}`,
      {
        file: writer.file,
        operation: writer.operation,
        occurrence: writer.occurrence,
      },
    ));
  }
}

/**
 * Reconcile only the authoritative post-cutover cycle. This function is
 * read-only: it reports evidence defects and never pairs, rewrites, or repairs
 * historical rows.
 */
export async function collectFinancialIntegrityIssues(
  cycleNumber: number,
  rollout: FinancialRolloutState,
  workspaceRoot?: string,
): Promise<readonly FinancialIntegrityIssue[]> {
  if (rollout.cutoverCycle === null || cycleNumber < rollout.cutoverCycle) return [];

  const [ledgerRows, financialAudits, repairDomainRows, settlementDomainRows, prestigeRows, stableIds] = await Promise.all([
    prisma.financialLedger.findMany({
      where: { cycleNumber },
      select: {
        id: true,
        cycleNumber: true,
        userId: true,
        robotId: true,
        transactionType: true,
        amount: true,
        balanceAfter: true,
        description: true,
        metadata: true,
        financialEventId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.auditLog.findMany({
      where: { cycleNumber, eventType: 'financial_transaction' },
      select: {
        id: true,
        cycleNumber: true,
        userId: true,
        robotId: true,
        eventType: true,
        payload: true,
        metadata: true,
        financialEventId: true,
        sourceEventId: true,
        eventTimestamp: true,
      },
      orderBy: { eventTimestamp: 'asc' },
    }),
    prisma.auditLog.findMany({
      where: { cycleNumber, eventType: 'robot_repair' },
      select: {
        id: true,
        cycleNumber: true,
        userId: true,
        robotId: true,
        eventType: true,
        payload: true,
        metadata: true,
        financialEventId: true,
        sourceEventId: true,
        eventTimestamp: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { cycleNumber, eventType: { in: ['passive_income', 'operating_costs'] } },
      select: {
        id: true,
        cycleNumber: true,
        userId: true,
        robotId: true,
        eventType: true,
        payload: true,
        metadata: true,
        financialEventId: true,
        sourceEventId: true,
        eventTimestamp: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { cycleNumber, eventType: 'prestige_change' },
      select: {
        id: true,
        cycleNumber: true,
        userId: true,
        robotId: true,
        eventType: true,
        payload: true,
        metadata: true,
        financialEventId: true,
        sourceEventId: true,
        eventTimestamp: true,
      },
    }),
    snapshotUserIds(cycleNumber),
  ]);

  const typedLedgerRows = ledgerRows as unknown as LedgerRow[];
  const typedFinancialAudits = financialAudits as unknown as AuditRow[];
  const typedRepairRows = repairDomainRows as unknown as AuditRow[];
  const typedSettlementRows = settlementDomainRows as unknown as AuditRow[];
  const typedPrestigeRows = prestigeRows as unknown as AuditRow[];
  const issues: FinancialIntegrityIssue[] = [];

  addPairIssues(typedLedgerRows, typedFinancialAudits, issues);
  validateLedgerRows(typedLedgerRows, issues);
  validateFinancialAuditRows(typedFinancialAudits, issues);
  addBalanceAfterIssues(typedLedgerRows, issues);
  addRepairIssues(typedLedgerRows, typedFinancialAudits, typedRepairRows, issues);
  addSettlementIssues(typedLedgerRows, typedSettlementRows, stableIds, issues);
  addPrestigeIssues(typedPrestigeRows, issues);
  addDirectWriterIssues(issues, workspaceRoot);

  return issues;
}
