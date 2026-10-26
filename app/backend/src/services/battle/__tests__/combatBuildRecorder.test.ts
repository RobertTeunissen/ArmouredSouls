const mockCreateMany = jest.fn();
jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: { battleParticipantBuild: { createMany: (...args: unknown[]) => mockCreateMany(...args) } },
}));
jest.mock('../../../config/logger', () => ({ __esModule: true, default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));

import { Prisma, type Robot } from '../../../../generated/prisma';
import { prepareRobotForCombat } from '../../../utils/robotCalculations';
import { ROBOT_ATTRIBUTES } from '../../../shared/utils/robotAttributes';
import { recordCombatBuilds } from '../combatBuildRecorder';
import logger from '../../../config/logger';

type PreparableRobot = Parameters<typeof prepareRobotForCombat>[0];

function robot(id: number): PreparableRobot {
  const attrs: Record<string, Prisma.Decimal> = {};
  for (const attr of ROBOT_ATTRIBUTES) attrs[attr] = new Prisma.Decimal(5);
  return {
    id, userId: 1, name: `R${id}`, loadoutType: 'single', stance: 'balanced', yieldThreshold: 10,
    maxHP: 100, maxShield: 10, currentHP: 100, currentShield: 10,
    mainWeapon: null, offhandWeapon: null,
    ...attrs,
  } as unknown as Robot as PreparableRobot;
}

beforeEach(() => {
  mockCreateMany.mockReset();
  mockCreateMany.mockResolvedValue({ count: 2 });
});

describe('recordCombatBuilds', () => {
  it('writes one row per prepared robot, skipping unprepared and repeated robots', async () => {
    const a = robot(1);
    const b = robot(2);
    const unprepared = robot(3);
    prepareRobotForCombat(a, { combatPower: 2 });
    prepareRobotForCombat(b);
    await expect(recordCombatBuilds(77, 'league_2v2', [a, b, a, unprepared])).resolves.toBe(2);
    const [{ data, skipDuplicates }] = mockCreateMany.mock.calls[0] as [{ data: Array<Record<string, unknown>>; skipDuplicates: boolean }];
    expect(skipDuplicates).toBe(true);
    expect(data.map((r) => r.robotId)).toEqual([1, 2]);
    expect(data[0]).toMatchObject({
      battleId: 77, battleType: 'league_2v2', loadoutType: 'single', stance: 'balanced', yieldThreshold: 10,
      mainWeaponId: null, offhandWeaponId: null, tuning: { combatPower: 2 },
    });
    expect((data[0].effectiveAttributes as Record<string, number>).combatPower).toBe(7);
    expect((data[0].baseAttributes as Record<string, number>).combatPower).toBe(5);
  });

  it('writes nothing when no robot was prepared', async () => {
    await expect(recordCombatBuilds(1, 'koth', [robot(9)])).resolves.toBe(0);
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('never fails the battle: a write error is logged and swallowed', async () => {
    const a = robot(4);
    prepareRobotForCombat(a);
    mockCreateMany.mockRejectedValue(new Error('db down'));
    await expect(recordCombatBuilds(5, 'grand_melee', [a])).resolves.toBe(0);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('battle 5: db down'));
  });
});
