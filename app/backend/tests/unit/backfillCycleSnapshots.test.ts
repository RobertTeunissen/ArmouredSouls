/**
 * `backfillCycleSnapshots` stays create-only — Spec #48 Requirement 9 criteria 8
 * and 11, and Requirement 18 criterion 13.
 *
 * These are PROHIBITIONS, so the design element that satisfies them is the absence
 * of a change. This test exists to make that absence fail loudly if someone later
 * adds the reprocess path an earlier draft of the spec proposed.
 *
 * The decision behind it (requirements § Design Decisions, "Option B"): players have
 * no visibility of the understated historical repair totals, this is an ACC
 * environment where a corrected history has little value, and a one-off correction
 * path is code that exists to run once, is tested less than production code, and
 * complicates the operation for every later reader. Everything is correct from the
 * moment the spec lands; nothing is rewritten behind it.
 */

import * as fs from 'fs';
import * as path from 'path';

const BACKEND_SRC = path.join(__dirname, '..', '..', 'src');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(BACKEND_SRC, relativePath), 'utf-8');
}

function codeOnly(source: string): string {
  return source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
    })
    .join('\n');
}

describe('Requirement 9 criteria 8 and 11: backfillCycleSnapshots is create-only', () => {
  const adminCycleService = codeOnly(readSource('services/admin/adminCycleService.ts'));
  const snapshotService = codeOnly(readSource('services/cycle/cycleSnapshotService.ts'));

  it('keeps its skip-if-a-snapshot-exists guard', () => {
    // The operation must still refuse to revisit a cycle that already has a snapshot.
    expect(adminCycleService).toMatch(/backfillCycleSnapshots/);
    expect(adminCycleService).toMatch(/cycleSnapshot\.find|existingSnapshot|already/i);
  });

  it('calls createSnapshot and never an update or upsert on cycle_snapshots', () => {
    expect(adminCycleService).toMatch(/createSnapshot\(/);
    expect(adminCycleService).not.toMatch(/cycleSnapshot\.upsert/);
    expect(adminCycleService).not.toMatch(/cycleSnapshot\.update/);
  });

  it('createSnapshot remains create-only, with no upsert path', () => {
    expect(snapshotService).toMatch(/cycleSnapshot\.create\(/);
    expect(snapshotService).not.toMatch(/cycleSnapshot\.upsert/);
  });

  it('BackfillSnapshotsResult gains no skipped-cycle reporting field', () => {
    // An earlier design draft added `cyclesSkippedForMissingRepairSource` to support a
    // guarded reprocess path. Option B dropped it; this pins that.
    expect(adminCycleService).not.toMatch(/cyclesSkippedForMissingRepairSource/);
  });

  it('adds no repair-source count check to gate a reprocess', () => {
    // The guard the rejected Option A would have needed.
    expect(adminCycleService).not.toMatch(/eventType:\s*'robot_repair'/);
  });
});

describe('Requirement 18 criteria 12 and 13: no correction mechanism exists', () => {
  it('no migration or script rewrites a historical repair figure', () => {
    // A one-off correction script is the specific liability the decision rejected.
    const migrationsDir = path.join(__dirname, '..', '..', 'prisma', 'migrations');
    const offenders: string[] = [];

    if (fs.existsSync(migrationsDir)) {
      for (const entry of fs.readdirSync(migrationsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const sqlPath = path.join(migrationsDir, entry.name, 'migration.sql');
        if (!fs.existsSync(sqlPath)) continue;
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        // An UPDATE touching repair figures or stableMetrics would be a backfill.
        if (/UPDATE\s+"?(audit_logs|cycle_snapshots)"?/i.test(sql)) {
          offenders.push(entry.name);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('the prohibition and its reasoning are recorded where a maintainer will find them', () => {
    // Requirement 18 criterion 12's reasoning has to survive in the code, or the next
    // person will "helpfully" write the backfill.
    const source = readSource('services/economy/repairPayloadKeys.ts');
    expect(source).toMatch(/Season_Rollover/);
  });
});

describe('Requirement 17 criterion 9: a newly created snapshot carries the renamed key only', () => {
  it('the metric initialiser uses cycleRepairCreditsPaid and not the legacy key', () => {
    const source = codeOnly(readSource('services/cycle/cycleSnapshotService.ts'));
    expect(source).toMatch(/cycleRepairCreditsPaid:\s*0/);
    expect(source).not.toMatch(/totalRepairCosts:\s*0/);
  });
});
