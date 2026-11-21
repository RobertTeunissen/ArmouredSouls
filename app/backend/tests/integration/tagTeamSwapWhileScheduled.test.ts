/**
 * Active / Reserve swap while a tag team match is scheduled.
 *
 * Players may swap the two members' order on a scheduled team (only replacing a
 * member stays locked). The tag team job loads every scheduled match when it
 * starts, then reloads each team right before its battle, so a swap made while
 * the job runs reaches the simulation but not the job's first snapshot. The
 * result must be booked against the line-up the battle was fought with.
 *
 * Real database: two matches; while match 1 is simulated the owner of a match-2
 * team swaps Active and Reserve. Every robot of match 2 must then carry exactly
 * the damage its own battle participant row records.
 */
import prisma from '../../src/lib/prisma';
import * as tagTeamSimulation from '../../src/services/tag-team/tagTeamSimulation';
import { executeScheduledTagTeamBattles } from '../../src/services/tag-team/tagTeamScheduler';
import { swapPositions } from '../../src/services/team-battle/teamBattleService';
import { TeamBattleErrorCode } from '../../src/errors/teamBattleErrors';
import { battlesForRobots } from '../cleanupHelper';
import { useFinancialCaptureTestEnvironment } from '../financialCaptureTestHelper';
import { createTagTeamFixture } from '../helpers/tagTeam';

useFinancialCaptureTestEnvironment();

