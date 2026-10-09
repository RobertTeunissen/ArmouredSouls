/**
 * Spec #55 tasks 1.1 and 1.3 — Stable_Type backfill and invariant I1 (R1.1–R1.5).
 *
 * Real database.
 * - The migration's backfill statements turn every `is_generated = true` user
 *   into `generated` and leave everyone else `human`; archive subject types
 *   follow `is_generated_subject`. The statements are read from the migration
 *   file itself and run inside a rolled-back transaction, so the test proves the
 *   shipped SQL without changing the shared database.
 * - Every non-Activation creation path writes a row that satisfies I1:
 *   registration (`createUser`), `generateBattleReadyUsers` and the seed's
 *   `upsertUser`.
 * - The single Program_Switch row is seeded (I6).
 */
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../../src/lib/prisma';
import { createUser } from '../../src/services/auth/userService';
import { generateBattleReadyUsers } from '../../src/utils/userGeneration';
import { disconnectSeedClient, upsertUser } from '../../prisma/seed';
import { satisfiesStableTypeInvariant } from '../../src/utils/stableType';

const MIGRATION_SQL = fs.readFileSync(
  path.join(__dirname, '../../prisma/migrations/20261009000000_automaton_stables/migration.sql'),
  'utf8',
);

/** The backfill UPDATE statements of the migration, in file order (comments stripped first). */
const BACKFILL_STATEMENTS = MIGRATION_SQL.split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter((statement) => statement.startsWith('UPDATE'));

class Rollback extends Error {}

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

