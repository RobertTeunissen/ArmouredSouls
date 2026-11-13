/**
 * Admin_Automaton_Control profile service (Spec #55, R2.1–R2.6, R3.1–R3.12,
 * R6.4, R6.5, R11.2, design §13, §17.1, task 9.1).
 *
 * Draft CRUD, renames, Team_Names and Event_Order, blueprint CRUD with the
 * live-robot rules, strategy and Goal_Target updates, Activation and
 * activate-all-drafts, and the read models of the admin page. Every mutation
 * locks the profile row (`FOR UPDATE`) and validates and writes inside one
 * transaction, so concurrent edits cannot leave a wrong blueprint or
 * Team_Names count behind.
 *
 * Nothing here touches a live robot, team, subscription, weapon or balance
 * (R2.4, R3.11, R11.5): edits reach live robots only through the next
 * Automaton_Turn. The one exception is the blueprint image, which the image
 * service sets on the live robot in the same request (R3.10).
 *
 * Decision (closest to spec): a new Draft_Automaton has no blueprints yet, so
 * its robots Goal_Targets necessarily exceed the blueprint count; R3.7 lists
 * the operations it rejects (parameter update, strategy assignment, upgrade,
 * blueprint deletion, Catalogue_Entry) and draft creation is not one of them.
 * Activation enforces R3.7 (R2.3).
 */
import { randomBytes } from 'crypto';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { Prisma } from '../../../generated/prisma';
import { AppError } from '../../errors/AppError';
import { AutomatonError, AutomatonErrorCode } from '../../errors/automatonErrors';
import { hashPassword } from '../auth/passwordService';
import { SUBSCRIBABLE_EVENT_TYPES } from '../subscription/eventRegistry';
import type { StrategyParametersV1 } from '../../types/automaton';
import {
  buildableBlueprintCount,
  compareCatalogueKeys,
  eventOrderIssues,
  robotsTargetIssues,
  type BlueprintFields,
  type CatalogueIssue,
} from './automatonCatalogueService';
import {
  assertNoIssues,
  blueprintIssues,
  issuesError,
  automatonUsername,
  nextFreeSlot,
  profileEventOrder,
  profileTeamNames,
  profileIssues,
  resolveParameters,
  storedParameters,
  teamNamesIssuesFor,
  type BlueprintRecord,
} from './automatonProfileRules';
import { deleteProfileImages } from './automatonImageService';
import type { UpgradeStrategy } from './strategies/strategyTypes';
import {
  type ProfileServiceDeps,
  type Tx,
  blueprintNotFound,
  lockProfile,
  buildableOf,
  blueprintRecord,
  profileStableName,
  registryOf,
  weaponsOf,
  pinnedStrategy,
  strategyIssue,
  json,
  isUniqueViolation,
  uniqueTarget,
  stableNameTakenError,
  assertStableNameFormat,
  assertStableNameFree,
} from './automatonProfileStore';
import { getProfileDetail } from './automatonProfileQueries';
import type {
  ActivateAllOutcome,
  ActivationResult,
  CreateDraftInput,
  ProfileDetail,
  TeamNames,
  UpdateProfileInput,
  UpdateStrategyInput,
} from '../../shared/types';

/** Opening balance of an Activated stable: the `User.currency` default (R2.2). */
export const AUTOMATON_OPENING_BALANCE = 3_000_000;

export type BlueprintInput = BlueprintFields;

export interface AddBlueprintInput extends BlueprintInput {
  slot?: number;
  teamNames?: TeamNames;
}

export type UpdateBlueprintInput = Partial<BlueprintInput> & { slot?: number; teamNames?: TeamNames };

export interface DeleteBlueprintInput {
  teamNames?: TeamNames;
}

export interface MutationResult<T> {
  result: T;
  /** Field names that changed, for the admin audit summary (R11.3). */
  changedFields: string[];
}

// ── Draft lifecycle ──────────────────────────────────────────────────

