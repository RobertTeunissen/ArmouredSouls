/**
 * Automaton profile store: loading, locking and the shared row helpers of the
 * Admin_Automaton_Control profile service (Spec #55), plus the stable-name
 * checks. Used by the profile mutations (`automatonProfileService`) and the
 * admin read models (`automatonProfileQueries`).
 *
 * @module services/automaton/automatonProfileStore
 */
import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';
import { AutomatonError, AutomatonErrorCode } from '../../errors/automatonErrors';
import { validateStableName } from '../../utils/validation';
import {
  buildableBlueprintCount,
  type CatalogueIssue,
  type WeaponCatalogue,
} from './automatonCatalogueService';
import {
  issuesError,
  type BlueprintRecord,
} from './automatonProfileRules';
import { loadWeaponCatalogue } from './stableFacts';
import { getStrategyRegistry } from './strategies/defaultRegistry';
import type { StrategyRegistry } from './strategies/registry';
import type { UpgradeStrategy } from './strategies/strategyTypes';
import type {
  RefinementStep,
  WeaponStage,
} from '../../shared/types';

/** Injectable dependencies (tests). */
export interface ProfileServiceDeps {
  registry?: StrategyRegistry;
  weapons?: WeaponCatalogue;
  /**
   * Activate-all only: which drafts to consider (default: every draft). Tests
   * on a shared database limit it to their own drafts, so other drafts are
   * never activated by a test run.
   */
  draftScope?: (catalogueKey: string) => boolean;
}


// ── Loading ──────────────────────────────────────────────────────────

export type Tx = Prisma.TransactionClient;

const PROFILE_INCLUDE = {
  user: { select: { id: true, stableName: true, currency: true, prestige: true } },
  blueprints: { orderBy: { slotIndex: 'asc' as const } },
} satisfies Prisma.AutomatonProfileInclude;

type ProfileRow = Prisma.AutomatonProfileGetPayload<{ include: typeof PROFILE_INCLUDE }>;
type BlueprintRow = ProfileRow['blueprints'][number];

export function notFound(catalogueKey: string): AutomatonError {
  return new AutomatonError(AutomatonErrorCode.AUTOMATON_NOT_FOUND, `No Automaton stable ${catalogueKey}`, 404);
}

export function blueprintNotFound(catalogueKey: string, slot: number): AutomatonError {
  return new AutomatonError(AutomatonErrorCode.AUTOMATON_BLUEPRINT_NOT_FOUND, `Stable ${catalogueKey} has no blueprint in slot ${slot}`, 404);
}

/** Lock the profile row and read it with its blueprints. */
export async function lockProfile(tx: Tx, catalogueKey: string): Promise<ProfileRow> {
  const locked = await tx.$queryRaw<{ id: number }[]>`
    SELECT "id" FROM "automaton_profiles" WHERE "catalogue_key" = ${catalogueKey} FOR UPDATE`;
  if (locked.length === 0) throw notFound(catalogueKey);
  return tx.automatonProfile.findUniqueOrThrow({ where: { id: locked[0].id }, include: PROFILE_INCLUDE });
}

/** Buildable blueprints of a profile: slots 1…k without a gap (R3.7, R3.6). */
export function buildableOf(rows: readonly { slotIndex: number }[]): number {
  return buildableBlueprintCount(rows.map((r) => r.slotIndex));
}

export async function readProfile(catalogueKey: string): Promise<ProfileRow> {
  const profile = await prisma.automatonProfile.findUnique({ where: { catalogueKey }, include: PROFILE_INCLUDE });
  if (!profile) throw notFound(catalogueKey);
  return profile;
}

export function blueprintRecord(row: BlueprintRow): BlueprintRecord {
  return {
    slot: row.slotIndex,
    robotName: row.robotName,
    loadoutType: row.loadoutType as BlueprintRecord['loadoutType'],
    stance: row.stance as BlueprintRecord['stance'],
    yieldThreshold: row.yieldThreshold,
    buildFocus: row.buildFocus as BlueprintRecord['buildFocus'],
    weaponPath: row.weaponPath as unknown as WeaponStage[],
    refinementPlan: row.refinementPlan as unknown as RefinementStep[],
  };
}

/** The display stable name: `User.stableName` once active, the planned name while Draft. */
export function profileStableName(profile: Pick<ProfileRow, 'status' | 'plannedStableName'> & { user: { stableName: string | null } | null }): string {
  return (profile.status === 'active' ? profile.user?.stableName : profile.plannedStableName) ?? '';
}

export function registryOf(deps: ProfileServiceDeps): StrategyRegistry {
  return deps.registry ?? getStrategyRegistry();
}

export async function weaponsOf(deps: ProfileServiceDeps): Promise<WeaponCatalogue> {
  return deps.weapons ?? loadWeaponCatalogue();
}

export function pinnedStrategy(profile: Pick<ProfileRow, 'strategyKey' | 'strategyVersion' | 'catalogueKey'>, registry: StrategyRegistry): UpgradeStrategy {
  const strategy = registry.getStrategy(profile.strategyKey, profile.strategyVersion);
  if (!strategy) {
    throw new AutomatonError(
      AutomatonErrorCode.AUTOMATON_CATALOGUE_INVALID,
      `Strategy ${profile.strategyKey} v${profile.strategyVersion} of ${profile.catalogueKey} has no Strategy_Definition_File`,
      409,
    );
  }
  return strategy;
}

export function strategyIssue(message: string): CatalogueIssue[] {
  return [{ rule: 'strategy_unknown', message, path: ['strategyKey'] }];
}

export function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function uniqueTarget(error: Prisma.PrismaClientKnownRequestError): string {
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.join(',');
  return typeof target === 'string' ? target : JSON.stringify(error.meta ?? {});
}

// ── Stable names ─────────────────────────────────────────────────────

export function stableNameTakenError(stableName: string): AutomatonError {
  return new AutomatonError(AutomatonErrorCode.AUTOMATON_STABLE_NAME_TAKEN, `Stable name "${stableName}" is already taken.`, 409);
}

export function assertStableNameFormat(stableName: string): void {
  const result = validateStableName(stableName);
  if (!result.valid) {
    throw issuesError([{ rule: 'stable_name', message: result.error ?? 'Invalid stable name.', path: ['stableName'] }]);
  }
}

/**
 * A stable name is free when no other `User` has it and no other
 * Automaton_Profile plans it (design §4 D3, R3.8: the `PUT /api/user/profile`
 * rules plus the drafts' planned names).
 */
export async function assertStableNameFree(
  tx: Tx,
  stableName: string,
  exclude: { userId?: number | null; profileId?: number },
): Promise<void> {
  const user = await tx.user.findFirst({
    where: { stableName, ...(exclude.userId ? { NOT: { id: exclude.userId } } : {}) },
    select: { id: true },
  });
  const profile = await tx.automatonProfile.findFirst({
    where: { plannedStableName: stableName, ...(exclude.profileId ? { NOT: { id: exclude.profileId } } : {}) },
    select: { id: true },
  });
  if (user || profile) throw stableNameTakenError(stableName);
}

