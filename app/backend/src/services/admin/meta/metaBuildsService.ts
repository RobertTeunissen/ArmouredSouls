/**
 * The robot-build sections of the admin Meta page: where tuning points go,
 * which refinements are bought, and which events robots are entered in.
 *
 * Replaces the separate Tuning, Refinement and Subscriptions admin pages
 * (their endpoints are gone). Every count is scoped to one stable type via
 * `buildUserFilter`. Read-only.
 */
import prisma from '../../../lib/prisma';
import type { Prisma } from '../../../../generated/prisma';
import { ROBOT_ATTRIBUTES } from '../../../shared/utils/robotAttributes';
import { getPoolSize } from '../../tuning-pool/tuningPoolConfig';
import { SUBSCRIBABLE_EVENT_TYPES } from '../../subscription/eventRegistry';
import { ATTRIBUTE_GROUPS, ATTRIBUTE_GROUP_OF } from '../analysis/analysisOptions';
import type {
  MetaBuilds,
  MetaEventEntry,
  MetaRefinements,
  MetaTuning,
  MetaTuningAttribute,
  RefinementKind,
} from './metaBuildsTypes';

const REFINEMENT_KINDS: readonly RefinementKind[] = ['hone', 'augment', 'sharpen', 'forge'];
const TOP_SPENDERS = 5;

/** Two decimals, the precision tuning points are stored with. */
const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Robots per owning stable, for the robots of this stable type. */
async function robotsPerStable(userFilter: Prisma.UserWhereInput): Promise<Map<number, number>> {
  const rows = await prisma.robot.groupBy({ by: ['userId'], where: { user: userFilter }, _count: { _all: true } });
  return new Map(rows.map((row) => [row.userId, row._count._all]));
}

/** Pure aggregation of the Tuning section, exported for tests. */
export function summarizeTuning(
  allocations: ReadonlyArray<Record<string, unknown>>,
  robotsByStable: ReadonlyMap<number, number>,
  tuningBayLevelByStable: ReadonlyMap<number, number>,
): MetaTuning {
  const stats = new Map<string, { points: number; robots: number }>(ROBOT_ATTRIBUTES.map((attribute) => [attribute, { points: 0, robots: 0 }]));
  let robotsTuned = 0;
  let poolUsed = 0;
  for (const allocation of allocations) {
    let robotPoints = 0;
    for (const attribute of ROBOT_ATTRIBUTES) {
      const value = Number(allocation[attribute] ?? 0);
      if (value > 0) {
        const entry = stats.get(attribute)!;
        entry.points += value;
        entry.robots += 1;
        robotPoints += value;
      }
    }
    if (robotPoints > 0) robotsTuned += 1;
    poolUsed += robotPoints;
  }

  let totalRobots = 0;
  let poolTotal = 0;
  for (const [userId, robots] of robotsByStable) {
    totalRobots += robots;
    poolTotal += robots * getPoolSize(tuningBayLevelByStable.get(userId) ?? 0);
  }

  const attributes: MetaTuningAttribute[] = ROBOT_ATTRIBUTES.map((attribute) => ({
    attribute,
    group: ATTRIBUTE_GROUP_OF[attribute],
    points: round2(stats.get(attribute)!.points),
    robots: stats.get(attribute)!.robots,
  })).sort((a, b) => b.points - a.points || b.robots - a.robots || a.attribute.localeCompare(b.attribute));

  const byGroup = ATTRIBUTE_GROUPS.map((group) => ({
    group,
    points: round2(attributes.filter((entry) => entry.group === group).reduce((sum, entry) => sum + entry.points, 0)),
  }));

  return { totalRobots, robotsTuned, poolUsed: round2(poolUsed), poolTotal, byGroup, attributes };
}

async function loadTuning(userFilter: Prisma.UserWhereInput, robotsByStable: Map<number, number>): Promise<MetaTuning> {
  const select = Object.fromEntries(ROBOT_ATTRIBUTES.map((attribute) => [attribute, true])) as Prisma.TuningAllocationSelect;
  const [allocations, bays] = await Promise.all([
    prisma.tuningAllocation.findMany({ where: { robot: { user: userFilter } }, select }),
    prisma.facility.findMany({ where: { facilityType: 'tuning_bay', level: { gt: 0 }, user: userFilter }, select: { userId: true, level: true } }),
  ]);
  return summarizeTuning(
    allocations as unknown as Array<Record<string, unknown>>,
    robotsByStable,
    new Map(bays.map((bay) => [bay.userId, bay.level])),
  );
}

interface RefinementRow {
  tier: string;
  magnitude: number;
  targetAttribute: string | null;
  costPaid: number;
  weaponInventoryId: number;
  userId: number;
  stableName: string | null;
  username: string;
}

