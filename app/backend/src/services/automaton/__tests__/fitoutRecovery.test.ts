/**
 * Fit-out recovery: a robot a failed Robot_Chain left unarmed is fitted at the
 * start of the next Automaton_Turn (PR #534).
 *
 * The real planner over fixture facts; the charged/free execution primitives
 * and the facts loader are mocked over one in-memory stable, so each test sees
 * exactly which purchases and equips ran.
 */
import {
  FITOUT_RECOVERY_GOAL_ID,
  isLoadoutReady,
  planFitoutRecovery,
  resumeIncompleteFitouts,
} from '../fitoutRecovery';
import { buyWeapon, equipHand, setLoadout, sellInventoryItem, buyFacilityLevel, type ExecutionContext, type ExecutionCursor } from '../executionSteps';
import { loadStableFacts, type BlueprintFacts, type StableFacts } from '../stableFacts';
import { TURN_TIME_BUDGET_MS } from '../turnBudget';
import logger from '../../../config/logger';
import { armedRobot, blueprint, item, robot, stable, weaponMap } from './helpers/automatonFixtures';

jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../robot/robotQueryService', () => ({ invalidateUserRobotsCache: jest.fn() }));
jest.mock('../stableFacts', () => ({
  ...jest.requireActual('../stableFacts'),
  loadStableFacts: jest.fn(),
}));
jest.mock('../executionSteps', () => ({
  buyWeapon: jest.fn(),
  equipHand: jest.fn(),
  setLoadout: jest.fn(),
  sellInventoryItem: jest.fn(),
  buyFacilityLevel: jest.fn(),
}));

const mockBuy = jest.mocked(buyWeapon);
const mockEquip = jest.mocked(equipHand);
const mockSetLoadout = jest.mocked(setLoadout);
const mockSell = jest.mocked(sellInventoryItem);
const mockFacility = jest.mocked(buyFacilityLevel);
const mockLoad = jest.mocked(loadStableFacts);
const mockLogger = jest.mocked(logger);

const BLUEPRINTS: BlueprintFacts[] = [
  blueprint(1),
  blueprint(2, { loadoutType: 'weapon_shield', weaponPath: [{ main: 'Practice Blade', offhand: 'Aegis Bulwark' }] }),
];

/** The in-memory stable the mocked primitives mutate and the mocked loader returns. */
let db: StableFacts;
let nextInventoryId: number;

function ctx(blueprints: BlueprintFacts[] = BLUEPRINTS): ExecutionContext {
  return {
    identity: {
      profileId: 1, userId: 1, catalogueKey: 'test-stable', strategyKey: 'fixture', strategyVersion: 1,
      seasonNumber: 1, trigger: 'settlement', slot: 1, attempt: 1,
    },
    blueprints,
    weapons: weaponMap(),
    teamNames: { twoVsTwo: [], threeVsThree: [] },
    eventOrder: [],
  };
}

function cursor(): ExecutionCursor {
  return { chargedSteps: 0, creditsSpent: 0, creditsReceived: 0, steps: [] };
}

const budget = { startedAtMs: 0, now: () => 0 };

function snapshot(): StableFacts {
  return structuredClone(db);
}

beforeEach(() => {
  jest.clearAllMocks();
  nextInventoryId = 500;
  mockLoad.mockImplementation(async () => snapshot());
  mockSetLoadout.mockImplementation(async (_ctx, robotId, loadoutType) => {
    const r = db.robots.find((x) => x.robotId === robotId);
    if (r) r.loadoutType = loadoutType;
  });
  mockBuy.mockImplementation(async (_ctx, cur, _goal, weaponName) => {
    const id = nextInventoryId++;
    db.inventory.push(item(id, weaponName));
    cur.chargedSteps++;
    return id;
  });
  mockEquip.mockImplementation(async (_ctx, robotId, hand, inventoryId) => {
    const r = db.robots.find((x) => x.robotId === robotId);
    if (!r) return;
    if (hand === 'main') r.mainInventoryId = inventoryId;
    else r.offhandInventoryId = inventoryId;
  });
  mockSell.mockImplementation(async (_ctx, cur, _goal, inventoryId) => {
    db.inventory = db.inventory.filter((i) => i.inventoryId !== inventoryId);
    cur.chargedSteps++;
  });
  mockFacility.mockImplementation(async (_ctx, cur, _goal, facilityType, toLevel) => {
    db.facilities[facilityType] = toLevel;
    cur.chargedSteps++;
  });
});

