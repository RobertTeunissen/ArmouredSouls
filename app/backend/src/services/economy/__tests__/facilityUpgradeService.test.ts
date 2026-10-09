/**
 * Spec #55 task 2.1 (R8.6, R8.7) — facilityUpgradeService, real database.
 *
 * The route regressions live in tests/facility.test.ts; these cases call the
 * service directly the way an Automaton_Turn will: Prestige_Gate and
 * maximum-level rejections, the Financial_Pair, replay, and the optional
 * audit-context extension.
 */
import prisma from '../../../lib/prisma';
import { getFacilityConfig } from '../../../config/facilities';
import {
  buildEconomicRequestAuditContext,
  createEconomicRequestIdentity,
} from '../../financial/economicRequestReplayService';
import { getFacilityUpgradeRequirement, upgradeFacility } from '../facilityUpgradeService';

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
let keyCounter = 0;
const nextKey = (): string => `fus-${suffix}-${++keyCounter}`;

const userIds: number[] = [];

async function createUser(currency: number, prestige: number): Promise<number> {
  const user = await prisma.user.create({
    data: { username: `fus_${suffix}_${userIds.length}`, passwordHash: 'x', currency, prestige },
  });
  userIds.push(user.id);
  return user.id;
}

async function storedPair(userId: number, requestKey: string, facilityType: string) {
  const { financialEventId } = createEconomicRequestIdentity(userId, 'facility_upgrade', requestKey, { facilityType });
  const ledger = await prisma.financialLedger.findUnique({ where: { financialEventId } });
  const audit = await prisma.auditLog.findFirst({ where: { eventType: 'financial_transaction', financialEventId } });
  return { ledger, audit };
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  // The setup file's afterAll disconnects first; the cleanup above reconnects.
  await prisma.$disconnect();
});

describe('getFacilityUpgradeRequirement', () => {
  it('returns the configured next-level cost, prestige gate and max level', () => {
    const config = getFacilityConfig('weapons_workshop')!;
    expect(getFacilityUpgradeRequirement('weapons_workshop', 0)).toEqual({
      cost: config.costs[0],
      prestigeRequired: config.prestigeRequirements?.[0] ?? 0,
      maxLevel: config.maxLevel,
    });
    expect(getFacilityUpgradeRequirement('weapons_workshop', 3).prestigeRequired).toBe(config.prestigeRequirements?.[3] ?? 0);
  });

  it('reports cost 0 and no prestige at the maximum level', () => {
    const config = getFacilityConfig('weapons_workshop')!;
    expect(getFacilityUpgradeRequirement('weapons_workshop', config.maxLevel)).toEqual({
      cost: 0, prestigeRequired: 0, maxLevel: config.maxLevel,
    });
  });

  it('rejects an unknown facility type', () => {
    expect(() => getFacilityUpgradeRequirement('not_a_facility', 0)).toThrow(expect.objectContaining({ code: 'INVALID_FACILITY_TYPE' }));
  });
});

