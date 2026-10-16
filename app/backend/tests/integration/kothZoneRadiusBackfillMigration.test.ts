/**
 * Season 2 — one-off KotH zone radius backfill (#522, FEAT-005).
 *
 * Real database. The shipped migration SQL is read from the migration file and
 * run twice inside a rolled-back transaction, so the test proves the exact
 * statement deploy runs (still-scheduled KotH rows without a radius get 7,
 * nothing else changes, idempotent) without changing other rows of the shared
 * test database. The static file content is the only input to
 * `$executeRawUnsafe`.
 */
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../../src/lib/prisma';
import { MatchType } from '../../generated/prisma';

const MIGRATION_SQL = fs.readFileSync(
  path.join(__dirname, '../../prisma/migrations/20261016121000_backfill_koth_zone_radius/migration.sql'),
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

// Every row the test creates lives inside the rolled-back transaction, so the
// rollback is the cleanup.
describe('KotH zone radius backfill migration (Season 2)', () => {
  it('ships exactly one UPDATE and no schema change', () => {
    expect(STATEMENTS).toHaveLength(1);
    expect(STATEMENTS[0].startsWith('UPDATE "scheduled_matches_v2"')).toBe(true);
    expect(MIGRATION_SQL).not.toMatch(/\b(ALTER|CREATE|DROP)\b/i);
  });

  it('sets radius 7 on scheduled KotH rows without one, leaves every other row alone and is idempotent', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const makeMatch = async (matchType: MatchType, status: string, zoneRadius: number | null): Promise<number> => {
          const match = await tx.scheduledMatch.create({
            data: { matchType, status, scheduledFor, zoneRadius },
          });
          return match.id;
        };

        const scheduledNull = await makeMatch(MatchType.koth, 'scheduled', null);
        const scheduledFive = await makeMatch(MatchType.koth, 'scheduled', 5);
        const completedNull = await makeMatch(MatchType.koth, 'completed', null);
        const leagueNull = await makeMatch(MatchType.league_1v1, 'scheduled', null);
        const ids = [scheduledNull, scheduledFive, completedNull, leagueNull];

        const radiiOf = async (): Promise<Map<number, number | null>> => new Map(
          (await tx.scheduledMatch.findMany({
            where: { id: { in: ids } },
            select: { id: true, zoneRadius: true },
          })).map((row) => [row.id, row.zoneRadius]),
        );

        for (const statement of STATEMENTS) await tx.$executeRawUnsafe(statement);
        const afterFirst = await radiiOf();

        expect(afterFirst.get(scheduledNull)).toBe(7);
        expect(afterFirst.get(scheduledFive)).toBe(5);
        expect(afterFirst.get(completedNull)).toBeNull();
        expect(afterFirst.get(leagueNull)).toBeNull();

        // Second run: no row left to update, nothing changes.
        let secondRunCount = 0;
        for (const statement of STATEMENTS) secondRunCount += await tx.$executeRawUnsafe(statement);
        expect(secondRunCount).toBe(0);
        expect(await radiiOf()).toEqual(afterFirst);

        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });
});
