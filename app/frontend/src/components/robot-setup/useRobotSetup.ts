/**
 * Loads what the setup wizard needs to plan its steps: the robot (from the
 * owner's roster, which also gives the roster size) and its eligibility gates.
 */
import { useApiQuery, type ApiQuery } from '../../hooks/useApiQuery';
import { fetchMyRobots, fetchSchedulingEligibility, type Robot } from '../../utils/robotApi';
import type { SchedulingEligibilityReport } from './types';

export interface RobotSetupData {
  robot: Robot;
  report: SchedulingEligibilityReport;
  robotCount: number;
}

/** `data` is null when the robot is not in the player's own roster. */
export function useRobotSetup(robotId: number): ApiQuery<RobotSetupData | null> {
  return useApiQuery<RobotSetupData | null>(async (signal) => {
    const [robots, report] = await Promise.all([fetchMyRobots(), fetchSchedulingEligibility(robotId, signal)]);
    const robot = robots.find((r) => r.id === robotId);
    return robot ? { robot, report, robotCount: robots.length } : null;
  }, [robotId], { enabled: robotId > 0 });
}