/** Create a Draft_Automaton with the latest version of a strategy and its default Goal_Targets (R11.2). */
export async function createDraft(input: CreateDraftInput, deps: ProfileServiceDeps = {}): Promise<MutationResult<ProfileDetail>> {
  const registry = registryOf(deps);
  assertStableNameFormat(input.stableName);
  const version = registry.latestVersion(input.strategyKey);
  const strategy = version === undefined ? undefined : registry.getStrategy(input.strategyKey, version);
  if (!strategy) throw issuesError(strategyIssue(`Strategy "${input.strategyKey}" does not exist.`));
  const eventOrder = input.eventOrder ?? [...SUBSCRIBABLE_EVENT_TYPES];
  const teamNames = input.teamNames ?? { twoVsTwo: [], threeVsThree: [] };
  assertNoIssues([...eventOrderIssues(eventOrder), ...teamNamesIssuesFor(strategy, 0, teamNames)]);
  const resolved = resolveParameters(strategy, null);
  if (!resolved.ok) throw issuesError(resolved.issues);

  try {
    await prisma.$transaction(async (tx) => {
      if (await tx.automatonProfile.findUnique({ where: { catalogueKey: input.catalogueKey }, select: { id: true } })) {
        throw new AutomatonError(AutomatonErrorCode.AUTOMATON_KEY_EXISTS, `Catalogue key "${input.catalogueKey}" is already used.`, 409);
      }
      await assertStableNameFree(tx, input.stableName, {});
      await tx.automatonProfile.create({
        data: {
          catalogueKey: input.catalogueKey,
          plannedStableName: input.stableName,
          franchise: input.franchise,
          backstory: input.backstory,
          strategyKey: strategy.key,
          strategyVersion: strategy.version,
          strategyParameters: json(resolved.params),
          teamNames: json(teamNames),
          eventOrder: json(eventOrder),
          status: 'draft',
          origin: 'admin',
        },
      });
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // A concurrent create took the key or the name between the check and the insert.
    throw uniqueTarget(error).includes('catalogue_key') || uniqueTarget(error).includes('catalogueKey')
      ? new AutomatonError(AutomatonErrorCode.AUTOMATON_KEY_EXISTS, `Catalogue key "${input.catalogueKey}" is already used.`, 409)
      : stableNameTakenError(input.stableName);
  }
  return { result: await getProfileDetail(input.catalogueKey, deps), changedFields: Object.keys(input) };
}

/**
 * Update stable name, franchise, backstory, Team_Names or Event_Order (R3.5,
 * R3.6, R3.8). A rename of an Active_Automaton updates `User.stableName`
 * under the `PUT /api/user/profile` rules; everything else applies from the
 * next Automaton_Turn (R3.11).
 */
export async function updateProfile(catalogueKey: string, input: UpdateProfileInput, deps: ProfileServiceDeps = {}): Promise<MutationResult<ProfileDetail>> {
  const registry = registryOf(deps);
  if (input.stableName !== undefined) assertStableNameFormat(input.stableName);
  const changedFields: string[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      const profile = await lockProfile(tx, catalogueKey);
      const data: Prisma.AutomatonProfileUpdateInput = {};
      const issues: CatalogueIssue[] = [];
      if (input.teamNames !== undefined) {
        issues.push(...teamNamesIssuesFor(pinnedStrategy(profile, registry), buildableOf(profile.blueprints), input.teamNames));
        data.teamNames = json(input.teamNames);
        changedFields.push('teamNames');
      }
      if (input.eventOrder !== undefined) {
        issues.push(...eventOrderIssues(input.eventOrder));
        data.eventOrder = json(input.eventOrder);
        changedFields.push('eventOrder');
      }
      assertNoIssues(issues);
      if (input.franchise !== undefined) {
        data.franchise = input.franchise;
        changedFields.push('franchise');
      }
      if (input.backstory !== undefined) {
        data.backstory = input.backstory;
        changedFields.push('backstory');
      }
      if (input.stableName !== undefined && input.stableName !== profileStableName(profile)) {
        await assertStableNameFree(tx, input.stableName, { userId: profile.userId, profileId: profile.id });
        if (profile.status === 'active' && profile.userId !== null) {
          await tx.user.update({ where: { id: profile.userId }, data: { stableName: input.stableName } });
        } else {
          data.plannedStableName = input.stableName;
        }
        changedFields.push('stableName');
      }
      if (Object.keys(data).length > 0) await tx.automatonProfile.update({ where: { id: profile.id }, data });
    });
  } catch (error) {
    if (isUniqueViolation(error) && input.stableName !== undefined) throw stableNameTakenError(input.stableName);
    throw error;
  }
  return { result: await getProfileDetail(catalogueKey, deps), changedFields };
}

