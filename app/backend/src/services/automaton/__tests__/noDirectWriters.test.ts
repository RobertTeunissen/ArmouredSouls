/**
 * Spec #55 task 5.6 (R8.3, R8.5) — no direct balance writers and no
 * Manual_Repair in the Automaton module.
 *
 * Scans every non-test `.ts` file under `services/automaton/` with the two
 * Verification Criterion 1 patterns (`requirements.md`):
 * - a `currency` write: `currency:` followed by anything but `true` (the
 *   module reads the balance with `select: { currency: true }` and never
 *   declares a `currency` property), or a `data: { … currency … }` object;
 * - Manual_Repair: `robotRepairService`, `repairAllRobots`, `repair-all`,
 *   `MANUAL_REPAIR`.
 */
import fs from 'node:fs';
import path from 'node:path';

const AUTOMATON_DIR = path.resolve(__dirname, '..');

/**
 * VC1 grep 1, per line: `currency\s*:\s*[^t[:space:]]|data\s*:\s*\{[^}]*currency`,
 * except that `currency` must not be the tail of a longer lowercase word, so
 * the Turn_Step's `concurrency: number` is not reported (a Prisma `currency`
 * key is always preceded by whitespace, `{`, `.` or `_`).
 */
const CURRENCY_WRITE = /(?<![a-z])currency\s*:\s*[^t\s]|data\s*:\s*\{[^}]*(?<![a-z])currency/;
/** VC1 grep 2. */
const MANUAL_REPAIR = /robotRepairService|repairAllRobots|repair-all|MANUAL_REPAIR/;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

function matches(pattern: RegExp): string[] {
  return sourceFiles(AUTOMATON_DIR).flatMap((file) =>
    fs.readFileSync(file, 'utf8').split('\n')
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => pattern.test(line))
      .map(({ line, index }) => `${path.relative(AUTOMATON_DIR, file)}:${index + 1}: ${line.trim()}`));
}

describe('Automaton module boundaries (R8.3, R8.5, VC1)', () => {
  it('scans the executor, fit-out, upkeep and engine files', () => {
    const files = sourceFiles(AUTOMATON_DIR).map((file) => path.relative(AUTOMATON_DIR, file));
    expect(files).toEqual(expect.arrayContaining([
      'actionExecutor.ts',
      'executionSteps.ts',
      'robotFitout.ts',
      'stableFacts.ts',
      path.join('upkeep', 'freeUpkeep.ts'),
    ]));
    expect(files.some((file) => file.includes('__tests__'))).toBe(false);
  });

  it('the patterns catch the writes they exist for', () => {
    expect(CURRENCY_WRITE.test('data: { currency: user.currency - cost }')).toBe(true);
    expect(CURRENCY_WRITE.test('  currency: 0,')).toBe(true);
    expect(CURRENCY_WRITE.test("select: { currency: true }")).toBe(false);
    expect(CURRENCY_WRITE.test('{currency: 0}')).toBe(true);
    expect(CURRENCY_WRITE.test('data: { ...rest, currency }')).toBe(true);
    expect(CURRENCY_WRITE.test('  concurrency: number;')).toBe(false);
    expect(CURRENCY_WRITE.test('    concurrency: run.concurrency,')).toBe(false);
    expect(MANUAL_REPAIR.test("import { repairAllRobots } from '../robot/robotRepairService';")).toBe(true);
  });

  it('has no currency write outside Credit_Mutation_Service-backed domain services', () => {
    expect(matches(CURRENCY_WRITE)).toEqual([]);
  });

  it('never calls Manual_Repair', () => {
    expect(matches(MANUAL_REPAIR)).toEqual([]);
  });
});
