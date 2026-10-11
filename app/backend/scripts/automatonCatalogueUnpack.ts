/**
 * Catalogue_Unpack entry point (Spec #55, R6.14, R10.8, design §15.4).
 *
 *   pnpm run automaton:unpack <file> [--force]
 *
 * Writes a Catalogue_Export document into `prisma/automaton-catalogue/` and
 * `app/frontend/public/assets/automatons/` (existing files only with
 * `--force`), or a Strategy_Definition_File into
 * `src/config/automaton-strategies/` (never over an existing file). Entries
 * are validated against the seed weapon catalogue; no database is used.
 */
import { WEAPON_DEFINITIONS, disconnectSeedClient } from '../prisma/seed';
import { runCatalogueUnpackCli, weaponCatalogueFromDefinitions } from '../src/services/automaton/catalogueUnpack';

const io = {
  out: (line: string): void => { process.stdout.write(`${line}\n`); },
  err: (line: string): void => { process.stderr.write(`${line}\n`); },
};

try {
  process.exitCode = runCatalogueUnpackCli(process.argv.slice(2), { weapons: weaponCatalogueFromDefinitions(WEAPON_DEFINITIONS) }, io);
} catch (error) {
  io.err(`Catalogue_Unpack failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  void disconnectSeedClient();
}