describe('isLoadoutReady (shared loadout readiness rule)', () => {
  it('follows evaluateLoadoutReadiness for each loadout', () => {
    expect(isLoadoutReady(robot(1))).toBe(false);
    expect(isLoadoutReady(armedRobot(1, 10))).toBe(true);
    expect(isLoadoutReady(robot(2, { loadoutType: 'weapon_shield', mainInventoryId: 10 }))).toBe(false);
    expect(isLoadoutReady(robot(2, { loadoutType: 'weapon_shield', mainInventoryId: 10, offhandInventoryId: 11 }))).toBe(true);
  });
});

describe('resumeIncompleteFitouts', () => {
  it('fits an unarmed robot from inventory without a purchase', async () => {
    db = stable({ robots: [robot(1, { stageIndex: -1 })], inventory: [item(10, 'Practice Blade')] });

    const result = await resumeIncompleteFitouts(snapshot(), ctx(), cursor(), budget);

    expect(mockBuy).not.toHaveBeenCalled();
    expect(mockEquip).toHaveBeenCalledWith(expect.anything(), 1001, 'main', 10);
    expect(result.resumed).toEqual([1001]);
    expect(result.unresolved).toEqual([]);
    expect(result.facts.robots[0].mainInventoryId).toBe(10);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('robot 1001'));
  });

  it('buys only the missing weapon, after setting the blueprint loadout', async () => {
    // Weapon-and-shield blueprint, created as `single`; the blade is in storage, the shield is not.
    db = stable({ robots: [robot(2, { stageIndex: -1 })], inventory: [item(10, 'Practice Blade')] });
    const cur = cursor();

    const result = await resumeIncompleteFitouts(snapshot(), ctx(), cur, budget);

    expect(mockSetLoadout).toHaveBeenCalledWith(expect.anything(), 1002, 'weapon_shield');
    expect(mockBuy).toHaveBeenCalledTimes(1);
    expect(mockBuy).toHaveBeenCalledWith(expect.anything(), cur, FITOUT_RECOVERY_GOAL_ID, 'Aegis Bulwark');
    expect(mockEquip).toHaveBeenCalledWith(expect.anything(), 1002, 'main', 10);
    expect(mockEquip).toHaveBeenCalledWith(expect.anything(), 1002, 'offhand', 500);
    expect(result.resumed).toEqual([1002]);
  });

  it('keeps a hand that already holds a weapon and fills only the empty one', async () => {
    db = stable({
      robots: [robot(2, { loadoutType: 'weapon_shield', mainInventoryId: 10, stageIndex: -1 })],
      inventory: [item(10, 'Practice Blade')],
    });

    await resumeIncompleteFitouts(snapshot(), ctx(), cursor(), budget);

    expect(mockBuy).toHaveBeenCalledTimes(1);
    expect(mockBuy).toHaveBeenCalledWith(expect.anything(), expect.anything(), FITOUT_RECOVERY_GOAL_ID, 'Aegis Bulwark');
    expect(mockEquip).toHaveBeenCalledTimes(1);
    expect(mockEquip).toHaveBeenCalledWith(expect.anything(), 1002, 'offhand', 500);
  });

  it('leaves an already-ready stable untouched', async () => {
    db = stable({ robots: [armedRobot(1, 10)], inventory: [item(10, 'Practice Blade'), item(11, 'Practice Blade')] });
    const facts = snapshot();

    const result = await resumeIncompleteFitouts(facts, ctx(), cursor(), budget);

    expect(result).toEqual({ facts, resumed: [], unresolved: [] });
    for (const mock of [mockBuy, mockEquip, mockSetLoadout, mockSell, mockFacility, mockLoad]) {
      expect(mock).not.toHaveBeenCalled();
    }
  });

  it('a repeated equip failure does not loop or buy the weapon twice', async () => {
    db = stable({ robots: [robot(1, { stageIndex: -1 })] });
    mockEquip.mockRejectedValue(new Error('equip failed'));

    // Turn 1: the blade is bought, the equip fails; logged, not retried in the turn.
    const first = await resumeIncompleteFitouts(snapshot(), ctx(), cursor(), budget);
    expect(mockBuy).toHaveBeenCalledTimes(1);
    expect(mockEquip).toHaveBeenCalledTimes(1);
    expect(first.unresolved).toEqual([1001]);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('fit-out recovery of robot 1001 (slot 1) failed'));

    // Turn 2: the bought blade is in storage, so it is equipped from there; no second purchase.
    const second = await resumeIncompleteFitouts(snapshot(), ctx(), cursor(), budget);
    expect(mockBuy).toHaveBeenCalledTimes(1);
    expect(mockEquip).toHaveBeenCalledTimes(2);
    expect(mockEquip).toHaveBeenLastCalledWith(expect.anything(), 1001, 'main', 500);
    expect(second.unresolved).toEqual([1001]);
  });

  it('does not buy when the balance cannot pay for the missing weapon', async () => {
    db = stable({ balance: 10, robots: [robot(1, { stageIndex: -1 })] });

    const result = await resumeIncompleteFitouts(snapshot(), ctx(), cursor(), budget);

    expect(mockBuy).not.toHaveBeenCalled();
    expect(result.unresolved).toEqual([1001]);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('robot 1001 (slot 1) is not battle-ready; fit-out needs'));
  });

  it('logs an error and carries on when a robot has no blueprint', async () => {
    db = stable({ robots: [robot(5, { blueprintId: 999, stageIndex: -1 }), robot(1, { stageIndex: -1 })], inventory: [item(10, 'Practice Blade')] });

    const result = await resumeIncompleteFitouts(snapshot(), ctx(), cursor(), budget);

    expect(result.unresolved).toEqual([1005]);
    expect(result.resumed).toEqual([1001]);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('robot 1005 (slot 5) is not battle-ready and its fit-out cannot resume: no_blueprint'));
  });
});

