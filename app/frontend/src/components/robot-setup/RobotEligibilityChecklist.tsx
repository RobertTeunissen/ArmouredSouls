/**
 * RobotEligibilityChecklist — notices in the Robot Workshop for scheduling
 * gates the robot still fails (Spec #47).
 *
 * Unmet hard gates (weapon, events) are one warning with a single "Finish
 * setup" action: the setup wizard opens at exactly the steps still needed.
 * The soft tuning gate is an info notice. Both use DashboardNotification, the
 * site's notice style. Renders nothing while loading, on error, or when every
 * gate shown is met.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.2, 9.7
 */

import { useNavigate } from 'react-router-dom';
import DashboardNotification from '../DashboardNotification';
import { useApiQuery } from '../../hooks/useApiQuery';
import { fetchSchedulingEligibility } from '../../utils/robotApi';
import { workshopPath } from '../../utils/robotRoutes';

interface RobotEligibilityChecklistProps {
  robotId: number;
  showRecommendations?: boolean;
}

function RobotEligibilityChecklist({ robotId, showRecommendations = false }: RobotEligibilityChecklistProps) {
  const navigate = useNavigate();
  const { data: report } = useApiQuery((signal) => fetchSchedulingEligibility(robotId, signal), [robotId]);

  if (!report || report.isFullyConfigured) return null;

  const hardGates = report.gates.filter((g) => g.severity === 'hard' && !g.met);
  const softGates = showRecommendations ? report.gates.filter((g) => g.severity === 'soft' && !g.met) : [];
  if (hardGates.length === 0 && softGates.length === 0) return null;

  return (
    <div className="space-y-3" data-testid="eligibility-checklist">
      {hardGates.length > 0 && (
        <DashboardNotification
          variant="warning"
          icon="⚠️"
          message="Not ready for battle"
          detail={hardGates.map((g) => g.label).join(' · ')}
          actionLabel="Finish setup"
          onAction={() => navigate(`/robots/${robotId}/setup`)}
        />
      )}
      {softGates.map((gate) => (
        <DashboardNotification
          key={gate.id}
          variant="info"
          icon="💡"
          message={gate.label}
          detail={gate.detail ?? undefined}
          actionLabel={gate.id === 'tuning_allocated' ? 'Allocate tuning' : undefined}
          onAction={gate.id === 'tuning_allocated' ? () => navigate(workshopPath(robotId)) : undefined}
        />
      ))}
    </div>
  );
}

export default RobotEligibilityChecklist;
