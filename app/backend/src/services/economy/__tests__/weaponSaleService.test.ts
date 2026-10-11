/**
 * Spec #55 task 2.3 (R8.6, R8.7) — weaponSaleService, real database.
 *
 * Route regressions live in tests/weaponInventory.test.ts. These cases call the
 * service directly: resale rate applied to `pricePaid`, the equipped-item
 * refusal, ownership, the `weapon_sale` Financial_Pair and replay.
 */
import prisma from '../../../lib/prisma';
import { applyResaleRate, calculateWeaponResaleRate } from '../../../shared/utils/discounts';
import { createEconomicRequestIdentity } from '../../financial/economicRequestReplayService';
import { sellWeapon } from '../weaponSaleService';

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
let keyCounter = 0;
const nextKey = (): string => `wss-${suffix}-${++keyCounter}`;
const userIds: number[] = [];

async function createUser(currency: number): Promise<number> {
  const user = await prisma.user.create({
    data: { username: `wss_${suffix}_${userIds.length}`, passwordHash: 'x', currency },
  });
  userIds.push(user.id);
  return user.id;
}

async function giveWeapon(userId: number, pricePaid: number): Promise<number> {
  const weapon = await prisma.weapon.findFirstOrThrow({ where: { name: 'Practice Sword' } });
  const inv = await prisma.weaponInventory.create({ data: { userId, weaponId: weapon.id, pricePaid } });
  return inv.id;
}

afterAll(async () => {
  await prisma.robot.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  // The setup file's afterAll disconnects first; the cleanup above reconnects.
  await prisma.$disconnect();
});

describe('sellWeapon', () => {
  it('pays pricePaid × resale rate, deletes the row and writes one Financial_Pair', async () => {
    const userId = await createUser(1_000);
    await prisma.facility.create({ data: { userId, facilityType: 'weapons_workshop', level: 4 } });
    const inventoryId = await giveWeapon(userId, 33_333);
    const requestKey = nextKey();

    const result = await sellWeapon(userId, inventoryId, requestKey);

    if (result.replayed) throw new Error('unexpected replay');
    const expected = applyResaleRate(33_333, calculateWeaponResaleRate(4));
    expect(result.salePrice).toBe(expected);
    expect(result.resaleRate).toBe(40);
    expect(result.pricePaid).toBe(33_333);
    expect(result.currency).toBe(1_000 + expected);
    expect(result.message).toBe(`Sold Practice Sword for ₡${expected.toLocaleString()}`);
    expect(await prisma.weaponInventory.findUnique({ where: { id: inventoryId } })).toBeNull();

    const { financialEventId } = createEconomicRequestIdentity(userId, 'weapon_sale', requestKey, { inventoryId });
    const ledger = await prisma.financialLedger.findUnique({ where: { financialEventId } });
    expect(ledger?.amount).toBe(expected);
    expect(ledger?.transactionType).toBe('weapon_sale');
  });

  it('replays the same request key without paying twice', async () => {
    const userId = await createUser(0);
    const inventoryId = await giveWeapon(userId, 50_000);
    const requestKey = nextKey();
    await sellWeapon(userId, inventoryId, requestKey);
    const balanceAfterFirst = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).currency;

    const second = await sellWeapon(userId, inventoryId, requestKey);

    expect(second.replayed).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).currency).toBe(balanceAfterFirst);
  });

  it('refuses to sell an equipped weapon (WEAPON_EQUIPPED, 409) and changes nothing', async () => {
    const userId = await createUser(500);
    const inventoryId = await giveWeapon(userId, 50_000);
    await prisma.robot.create({
      data: { userId, name: `wss_${suffix}_bot`, currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2, mainWeaponId: inventoryId },
    });

    await expect(sellWeapon(userId, inventoryId, nextKey())).rejects.toMatchObject({
      code: 'WEAPON_EQUIPPED',
      statusCode: 409,
    });
    expect(await prisma.weaponInventory.findUnique({ where: { id: inventoryId } })).not.toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).currency).toBe(500);
  });

  it("refuses another stable's weapon with the generic 403", async () => {
    const owner = await createUser(0);
    const other = await createUser(0);
    const inventoryId = await giveWeapon(owner, 50_000);

    await expect(sellWeapon(other, inventoryId, nextKey())).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'Access denied',
    });
  });
});
