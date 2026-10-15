/**
 * T25 — a robot that forfeited (no main weapon) or fought with the single-weapon
 * fallback (incomplete loadout) is not scheduled again until it is fixed.
 *
 * Answers the product owner's question by execution rather than by reading:
 * every cycle job executes its slot's battles first and runs that mode's
 * matchmaking afterwards (cycleScheduler.ts executeLeagueCycle / tag team /
 * KotH / GM / team jobs; adminCycleService.ts per slot), and matchmaking keeps
 * the full-loadout `checkSchedulingReadiness` rule.
 *
 * League 1v1, team league 2v2 and tag team run the real sequence: schedule →
 * take a weapon away → execute → matchmake. KotH and Grand Melee check the
 * matchmakers' eligibility gate (`getEligibleRobots`) directly; their
 * battle-time forfeits land in a later phase.
 *
 * Each case uses its own league instance so the pools hold only this file's
 * entities, and deletes every queued row the matchmaker created.
 */
import prisma from '../../src/lib/prisma';
import type { MatchType, StandingsMode } from '../../generated/prisma';
import { executeScheduledBattles } from '../../src/services/league/leagueBattleOrchestrator';
import { executeScheduledTeamBattles } from '../../src/services/team-battle/teamBattleOrchestrator';
import { executeScheduledTagTeamBattles } from '../../src/services/tag-team/tagTeamScheduler';
import { runMatchmakingForTier } from '../../src/services/analytics/matchmakingService';
import { runTeamBattleMatchmaking } from '../../src/services/team-battle/teamBattleMatchmakingService';
import { runTagTeamMatchmaking } from '../../src/services/tag-team/tagTeamMatchmakingService';
import { getEligibleRobots as getEligibleKothRobots } from '../../src/services/koth/kothMatchmakingService';
import { getEligibleRobots as getEligibleGrandMeleeRobots } from '../../src/services/grand-melee/grandMeleeMatchmakingService';
import { unequipMainWeapon, unequipOffhandWeapon } from '../../src/services/robot/robotWeaponService';
import { battlesForRobots } from '../cleanupHelper';
import { useFinancialCaptureTestEnvironment } from '../financialCaptureTestHelper';
import { enterRobotStanding, enterTeamStanding } from '../helpers/standings';
import { subscribeRobots, subscribeTeamMembers, type SubscriptionEventType } from '../helpers/subscriptions';
import { createTagTeamFixture } from '../helpers/tagTeam';

useFinancialCaptureTestEnvironment();

