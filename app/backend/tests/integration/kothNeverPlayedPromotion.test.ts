/**
 * KotH rebalancing never sees robots that never subscribed.
 *
 * Before the unified standings creation rule every new robot got a Bronze KotH
 * row at creation, so a never-played robot counted towards the Bronze
 * population, the promotion slots, and (KotH promotes with no LP minimum)
 * could itself be promoted. Now a row exists only once the robot subscribes.
 *
 * 30 robots subscribe and score KotH points; 30 never subscribe. After ten
 * cycles of residency, `rebalanceKothLeagues` must see exactly the 30 played
 * robots and promote only robots with points.
 *
 * Whole-mode rebalancing: the suite clears every KotH row before and after.
 */
import prisma from '../../src/lib/prisma';
import { createRobotTransaction } from '../../src/services/robot/robotCreationService';
import {
  getEventDefinition,
  registerSubscribableEvent,
  SUBSCRIBABLE_EVENT_TYPES,
} from '../../src/services/subscription/eventRegistry';
import { subscribeRobot } from '../../src/services/subscription/subscriptionService';
import standingsService from '../../src/services/standings/standingsService';
import { rebalanceKothLeagues } from '../../src/services/league/leagueRebalancingService';

const RUN = `knp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const COHORT = 30;
const ROUNDS = 5;
const KOTH_FIELD = 6;
const RESIDENCY_CYCLES = 10;

const userIds: number[] = [];
const played: number[] = [];
const neverPlayed: number[] = [];

async function clearKoth(): Promise<void> {
  await prisma.standing.deleteMany({ where: { mode: 'koth' } });
}

/** One user per robot, robot bought through the player purchase service. */
async function buyRobot(index: number): Promise<{ userId: number; robotId: number }> {
  const user = await prisma.user.create({
    data: { username: `${RUN}_u${index}`, passwordHash: 'x', currency: 1_000_000 },
  });
  userIds.push(user.id);
  const name = `${RUN}_r${index}`;
  await createRobotTransaction(user.id, name, `${RUN}-key-${index}`);
  const robot = await prisma.robot.findUniqueOrThrow({ where: { name }, select: { id: true } });
  return { userId: user.id, robotId: robot.id };
}

beforeAll(async () => {
  for (const type of SUBSCRIBABLE_EVENT_TYPES) {
    if (!getEventDefinition(type)) registerSubscribableEvent({ type, label: type });
  }
  await clearKoth();

  for (let i = 0; i < COHORT * 2; i++) {
    const { userId, robotId } = await buyRobot(i);
    if (i % 2 === 0) {
      await subscribeRobot(robotId, 'koth', userId);
      played.push(robotId);
    } else {
      neverPlayed.push(robotId);
    }
  }
});

afterAll(async () => {
  const robots = await prisma.robot.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  await clearKoth();
  await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robots.map((r) => r.id) } } });
  await prisma.subscription.deleteMany({ where: { robotId: { in: robots.map((r) => r.id) } } });
  await prisma.robot.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  // The setup file's afterAll disconnects first; the cleanup above reconnects.
  await prisma.$disconnect();
});

describe('KotH rebalancing with never-subscribed robots', () => {
  it('only the subscribed robots are in the KotH Bronze population', async () => {
    expect(await prisma.standing.count({ where: { mode: 'koth', entityId: { in: neverPlayed } } })).toBe(0);
    expect(await prisma.standing.count({ where: { mode: 'koth', tier: 'bronze' } })).toBe(COHORT);
  });

  it('promotes only played robots with points, and never a never-subscribed robot', async () => {
    // Several KotH matches of six; placements rotate so LP differs per robot.
    for (let round = 0; round < ROUNDS; round++) {
      for (const [index, robotId] of played.entries()) {
        const placement = ((index * 5 + round * 2) % KOTH_FIELD) + 1;
        await standingsService.awardKothPoints({
          robotId,
          placement,
          totalParticipants: KOTH_FIELD,
          zoneScore: KOTH_FIELD - placement,
          zoneTime: 10,
        });
      }
    }

    // Mirror of the settlement residency increment (cycleScheduler), scoped to this cohort.
    for (let cycle = 0; cycle < RESIDENCY_CYCLES; cycle++) {
      await prisma.standing.updateMany({
        where: { entityType: 'robot', entityId: { in: [...played, ...neverPlayed] } },
        data: { cyclesInTier: { increment: 1 } },
      });
    }

    const summary = await rebalanceKothLeagues();

    expect(summary.errors).toEqual([]);
    const bronze = summary.tierSummaries.find((s) => s.tier === 'bronze');
    expect(bronze?.robotsInTier).toBe(COHORT);
    expect(summary.totalPromoted).toBeGreaterThan(0);

    // Never-subscribed robots: still no KotH row and no KotH promotion.
    expect(await prisma.standing.count({ where: { mode: 'koth', entityId: { in: neverPlayed } } })).toBe(0);
    const neverPlayedHistory = await prisma.leagueHistory.count({
      where: { entityType: 'robot', entityId: { in: neverPlayed }, mode: 'koth' },
    });
    expect(neverPlayedHistory).toBe(0);

    // Promotions come only from played robots with points.
    const promotions = await prisma.leagueHistory.findMany({
      where: { entityType: 'robot', mode: 'koth', changeType: 'promotion', entityId: { in: played } },
    });
    expect(promotions).toHaveLength(summary.totalPromoted);
    const rows = await prisma.standing.findMany({ where: { mode: 'koth', entityType: 'robot' } });
    expect(rows).toHaveLength(COHORT);
    expect(rows.every((r) => played.includes(r.entityId))).toBe(true);
    const promoted = rows.filter((r) => r.tier !== 'bronze');
    expect(promoted).toHaveLength(summary.totalPromoted);
    for (const row of promoted) expect(row.leaguePoints).toBeGreaterThan(0);
    expect(new Set(promotions.map((p) => p.entityId))).toEqual(new Set(promoted.map((r) => r.entityId)));
  });
});
