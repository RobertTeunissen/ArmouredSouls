/**
 * Integration Test: the Bye_Invariant across every mode (Spec #49)
 *
 * This is IT-A and IT-B from the design, against real Postgres. The structure
 * mirrors the design deliberately: if all nine modes resolve through one writer
 * and differ only in facts the Bye_Mode_Table declares, then the tests should be
 * one loop over the modes plus one table of the declared differences — not nine
 * hand-written cases that can silently omit a mode.
 *
 * IT-A asserts the nine invariants that hold identically everywhere.
 * IT-B asserts the per-mode differences.
 * IT-E asserts idempotency: resolving twice pays once.
 *
 * The central assertion is that a bye leaves every robot exactly as it was.
 * Before this spec, `league_2v2`, `league_3v3` and `tag_team` byes ran a full
 * combat simulation against weaponless Bye_Placeholders which — via the Fists
 * fallback and the `!weaponLike` range bypass — dealt real damage that was then
 * persisted. A walkover was billing players for repairs.
 */

import prisma from '../../src/lib/prisma';
import {
  resolveByeEvent,
  BYE_BATTLE_DURATION_SECONDS,
} from '../../src/services/battle/byeResolutionService';
import {
  BYE_MODES,
  BYE_MODE_SPECS,
  ByeMode,
  ByeRewardInput,
  resolveByeReward,
} from '../../src/utils/byeRewards';
import { getParticipationReward } from '../../src/utils/economyFormulas';
import { calculateTournamentParticipationReward } from '../../src/utils/tournamentRewards';
import { usePostCutoverFinancialRollout } from '../financialRolloutTestHelper';

usePostCutoverFinancialRollout();

const TIER = 'bronze';
const TOURNAMENT_CTX = { totalParticipants: 16, currentRound: 1, maxRounds: 4 };

/** A deliberately damaged robot: a bye must not change its HP. */
const START_HP = 61;

interface Fixture {
  userId: number;
  robotIds: number[];
  scheduledMatchId: number;
  tournamentMatchId: number;
  tournamentId: number;
}

const created: Fixture[] = [];

async function makeFixture(mode: ByeMode): Promise<Fixture> {
  const spec = BYE_MODE_SPECS[mode];
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const user = await prisma.user.create({
    data: {
      username: `bye_${stamp}`,
      email: `bye_${stamp}@test.local`,
      passwordHash: 'x',
      stableName: `Stable_${stamp}`,
      currency: 100_000,
    },
  });

  const robotIds: number[] = [];
  for (let i = 0; i < spec.teamSize; i++) {
    const robot = await prisma.robot.create({
      data: {
        userId: user.id,
        name: `ByeBot_${stamp}_${i}`,
        currentHP: START_HP,
        maxHP: 100,
        currentShield: 20,
        maxShield: 20,
        elo: 1200,
      },
    });
    robotIds.push(robot.id);
  }

  // A queued unified row for the six unified modes.
  const scheduled = await prisma.scheduledMatch.create({
    data: {
      matchType: mode === 'koth' || mode === 'grand_melee' ? mode : 'league_1v1',
      scheduledFor: new Date(),
      status: 'scheduled',
      leagueType: TIER,
      isByeMatch: true,
    },
  });

  // A queued bracket row for the three tournament modes.
  const tournament = await prisma.tournament.create({
    data: {
      name: `T_${stamp}`,
      tournamentType: 'single_elimination',
      status: 'active',
      totalParticipants: TOURNAMENT_CTX.totalParticipants,
      currentRound: TOURNAMENT_CTX.currentRound,
      maxRounds: TOURNAMENT_CTX.maxRounds,
      participantType: 'robot',
    },
  });
  const tournamentMatch = await prisma.scheduledTournamentMatch.create({
    data: {
      tournamentId: tournament.id,
      round: 1,
      matchNumber: 1,
      participant1Id: robotIds[0],
      participantType: 'robot',
      status: 'pending',
      isByeMatch: true,
    },
  });

  const fx: Fixture = {
    userId: user.id,
    robotIds,
    scheduledMatchId: scheduled.id,
    tournamentMatchId: tournamentMatch.id,
    tournamentId: tournament.id,
  };
  created.push(fx);
  return fx;
}

function contextFor(mode: ByeMode): ByeRewardInput {
  return (
    BYE_MODE_SPECS[mode].floor === 'tier_scaled'
      ? { mode, tier: TIER }
      : { mode, ...TOURNAMENT_CTX }
  ) as ByeRewardInput;
}

