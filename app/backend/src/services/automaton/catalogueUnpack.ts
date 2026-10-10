/**
 * Catalogue_Unpack (Spec #55, R6.14, R10.8, design §15.4, task 8.4).
 * `pnpm run automaton:unpack <file> [--force]` runs `runCatalogueUnpackCli`.
 *
 * Two inputs are recognised:
 * - a Strategy_Definition_File (it has a `buildOrder` field): validated with
 *   `strategyDefinitionSchema` and written to
 *   `src/config/automaton-strategies/{key}.v{version}.json`; an existing
 *   strategy file is never overwritten, even with `--force`;
 * - a Catalogue_Export document: every entry is validated with the catalogue
 *   schema, then written to `prisma/automaton-catalogue/{key}.json`, and each
 *   embedded image is decoded to its Repository_Image path
 *   `app/frontend/public/assets/automatons/{key}/{slot}.webp`. Existing files
 *   are refused unless `--force` is given.
 *
 * Every check runs before the first write, so a rejected input writes
 * nothing. The output is committed through a normal pull request.
 */
import fs from 'fs';
import path from 'path';
import {
  CATALOGUE_DIRECTORY,
  EXPORT_IMAGE_KEY,
  REPOSITORY_IMAGE_DIRECTORY,
  catalogueExportDocumentSchema,
  formatCatalogueIssues,
  repositoryImageRelativePath,
  validateCatalogueEntry,
  type CatalogueEntry,
  type WeaponCatalogue,
} from './automatonCatalogueService';
import { BUILD_FOCUS_WEIGHTS } from './buildFocus';
import { weaponFactsFromRow, type WeaponFacts } from './stableFacts';
import { STRATEGY_DIRECTORY, loadStrategyRegistry, type StrategyRegistry } from './strategies/registry';
import { validateStrategyDefinition } from './strategies/strategyDefinitionSchema';
import type { CatalogueCliIo } from './catalogueSync';

export interface CatalogueUnpackOptions {
  force?: boolean;
  /** Weapon catalogue the entries are validated against (the seed's `WEAPON_DEFINITIONS`). */
  weapons: WeaponCatalogue;
  strategies?: StrategyRegistry;
  catalogueDirectory?: string;
  imageDirectory?: string;
  strategyDirectory?: string;
}

export type CatalogueUnpackResult =
  | { ok: true; kind: 'strategy' | 'catalogue'; written: string[] }
  | { ok: false; reason: 'invalid' | 'exists'; problems: string[] };

interface PlannedWrite {
  file: string;
  data: string | Buffer;
}

/** Seed weapon definitions (name, cost, type, hands, range, `<attribute>Bonus`) as a WeaponCatalogue. */
export function weaponCatalogueFromDefinitions(
  rows: readonly { name: string; cost: number; weaponType: string; handsRequired: string; rangeBand: string }[],
): Map<string, WeaponFacts> {
  return new Map(rows.map((row, index) => [row.name, weaponFactsFromRow({ ...row, id: index + 1 })]));
}

function isWebp(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
}

function unpackStrategy(raw: unknown, options: CatalogueUnpackOptions): CatalogueUnpackResult {
  const result = validateStrategyDefinition(raw);
  if (!result.ok) {
    return { ok: false, reason: 'invalid', problems: result.issues.map((issue) => `${issue.position !== undefined ? `goal ${issue.position}: ` : ''}${issue.message}`) };
  }
  const { key, version } = result.definition;
  const file = path.join(options.strategyDirectory ?? STRATEGY_DIRECTORY, `${key}.v${version}.json`);
  if (fs.existsSync(file)) {
    // A published Strategy_Version is immutable (R6.6): never overwritten, even with --force.
    return { ok: false, reason: 'exists', problems: [`${file} already exists; strategy files are never overwritten (publish a new version instead)`] };
  }
  fs.writeFileSync(file, `${JSON.stringify(result.definition, null, 2)}\n`, { flag: 'wx' });
  return { ok: true, kind: 'strategy', written: [file] };
}