/** Remove users and everything that does not cascade from them (standings, teams, participants). */
async function deleteUsersCompletely(userIds: number[]): Promise<void> {
  if (userIds.length === 0) return;
  const robotIds = (await prisma.robot.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((r) => r.id);
  const teamIds = (await prisma.teamBattle.findMany({ where: { stableId: { in: userIds } }, select: { id: true } })).map((t) => t.id);
  if (robotIds.length > 0) {
    await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robotIds } } });
    await prisma.battleParticipant.deleteMany({ where: { robotId: { in: robotIds } } });
    await prisma.teamBattleMember.deleteMany({ where: { robotId: { in: robotIds } } });
  }
  if (teamIds.length > 0) {
    await prisma.standing.deleteMany({ where: { entityType: 'team', entityId: { in: teamIds } } });
  }
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('Stable_Type migration and invariant I1 (Spec #55)', () => {
  const createdUserIds: number[] = [];

  afterAll(async () => {
    await deleteUsersCompletely(createdUserIds);
    await disconnectSeedClient();
  });

  describe('migration backfill (R1.2)', () => {
    it('ships exactly three backfill statements', () => {
      expect(BACKFILL_STATEMENTS).toHaveLength(3);
    });

    it('sets generated where is_generated and leaves every other user human', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          // Simulate pre-migration rows: the new column carries its default.
          const generated = await tx.user.create({
            data: { username: `bf_gen_${suffix}`, passwordHash: 'x', isGenerated: true, stableType: 'human' },
          });
          const human = await tx.user.create({
            data: { username: `bf_hum_${suffix}`, passwordHash: 'x', isGenerated: false },
          });

          for (const statement of BACKFILL_STATEMENTS) {
            await tx.$executeRawUnsafe(statement);
          }

          const rows = await tx.user.findMany({
            where: { id: { in: [generated.id, human.id] } },
            select: { id: true, stableType: true },
          });
          expect(rows.find((r) => r.id === generated.id)?.stableType).toBe('generated');
          expect(rows.find((r) => r.id === human.id)?.stableType).toBe('human');

          // After the backfill no row in the table violates I1.
          const violations = await tx.user.count({
            where: {
              OR: [
                { isGenerated: true, stableType: { not: 'generated' } },
                { isGenerated: false, stableType: 'generated' },
              ],
            },
          });
          expect(violations).toBe(0);
          throw new Rollback();
        }),
      ).rejects.toBeInstanceOf(Rollback);
    });

    it('backfills archive subject types from is_generated_subject', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          const seasonNumber = 900_000 + Math.floor(Math.random() * 90_000);
          await tx.season.create({
            data: { seasonNumber, phase: 'completed', startedAt: new Date(), endedAt: new Date() },
          });
          const snapshotBase = {
            seasonNumber, mode: 'league_1v1', tier: 'bronze', leagueInstanceId: 'bronze_1',
            entityType: 'robot', stableName: 'S', leaguePoints: 0, wins: 0, losses: 0, draws: 0,
          };
          const genSnap = await tx.seasonStandingSnapshot.create({
            data: { ...snapshotBase, instanceRank: 1, entityName: 'g', isGeneratedSubject: true },
          });
          const humSnap = await tx.seasonStandingSnapshot.create({
            data: { ...snapshotBase, instanceRank: 2, entityName: 'h', isGeneratedSubject: false },
          });
          const accoladeBase = {
            seasonNumber, category: 'c', subjectType: 'robot', subjectName: 'n',
            stableName: 'S', value: 1, valueLabel: '1',
          };
          const genAcc = await tx.seasonAccolade.create({ data: { ...accoladeBase, rank: 1, isGeneratedSubject: true } });
          const humAcc = await tx.seasonAccolade.create({ data: { ...accoladeBase, rank: 2, isGeneratedSubject: false } });

          for (const statement of BACKFILL_STATEMENTS) {
            await tx.$executeRawUnsafe(statement);
          }

          const snaps = await tx.seasonStandingSnapshot.findMany({
            where: { id: { in: [genSnap.id, humSnap.id] } },
            select: { id: true, subjectStableType: true },
          });
          expect(snaps.find((s) => s.id === genSnap.id)?.subjectStableType).toBe('generated');
          expect(snaps.find((s) => s.id === humSnap.id)?.subjectStableType).toBe('human');

          const accs = await tx.seasonAccolade.findMany({
            where: { id: { in: [genAcc.id, humAcc.id] } },
            select: { id: true, subjectStableType: true },
          });
          expect(accs.find((a) => a.id === genAcc.id)?.subjectStableType).toBe('generated');
          expect(accs.find((a) => a.id === humAcc.id)?.subjectStableType).toBe('human');
          throw new Rollback();
        }),
      ).rejects.toBeInstanceOf(Rollback);
    });

    it('seeds exactly one Program_Switch row, on, with no lease (I6)', async () => {
      const rows = await prisma.automatonProgramSetting.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: 1, turnsEnabled: true });
    });
  });

  describe('invariant I1 across creation paths (R1.3, R1.5)', () => {
    it('registration creates a human', async () => {
      const user = await createUser({
        username: `i1_reg_${suffix}`,
        email: `i1_reg_${suffix}@example.com`,
        passwordHash: 'x',
        stableName: `I1Reg${suffix}`.slice(0, 30),
      });
      createdUserIds.push(user.id);
      const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { isGenerated: true, stableType: true } });
      expect(row).toEqual({ isGenerated: false, stableType: 'human' });
    });

    it('generateBattleReadyUsers creates generated stables', async () => {
      const result = await generateBattleReadyUsers(1);
      const rows = await prisma.user.findMany({
        where: { username: { in: result.usernames } },
        select: { id: true, isGenerated: true, stableType: true },
      });
      createdUserIds.push(...rows.map((r) => r.id));
      expect(rows.length).toBe(result.usersCreated);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.stableType).toBe('generated');
        expect(satisfiesStableTypeInvariant(row.isGenerated, row.stableType)).toBe(true);
      }
    });

    it.each([true, false])('seed upsertUser with isGenerated=%s satisfies I1', async (isGenerated) => {
      const user = await upsertUser({ username: `i1_seed_${isGenerated}_${suffix}`, passwordHash: 'x', isGenerated });
      createdUserIds.push(user.id);
      const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { isGenerated: true, stableType: true } });
      expect(row.stableType).toBe(isGenerated ? 'generated' : 'human');
      expect(satisfiesStableTypeInvariant(row.isGenerated, row.stableType)).toBe(true);
    });
  });
});
