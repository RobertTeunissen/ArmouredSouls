/**
 * Catalogue_Sync entry point (Spec #55, R10.3–R10.6, design §15.2).
 *
 *   pnpm run automaton:sync [--dry-run]
 *
 * Adds a Draft_Automaton for every new Catalogue_Entry in
 * `prisma/automaton-catalogue/` and fills missing Repository_Images; never
 * overwrites or deletes. Exits 1 (writing nothing) when any file is invalid.
 * The ACC deploy runs it after `prisma migrate deploy` and the seed.
 */
import prisma from '../src/lib/prisma';
import { runCatalogueSyncCli } from '../src/services/automaton/catalogueSync';

runCatalogueSyncCli(process.argv.slice(2))
  .then((code) => { process.exitCode = code; })
  .catch((error: unknown) => {
    process.stderr.write(`Catalogue_Sync failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