describe('resumeIncompleteFitouts — storage room and Turn_Budget', () => {
  /** Storage Facility L0 holds 5 weapons. */
  const fullOf = (weaponName: string, firstId: number) =>
    Array.from({ length: 5 }, (_, i) => item(firstId + i, weaponName));

  it('sells an unequipped item off every Weapon_Path to make room, then buys and equips', async () => {
    db = stable({ robots: [robot(1, { stageIndex: -1 })], inventory: fullOf('Railgun', 20) });
    const cur = cursor();

    const result = await resumeIncompleteFitouts(snapshot(), ctx(), cur, budget);

    expect(mockSell).toHaveBeenCalledTimes(1);
    expect(mockSell).toHaveBeenCalledWith(expect.anything(), cur, FITOUT_RECOVERY_GOAL_ID, 20);
    expect(mockBuy).toHaveBeenCalledWith(expect.anything(), cur, FITOUT_RECOVERY_GOAL_ID, 'Practice Blade');
    expect(mockEquip).toHaveBeenCalledWith(expect.anything(), 1001, 'main', 500);
    expect(mockSell.mock.invocationCallOrder[0]).toBeLessThan(mockBuy.mock.invocationCallOrder[0]);
    expect(mockBuy.mock.invocationCallOrder[0]).toBeLessThan(mockEquip.mock.invocationCallOrder[0]);
    expect(mockFacility).not.toHaveBeenCalled();
    expect(result.resumed).toEqual([1001]);
  });

  it('buys a Storage Facility level when every stored item is equipped', async () => {
    db = stable({
      robots: [3, 4, 5, 6, 7].map((slot, i) => armedRobot(slot, 30 + i)).concat(robot(1, { stageIndex: -1 })),
      inventory: fullOf('Practice Blade', 30),
    });
    const cur = cursor();

    const result = await resumeIncompleteFitouts(snapshot(), ctx(), cur, budget);

    expect(mockSell).not.toHaveBeenCalled();
    expect(mockFacility).toHaveBeenCalledTimes(1);
    expect(mockFacility).toHaveBeenCalledWith(expect.anything(), cur, FITOUT_RECOVERY_GOAL_ID, 'storage_facility', 1);
    expect(mockFacility.mock.invocationCallOrder[0]).toBeLessThan(mockBuy.mock.invocationCallOrder[0]);
    expect(mockBuy).toHaveBeenCalledWith(expect.anything(), cur, FITOUT_RECOVERY_GOAL_ID, 'Practice Blade');
    expect(mockEquip).toHaveBeenCalledWith(expect.anything(), 1001, 'main', 500);
    expect(result.resumed).toEqual([1001]);
  });

  it('never sells a weapon another unready robot will equip, so it is not bought again', async () => {
    // Full storage: one blade per unready robot and three Laser Pistols, all on a
    // Weapon_Path (blueprint 3) and of equal resale value, so the oldest unreserved
    // item is the one sold. Robot 1002 is resumed first and needs a shield bought.
    const blueprints = [...BLUEPRINTS, blueprint(3, { weaponPath: [{ main: 'Laser Pistol' }] })];
    db = stable({
      robots: [robot(2, { stageIndex: -1 }), robot(1, { stageIndex: -1 })],
      inventory: [item(10, 'Practice Blade'), item(11, 'Practice Blade'), ...fullOf('Laser Pistol', 12).slice(0, 3)],
    });

    const result = await resumeIncompleteFitouts(snapshot(), ctx(blueprints), cursor(), budget);

    // The sale for 1002's shield takes a Laser Pistol, not blade 11 that 1001 reuses.
    expect(mockSell).toHaveBeenCalledTimes(1);
    expect(mockSell).toHaveBeenCalledWith(expect.anything(), expect.anything(), FITOUT_RECOVERY_GOAL_ID, 12);
    expect(mockSell).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), 11);
    // Only the shield is bought; 1001's blade is not bought again.
    expect(mockBuy).toHaveBeenCalledTimes(1);
    expect(mockBuy).toHaveBeenCalledWith(expect.anything(), expect.anything(), FITOUT_RECOVERY_GOAL_ID, 'Aegis Bulwark');
    expect(mockEquip).toHaveBeenCalledWith(expect.anything(), 1002, 'main', 10);
    expect(mockEquip).toHaveBeenCalledWith(expect.anything(), 1002, 'offhand', 500);
    expect(mockEquip).toHaveBeenCalledWith(expect.anything(), 1001, 'main', 11);
    expect(result.resumed).toEqual([1002, 1001]);
  });

  it('skips cleanly when the Turn_Budget is spent, charges nothing, and resumes next turn', async () => {
    db = stable({ robots: [robot(1, { stageIndex: -1 })] });
    const spent = cursor();

    // Turn 1: the turn's time budget is used up before recovery starts.
    const first = await resumeIncompleteFitouts(snapshot(), ctx(), spent, { startedAtMs: 0, now: () => TURN_TIME_BUDGET_MS });

    expect(first.unresolved).toEqual([1001]);
    expect(first.resumed).toEqual([]);
    for (const mock of [mockBuy, mockEquip, mockSetLoadout, mockSell, mockFacility, mockLoad]) {
      expect(mock).not.toHaveBeenCalled();
    }
    expect(spent).toEqual(cursor());
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('turn budget spent before the fit-out recovery of robot 1001; next turn resumes it'));

    // Turn 2: a fresh budget; the fit-out runs.
    const second = await resumeIncompleteFitouts(snapshot(), ctx(), cursor(), budget);

    expect(mockBuy).toHaveBeenCalledTimes(1);
    expect(mockEquip).toHaveBeenCalledWith(expect.anything(), 1001, 'main', 500);
    expect(second.resumed).toEqual([1001]);
  });
});

describe('planFitoutRecovery', () => {
  it('matches the off hand to the stage of the main weapon the robot holds', () => {
    const blueprints = [blueprint(2, {
      loadoutType: 'weapon_shield',
      weaponPath: [{ main: 'Practice Blade', offhand: 'Aegis Bulwark' }, { main: 'Volt Sabre', offhand: 'Aegis Bulwark' }],
    })];
    const facts = stable({
      robots: [robot(2, { loadoutType: 'weapon_shield', mainInventoryId: 10, stageIndex: -1 })],
      inventory: [item(10, 'Volt Sabre'), item(11, 'Aegis Bulwark')],
    });

    const decision = planFitoutRecovery(facts, facts.robots[0], blueprints, { weapons: weaponMap() });

    expect(decision).toEqual({
      kind: 'plan',
      plan: expect.objectContaining({
        purchases: [],
        equip: [{ hand: 'offhand', weaponName: 'Aegis Bulwark', source: { kind: 'inventory', inventoryId: 11 } }],
        cost: 0,
      }),
    });
  });
});
