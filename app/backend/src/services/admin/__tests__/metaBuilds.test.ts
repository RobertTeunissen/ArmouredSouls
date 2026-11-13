/**
 * Unit tests of the Meta page's build sections (`GET /api/admin/meta/builds`):
 * the pure Tuning / Refinements / Event entry aggregations and the scoping of
 * every query to the selected stable type.
 */
const mockPrisma = {
  robot: { groupBy: jest.fn() },
  tuningAllocation: { findMany: jest.fn() },
  facility: { findMany: jest.fn() },
  weaponRefinement: { findMany: jest.fn() },
  subscription: { groupBy: jest.fn() },
};
jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));

import { getMetaBuilds } from '../meta';
import { summarizeEventEntry, summarizeRefinements, summarizeTuning } from '../meta/metaBuildsService';
import { SUBSCRIBABLE_EVENT_TYPES } from '../../subscription/eventRegistry';

describe('summarizeTuning', () => {
  it('sums points per attribute and group, counts tuned robots, and the pool from each stable’s Tuning Bay', () => {
    const allocations = [
      { combatPower: '6.50', attackSpeed: 3.5, shieldCapacity: 0 },
      { combatPower: 2, syncProtocols: 1 },
      { combatPower: 0 }, // an allocation row with no points is not "tuned"
    ];
    // Stable 1: 2 robots, Tuning Bay L2 (30 each); stable 2: 1 robot, no bay (10).
    const result = summarizeTuning(allocations, new Map([[1, 2], [2, 1]]), new Map([[1, 2]]));

    expect(result.totalRobots).toBe(3);
    expect(result.robotsTuned).toBe(2);
    expect(result.poolUsed).toBe(13);
    expect(result.poolTotal).toBe(70);
    expect(result.attributes).toHaveLength(23);
    expect(result.attributes.slice(0, 3)).toEqual([
      { attribute: 'combatPower', group: 'combat', points: 8.5, robots: 2 },
      { attribute: 'attackSpeed', group: 'combat', points: 3.5, robots: 1 },
      { attribute: 'syncProtocols', group: 'team', points: 1, robots: 1 },
    ]);
    expect(result.byGroup).toEqual([
      { group: 'combat', points: 12 },
      { group: 'defence', points: 0 },
      { group: 'chassis', points: 0 },
      { group: 'ai', points: 0 },
      { group: 'team', points: 1 },
    ]);
  });

  it('is empty-safe', () => {
    const result = summarizeTuning([], new Map(), new Map());
    expect(result).toMatchObject({ totalRobots: 0, robotsTuned: 0, poolUsed: 0, poolTotal: 0 });
    expect(result.byGroup.every((group) => group.points === 0)).toBe(true);
  });
});

describe('summarizeRefinements', () => {
  const row = (over: Partial<Parameters<typeof summarizeRefinements>[0][number]>) => ({
    tier: 'hone', magnitude: 1, targetAttribute: null, costPaid: 100, weaponInventoryId: 1,
    userId: 1, stableName: 'Alpha', username: 'alpha', ...over,
  });

  it('counts per kind, targeted attributes and top spenders', () => {
    const rows = [
      row({ tier: 'hone', magnitude: 3, targetAttribute: 'attackSpeed', costPaid: 500, weaponInventoryId: 1, userId: 1 }),
      row({ tier: 'hone', magnitude: 2, targetAttribute: 'attackSpeed', costPaid: 400, weaponInventoryId: 2, userId: 2, stableName: null, username: 'bravo' }),
      row({ tier: 'augment', magnitude: 5, targetAttribute: 'combatPower', costPaid: 900, weaponInventoryId: 1, userId: 1 }),
      row({ tier: 'forge', costPaid: 2000, weaponInventoryId: 3, userId: 2, stableName: null, username: 'bravo' }),
    ];
    const result = summarizeRefinements(rows, 5);

    expect(result).toMatchObject({ stables: 5, stablesRefining: 2, refinements: 4, weaponsRefined: 3, creditsSpent: 3800 });
    expect(result.perKind).toEqual([
      { kind: 'hone', refinements: 2, stables: 2, credits: 900 },
      { kind: 'augment', refinements: 1, stables: 1, credits: 900 },
      { kind: 'sharpen', refinements: 0, stables: 0, credits: 0 },
      { kind: 'forge', refinements: 1, stables: 1, credits: 2000 },
    ]);
    expect(result.targeted).toEqual([
      { attribute: 'attackSpeed', refinements: 2, magnitude: 5 },
      { attribute: 'combatPower', refinements: 1, magnitude: 5 },
    ]);
    expect(result.topSpenders).toEqual([
      { userId: 2, stableName: null, username: 'bravo', credits: 2400, weapons: 2 },
      { userId: 1, stableName: 'Alpha', username: 'alpha', credits: 1400, weapons: 1 },
    ]);
  });

  it('keeps the top five spenders', () => {
    const rows = Array.from({ length: 7 }, (_, index) => row({ userId: index + 1, weaponInventoryId: index + 1, costPaid: (index + 1) * 10 }));
    expect(summarizeRefinements(rows, 7).topSpenders.map((spender) => spender.userId)).toEqual([7, 6, 5, 4, 3]);
  });
});

