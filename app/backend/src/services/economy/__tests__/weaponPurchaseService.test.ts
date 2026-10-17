/**
 * Spec #55 task 2.2 (R8.6, R8.7) — weaponPurchaseService, real database.
 *
 * Route regressions live in tests/weaponInventory.test.ts. These cases call the
 * service directly: Weapons Workshop discount, Storage_Capacity, the
 * `weapon_purchase` Financial_Pair, replay and the audit-context extension.
 */
import prisma from '../../../lib/prisma';
import { applyDiscount, calculateWeaponWorkshopDiscount } from '../../../shared/utils/discounts';
import { createEconomicRequestIdentity } from '../../financial/economicRequestReplayService';
import { purchaseWeapon } from '../weaponPurchaseService';

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
let keyCounter = 0;
const nextKey = (): string => `wps-${suffix}-${++keyCounter}`;
const userIds: number[] = [];

async function createUser(currency: number): Promise<number> {
  const user = await prisma.user.create({
    data: { username: `wps_${suffix}_${userIds.length}`, passwordHash: 'x', currency },
  });
  userIds.push(user.id);
  return user.id;
}

async function weaponByName(name: string) {
  return prisma.weapon.findFirstOrThrow({ where: { name } });
}

async function storedPair(userId: number, requestKey: string, weaponId: number) {
  const { financialEventId } = createEconomicRequestIdentity(userId, 'weapon_purchase', requestKey, { weaponId });
  const ledger = await prisma.financialLedger.findUnique({ where: { financialEventId } });
  const audit = await prisma.auditLog.findFirst({ where: { eventType: 'financial_transaction', financialEventId } });
  return { ledger, audit };
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  // The setup file's afterAll disconnects first; the cleanup above reconnects.
  await prisma.$disconnect();
});

describe('purchaseWeapon', () => {
  it('applies the Weapons Workshop discount and records pricePaid and one Financial_Pair', async () => {
    const weapon = await weaponByName('Laser Pistol');
    const userId = await createUser(1_000_000);
    await prisma.facility.create({ data: { userId, facilityType: 'weapons_workshop', level: 3 } });
    const requestKey = nextKey();

    const result = await purchaseWeapon(userId, weapon.id, requestKey);

    if (result.replayed) throw new Error('unexpected replay');
    const expectedCost = applyDiscount(weapon.cost, calculateWeaponWorkshopDiscount(3));
    expect(result.finalCost).toBe(expectedCost);
    expect(result.discountPercent).toBe(15); // Season 2: 5% per Workshop level
    expect(result.weaponInventory.pricePaid).toBe(expectedCost);
    expect(result.weaponInventory.weapon.id).toBe(weapon.id);
    expect(result.currency).toBe(1_000_000 - expectedCost);
    expect(result.message).toBe('Weapon purchased successfully');

    const { ledger, audit } = await storedPair(userId, requestKey, weapon.id);
    expect(ledger?.amount).toBe(-expectedCost);
    expect(ledger?.transactionType).toBe('weapon_purchase');
    expect(audit).not.toBeNull();
  });

  it('replays the same request key without buying a second copy', async () => {
    const weapon = await weaponByName('Practice Sword');
    const userId = await createUser(1_000_000);
    const requestKey = nextKey();
    const first = await purchaseWeapon(userId, weapon.id, requestKey);
    const second = await purchaseWeapon(userId, weapon.id, requestKey);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(await prisma.weaponInventory.count({ where: { userId } })).toBe(1);
  });

  it('refuses a purchase when Storage_Capacity is full (STORAGE_CAPACITY_FULL)', async () => {
    const weapon = await weaponByName('Practice Sword');
    const userId = await createUser(10_000_000);
    await prisma.weaponInventory.createMany({
      data: Array.from({ length: 5 }, () => ({ userId, weaponId: weapon.id, pricePaid: weapon.cost })),
    });

    await expect(purchaseWeapon(userId, weapon.id, nextKey())).rejects.toMatchObject({
      code: 'STORAGE_CAPACITY_FULL',
      statusCode: 400,
    });
    expect(await prisma.weaponInventory.count({ where: { userId } })).toBe(5);
  });

  it('refuses an unaffordable weapon (INSUFFICIENT_CREDITS) and an unknown weapon (WEAPON_NOT_FOUND)', async () => {
    const weapon = await weaponByName('Practice Sword');
    const userId = await createUser(10);
    await expect(purchaseWeapon(userId, weapon.id, nextKey())).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
    await expect(purchaseWeapon(userId, 2_000_000_000, nextKey())).rejects.toMatchObject({
      code: 'WEAPON_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('merges an audit-context extension into the stored metadata', async () => {
    const weapon = await weaponByName('Practice Sword');
    const userId = await createUser(1_000_000);
    const requestKey = nextKey();
    await purchaseWeapon(userId, weapon.id, requestKey, { auditContext: { automaton: { goalId: 'g1' } } });

    const { audit } = await storedPair(userId, requestKey, weapon.id);
    const metadata = audit?.metadata as Record<string, unknown>;
    expect(metadata.automaton).toEqual({ goalId: 'g1' });
    expect(metadata.idempotency).toMatchObject({ operation: 'weapon_purchase', requestKey });
  });
});
