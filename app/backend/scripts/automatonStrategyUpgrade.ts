/**
 * Automatic Strategy_Version upgrade entry point.
 *
 *   pnpm run automaton:upgrade [--dry-run]
 *
 * Moves every Automaton_Profile to the latest version of its strategy
 * (`services/automaton/strategies/autoUpgrade.ts`). The ACC deploy runs it
 * after Catalogue_Sync. Idempotent; a rejected profile stays on its version
 * and raises an `automaton_upgrade_rejected` alert.
 */
import prisma from '../src/lib/prisma';
import { runAutoUpgradeCli } from '../src/services/automaton/strategies/autoUpgrade';

runAutoUpgradeCli(process.argv.slice(2))
  .then((code) => { process.exitCode = code; })
  .catch((error: unknown) => {
    process.stderr.write(`Automaton upgrade failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
