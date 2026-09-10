import type {
  CycleBoundaryProof,
  FinanceStatement,
  FinancialRecordProjection,
  ItemisedStatementLine,
  ReconciliationProof,
  RepairStatementLine,
  ReportLimitation,
  ReportPeriodMetadata,
  SourceProvenance,
} from '../../types';
import type { OperatingCostsBreakdown, RepairBreakdown } from '../../types';

export interface RepairDomainEvidence {
  sourceEventId: string;
  userId: number | null;
  robotId: number | null;
  cycleNumber: number;
  creditsCharged: number | null;
  repairType: 'manual' | 'automatic' | null;
}

export interface BoundaryEvidence {
  cycleNumber: number;
  cycleEndBalance: number | null;
  snapshotClosingBalance: number | null;
}

export interface ReconcileFinanceInput {
  records: readonly FinancialRecordProjection[];
  period: ReportPeriodMetadata;
  repairEvidence: readonly RepairDomainEvidence[];
  boundaries: readonly BoundaryEvidence[];
  currentCurrency: number | null;
  initialLimitations?: readonly ReportLimitation[];
  sourceReference: (identity: string) => string;
}

const EARNED_TYPES = new Set(['battle_income', 'streaming_revenue', 'passive_income', 'achievement_reward']);
const PURCHASE_TYPES = new Set(['facility_upgrade', 'weapon_purchase', 'weapon_refinement', 'robot_creation', 'attribute_upgrade']);
const LABELS: Record<string, string> = {
  battle_income: 'Battle / bye income',
  streaming_revenue: 'Streaming revenue',
  passive_income: 'Merchandising income',
  achievement_reward: 'Achievement reward',
  weapon_sale: 'Weapon sale',
  repair_cost: 'Repair spend',
  operating_costs: 'Operating costs',
  facility_upgrade: 'Facility upgrade',
  weapon_purchase: 'Weapon purchase',
  weapon_refinement: 'Weapon Refinement',
  robot_creation: 'Robot creation',
  attribute_upgrade: 'Attribute upgrade',
};

function provenance(period: ReportPeriodMetadata): SourceProvenance {
  return {
    evidenceKind: 'actual',
    finality: period.finality,
    basis: 'report_period',
    asOf: period.asOf,
  };
}

function line(
  record: FinancialRecordProjection,
  amount: number,
  input: ReconcileFinanceInput,
  label = LABELS[record.transactionType] ?? record.description,
): ItemisedStatementLine {
  return {
    taxonomy: record.transactionType,
    label,
    amount,
    sourceReference: input.sourceReference(record.financialEventId),
    provenance: provenance(input.period),
  };
}

function repairLine(
  record: FinancialRecordProjection,
  input: ReconcileFinanceInput,
  limitations: ReportLimitation[],
): RepairStatementLine | null {
  const breakdown = record.breakdown as RepairBreakdown;
  const linked = input.repairEvidence.find((event) => event.sourceEventId === record.financialEventId);
  const valid = linked
    && linked.userId === record.userId
    && linked.robotId === record.robotId
    && linked.cycleNumber === record.cycleNumber
    && linked.creditsCharged === Math.abs(record.amount)
    && linked.repairType === breakdown.repairType;
  if (!valid || !linked?.repairType) {
    limitations.push({
      code: 'repair_link_mismatch',
      message: 'A repair financial record could not be matched exactly to its subtype evidence.',
      affectedSourceReference: input.sourceReference(record.financialEventId),
    });
    return null;
  }
  return {
    ...line(record, linked.creditsCharged ?? Math.abs(record.amount), input, `${linked.repairType === 'manual' ? 'Manual' : 'Automatic'} repair`),
    taxonomy: 'repair_cost',
    repairType: linked.repairType,
    eventCount: 1,
  };
}

function boundaryProofs(
  input: ReconcileFinanceInput,
  records: readonly FinancialRecordProjection[],
): { proofs: CycleBoundaryProof[]; limitations: ReportLimitation[] } {
  const proofs: CycleBoundaryProof[] = [];
  const limitations: ReportLimitation[] = [];
  const completedTo = Math.min(input.period.toCycle, input.period.activeCycle - 1);
  for (let cycle = input.period.fromCycle; cycle <= completedTo; cycle += 1) {
    const cycleRecords = records.filter((record) => record.cycleNumber === cycle);
    const derived = cycleRecords.at(-1)?.balanceAfter ?? null;
    const evidence = input.boundaries.find((boundary) => boundary.cycleNumber === cycle);
    const cycleLimitations: ReportLimitation[] = [];
    if (!evidence || evidence.cycleEndBalance === null) {
      cycleLimitations.push({ code: 'missing_period_boundary', message: `Cycle ${cycle} has no retained end-balance boundary.` });
    } else if (derived !== null && evidence.cycleEndBalance !== derived) {
      cycleLimitations.push({ code: 'cycle_end_balance_disagreement', message: `Cycle ${cycle} end balance disagrees with ordered financial records.` });
    }
    if (!evidence || evidence.snapshotClosingBalance === null) {
      cycleLimitations.push({ code: 'missing_period_boundary', message: `Cycle ${cycle} has no retained snapshot balance.` });
    } else if (derived !== null && evidence.snapshotClosingBalance !== derived) {
      cycleLimitations.push({ code: 'snapshot_balance_disagreement', message: `Cycle ${cycle} snapshot balance disagrees with ordered financial records.` });
    }
    proofs.push({
      cycleNumber: cycle,
      cycleEndBalance: evidence?.cycleEndBalance ?? null,
      snapshotClosingBalance: evidence?.snapshotClosingBalance ?? null,
      status: cycleLimitations.length === 0 ? 'matched' : 'limited',
      limitations: cycleLimitations,
    });
    limitations.push(...cycleLimitations);
  }
  return { proofs, limitations };
}

