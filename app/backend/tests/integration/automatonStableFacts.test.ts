/**
 * Spec #55 task 5.1 (R5.1, design §8.1) — `loadStableFacts`,
 * `loadBlueprintFacts` and `loadWeaponCatalogue` against seeded data.
 *
 * Real database. Checks every field of the facts the planner reads: balance
 * and prestige, facility levels (0 when absent), robots ordered by
 * Blueprint_Slot with attributes, settings, hands, matched Weapon_Stage
 * (including −1), subscriptions and tuning, the inventory with refinements,
 * registered teams, and the robot names that matter for the next robot.
 */
import prisma from '../../src/lib/prisma';
import {
  loadBlueprintFacts,
  loadStableFacts,
  loadWeaponCatalogue,
} from '../../src/services/automaton/stableFacts';
import { createAutomatonStable, deleteAutomatonStables, type AutomatonStableFixture } from '../helpers/automatonStable';
import { createTestBattle } from '../testHelpers';

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const userIds: number[] = [];
const SEASON = { seasonNumber: 7, phase: 'competitive' as const };

async function weaponId(name: string): Promise<number> {
  return (await prisma.weapon.findFirstOrThrow({ where: { name }, select: { id: true } })).id;
}

async function giveWeapon(userId: number, name: string, pricePaid: number): Promise<number> {
  return (await prisma.weaponInventory.create({ data: { userId, weaponId: await weaponId(name), pricePaid } })).id;
}

async function robotFor(userId: number, name: string, data: Record<string, unknown>): Promise<number> {
  const robot = await prisma.robot.create({
    data: { userId, name, currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2, ...data },
  });
  return robot.id;
}