function unpackCatalogue(raw: unknown, options: CatalogueUnpackOptions): CatalogueUnpackResult {
  const parsed = catalogueExportDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid', problems: parsed.error.issues.map((issue) => `[${issue.path.map(String).join('.')}] ${issue.message}`) };
  }
  const context = { weapons: options.weapons, strategies: options.strategies ?? loadStrategyRegistry({ weightTable: BUILD_FOCUS_WEIGHTS }) };
  const problems: string[] = [];
  const entries: CatalogueEntry[] = [];
  parsed.data.entries.forEach((rawEntry, index) => {
    const result = validateCatalogueEntry(rawEntry, context);
    if (result.ok) entries.push(result.entry);
    else problems.push(...formatCatalogueIssues(`entries[${index}]`, result.issues));
  });
  const keys = new Set<string>();
  for (const entry of entries) {
    if (keys.has(entry.catalogueKey)) problems.push(`entries: ${entry.catalogueKey} appears twice`);
    keys.add(entry.catalogueKey);
  }

  const catalogueDirectory = options.catalogueDirectory ?? CATALOGUE_DIRECTORY;
  const imageDirectory = options.imageDirectory ?? REPOSITORY_IMAGE_DIRECTORY;
  const writes: PlannedWrite[] = entries.map((entry) => ({
    file: path.join(catalogueDirectory, `${entry.catalogueKey}.json`),
    data: `${JSON.stringify(entry, null, 2)}\n`,
  }));
  for (const [imageKey, base64] of Object.entries(parsed.data.images)) {
    const match = EXPORT_IMAGE_KEY.exec(imageKey);
    const entry = entries.find((e) => e.catalogueKey === match?.[1]);
    const slot = Number(match?.[2]);
    if (!match || !entry || !entry.blueprints.some((b) => b.slot === slot)) {
      problems.push(`images.${imageKey}: no matching Catalogue_Key and Blueprint_Slot in this document`);
      continue;
    }
    const buffer = Buffer.from(base64, 'base64');
    if (!isWebp(buffer)) {
      problems.push(`images.${imageKey}: not a WebP image`);
      continue;
    }
    writes.push({ file: path.join(imageDirectory, repositoryImageRelativePath(entry.catalogueKey, slot)), data: buffer });
  }
  if (problems.length > 0) return { ok: false, reason: 'invalid', problems };

  const existing = writes.filter((write) => fs.existsSync(write.file)).map((write) => write.file);
  if (existing.length > 0 && !options.force) {
    return { ok: false, reason: 'exists', problems: existing.map((file) => `${file} already exists (use --force to overwrite)`) };
  }
  for (const write of writes) {
    fs.mkdirSync(path.dirname(write.file), { recursive: true });
    fs.writeFileSync(write.file, write.data);
  }
  return { ok: true, kind: 'catalogue', written: writes.map((write) => write.file) };
}

/** Unpack a parsed input document (strategy file or Catalogue_Export). */
export function unpackDocument(raw: unknown, options: CatalogueUnpackOptions): CatalogueUnpackResult {
  if (raw !== null && typeof raw === 'object' && 'buildOrder' in raw) return unpackStrategy(raw, options);
  return unpackCatalogue(raw, options);
}

/** Script entry (`scripts/automatonCatalogueUnpack.ts`). Returns the exit code. */
export function runCatalogueUnpackCli(
  argv: readonly string[],
  options: Omit<CatalogueUnpackOptions, 'force'>,
  io: CatalogueCliIo,
): number {
  const args = argv.filter((arg) => arg !== '--');
  const files = args.filter((arg) => !arg.startsWith('--'));
  const flags = args.filter((arg) => arg.startsWith('--'));
  if (files.length !== 1 || flags.some((flag) => flag !== '--force')) {
    io.err('Usage: pnpm run automaton:unpack <file> [--force]');
    return 1;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(path.resolve(files[0]), 'utf8'));
  } catch (error) {
    io.err(`Cannot read ${files[0]}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const result = unpackDocument(raw, { ...options, force: flags.includes('--force') });
  if (!result.ok) {
    io.err(result.reason === 'exists' ? 'Catalogue_Unpack refused, nothing was written:' : 'Catalogue_Unpack aborted: invalid input, nothing was written:');
    for (const problem of result.problems) io.err(`  ${problem}`);
    return 1;
  }
  io.out(`Catalogue_Unpack wrote ${result.written.length} file(s) (${result.kind}):`);
  for (const file of result.written) io.out(`  ${file}`);
  return 0;
}