export function reconcileFinanceStatement(
  input: ReconcileFinanceInput,
): { statement: FinanceStatement; reconciliation: ReconciliationProof; limitations: ReportLimitation[] } {
  const records = [...input.records].sort((left, right) =>
    left.cycleNumber - right.cycleNumber || left.sequenceNumber - right.sequenceNumber,
  );
  const limitations = [...(input.initialLimitations ?? [])];
  const actualProvenance = provenance(input.period);
  const earnedLines: ItemisedStatementLine[] = [];
  const investmentProceedLines: ItemisedStatementLine[] = [];
  const runningCostLines: Array<ItemisedStatementLine | RepairStatementLine> = [];
  const investmentPurchaseLines: ItemisedStatementLine[] = [];

  for (const record of records) {
    if (EARNED_TYPES.has(record.transactionType)) {
      earnedLines.push(line(record, record.amount, input));
    } else if (record.transactionType === 'weapon_sale') {
      investmentProceedLines.push(line(record, record.amount, input));
    } else if (record.transactionType === 'repair_cost') {
      const linked = repairLine(record, input, limitations);
      if (linked) runningCostLines.push(linked);
    } else if (record.transactionType === 'operating_costs') {
      const breakdown = record.breakdown as OperatingCostsBreakdown;
      if (breakdown.costComponents.length === 0 && record.amount !== 0) {
        limitations.push({ code: 'legacy_evidence', message: 'Operating costs lack stored facility components.' });
      }
      for (const component of breakdown.costComponents) {
        runningCostLines.push(line(record, component.amount, input, component.name));
      }
    } else if (PURCHASE_TYPES.has(record.transactionType)) {
      investmentPurchaseLines.push(line(record, Math.abs(record.amount), input));
    }
  }

  const openingBalance = records.length > 0 ? records[0].balanceAfter - records[0].amount : null;
  const closingBalance = records.at(-1)?.balanceAfter ?? null;
  const signedMovement = records.reduce((total, record) => total + record.amount, 0);
  const earnedCredits = earnedLines.reduce((total, item) => total + item.amount, 0);
  const investmentProceeds = investmentProceedLines.reduce((total, item) => total + item.amount, 0);
  const runningCosts = records
    .filter((record) => record.transactionType === 'repair_cost' || record.transactionType === 'operating_costs')
    .reduce((total, record) => total + Math.abs(record.amount), 0);
  const investmentPurchases = investmentPurchaseLines.reduce((total, item) => total + item.amount, 0);
  const netCashMovement = earnedCredits + investmentProceeds - runningCosts - investmentPurchases;
  const equationDifference = openingBalance === null || closingBalance === null
    ? null
    : openingBalance + netCashMovement - closingBalance;
  if (openingBalance !== null && closingBalance !== null && openingBalance + signedMovement !== closingBalance) {
    limitations.push({ code: 'administrative_anomaly', message: 'Ordered ledger balances do not reconcile with signed movement.' });
  }
  if (equationDifference !== null && equationDifference !== 0) {
    limitations.push({ code: 'administrative_anomaly', message: 'The itemised statement does not reconcile with the retained closing balance.' });
  }

  const boundary = boundaryProofs(input, records);
  limitations.push(...boundary.limitations);
  if (input.period.containsCurrentCycle && closingBalance !== null && input.currentCurrency !== closingBalance) {
    limitations.push({ code: 'administrative_anomaly', message: 'Current balance confirmation differs from the latest ordered financial record.' });
  }

  const statement: FinanceStatement = {
    provenance: actualProvenance,
    openingBalance,
    earnedCredits,
    investmentProceeds,
    runningCosts,
    investmentPurchases,
    netCashMovement,
    closingBalance,
    earnedLines,
    investmentProceedLines,
    runningCostLines,
    investmentPurchaseLines,
  };
  const reconciliation: ReconciliationProof = {
    status: limitations.length > 0 ? 'limited' : input.period.containsCurrentCycle ? 'provisional' : 'reconciled',
    orderedBy: 'cycle_number_then_audit_sequence_number',
    firstOrderKey: records[0] ? { cycleNumber: records[0].cycleNumber, sequenceNumber: records[0].sequenceNumber } : null,
    lastOrderKey: records.at(-1) ? { cycleNumber: records.at(-1)!.cycleNumber, sequenceNumber: records.at(-1)!.sequenceNumber } : null,
    financialRecordCount: records.length,
    openingBalance,
    signedMovement,
    earnedCredits,
    investmentProceeds,
    runningCosts,
    investmentPurchases,
    closingBalance,
    equationDifference,
    completedCycleBoundaries: boundary.proofs,
    currentCurrencyConfirmation: input.period.containsCurrentCycle ? input.currentCurrency : null,
  };
  return { statement, reconciliation, limitations };
}