describe('loadStableFacts (Spec #55 task 5.1)', () => {
  let fixture: AutomatonStableFixture;
  let swordId: number;
  let pistolId: number;
  let blasterId: number;
  let shieldId: number;
  let r1: number;
  let r2: number;
  let r3: number;
  let teamId: number;
  const bpName = (slot: number): string => `FactsBp${slot}${suffix}`.slice(0, 50);

  beforeAll(async () => {
    fixture = await createAutomatonStable({
      tag: `facts${suffix}`,
      balance: 1_234_567,
      prestige: 4321,
      blueprints: [
        { slotIndex: 1, robotName: bpName(1), loadoutType: 'single', imageUrl: '/assets/automatons/x/1.webp', weaponPath: [{ main: 'Practice Sword' }, { main: 'Laser Pistol' }] },
        { slotIndex: 2, robotName: bpName(2), loadoutType: 'weapon_shield', stance: 'defensive', yieldThreshold: 20, buildFocus: 'warden', weaponPath: [{ main: 'Practice Blaster', offhand: 'Light Shield' }] },
        { slotIndex: 3, robotName: bpName(3), loadoutType: 'single', weaponPath: [{ main: 'Practice Sword' }] },
      ],
      teamNames: { twoVsTwo: ['Facts Pair'], threeVsThree: [] },
    });
    userIds.push(fixture.userId);
    const { userId } = fixture;
    await prisma.facility.createMany({
      data: [
        { userId, facilityType: 'roster_expansion', level: 2 },
        { userId, facilityType: 'storage_facility', level: 1 },
        { userId, facilityType: 'weapons_workshop', level: 3 },
        { userId, facilityType: 'refinement_lab', level: 2 },
        { userId, facilityType: 'booking_office', level: 1 },
      ],
    });
    pistolId = await giveWeapon(userId, 'Laser Pistol', 57_000);
    blasterId = await giveWeapon(userId, 'Practice Blaster', 50_000);
    shieldId = await giveWeapon(userId, 'Light Shield', 51_000);
    swordId = await giveWeapon(userId, 'Practice Sword', 0);
    await prisma.weaponRefinement.create({
      data: { weaponInventoryId: swordId, tier: 'hone', magnitude: 2, targetAttribute: 'combatPower', costPaid: 1000, slotIndex: 1 },
    });

    // Created out of slot order: the facts sort by Blueprint_Slot.
    r2 = await robotFor(userId, `FactsR2${suffix}`, {
      automatonSlotIndex: 2, automatonBlueprintId: fixture.blueprintIds.get(2), loadoutType: 'weapon_shield',
      stance: 'defensive', yieldThreshold: 20, mainWeaponId: blasterId, offhandWeaponId: shieldId,
    });
    r1 = await robotFor(userId, bpName(1), {
      automatonSlotIndex: 1, automatonBlueprintId: fixture.blueprintIds.get(1), loadoutType: 'single',
      mainWeaponId: pistolId, combatPower: 7, armorPlating: 3,
    });
    // Slot 3: its loadout does not match the blueprint, so no stage matches.
    r3 = await robotFor(userId, `FactsR3${suffix}`, {
      automatonSlotIndex: 3, automatonBlueprintId: fixture.blueprintIds.get(3), loadoutType: 'two_handed',
    });
    // A robot without a Blueprint_Slot is left out (invariant I4 says there is none).
    await robotFor(userId, `FactsStray${suffix}`, {});

    await prisma.subscription.createMany({
      data: [
        { robotId: r1, eventType: 'koth' },
        { robotId: r1, eventType: 'league_1v1' },
        { robotId: r2, eventType: 'league_2v2' },
      ],
    });
    await prisma.tuningAllocation.create({ data: { robotId: r1, combatPower: 1.25, armorPlating: 0.5 } });
    const team = await prisma.teamBattle.create({
      data: {
        stableId: userId, teamSize: 2, teamName: 'Facts Pair',
        members: { create: [{ robotId: r1, slotIndex: 0 }, { robotId: r2, slotIndex: 1 }] },
      },
    });
    teamId = team.id;

    // Names taken elsewhere in the game that the next robot could use.
    const other = await prisma.user.create({ data: { username: `facts_other${suffix}`, passwordHash: 'x' } });
    userIds.push(other.id);
    await robotFor(other.id, `${bpName(3)} Mk II`.slice(0, 50), {});
    await robotFor(other.id, `Unrelated${suffix}`, {});
  });

  afterAll(async () => {
    await deleteAutomatonStables(userIds);
    await prisma.$disconnect();
  });

  it('loads balance, prestige, season and every facility level', async () => {
    const facts = await loadStableFacts(prisma, fixture.profileId, { season: SEASON });
    expect(facts.profileId).toBe(fixture.profileId);
    expect(facts.userId).toBe(fixture.userId);
    expect(facts.catalogueKey).toBe(fixture.catalogueKey);
    expect(facts.seasonNumber).toBe(7);
    expect(facts.phase).toBe('competitive');
    expect(facts.balance).toBe(1_234_567);
    expect(facts.prestige).toBe(4321);
    expect(facts.facilities.roster_expansion).toBe(2);
    expect(facts.facilities.storage_facility).toBe(1);
    expect(facts.facilities.weapons_workshop).toBe(3);
    expect(facts.facilities.refinement_lab).toBe(2);
    expect(facts.facilities.booking_office).toBe(1);
    expect(facts.facilities.repair_bay).toBe(0);
    expect(facts.facilities.tuning_bay).toBe(0);
    expect(Object.keys(facts.facilities)).toHaveLength(14);
  });

  it('loads robots in Blueprint_Slot order with attributes, settings, hands, stage, subscriptions and tuning', async () => {
    const facts = await loadStableFacts(prisma, fixture.profileId, { season: SEASON });
    expect(facts.robots.map((r) => r.robotId)).toEqual([r1, r2, r3]);
    const [one, two, three] = facts.robots;
    expect(one).toMatchObject({
      slotIndex: 1,
      blueprintId: fixture.blueprintIds.get(1),
      loadoutType: 'single',
      stance: 'balanced',
      yieldThreshold: 10,
      mainInventoryId: pistolId,
      offhandInventoryId: null,
      stageIndex: 1,
      subscriptions: ['league_1v1', 'koth'],
      heldEventTypes: [],
      tuning: { combatPower: 1.25, armorPlating: 0.5 },
    });
    expect(one.attributes.combatPower).toBe(7);
    expect(one.attributes.armorPlating).toBe(3);
    expect(Object.keys(one.attributes)).toHaveLength(23);
    expect(two).toMatchObject({
      slotIndex: 2, loadoutType: 'weapon_shield', stance: 'defensive', yieldThreshold: 20,
      mainInventoryId: blasterId, offhandInventoryId: shieldId, stageIndex: 0, subscriptions: ['league_2v2'], tuning: {},
    });
    expect(three).toMatchObject({ slotIndex: 3, loadoutType: 'two_handed', stageIndex: -1, subscriptions: [] });
  });

  it('loads the inventory with refinements, the teams and the taken names', async () => {
    const facts = await loadStableFacts(prisma, fixture.profileId, { season: SEASON });
    expect(facts.inventory.map((i) => [i.inventoryId, i.weaponName, i.pricePaid])).toEqual([
      [pistolId, 'Laser Pistol', 57_000],
      [blasterId, 'Practice Blaster', 50_000],
      [shieldId, 'Light Shield', 51_000],
      [swordId, 'Practice Sword', 0],
    ]);
    expect(facts.inventory.find((i) => i.inventoryId === swordId)?.refinements).toEqual([
      { tier: 'hone', magnitude: 2, targetAttribute: 'combatPower' },
    ]);
    expect(facts.inventory.every((i) => typeof i.createdAtMs === 'number' && i.createdAtMs > 0)).toBe(true);
    expect(facts.teams).toEqual([{ teamId, size: 2, name: 'Facts Pair', memberRobotIds: [r1, r2] }]);
    expect([...facts.takenRobotNames].sort()).toEqual([bpName(1), `${bpName(3)} Mk II`.slice(0, 50)].sort());
  });

  it('reads the current season when none is given', async () => {
    const facts = await loadStableFacts(prisma, fixture.profileId);
    expect(Number.isInteger(facts.seasonNumber)).toBe(true);
    expect(['preparation', 'competitive']).toContain(facts.phase);
  });

  it('refuses a Draft_Automaton, which has no stable', async () => {
    const draft = await prisma.automatonProfile.create({
      data: {
        catalogueKey: `factsdraft${suffix}`.slice(0, 40), plannedStableName: `FDraft${suffix}`.slice(0, 30),
        franchise: 'F', backstory: 'B', strategyKey: 'swarm', strategyVersion: 1,
        strategyParameters: { targets: {} }, eventOrder: [], origin: 'admin',
      },
    });
    try {
      await expect(loadStableFacts(prisma, draft.id, { season: SEASON })).rejects.toThrow(/draft/);
    } finally {
      await prisma.automatonProfile.delete({ where: { id: draft.id } });
    }
  });

  describe('history facts (Economy Goal and Event_Allocation)', () => {
    const CLOSED = 900_000 + Math.floor(Math.random() * 1000);
    let originalTotalCycles: number | null = null;
    const battleIds: number[] = [];
    const eventId = (n: number): string => `facts-history-${suffix}-${n}`;

    beforeAll(async () => {
      const metadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
      originalTotalCycles = metadata?.totalCycles ?? null;
      await prisma.cycleMetadata.upsert({ where: { id: 1 }, update: { totalCycles: CLOSED }, create: { id: 1, totalCycles: CLOSED } });
      const { userId } = fixture;
      const row = (n: number, cycleNumber: number, transactionType: string, amount: number, metadata: object = {}) => ({
        cycleNumber, userId, transactionType, amount, balanceAfter: 0, description: 'history test', metadata, financialEventId: eventId(n),
      });
      await prisma.financialLedger.createMany({
        data: [
          row(1, CLOSED, 'battle_income', 10_000),
          row(2, CLOSED, 'streaming_revenue', 3_000, { studioMultiplier: 1.5 }),
          row(3, CLOSED, 'repair_cost', -9_400, { repairBayDiscountPercent: 6 }),
          row(4, CLOSED, 'operating_costs', -4_000),
          row(5, CLOSED, 'achievement_reward', 50_000),
          row(6, CLOSED - 1, 'battle_income', 20_000),
          row(7, CLOSED - 1, 'repair_cost', -10_000, { repairBayDiscountPercent: 0 }),
          // A cycle with upkeep but no battles (a Preparation_Phase cycle) does not count.
          row(10, CLOSED - 2, 'operating_costs', -9_000),
          // Outside the window: before it, and the cycle still in progress.
          row(8, CLOSED - 5, 'battle_income', 999_999),
          row(9, CLOSED + 1, 'battle_income', 999_999),
        ],
      });
      for (let i = 0; i < 12; i++) {
        battleIds.push((await createTestBattle({
          robot1Id: r1, robot2Id: r3, battleType: 'league_1v1', robot1Credits: 1_500 + i, robot1StreamingRevenue: 0, robot1FinalHP: 10,
        })).id);
      }
      battleIds.push((await createTestBattle({
        robot1Id: r1, robot2Id: r3, battleType: 'grand_melee', leagueType: 'bronze',
        robot1Credits: 7_000, robot1StreamingRevenue: 500, robot1FinalHP: 0, robot1Destroyed: true,
      })).id);
      battleIds.push((await createTestBattle({
        robot1Id: r1, robot2Id: r3, battleType: 'koth', leagueType: 'koth', robot1Credits: 4_000, robot1StreamingRevenue: 1_000, robot1FinalHP: 5,
      })).id);
      // A forfeit is never simulated and is left out.
      battleIds.push((await createTestBattle({ robot1Id: r1, robot2Id: r3, battleType: 'tag_team', robot1Credits: 9_999, robot1Forfeited: true })).id);
    });

    afterAll(async () => {
      await prisma.battle.deleteMany({ where: { id: { in: battleIds } } });
      await prisma.financialLedger.deleteMany({ where: { financialEventId: { startsWith: `facts-history-${suffix}` } } });
      if (originalTotalCycles !== null) {
        await prisma.cycleMetadata.update({ where: { id: 1 }, data: { totalCycles: originalTotalCycles } });
      }
    });

    it('averages recurring income and costs over the closed cycles of the window, normalised for discounts', async () => {
      const facts = await loadStableFacts(prisma, fixture.profileId, { season: SEASON });
      const economy = facts.history?.economy;
      expect(economy).toMatchObject({ cycles: 2, battleIncomePerCycle: 15_000, streamingBasePerCycle: 1_000 });
      expect(economy?.repairBasePerCycle).toBeCloseTo(10_000);
      // ₡2,000 operating costs per cycle minus the facility upkeep held now (Workshop L3, Lab L2, Storage L1, Booking L1 = ₡1,150).
      expect(economy?.otherOperatingPerCycle).toBeCloseTo(850);
    });

    it('keeps each robot’s last 10 battles per event type with income and final HP, and its range band', async () => {
      const facts = await loadStableFacts(prisma, fixture.profileId, { season: SEASON });
      const one = facts.history?.eventResults.find((r) => r.robotId === r1);
      const pistol = await prisma.weapon.findFirstOrThrow({ where: { name: 'Laser Pistol' }, select: { rangeBand: true } });
      expect(one?.rangeBand).toBe(pistol.rangeBand);
      expect(one?.byEvent.league_1v1).toHaveLength(10);
      expect(one?.byEvent.league_1v1?.[0]).toEqual({ income: 1_511, hpPercent: 100 });
      expect(one?.byEvent.grand_melee).toEqual([{ income: 7_500, hpPercent: 0 }]);
      expect(one?.byEvent.koth).toEqual([{ income: 5_000, hpPercent: 50 }]);
      expect(one?.byEvent.tag_team).toBeUndefined();
      expect(facts.history?.eventResults.find((r) => r.robotId === r3)?.rangeBand).toBeNull();
    });

    it('reuses the history it is given instead of reading it again', async () => {
      const history = { economy: null, eventResults: [] };
      const facts = await loadStableFacts(prisma, fixture.profileId, { season: SEASON, history });
      expect(facts.history).toBe(history);
    });
  });

  it('loads the Robot_Blueprints and the weapon catalogue as planner facts', async () => {
    const blueprints = await loadBlueprintFacts(prisma, fixture.profileId);
    expect(blueprints.map((b) => b.slotIndex)).toEqual([1, 2, 3]);
    expect(blueprints[0]).toMatchObject({
      blueprintId: fixture.blueprintIds.get(1), robotName: bpName(1), imageUrl: '/assets/automatons/x/1.webp',
      loadoutType: 'single', stance: 'balanced', yieldThreshold: 10, buildFocus: 'bruiser',
      weaponPath: [{ main: 'Practice Sword' }, { main: 'Laser Pistol' }], refinementPlan: [],
    });
    expect(blueprints[1]).toMatchObject({ stance: 'defensive', yieldThreshold: 20, buildFocus: 'warden', imageUrl: null });

    const catalogue = await loadWeaponCatalogue(prisma);
    const pistol = catalogue.get('Laser Pistol');
    const row = await prisma.weapon.findFirstOrThrow({ where: { name: 'Laser Pistol' } });
    expect(pistol).toMatchObject({ weaponId: row.id, cost: row.cost, handsRequired: 'one', weaponType: row.weaponType, rangeBand: row.rangeBand });
    expect(Object.values(pistol?.bonuses ?? {}).every((value) => value !== 0)).toBe(true);
    expect(catalogue.size).toBeGreaterThan(10);
  });
});
