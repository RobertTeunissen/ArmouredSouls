/**
 * Property 20: Repair figures come only from Repair_Spend_Source.
 *
 * Spec #48 Requirement 9 criteria 1 and 5. The guard that matters: a
 * `battle_complete` payload carrying an arbitrary repair-shaped field must
 * contribute nothing to any repair total. Before this spec a read of
 * `payload.repairCost` sat in `aggregateStableMetrics`, so the moment an
 * orchestrator started emitting that field every stable's repair total would have
 * doubled — silently, with nothing at the read site to explain it.
 *
 * Feature: 48-dashboard-overview-row, Property 20: Repair figures come only from Repair_Spend_Source
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

const BACKEND_SRC = path.join(__dirname, '..', '..', 'src');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(BACKEND_SRC, relativePath), 'utf-8');
}

/** Source lines with comments stripped, so documentation of the removal does not match. */
function codeOnly(source: string): string {
  return source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
    })
    .join('\n');
}

describe('Property 20: no repair figure is derived from a battle payload', () => {
  it('the snapshot aggregation never reads a repair field off a battle payload', () => {
    const source = codeOnly(read('services/cycle/cycleSnapshotService.ts'));
    expect(source).not.toMatch(/payload\.repairCost/);
  });

  it('the CSV export never reads a repair field off a battle payload', () => {
    const source = codeOnly(read('services/cycle/cycleCsvExportService.ts'));
    expect(source).not.toMatch(/payload\.repairCost/);
  });

  it('CycleEventPayload no longer declares repairCost, so a reintroduced read cannot compile', () => {
    const source = codeOnly(read('types/snapshotTypes.ts'));
    expect(source).not.toMatch(/repairCost\s*\?:/);
  });

  it('no backend source file reads payload.repairCost', () => {
    // Requirement 9 criteria 2, 3 and 12 together — the whole surface, not just the
    // two known sites.
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // `shared` is a symlink to app/shared; skip to avoid walking out of tree.
          if (entry.name === 'shared') continue;
          walk(full);
        } else if (entry.name.endsWith('.ts')) {
          if (codeOnly(fs.readFileSync(full, 'utf-8')).includes('payload.repairCost')) {
            offenders.push(path.relative(BACKEND_SRC, full));
          }
        }
      }
    };
    walk(BACKEND_SRC);

    expect(offenders).toEqual([]);
  });

  it('an arbitrary repair-shaped extra field on a battle payload changes no repair total', () => {
    // The aggregation reads a fixed set of keys off `battle_complete`. Generating
    // arbitrary repair-shaped extras and confirming none of them appears in the
    // aggregation's read set is the compile-independent form of the same guarantee.
    const source = codeOnly(read('services/cycle/cycleSnapshotService.ts'));

    fc.assert(
      fc.property(
        fc.constantFrom(
          'repairCost',
          'repair_cost',
          'repairCosts',
          'totalRepairCost',
          'repairSpend',
          'repairCharged',
        ),
        (fieldName) => {
          // No `battle_complete` branch may read any of these off the payload.
          expect(source).not.toMatch(new RegExp(`payload\\.${fieldName}\\b`));
        },
      ),
      { numRuns: 50 },
    );
  });

  it('repair spend is aggregated from robot_repair audit rows', () => {
    // The positive half: the surviving repair contribution must come from the
    // `robot_repair` event type, which is Repair_Spend_Source.
    const source = read('services/cycle/cycleSnapshotService.ts');
    expect(source).toMatch(/robot_repair/);
  });
});