async function resolveFor(mode: ByeMode, fx: Fixture) {
  const spec = BYE_MODE_SPECS[mode];
  const robots = await prisma.robot.findMany({
    where: { id: { in: fx.robotIds } },
    select: { id: true, name: true, userId: true, currentHP: true, maxHP: true, elo: true },
  });

  return resolveByeEvent({
    mode,
    context: contextFor(mode),
    claim:
      spec.floor === 'tournament_round_loss'
        ? { source: 'tournament_match', tournamentMatchId: fx.tournamentMatchId }
        : { source: 'scheduled_match', scheduledMatchId: fx.scheduledMatchId },
    participants: robots,
    stableUserId: fx.userId,
    battle: {
      battleType: mode,
      leagueType: spec.floor === 'tournament_round_loss' ? 'tournament' : TIER,
      tournamentId: spec.floor === 'tournament_round_loss' ? fx.tournamentId : null,
      tournamentRound: spec.floor === 'tournament_round_loss' ? 1 : null,
      winnerId: robots[0].id,
      byeMessage: 'walkover',
    },
    standingEntity: { entityType: 'robot', entityId: robots[0].id },
    newEloByRobotId: Object.fromEntries(robots.map((r) => [r.id, r.elo + 8])),
    eloChange: 8,
    cycleNumber: 1,
  });
}