/** Delete a Draft_Automaton, its blueprints and its uploaded images (R2.6). Active profiles are rejected. */
export async function deleteDraft(catalogueKey: string): Promise<MutationResult<{ catalogueKey: string }>> {
  await prisma.$transaction(async (tx) => {
    const profile = await lockProfile(tx, catalogueKey);
    if (profile.status !== 'draft') {
      throw new AutomatonError(AutomatonErrorCode.AUTOMATON_NOT_DRAFT, `${catalogueKey} is active; an active stable cannot be deleted.`, 409);
    }
    await tx.automatonProfile.delete({ where: { id: profile.id } }); // blueprints cascade
  });
  await deleteProfileImages(catalogueKey);
  return { result: { catalogueKey }, changedFields: ['deleted'] };
}

// ── Strategy ─────────────────────────────────────────────────────────

/**
 * Assign a strategy or change Goal_Targets (R6.4, R6.5). The same key keeps
 * the pinned version (a parameter update); a new key takes its latest
 * version. Rejected with `AUTOMATON_BLUEPRINTS_TOO_FEW` when a robots
 * Goal_Target would exceed the blueprints (R3.7) and with
 * `AUTOMATON_TEAM_NAMES_MISMATCH` when the Team_Names (the stored ones or the
 * optional `teamNames`) do not fit the new bounds (R3.6).
 */
export async function updateStrategy(catalogueKey: string, input: UpdateStrategyInput, deps: ProfileServiceDeps = {}): Promise<MutationResult<ProfileDetail>> {
  const registry = registryOf(deps);
  const changedFields: string[] = [];
  await prisma.$transaction(async (tx) => {
    const profile = await lockProfile(tx, catalogueKey);
    const sameKey = input.strategyKey === profile.strategyKey;
    const version = sameKey ? profile.strategyVersion : registry.latestVersion(input.strategyKey);
    const strategy = version === undefined ? undefined : registry.getStrategy(input.strategyKey, version);
    if (!strategy) throw issuesError(strategyIssue(`Strategy "${input.strategyKey}"${sameKey ? ` v${profile.strategyVersion}` : ''} does not exist.`));
    const base = sameKey ? storedParameters(strategy, profile.strategyParameters) : null;
    const resolved = resolveParameters(strategy, base, input.targets);
    if (!resolved.ok) throw issuesError(resolved.issues);
    const teamNames = input.teamNames ?? profileTeamNames(profile);
    const buildable = buildableOf(profile.blueprints);
    assertNoIssues([
      ...robotsTargetIssues(strategy, resolved.params, buildable),
      ...teamNamesIssuesFor(strategy, buildable, teamNames),
    ]);
    if (!sameKey) changedFields.push('strategyKey', 'strategyVersion');
    if (input.targets !== undefined || !sameKey) changedFields.push('strategyParameters');
    if (input.teamNames !== undefined) changedFields.push('teamNames');
    await tx.automatonProfile.update({
      where: { id: profile.id },
      data: {
        strategyKey: strategy.key,
        strategyVersion: strategy.version,
        strategyParameters: json(resolved.params),
        teamNames: json(teamNames),
      },
    });
  });
  return { result: await getProfileDetail(catalogueKey, deps), changedFields };
}

// ── Blueprints ───────────────────────────────────────────────────────

function blueprintData(fields: BlueprintFields): Omit<Prisma.AutomatonRobotBlueprintUncheckedCreateInput, 'profileId' | 'slotIndex'> {
  return {
    robotName: fields.robotName,
    loadoutType: fields.loadoutType,
    stance: fields.stance,
    yieldThreshold: fields.yieldThreshold,
    buildFocus: fields.buildFocus,
    weaponPath: json(fields.weaponPath),
    refinementPlan: json(fields.refinementPlan),
  };
}

function inPlayError(catalogueKey: string, slot: number, action: string): AutomatonError {
  return new AutomatonError(
    AutomatonErrorCode.AUTOMATON_BLUEPRINT_IN_PLAY,
    `A robot built from blueprint ${slot} of ${catalogueKey} is in play; the blueprint cannot be ${action} while the robot exists.`,
    409,
  );
}

