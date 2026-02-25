import * as fc from 'fast-check';

// ============================================================================
// Backup Retention Logic
// ============================================================================

interface BackupFile {
  name: string;
  date: Date;
}

/**
 * Determines which backup files should be deleted based on retention policy.
 * Keeps the most recent `dailyRetain` daily backups and `weeklyRetain` weekly backups.
 * Weekly backups are identified by having "weekly" in the filename.
 */
export function getFilesToDelete(
  files: BackupFile[],
  dailyRetain: number,
  weeklyRetain: number
): BackupFile[] {
  const dailyFiles = files
    .filter(f => f.name.includes('daily'))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const weeklyFiles = files
    .filter(f => f.name.includes('weekly'))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const dailyToDelete = dailyFiles.slice(dailyRetain);
  const weeklyToDelete = weeklyFiles.slice(weeklyRetain);

  return [...dailyToDelete, ...weeklyToDelete];
}

// ============================================================================
// Generators
// ============================================================================

const NUM_RUNS = 100;

/** Generate a date within a reasonable range (last 365 days) */
const dateGen = fc.date({
  min: new Date('2024-01-01'),
  max: new Date('2024-12-31'),
});

/** Generate a daily backup file entry */
const dailyFileGen = dateGen.map(date => {
  const ts = date.toISOString().replace(/[-:T]/g, '').slice(0, 15);
  return { name: `armouredsouls_daily_${ts}.sql.gz`, date };
});

/** Generate a weekly backup file entry */
const weeklyFileGen = dateGen.map(date => {
  const ts = date.toISOString().replace(/[-:T]/g, '').slice(0, 15);
  return { name: `armouredsouls_weekly_${ts}.sql.gz`, date };
});

// ============================================================================
// Property 22: Backup retention policy
// ============================================================================

describe('Property 22: Backup retention policy', () => {
  /**
   * **Validates: Requirement 8.2**
   * Cleanup retains exactly 7 daily and 4 weekly backups, deletes older files.
   */

  test('retains at most dailyRetain daily backups', () => {
    fc.assert(
      fc.property(
        fc.array(dailyFileGen, { minLength: 0, maxLength: 30 }),
        fc.array(weeklyFileGen, { minLength: 0, maxLength: 15 }),
        (dailyFiles, weeklyFiles) => {
          const allFiles = [...dailyFiles, ...weeklyFiles];
          const toDelete = getFilesToDelete(allFiles, 7, 4);
          const toDeleteNames = new Set(toDelete.map(f => f.name));

          const remainingDaily = dailyFiles.filter(f => !toDeleteNames.has(f.name));
          expect(remainingDaily.length).toBeLessThanOrEqual(7);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  test('retains at most weeklyRetain weekly backups', () => {
    fc.assert(
      fc.property(
        fc.array(dailyFileGen, { minLength: 0, maxLength: 30 }),
        fc.array(weeklyFileGen, { minLength: 0, maxLength: 15 }),
        (dailyFiles, weeklyFiles) => {
          const allFiles = [...dailyFiles, ...weeklyFiles];
          const toDelete = getFilesToDelete(allFiles, 7, 4);
          const toDeleteNames = new Set(toDelete.map(f => f.name));

          const remainingWeekly = weeklyFiles.filter(f => !toDeleteNames.has(f.name));
          expect(remainingWeekly.length).toBeLessThanOrEqual(4);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  test('never deletes files when count is within retention limits', () => {
    fc.assert(
      fc.property(
        fc.array(dailyFileGen, { minLength: 0, maxLength: 7 }),
        fc.array(weeklyFileGen, { minLength: 0, maxLength: 4 }),
        (dailyFiles, weeklyFiles) => {
          const allFiles = [...dailyFiles, ...weeklyFiles];
          const toDelete = getFilesToDelete(allFiles, 7, 4);

          expect(toDelete.length).toBe(0);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  test('deletes oldest files first, keeps newest', () => {
    fc.assert(
      fc.property(
        fc.array(dailyFileGen, { minLength: 8, maxLength: 30 }),
        (dailyFiles) => {
          const toDelete = getFilesToDelete(dailyFiles, 7, 4);
          const toDeleteNames = new Set(toDelete.map(f => f.name));

          const sorted = [...dailyFiles].sort(
            (a, b) => b.date.getTime() - a.date.getTime()
          );
          const kept = sorted.slice(0, 7);
          const shouldDelete = sorted.slice(7);

          // All kept files should NOT be in the delete list
          for (const f of kept) {
            expect(toDeleteNames.has(f.name)).toBe(false);
          }

          // All files beyond retention should be in the delete list
          for (const f of shouldDelete) {
            expect(toDeleteNames.has(f.name)).toBe(true);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  test('daily and weekly retention are independent', () => {
    fc.assert(
      fc.property(
        fc.array(dailyFileGen, { minLength: 0, maxLength: 30 }),
        fc.array(weeklyFileGen, { minLength: 0, maxLength: 15 }),
        (dailyFiles, weeklyFiles) => {
          const allFiles = [...dailyFiles, ...weeklyFiles];
          const toDelete = getFilesToDelete(allFiles, 7, 4);
          const toDeleteNames = new Set(toDelete.map(f => f.name));

          // Deleting daily files should not affect weekly count and vice versa
          const remainingDaily = dailyFiles.filter(f => !toDeleteNames.has(f.name));
          const remainingWeekly = weeklyFiles.filter(f => !toDeleteNames.has(f.name));

          expect(remainingDaily.length).toBe(Math.min(dailyFiles.length, 7));
          expect(remainingWeekly.length).toBe(Math.min(weeklyFiles.length, 4));
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  test('works with custom retention values', () => {
    fc.assert(
      fc.property(
        fc.array(dailyFileGen, { minLength: 0, maxLength: 50 }),
        fc.array(weeklyFileGen, { minLength: 0, maxLength: 20 }),
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 12 }),
        (dailyFiles, weeklyFiles, dailyRetain, weeklyRetain) => {
          const allFiles = [...dailyFiles, ...weeklyFiles];
          const toDelete = getFilesToDelete(allFiles, dailyRetain, weeklyRetain);
          const toDeleteNames = new Set(toDelete.map(f => f.name));

          const remainingDaily = dailyFiles.filter(f => !toDeleteNames.has(f.name));
          const remainingWeekly = weeklyFiles.filter(f => !toDeleteNames.has(f.name));

          expect(remainingDaily.length).toBeLessThanOrEqual(dailyRetain);
          expect(remainingWeekly.length).toBeLessThanOrEqual(weeklyRetain);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  test('total deleted equals excess files beyond retention', () => {
    fc.assert(
      fc.property(
        fc.array(dailyFileGen, { minLength: 0, maxLength: 30 }),
        fc.array(weeklyFileGen, { minLength: 0, maxLength: 15 }),
        (dailyFiles, weeklyFiles) => {
          const allFiles = [...dailyFiles, ...weeklyFiles];
          const toDelete = getFilesToDelete(allFiles, 7, 4);

          const expectedDailyDeletes = Math.max(0, dailyFiles.length - 7);
          const expectedWeeklyDeletes = Math.max(0, weeklyFiles.length - 4);

          expect(toDelete.length).toBe(expectedDailyDeletes + expectedWeeklyDeletes);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});
