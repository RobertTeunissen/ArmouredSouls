import React from 'react';
import { useRobotDeployment } from '../../hooks/useRobotDeployment';
import type { FinancePeriodSelection } from '../../utils/financeApi';
import { RobotDeploymentCard } from './RobotDeploymentCard';
import { RobotDeploymentDetail } from './RobotDeploymentDetail';

export interface RobotDeploymentViewProps {
  period: FinancePeriodSelection;
  active: boolean;
  refreshToken?: number;
}

export function RobotDeploymentView({ period, active, refreshToken = 0 }: RobotDeploymentViewProps): React.ReactElement {
  const {
    summaries,
    detail,
    selectedRobotId,
    selectRobot,
    setPage,
  } = useRobotDeployment(period, active, refreshToken);

  if (summaries.isLoading && summaries.data === null) {
    return <div className="rounded-lg border border-gray-700 bg-surface-elevated p-6 text-secondary" aria-busy="true">Loading robot deployment results…</div>;
  }

  if (summaries.error !== null) {
    return (
      <div className="rounded-lg border border-error/40 bg-error/10 p-4" role="alert">
        <p>{summaries.error}</p>
        <button type="button" onClick={summaries.retry} className="mt-3 min-h-11 min-w-11 rounded-md border border-error/50 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Retry robot results</button>
      </div>
    );
  }

  if (summaries.data === null || summaries.data.data.length === 0) {
    return (
      <section className="rounded-lg border border-gray-700 bg-surface-elevated p-4">
        <h2 className="text-xl font-medium">Robot deployment</h2>
        <p className="mt-2 text-secondary">No robots or direct financial events are available for this period.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Robot deployment</h2>
        <p className="mt-1 text-sm text-secondary">Direct evidence only. These results do not rank robots by profitability or apportion stable-wide costs.</p>
      </div>
      {summaries.data.data.map((robot) => {
        const expanded = selectedRobotId === robot.robotId;
        return (
          <div key={robot.robotId}>
            <RobotDeploymentCard
              robot={robot}
              expanded={expanded}
              onToggle={() => selectRobot(robot.robotId)}
            />
            {expanded ? (
              detail.isLoading ? (
                <div id={`robot-detail-${robot.robotId}`} className="mt-3 rounded-lg bg-surface p-4 text-secondary" aria-busy="true">Loading financial events…</div>
              ) : detail.error !== null ? (
                <div id={`robot-detail-${robot.robotId}`} className="mt-3 rounded-lg border border-error/40 bg-error/10 p-4" role="alert">
                  <p>{detail.error}</p>
                  <button type="button" onClick={detail.retry} className="mt-3 min-h-11 min-w-11 rounded-md border border-error/50 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Retry event detail</button>
                </div>
              ) : detail.data ? (
                <RobotDeploymentDetail response={detail.data} onPageChange={setPage} />
              ) : null
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default RobotDeploymentView;