async function liveRobotCount(tx: Tx, blueprintId: number): Promise<number> {
  return tx.robot.count({ where: { automatonBlueprintId: blueprintId } });
}

/** Add a Robot_Blueprint in the next free slot or the given one (R3.1–R3.4, R3.6). */
export async function addBlueprint(catalogueKey: string, input: AddBlueprintInput, deps: ProfileServiceDeps = {}): Promise<MutationResult<ProfileDetail>> {
  const registry = registryOf(deps);
  const weapons = await weaponsOf(deps);
  const { slot: requestedSlot, teamNames: requestedNames, ...fields } = input;
  const changedFields = ['blueprints'];
  await prisma.$transaction(async (tx) => {
    const profile = await lockProfile(tx, catalogueKey);
    const records = profile.blueprints.map(blueprintRecord);
    const slot = requestedSlot ?? nextFreeSlot(records.map((r) => r.slot));
    if (slot === null || records.some((r) => r.slot === slot)) {
      throw new AutomatonError(
        AutomatonErrorCode.AUTOMATON_SLOT_TAKEN,
        slot === null ? `${catalogueKey} already has 11 blueprints.` : `Blueprint slot ${slot} of ${catalogueKey} is taken.`,
        409,
      );
    }
    const record: BlueprintRecord = { ...fields, slot };
    const strategy = pinnedStrategy(profile, registry);
    const teamNames = requestedNames ?? profileTeamNames(profile);
    assertNoIssues([
      ...blueprintIssues(record, records, weapons),
      ...teamNamesIssuesFor(strategy, buildableBlueprintCount([...records.map((r) => r.slot), slot]), teamNames),
    ]);
    await tx.automatonRobotBlueprint.create({ data: { profileId: profile.id, slotIndex: slot, imageUrl: null, ...blueprintData(fields) } });
    if (requestedNames !== undefined) {
      await tx.automatonProfile.update({ where: { id: profile.id }, data: { teamNames: json(teamNames) } });
      changedFields.push('teamNames');
    }
  });
  return { result: await getProfileDetail(catalogueKey, deps), changedFields };
}

/**
 * Edit a Robot_Blueprint (R3.2–R3.4, R3.9–R3.12). The merged blueprint is
 * validated, so a loadout or Weapon_Path change is checked against the
 * Refinement_Plan. A robot name change never renames the live robot (R3.9);
 * a slot change is rejected while a live robot is linked (R3.12). A slot
 * change can open or close a gap and so change the buildable blueprint
 * count: it is rejected when a robots Goal_Target would exceed the new count
 * (R3.7) or when the Team_Names (stored or the optional `teamNames`) do not
 * fit it (R3.6).
 */
export async function updateBlueprint(
  catalogueKey: string,
  slot: number,
  input: UpdateBlueprintInput,
  deps: ProfileServiceDeps = {},
): Promise<MutationResult<ProfileDetail>> {
  const registry = registryOf(deps);
  const weapons = await weaponsOf(deps);
  const { slot: newSlot, teamNames: requestedNames, ...patch } = input;
  const changedFields = Object.keys(input);
  await prisma.$transaction(async (tx) => {
    const profile = await lockProfile(tx, catalogueKey);
    const row = profile.blueprints.find((b) => b.slotIndex === slot);
    if (!row) throw blueprintNotFound(catalogueKey, slot);
    const records = profile.blueprints.map(blueprintRecord);
    const targetSlot = newSlot ?? slot;
    const issues: CatalogueIssue[] = [];
    const teamNames = requestedNames ?? profileTeamNames(profile);
    if (targetSlot !== slot) {
      if (await liveRobotCount(tx, row.id) > 0) throw inPlayError(catalogueKey, slot, 'moved to another slot');
      if (records.some((r) => r.slot === targetSlot)) {
        throw new AutomatonError(AutomatonErrorCode.AUTOMATON_SLOT_TAKEN, `Blueprint slot ${targetSlot} of ${catalogueKey} is taken.`, 409);
      }
      const strategy = pinnedStrategy(profile, registry);
      const params = storedParameters(strategy, profile.strategyParameters) ?? resolveParametersOrDefaults(strategy);
      const buildable = buildableBlueprintCount([...records.filter((r) => r.slot !== slot).map((r) => r.slot), targetSlot]);
      issues.push(...robotsTargetIssues(strategy, params, buildable), ...teamNamesIssuesFor(strategy, buildable, teamNames));
    } else if (requestedNames !== undefined) {
      issues.push(...teamNamesIssuesFor(pinnedStrategy(profile, registry), buildableOf(profile.blueprints), teamNames));
    }
    const merged: BlueprintRecord = { ...blueprintRecord(row), ...patch, slot: targetSlot };
    assertNoIssues([...issues, ...blueprintIssues(merged, records.filter((r) => r.slot !== slot), weapons)]);
    await tx.automatonRobotBlueprint.update({ where: { id: row.id }, data: { slotIndex: targetSlot, ...blueprintData(merged) } });
    if (requestedNames !== undefined) {
      await tx.automatonProfile.update({ where: { id: profile.id }, data: { teamNames: json(teamNames) } });
    }
  });
  return { result: await getProfileDetail(catalogueKey, deps), changedFields };
}