/** Pure aggregation of the Refinements section, exported for tests. */
export function summarizeRefinements(rows: ReadonlyArray<RefinementRow>, stables: number): MetaRefinements {
  const kinds = new Map(REFINEMENT_KINDS.map((kind) => [kind, { refinements: 0, stables: new Set<number>(), credits: 0 }]));
  const targeted = new Map<string, { refinements: number; magnitude: number }>();
  const spenders = new Map<number, { stableName: string | null; username: string; credits: number; weapons: Set<number> }>();
  const weapons = new Set<number>();
  let creditsSpent = 0;

  for (const row of rows) {
    weapons.add(row.weaponInventoryId);
    creditsSpent += row.costPaid;
    const kind = kinds.get(row.tier as RefinementKind);
    if (kind) {
      kind.refinements += 1;
      kind.stables.add(row.userId);
      kind.credits += row.costPaid;
    }
    if (row.targetAttribute) {
      const entry = targeted.get(row.targetAttribute) ?? { refinements: 0, magnitude: 0 };
      entry.refinements += 1;
      entry.magnitude += row.magnitude;
      targeted.set(row.targetAttribute, entry);
    }
    const spender = spenders.get(row.userId) ?? { stableName: row.stableName, username: row.username, credits: 0, weapons: new Set<number>() };
    spender.credits += row.costPaid;
    spender.weapons.add(row.weaponInventoryId);
    spenders.set(row.userId, spender);
  }

  return {
    stables,
    stablesRefining: spenders.size,
    refinements: rows.length,
    weaponsRefined: weapons.size,
    creditsSpent,
    perKind: REFINEMENT_KINDS.map((kind) => {
      const entry = kinds.get(kind)!;
      return { kind, refinements: entry.refinements, stables: entry.stables.size, credits: entry.credits };
    }),
    targeted: [...targeted.entries()]
      .map(([attribute, entry]) => ({ attribute, ...entry }))
      .sort((a, b) => b.refinements - a.refinements || b.magnitude - a.magnitude || a.attribute.localeCompare(b.attribute)),
    topSpenders: [...spenders.entries()]
      .map(([userId, entry]) => ({ userId, stableName: entry.stableName, username: entry.username, credits: entry.credits, weapons: entry.weapons.size }))
      .sort((a, b) => b.credits - a.credits || a.userId - b.userId)
      .slice(0, TOP_SPENDERS),
  };
}

async function loadRefinements(userFilter: Prisma.UserWhereInput, stables: number): Promise<MetaRefinements> {
  // Bounded: at most 5 refinements per owned weapon.
  const rows = await prisma.weaponRefinement.findMany({
    where: { weaponInventory: { user: userFilter } },
    select: {
      tier: true,
      magnitude: true,
      targetAttribute: true,
      costPaid: true,
      weaponInventoryId: true,
      weaponInventory: { select: { userId: true, user: { select: { stableName: true, username: true } } } },
    },
  });
  return summarizeRefinements(
    rows.map((row) => ({
      tier: row.tier,
      magnitude: row.magnitude,
      targetAttribute: row.targetAttribute,
      costPaid: row.costPaid,
      weaponInventoryId: row.weaponInventoryId,
      userId: row.weaponInventory.userId,
      stableName: row.weaponInventory.user.stableName,
      username: row.weaponInventory.user.username,
    })),
    stables,
  );
}

/** Pure aggregation of the Event entry section, exported for tests. */
export function summarizeEventEntry(
  perEventCounts: ReadonlyArray<{ eventType: string; robots: number }>,
  entriesPerEnteredRobot: ReadonlyArray<number>,
  totalRobots: number,
): MetaEventEntry {
  const byType = new Map(perEventCounts.map((row) => [row.eventType, row.robots]));
  const maxEvents = SUBSCRIBABLE_EVENT_TYPES.length;
  const histogram = Array.from({ length: maxEvents + 1 }, () => 0);
  let entries = 0;
  for (const count of entriesPerEnteredRobot) {
    histogram[Math.min(count, maxEvents)] += 1;
    entries += count;
  }
  const robotsEntered = entriesPerEnteredRobot.filter((count) => count > 0).length;
  histogram[0] += Math.max(0, totalRobots - entriesPerEnteredRobot.length);

  return {
    totalRobots,
    robotsEntered,
    averageEvents: totalRobots > 0 ? Math.round((entries / totalRobots) * 10) / 10 : 0,
    perEvent: SUBSCRIBABLE_EVENT_TYPES.map((eventType) => ({ eventType, robots: byType.get(eventType) ?? 0 })),
    eventsPerRobot: histogram.map((robots, events) => ({ events, robots })),
  };
}

async function loadEventEntry(userFilter: Prisma.UserWhereInput, totalRobots: number): Promise<MetaEventEntry> {
  const where: Prisma.SubscriptionWhereInput = { robot: { user: userFilter }, eventType: { in: [...SUBSCRIBABLE_EVENT_TYPES] } };
  const [perEvent, perRobot] = await Promise.all([
    prisma.subscription.groupBy({ by: ['eventType'], where, _count: { _all: true } }),
    prisma.subscription.groupBy({ by: ['robotId'], where, _count: { _all: true } }),
  ]);
  return summarizeEventEntry(
    perEvent.map((row) => ({ eventType: row.eventType, robots: row._count._all })),
    perRobot.map((row) => row._count._all),
    totalRobots,
  );
}

export async function getMetaBuilds(userFilter: Prisma.UserWhereInput): Promise<MetaBuilds> {
  const robotsByStable = await robotsPerStable(userFilter);
  const totalRobots = [...robotsByStable.values()].reduce((sum, robots) => sum + robots, 0);
  const [tuning, refinements, eventEntry] = await Promise.all([
    loadTuning(userFilter, robotsByStable),
    loadRefinements(userFilter, robotsByStable.size),
    loadEventEntry(userFilter, totalRobots),
  ]);
  return { tuning, refinements, eventEntry };
}