const RUN = `saf${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const TIER = 'bronze' as const;

const userIds: number[] = [];
const robotIds: number[] = [];
const teamIds: number[] = [];
const scheduledIds: number[] = [];
let weaponId: number;
let counter = 0;
const next = (): number => ++counter;

/** A league instance no other suite uses, so each pool holds only this case's entities. */
function freshInstance(): string {
  return `${TIER}_${7000 + Math.floor(Math.random() * 2000) + next()}`;
}

// ── Fixtures ─────────────────────────────────────────────────────────

async function createStable(): Promise<number> {
  const n = next();
  const user = await prisma.user.create({
    data: { username: `${RUN}_u${n}`, passwordHash: 'x', currency: 500_000, stableName: `${RUN}_s${n}` },
  });
  userIds.push(user.id);
  return user.id;
}

type Loadout = 'single' | 'dual_wield';

async function armedRobot(userId: number, loadout: Loadout = 'single'): Promise<number> {
  const main = await prisma.weaponInventory.create({ data: { userId, weaponId, pricePaid: 0 } });
  const offhand = loadout === 'dual_wield'
    ? await prisma.weaponInventory.create({ data: { userId, weaponId, pricePaid: 0 } })
    : null;
  const robot = await prisma.robot.create({
    data: {
      userId,
      name: `${RUN}_r${next()}`,
      currentHP: 100,
      maxHP: 100,
      currentShield: 20,
      maxShield: 20,
      yieldThreshold: 20,
      loadoutType: loadout,
      mainWeaponId: main.id,
      offhandWeaponId: offhand?.id ?? null,
    },
  });
  robotIds.push(robot.id);
  return robot.id;
}

async function createTeam(size: 2 | 3, loadouts: Loadout[], mode: StandingsMode, instance: string) {
  const stableId = await createStable();
  const robots: number[] = [];
  for (let i = 0; i < size; i++) robots.push(await armedRobot(stableId, loadouts[i] ?? 'single'));
  const team = await prisma.teamBattle.create({
    data: {
      stableId,
      teamSize: size,
      teamName: `${RUN}_t${next()}`.slice(0, 32),
      members: { create: robots.map((robotId, slotIndex) => ({ robotId, slotIndex })) },
    },
  });
  teamIds.push(team.id);
  await enterTeamStanding(team.id, mode, { tier: TIER, leagueInstanceId: instance });
  await subscribeTeamMembers([team.id], mode as SubscriptionEventType);
  return { teamId: team.id, stableId, robots };
}

async function scheduleUnified(matchType: MatchType, participantType: 'robot' | 'team', ids: number[], instance: string): Promise<number> {
  const at = new Date(Date.now() - 60_000);
  const row = await prisma.scheduledMatch.create({
    data: {
      matchType,
      status: 'scheduled',
      scheduledFor: at,
      createdAt: at,
      leagueType: TIER,
      leagueInstanceId: instance,
      isByeMatch: false,
      participants: { create: ids.map((participantId, i) => ({ participantType, participantId, slot: i + 1 })) },
    },
  });
  scheduledIds.push(row.id);
  return row.id;
}

async function isolate(matchType: MatchType): Promise<void> {
  await prisma.scheduledMatch.updateMany({
    where: { matchType, status: { in: ['scheduled', 'error'] }, id: { notIn: scheduledIds } },
    data: { status: 'cancelled', cancelReason: 'schedulingAfterForfeit.test isolation' },
  });
}

async function maxScheduledId(): Promise<number> {
  const row = await prisma.scheduledMatch.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  return row?.id ?? 0;
}

/** Participant ids that the matchmaker queued after `afterId`, for one match type. */
async function newlyQueued(matchType: MatchType, afterId: number): Promise<Set<number>> {
  const rows = await prisma.scheduledMatch.findMany({
    where: { matchType, status: 'scheduled', id: { gt: afterId } },
    include: { participants: true },
  });
  return new Set(rows.flatMap((r) => r.participants.map((p) => p.participantId)));
}

/** Remove what the matchmaker created, ours and anything else in the test database. */
async function dropQueuedAfter(matchType: MatchType, afterId: number): Promise<void> {
  await prisma.scheduledMatch.deleteMany({ where: { matchType, id: { gt: afterId } } });
}

/** The battle each robot fought or forfeited in this case. */
async function participantRows(robots: number[]) {
  return prisma.battleParticipant.findMany({ where: { robotId: { in: robots } } });
}

// ── Lifecycle ────────────────────────────────────────────────────────

beforeAll(async () => {
  const weapon = await prisma.weapon.findFirst({ where: { handsRequired: 'one' }, orderBy: { id: 'asc' } });
  if (!weapon) throw new Error('No one-handed weapon seeded');
  weaponId = weapon.id;
});

afterAll(async () => {
  await prisma.scheduledMatch.deleteMany({ where: { id: { in: scheduledIds } } });
  await prisma.battle.deleteMany({ where: battlesForRobots(robotIds) });
  await prisma.financialLedger.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { robotId: { in: robotIds } }] } });
  await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robotIds } } });
  await prisma.standing.deleteMany({ where: { entityType: 'team', entityId: { in: teamIds } } });
  await prisma.subscription.deleteMany({ where: { robotId: { in: robotIds } } });
  await prisma.teamBattleMember.deleteMany({ where: { teamId: { in: teamIds } } });
  await prisma.teamBattle.deleteMany({ where: { id: { in: teamIds } } });
  await prisma.robot.deleteMany({ where: { id: { in: robotIds } } });
  await prisma.weaponInventory.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

// ── T25 ──────────────────────────────────────────────────────────────

describe('T25: scheduling after execution excludes forfeiters and fallback fighters', () => {
  it('league 1v1: neither the forfeiter nor the single-fallback robot is rescheduled', async () => {
    await isolate('league_1v1');
    const instance = freshInstance();
    const robots: number[] = [];
    for (const loadout of ['single', 'single', 'dual_wield', 'single'] as Loadout[]) {
      const id = await armedRobot(await createStable(), loadout);
      await enterRobotStanding(id, 'league_1v1', { tier: TIER, leagueInstanceId: instance });
      robots.push(id);
    }
    await subscribeRobots(robots, 'league_1v1');
    const [unarmed, opponentA, incomplete, opponentB] = robots;
    await scheduleUnified('league_1v1', 'robot', [unarmed, opponentA], instance);
    await scheduleUnified('league_1v1', 'robot', [incomplete, opponentB], instance);
    await unequipMainWeapon((await prisma.robot.findUniqueOrThrow({ where: { id: unarmed } })).userId, unarmed);
    await unequipOffhandWeapon((await prisma.robot.findUniqueOrThrow({ where: { id: incomplete } })).userId, incomplete);

    const summary = await executeScheduledBattles();
    expect(summary.forfeitBattles).toBe(1);
    const rows = await participantRows(robots);
    expect(rows.find((p) => p.robotId === unarmed)?.forfeited).toBe(true);
    expect(rows.find((p) => p.robotId === incomplete)?.forfeited).toBe(false);

    const before = await maxScheduledId();
    await runMatchmakingForTier(TIER, new Date(Date.now() + 86_400_000));
    const queued = await newlyQueued('league_1v1', before);
    await dropQueuedAfter('league_1v1', before);

    expect(queued.has(unarmed)).toBe(false);
    expect(queued.has(incomplete)).toBe(false);
    // The matchmaker did run for this instance: the ready robots were queued.
    expect(queued.has(opponentA)).toBe(true);
    expect(queued.has(opponentB)).toBe(true);
  });

  it('team league 2v2: neither the forfeiting team nor the single-fallback team is rescheduled', async () => {
    await isolate('league_2v2');
    const instance = freshInstance();
    const forfeiting = await createTeam(2, ['single', 'single'], 'league_2v2', instance);
    const opponentA = await createTeam(2, ['single', 'single'], 'league_2v2', instance);
    const fallback = await createTeam(2, ['dual_wield', 'single'], 'league_2v2', instance);
    const opponentB = await createTeam(2, ['single', 'single'], 'league_2v2', instance);
    await scheduleUnified('league_2v2', 'team', [forfeiting.teamId, opponentA.teamId], instance);
    await scheduleUnified('league_2v2', 'team', [fallback.teamId, opponentB.teamId], instance);
    await unequipMainWeapon(forfeiting.stableId, forfeiting.robots[1]);
    await unequipOffhandWeapon(fallback.stableId, fallback.robots[0]);

    const result = await executeScheduledTeamBattles(2);
    expect(result.matchesForfeited).toBe(1);
    expect(result.matchesCompleted).toBe(1);

    const before = await maxScheduledId();
    await runTeamBattleMatchmaking(2, new Date(Date.now() + 86_400_000));
    const queued = await newlyQueued('league_2v2', before);
    await dropQueuedAfter('league_2v2', before);

    expect(queued.has(forfeiting.teamId)).toBe(false);
    expect(queued.has(fallback.teamId)).toBe(false);
    expect(queued.has(opponentA.teamId)).toBe(true);
    expect(queued.has(opponentB.teamId)).toBe(true);
  });

  it('tag team: neither the forfeiting team nor the single-fallback team is rescheduled', async () => {
    await isolate('tag_team');
    const instance = freshInstance();
    const tagTeam = async (loadouts: Loadout[]) => {
      const stableId = await createStable();
      const active = await armedRobot(stableId, loadouts[0]);
      const reserve = await armedRobot(stableId, loadouts[1]);
      const team = await createTagTeamFixture(stableId, active, reserve, { tier: TIER, leagueInstanceId: instance });
      teamIds.push(team.id);
      return { teamId: team.id, stableId, robots: [active, reserve] };
    };
    const forfeiting = await tagTeam(['single', 'single']);
    const opponentA = await tagTeam(['single', 'single']);
    const fallback = await tagTeam(['dual_wield', 'single']);
    const opponentB = await tagTeam(['single', 'single']);
    await scheduleUnified('tag_team', 'team', [forfeiting.teamId, opponentA.teamId], instance);
    await scheduleUnified('tag_team', 'team', [fallback.teamId, opponentB.teamId], instance);
    await unequipMainWeapon(forfeiting.stableId, forfeiting.robots[1]); // the reserve
    await unequipOffhandWeapon(fallback.stableId, fallback.robots[0]);

    const result = await executeScheduledTagTeamBattles();
    expect(result.forfeits).toBe(1);
    expect(result.totalBattles).toBe(1);

    const before = await maxScheduledId();
    await runTagTeamMatchmaking(new Date(Date.now() + 86_400_000));
    const queued = await newlyQueued('tag_team', before);
    await dropQueuedAfter('tag_team', before);

    expect(queued.has(forfeiting.teamId)).toBe(false);
    expect(queued.has(fallback.teamId)).toBe(false);
    expect(queued.has(opponentA.teamId)).toBe(true);
    expect(queued.has(opponentB.teamId)).toBe(true);
  });

  it.each([
    ['King of the Hill', 'koth' as const, getEligibleKothRobots],
    ['Grand Melee', 'grand_melee' as const, getEligibleGrandMeleeRobots],
  ])('%s: the matchmaker excludes unarmed and incomplete-loadout robots', async (_label, mode, getEligible) => {
    const instance = freshInstance();
    const robots: number[] = [];
    for (const loadout of ['single', 'dual_wield', 'single', 'single'] as Loadout[]) {
      const id = await armedRobot(await createStable(), loadout);
      await enterRobotStanding(id, mode, { tier: TIER, leagueInstanceId: instance });
      robots.push(id);
    }
    await subscribeRobots(robots, mode);
    const [unarmed, incomplete, readyA, readyB] = robots;
    await unequipMainWeapon((await prisma.robot.findUniqueOrThrow({ where: { id: unarmed } })).userId, unarmed);
    await unequipOffhandWeapon((await prisma.robot.findUniqueOrThrow({ where: { id: incomplete } })).userId, incomplete);

    const eligible = new Set((await getEligible(TIER, instance)).map((r) => r.id));

    expect(eligible.has(unarmed)).toBe(false);
    expect(eligible.has(incomplete)).toBe(false);
    expect(eligible.has(readyA)).toBe(true);
    expect(eligible.has(readyB)).toBe(true);
  });
});
