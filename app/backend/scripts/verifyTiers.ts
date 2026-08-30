/**
 * Spec #51 — Tier_Partition verification.
 *
 * Asserts that every backend test file is collected by exactly one Test_Tier.
 * Two failure modes are checked, and both existed silently before this script:
 *
 *   Orphaned_Test   — collected by no tier, so it never runs anywhere. Four
 *                     files were in this state, including the only test for the
 *                     error-handling middleware that shapes every API error body.
 *   Duplicated_Test — collected by more than one tier, so it runs twice per
 *                     pipeline. Ten files were in this state.
 *   Misclassified   — a suite that mocks `lib/prisma` sitting in the integration
 *                     tier. `tests/setup.ts` calls `prisma.weapon.count()` in a
 *                     global `beforeAll`, so under a mock every test in the file
 *                     dies before it starts. Twenty-four files were in this
 *                     state; eleven had been failing for months and the other
 *                     thirteen passed only because their mock happened to define
 *                     the property the setup file touches.
 *
 * This runs `jest --listTests` for each config rather than trusting
 * jest.tiers.js, so it verifies what Jest will actually collect. That matters:
 * jest.tiers.js makes violations structurally impossible, and this script is the
 * guard against someone reintroducing a bespoke `testPathIgnorePatterns` and
 * re-splitting the source of truth.
 *
 * Exits 0 when the partition holds, 1 otherwise, naming every offending file.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { allTestFiles } from '../jest.tiers';

type Tier = 'unit' | 'integration' | 'heavy';

const TIERS: Tier[] = ['unit', 'integration', 'heavy'];
const BACKEND_ROOT = path.resolve(__dirname, '..');

/** Ask Jest which files a config collects, as repo-relative paths. */
function listTests(tier: Tier): string[] {
  const raw = execFileSync(
    'node',
    [
      require.resolve('jest/bin/jest'),
      '--config',
      `jest.config.${tier}.js`,
      '--listTests',
    ],
    { cwd: BACKEND_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((abs) => path.relative(BACKEND_ROOT, abs));
}

/**
 * Does this suite replace the `src/lib/prisma` singleton with a mock?
 *
 * Deliberately a source scan and not a runtime check: the point is to decide tier
 * membership without loading the file, and `jest.mock` calls are hoisted literals
 * so a literal match is exact enough. A dynamic module path would evade this, and
 * there are none in the tree.
 */
function mocksPrismaSingleton(relPath: string): boolean {
  const source = fs.readFileSync(path.join(BACKEND_ROOT, relPath), 'utf8');
  return /jest\.mock\(\s*['"`][^'"`]*lib\/prisma['"`]/.test(source);
}

function main(): void {
  const collected = new Map<Tier, Set<string>>();
  for (const tier of TIERS) {
    collected.set(tier, new Set(listTests(tier)));
  }

  const discovered = allTestFiles();

  // Which tiers claim each file?
  const claims = new Map<string, Tier[]>();
  for (const file of discovered) {
    claims.set(
      file,
      TIERS.filter((t) => collected.get(t)!.has(file)),
    );
  }

  const orphans = discovered.filter((f) => claims.get(f)!.length === 0);
  const duplicates = discovered.filter((f) => claims.get(f)!.length > 1);
  const misclassified = discovered.filter(
    (f) => claims.get(f)!.length === 1 && claims.get(f)![0] === 'integration' && mocksPrismaSingleton(f),
  );

  // A file a tier collects but the filesystem walk did not find would mean the
  // two discovery methods disagree — worth failing on rather than ignoring.
  const discoveredSet = new Set(discovered);
  const unknown: string[] = [];
  for (const tier of TIERS) {
    for (const file of collected.get(tier)!) {
      if (!discoveredSet.has(file)) unknown.push(`${file} (collected by ${tier})`);
    }
  }

  for (const tier of TIERS) {
    console.log(`${tier.padEnd(12)} ${collected.get(tier)!.size} suites`);
  }
  console.log(`${'discovered'.padEnd(12)} ${discovered.length} files`);

  if (
    orphans.length === 0 &&
    duplicates.length === 0 &&
    unknown.length === 0 &&
    misclassified.length === 0
  ) {
    console.log('\nTier_Partition holds: every test file runs in exactly one tier.');
    return;
  }

  console.error('\nTier_Partition VIOLATED\n');

  if (orphans.length > 0) {
    console.error(`${orphans.length} Orphaned_Test(s) — collected by no tier, so they never run:`);
    for (const f of orphans) console.error(`  ${f}`);
    console.error(
      '\n  Fix: add each to DB_DEPENDENT or HEAVY_TESTS in jest.tiers.js, or\n' +
        '  remove the testPathIgnorePatterns entry that is excluding it.\n',
    );
  }

  if (duplicates.length > 0) {
    console.error(`${duplicates.length} Duplicated_Test(s) — collected by more than one tier:`);
    for (const f of duplicates) console.error(`  ${f} → ${claims.get(f)!.join(', ')}`);
    console.error(
      '\n  Fix: a file may appear in at most one of HEAVY_TESTS / DB_DEPENDENT\n' +
        '  in jest.tiers.js. Anything in neither runs in the unit tier.\n',
    );
  }

  if (misclassified.length > 0) {
    console.error(
      `${misclassified.length} suite(s) mock lib/prisma but are in the integration tier:`,
    );
    for (const f of misclassified) console.error(`  ${f}`);
    console.error(
      "\n  A suite that mocks the prisma singleton needs no database, and the\n" +
        "  integration setup file (tests/setup.ts) calls prisma.weapon.count() in a\n" +
        "  global beforeAll — under a mock that throws before any test runs.\n" +
        '  Fix: remove each from DB_DEPENDENT in jest.tiers.js so it runs in the\n' +
        '  unit tier, or stop mocking prisma if the suite really needs a database.\n',
    );
  }

  if (unknown.length > 0) {
    console.error(`${unknown.length} file(s) collected by Jest but not found by the filesystem walk:`);
    for (const f of unknown) console.error(`  ${f}`);
    console.error('\n  Fix: reconcile allTestFiles() in jest.tiers.js with the config roots.\n');
  }

  process.exit(1);
}

main();
