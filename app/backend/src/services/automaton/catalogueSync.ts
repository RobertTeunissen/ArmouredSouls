/**
 * Catalogue_Sync (Spec #55, R2.1, R10.3–R10.5, R11.8, design §15.2,
 * task 8.2). `pnpm run automaton:sync [--dry-run]` runs `runCatalogueSyncCli`.
 *
 * Insert-only: a Catalogue_Key with no Automaton_Profile becomes a
 * Draft_Automaton (its blueprints get their Repository_Image when the file
 * exists); an existing profile of any status is untouched except for the
 * image fill: a blueprint with no image whose Repository_Image exists gets it,
 * and so does the live robot built from it if that robot has no image, in one
 * transaction. Nothing is ever deleted or overwritten. An invalid file aborts
 * the run before any write (exit 1). A stable-name conflict skips the entry,
 * is reported and raises an alert. The summary is printed and stored in
 * `automaton_program_settings.last_sync_summary` (not in a dry run).
 */
import fs from 'fs';
import path from 'path';
import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';
import type { CatalogueImageFill, CatalogueSyncConflict, CatalogueSyncSummary } from '../../types/automaton';
import {
  CATALOGUE_DIRECTORY,
  REPOSITORY_IMAGE_DIRECTORY,
  loadCatalogueDirectory,
  repositoryImageRelativePath,
  repositoryImageUrl,
  type LoadedCatalogueEntry,
} from './automatonCatalogueService';
import { alertCatalogueSyncConflicts } from './automatonObservability';
import { getStrategyRegistry } from './strategies/defaultRegistry';
import { ensureProgramSettings, PROGRAM_SETTINGS_ID } from './programSwitch';
import { loadWeaponCatalogue } from './stableFacts';
import type { StrategyRegistry } from './strategies/registry';

export interface CatalogueSyncOptions {
  dryRun?: boolean;
  catalogueDirectory?: string;
  imageDirectory?: string;
  strategies?: StrategyRegistry;
  /** Alert sender for conflicts (defaults to the monitoring webhook). */
  alertConflicts?: (conflicts: readonly string[]) => Promise<unknown>;
}

/** Repository_Images a new draft starts with (set at creation, so not counted as fills). */
export interface DraftImageCount {
  images: number;
  blueprints: number;
}

export type CatalogueSyncResult =
  | { ok: true; dryRun: boolean; summary: CatalogueSyncSummary; draftImages: Record<string, DraftImageCount> }
  | { ok: false; problems: string[] };