describe('summarizeEventEntry', () => {
  it('lists every event in registry order and builds the events-per-robot histogram, including robots in none', () => {
    const result = summarizeEventEntry(
      [{ eventType: 'koth', robots: 2 }, { eventType: 'league_1v1', robots: 3 }],
      [2, 1, 2],
      5,
    );

    expect(result.perEvent.map((event) => event.eventType)).toEqual([...SUBSCRIBABLE_EVENT_TYPES]);
    expect(result.perEvent.find((event) => event.eventType === 'league_1v1')?.robots).toBe(3);
    expect(result.perEvent.find((event) => event.eventType === 'grand_melee')?.robots).toBe(0);
    expect(result.robotsEntered).toBe(3);
    expect(result.averageEvents).toBe(1);
    expect(result.eventsPerRobot).toHaveLength(SUBSCRIBABLE_EVENT_TYPES.length + 1);
    expect(result.eventsPerRobot.slice(0, 3)).toEqual([{ events: 0, robots: 2 }, { events: 1, robots: 1 }, { events: 2, robots: 2 }]);
    expect(result.eventsPerRobot.reduce((sum, bucket) => sum + bucket.robots, 0)).toBe(5);
  });

  it('is zero without robots', () => {
    expect(summarizeEventEntry([], [], 0)).toMatchObject({ totalRobots: 0, robotsEntered: 0, averageEvents: 0 });
  });
});

describe('getMetaBuilds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.robot.groupBy.mockResolvedValue([{ userId: 1, _count: { _all: 2 } }]);
    mockPrisma.tuningAllocation.findMany.mockResolvedValue([{ combatPower: 4 }]);
    mockPrisma.facility.findMany.mockResolvedValue([{ userId: 1, level: 1 }]);
    mockPrisma.weaponRefinement.findMany.mockResolvedValue([]);
    mockPrisma.subscription.groupBy.mockImplementation(({ by }: { by: string[] }) =>
      Promise.resolve(by[0] === 'eventType' ? [{ eventType: 'koth', _count: { _all: 1 } }] : [{ robotId: 5, _count: { _all: 1 } }]),
    );
  });

  it('scopes every query to the stable type and combines the three sections', async () => {
    const filter = { stableType: 'automaton' as const };
    const result = await getMetaBuilds(filter);

    expect(mockPrisma.robot.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { user: filter } }));
    expect(mockPrisma.tuningAllocation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { robot: { user: filter } } }));
    expect(mockPrisma.facility.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ facilityType: 'tuning_bay', user: filter }) }));
    expect(mockPrisma.weaponRefinement.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { weaponInventory: { user: filter } } }));
    expect(mockPrisma.subscription.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ robot: { user: filter } }) }));

    expect(result.tuning).toMatchObject({ totalRobots: 2, robotsTuned: 1, poolUsed: 4, poolTotal: 40 });
    expect(result.refinements).toMatchObject({ stables: 1, refinements: 0 });
    expect(result.eventEntry).toMatchObject({ totalRobots: 2, robotsEntered: 1, averageEvents: 0.5 });
  });
});
