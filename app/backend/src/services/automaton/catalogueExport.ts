/**
 * Catalogue_Export (Spec #55, R10.7, design §15.4, task 8.4, service part
 * of `GET /api/admin/automatons/export`).
 *
 * One Catalogue_Entry per Automaton_Profile (Active_Automatons export
 * `User.stableName`), in the repository file format with no image field.
 * Admin-uploaded images (`/uploads/automatons/...`) are embedded as base64
 * WebP under `{catalogueKey}/{slot}`; Repository_Images and blueprints
 * without an image add nothing, because Catalogue_Sync finds Repository_Images
 * by convention (R10.2). Read-only.
 */
import fs from 'fs';
import path from 'path';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import type { EventOrder, RefinementStep, StrategyParametersV1, TeamNames, WeaponStage } from '../../types/automaton';
import { AutomatonError, AutomatonErrorCode } from '../../errors/automatonErrors';
import {
  CATALOGUE_SCHEMA_VERSION,
  catalogueKeySchema,
  compareCatalogueKeys,
  type CatalogueEntry,
  type CatalogueExportDocument,
} from './automatonCatalogueService';
import { getStrategyRegistry } from './strategies/defaultRegistry';
import type { StrategyRegistry } from './strategies/registry';

/** `app/backend/uploads` (served at `/uploads`). */
export const UPLOADS_DIRECTORY = path.resolve(__dirname, '..', '..', '..', 'uploads');
/** An admin upload URL: `/uploads/automatons/{catalogueKey}/{uuid}.webp`. */
const ADMIN_UPLOAD_URL = /^\/uploads\/automatons\/([a-z0-9-]{3,40})\/([A-Za-z0-9-]{1,64})\.webp$/;

export interface CatalogueExportOptions {
  /** Catalogue_Keys to export; all profiles when absent or empty. */
  keys?: readonly string[];
  strategies?: StrategyRegistry;
  uploadsDirectory?: string;
  environment?: string;
}

/** Goal position → Goal_Target for every target that differs from the strategy default. */
function targetOverrides(strategyKey: string, strategyVersion: number, params: StrategyParametersV1, strategies: StrategyRegistry): Record<string, number> {
  const strategy = strategies.getStrategy(strategyKey, strategyVersion);
  if (!strategy) {
    throw new AutomatonError(AutomatonErrorCode.AUTOMATON_CATALOGUE_INVALID, `Strategy ${strategyKey} v${strategyVersion} has no Strategy_Definition_File`, 409);
  }
  const overrides: Record<string, number> = {};
  for (const spec of strategy.buildOrder) {
    const target = params.targets[spec.id];
    if (target !== undefined && target !== spec.defaultTarget) overrides[String(spec.position)] = target;
  }
  return overrides;
}

function readAdminUpload(imageUrl: string, uploadsDirectory: string): string | null {
  const match = ADMIN_UPLOAD_URL.exec(imageUrl);
  if (!match) return null;
  // Components are validated by the pattern above, so the path stays inside uploads/automatons.
  const file = path.join(uploadsDirectory, 'automatons', match[1], `${match[2]}.webp`);
  if (!fs.existsSync(file)) {
    logger.warn(`[catalogue-export] admin upload ${imageUrl} is missing on disk; exported without an image`);
    return null;
  }
  return fs.readFileSync(file).toString('base64');
}

/** Build the export document (R10.7). */
export async function exportCatalogue(options: CatalogueExportOptions = {}): Promise<CatalogueExportDocument> {
  const keys = (options.keys ?? []).map((key) => catalogueKeySchema.parse(key));
  const strategies = options.strategies ?? getStrategyRegistry();
  const uploadsDirectory = options.uploadsDirectory ?? UPLOADS_DIRECTORY;

  const profiles = (await prisma.automatonProfile.findMany({
    where: keys.length > 0 ? { catalogueKey: { in: keys } } : {},
    include: { user: { select: { stableName: true } }, blueprints: { orderBy: { slotIndex: 'asc' } } },
  })).sort((a, b) => compareCatalogueKeys(a.catalogueKey, b.catalogueKey));

  const entries: CatalogueEntry[] = [];
  const images: Record<string, string> = {};
  for (const profile of profiles) {
    const stableName = profile.status === 'active' ? profile.user?.stableName : profile.plannedStableName;
    entries.push({
      schemaVersion: CATALOGUE_SCHEMA_VERSION,
      catalogueKey: profile.catalogueKey,
      stableName: stableName ?? '',
      franchise: profile.franchise,
      backstory: profile.backstory,
      strategy: {
        key: profile.strategyKey,
        version: profile.strategyVersion,
        targetOverrides: targetOverrides(profile.strategyKey, profile.strategyVersion, profile.strategyParameters as unknown as StrategyParametersV1, strategies),
      },
      teamNames: profile.teamNames as unknown as TeamNames,
      eventOrder: profile.eventOrder as unknown as EventOrder,
      blueprints: profile.blueprints.map((blueprint) => ({
        slot: blueprint.slotIndex,
        robotName: blueprint.robotName,
        loadoutType: blueprint.loadoutType as CatalogueEntry['blueprints'][number]['loadoutType'],
        stance: blueprint.stance as CatalogueEntry['blueprints'][number]['stance'],
        yieldThreshold: blueprint.yieldThreshold,
        buildFocus: blueprint.buildFocus as CatalogueEntry['blueprints'][number]['buildFocus'],
        weaponPath: blueprint.weaponPath as unknown as WeaponStage[],
        refinementPlan: blueprint.refinementPlan as unknown as RefinementStep[],
      })),
    });
    for (const blueprint of profile.blueprints) {
      if (blueprint.imageUrl === null) continue;
      const data = readAdminUpload(blueprint.imageUrl, uploadsDirectory);
      if (data !== null) images[`${profile.catalogueKey}/${blueprint.slotIndex}`] = data;
    }
  }
  return {
    schemaVersion: CATALOGUE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    environment: options.environment ?? process.env.NODE_ENV ?? 'development',
    entries,
    images,
  };
}
