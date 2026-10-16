/**
 * Season 2 — one-off Refinement Lab grant (FEAT-004).
 *
 * Real database. The shipped migration SQL is read from the migration file and
 * run twice inside a rolled-back transaction, so the test proves the exact
 * statement deploy runs (grant Lab = Workshop level for every Workshop > 0,
 * never touch an existing Lab, idempotent) without changing other rows of the
 * shared test database. The static file content is the only input to
 * `$executeRawUnsafe`.
 */
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../../src/lib/prisma';

const MIGRATION_SQL = fs.readFileSync(
  path.join(__dirname, '../../prisma/migrations/20261016120000_grant_refinement_lab/migration.sql'),
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

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

// Every row the test creates lives inside the rolled-back transaction, so the
// rollback is the cleanup.
describe('Refinement Lab grant migration (Season 2)', () => {
  it('ships exactly one INSERT and no schema change', () => {
    expect(STATEMENTS).toHaveLength(1);
    expect(STATEMENTS[0].startsWith('INSERT INTO "facilities"')).toBe(true);
    expect(MIGRATION_SQL).not.toMatch(/\b(ALTER|CREATE|DROP)\b/i);
  });

  it('grants the Lab at the Workshop level, skips L0, keeps an existing Lab and is idempotent', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const makeUser = async (label: string, facilities: Array<{ facilityType: string; level: number }>): Promise<number> => {
          const user = await tx.user.create({
            data: { username: `rlg_${label}_${suffix}`, passwordHash: 'x' },
          });
          for (const facility of facilities) {
            await tx.facility.create({ data: { userId: user.id, ...facility } });
          }
          return user.id;
        };

        const workshop0 = await makeUser('w0', [{ facilityType: 'weapons_workshop', level: 0 }]);
        const workshop3 = await makeUser('w3', [{ facilityType: 'weapons_workshop', level: 3 }]);
        const workshop10 = await makeUser('w10', [{ facilityType: 'weapons_workshop', level: 10 }]);
        const ownsLab = await makeUser('lab', [
          { facilityType: 'weapons_workshop', level: 6 },
          { facilityType: 'refinement_lab', level: 2 },
        ]);
        const userIds = [workshop0, workshop3, workshop10, ownsLab];
        const existingLab = await tx.facility.findUniqueOrThrow({
          where: { userId_facilityType: { userId: ownsLab, facilityType: 'refinement_lab' } },
        });

        const labsOf = () => tx.facility.findMany({
          where: { userId: { in: userIds }, facilityType: 'refinement_lab' },
          orderBy: { userId: 'asc' },
        });

        for (const statement of STATEMENTS) await tx.$executeRawUnsafe(statement);
        const afterFirst = await labsOf();
        const totalLabsAfterFirst = await tx.facility.count({ where: { facilityType: 'refinement_lab' } });

        expect(afterFirst.find((f) => f.userId === workshop0)).toBeUndefined();
        expect(afterFirst.find((f) => f.userId === workshop3)).toMatchObject({ level: 3, maxLevel: 10 });
        expect(afterFirst.find((f) => f.userId === workshop10)).toMatchObject({ level: 10, maxLevel: 10 });
        const keptLab = afterFirst.find((f) => f.userId === ownsLab);
        expect(keptLab).toMatchObject({ id: existingLab.id, level: 2 });
        expect(keptLab?.updatedAt.getTime()).toBe(existingLab.updatedAt.getTime());
        expect(afterFirst).toHaveLength(3);

        // Second run: nothing changes anywhere in the table.
        for (const statement of STATEMENTS) await tx.$executeRawUnsafe(statement);
        expect(await labsOf()).toEqual(afterFirst);
        expect(await tx.facility.count({ where: { facilityType: 'refinement_lab' } })).toBe(totalLabsAfterFirst);

        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });
});