describe('upgradeFacility', () => {
  it('buys level 1, charges the configured cost and writes one Financial_Pair', async () => {
    const config = getFacilityConfig('weapons_workshop')!;
    const userId = await createUser(5_000_000, 0);
    const requestKey = nextKey();

    const result = await upgradeFacility(userId, 'weapons_workshop', requestKey);

    expect(result.replayed).toBe(false);
    if (result.replayed) return;
    expect(result.facility.level).toBe(1);
    expect(result.previousLevel).toBe(0);
    expect(result.newLevel).toBe(1);
    expect(result.cost).toBe(config.costs[0]);
    expect(result.currency).toBe(5_000_000 - config.costs[0]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).currency).toBe(result.currency);

    const { ledger, audit } = await storedPair(userId, requestKey, 'weapons_workshop');
    expect(ledger?.amount).toBe(-config.costs[0]);
    expect(ledger?.transactionType).toBe('facility_upgrade');
    expect(audit).not.toBeNull();
  });

  it('replays the same request key without a second charge', async () => {
    const userId = await createUser(5_000_000, 0);
    const requestKey = nextKey();
    const first = await upgradeFacility(userId, 'storage_facility', requestKey);
    const second = await upgradeFacility(userId, 'storage_facility', requestKey);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    if (second.replayed && !first.replayed) {
      expect(second.response.currency).toBe(first.currency);
      expect(second.response.message).toBe('Facility upgraded successfully');
    }
    const facility = await prisma.facility.findUniqueOrThrow({
      where: { userId_facilityType: { userId, facilityType: 'storage_facility' } },
    });
    expect(facility.level).toBe(1);
  });

  it('enforces the Prestige_Gate with the route error (403 FORBIDDEN)', async () => {
    const config = getFacilityConfig('weapons_workshop')!;
    const gatedLevel = (config.prestigeRequirements ?? []).findIndex((p) => p > 0) + 1;
    expect(gatedLevel).toBeGreaterThan(1);
    const userId = await createUser(50_000_000, 0);
    await prisma.facility.create({ data: { userId, facilityType: 'weapons_workshop', level: gatedLevel - 1 } });

    await expect(upgradeFacility(userId, 'weapons_workshop', nextKey())).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.currency).toBe(50_000_000);
  });

  it('rejects an upgrade at the maximum level (FACILITY_MAX_LEVEL)', async () => {
    const config = getFacilityConfig('weapons_workshop')!;
    const userId = await createUser(50_000_000, 1_000_000);
    await prisma.facility.create({ data: { userId, facilityType: 'weapons_workshop', level: config.maxLevel } });

    await expect(upgradeFacility(userId, 'weapons_workshop', nextKey())).rejects.toMatchObject({
      code: 'FACILITY_MAX_LEVEL',
      statusCode: 400,
    });
  });

  it('rejects an unaffordable upgrade without writing anything', async () => {
    const userId = await createUser(10, 0);
    const requestKey = nextKey();
    await expect(upgradeFacility(userId, 'weapons_workshop', requestKey)).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
    });
    const { ledger } = await storedPair(userId, requestKey, 'weapons_workshop');
    expect(ledger).toBeNull();
  });

  it('rejects an unknown facility type', async () => {
    const userId = await createUser(5_000_000, 0);
    await expect(upgradeFacility(userId, 'not_a_facility', nextKey())).rejects.toMatchObject({
      code: 'INVALID_FACILITY_TYPE',
    });
  });

  describe('audit context (task 2.6)', () => {
    it('stores exactly the idempotency context when no extension is passed', async () => {
      const userId = await createUser(5_000_000, 0);
      const requestKey = nextKey();
      const result = await upgradeFacility(userId, 'training_facility', requestKey);
      if (result.replayed) throw new Error('unexpected replay');

      const identity = createEconomicRequestIdentity(userId, 'facility_upgrade', requestKey, { facilityType: 'training_facility' });
      const expected = buildEconomicRequestAuditContext(identity, {
        facility: result.facility,
        currency: result.currency,
        message: result.message,
      });
      const { audit } = await storedPair(userId, requestKey, 'training_facility');
      expect(audit?.metadata).toEqual(JSON.parse(JSON.stringify(expected)));
      expect(Object.keys(audit?.metadata as Record<string, unknown>)).toEqual(['idempotency']);
    });

    it('merges an extension next to the idempotency context and never replaces it', async () => {
      const userId = await createUser(5_000_000, 0);
      const requestKey = nextKey();
      const automaton = { catalogueKey: 'clone-legion', strategyKey: 'swarm', strategyVersion: 1, trigger: 'settlement', slot: 7, attempt: 1, goalId: 'swarm.v1.3.facility' };
      await upgradeFacility(userId, 'repair_bay', requestKey, {
        auditContext: { automaton, idempotency: 'must not win' },
      });

      const { audit } = await storedPair(userId, requestKey, 'repair_bay');
      const metadata = audit?.metadata as Record<string, unknown>;
      expect(metadata.automaton).toEqual(automaton);
      expect(metadata.idempotency).toMatchObject({ operation: 'facility_upgrade', requestKey });
    });
  });
});