/**
 * Delete a Robot_Blueprint (R3.7, R3.12, R3.6): rejected while a live robot
 * is linked, when a robots Goal_Target would exceed the remaining
 * blueprints, or when the Team_Names (stored or the optional `teamNames`) do
 * not fit the new count.
 */
export async function deleteBlueprint(
  catalogueKey: string,
  slot: number,
  input: DeleteBlueprintInput,
  deps: ProfileServiceDeps = {},
): Promise<MutationResult<ProfileDetail>> {
  const registry = registryOf(deps);
  const changedFields = ['blueprints'];
  await prisma.$transaction(async (tx) => {
    const profile = await lockProfile(tx, catalogueKey);
    const row = profile.blueprints.find((b) => b.slotIndex === slot);
    if (!row) throw blueprintNotFound(catalogueKey, slot);
    if (await liveRobotCount(tx, row.id) > 0) throw inPlayError(catalogueKey, slot, 'deleted');
    const strategy = pinnedStrategy(profile, registry);
    const params = storedParameters(strategy, profile.strategyParameters) ?? resolveParametersOrDefaults(strategy);
    const remaining = buildableOf(profile.blueprints.filter((b) => b.slotIndex !== slot));
    const teamNames = input.teamNames ?? profileTeamNames(profile);
    assertNoIssues([
      ...robotsTargetIssues(strategy, params, remaining),
      ...teamNamesIssuesFor(strategy, remaining, teamNames),
    ]);
    await tx.automatonRobotBlueprint.delete({ where: { id: row.id } });
    if (input.teamNames !== undefined) {
      await tx.automatonProfile.update({ where: { id: profile.id }, data: { teamNames: json(teamNames) } });
      changedFields.push('teamNames');
    }
  });
  return { result: await getProfileDetail(catalogueKey, deps), changedFields };
}

function resolveParametersOrDefaults(strategy: UpgradeStrategy): StrategyParametersV1 {
  const resolved = resolveParameters(strategy, null);
  return resolved.ok ? resolved.params : { targets: {} };
}

// ── Activation ───────────────────────────────────────────────────────

/**
 * Activation (R2.2, R2.3): in one transaction, validate the draft and create
 * its `User` (`stableType = automaton`, `isGenerated = false`, unusable
 * password, no email, role `user`, onboarding complete, the account-default
 * ₡3,000,000 as opening balance, no Financial_Pair), link it and set the
 * profile active. Any failed condition rejects with nothing written.
 */