function repositoryImage(imageDirectory: string, catalogueKey: string, slot: number): string | null {
  const file = path.join(imageDirectory, repositoryImageRelativePath(catalogueKey, slot));
  return fs.existsSync(file) ? repositoryImageUrl(catalogueKey, slot) : null;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Blueprint fills for an existing profile (every blueprint with no image whose file exists). */
async function fillImages(
  profile: { blueprints: { id: number; slotIndex: number; imageUrl: string | null }[] },
  catalogueKey: string,
  imageDirectory: string,
  dryRun: boolean,
): Promise<CatalogueImageFill[]> {
  const fills: CatalogueImageFill[] = [];
  for (const blueprint of profile.blueprints) {
    if (blueprint.imageUrl !== null) continue; // never replace an admin upload or a Repository_Image
    const url = repositoryImage(imageDirectory, catalogueKey, blueprint.slotIndex);
    if (url === null) continue;
    if (!dryRun) {
      const filled = await prisma.$transaction(async (tx) => {
        const updated = await tx.automatonRobotBlueprint.updateMany({ where: { id: blueprint.id, imageUrl: null }, data: { imageUrl: url } });
        if (updated.count === 0) return false; // set concurrently (admin upload): leave it
        await tx.robot.updateMany({ where: { automatonBlueprintId: blueprint.id, imageUrl: null }, data: { imageUrl: url } });
        return true;
      });
      if (!filled) continue;
    }
    fills.push({ catalogueKey, slot: blueprint.slotIndex, imageUrl: url });
  }
  return fills;
}

async function stableNameTaken(stableName: string): Promise<boolean> {
  const [user, profile] = await Promise.all([
    prisma.user.findFirst({ where: { stableName }, select: { id: true } }),
    prisma.automatonProfile.findFirst({ where: { plannedStableName: stableName }, select: { id: true } }),
  ]);
  return user !== null || profile !== null;
}

async function createDraft({ entry, parameters }: LoadedCatalogueEntry, imageDirectory: string): Promise<void> {
  await prisma.automatonProfile.create({
    data: {
      catalogueKey: entry.catalogueKey,
      plannedStableName: entry.stableName,
      franchise: entry.franchise,
      backstory: entry.backstory,
      strategyKey: entry.strategy.key,
      strategyVersion: entry.strategy.version,
      strategyParameters: parameters as unknown as Prisma.InputJsonValue,
      teamNames: entry.teamNames as unknown as Prisma.InputJsonValue,
      eventOrder: entry.eventOrder as unknown as Prisma.InputJsonValue,
      status: 'draft',
      origin: 'catalogue',
      blueprints: {
        create: entry.blueprints.map((blueprint) => ({
          slotIndex: blueprint.slot,
          robotName: blueprint.robotName,
          imageUrl: repositoryImage(imageDirectory, entry.catalogueKey, blueprint.slot),
          loadoutType: blueprint.loadoutType,
          stance: blueprint.stance,
          yieldThreshold: blueprint.yieldThreshold,
          buildFocus: blueprint.buildFocus,
          weaponPath: blueprint.weaponPath as unknown as Prisma.InputJsonValue,
          refinementPlan: blueprint.refinementPlan as unknown as Prisma.InputJsonValue,
        })),
      },
    },
  });
}

/** Store the summary without touching the Program_Switch row's `updated_at`. */
async function storeSummary(summary: CatalogueSyncSummary): Promise<void> {
  await ensureProgramSettings();
  await prisma.$executeRaw`
    UPDATE "automaton_program_settings"
    SET "last_sync_summary" = ${JSON.stringify(summary)}::jsonb
    WHERE "id" = ${PROGRAM_SETTINGS_ID}`;
}

/** The last stored Catalogue_Sync summary, or null (admin Catalogue tab). */
export async function getLastCatalogueSyncSummary(): Promise<CatalogueSyncSummary | null> {
  const row = await prisma.automatonProgramSetting.findUnique({ where: { id: PROGRAM_SETTINGS_ID }, select: { lastSyncSummary: true } });
  return (row?.lastSyncSummary ?? null) as unknown as CatalogueSyncSummary | null;
}

/** Run Catalogue_Sync (design §15.2). */
export async function syncCatalogue(options: CatalogueSyncOptions = {}): Promise<CatalogueSyncResult> {
  const dryRun = options.dryRun ?? false;
  const imageDirectory = options.imageDirectory ?? REPOSITORY_IMAGE_DIRECTORY;
  const load = loadCatalogueDirectory(
    { weapons: await loadWeaponCatalogue(), strategies: options.strategies ?? getStrategyRegistry() },
    options.catalogueDirectory ?? CATALOGUE_DIRECTORY,
  );
  if (load.problems.length > 0) return { ok: false, problems: load.problems };

  const summary: CatalogueSyncSummary = { ranAt: new Date().toISOString(), added: [], present: [], filled: [], conflicts: [] };
  const draftImages: Record<string, DraftImageCount> = {};
  for (const loaded of load.entries) {
    const { catalogueKey, stableName } = loaded.entry;
    const profile = await prisma.automatonProfile.findUnique({
      where: { catalogueKey },
      select: { blueprints: { select: { id: true, slotIndex: true, imageUrl: true }, orderBy: { slotIndex: 'asc' } } },
    });
    if (profile) {
      summary.present.push(catalogueKey);
      summary.filled.push(...await fillImages(profile, catalogueKey, imageDirectory, dryRun));
      continue;
    }
    const conflict: CatalogueSyncConflict = { catalogueKey, stableName, reason: 'stable_name_taken' };
    if (await stableNameTaken(stableName)) {
      summary.conflicts.push(conflict);
      continue;
    }
    if (!dryRun) {
      try {
        await createDraft(loaded, imageDirectory);
      } catch (error) {
        // A concurrent run or admin took the key or the name between the check and the insert.
        if (!isUniqueViolation(error)) throw error;
        summary.conflicts.push(conflict);
        continue;
      }
    }
    summary.added.push(catalogueKey);
    draftImages[catalogueKey] = {
      images: loaded.entry.blueprints.filter((b) => repositoryImage(imageDirectory, catalogueKey, b.slot) !== null).length,
      blueprints: loaded.entry.blueprints.length,
    };
  }

  if (!dryRun) {
    await storeSummary(summary);
    if (summary.conflicts.length > 0) {
      await (options.alertConflicts ?? alertCatalogueSyncConflicts)(
        summary.conflicts.map((c) => `${c.catalogueKey}: stable name "${c.stableName}" is taken`),
      );
    }
  }
  return { ok: true, dryRun, summary, draftImages };
}

/** Human-readable summary lines (printed by the script). */
export function formatCatalogueSyncSummary(result: Extract<CatalogueSyncResult, { ok: true }>): string[] {
  const { summary, dryRun } = result;
  const verb = dryRun ? 'would add' : 'added';
  const lines = [
    `Catalogue_Sync${dryRun ? ' (dry run, nothing written)' : ''}: ${verb} ${summary.added.length}, already present ${summary.present.length}, images ${dryRun ? 'it would fill' : 'filled'} ${summary.filled.length}, conflicts ${summary.conflicts.length}`,
  ];
  for (const key of summary.added) {
    const count = result.draftImages[key];
    lines.push(`  ${verb} draft: ${key}${count ? ` (Repository_Images for ${count.images} of ${count.blueprints} blueprints)` : ''}`);
  }
  for (const fill of summary.filled) lines.push(`  ${dryRun ? 'would fill' : 'filled'} image: ${fill.catalogueKey} slot ${fill.slot} → ${fill.imageUrl}`);
  for (const conflict of summary.conflicts) lines.push(`  conflict: ${conflict.catalogueKey} — stable name "${conflict.stableName}" is taken; skipped`);
  return lines;
}

export interface CatalogueCliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

const defaultIo: CatalogueCliIo = {
  out: (line) => { process.stdout.write(`${line}\n`); },
  err: (line) => { process.stderr.write(`${line}\n`); },
};

/**
 * Script entry (`scripts/automatonCatalogueSync.ts`). Returns the exit code:
 * 0 on success (also with conflicts), 1 on an invalid file or unknown flag.
 */
export async function runCatalogueSyncCli(
  argv: readonly string[],
  options: Omit<CatalogueSyncOptions, 'dryRun'> = {},
  io: CatalogueCliIo = defaultIo,
): Promise<number> {
  const unknown = argv.filter((arg) => arg !== '--dry-run' && arg !== '--');
  if (unknown.length > 0) {
    io.err(`Unknown argument(s): ${unknown.join(' ')}. Usage: pnpm run automaton:sync [--dry-run]`);
    return 1;
  }
  const result = await syncCatalogue({ ...options, dryRun: argv.includes('--dry-run') });
  if (!result.ok) {
    io.err('Catalogue_Sync aborted: invalid Catalogue_Entries, nothing was written.');
    for (const problem of result.problems) io.err(`  ${problem}`);
    return 1;
  }
  for (const line of formatCatalogueSyncSummary(result)) io.out(line);
  return 0;
}
