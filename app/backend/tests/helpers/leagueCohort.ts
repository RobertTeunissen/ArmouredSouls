/**
 * 1v1 league fixtures — a cohort of robots that `runMatchmaking` will actually pair.
 *
 * A robot needs four things to be matched, and only the first is on the Robot row:
 *
 *  1. Battle readiness: a weapon equipped in `mainWeaponId` and HP at or above its
 *     `yieldThreshold`. This is what `checkSchedulingReadiness` inspects.
 *  2. A `standings` row for mode `league_1v1`, which is where tier and league instance live
 *     since Spec #40 — matchmaking scopes its candidate pool from it.
 *  3. An active `league_1v1` subscription, since Spec #35 gates every event on the
 *     Booking Office.
 *  4. A distinct owner, because matchmaking excludes same-stable pairings.
 *
 * This exists because `tests/integration.test.ts` had no fixture at all: it queried
 * `prisma.robot.findMany({ where: { currentHP: { gte: 75 } } })` and asserted the result was
 * non-empty, so it only passed when some other suite or a seed happened to leave suitable
 * robots in the shared database. Its `beforeAll` merely `console.warn`ed when fewer than 10
 * robots existed. That is the purest form of the cross-suite coupling Spec #51 set out to
 * remove: the suite was not testing a daily cycle, it was testing whether its neighbours had
 * run first.
 *
 * @module tests/helpers/leagueCohort
 */

import prisma from '../../src/lib/prisma';
import { enterRobotStandings } from './standings';
import { subscribeRobots } from './subscriptions';

export interface LeagueCohort {
  userIds: number[];
  robotIds: number[];
}

export interface LeagueCohortOptions {
  tier?: string;
  leagueInstanceId?: string;
  /** Starting ELO for the first robot; each subsequent robot gets +25 for a stable ordering. */
  baseElo?: number;
}

/**
 * Create `size` stables, each owning one battle-ready robot entered in the 1v1 league.
 *
 * `size` should be even for every robot to get a real opponent; an odd size leaves one robot
 * to receive a Bye_Event, which is a legitimate thing to test deliberately.
 */
export async function createLeagueCohort(
  size: number,
  options: LeagueCohortOptions = {},
): Promise<LeagueCohort> {
  const tier = options.tier ?? 'bronze';
  const leagueInstanceId = options.leagueInstanceId ?? `${tier}_1`;
  const baseElo = options.baseElo ?? 1200;

  const weapon = await prisma.weapon.findFirst();
  if (!weapon) {
    throw new Error('No weapons found. Run the seed first.');
  }

  const userIds: number[] = [];
  const robotIds: number[] = [];

  for (let i = 0; i < size; i++) {
    const unique = `${Date.now().toString(36)}_${i}_${Math.random().toString(36).substring(7)}`;
    const user = await prisma.user.create({
      data: {
        username: `league_cohort_${unique}`,
        passwordHash: 'test_hash',
        currency: 1_000_000,
      },
    });
    userIds.push(user.id);

    const weaponInv = await prisma.weaponInventory.create({
      data: { userId: user.id, weaponId: weapon.id, pricePaid: 0 },
    });

    const robot = await prisma.robot.create({
      data: {
        userId: user.id,
        // `robots.name` is globally unique and VarChar(50).
        name: `LC_${unique}`.substring(0, 50),
        elo: baseElo + i * 25,
        currentHP: 100,
        maxHP: 100,
        currentShield: 20,
        maxShield: 20,
        yieldThreshold: 20,
        loadoutType: 'single',
        mainWeaponId: weaponInv.id,
      },
    });
    robotIds.push(robot.id);
  }

  await enterRobotStandings(robotIds, 'league_1v1', { tier, leagueInstanceId });
  await subscribeRobots(robotIds, 'league_1v1');

  return { userIds, robotIds };
}

/**
 * Delete a cohort and everything that references it, in foreign-key order.
 *
 * `standings` and `subscriptions` come first: standings is polymorphic and so is never
 * cascaded, and clearing both up front means the order of the remaining deletes cannot
 * matter.
 */
export async function deleteLeagueCohort(cohort: LeagueCohort): Promise<void> {
  const { userIds, robotIds } = cohort;
  if (robotIds.length > 0) {
    await prisma.standing.deleteMany({
      where: { entityType: 'robot', entityId: { in: robotIds } },
    });
    await prisma.subscription.deleteMany({ where: { robotId: { in: robotIds } } });
    await prisma.scheduledMatch.deleteMany({
      where: { participants: { some: { participantId: { in: robotIds } } } },
    });
    await prisma.battleParticipant.deleteMany({ where: { robotId: { in: robotIds } } });
    await prisma.battle.deleteMany({
      where: { participants: { some: { robotId: { in: robotIds } } } },
    });
    await prisma.robot.deleteMany({ where: { id: { in: robotIds } } });
  }
  if (userIds.length > 0) {
    await prisma.weaponInventory.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}
