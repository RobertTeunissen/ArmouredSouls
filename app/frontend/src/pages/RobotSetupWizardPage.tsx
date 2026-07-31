/**
 * RobotSetupWizardPage — Page wrapper for the robot setup wizard at /robots/:id/setup.
 * Extracts robot ID from route params, fetches basic robot info, and renders the wizard shell.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import RobotSetupWizard from '../components/robot-setup/RobotSetupWizard';
import { api } from '../utils/api';

interface RobotBasicInfo {
  id: number;
  name: string;
  loadoutType: string;
}

function RobotSetupWizardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [robot, setRobot] = useState<RobotBasicInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const robotId = parseInt(id || '0');

  useEffect(() => {
    if (!robotId || isNaN(robotId)) {
      navigate('/robots', { replace: true });
      return;
    }

    let cancelled = false;
    setLoading(true);

    api.get<RobotBasicInfo>(`/api/robots/${robotId}`)
      .then((data) => {
        if (!cancelled) {
          setRobot({ id: data.id, name: data.name, loadoutType: data.loadoutType });
        }
      })
      .catch(() => {
        if (!cancelled) navigate('/robots', { replace: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [robotId, navigate]);

  const handleComplete = useCallback(() => {
    navigate(`/robots/${robotId}`, { replace: true });
  }, [robotId, navigate]);

  const handleSkip = useCallback(() => {
    navigate(`/robots/${robotId}`, { replace: true });
  }, [robotId, navigate]);

  if (loading || !robot) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-secondary">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />
      <div className="container mx-auto py-8 pb-24 lg:pb-8">
        <RobotSetupWizard
          robotId={robot.id}
          robotName={robot.name}
          loadoutType={robot.loadoutType}
          onComplete={handleComplete}
          onSkip={handleSkip}
        />
      </div>
    </div>
  );
}

export default RobotSetupWizardPage;
