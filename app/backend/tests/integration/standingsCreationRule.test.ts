/**
 * The unified standings creation rule against the real database.
 *
 * A standings row is created the first time its entity becomes matchable in a
 * standing-backed mode (`services/standings/standingPlacement`):
 * - robot modes (`league_1v1`, `koth`, `grand_melee`) when the robot first holds
 *   the subscription;
 * - team modes (`league_2v2`, `tag_team`, `league_3v3`) when the team is complete
 *   and every member holds that mode's subscription.
 * Never at robot or team creation; kept on unsubscribe and swap; deleted on
 * disband and account reset. New rows start in Bronze, 0 LP, in the least-full
 * Bronze instance.
 *
 * Cases 10d2 and 10e2 park a subscription on a lock held by a blocker
 * transaction to force the disband/reset interleavings that would orphan a
 * team row or deadlock without the team and robot locks.
 *
 * Every write goes through the real services. Cases 2 and 10c fill a mode's
 * Bronze instances to exact sizes, so they clear that mode's Bronze rows before
 * and after (the whole-mode isolation the rebalancing suites use).
 */
import prisma from '../../src/lib/prisma';
import type { Standing, StandingsMode } from '../../generated/prisma';
import { createRobotTransaction } from '../../src/services/robot/robotCreationService';
import {
  getEventDefinition,
  registerSubscribableEvent,
  SUBSCRIBABLE_EVENT_TYPES,
} from '../../src/services/subscription/eventRegistry';
import {
  setSubscriptionsForRobot,
  subscribeRobot,
  unsubscribeRobot,
} from '../../src/services/subscription/subscriptionService';
import { disbandTeam, registerTeam, swapTeamMember } from '../../src/services/team-battle/teamBattleService';
import { performAccountReset } from '../../src/services/common/resetService';
import { runFreeUpkeep } from '../../src/services/automaton/upkeep/freeUpkeep';
import { loadBlueprintFacts, loadStableFacts } from '../../src/services/automaton/stableFacts';
import { generateBattleReadyUsers } from '../../src/utils/userGeneration';
import { runMatchmakingForTier } from '../../src/services/analytics/matchmakingService';
import {
  ROBOT_TEAM_MEMBERSHIP_LOCK_NAMESPACE,
  TEAM_STANDING_LOCK_NAMESPACE,
  teamModesForSize,
  type TeamSize,
} from '../../src/services/standings/standingPlacement';
import { leagueInstanceLockKey } from '../../src/services/league/leagueInstancePlacement';
import { getCurrentCycleNumber } from '../../src/services/battle/baseOrchestrator';
import type { EventOrder } from '../../src/types/automaton';
import { enterRobotStandings } from '../helpers/standings';
import { createAutomatonStable, deleteAutomatonStables } from '../helpers/automatonStable';

