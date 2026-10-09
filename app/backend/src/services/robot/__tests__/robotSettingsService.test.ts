/**
 * Spec #55 task 2.5 (R8.6) — robotSettingsService, real database.
 *
 * Route regressions live in tests/stanceAndYieldAPI.test.ts. These cases call
 * the service directly: stance normalisation, the one-of check, the yield
 * threshold range, and the generic ownership refusal.
 */
import prisma from '../../../lib/prisma';
import { updateStance, updateYieldThreshold } from '../robotSettingsService';

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const userIds: number[] = [];

async function createStableWithRobot(): Promise<{ userId: number; robotId: number }> {
  const user = await prisma.user.create({
    data: { username: `rss_${suffix}_${userIds.length}`, passwordHash: 'x' },
  });
  userIds.push(user.id);
  const robot = await prisma.robot.create({
    data: { userId: user.id, name: `rss_${suffix}_${userIds.length}`, currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
  });
  return { userId: user.id, robotId: robot.id };
}

afterAll(async () => {
  await prisma.robot.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  // The setup file's afterAll disconnects first; the cleanup above reconnects.
  await prisma.$disconnect();
});

describe('updateStance', () => {
  it('lower-cases the stance, stores it and returns the robot with its weapons', async () => {
    const { userId, robotId } = await createStableWithRobot();
    const result = await updateStance(userId, robotId, 'OFFENSIVE');

    expect(result.stance).toBe('offensive');
    expect(result.robot.stance).toBe('offensive');
    expect(result.robot).toHaveProperty('mainWeapon');
    expect(result.robot).toHaveProperty('offhandWeapon');
    expect((await prisma.robot.findUniqueOrThrow({ where: { id: robotId } })).stance).toBe('offensive');
  });

  it('rejects a value outside offensive, defensive, balanced', async () => {
    const { userId, robotId } = await createStableWithRobot();
    await expect(updateStance(userId, robotId, 'reckless')).rejects.toMatchObject({
      code: 'INVALID_ROBOT_ATTRIBUTES',
      message: 'Invalid stance. Must be one of: offensive, defensive, balanced',
    });
    await expect(updateStance(userId, robotId, '')).rejects.toMatchObject({
      message: 'Stance is required and must be a string',
    });
  });

  it("refuses another stable's robot with the generic 403", async () => {
    const owner = await createStableWithRobot();
    const other = await createStableWithRobot();
    await expect(updateStance(other.userId, owner.robotId, 'defensive')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'Access denied',
    });
  });
});

describe('updateYieldThreshold', () => {
  it('stores a numeric threshold, accepting a numeric string', async () => {
    const { userId, robotId } = await createStableWithRobot();
    const result = await updateYieldThreshold(userId, robotId, '25');

    expect(result.yieldThreshold).toBe(25);
    expect(result.robot.yieldThreshold).toBe(25);
  });

  it('accepts the bounds 0 and 50 and rejects values outside them', async () => {
    const { userId, robotId } = await createStableWithRobot();
    await expect(updateYieldThreshold(userId, robotId, 0)).resolves.toMatchObject({ yieldThreshold: 0 });
    await expect(updateYieldThreshold(userId, robotId, 50)).resolves.toMatchObject({ yieldThreshold: 50 });
    await expect(updateYieldThreshold(userId, robotId, 51)).rejects.toMatchObject({
      message: 'Yield threshold must be between 0 and 50',
    });
    await expect(updateYieldThreshold(userId, robotId, 'abc')).rejects.toMatchObject({
      message: 'Yield threshold must be a number',
    });
    await expect(updateYieldThreshold(userId, robotId, null)).rejects.toMatchObject({
      message: 'Yield threshold is required',
    });
  });

  it("refuses another stable's robot with the generic 403", async () => {
    const owner = await createStableWithRobot();
    const other = await createStableWithRobot();
    await expect(updateYieldThreshold(other.userId, owner.robotId, 10)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
  });
});
