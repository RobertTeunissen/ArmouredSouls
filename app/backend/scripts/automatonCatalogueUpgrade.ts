/**
 * Catalogue_Upgrade entry point.
 *
 *   pnpm run automaton:catalogue-upgrade [--dry-run]
 *
 * Moves every Catalogue_Entry in `prisma/automaton-catalogue/` to the latest
 * version of its strategy, carrying Goal_Target overrides by Goal type and
 * occurrence (`services/automaton/catalogueUpgrade.ts`). Run it after adding
 * a new Strategy_Definition_File and commit the result.
 */
import { runCatalogueUpgradeCli } from '../src/services/automaton/catalogueUpgrade';

process.exitCode = runCatalogueUpgradeCli(process.argv.slice(2));
