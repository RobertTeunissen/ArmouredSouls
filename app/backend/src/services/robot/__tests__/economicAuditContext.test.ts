/**
 * Spec #55 task 2.6 (R8.2) — optional `auditContext` on the existing robot
 * purchase services, real database.
 *
 * Without the option, the stored audit metadata is exactly what these services
 * stored before (the idempotency context from
 * `buildEconomicRequestAuditContext`, nothing else). With it, the extension is
 * stored next to that context and cannot replace it.
 */
import prisma from '../../../lib/prisma';
import {
  buildEconomicRequestAuditContext,
  createEconomicRequestIdentity,
} from '../../financial/economicRequestReplayService';
import { createRobotTransaction, ROBOT_CREATION_COST } from '../robotCreationService';
import { executeUpgradeTransaction } from '../robotUpgradeService';

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
let keyCounter = 0;
const nextKey = (): string => `eac-${suffix}-${++keyCounter}`;
const userIds: number[] = [];

async function createUser(): Promise<number> {
  const user = await prisma.user.create({
    data: { username: `eac_${suffix}_${userIds.length}`, passwordHash: 'x', currency: 3_000_000 },
  });
  userIds.push(user.id);
  return user.id;
}

async function auditMetadata(financialEventId: string): Promise<Record<string, unknown>> {
  const audit = await prisma.auditLog.findFirstOrThrow({ where: { eventType: 'financial_transaction', financialEventId } });
  return audit.metadata as Record<string, unknown>;
}

afterAll(async () => {
  const robots = await prisma.robot.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robots.map((r) => r.id) } } });
  await prisma.robot.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  // The setup file's afterAll disconnects first; the cleanup above reconnects.
  await prisma.$disconnect();
});

describe('createRobotTransaction auditContext', () => {
  it('stores exactly the idempotency context when the option is omitted', async () => {
    const userId = await createUser();
    const requestKey = nextKey();
    const name = `eac_${suffix}_r1`;
    const result = await createRobotTransaction(userId, name, requestKey);

    const identity = createEconomicRequestIdentity(userId, 'robot_creation', requestKey, { name });
    const expected = buildEconomicRequestAuditContext(identity, {
      robot: result.robot,
      currency: 3_000_000 - ROBOT_CREATION_COST,
      message: 'Robot created successfully',
    });
    expect(await auditMetadata(identity.financialEventId)).toEqual(JSON.parse(JSON.stringify(expected)));
  });

  it('stores the extension next to the idempotency context', async () => {
    const userId = await createUser();
    const requestKey = nextKey();
    const name = `eac_${suffix}_r2`;
    await createRobotTransaction(userId, name, requestKey, {
      auditContext: { automaton: { goalId: 'swarm.v1.1.robots' }, idempotency: 'ignored' },
    });

    const identity = createEconomicRequestIdentity(userId, 'robot_creation', requestKey, { name });
    const metadata = await auditMetadata(identity.financialEventId);
    expect(metadata.automaton).toEqual({ goalId: 'swarm.v1.1.robots' });
    expect(metadata.idempotency).toMatchObject({ operation: 'robot_creation', requestKey });
  });
});

describe('executeUpgradeTransaction auditContext', () => {
  async function robotFor(userId: number): Promise<number> {
    const robot = await prisma.robot.create({
      data: { userId, name: `eac_${suffix}_u${userId}`, currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
    });
    return robot.id;
  }

  it('stores exactly the idempotency context when the option is omitted', async () => {
    const userId = await createUser();
    const robotId = await robotFor(userId);
    const requestKey = nextKey();
    const upgrades = { combatPower: { currentLevel: 1, plannedLevel: 3 } };
    const result = await executeUpgradeTransaction(userId, robotId, upgrades, requestKey);

    const identity = createEconomicRequestIdentity(userId, 'attribute_upgrade', requestKey, { robotId, upgrades });
    const expected = buildEconomicRequestAuditContext(identity, {
      robot: result.robot,
      currency: 3_000_000 - result.totalCost,
      totalCost: result.totalCost,
      upgradeOperations: result.upgradeOperations,
    });
    expect(await auditMetadata(identity.financialEventId)).toEqual(JSON.parse(JSON.stringify(expected)));
  });

  it('stores the extension next to the idempotency context', async () => {
    const userId = await createUser();
    const robotId = await robotFor(userId);
    const requestKey = nextKey();
    const upgrades = { armorPlating: { currentLevel: 1, plannedLevel: 2 } };
    await executeUpgradeTransaction(userId, robotId, upgrades, requestKey, {
      auditContext: { automaton: { goalId: 'paragon.v1.4.attributes' } },
    });

    const identity = createEconomicRequestIdentity(userId, 'attribute_upgrade', requestKey, { robotId, upgrades });
    const metadata = await auditMetadata(identity.financialEventId);
    expect(metadata.automaton).toEqual({ goalId: 'paragon.v1.4.attributes' });
    expect(metadata.idempotency).toMatchObject({ operation: 'attribute_upgrade', requestKey });
  });
});
