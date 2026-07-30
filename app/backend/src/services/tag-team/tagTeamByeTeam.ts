import { createByeRobot } from '../battle/byeRobot';
import { TagTeamWithRobots } from './tagTeamTypes';

/**
 * Create a bye-team for tag team battle execution.
 * Requirements 2.5, 12.1, 12.2: Bye-team with combined ELO 2000
 */
export function createByeTeamForBattle(): TagTeamWithRobots {
  const byeRobot1 = createByeRobot(-1);
  const byeRobot2 = createByeRobot(-2);

  return {
    id: -1,
    stableId: -1,
    teamName: 'Bye Team',
    teamSize: 2,
    activeRobotId: -1,
    reserveRobotId: -2,
    createdAt: new Date(),
    updatedAt: new Date(),
    activeRobot: byeRobot1,
    reserveRobot: byeRobot2,
  };
}
