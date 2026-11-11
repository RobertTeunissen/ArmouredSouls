/**
 * RobotSetupWizardPage — `/robots/:id/setup`. Loads the robot and its
 * eligibility, plans the steps it still needs, and hands over to the
 * Workshop when there is nothing left to set up.
 */
import { useCallback, useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import RobotSetupWizard from '../components/robot-setup/RobotSetupWizard';
import { useRobotSetup } from '../components/robot-setup/useRobotSetup';
import { ERROR_NOTICE, SECONDARY_BUTTON } from '../components/robot-setup/styles';
import { ApiError } from '../utils/ApiError';
import { planSetupSteps } from '../utils/robotSetupSteps';
import { workshopPath } from '../utils/robotRoutes';

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.statusCode === 403) return 'You do not have access to this robot.';
  if (error instanceof ApiError && error.statusCode === 404) return 'Robot not found.';
  return 'Could not load the robot setup. Please try again.';
}

function RobotSetupWizardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const robotId = Number.parseInt(id ?? '', 10);
  const validId = Number.isInteger(robotId) && robotId > 0;
  const { data, loading, error, refetch } = useRobotSetup(validId ? robotId : 0);

  // Planned once from the state the page opened with, so finishing a step
  // never reshuffles the steps that follow it.
  const steps = useMemo(
    () => (data ? planSetupSteps({ report: data.report, hasPortrait: Boolean(data.robot.imageUrl), robotCount: data.robotCount }) : []),
    [data],
  );
  const exit = useCallback(() => navigate(workshopPath(robotId), { replace: true }), [navigate, robotId]);

  if (!validId) return <Navigate to="/robots" replace />;

  let content: React.ReactNode;
  if (error) {
    content = (
      <div className="mx-auto max-w-2xl space-y-4">
        <p className={ERROR_NOTICE} role="alert">{errorMessage(error)}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={refetch} className={SECONDARY_BUTTON}>Try again</button>
          <button type="button" onClick={() => navigate('/robots')} className={SECONDARY_BUTTON}>Back to robots</button>
        </div>
      </div>
    );
  } else if (loading) {
    content = <p className="text-secondary">Loading setup…</p>;
  } else if (!data) {
    // Not one of the player's own robots.
    return <Navigate to="/robots" replace />;
  } else if (steps.length === 0) {
    // Already battle-ready: nothing to guide.
    return <Navigate to={workshopPath(robotId)} replace />;
  } else {
    content = (
      <RobotSetupWizard
        robotId={data.robot.id}
        robotName={data.robot.name}
        loadoutType={data.robot.loadoutType}
        steps={steps}
        onExit={exit}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="container mx-auto px-4 py-6 pb-24 lg:pb-8">{content}</div>
    </div>
  );
}

export default RobotSetupWizardPage;
