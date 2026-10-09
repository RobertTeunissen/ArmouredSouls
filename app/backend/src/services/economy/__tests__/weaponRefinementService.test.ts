/**
 * Spec #55 task 2.4 (R8.6, R8.7) — weaponRefinementService, real database.
 *
 * Route regressions live in tests/weaponInventory.test.ts and the shared
 * validator suites. These cases call the service directly: Workshop tier gate,
 * shield rule, cost from `calculateRefinementCost`, stored magnitude for
 * Sharpen, the 402 affordability error, replay and the audit-context extension.
 */
import prisma from '../../../lib/prisma';
import { calculateRefinementCost } from '../../../shared/utils/weaponRefinement';
import { createEconomicRequestIdentity } from '../../financial/economicRequestReplayService';
import { refineWeapon, refinementMagnitudeForStorage, type RefinementRequest } from '../weaponRefinementService';

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
let keyCounter = 0;
const nextKey = (): string => `wrs-${suffix}-${++keyCounter}`;
const userIds: number[] = [];

async function createUser(currency: number, workshopLevel: number): Promise<number> {
  const user = await prisma.user.create({
    data: { username: `wrs_${suffix}_${userIds.length}`, passwordHash: 'x', currency },
  });
  userIds.push(user.id);
  if (workshopLevel > 0) {
    await prisma.facility.create({ data: { userId: user.id, facilityType: 'weapons_workshop', level: workshopLevel } });
  }
  return user.id;
}

async function giveWeapon(userId: number, name: string): Promise<number> {
  const weapon = await prisma.weapon.findFirstOrThrow({ where: { name } });
  const inv = await prisma.weaponInventory.create({ data: { userId, weaponId: weapon.id, pricePaid: weapon.cost } });
  return inv.id;
}

function factsFor(inventoryId: number, request: RefinementRequest) {
  return {
    inventoryId,
    tier: request.tier,
    magnitude: refinementMagnitudeForStorage(request.tier, request.magnitude),
    targetAttribute: request.targetAttribute ?? null,
  };
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  // The setup file's afterAll disconnects first; the cleanup above reconnects.
  await prisma.$disconnect();
});

describe('refinementMagnitudeForStorage', () => {
  it('stores 1 for sharpen and forge and the requested magnitude otherwise', () => {
    expect(refinementMagnitudeForStorage('sharpen', 4)).toBe(1);
    expect(refinementMagnitudeForStorage('forge', 3)).toBe(1);
    expect(refinementMagnitudeForStorage('hone', 3)).toBe(3);
    expect(refinementMagnitudeForStorage('augment', 2)).toBe(2);
  });
});