const RUN = `scr${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const ROBOT_MODES = ['league_1v1', 'koth', 'grand_melee'] as const;

/** Every stable this suite created (players, seed holders, generated users). */
const userIds: number[] = [];
const automatonUserIds: number[] = [];
let counter = 0;
const next = (): number => ++counter;

// ── Fixtures ─────────────────────────────────────────────────────────

/** A player stable that can buy up to ten robots. */
async function createStable(): Promise<number> {
  const user = await prisma.user.create({
    data: { username: `${RUN}_u${next()}`, passwordHash: 'x', currency: 50_000_000 },
  });
  userIds.push(user.id);
  await prisma.facility.create({ data: { userId: user.id, facilityType: 'roster_expansion', level: 9 } });
  return user.id;
}

/** Buy a robot through the player purchase service. */
async function buyRobot(userId: number): Promise<number> {
  const n = next();
  const name = `${RUN}_r${n}`;
  await createRobotTransaction(userId, name, `${RUN}-key-${n}`);
  const robot = await prisma.robot.findUniqueOrThrow({ where: { name }, select: { id: true } });
  return robot.id;
}

async function buyRobots(userId: number, count: number): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) ids.push(await buyRobot(userId));
  return ids;
}

/** Cheap robots that only occupy Bronze instances (case 2 / 10c seeds). */
async function createSeedRobots(count: number): Promise<number[]> {
  const user = await prisma.user.create({ data: { username: `${RUN}_seed${next()}`, passwordHash: 'x' } });
  userIds.push(user.id);
  const prefix = `${RUN}_s${next()}_`;
  await prisma.robot.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      userId: user.id, name: `${prefix}${i}`, currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2,
    })),
  });
  const robots = await prisma.robot.findMany({ where: { userId: user.id }, select: { id: true }, orderBy: { id: 'asc' } });
  return robots.map((r) => r.id);
}

async function rowsOf(entityType: 'robot' | 'team', entityId: number): Promise<Standing[]> {
  return prisma.standing.findMany({ where: { entityType, entityId }, orderBy: { mode: 'asc' } });
}

async function modesOf(entityType: 'robot' | 'team', entityId: number): Promise<string[]> {
  return (await rowsOf(entityType, entityId)).map((s) => s.mode).sort();
}

async function clearBronze(mode: StandingsMode): Promise<void> {
  await prisma.standing.deleteMany({ where: { mode, tier: 'bronze' } });
}

async function bronzeInstanceCounts(mode: StandingsMode): Promise<Record<string, number>> {
  const groups = await prisma.standing.groupBy({
    by: ['leagueInstanceId'],
    where: { mode, tier: 'bronze' },
    _count: { id: true },
  });
  return Object.fromEntries(groups.map((g) => [g.leagueInstanceId, g._count.id]));
}

function expectFreshBronze(row: Standing): void {
  expect(row).toMatchObject({
    tier: 'bronze',
    leaguePoints: 0,
    cyclesInTier: 0,
    wins: 0,
    losses: 0,
    draws: 0,
  });
  expect(row.leagueInstanceId).toMatch(/^bronze_\d+$/);
}

/** Delete standings first (polymorphic, no FK), then everything the stables own. */
async function deleteStables(ids: readonly number[]): Promise<void> {
  if (ids.length === 0) return;
  const robots = await prisma.robot.findMany({ where: { userId: { in: [...ids] } }, select: { id: true } });
  const robotIds = robots.map((r) => r.id);
  const teams = await prisma.teamBattle.findMany({ where: { stableId: { in: [...ids] } }, select: { id: true } });
  const teamIds = teams.map((t) => t.id);
  await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robotIds } } });
  await prisma.standing.deleteMany({ where: { entityType: 'team', entityId: { in: teamIds } } });
  await prisma.scheduledMatch.deleteMany({
    where: {
      OR: [
        { participants: { some: { participantType: 'robot', participantId: { in: robotIds } } } },
        { participants: { some: { participantType: 'team', participantId: { in: teamIds } } } },
      ],
    },
  });
  await prisma.teamBattle.deleteMany({ where: { id: { in: teamIds } } });
  await prisma.subscription.deleteMany({ where: { robotId: { in: robotIds } } });
  await prisma.robot.deleteMany({ where: { id: { in: robotIds } } });
  await prisma.weaponInventory.deleteMany({ where: { userId: { in: [...ids] } } });
  await prisma.facility.deleteMany({ where: { userId: { in: [...ids] } } });
  await prisma.user.deleteMany({ where: { id: { in: [...ids] } } });
}

beforeAll(() => {
  for (const type of SUBSCRIBABLE_EVENT_TYPES) {
    if (!getEventDefinition(type)) registerSubscribableEvent({ type, label: type });
  }
});

afterAll(async () => {
  await deleteStables(userIds);
  await deleteAutomatonStables(automatonUserIds);
  // The setup file's afterAll disconnects first; the cleanup above reconnects.
  await prisma.$disconnect();
});

// ── Cases 1-4: robot modes ───────────────────────────────────────────

describe('case 1: robot creation', () => {
  it('creates no standings rows', async () => {
    const userId = await createStable();
    const robotIds = await buyRobots(userId, 3);
    for (const robotId of robotIds) {
      expect(await rowsOf('robot', robotId)).toEqual([]);
    }
  });
});

describe('case 2: subscribing to a robot mode', () => {
  for (const mode of ROBOT_MODES) {
    describe(mode, () => {
      beforeEach(() => clearBronze(mode));
      afterAll(() => clearBronze(mode));

      it('creates exactly one Bronze, 0 LP row in bronze_1 when the mode is empty', async () => {
        const userId = await createStable();
        const robotId = await buyRobot(userId);
        await subscribeRobot(robotId, mode, userId);

        const rows = await rowsOf('robot', robotId);
        expect(rows).toHaveLength(1);
        expect(rows[0].mode).toBe(mode);
        expectFreshBronze(rows[0]);
        expect(rows[0].leagueInstanceId).toBe('bronze_1');
      });

      it('places in the least-full instance (100 in bronze_1, 3 in bronze_2 -> bronze_2)', async () => {
        const seeds = await createSeedRobots(103);
        await enterRobotStandings(seeds.slice(0, 100), mode, { leagueInstanceId: 'bronze_1' });
        await enterRobotStandings(seeds.slice(100), mode, { leagueInstanceId: 'bronze_2' });
        const userId = await createStable();
        const robotId = await buyRobot(userId);

        await subscribeRobot(robotId, mode, userId);

        const rows = await rowsOf('robot', robotId);
        expect(rows).toHaveLength(1);
        expectFreshBronze(rows[0]);
        expect(rows[0].leagueInstanceId).toBe('bronze_2');
      });

      it('opens a new instance when the only one is full (100 in bronze_1 -> bronze_2)', async () => {
        const seeds = await createSeedRobots(100);
        await enterRobotStandings(seeds, mode, { leagueInstanceId: 'bronze_1' });
        const userId = await createStable();
        const robotId = await buyRobot(userId);

        await subscribeRobot(robotId, mode, userId);

        const rows = await rowsOf('robot', robotId);
        expect(rows).toHaveLength(1);
        expect(rows[0].leagueInstanceId).toBe('bronze_2');
        expect(await bronzeInstanceCounts(mode)).toEqual({ bronze_1: 100, bronze_2: 1 });
      });
    });
  }
});

describe('case 3: onboarding default subscription set', () => {
  it("['league_1v1','tournament_1v1','koth'] creates exactly the league_1v1 and koth rows", async () => {
    const userId = await createStable();
    const robotId = await buyRobot(userId);

    await setSubscriptionsForRobot(robotId, ['league_1v1', 'tournament_1v1', 'koth'], userId);

    const rows = await rowsOf('robot', robotId);
    expect(rows.map((r) => r.mode).sort()).toEqual(['koth', 'league_1v1']);
    rows.forEach(expectFreshBronze);
  });
});

describe('case 4: unsubscribe and resubscribe', () => {
  it('keeps the row and its tier, LP and record untouched', async () => {
    const userId = await createStable();
    const robotId = await buyRobot(userId);
    await setSubscriptionsForRobot(robotId, ['league_1v1', 'koth'], userId);
    const progressed = { tier: 'silver', leagueInstanceId: 'silver_1', leaguePoints: 37, cyclesInTier: 4, wins: 5, losses: 2, draws: 1 };
    await prisma.standing.updateMany({ where: { entityType: 'robot', entityId: robotId }, data: progressed });
    const before = await rowsOf('robot', robotId);

    await unsubscribeRobot(robotId, 'league_1v1', userId);
    await unsubscribeRobot(robotId, 'koth', userId);
    expect(await rowsOf('robot', robotId)).toEqual(before);

    await subscribeRobot(robotId, 'league_1v1', userId);
    await subscribeRobot(robotId, 'koth', userId);
    const after = await rowsOf('robot', robotId);
    expect(after.map((r) => r.id)).toEqual(before.map((r) => r.id));
    for (const row of after) expect(row).toMatchObject(progressed);
  });
});

// ── Cases 5-9: team modes ────────────────────────────────────────────

interface TeamFixture {
  userId: number;
  teamId: number;
  robotIds: number[];
}

async function createTeam(size: TeamSize, extraRobots = 0): Promise<TeamFixture & { spare: number[] }> {
  const userId = await createStable();
  const robots = await buyRobots(userId, size + extraRobots);
  const team = await registerTeam(userId, robots.slice(0, size), `${RUN} T${next()}`, size, userId);
  return { userId, teamId: team.id, robotIds: robots.slice(0, size), spare: robots.slice(size) };
}

describe('case 5: 2v2 team, league_2v2 and tag_team', () => {
  it('creates a team row only once both members hold the mode; tag_team is independent', async () => {
    const { userId, teamId, robotIds: [a, b] } = await createTeam(2);
    expect(await rowsOf('team', teamId)).toEqual([]);

    await subscribeRobot(a, 'league_2v2', userId);
    expect(await rowsOf('team', teamId)).toEqual([]);

    await subscribeRobot(b, 'league_2v2', userId);
    const rows = await rowsOf('team', teamId);
    expect(rows.map((r) => r.mode)).toEqual(['league_2v2']);
    expectFreshBronze(rows[0]);

    await subscribeRobot(a, 'tag_team', userId);
    expect(await modesOf('team', teamId)).toEqual(['league_2v2']);
    await subscribeRobot(b, 'tag_team', userId);
    expect(await modesOf('team', teamId)).toEqual(['league_2v2', 'tag_team']);

    // Team modes never create robot rows.
    expect(await rowsOf('robot', a)).toEqual([]);
    expect(await rowsOf('robot', b)).toEqual([]);

    // A member unsubscribing keeps the team's row.
    const before = await rowsOf('team', teamId);
    await unsubscribeRobot(a, 'league_2v2', userId);
    expect(await rowsOf('team', teamId)).toEqual(before);
  });
});

describe('case 6: 3v3 team', () => {
  it('needs all three members subscribed to league_3v3', async () => {
    const { userId, teamId, robotIds: [a, b, c] } = await createTeam(3);

    await subscribeRobot(a, 'league_3v3', userId);
    await subscribeRobot(b, 'league_3v3', userId);
    expect(await rowsOf('team', teamId)).toEqual([]);

    await subscribeRobot(c, 'league_3v3', userId);
    const rows = await rowsOf('team', teamId);
    expect(rows.map((r) => r.mode)).toEqual(['league_3v3']);
    expectFreshBronze(rows[0]);
  });

  it('never enters a 3-robot team into the 2-robot modes', async () => {
    const { userId, teamId, robotIds } = await createTeam(3);
    for (const robotId of robotIds) {
      await setSubscriptionsForRobot(robotId, ['league_2v2', 'tag_team', 'league_3v3'], userId);
    }
    expect(await modesOf('team', teamId)).toEqual(['league_3v3']);
  });
});

describe('case 7: registering a team', () => {
  it('creates the rows for every mode all members already hold', async () => {
    const userId = await createStable();
    const [a, b] = await buyRobots(userId, 2);
    await setSubscriptionsForRobot(a, ['league_2v2', 'tag_team'], userId);
    await setSubscriptionsForRobot(b, ['league_2v2', 'tag_team'], userId);

    const team = await registerTeam(userId, [a, b], `${RUN} Reg${next()}`, 2, userId);

    const rows = await rowsOf('team', team.id);
    expect(rows.map((r) => r.mode).sort()).toEqual(['league_2v2', 'tag_team']);
    rows.forEach(expectFreshBronze);
  });

  it('creates no rows when only part of the team is subscribed', async () => {
    const userId = await createStable();
    const [a, b] = await buyRobots(userId, 2);
    await setSubscriptionsForRobot(a, ['league_2v2', 'tag_team'], userId);
    await setSubscriptionsForRobot(b, ['tag_team'], userId);

    const team = await registerTeam(userId, [a, b], `${RUN} Part${next()}`, 2, userId);

    expect(await modesOf('team', team.id)).toEqual(['tag_team']);
  });
});

describe('case 8: swapping a member', () => {
  it('creates the row when the incoming robot completes the set', async () => {
    const { userId, teamId, robotIds: [a, b], spare: [c] } = await createTeam(2, 1);
    await subscribeRobot(a, 'league_2v2', userId);
    await subscribeRobot(c, 'league_2v2', userId);
    expect(await rowsOf('team', teamId)).toEqual([]);

    await swapTeamMember(teamId, b, c, userId);

    const rows = await rowsOf('team', teamId);
    expect(rows.map((r) => r.mode)).toEqual(['league_2v2']);
    expectFreshBronze(rows[0]);
  });

  it('accepts an unsubscribed robot and keeps the team id and its row', async () => {
    const { userId, teamId, robotIds: [a, b], spare: [d] } = await createTeam(2, 1);
    await subscribeRobot(a, 'league_2v2', userId);
    await subscribeRobot(b, 'league_2v2', userId);
    await prisma.standing.update({
      where: { entityType_entityId_mode: { entityType: 'team', entityId: teamId, mode: 'league_2v2' } },
      data: { tier: 'gold', leagueInstanceId: 'gold_1', leaguePoints: 55, wins: 9 },
    });
    const before = await rowsOf('team', teamId);

    await swapTeamMember(teamId, b, d, userId);

    const team = await prisma.teamBattle.findUniqueOrThrow({ where: { id: teamId }, include: { members: true } });
    expect(team.members.map((m) => m.robotId).sort((x, y) => x - y)).toEqual([a, d].sort((x, y) => x - y));
    expect(await rowsOf('team', teamId)).toEqual(before);
  });
});

describe('case 9: disband and account reset', () => {
  it('disbanding deletes the team rows', async () => {
    const { userId, teamId, robotIds } = await createTeam(2);
    for (const robotId of robotIds) await setSubscriptionsForRobot(robotId, ['league_2v2', 'tag_team'], userId);
    expect(await modesOf('team', teamId)).toEqual(['league_2v2', 'tag_team']);

    await disbandTeam(teamId, userId);

    expect(await rowsOf('team', teamId)).toEqual([]);
  });

  it("an account reset deletes the user's robot and team rows", async () => {
    const userId = await createStable();
    const robots = await buyRobots(userId, 3);
    const pair = await registerTeam(userId, robots.slice(0, 2), `${RUN} P${next()}`, 2, userId);
    const trio = await registerTeam(userId, robots, `${RUN} Q${next()}`, 3, userId);
    for (const robotId of robots) {
      await setSubscriptionsForRobot(robotId, ['league_1v1', 'league_2v2', 'league_3v3'], userId);
    }
    expect(await modesOf('team', pair.id)).toEqual(['league_2v2']);
    expect(await modesOf('team', trio.id)).toEqual(['league_3v3']);
    for (const robotId of robots) expect(await modesOf('robot', robotId)).toEqual(['league_1v1']);

    await performAccountReset(userId, 'standings creation rule test');

    const left = await prisma.standing.count({
      where: {
        OR: [
          { entityType: 'robot', entityId: { in: robots } },
          { entityType: 'team', entityId: { in: [pair.id, trio.id] } },
        ],
      },
    });
    expect(left).toBe(0);
  });
});

// ── Case 10: concurrency ─────────────────────────────────────────────

/** Poll until `predicate` holds; fail with `label` after `timeoutMs`. */
async function waitFor(predicate: () => Promise<boolean> | boolean, label: string, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/**
 * True when a backend holds the (5, teamId) team lock and is waiting on a
 * single-key advisory lock (the mode/tier instance lock). Two-key advisory
 * locks show in pg_locks as classid = key1, objid = key2, objsubid = 2.
 */
async function subscriptionParkedOnModeLock(teamId: number): Promise<boolean> {
  const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n
    FROM pg_locks held
    JOIN pg_locks waiting ON waiting.pid = held.pid
    WHERE held.locktype = 'advisory' AND held.granted
      AND held.classid = ${TEAM_STANDING_LOCK_NAMESPACE}::int::oid
      AND held.objid = ${teamId}::int::oid AND held.objsubid = 2
      AND waiting.locktype = 'advisory' AND NOT waiting.granted AND waiting.objsubid = 1`;
  return n > 0;
}