export async function activateProfile(catalogueKey: string, deps: ProfileServiceDeps = {}): Promise<MutationResult<ActivationResult>> {
  const registry = registryOf(deps);
  const weapons = await weaponsOf(deps);
  // Unusable: 32 random bytes, hashed, never stored or logged in plain form (design §13).
  const passwordHash = await hashPassword(randomBytes(32).toString('hex'));
  const username = automatonUsername(catalogueKey);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const profile = await lockProfile(tx, catalogueKey);
      if (profile.status !== 'draft') {
        throw new AutomatonError(AutomatonErrorCode.AUTOMATON_NOT_DRAFT, `${catalogueKey} is already active.`, 409);
      }
      const stableName = profile.plannedStableName ?? '';
      assertStableNameFormat(stableName);
      if (await tx.user.findFirst({ where: { stableName }, select: { id: true } })) throw stableNameTakenError(stableName);
      if (await tx.user.findUnique({ where: { username }, select: { id: true } })) {
        throw new AutomatonError(AutomatonErrorCode.AUTOMATON_USERNAME_TAKEN, `Username "${username}" already exists.`, 409);
      }
      const strategy = registry.getStrategy(profile.strategyKey, profile.strategyVersion);
      if (!strategy) throw issuesError(strategyIssue(`Strategy ${profile.strategyKey} v${profile.strategyVersion} does not exist.`));
      const params = storedParameters(strategy, profile.strategyParameters);
      if (!params) {
        throw issuesError([{ rule: 'target_out_of_bounds', message: `Stored Goal_Targets do not fit ${strategy.key} v${strategy.version}.`, path: ['targets'] }]);
      }
      assertNoIssues(profileIssues({
        strategy,
        params,
        blueprints: profile.blueprints.map(blueprintRecord),
        teamNames: profileTeamNames(profile),
        eventOrder: profileEventOrder(profile),
        weapons,
      }));

      const user = await tx.user.create({
        data: {
          username,
          passwordHash,
          email: null,
          role: 'user',
          stableName,
          // `currency` keeps the account default (₡3,000,000, AUTOMATON_OPENING_BALANCE): an
          // opening balance, not a Financial_Pair, exactly as at registration (R2.2, VC1).
          isGenerated: false,
          stableType: 'automaton',
          hasCompletedOnboarding: true,
        },
        select: { id: true },
      });
      const activatedAt = new Date();
      const updated = await tx.automatonProfile.updateMany({
        where: { id: profile.id, status: 'draft' },
        data: { status: 'active', userId: user.id, activatedAt, plannedStableName: null },
      });
      if (updated.count !== 1) {
        throw new AutomatonError(AutomatonErrorCode.AUTOMATON_NOT_DRAFT, `${catalogueKey} is already active.`, 409);
      }
      return { catalogueKey, userId: user.id, stableName, activatedAt: activatedAt.toISOString() };
    });
    logger.info(`[automaton] Activated ${catalogueKey} as user ${result.userId} (${result.stableName})`);
    return { result, changedFields: ['status', 'userId', 'activatedAt'] };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const target = uniqueTarget(error);
    if (target.includes('username')) {
      throw new AutomatonError(AutomatonErrorCode.AUTOMATON_USERNAME_TAKEN, `Username "${username}" already exists.`, 409);
    }
    throw new AutomatonError(AutomatonErrorCode.AUTOMATON_STABLE_NAME_TAKEN, 'The stable name is already taken.', 409);
  }
}

/**
 * Activate every Draft_Automaton independently, in ascending Catalogue_Key
 * order (R2.5): one rejection never stops the others.
 */
export async function activateAllDrafts(deps: ProfileServiceDeps = {}): Promise<ActivateAllOutcome[]> {
  const resolvedDeps: ProfileServiceDeps = { registry: registryOf(deps), weapons: await weaponsOf(deps) };
  const drafts = (await prisma.automatonProfile.findMany({
    where: { status: 'draft' },
    select: { catalogueKey: true },
  })).sort((a, b) => compareCatalogueKeys(a.catalogueKey, b.catalogueKey));
  const outcomes: ActivateAllOutcome[] = [];
  const inScope = deps.draftScope ?? ((): boolean => true);
  for (const { catalogueKey } of drafts.filter((d) => inScope(d.catalogueKey))) {
    try {
      const { result } = await activateProfile(catalogueKey, resolvedDeps);
      outcomes.push({ catalogueKey, outcome: 'activated', stableName: result.stableName, userId: result.userId });
    } catch (error) {
      if (error instanceof AppError) {
        outcomes.push({ catalogueKey, outcome: 'rejected', code: error.code, message: error.message });
        continue;
      }
      logger.error(`[automaton] Activation of ${catalogueKey} failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`);
      outcomes.push({ catalogueKey, outcome: 'rejected', code: 'UNEXPECTED_ERROR', message: 'Activation failed unexpectedly.' });
    }
  }
  return outcomes;
}

