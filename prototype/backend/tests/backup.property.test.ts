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

const NUM_RUNS = 30;

/** Generate a unique integer index to build distinct timestamps */
const indexGen = fc.integer({ min: 0, max: 999999 });

/** Build a backup file from an index, guaranteeing a valid & unique timestamp */
function makeBackupFile(prefix: string, index: number): BackupFile {
  // Spread index across date components to get unique filenames
  const day = (index % 28) + 1;
  const month = ((Math.floor(index / 28)) % 12) + 1;
  const hour = (Math.floor(index / 336)) % 24;
  const minute = (Math.floor(index / 8064)) % 60;
  const second = (Math.floor(index / 483840)) % 60;
  const date = new Date(2024, month - 1, day, hour, minute, second);
  const ts = `2024${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}${String(second).padStart(2, '0')}`;
  return { name: `armouredsouls_${prefix}_${ts}.sql.gz`, date };
}

/** Generate an array of daily backup files with unique names */
const uniqueDailyFilesGen = (min: number, max: number) =>
  fc.uniqueArray(indexGen, { minLength: min, maxLength: max })
    .map(indices => indices.map(i => makeBackupFile('daily', i)));

/** Generate an array of weekly backup files with unique names */
const uniqueWeeklyFilesGen = (min: number, max: number) =>
  fc.uniqueArray(indexGen, { minLength: min, maxLength: max })
    .map(indices => indices.map(i => makeBackupFile('weekly', i)));

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
        uniqueDailyFilesGen(0, 30),
        uniqueWeeklyFilesGen(0, 15),
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
        uniqueDailyFilesGen(0, 30),
        uniqueWeeklyFilesGen(0, 15),
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
        uniqueDailyFilesGen(0, 7),
        uniqueWeeklyFilesGen(0, 4),
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
        uniqueDailyFilesGen(8, 30),
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
        uniqueDailyFilesGen(0, 30),
        uniqueWeeklyFilesGen(0, 15),
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
        uniqueDailyFilesGen(0, 50),
        uniqueWeeklyFilesGen(0, 20),
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
        uniqueDailyFilesGen(0, 30),
        uniqueWeeklyFilesGen(0, 15),
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