/** True when a backend holds (2, robotId) and is waiting on an audit sequence lock (3, cycle). */
async function robotLockHolderParkedOnAuditLock(robotId: number): Promise<boolean> {
  const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n
    FROM pg_locks held
    JOIN pg_locks waiting ON waiting.pid = held.pid
    WHERE held.locktype = 'advisory' AND held.granted
      AND held.classid = ${ROBOT_TEAM_MEMBERSHIP_LOCK_NAMESPACE}::int::oid
      AND held.objid = ${robotId}::int::oid AND held.objsubid = 2
      AND waiting.locktype = 'advisory' AND NOT waiting.granted
      AND waiting.classid = 3::oid AND waiting.objsubid = 2`;
  return n > 0;
}

/** Lock waits in this database other than on an audit sequence lock (3, cycle). */
async function waitersExceptAuditLock(): Promise<number> {
  const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n
    FROM pg_locks l
    JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE NOT l.granted AND a.datname = current_database()
      AND NOT (l.locktype = 'advisory' AND l.classid = 3::oid AND l.objsubid = 2)`;
  return n;
}

/** Backends waiting for the (2, robotId) team-membership lock. */
async function robotLockWaiters(robotId: number): Promise<number> {
  const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n
    FROM pg_locks
    WHERE locktype = 'advisory' AND NOT granted
      AND classid = ${ROBOT_TEAM_MEMBERSHIP_LOCK_NAMESPACE}::int::oid
      AND objid = ${robotId}::int::oid AND objsubid = 2`;
  return n;
}

/** Backends waiting for the (5, teamId) team lock. */
async function teamLockWaiters(teamId: number): Promise<number> {
  const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n
    FROM pg_locks
    WHERE locktype = 'advisory' AND NOT granted
      AND classid = ${TEAM_STANDING_LOCK_NAMESPACE}::int::oid
      AND objid = ${teamId}::int::oid AND objsubid = 2`;
  return n;
}

