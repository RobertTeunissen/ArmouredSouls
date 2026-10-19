/**
 * getBattlePerspective — opponent's view of a battle whose other robot was
 * deleted (issue #294: account reset removes the reset stable's participant
 * rows; the backend fills that side with an 'Unknown' placeholder).
 */
import { describe, it, expect } from 'vitest';
import { getBattlePerspective } from '../battleFormatters';
import type { BattleHistory, BattleParticipantData } from '../matchmakingApi';

const UNKNOWN_SIDE = { id: 0, name: 'Unknown', userId: 0, user: { username: 'Unknown' } };
const MY_ROBOT = { id: 20, name: 'MyBot', userId: 2, user: { username: 'Me' } };

function participant(team: number): BattleParticipantData {
  return {
    robotId: MY_ROBOT.id,
    team,
    role: null,
    eloBefore: 1200,
    eloAfter: 1185,
    finalHP: 0,
    credits: 500,
    streamingRevenue: 0,
    prestigeAwarded: 0,
    fameAwarded: 0,
    damageDealt: 10,
    placement: null,
    yielded: false,
    destroyed: true,
    robot: MY_ROBOT,
  };
}

function battle(overrides: Partial<BattleHistory>): BattleHistory {
  return {
    id: 1,
    robot1Id: 0,
    robot2Id: 0,
    winnerId: 10,
    createdAt: '2026-01-01T00:00:00Z',
    durationSeconds: 30,
    robot1ELOBefore: 0,
    robot1ELOAfter: 0,
    robot2ELOBefore: 0,
    robot2ELOAfter: 0,
    robot1FinalHP: 0,
    robot2FinalHP: 0,
    winnerReward: 1000,
    loserReward: 500,
    battleType: 'league_1v1',
    robot1: UNKNOWN_SIDE,
    robot2: UNKNOWN_SIDE,
    ...overrides,
  };
}

describe('getBattlePerspective with a removed opponent', () => {
  it('uses the Unknown side when the removed robot was on team 1', () => {
    const b = battle({ robot1: UNKNOWN_SIDE, robot2: MY_ROBOT, robot2Id: MY_ROBOT.id, participants: [participant(2)] });
    const view = getBattlePerspective(b, { userId: MY_ROBOT.userId });
    expect(view.myRobot.id).toBe(MY_ROBOT.id);
    expect(view.opponent?.name).toBe('Unknown');
    expect(view.opponent?.id).not.toBe(MY_ROBOT.id);
  });

  it('uses the Unknown side when the removed robot was on team 2', () => {
    const b = battle({ robot1: MY_ROBOT, robot1Id: MY_ROBOT.id, robot2: UNKNOWN_SIDE, participants: [participant(1)] });
    const view = getBattlePerspective(b, { robotId: MY_ROBOT.id });
    expect(view.opponent?.name).toBe('Unknown');
  });

  it('never shows my own robot as the opponent', () => {
    const b = battle({ robot1: MY_ROBOT, robot1Id: MY_ROBOT.id, robot2: null, participants: [participant(1)] });
    const view = getBattlePerspective(b, { userId: MY_ROBOT.userId });
    expect(view.opponent).toBeNull();
  });

  it('keeps a bye opponent null', () => {
    const b = battle({ isByeMatch: true, robot1: MY_ROBOT, robot1Id: MY_ROBOT.id, robot2: null, participants: [participant(1)] });
    const view = getBattlePerspective(b, { userId: MY_ROBOT.userId });
    expect(view.opponent).toBeNull();
  });
});
