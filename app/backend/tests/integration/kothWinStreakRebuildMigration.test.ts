/**
 * KotH win streak rebuild migration (Hall of Records redesign, Nov 2026).
 *
 * `awardKothPoints` used to leave the win streak running through every finish
 * other than 1st, so a KotH robot's best streak always equalled its total wins.
 * The migration rebuilds `best_win_streak` and `current_win_streak` from the
 * season's KotH battles.
 *
 * Real database. The shipped SQL is read from the migration file and run twice
 * inside a rolled-back transaction, so the test proves the exact statement
 * deploy runs without changing the shared test database. The robots are
 * created outside the transaction (the helper uses the global client) and
 * deleted afterwards; battles and standings live inside it.
 */
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../../src/lib/prisma';
import type { Prisma } from '../../generated/prisma';
import { createTestRobot, createTestUser } from '../testHelpers';

const MIGRATION_SQL = fs.readFileSync(
  path.join(__dirname, '../../prisma/migrations/20261108120000_rebuild_koth_win_streaks/migration.sql'),
  'utf8',
);

/** The migration's statements in file order (comment lines stripped first). */
const STATEMENTS = MIGRATION_SQL.split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

class Rollback extends Error {}

/** One KotH appearance: a placement, or null for a bye (no placement written). */
type Finish = number | null | 'forfeit';

let userId: number;
let robotIds: number[] = [];

beforeAll(async () => {
  const user = await createTestUser();
  userId = user.id;
  robotIds = [
    (await createTestRobot(userId)).id,
    (await createTestRobot(userId)).id,
    (await createTestRobot(userId)).id,
  ];
});

afterAll(async () => {
  await prisma.robot.deleteMany({ where: { id: { in: robotIds } } });
  await prisma.user.delete({ where: { id: userId } });
});

/** Insert one KotH battle per finish, oldest first, for one robot. */
async function playKoth(tx: Prisma.TransactionClient, robotId: number, finishes: Finish[], start: Date): Promise<void> {
  for (const [index, finish] of finishes.entries()) {
    await tx.battle.create({
      data: {
        battleType: 'koth',
        leagueType: 'bronze',
        durationSeconds: 60,
        createdAt: new Date(start.getTime() + index * 60_000),
        participants: {
          create: [{
            robotId,
            team: 1,
            credits: 0,
            eloBefore: 1200,
            eloAfter: 1200,
            damageDealt: 0,
            finalHP: 10,
            placement: finish === null ? null : finish === 'forfeit' ? 6 : finish,
            forfeited: finish === 'forfeit',
          }],
        },
      },
    });
  }
}

describe('KotH win streak rebuild migration', () => {
  it('ships exactly one UPDATE of standings and no schema change', () => {
    expect(STATEMENTS).toHaveLength(1);
    expect(STATEMENTS[0]).toMatch(/UPDATE "standings" s/);
    expect(MIGRATION_SQL).not.toMatch(/\b(ALTER|CREATE|DROP)\b/i);
  });

  it('rebuilds best and current streaks from the battles, leaves other columns alone and is idempotent', async () => {
    const [runner, broken, byes] = robotIds;
    await expect(
      prisma.$transaction(async (tx) => {
        const start = new Date('2026-01-01T00:00:00Z');
        // Wins 1,1,1 then a 3rd place, then 1,1 still running: best 3, current 2.
        await playKoth(tx, runner, [1, 1, 1, 3, 1, 1], start);
        // A forfeit ends the streak even when the robot is listed first; ends on a loss.
        await playKoth(tx, broken, [1, 1, 'forfeit', 1, 2], start);
        // Byes (no placement) never touched the standing and do not break a streak.
        await playKoth(tx, byes, [1, null, 1], start);

        // Stored values as the old code left them: best = current = wins.
        for (const [robotId, wins] of [[runner, 5], [broken, 3], [byes, 2]] as const) {
          await tx.standing.create({
            data: {
              entityType: 'robot', entityId: robotId, mode: 'koth', leaguePoints: 77,
              wins, totalMatches: 6, currentWinStreak: wins, bestWinStreak: wins,
            },
          });
        }
        // A 1v1 standing is never touched.
        await tx.standing.create({
          data: { entityType: 'robot', entityId: runner, mode: 'league_1v1', wins: 9, currentWinStreak: 9, bestWinStreak: 9 },
        });

        const streaks = async () => new Map(
          (await tx.standing.findMany({
            where: { entityId: { in: robotIds } },
            select: { entityId: true, mode: true, bestWinStreak: true, currentWinStreak: true, wins: true, leaguePoints: true },
          })).map((s) => [`${s.mode}:${s.entityId}`, s]),
        );

        for (const statement of STATEMENTS) await tx.$executeRawUnsafe(statement);
        const after = await streaks();

        expect(after.get(`koth:${runner}`)).toMatchObject({ bestWinStreak: 3, currentWinStreak: 2, wins: 5, leaguePoints: 77 });
        expect(after.get(`koth:${broken}`)).toMatchObject({ bestWinStreak: 2, currentWinStreak: 0, wins: 3 });
        expect(after.get(`koth:${byes}`)).toMatchObject({ bestWinStreak: 2, currentWinStreak: 2 });
        expect(after.get(`league_1v1:${runner}`)).toMatchObject({ bestWinStreak: 9, currentWinStreak: 9 });

        for (const statement of STATEMENTS) await tx.$executeRawUnsafe(statement);
        expect(await streaks()).toEqual(after);

        throw new Rollback();
      }, { timeout: 30_000 }),
    ).rejects.toBeInstanceOf(Rollback);
  });
});