describe('case 10: concurrency', () => {
  it('(a) both members subscribing at once give exactly one league_2v2 row (10 teams)', async () => {
    for (let i = 0; i < 10; i++) {
      const { userId, teamId, robotIds: [a, b] } = await createTeam(2);

      await Promise.all([
        subscribeRobot(a, 'league_2v2', userId),
        subscribeRobot(b, 'league_2v2', userId),
      ]);

      const rows = await rowsOf('team', teamId);
      expect(rows.map((r) => r.mode)).toEqual(['league_2v2']);
    }
  });

  it('(b) a swap racing the incoming robot\'s subscription gives exactly one row and no error', async () => {
    for (let i = 0; i < 5; i++) {
      const { userId, teamId, robotIds: [a, b], spare: [c] } = await createTeam(2, 1);
      await subscribeRobot(a, 'league_2v2', userId);

      await Promise.all([
        swapTeamMember(teamId, b, c, userId),
        subscribeRobot(c, 'league_2v2', userId),
      ]);

      const rows = await rowsOf('team', teamId);
      expect(rows.map((r) => r.mode)).toEqual(['league_2v2']);
    }
  });

  it('(d) a disband racing the completing subscription leaves no orphan team row (10 teams)', async () => {
    for (let i = 0; i < 10; i++) {
      const { userId, teamId, robotIds: [a, b] } = await createTeam(2);
      await subscribeRobot(a, 'league_2v2', userId);

      // Both succeed in either order: the subscription either commits its row
      // before the disband deletes, or waits for the team lock and finds the
      // team gone.
      await Promise.all([
        disbandTeam(teamId, userId),
        subscribeRobot(b, 'league_2v2', userId),
      ]);

      expect(await prisma.teamBattle.findUnique({ where: { id: teamId } })).toBeNull();
      expect(await rowsOf('team', teamId)).toEqual([]);
    }
  });

  it('(d2) a disband arriving while the subscription is mid-placement waits for it and deletes its row', async () => {
    // Force the worst interleaving: the subscription has judged the team
    // matchable (it holds (5, teamId)) and is parked on the league_2v2 Bronze
    // instance lock, held here by a blocker transaction. A disband that does not
    // take the team lock deletes the team now, and the subscription then inserts
    // an orphan row once the blocker lets go.
    const { userId, teamId, robotIds: [a, b] } = await createTeam(2);
    await subscribeRobot(a, 'league_2v2', userId);

    let releaseBlocker!: () => void;
    const blockerReleased = new Promise<void>((resolve) => { releaseBlocker = resolve; });
    let signalLocked!: () => void;
    const blockerLocked = new Promise<void>((resolve) => { signalLocked = resolve; });
    const modeLockKey = leagueInstanceLockKey('league_2v2', 'bronze');
    const blocker = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${modeLockKey})`;
      signalLocked();
      await blockerReleased;
    }, { timeout: 30_000 });
    await blockerLocked;

    const subscription = subscribeRobot(b, 'league_2v2', userId);
    const observed = { disbandSettled: false, disbandWaitedForSubscription: false };
    let disband: Promise<void> | undefined;
    try {
      await waitFor(() => subscriptionParkedOnModeLock(teamId), 'subscription to hold the team lock and wait on the mode lock');

      disband = disbandTeam(teamId, userId).finally(() => { observed.disbandSettled = true; });
      await waitFor(async () => observed.disbandSettled || await teamLockWaiters(teamId) > 0, 'disband to wait on the team lock or finish');
      observed.disbandWaitedForSubscription = !observed.disbandSettled;
    } finally {
      releaseBlocker();
    }
    const results = await Promise.allSettled([blocker, subscription, disband]);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    expect(observed.disbandWaitedForSubscription).toBe(true);
    expect(await prisma.teamBattle.findUnique({ where: { id: teamId } })).toBeNull();
    expect(await rowsOf('team', teamId)).toEqual([]);
  });

  it('(e) an account reset racing the completing subscription leaves no orphan team row and does not deadlock (5 stables)', async () => {
    for (let i = 0; i < 5; i++) {
      const { userId, teamId, robotIds: [a, b] } = await createTeam(2);
      await subscribeRobot(a, 'league_2v2', userId);

      const [reset, subscription] = await Promise.allSettled([
        performAccountReset(userId, 'standings creation rule race test'),
        subscribeRobot(b, 'league_2v2', userId),
      ]);

      expect(reset.status).toBe('fulfilled');
      // The subscription may lose the race (its robot is gone), but never to a deadlock.
      if (subscription.status === 'rejected') {
        expect(String(subscription.reason)).not.toMatch(/deadlock/i);
      }
      expect(await rowsOf('team', teamId)).toEqual([]);
    }
  });

  it('(e2) an account reset arriving while the subscription holds its robot lock waits for it, without deadlock', async () => {
    // Park the subscription after it has taken (2, b) and inserted its
    // subscription row (a key-share lock on robot b), on the audit sequence
    // lock (3, cycle) held by a blocker. A reset that took (5, teamId) without
    // first taking (2, b) would then block on robot b's row while the
    // subscription blocks on (5, teamId): a deadlock.
    const { userId, teamId, robotIds: [a, b] } = await createTeam(2);
    await subscribeRobot(a, 'league_2v2', userId);
    const cycleNumber = await getCurrentCycleNumber();

    let releaseBlocker!: () => void;
    const blockerReleased = new Promise<void>((resolve) => { releaseBlocker = resolve; });
    let signalLocked!: () => void;
    const blockerLocked = new Promise<void>((resolve) => { signalLocked = resolve; });
    const blocker = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(3, ${cycleNumber})`;
      signalLocked();
      await blockerReleased;
    }, { timeout: 30_000 });
    await blockerLocked;

    const subscription = subscribeRobot(b, 'league_2v2', userId);
    const observed = { resetSettled: false, resetWaitedOnRobotLock: false };
    let reset: Promise<void> | undefined;
    try {
      await waitFor(() => robotLockHolderParkedOnAuditLock(b), 'subscription to hold (2, b) and wait on the audit lock');

      reset = performAccountReset(userId, 'standings creation rule race test')
        .finally(() => { observed.resetSettled = true; });
      // Wait until the reset blocks on something other than the parked audit lock.
      await waitFor(async () => observed.resetSettled || await waitersExceptAuditLock() > 0, 'reset to block or finish');
      observed.resetWaitedOnRobotLock = await robotLockWaiters(b) > 0;
    } finally {
      releaseBlocker();
    }
    const results = await Promise.allSettled([blocker, subscription, reset]);

    expect(results.map((r) => (r.status === 'rejected' ? String(r.reason) : r.status)))
      .toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    expect(observed.resetWaitedOnRobotLock).toBe(true);
    expect(await rowsOf('team', teamId)).toEqual([]);
  });

  describe('(c) 20 robots subscribing to koth at once', () => {
    beforeAll(() => clearBronze('koth'));
    afterAll(() => clearBronze('koth'));

    it('creates 20 rows and never fills an instance past 100', async () => {
      const seeds = await createSeedRobots(95);
      await enterRobotStandings(seeds, 'koth', { leagueInstanceId: 'bronze_1' });
      const userId = await createStable();
      const robots = await buyRobots(userId, 10);
      const otherUserId = await createStable();
      robots.push(...await buyRobots(otherUserId, 10));
      const owner = (robotId: number): number => (robots.indexOf(robotId) < 10 ? userId : otherUserId);

      await Promise.all(robots.map((robotId) => subscribeRobot(robotId, 'koth', owner(robotId))));

      const rows = await prisma.standing.findMany({ where: { entityType: 'robot', entityId: { in: robots }, mode: 'koth' } });
      expect(rows).toHaveLength(20);
      expect(new Set(rows.map((r) => r.entityId)).size).toBe(20);
      expect(await bronzeInstanceCounts('koth')).toEqual({ bronze_1: 100, bronze_2: 15 });
    });
  });
});

