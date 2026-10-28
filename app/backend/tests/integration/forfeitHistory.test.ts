/**
 * T28 — the battle history classifier (design §2, §9.3 backend).
 *
 * `isForfeit` and `forfeitedRobotIds` come from `battle_participants.forfeited`
 * plus the `tournament_matches.status = 'forfeit'` lookup, never from the
 * best-effort summary or the ephemeral `battle_log`. The battle logs written
 * here deliberately carry no forfeit marker so the test cannot pass by reading
 * them.
 */
import prisma from '../../src/lib/prisma';
import { getBattleLog, getMatchHistory } from '../../src/services/match/matchHistoryService';
import { battleLogFixture } from '../helpers/battleLogFixture';

const RUN = `fh${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const userIds: number[] = [];
const robotIds: number[] = [];
const battleIds: number[] = [];
const tournamentIds: number[] = [];
let counter = 0;
const next = (): number => ++counter;

async function stableWithRobot(): Promise<{ userId: number; robotId: number }> {
  const n = next();
  const user = await prisma.user.create({
    data: { username: `${RUN}_u${n}`, passwordHash: 'x', stableName: `${RUN}_s${n}` },
  });
  userIds.push(user.id);
  const robot = await prisma.robot.create({
    data: { userId: user.id, name: `${RUN}_r${n}`, currentHP: 100, maxHP: 100, currentShield: 20, maxShield: 20 },
  });
  robotIds.push(robot.id);
  return { userId: user.id, robotId: robot.id };
}

interface Row {
  robotId: number;
  team: number;
  forfeited: boolean;
  placement?: number;
}

async function battleWith(battleType: string, winnerId: number | null, rows: Row[], tournamentId?: number): Promise<number> {
  const battle = await prisma.battle.create({
    data: {
      battleType,
      leagueType: battleType.startsWith('tournament') ? 'tournament' : 'bronze',
      winnerId,
      durationSeconds: 15,
      winnerReward: 0,
      loserReward: 0,
      tournamentId: tournamentId ?? null,
      // No forfeit marker: the classifier must not depend on battle_log.
      ...battleLogFixture({ events: [] }),
      participants: {
        create: rows.map((r) => ({
          robotId: r.robotId,
          team: r.team,
          credits: 0,
          eloBefore: 1200,
          eloAfter: 1200,
          damageDealt: 0,
          finalHP: 100,
          forfeited: r.forfeited,
          placement: r.placement ?? null,
        })),
      },
    },
  });
  battleIds.push(battle.id);
  return battle.id;
}

async function historyEntry(userId: number, battleId: number) {
  const history = await getMatchHistory({ page: 1, perPage: 50, userId });
  const entry = history.data.find((b) => (b as { id: number }).id === battleId);
  expect(entry).toBeDefined();
  return entry as unknown as { isForfeit: boolean; forfeitedRobotIds: number[] };
}

async function logEntry(battleId: number) {
  const log = await getBattleLog(battleId);
  expect(log).not.toBeNull();
  return log as unknown as { isForfeit: boolean; forfeitedRobotIds: number[] };
}

afterAll(async () => {
  await prisma.scheduledTournamentMatch.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.battle.deleteMany({ where: { id: { in: battleIds } } });
  await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
  await prisma.robot.deleteMany({ where: { id: { in: robotIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

describe('T28: forfeit classification in history and battle detail', () => {
  it('should mark a two-sided forfeit and name the forfeiter', async () => {
    const forfeiter = await stableWithRobot();
    const winner = await stableWithRobot();
    const battleId = await battleWith('league_1v1', winner.robotId, [
      { robotId: forfeiter.robotId, team: 1, forfeited: true },
      { robotId: winner.robotId, team: 2, forfeited: false },
    ]);

    for (const entry of [await historyEntry(winner.userId, battleId), await logEntry(battleId)]) {
      expect(entry.isForfeit).toBe(true);
      expect(entry.forfeitedRobotIds).toEqual([forfeiter.robotId]);
    }
  });

  it('should not mark a fought battle', async () => {
    const a = await stableWithRobot();
    const b = await stableWithRobot();
    const battleId = await battleWith('league_1v1', a.robotId, [
      { robotId: a.robotId, team: 1, forfeited: false },
      { robotId: b.robotId, team: 2, forfeited: false },
    ]);

    for (const entry of [await historyEntry(a.userId, battleId), await logEntry(battleId)]) {
      expect(entry.isForfeit).toBe(false);
      expect(entry.forfeitedRobotIds).toEqual([]);
    }
  });

  it('should keep a fought KotH battle with one forfeiter a fought battle, tagging that robot', async () => {
    const field = [await stableWithRobot(), await stableWithRobot(), await stableWithRobot()];
    const forfeiter = field[2];
    const battleId = await battleWith('koth', field[0].robotId, [
      { robotId: field[0].robotId, team: 1, forfeited: false, placement: 1 },
      { robotId: field[1].robotId, team: 1, forfeited: false, placement: 2 },
      { robotId: forfeiter.robotId, team: 1, forfeited: true, placement: 3 },
    ]);

    for (const entry of [await historyEntry(forfeiter.userId, battleId), await logEntry(battleId)]) {
      expect(entry.isForfeit).toBe(false);
      expect(entry.forfeitedRobotIds).toEqual([forfeiter.robotId]);
    }
  });

  it('should mark a placement battle in which everyone forfeited', async () => {
    const field = [await stableWithRobot(), await stableWithRobot()];
    const battleId = await battleWith('grand_melee', null, field.map((f, i) => ({
      robotId: f.robotId, team: 1, forfeited: true, placement: i + 1,
    })));

    for (const entry of [await historyEntry(field[0].userId, battleId), await logEntry(battleId)]) {
      expect(entry.isForfeit).toBe(true);
      expect(entry.forfeitedRobotIds.sort()).toEqual(field.map((f) => f.robotId).sort());
    }
  });

  it('should mark a tournament forfeit whose forfeiting side wrote no participant rows', async () => {
    const winner = await stableWithRobot();
    const tournament = await prisma.tournament.create({
      data: { name: `${RUN} T28`, tournamentType: 'single_elimination', participantType: 'robot', status: 'active', currentRound: 1, maxRounds: 1, totalParticipants: 2 },
    });
    tournamentIds.push(tournament.id);
    const battleId = await battleWith('tournament_1v1', winner.robotId, [
      { robotId: winner.robotId, team: 1, forfeited: false },
    ], tournament.id);
    await prisma.scheduledTournamentMatch.create({
      data: {
        tournamentId: tournament.id,
        round: 1,
        matchNumber: 1,
        participantType: 'robot',
        participant1Id: winner.robotId,
        participant2Id: null,
        winnerId: winner.robotId,
        status: 'forfeit',
        battleId,
      },
    });

    for (const entry of [await historyEntry(winner.userId, battleId), await logEntry(battleId)]) {
      expect(entry.isForfeit).toBe(true);
      expect(entry.forfeitedRobotIds).toEqual([]);
    }
  });
});
