/**
 * Issue #294 — account reset with battle history.
 *
 * `performAccountReset` deleted the stable's robots while their
 * `battle_participants` rows still referenced them through a RESTRICT foreign
 * key, so any player whose robot had ever fought could not reset: the robot
 * delete raised P2003 (`battle_participants_robot_id_fkey`) and rolled the whole
 * transaction back.
 *
 * The fix follows the Generated_Stable purge (`deleteGeneratedStables`): the
 * reset stable's own participant rows go, by robot id; the battles, their
 * summaries and every other stable's participant rows stay, so an opponent's
 * record against the reset robot survives.
 *
 * This suite only creates and deletes its own rows (no truncation), so it lives
 * in the DB_DEPENDENT tier.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import prisma from '../../src/lib/prisma';
import { Prisma } from '../../generated/prisma';
import { createTestRobot, createTestUser } from '../testHelpers';
import { enterRobotStanding, enterTeamStanding } from '../helpers/standings';
import { performAccountReset } from '../../src/services/common/resetService';
import { getMatchHistory, getBattleLog } from '../../src/services/match/matchHistoryService';
import { getAdminBattleList, getAdminBattleDetail } from '../../src/services/admin/battles';

const SUFFIX = randomUUID().slice(0, 8);
const SEASON_NUMBER = 92940 + Math.floor(Math.random() * 1000);
const CYCLE_NUMBER = 929_400 + Math.floor(Math.random() * 1000);
const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000);

interface ParticipantSpec {
  robotId: number;
  team: number;
  role?: string;
  placement?: number;
  eloBefore?: number;
  eloAfter?: number;
}

interface BattleSpec {
  battleType: string;
  winnerId: number | null;
  winningSide?: number;
  tournamentId?: number;
  participants: ParticipantSpec[];
  robotNames: Record<number, string>;
}

/** Create a battle with participants and a permanent summary, created an hour ago. */
async function createBattle(spec: BattleSpec): Promise<number> {
  const battle = await prisma.battle.create({
    data: {
      battleType: spec.battleType,
      leagueType: 'bronze',
      winnerId: spec.winnerId,
      winningSide: spec.winningSide ?? null,
      tournamentId: spec.tournamentId ?? null,
      tournamentRound: spec.tournamentId ? 1 : null,
      durationSeconds: 30,
      winnerReward: 1000,
      loserReward: 500,
      battleLog: { events: [] },
      createdAt: ONE_HOUR_AGO,
      participants: {
        create: spec.participants.map((p) => ({
          robotId: p.robotId,
          team: p.team,
          role: p.role ?? null,
          placement: p.placement ?? null,
          credits: 500,
          eloBefore: p.eloBefore ?? 1200,
          eloAfter: p.eloAfter ?? 1210,
          damageDealt: 50,
          finalHP: 40,
        })),
      },
    },
  });

  await prisma.battleSummary.create({
    data: {
      battleId: battle.id,
      perRobot: spec.participants.map((p) => ({
        robotId: p.robotId,
        robotName: spec.robotNames[p.robotId],
        damageDealt: 50,
      })) as unknown as Prisma.InputJsonValue,
      participants: spec.participants.map((p) => ({
        robotId: p.robotId,
        team: p.team,
        survivalSeconds: 30,
      })) as unknown as Prisma.InputJsonValue,
      damageFlows: [] as unknown as Prisma.InputJsonValue,
      battleDuration: 30,
      totalEvents: 0,
    },
  });

  return battle.id;
}