// ── Cases 11-13: other writers and matchmaking ───────────────────────

describe('case 11: Automaton free upkeep', () => {
  it('creates standings only for the events the allocation gave', async () => {
    // Cap 3 (Booking Office L0): league_2v2, league_1v1 and koth fit; tag_team and grand_melee do not.
    const eventOrder: EventOrder = [
      'league_2v2', 'league_1v1', 'koth', 'tag_team', 'grand_melee',
      'tournament_1v1', 'tournament_2v2', 'league_3v3', 'tournament_3v3',
    ];
    const fixture = await createAutomatonStable({
      tag: `std${RUN}`,
      balance: 10_000_000,
      blueprints: [
        { slotIndex: 1, robotName: `${RUN}_au1`, loadoutType: 'single', weaponPath: [{ main: 'Practice Sword' }] },
        { slotIndex: 2, robotName: `${RUN}_au2`, loadoutType: 'single', weaponPath: [{ main: 'Practice Sword' }] },
      ],
      teamNames: { twoVsTwo: [`${RUN} Pair`], threeVsThree: [] },
      eventOrder,
    });
    automatonUserIds.push(fixture.userId);
    for (const slotIndex of [1, 2]) {
      await prisma.robot.create({
        data: {
          userId: fixture.userId, name: `${RUN}_au${slotIndex}`, currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2,
          automatonSlotIndex: slotIndex, automatonBlueprintId: fixture.blueprintIds.get(slotIndex),
        },
      });
    }
    const blueprints = await loadBlueprintFacts(prisma, fixture.profileId);
    const facts = await loadStableFacts(prisma, fixture.profileId, {
      season: { seasonNumber: 1, phase: 'competitive' },
      blueprints,
    });

    const result = await runFreeUpkeep(
      facts,
      { userId: fixture.userId, blueprints, teamNames: fixture.teamNames, eventOrder },
      { parts: ['teams', 'subscriptions'] },
    );

    expect(result.issues).toEqual([]);
    expect(result.teamsRegistered).toBe(1);
    const team = await prisma.teamBattle.findFirstOrThrow({ where: { stableId: fixture.userId }, include: { members: true } });
    expect(await modesOf('team', team.id)).toEqual(['league_2v2']);
    for (const member of team.members) {
      const subscriptions = await prisma.subscription.findMany({ where: { robotId: member.robotId } });
      expect(subscriptions.map((s) => s.eventType).sort()).toEqual(['koth', 'league_1v1', 'league_2v2']);
      expect(await modesOf('robot', member.robotId)).toEqual(['koth', 'league_1v1']);
    }
  });
});