const RUN = `tts${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const userIds: number[] = [];
const robotIds: number[] = [];
const teamIds: number[] = [];
const scheduledIds: number[] = [];
let weaponId: number;
let counter = 0;

async function createStable(): Promise<number> {
  const n = ++counter;
  const user = await prisma.user.create({
    data: { username: `${RUN}_u${n}`, passwordHash: 'x', currency: 500_000, stableName: `${RUN}_s${n}` },
  });
  userIds.push(user.id);
  return user.id;
}

async function armedRobot(userId: number): Promise<number> {
  const inv = await prisma.weaponInventory.create({ data: { userId, weaponId, pricePaid: 0 } });
  const robot = await prisma.robot.create({
    data: {
      userId,
      name: `${RUN}_r${++counter}`,
      currentHP: 100,
      maxHP: 100,
      currentShield: 20,
      maxShield: 20,
      yieldThreshold: 20,
      loadoutType: 'single',
      mainWeaponId: inv.id,
    },
  });
  robotIds.push(robot.id);
  return robot.id;
}

async function createTeam(): Promise<{ teamId: number; stableId: number; active: number; reserve: number }> {
  const stableId = await createStable();
  const active = await armedRobot(stableId);
  const reserve = await armedRobot(stableId);
  const team = await createTagTeamFixture(stableId, active, reserve);
  teamIds.push(team.id);
  return { teamId: team.id, stableId, active, reserve };
}

async function schedule(teamA: number, teamB: number, order: number): Promise<number> {
  const at = new Date(Date.now() - 60_000 + order * 1_000);
  const row = await prisma.scheduledMatch.create({
    data: {
      matchType: 'tag_team',
      status: 'scheduled',
      scheduledFor: at,
      createdAt: at,
      leagueType: 'bronze',
      leagueInstanceId: 'bronze_1',
      isByeMatch: false,
      participants: {
        create: [teamA, teamB].map((participantId, i) => ({ participantType: 'team', participantId, slot: i + 1 })),
      },
    },
  });
  scheduledIds.push(row.id);
  return row.id;
}

beforeAll(async () => {
  const weapon = await prisma.weapon.findFirst({ orderBy: { id: 'asc' } });
  if (!weapon) throw new Error('No weapons seeded');
  weaponId = weapon.id;
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await prisma.scheduledMatch.deleteMany({ where: { id: { in: scheduledIds } } });
  await prisma.battle.deleteMany({ where: battlesForRobots(robotIds) });
  await prisma.financialLedger.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { robotId: { in: robotIds } }] } });
  await prisma.standing.deleteMany({ where: { entityType: 'team', entityId: { in: teamIds } } });
  await prisma.subscription.deleteMany({ where: { robotId: { in: robotIds } } });
  await prisma.teamBattleMember.deleteMany({ where: { teamId: { in: teamIds } } });
  await prisma.teamBattle.deleteMany({ where: { id: { in: teamIds } } });
  await prisma.robot.deleteMany({ where: { id: { in: robotIds } } });
  await prisma.weaponInventory.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

describe('tag team Active / Reserve swap while scheduled', () => {
  it('lets the owner swap Active and Reserve on a team with a scheduled match', async () => {
    const [a, b] = [await createTeam(), await createTeam()];
    await schedule(a.teamId, b.teamId, 1);

    await swapPositions(a.teamId, a.stableId);

    const members = await prisma.teamBattleMember.findMany({ where: { teamId: a.teamId }, orderBy: { slotIndex: 'asc' } });
    expect(members.map((m) => m.robotId)).toEqual([a.reserve, a.active]);

    // Cancel it so the next case's job only sees its own matches.
    await prisma.scheduledMatch.updateMany({ where: { id: { in: scheduledIds } }, data: { status: 'cancelled' } });
  });

  it('books the result against the line-up the battle was fought with', async () => {
    const teams = [await createTeam(), await createTeam(), await createTeam(), await createTeam()];
    await schedule(teams[0].teamId, teams[1].teamId, 1);
    const m2 = await schedule(teams[2].teamId, teams[3].teamId, 2);
    const swapped = teams[2];

    // While match 1 is being simulated (after the job loaded every match), the
    // owner of a match-2 team swaps Active and Reserve.
    const original = tagTeamSimulation.simulateTagTeamBattle;
    let swappedDuringRun = false;
    jest.spyOn(tagTeamSimulation, 'simulateTagTeamBattle').mockImplementation(async (t1, t2) => {
      if (!swappedDuringRun) {
        swappedDuringRun = true;
        await swapPositions(swapped.teamId, swapped.stableId);
      }
      return original(t1, t2);
    });

    // The job runs every scheduled tag team match. Park other suites' queued
    // matches for the run and put them back afterwards, untouched.
    const parked = (await prisma.scheduledMatch.findMany({
      where: { matchType: 'tag_team', status: 'scheduled', id: { notIn: scheduledIds } },
      select: { id: true },
    })).map((m) => m.id);
    await prisma.scheduledMatch.updateMany({ where: { id: { in: parked } }, data: { status: 'cancelled' } });
    let summary: Awaited<ReturnType<typeof executeScheduledTagTeamBattles>>;
    try {
      summary = await executeScheduledTagTeamBattles();
    } finally {
      await prisma.scheduledMatch.updateMany({ where: { id: { in: parked } }, data: { status: 'scheduled' } });
    }
    expect(summary.totalBattles).toBe(2);
    expect(swappedDuringRun).toBe(true);

    const { battleId } = await prisma.scheduledMatch.findUniqueOrThrow({ where: { id: m2 } });
    const participants = await prisma.battleParticipant.findMany({ where: { battleId: battleId! } });
    // The battle record shows the swapped order: the former reserve fought as Active.
    expect(participants.find((p) => p.robotId === swapped.reserve)?.role).toBe('active');
    expect(participants.find((p) => p.robotId === swapped.active)?.role).toBe('reserve');

    // Each robot's lifetime damage (0 before this battle) is its own participant
    // row's. The two columns round the same float independently, so allow 1.
    const robots = await prisma.robot.findMany({
      where: { id: { in: participants.map((p) => p.robotId) } },
      select: { id: true, damageDealtLifetime: true, totalBattles: true },
    });
    for (const p of participants) {
      const robot = robots.find((r) => r.id === p.robotId)!;
      expect(robot.totalBattles).toBe(1);
      expect(Math.abs(robot.damageDealtLifetime - p.damageDealt)).toBeLessThanOrEqual(1);
    }
    // Guard against a vacuous pass: the swapped team's two robots dealt clearly
    // different damage, so a mix-up could not hide inside the rounding allowance.
    const [first, second] = participants
      .filter((p) => p.robotId === swapped.active || p.robotId === swapped.reserve)
      .map((p) => p.damageDealt);
    expect(Math.abs(first - second)).toBeGreaterThan(2);
  }, 120000);

  it('handles two simultaneous swaps of one team: both apply, back to the original order', async () => {
    const t = await createTeam();

    // The team row lock serialises them; this checks the locked path neither
    // deadlocks nor trips the (teamId, slotIndex) unique constraint. Timing
    // alone cannot force the unlocked interleaving, so it does not prove the race.
    await Promise.all([swapPositions(t.teamId, t.stableId), swapPositions(t.teamId, t.stableId)]);

    const members = await prisma.teamBattleMember.findMany({ where: { teamId: t.teamId }, orderBy: { slotIndex: 'asc' } });
    expect(members.map((m) => m.robotId)).toEqual([t.active, t.reserve]);
  });

  it('still refuses to replace a member while a match is scheduled', async () => {
    const [a, b] = [await createTeam(), await createTeam()];
    await schedule(a.teamId, b.teamId, 1);
    const spare = await armedRobot(a.stableId);

    const { swapTeamMember } = await import('../../src/services/team-battle/teamBattleService');
    await expect(swapTeamMember(a.teamId, a.active, spare, a.stableId)).rejects.toMatchObject({
      code: TeamBattleErrorCode.TEAM_LOCKED_FOR_BATTLE,
    });
  });
});
