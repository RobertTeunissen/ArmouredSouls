import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import type { RobotFinancialSummary } from '../../utils/financeApi';

export interface RobotDeploymentCardProps {
  robot: RobotFinancialSummary;
  expanded: boolean;
  onToggle: () => void;
}

const METRIC_LABELS = [
  'Fought matches',
  'Battle/bye income',
  'Streaming revenue',
  'Actual repair spend',
  'Direct net',
] as const;

export function RobotDeploymentCard({ robot, expanded, onToggle }: RobotDeploymentCardProps): React.ReactElement {
  const values = [
    robot.foughtMatches.toLocaleString(),
    formatCurrency(robot.battleByeIncome),
    formatCurrency(robot.streamingRevenue),
    formatCurrency(robot.actualRepairSpend),
    formatCurrency(robot.directNet),
  ];

  return (
    <article className="rounded-lg border border-gray-700 bg-surface-elevated p-4" aria-labelledby={`robot-finance-${robot.robotId}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id={`robot-finance-${robot.robotId}`} className="text-xl font-medium">{robot.robotName}</h2>
          <p className="text-sm text-secondary">Direct result from persisted battle/bye allocation, streaming revenue, and actual repairs.</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={`robot-detail-${robot.robotId}`}
          className="min-h-11 min-w-11 rounded-md border border-primary/50 px-4 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {expanded ? 'Hide details' : 'View details'}
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {METRIC_LABELS.map((label, index) => (
          <div key={label} className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-background/40 p-3 lg:block">
            <dt className="text-sm text-secondary">{label}</dt>
            <dd className="text-right font-semibold tabular-nums lg:mt-1 lg:text-left">{values[index]}</dd>
          </div>
        ))}
      </dl>

      {robot.limitations.length > 0 ? (
        <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm" role="status">
          {robot.limitations.map((limitation) => <p key={`${limitation.code}-${limitation.message}`}>{limitation.message}</p>)}
        </div>
      ) : null}
    </article>
  );
}

export default RobotDeploymentCard;