describe('case 12: generated stables (userGeneration)', () => {
  it('have rows exactly for their subscribed standing-backed events', async () => {
    const result = await generateBattleReadyUsers(6);
    const users = await prisma.user.findMany({ where: { username: { in: result.usernames } }, select: { id: true } });
    userIds.push(...users.map((u) => u.id));
    expect(users).toHaveLength(6);

    const robots = await prisma.robot.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
      include: { subscriptions: true },
    });
    expect(robots.length).toBeGreaterThan(0);
    const subscriptionsOf = new Map(robots.map((r) => [r.id, new Set(r.subscriptions.map((s) => s.eventType))]));
    for (const robot of robots) {
      const held = subscriptionsOf.get(robot.id) ?? new Set<string>();
      const expected = ROBOT_MODES.filter((m) => held.has(m)).sort();
      const rows = await rowsOf('robot', robot.id);
      expect(rows.map((r) => r.mode).sort()).toEqual(expected);
      rows.forEach(expectFreshBronze);
    }

    const teams = await prisma.teamBattle.findMany({
      where: { stableId: { in: users.map((u) => u.id) } },
      include: { members: true },
    });
    expect(teams.length).toBeGreaterThan(0);
    for (const team of teams) {
      const expected = teamModesForSize(team.teamSize as TeamSize)
        .filter((mode) => team.members.every((m) => subscriptionsOf.get(m.robotId)?.has(mode)))
        .sort();
      expect(await modesOf('team', team.id)).toEqual(expected);
    }
  });
});

