import React, { useId } from 'react';
import { formatCurrency } from '../../utils/formatters';
import type {
  FinanceStatement as FinanceStatementData,
  ItemisedStatementLine,
  ReconciliationProof,
  RepairStatementLine,
  ReportLimitation,
} from '../../utils/financeApi';

interface FinanceStatementProps {
  statement: FinanceStatementData;
  reconciliation: ReconciliationProof;
  limitations?: ReportLimitation[];
  heading?: string;
}

function isRepairLine(line: ItemisedStatementLine | RepairStatementLine): line is RepairStatementLine {
  return line.taxonomy === 'repair_cost' && 'repairType' in line;
}

function formatSignedCurrency(amount: number): string {
  if (amount === 0) return formatCurrency(0);
  return `${amount > 0 ? '+' : '−'}${formatCurrency(Math.abs(amount))}`;
}

function provenanceLabel(line: ItemisedStatementLine | RepairStatementLine): string {
  const evidence = line.provenance.evidenceKind === 'actual'
    ? 'Actual'
    : line.provenance.evidenceKind === 'quoted'
      ? 'Quoted'
      : 'Modelled';
  const basis = line.provenance.basis === 'report_period'
    ? 'report period'
    : line.provenance.basis === 'current_context'
      ? 'current context'
      : 'completed sample';
  const finality = line.provenance.finality === 'current_provisional'
    ? 'current cycle provisional'
    : 'completed historical';
  return `${evidence} · ${basis} · ${finality}`;
}

function StatementLines({
  lines,
  emptyMessage,
}: {
  lines: Array<ItemisedStatementLine | RepairStatementLine>;
  emptyMessage: string;
}): React.ReactElement {
  if (lines.length === 0) return <p className="text-sm text-secondary">{emptyMessage}</p>;

  return (
    <ul className="space-y-2">
      {lines.map((line) => (
        <li
          key={`${line.sourceReference}-${line.label}`}
          className="rounded-md border border-white/10 bg-background/40 p-3"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium text-white">{line.label}</p>
              {isRepairLine(line) ? (
                <p className="text-xs text-secondary">
                  {line.repairType === 'manual' ? 'Manual' : 'Automatic'} repairs · {line.eventCount} event{line.eventCount === 1 ? '' : 's'}
                </p>
              ) : null}
              <p className="break-all text-xs text-tertiary">Reference {line.sourceReference}</p>
              <p className="text-xs text-tertiary">{provenanceLabel(line)}</p>
            </div>
            <p className="shrink-0 text-right font-semibold tabular-nums">{formatCurrency(Math.abs(line.amount))}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FinanceStatement({
  statement,
  reconciliation,
  limitations = [],
  heading = 'Finance statement',
}: FinanceStatementProps): React.ReactElement {
  const headingId = useId();

  return (
    <section className="rounded-lg border border-gray-700 bg-surface-elevated p-4" aria-labelledby={headingId}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div>
          <p className="text-xs text-secondary">Opening balance</p>
          <p className="font-semibold tabular-nums">{statement.openingBalance === null ? 'Unavailable' : formatCurrency(statement.openingBalance)}</p>
        </div>
        <div>
          <p className="text-xs text-secondary">Earned Credits</p>
          <p className="font-semibold text-success tabular-nums">{formatCurrency(statement.earnedCredits)}</p>
        </div>
        <div>
          <p className="text-xs text-secondary">Net cash movement</p>
          <p className="font-semibold tabular-nums">{formatSignedCurrency(statement.netCashMovement)}</p>
        </div>
        <div>
          <p className="text-xs text-secondary">Closing balance</p>
          <p className="font-semibold tabular-nums">{statement.closingBalance === null ? 'Unavailable' : formatCurrency(statement.closingBalance)}</p>
        </div>
      </div>

      <details className="mt-4 group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-md border border-white/10 px-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span id={headingId}>{heading}</span>
          <span aria-hidden="true" className="text-primary group-open:rotate-180">⌄</span>
        </summary>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="font-semibold">Earned Credits</h3>
              <span className="tabular-nums text-success">{formatCurrency(statement.earnedCredits)}</span>
            </div>
            <StatementLines lines={statement.earnedLines} emptyMessage="No earned Credits were recorded in this period." />
          </section>
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="font-semibold">Investment proceeds</h3>
              <span className="tabular-nums text-success">{formatCurrency(statement.investmentProceeds)}</span>
            </div>
            <StatementLines lines={statement.investmentProceedLines} emptyMessage="No investment proceeds were recorded in this period." />
          </section>
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="font-semibold">Running costs</h3>
              <span className="tabular-nums text-error">{formatCurrency(statement.runningCosts)}</span>
            </div>
            <StatementLines lines={statement.runningCostLines} emptyMessage="No running costs were recorded in this period." />
          </section>
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="font-semibold">Investment purchases</h3>
              <span className="tabular-nums text-error">{formatCurrency(statement.investmentPurchases)}</span>
            </div>
            <StatementLines lines={statement.investmentPurchaseLines} emptyMessage="No investment purchases were recorded in this period." />
          </section>
        </div>
      </details>

      <div className="mt-4 rounded-md bg-background/40 p-3 text-sm">
        <p className="font-medium">
          Reconciliation: {reconciliation.status === 'reconciled' ? 'Reconciled' : reconciliation.status === 'provisional' ? 'Provisional' : 'Limited'}
        </p>
        <p className="text-secondary">
          {reconciliation.financialRecordCount} identified financial record{reconciliation.financialRecordCount === 1 ? '' : 's'} · signed movement {formatSignedCurrency(reconciliation.signedMovement)}
        </p>
      </div>

      {limitations.length > 0 ? (
        <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3" role="status">
          <p className="font-medium">Reporting limitations</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-secondary">
            {limitations.map((limitation, index) => (
              <li key={`${limitation.code}-${index}`}>{limitation.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default FinanceStatement;