describe('Issue #294 — account reset with battle history', () => {
  // Reset stable P and opponent stable O.
  let pId: number;
  let oId: number;
  let r1: number;
  let r2: number;
  let r3: number;
  let o1: number;
  let o2: number;
  let o3: number;
  let pTeamId: number;
  let oTeamId: number;
  let tournamentId: number;
  let tournamentMatchId: number;
  let scheduledMatchId: number;
  let ledgerId: number;
  let auditId: bigint;
  const battleIds: Record<'a' | 'b' | 'c' | 'd' | 'e' | 'f', number> = {
    a: 0, b: 0, c: 0, d: 0, e: 0, f: 0,
  };
  const robotNames: Record<number, string> = {};
  let resetLogCountBefore = 0;
  let opponentParticipantsBefore: Array<{ battleId: number; robotId: number; eloAfter: number }> = [];

  beforeAll(async () => {
    const p = await createTestUser(`r294_p_${SUFFIX}`);
    const o = await createTestUser(`r294_o_${SUFFIX}`);
    pId = p.id;
    oId = o.id;
    await prisma.user.update({
      where: { id: pId },
      data: { currency: 1_234_567, onboardingStep: 4, hasCompletedOnboarding: false, isGenerated: false },
    });

    const robots = await Promise.all([
      createTestRobot(pId, `R294_R1_${SUFFIX}`),
      createTestRobot(pId, `R294_R2_${SUFFIX}`),
      createTestRobot(pId, `R294_R3_${SUFFIX}`),
      createTestRobot(oId, `R294_O1_${SUFFIX}`),
      createTestRobot(oId, `R294_O2_${SUFFIX}`),
      createTestRobot(oId, `R294_O3_${SUFFIX}`),
    ]);
    [r1, r2, r3, o1, o2, o3] = robots.map((r) => r.id);
    for (const r of robots) robotNames[r.id] = r.name;

    // P's assets: an equipped weapon, a facility, tuning, subscription, kills, achievement.
    const weapon = await prisma.weapon.findFirst();
    if (!weapon) throw new Error('No weapons seeded');
    const inventory = await prisma.weaponInventory.create({
      data: { userId: pId, weaponId: weapon.id, pricePaid: 0 },
    });
    await prisma.robot.update({ where: { id: r1 }, data: { mainWeaponId: inventory.id } });
    await prisma.facility.create({ data: { userId: pId, facilityType: 'repair_bay', level: 1 } });
    await prisma.tuningAllocation.create({ data: { robotId: r1 } });
    await prisma.subscription.create({ data: { robotId: r1, eventType: 'league_1v1' } });
    await prisma.robotModeKills.create({ data: { robotId: r1, mode: 'league_1v1', kills: 2 } });
    await prisma.userAchievement.create({ data: { userId: pId, achievementId: 'C1', robotId: r1 } });

    // Teams and standings.
    const pTeam = await prisma.teamBattle.create({
      data: {
        stableId: pId, teamSize: 2, teamName: `P294 ${SUFFIX}`,
        members: { create: [{ robotId: r1, slotIndex: 0 }, { robotId: r2, slotIndex: 1 }] },
      },
    });
    const oTeam = await prisma.teamBattle.create({
      data: {
        stableId: oId, teamSize: 2, teamName: `O294 ${SUFFIX}`,
        members: { create: [{ robotId: o1, slotIndex: 0 }, { robotId: o2, slotIndex: 1 }] },
      },
    });
    pTeamId = pTeam.id;
    oTeamId = oTeam.id;
    await enterTeamStanding(pTeamId, 'league_2v2');
    await enterRobotStanding(r1, 'league_1v1');
    await enterRobotStanding(r3, 'koth');
    await enterRobotStanding(r3, 'grand_melee');
    await enterRobotStanding(o1, 'league_1v1', { leaguePoints: 7 });

    // (a) 1v1 league: R1 (team 1, winner) vs O1.
    battleIds.a = await createBattle({
      battleType: 'league_1v1', winnerId: r1, robotNames,
      participants: [
        { robotId: r1, team: 1, eloAfter: 1215 },
        { robotId: o1, team: 2, eloAfter: 1185 },
      ],
    });
    // (b) 2v2 league: R1+R2 vs O1+O2, team 2 wins.
    battleIds.b = await createBattle({
      battleType: 'league_2v2', winnerId: null, winningSide: 2, robotNames,
      participants: [
        { robotId: r1, team: 1, role: 'team_member' },
        { robotId: r2, team: 1, role: 'team_member' },
        { robotId: o1, team: 2, role: 'team_member', eloAfter: 1220 },
        { robotId: o2, team: 2, role: 'team_member', eloAfter: 1220 },
      ],
    });
    // (c) KotH: R3, O1, O3.
    battleIds.c = await createBattle({
      battleType: 'koth', winnerId: o1, robotNames,
      participants: [
        { robotId: r3, team: 1, role: 'koth_participant', placement: 2 },
        { robotId: o1, team: 1, role: 'koth_participant', placement: 1 },
        { robotId: o3, team: 1, role: 'koth_participant', placement: 3 },
      ],
    });
    // (d) Grand Melee: R1, O2, O3.
    battleIds.d = await createBattle({
      battleType: 'grand_melee', winnerId: r1, robotNames,
      participants: [
        { robotId: r1, team: 1, placement: 1 },
        { robotId: o2, team: 1, placement: 2 },
        { robotId: o3, team: 1, placement: 3 },
      ],
    });
    // (e) Completed tournament: R2 vs O3.
    const tournament = await prisma.tournament.create({
      data: {
        name: `T294 ${SUFFIX}`, tournamentType: 'single_elimination', status: 'completed',
        maxRounds: 1, totalParticipants: 2, winnerId: o3, completedAt: ONE_HOUR_AGO,
      },
    });
    tournamentId = tournament.id;
    battleIds.e = await createBattle({
      battleType: 'tournament_1v1', winnerId: o3, tournamentId, robotNames,
      participants: [
        { robotId: r2, team: 1 },
        { robotId: o3, team: 2, eloAfter: 1230 },
      ],
    });
    const tMatch = await prisma.scheduledTournamentMatch.create({
      data: {
        tournamentId, round: 1, matchNumber: 1, participant1Id: r2, participant2Id: o3,
        winnerId: o3, battleId: battleIds.e, status: 'completed', completedAt: ONE_HOUR_AGO,
      },
    });
    tournamentMatchId = tMatch.id;
    // (f) Bye: only R3 participates.
    battleIds.f = await createBattle({
      battleType: 'league_1v1', winnerId: r3, robotNames,
      participants: [{ robotId: r3, team: 1 }],
    });
    const scheduled = await prisma.scheduledMatch.create({
      data: {
        matchType: 'league_1v1', status: 'completed', scheduledFor: ONE_HOUR_AGO,
        battleId: battleIds.f, isByeMatch: true, leagueType: 'bronze', leagueInstanceId: 'bronze_1',
        participants: { create: [{ participantType: 'robot', participantId: r3, slot: 1 }] },
      },
    });
    scheduledMatchId = scheduled.id;

    // A paired ledger + audit row for P (current-economy history).
    const financialEventId = `issue294:${SUFFIX}:battle_income`;
    const ledger = await prisma.financialLedger.create({
      data: {
        cycleNumber: CYCLE_NUMBER, userId: pId, robotId: r1, transactionType: 'battle_income',
        amount: 500, balanceAfter: 1_234_567, description: 'issue 294 fixture', financialEventId,
      },
    });
    ledgerId = ledger.id;
    const audit = await prisma.auditLog.create({
      data: {
        cycleNumber: CYCLE_NUMBER, eventType: 'financial_transaction', sequenceNumber: 1,
        userId: pId, robotId: r1, battleId: battleIds.a, financialEventId,
        payload: { amount: 500 },
      },
    });
    auditId = audit.id;

    // A completed season archive for P (cross-season history).
    await prisma.season.create({
      data: { seasonNumber: SEASON_NUMBER, phase: 'completed', startedAt: ONE_HOUR_AGO, endedAt: ONE_HOUR_AGO },
    });
    await prisma.stableSeasonArchive.create({
      data: {
        seasonNumber: SEASON_NUMBER, userId: pId, stableName: `P294 ${SUFFIX}`.slice(0, 30),
        finalCredits: 1, prestigeEarned: 0, totalBattles: 1, wins: 1, losses: 0, draws: 0, winRate: 1,
        highestElo: 1215, totalFame: 0, championshipTitles: 0, championshipTitles1v1: 0,
        championshipTitles2v2: 0, championshipTitles3v3: 0, achievementsUnlocked: 0,
        achievementsAvailable: 0, achievementIds: [], facilities: [], robotCount: 3, teamCount: 1,
        competitiveCycles: 1,
        robots: {
          create: [{
            robotName: robotNames[r1], frameId: 1, finalElo: 1215, fame: 0, wins: 1, losses: 0,
            draws: 0, totalBattles: 1, damageDealtLifetime: 50, damageTakenLifetime: 10, kills: 0,
            standings: [], teams: [],
          }],
        },
      },
    });

    resetLogCountBefore = await prisma.resetLog.count({ where: { userId: pId } });
    opponentParticipantsBefore = await prisma.battleParticipant.findMany({
      where: { robotId: { in: [o1, o2, o3] } },
      select: { battleId: true, robotId: true, eloAfter: true },
      orderBy: [{ battleId: 'asc' }, { robotId: 'asc' }],
    });
  });

  afterAll(async () => {
    const ids = Object.values(battleIds).filter((id) => id > 0);
    const robotIds = [r1, r2, r3, o1, o2, o3].filter((id) => id !== undefined);
    const steps: Array<() => Promise<unknown>> = [
      () => prisma.scheduledTournamentMatch.deleteMany({ where: { id: tournamentMatchId } }),
      () => prisma.scheduledMatch.deleteMany({ where: { id: scheduledMatchId } }),
      () => prisma.battleParticipant.deleteMany({ where: { battleId: { in: ids } } }),
      () => prisma.battleSummary.deleteMany({ where: { battleId: { in: ids } } }),
      () => prisma.battle.deleteMany({ where: { id: { in: ids } } }),
      () => prisma.tournament.deleteMany({ where: { id: tournamentId } }),
      () => prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robotIds } } }),
      () => prisma.standing.deleteMany({ where: { entityType: 'team', entityId: { in: [pTeamId, oTeamId] } } }),
      () => prisma.financialLedger.deleteMany({ where: { id: ledgerId } }),
      () => prisma.auditLog.deleteMany({ where: { id: auditId } }),
      () => prisma.season.deleteMany({ where: { seasonNumber: SEASON_NUMBER } }),
      () => prisma.resetLog.deleteMany({ where: { userId: { in: [pId, oId] } } }),
      () => prisma.robot.updateMany({ where: { userId: { in: [pId, oId] } }, data: { mainWeaponId: null } }),
      () => prisma.user.deleteMany({ where: { id: { in: [pId, oId] } } }),
    ];
    for (const step of steps) {
      try {
        await step();
      } catch {
        // Keep cleaning up the remaining rows even if one step fails.
      }
    }
  });

  it('resets a stable whose robots have battle history and keeps the opponent record', async () => {
    const ledgerBefore = await prisma.financialLedger.count({ where: { userId: pId } });
    const auditBefore = await prisma.auditLog.count({ where: { userId: pId } });

    await expect(performAccountReset(pId, 'issue 294')).resolves.toBeUndefined();

    // P's own state is gone / reset.
    expect(await prisma.robot.count({ where: { userId: pId } })).toBe(0);
    expect(await prisma.weaponInventory.count({ where: { userId: pId } })).toBe(0);
    expect(await prisma.facility.count({ where: { userId: pId } })).toBe(0);
    expect(await prisma.teamBattle.count({ where: { stableId: pId } })).toBe(0);
    expect(await prisma.userAchievement.count({ where: { userId: pId } })).toBe(0);
    expect(await prisma.standing.count({
      where: { OR: [
        { entityType: 'robot', entityId: { in: [r1, r2, r3] } },
        { entityType: 'team', entityId: pTeamId },
      ] },
    })).toBe(0);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: pId } });
    expect(user.currency).toBe(3_000_000);
    expect(user.prestige).toBe(0);
    expect(user.onboardingStep).toBe(1);
    expect(user.hasCompletedOnboarding).toBe(false);
    expect(await prisma.resetLog.count({ where: { userId: pId } })).toBe(resetLogCountBefore + 1);

    // Only P's participant rows are removed; battles and summaries survive.
    expect(await prisma.battleParticipant.count({ where: { robotId: { in: [r1, r2, r3] } } })).toBe(0);
    const ids = Object.values(battleIds);
    expect(await prisma.battle.count({ where: { id: { in: ids } } })).toBe(6);
    expect(await prisma.battleSummary.count({ where: { battleId: { in: ids } } })).toBe(6);

    // Opponent's record is unchanged.
    const opponentParticipantsAfter = await prisma.battleParticipant.findMany({
      where: { robotId: { in: [o1, o2, o3] } },
      select: { battleId: true, robotId: true, eloAfter: true },
      orderBy: [{ battleId: 'asc' }, { robotId: 'asc' }],
    });
    expect(opponentParticipantsAfter).toEqual(opponentParticipantsBefore);
    expect(opponentParticipantsAfter).toHaveLength(8);
    expect(await prisma.robot.count({ where: { userId: oId } })).toBe(3);
    expect(await prisma.teamBattleMember.count({ where: { teamId: oTeamId } })).toBe(2);
    const oStanding = await prisma.standing.findFirst({ where: { entityType: 'robot', entityId: o1, mode: 'league_1v1' } });
    expect(oStanding?.leaguePoints).toBe(7);
    expect(await prisma.tournament.count({ where: { id: tournamentId } })).toBe(1);
    expect(await prisma.scheduledTournamentMatch.count({ where: { id: tournamentMatchId } })).toBe(1);
    expect(await prisma.scheduledMatch.count({ where: { id: scheduledMatchId } })).toBe(1);

    // Reset writes no financial rows and removes none; archives are untouched.
    expect(await prisma.financialLedger.count({ where: { userId: pId } })).toBe(ledgerBefore);
    expect(await prisma.auditLog.count({ where: { userId: pId } })).toBe(auditBefore);
    expect(await prisma.stableSeasonArchive.count({ where: { userId: pId, seasonNumber: SEASON_NUMBER } })).toBe(1);
    expect(await prisma.robotSeasonArchive.count({
      where: { stableArchive: { userId: pId, seasonNumber: SEASON_NUMBER } },
    })).toBe(1);
  });

  it('opponent and admin battle readers tolerate the removed side', async () => {
    const history = await getMatchHistory({ userId: oId, page: 1, perPage: 50 });
    const historyIds = history.data.map((entry) => (entry as { id: number }).id).sort((x, y) => x - y);
    expect(historyIds).toEqual([battleIds.a, battleIds.b, battleIds.c, battleIds.d, battleIds.e].sort((x, y) => x - y));
    const entryA = history.data.find((entry) => (entry as { id: number }).id === battleIds.a) as
      { robot1: { name: string } | null; robot2: { name: string } | null } | undefined;
    expect(entryA?.robot1?.name).toBe('Unknown');
    expect(entryA?.robot2?.name).toBe(robotNames[o1]);

    await expect(getBattleLog(battleIds.a)).resolves.not.toBeNull();

    const list = await getAdminBattleList({
      page: 1, limit: 50, mode: 'all', stable: 'all', outcome: 'all', range: 'season', q: robotNames[o1],
    });
    const recordA = list.battles.find((b) => b.id === battleIds.a);
    expect(recordA).toBeDefined();
    // The reset removed side 1's robot (the winner): it reads as Unknown, not as a draw.
    expect(recordA?.result).toBe('win');
    expect(recordA?.sides.map((s) => s.label)).toEqual(['Unknown', robotNames[o1]]);
    expect(recordA?.sides.some((s) => s.isWinner)).toBe(false);
    const detailA = await getAdminBattleDetail(battleIds.a);
    expect(detailA.participants.map((p) => p.robotId)).toEqual([o1]);
  });

  it('a second reset with no robots left also succeeds', async () => {
    await expect(performAccountReset(pId)).resolves.toBeUndefined();
    expect(await prisma.resetLog.count({ where: { userId: pId } })).toBe(resetLogCountBefore + 2);
  });
});