describe('case 13: end to end with 1v1 matchmaking', () => {
  it('subscribed robots get standings and are booked into a Bronze match', async () => {
    const weapon = await prisma.weapon.findFirstOrThrow({ where: { name: 'Practice Sword' } });
    const robotIds: number[] = [];
    for (let i = 0; i < 2; i++) {
      const userId = await createStable();
      const robotId = await buyRobot(userId);
      const inventory = await prisma.weaponInventory.create({ data: { userId, weaponId: weapon.id, pricePaid: 0 } });
      await prisma.robot.update({ where: { id: robotId }, data: { loadoutType: 'single', mainWeaponId: inventory.id } });
      expect(await rowsOf('robot', robotId)).toEqual([]);
      await subscribeRobot(robotId, 'league_1v1', userId);
      robotIds.push(robotId);
    }
    for (const robotId of robotIds) expect(await modesOf('robot', robotId)).toEqual(['league_1v1']);

    const booked = await runMatchmakingForTier('bronze', new Date(Date.now() + 24 * 60 * 60 * 1000));

    expect(booked).toBeGreaterThanOrEqual(1);
    for (const robotId of robotIds) {
      const matches = await prisma.scheduledMatch.count({
        where: {
          matchType: 'league_1v1',
          participants: { some: { participantType: 'robot', participantId: robotId } },
        },
      });
      expect(matches).toBe(1);
    }
  });
});
