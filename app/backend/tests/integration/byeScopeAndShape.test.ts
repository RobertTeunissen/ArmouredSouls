/**
 * Integration Test: bye record shape, creation, scoping and counting (Spec #49)
 *
 * IT-C — the three bye kinds write the same shape.
 * IT-D — a Thin_Instance creates one bye row per eligible robot.
 * IT-E — auto-repair scoping exempts no mode, and slot accounting counts a bye.
 * IT-G — the Placement_Mode cycle summary counts a bye as a bye.
 *
 * IT-A, IT-B and IT-E's idempotency half live in byeInvariant.test.ts.
 */

import prisma from '../../src/lib/prisma';
import { $Enums } from '../../generated/prisma';
import { resolveByeEvent } from '../../src/services/battle/byeResolutionService';
import {
  planThinInstanceByes,
  createThinInstanceByes,
} from '../../src/services/scheduling/thinInstanceByes';
import { resolveRobotIdsForEvent } from '../../src/services/economy/repairScope';
import { resolveOutstandingEventsForRobot } from '../../src/services/scheduling/eventScheduleScope';

const TIER = 'bronze';
const cleanup: Array<{ userIds: number[]; robotIds: number[]; matchIds: number[]; tournamentIds: number[] }> = [];

async function makeUser(tag: string) {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${tag}`;
  return prisma.user.create({
    data: {
      username: `bs_${stamp}`,
      email: `bs_${stamp}@test.local`,
      passwordHash: 'x',
      stableName: `S_${stamp}`,
      currency: 100_000,
    },
  });
}

async function makeRobot(userId: number, i: number, hp = 55) {
  return prisma.robot.create({
    data: {
      userId,
      name: `BS_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${i}`,
      currentHP: hp,
      maxHP: 100,
      currentShield: 20,
      maxShield: 20,
      elo: 1200,
    },
  });
}

describe('Bye record shape, creation and scoping (Spec #49)', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    for (const c of cleanup) {
      const battles = await prisma.battle.findMany({
        where: { participants: { some: { robotId: { in: c.robotIds } } } },
        select: { id: true },
      });
      const ids = battles.map((b) => b.id);
      await prisma.battleSummary.deleteMany({ where: { battleId: { in: ids } } });
      await prisma.battleParticipant.deleteMany({ where: { battleId: { in: ids } } });
      await prisma.battle.deleteMany({ where: { id: { in: ids } } });
      await prisma.standing.deleteMany({ where: { entityId: { in: c.robotIds } } });
      await prisma.scheduledMatchParticipant.deleteMany({
        where: { scheduledMatchId: { in: c.matchIds } },
      });
      await prisma.scheduledTournamentMatch.deleteMany({
        where: { tournamentId: { in: c.tournamentIds } },
      });
      await prisma.tournament.deleteMany({ where: { id: { in: c.tournamentIds } } });
      await prisma.scheduledMatch.deleteMany({ where: { id: { in: c.matchIds } } });
      await prisma.subscription.deleteMany({ where: { robotId: { in: c.robotIds } } });
      await prisma.robot.deleteMany({ where: { id: { in: c.robotIds } } });
      await prisma.user.deleteMany({ where: { id: { in: c.userIds } } });
    }
    await prisma.$disconnect();
  });

  // ── IT-C ──
  describe('IT-C: the three bye kinds write the same shape', () => {
    it('should populate the same battles columns and row counts for 1v1, team and tournament byes', async () => {
      const user = await makeUser('itc');
      const r1 = await makeRobot(user.id, 1);
      const r2 = await makeRobot(user.id, 2);
      const r3 = await makeRobot(user.id, 3);
      const r4 = await makeRobot(user.id, 4);

      const m1 = await prisma.scheduledMatch.create({
        data: { matchType: 'league_1v1', scheduledFor: new Date(), status: 'scheduled', leagueType: TIER, isByeMatch: true },
      });
      const m2 = await prisma.scheduledMatch.create({
        data: { matchType: 'league_3v3', scheduledFor: new Date(), status: 'scheduled', leagueType: TIER, isByeMatch: true },
      });
      const tour = await prisma.tournament.create({
        data: { name: `T_itc_${Date.now()}`, tournamentType: 'single_elimination', status: 'active', totalParticipants: 16, currentRound: 1, maxRounds: 4, participantType: 'robot' },
      });
      const tm = await prisma.scheduledTournamentMatch.create({
        data: { tournamentId: tour.id, round: 1, matchNumber: 1, participant1Id: r4.id, participantType: 'robot', status: 'pending', isByeMatch: true },
      });

      cleanup.push({ userIds: [user.id], robotIds: [r1.id, r2.id, r3.id, r4.id], matchIds: [m1.id, m2.id], tournamentIds: [tour.id] });

      const league = await resolveByeEvent({
        mode: 'league_1v1',
        context: { mode: 'league_1v1', tier: TIER },
        claim: { source: 'scheduled_match', scheduledMatchId: m1.id },
        participants: [r1],
        stableUserId: user.id,
        battle: { battleType: 'league_1v1', leagueType: TIER, winnerId: r1.id, byeMessage: 'w' },
        standingEntity: { entityType: 'robot', entityId: r1.id },
        newEloByRobotId: { [r1.id]: r1.elo + 8 },
        cycleNumber: 1,
      });

      const team = await resolveByeEvent({
        mode: 'league_3v3',
        context: { mode: 'league_3v3', tier: TIER },
        claim: { source: 'scheduled_match', scheduledMatchId: m2.id },
        participants: [r1, r2, r3],
        stableUserId: user.id,
        battle: { battleType: 'league_3v3', leagueType: TIER, winnerId: r1.id, winningSide: 1, byeMessage: 'w' },
        cycleNumber: 1,
      });

      const tournamentBye = await resolveByeEvent({
        mode: 'tournament_1v1',
        context: { mode: 'tournament_1v1', totalParticipants: 16, currentRound: 1, maxRounds: 4 },
        claim: { source: 'tournament_match', tournamentMatchId: tm.id },
        participants: [r4],
        stableUserId: user.id,
        battle: { battleType: 'tournament_1v1', leagueType: 'tournament', tournamentId: tour.id, tournamentRound: 1, winnerId: r4.id, byeMessage: 'w' },
        cycleNumber: 1,
      });

      const rows = await prisma.battle.findMany({
        where: { id: { in: [league.battleId!, team.battleId!, tournamentBye.battleId!] } },
        include: { summary: true, participants: true },
      });
      expect(rows).toHaveLength(3);

      // Compare the *set* of non-null column names rather than a hand-written
      // list, so a nullable column added later cannot silently drift the shapes.
      const declaredExceptions = new Set([
        'leagueInstanceId',
        'tournamentId',
        'tournamentRound',
        'winningSide',
      ]);
      const shapeOf = (b: Record<string, unknown>) =>
        Object.entries(b)
          .filter(([k, v]) => v !== null && !declaredExceptions.has(k))
          .map(([k]) => k)
          .sort()
          .join(',');

      const shapes = rows.map((r) => shapeOf(r as unknown as Record<string, unknown>));
      expect(new Set(shapes).size).toBe(1);

      // The team mode is in this test deliberately: comparing only 1v1 against
      // tournament would have sailed past the real inconsistency, because the
      // team bye was the one carrying real combat data before Spec #49.
      for (const r of rows) {
        expect(r.summary).not.toBeNull();
        expect(r.summary!.hasData).toBe(false);
        expect(r.summary!.totalEvents).toBe(0);
        expect((r.battleLog as { isByeMatch?: boolean }).isByeMatch).toBe(true);
      }
    });
  });

  // ── IT-D ──
  describe('IT-D: a Thin_Instance creates one bye row per eligible robot', () => {
    it('should persist one scheduled row and one participant row per robot', async () => {
      const user = await makeUser('itd');
      const robots = [];
      for (let i = 0; i < 4; i++) robots.push(await makeRobot(user.id, i));

      const created = await createThinInstanceByes({
        matchType: $Enums.MatchType.koth,
        tier: TIER,
        leagueInstanceId: `${TIER}_itd`,
        robots,
        scheduledFor: new Date(),
      });
      expect(created).toBe(4);

      const rows = await prisma.scheduledMatch.findMany({
        where: { matchType: 'koth', leagueInstanceId: `${TIER}_itd`, isByeMatch: true },
        include: { participants: true },
      });
      cleanup.push({ userIds: [user.id], robotIds: robots.map((r) => r.id), matchIds: rows.map((r) => r.id), tournamentIds: [] });

      expect(rows).toHaveLength(4);
      for (const row of rows) {
        expect(row.participants).toHaveLength(1);
        expect(row.leagueType).toBe(TIER);
      }
      const scheduledRobotIds = rows.flatMap((r) => r.participants.map((p) => p.participantId)).sort();
      expect(scheduledRobotIds).toEqual(robots.map((r) => r.id).sort());
    });

    it('should plan nothing for an empty eligible pool', () => {
      expect(
        planThinInstanceByes({
          matchType: $Enums.MatchType.grand_melee,
          tier: TIER,
          leagueInstanceId: `${TIER}_empty`,
          robots: [],
          scheduledFor: new Date(),
        }),
      ).toEqual([]);
    });
  });

  // ── IT-E (scoping half) ──
  describe('IT-E: auto-repair exempts no mode, and a bye holds its slot', () => {
    it('should include a byed robot in repair scoping for a unified mode', async () => {
      const user = await makeUser('ite1');
      const robot = await makeRobot(user.id, 1);
      const match = await prisma.scheduledMatch.create({
        data: { matchType: 'koth', scheduledFor: new Date(), status: 'scheduled', leagueType: TIER, isByeMatch: true, participants: { create: [{ participantType: 'robot', participantId: robot.id, slot: 1 }] } },
      });
      cleanup.push({ userIds: [user.id], robotIds: [robot.id], matchIds: [match.id], tournamentIds: [] });

      const ids = await resolveRobotIdsForEvent('koth');
      expect(ids).toContain(robot.id);
    });

    it('should include a bracket bye participant in repair scoping — the exemption Spec #49 removed', async () => {
      const user = await makeUser('ite2');
      const robot = await makeRobot(user.id, 1);
      const tour = await prisma.tournament.create({
        data: { name: `T_ite_${Date.now()}`, tournamentType: 'single_elimination', status: 'active', totalParticipants: 8, currentRound: 1, maxRounds: 3, participantType: 'robot' },
      });
      await prisma.scheduledTournamentMatch.create({
        data: { tournamentId: tour.id, round: 1, matchNumber: 1, participant1Id: robot.id, participantType: 'robot', status: 'scheduled', isByeMatch: true },
      });
      cleanup.push({ userIds: [user.id], robotIds: [robot.id], matchIds: [], tournamentIds: [tour.id] });

      const ids = await resolveRobotIdsForEvent('tournament_1v1');
      // Before Spec #49 the tournament arm filtered `isByeMatch: false`, so this
      // robot was exempt from auto-repair purely because of which mode its bye
      // happened in.
      expect(ids).toContain(robot.id);
    });

    it('should count an unresolved bye toward the robot occupied event slots', async () => {
      const user = await makeUser('ite3');
      const robot = await makeRobot(user.id, 1);
      const match = await prisma.scheduledMatch.create({
        data: { matchType: 'koth', scheduledFor: new Date(), status: 'scheduled', leagueType: TIER, isByeMatch: true, participants: { create: [{ participantType: 'robot', participantId: robot.id, slot: 1 }] } },
      });
      cleanup.push({ userIds: [user.id], robotIds: [robot.id], matchIds: [match.id], tournamentIds: [] });

      const outstanding = await resolveOutstandingEventsForRobot(robot.id);
      // Slot accounting has no bye-specific branch — a bye row holds its slot
      // simply by being a queued match.
      expect(outstanding).toContain('koth');
    });
  });

  // ── IT-G ──
  describe('IT-G: the Placement_Mode summary counts a bye as a bye', () => {
    it('should increment byeMatches and not successfulMatches', async () => {
      const user = await makeUser('itg');
      const robot = await makeRobot(user.id, 1);
      const match = await prisma.scheduledMatch.create({
        data: { matchType: 'koth', scheduledFor: new Date(), status: 'scheduled', leagueType: TIER, isByeMatch: true, participants: { create: [{ participantType: 'robot', participantId: robot.id, slot: 1 }] } },
      });
      cleanup.push({ userIds: [user.id], robotIds: [robot.id], matchIds: [match.id], tournamentIds: [] });

      const { executeScheduledKothBattles } = await import('../../src/services/koth/kothBattleOrchestrator');
      const summary = await executeScheduledKothBattles();

      expect(summary.byeMatches).toBeGreaterThanOrEqual(1);
      // The three counters partition totalMatches, so successfulMatches keeps
      // meaning "combat was simulated" — which is what an operator reads.
      expect(summary.successfulMatches + summary.byeMatches + summary.failedMatches).toBe(
        summary.totalMatches,
      );

      // The robot took no damage from the bye.
      const after = await prisma.robot.findUnique({ where: { id: robot.id } });
      expect(after!.currentHP).toBe(55);
    });
  });
});

// ── IT-F ──
describe('IT-F: bracket advancement, the both-slots-empty case, and the shared helper (Spec #49)', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  it('should advance the bracket exactly as before AND pay the round loss reward', async () => {
    const { completeByeMatch } = await import('../../src/services/tournament/tournamentService');
    const { calculateTournamentParticipationReward } = await import('../../src/utils/tournamentRewards');

    const user = await makeUser('itf1');
    const robot = await makeRobot(user.id, 1);
    const tour = await prisma.tournament.create({
      data: { name: `T_itf_${Date.now()}`, tournamentType: 'single_elimination', status: 'active', totalParticipants: 16, currentRound: 1, maxRounds: 4, participantType: 'robot' },
    });
    const match = await prisma.scheduledTournamentMatch.create({
      data: { tournamentId: tour.id, round: 1, matchNumber: 1, participant1Id: robot.id, participantType: 'robot', status: 'pending', isByeMatch: true },
    });
    cleanup.push({ userIds: [user.id], robotIds: [robot.id], matchIds: [], tournamentIds: [tour.id] });

    const currencyBefore = (await prisma.user.findUnique({ where: { id: user.id } }))!.currency;

    const paid = await completeByeMatch(match, robot.id);
    expect(paid).toBe(true);

    // Bracket advancement is unchanged: same three columns, same values.
    const after = await prisma.scheduledTournamentMatch.findUnique({ where: { id: match.id } });
    expect(after!.status).toBe('completed');
    expect(after!.winnerId).toBe(robot.id);
    expect(after!.completedAt).not.toBeNull();
    expect(after!.isByeMatch).toBe(true);
    // The claim token: battleId is now set, which is what makes a second
    // resolution pay nothing.
    expect(after!.battleId).not.toBeNull();

    // And the bye now pays what a loss pays for that round.
    const expected = calculateTournamentParticipationReward(16, 1, 4);
    const currencyAfter = (await prisma.user.findUnique({ where: { id: user.id } }))!.currency;
    expect(currencyAfter - currencyBefore).toBe(expected);
  });

  it('should advance but pay nothing when both bracket slots are empty', async () => {
    const { completeByeMatch } = await import('../../src/services/tournament/tournamentService');

    const tour = await prisma.tournament.create({
      data: { name: `T_itf2_${Date.now()}`, tournamentType: 'single_elimination', status: 'active', totalParticipants: 16, currentRound: 2, maxRounds: 4, participantType: 'robot' },
    });
    const match = await prisma.scheduledTournamentMatch.create({
      data: { tournamentId: tour.id, round: 2, matchNumber: 1, participantType: 'robot', status: 'pending', isByeMatch: false },
    });
    cleanup.push({ userIds: [], robotIds: [], matchIds: [], tournamentIds: [tour.id] });

    // Bracket housekeeping, not a Bye_Event — nobody holds a subscription behind
    // it, so there is nothing to pay.
    const paid = await completeByeMatch(match, null);
    expect(paid).toBe(false);

    const after = await prisma.scheduledTournamentMatch.findUnique({ where: { id: match.id } });
    expect(after!.status).toBe('completed');
    expect(after!.winnerId).toBeNull();
    expect(after!.battleId).toBeNull();
  });

  it('should pay a bracket bye only once even if completed twice', async () => {
    const { completeByeMatch } = await import('../../src/services/tournament/tournamentService');

    const user = await makeUser('itf3');
    const robot = await makeRobot(user.id, 1);
    const tour = await prisma.tournament.create({
      data: { name: `T_itf3_${Date.now()}`, tournamentType: 'single_elimination', status: 'active', totalParticipants: 8, currentRound: 1, maxRounds: 3, participantType: 'robot' },
    });
    const match = await prisma.scheduledTournamentMatch.create({
      data: { tournamentId: tour.id, round: 1, matchNumber: 1, participant1Id: robot.id, participantType: 'robot', status: 'pending', isByeMatch: true },
    });
    cleanup.push({ userIds: [user.id], robotIds: [robot.id], matchIds: [], tournamentIds: [tour.id] });

    await completeByeMatch(match, robot.id);
    const afterFirst = (await prisma.user.findUnique({ where: { id: user.id } }))!.currency;

    // The admin bulk-cycle path and the cron path both call this helper, so a
    // double completion must be safe.
    const refetched = await prisma.scheduledTournamentMatch.findUnique({ where: { id: match.id } });
    await completeByeMatch(refetched!, robot.id);
    const afterSecond = (await prisma.user.findUnique({ where: { id: user.id } }))!.currency;

    expect(afterSecond).toBe(afterFirst);
  });
});