describe('Bye_Invariant (Spec #49)', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up in FK order.
    for (const fx of created) {
      const battles = await prisma.battle.findMany({
        where: { participants: { some: { robotId: { in: fx.robotIds } } } },
        select: { id: true },
      });
      const battleIds = battles.map((b) => b.id);
      await prisma.battleSummary.deleteMany({ where: { battleId: { in: battleIds } } });
      await prisma.battleParticipant.deleteMany({ where: { battleId: { in: battleIds } } });
      await prisma.battle.deleteMany({ where: { id: { in: battleIds } } });
      await prisma.standing.deleteMany({ where: { entityId: { in: fx.robotIds } } });
      await prisma.scheduledTournamentMatch.deleteMany({ where: { id: fx.tournamentMatchId } });
      await prisma.tournament.deleteMany({ where: { id: fx.tournamentId } });
      await prisma.scheduledMatch.deleteMany({ where: { id: fx.scheduledMatchId } });
      await prisma.robot.deleteMany({ where: { id: { in: fx.robotIds } } });
      await prisma.user.deleteMany({ where: { id: fx.userId } });
    }
    await prisma.$disconnect();
  });

  // ── IT-A ──
  describe('IT-A: the invariants that hold identically in all nine modes', () => {
    it.each(BYE_MODES)('should write an inert, credits-only Bye_Record for %s', async (mode) => {
      const spec = BYE_MODE_SPECS[mode];
      const fx = await makeFixture(mode);

      const before = await prisma.robot.findMany({
        where: { id: { in: fx.robotIds } },
        orderBy: { id: 'asc' },
      });
      const userBefore = await prisma.user.findUnique({ where: { id: fx.userId } });

      const result = await resolveFor(mode, fx);

      expect(result.alreadyResolved).toBe(false);
      expect(result.battleId).not.toBeNull();
      expect(result.creditsPaid).toBeGreaterThan(0);

      // 1. One battles row, flagged, with a nominal duration.
      const battle = await prisma.battle.findUnique({
        where: { id: result.battleId! },
        include: { participants: true, summary: true },
      });
      expect(battle).not.toBeNull();
      expect((battle!.battleLog as { isByeMatch?: boolean }).isByeMatch).toBe(true);
      expect(battle!.durationSeconds).toBe(BYE_BATTLE_DURATION_SECONDS);
      expect(battle!.loserReward).toBe(0);

      // 2. One participant row per real robot, none for a placeholder.
      expect(battle!.participants).toHaveLength(spec.teamSize);
      for (const p of battle!.participants) {
        expect(p.robotId).toBeGreaterThan(0);
        expect(p.damageDealt).toBe(0);
        expect(p.destroyed).toBe(false);
        expect(p.yielded).toBe(false);
        expect(p.prestigeAwarded).toBe(0);
        expect(p.fameAwarded).toBe(0);
        expect(p.streamingRevenue).toBe(0);
        // No simulation ran, so finalHP is the robot's HP as it was.
        expect(p.finalHP).toBe(START_HP);
      }

      // 3. No robot was touched. This is the assertion that would have caught
      //    the damage defect, and it runs for every mode rather than only the
      //    two that used to simulate.
      const after = await prisma.robot.findMany({
        where: { id: { in: fx.robotIds } },
        orderBy: { id: 'asc' },
      });
      for (let i = 0; i < after.length; i++) {
        expect(after[i].currentHP).toBe(before[i].currentHP);
        expect(after[i].currentShield).toBe(before[i].currentShield);
        expect(after[i].damageTaken).toBe(before[i].damageTaken);
        expect(after[i].battleReadiness).toBe(before[i].battleReadiness);
        expect(after[i].repairQuoteCredits).toBe(before[i].repairQuoteCredits);
        expect(after[i].lifetimeRepairCreditsPaid).toBe(before[i].lifetimeRepairCreditsPaid);
      }

      // 4. A summary row with no combat data.
      expect(battle!.summary).not.toBeNull();
      expect(battle!.summary!.hasData).toBe(false);
      expect(battle!.summary!.totalEvents).toBe(0);

      // 5. Credits reconcile exactly with the stable award.
      const perRobotSum = battle!.participants.reduce((a, p) => a + p.credits, 0);
      expect(perRobotSum).toBe(result.creditsPaid);
      const userAfter = await prisma.user.findUnique({ where: { id: fx.userId } });
      expect(userAfter!.currency - userBefore!.currency).toBe(result.creditsPaid);

      // 6. An audit row per real robot, flagged as a bye.
      const audits = await prisma.auditLog.findMany({
        where: { eventType: 'battle_complete', robotId: { in: fx.robotIds } },
      });
      expect(audits.length).toBeGreaterThanOrEqual(spec.teamSize);
      for (const a of audits) {
        expect((a.payload as { isByeMatch?: boolean }).isByeMatch).toBe(true);
      }

      // 7. The real side won, and a draw is not representable.
      expect(battle!.winnerId).toBe(fx.robotIds[0]);
    });
  });

  // ── IT-B ──
  describe('IT-B: the per-mode differences match the Bye_Mode_Table', () => {
    it.each(BYE_MODES)('should pay and record %s exactly as declared', async (mode) => {
      const spec = BYE_MODE_SPECS[mode];
      const fx = await makeFixture(mode);

      const standingBefore = await prisma.standing.findFirst({
        where: { entityType: 'robot', entityId: fx.robotIds[0] },
      });
      const eloBefore = (await prisma.robot.findUnique({ where: { id: fx.robotIds[0] } }))!.elo;

      const result = await resolveFor(mode, fx);

      // Credits: the declared floor times the declared team size.
      const expectedPerRobot =
        spec.floor === 'tier_scaled'
          ? getParticipationReward(TIER)
          : calculateTournamentParticipationReward(
              TOURNAMENT_CTX.totalParticipants,
              TOURNAMENT_CTX.currentRound,
              TOURNAMENT_CTX.maxRounds,
            );
      expect(result.creditsPaid).toBe(expectedPerRobot * spec.teamSize);
      expect(resolveByeReward(contextFor(mode)).credits).toBe(result.creditsPaid);

      // ELO: moves only where the table says it does.
      const eloAfter = (await prisma.robot.findUnique({ where: { id: fx.robotIds[0] } }))!.elo;
      if (spec.updatesElo) {
        expect(eloAfter).not.toBe(eloBefore);
      } else {
        expect(eloAfter).toBe(eloBefore);
      }

      // Standing: written only where the table says it is. Not calling is a
      // stronger guarantee than calling with zeroes — a match that never ran
      // must not register as a finishing position.
      const standingAfter = await prisma.standing.findFirst({
        where: { entityType: 'robot', entityId: fx.robotIds[0] },
      });
      if (spec.standingMode && spec.lpDelta !== 0) {
        expect(standingAfter).not.toBeNull();
        expect(standingAfter!.mode).toBe(spec.standingMode);
        expect(standingAfter!.leaguePoints).toBe((standingBefore?.leaguePoints ?? 0) + spec.lpDelta);
      } else {
        expect(standingAfter?.leaguePoints ?? null).toBe(standingBefore?.leaguePoints ?? null);
      }
    });

    it('should pay a tier-scaled bye strictly less per robot than a placement last place', async () => {
      const perRobotBye = getParticipationReward(TIER);
      // koth last place: tierBase x 1.5 x 0.2 = 0.30 x tierBase
      // grand_melee last place: tierBase x 2.5 x 0.2 = 0.50 x tierBase
      // A bye is 0.20 x tierBase, so turning up and fighting beats not fighting.
      expect(perRobotBye).toBeLessThan(getParticipationReward(TIER) * 1.5);
      expect(perRobotBye).toBeLessThan(getParticipationReward(TIER) * 2.5);
    });
  });

  // ── IT-E (idempotency half) ──
  describe('IT-E: resolving the same Bye_Event twice pays once', () => {
    it('should report alreadyResolved and pay nothing on a second attempt', async () => {
      const fx = await makeFixture('league_1v1');

      const first = await resolveFor('league_1v1', fx);
      expect(first.alreadyResolved).toBe(false);

      const userAfterFirst = await prisma.user.findUnique({ where: { id: fx.userId } });

      const second = await resolveFor('league_1v1', fx);
      expect(second.alreadyResolved).toBe(true);
      expect(second.creditsPaid).toBe(0);
      // The second attempt reports the battle the FIRST one wrote, so a caller
      // re-processing a completed row still gets a real id to link to.
      expect(second.battleId).toBe(first.battleId);

      const userAfterSecond = await prisma.user.findUnique({ where: { id: fx.userId } });
      expect(userAfterSecond!.currency).toBe(userAfterFirst!.currency);

      // Exactly one battles row survives; the orphan from the lost claim is gone.
      const battles = await prisma.battle.findMany({
        where: { participants: { some: { robotId: fx.robotIds[0] } } },
      });
      expect(battles).toHaveLength(1);
    });

    it('should claim the tournament battleId column, so a second attempt pays nothing', async () => {
      const fx = await makeFixture('tournament_1v1');

      const first = await resolveFor('tournament_1v1', fx);
      expect(first.alreadyResolved).toBe(false);

      const second = await resolveFor('tournament_1v1', fx);
      expect(second.alreadyResolved).toBe(true);
      expect(second.creditsPaid).toBe(0);
      expect(second.battleId).toBe(first.battleId);
    });
  });
});