describe('refineWeapon', () => {
  it('hones an attribute the weapon grants, charges calculateRefinementCost and raises pricePaid', async () => {
    const userId = await createUser(1_000_000, 1);
    const inventoryId = await giveWeapon(userId, 'Laser Pistol');
    const before = await prisma.weaponInventory.findUniqueOrThrow({ where: { id: inventoryId } });
    const request: RefinementRequest = { tier: 'hone', targetAttribute: 'combatPower', magnitude: 2 };
    const requestKey = nextKey();

    const result = await refineWeapon(userId, inventoryId, request, requestKey);

    if (result.replayed) throw new Error('unexpected replay');
    const cost = calculateRefinementCost('hone', 2, 0);
    expect(result.cost).toBe(cost);
    expect(result.currency).toBe(1_000_000 - cost);
    expect(result.refinement.slotIndex).toBe(1);
    expect(result.weaponInventory.pricePaid).toBe(before.pricePaid + cost);
    expect(result.weaponInventory.refinements).toHaveLength(1);
    expect(result.message).toBe('Refined Laser Pistol: hone combatPower +2');

    const { financialEventId } = createEconomicRequestIdentity(userId, 'weapon_refinement', requestKey, factsFor(inventoryId, request));
    const ledger = await prisma.financialLedger.findUnique({ where: { financialEventId } });
    expect(ledger?.amount).toBe(-cost);
    expect(ledger?.transactionType).toBe('weapon_refinement');
  });

  it('stores magnitude 1 for Sharpen and prices it from existing Sharpen count', async () => {
    const userId = await createUser(5_000_000, 5);
    const inventoryId = await giveWeapon(userId, 'Practice Sword');

    const first = await refineWeapon(userId, inventoryId, { tier: 'sharpen', magnitude: 1 }, nextKey());
    const second = await refineWeapon(userId, inventoryId, { tier: 'sharpen', magnitude: 1 }, nextKey());

    if (first.replayed || second.replayed) throw new Error('unexpected replay');
    expect(first.magnitude).toBe(1);
    expect(first.cost).toBe(calculateRefinementCost('sharpen', 1, 0));
    expect(second.cost).toBe(calculateRefinementCost('sharpen', 1, 1));
    expect(second.refinement.slotIndex).toBe(2);
  });

  it('refuses a tier the Workshop level has not unlocked (WEAPON_REFINEMENT_TIER_LOCKED, 403)', async () => {
    const userId = await createUser(5_000_000, 4);
    const inventoryId = await giveWeapon(userId, 'Practice Sword');
    await expect(refineWeapon(userId, inventoryId, { tier: 'sharpen', magnitude: 1 }, nextKey())).rejects.toMatchObject({
      code: 'WEAPON_REFINEMENT_TIER_LOCKED',
      statusCode: 403,
    });
  });

  it('refuses Sharpen on a shield', async () => {
    const userId = await createUser(5_000_000, 5);
    const inventoryId = await giveWeapon(userId, 'Light Shield');
    await expect(refineWeapon(userId, inventoryId, { tier: 'sharpen', magnitude: 1 }, nextKey())).rejects.toMatchObject({
      code: 'WEAPON_REFINEMENT_SHIELD_CANNOT_TAKE_DPS_TIER',
    });
  });

  it('refuses Hone on an attribute the weapon does not grant', async () => {
    const userId = await createUser(5_000_000, 1);
    const inventoryId = await giveWeapon(userId, 'Practice Sword');
    await expect(
      refineWeapon(userId, inventoryId, { tier: 'hone', targetAttribute: 'combatPower', magnitude: 1 }, nextKey()),
    ).rejects.toMatchObject({ code: 'WEAPON_REFINEMENT_ATTRIBUTE_NOT_ON_WEAPON' });
  });

  it('refuses an unaffordable refinement with INSUFFICIENT_CREDITS and HTTP 402', async () => {
    const userId = await createUser(100, 5);
    const inventoryId = await giveWeapon(userId, 'Practice Sword');
    await expect(refineWeapon(userId, inventoryId, { tier: 'sharpen', magnitude: 1 }, nextKey())).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
      statusCode: 402,
    });
    expect(await prisma.weaponRefinement.count({ where: { weaponInventoryId: inventoryId } })).toBe(0);
  });

  it('replays the same request key without a second refinement', async () => {
    const userId = await createUser(5_000_000, 5);
    const inventoryId = await giveWeapon(userId, 'Practice Sword');
    const requestKey = nextKey();
    await refineWeapon(userId, inventoryId, { tier: 'sharpen', magnitude: 1 }, requestKey);
    const second = await refineWeapon(userId, inventoryId, { tier: 'sharpen', magnitude: 1 }, requestKey);

    expect(second.replayed).toBe(true);
    expect(await prisma.weaponRefinement.count({ where: { weaponInventoryId: inventoryId } })).toBe(1);
  });

  it('merges an audit-context extension into the stored metadata', async () => {
    const userId = await createUser(5_000_000, 5);
    const inventoryId = await giveWeapon(userId, 'Practice Sword');
    const request: RefinementRequest = { tier: 'sharpen', magnitude: 1 };
    const requestKey = nextKey();
    await refineWeapon(userId, inventoryId, request, requestKey, { auditContext: { automaton: { goalId: 'r1' } } });

    const { financialEventId } = createEconomicRequestIdentity(userId, 'weapon_refinement', requestKey, factsFor(inventoryId, request));
    const audit = await prisma.auditLog.findFirst({ where: { eventType: 'financial_transaction', financialEventId } });
    const metadata = audit?.metadata as Record<string, unknown>;
    expect(metadata.automaton).toEqual({ goalId: 'r1' });
    expect(metadata.idempotency).toMatchObject({ operation: 'weapon_refinement', requestKey });
  });
});
