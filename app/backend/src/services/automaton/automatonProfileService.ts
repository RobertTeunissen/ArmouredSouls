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
import { validateStableName } from '../../utils/validation';
import { SUBSCRIBABLE_EVENT_TYPES } from '../subscription/eventRegistry';
import type { BuildFocusKey, RefinementStep, StrategyParametersV1, TeamNames, WeaponStage } from '../../types/automaton';
import {
  buildableBlueprintCount,
  compareCatalogueKeys,
  eventOrderIssues,
  requiredTeamNameCountsFor,
  robotsTargetIssues,
  type BlueprintFields,
  type CatalogueIssue,
  type WeaponCatalogue,
} from './automatonCatalogueService';
import {
  assertNoIssues,
  blueprintIssues,
  issuesError,
  automatonUsername,
  AUTOMATON_USERNAME_PREFIX,
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
import { loadWeaponCatalogue } from './stableFacts';
import { getStrategyRegistry } from './strategies/defaultRegistry';
import { describeBuildOrder, highestRobotsTarget, resolveGoalTarget, type BuildOrderDescriptor } from './strategies/strategyParameters';
import type { StrategyRegistry } from './strategies/registry';
import type { UpgradeStrategy } from './strategies/strategyTypes';
import { bestTiersForUsers, type LeagueTier } from './standingsTier';
import type { TieredStandingsMode } from '../../shared/utils/automatonStandingsTier';
import { loadActiveNeedAttention, loadNeedAttention, type NeedAttentionReason } from './needAttention';
import { teamNameMaxRobots, teamsForSlots } from './teamRule';
import { BUILD_FOCUS_WEIGHTS, GROUP_ACADEMY } from './buildFocus';
import { attributePlanView, buildFocusOptions, type AttributePlanSubject, type AttributePlanView } from './attributePlanView';
import type { FacilityType } from './stableFacts';

// ── Types ────────────────────────────────────────────────────────────

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

export { automatonUsername, AUTOMATON_USERNAME_PREFIX, profileEventOrder, profileTeamNames };
/** Opening balance of an Activated stable: the `User.currency` default (R2.2). */
export const AUTOMATON_OPENING_BALANCE = 3_000_000;

export interface CreateDraftInput {
  catalogueKey: string;
  stableName: string;
  franchise: string;
  backstory: string;
  strategyKey: string;
  eventOrder?: string[];
  teamNames?: TeamNames;
}

export interface UpdateProfileInput {
  stableName?: string;
  franchise?: string;
  backstory?: string;
  teamNames?: TeamNames;
  eventOrder?: string[];
}

export interface UpdateStrategyInput {
  strategyKey: string;
  /** Goal id → Goal_Target, merged over the stored targets (same key) or the defaults (new key). */
  targets?: Record<string, number>;
  teamNames?: TeamNames;
}

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

export interface ActivationResult {
  catalogueKey: string;
  userId: number;
  stableName: string;
  activatedAt: string;
}

export type ActivateAllOutcome =
  | { catalogueKey: string; outcome: 'activated'; stableName: string; userId: number }
  | { catalogueKey: string; outcome: 'rejected'; code: string; message: string };

// ── Loading ──────────────────────────────────────────────────────────

type Tx = Prisma.TransactionClient;

const PROFILE_INCLUDE = {
  user: { select: { id: true, stableName: true, currency: true, prestige: true } },
  blueprints: { orderBy: { slotIndex: 'asc' as const } },
} satisfies Prisma.AutomatonProfileInclude;

type ProfileRow = Prisma.AutomatonProfileGetPayload<{ include: typeof PROFILE_INCLUDE }>;
type BlueprintRow = ProfileRow['blueprints'][number];

function notFound(catalogueKey: string): AutomatonError {
  return new AutomatonError(AutomatonErrorCode.AUTOMATON_NOT_FOUND, `No Automaton stable ${catalogueKey}`, 404);
}

function blueprintNotFound(catalogueKey: string, slot: number): AutomatonError {
  return new AutomatonError(AutomatonErrorCode.AUTOMATON_BLUEPRINT_NOT_FOUND, `Stable ${catalogueKey} has no blueprint in slot ${slot}`, 404);
}

/** Lock the profile row and read it with its blueprints. */
async function lockProfile(tx: Tx, catalogueKey: string): Promise<ProfileRow> {
  const locked = await tx.$queryRaw<{ id: number }[]>`
    SELECT "id" FROM "automaton_profiles" WHERE "catalogue_key" = ${catalogueKey} FOR UPDATE`;
  if (locked.length === 0) throw notFound(catalogueKey);
  return tx.automatonProfile.findUniqueOrThrow({ where: { id: locked[0].id }, include: PROFILE_INCLUDE });
}

/** Buildable blueprints of a profile: slots 1…k without a gap (R3.7, R3.6). */
function buildableOf(rows: readonly { slotIndex: number }[]): number {
  return buildableBlueprintCount(rows.map((r) => r.slotIndex));
}

async function readProfile(catalogueKey: string): Promise<ProfileRow> {
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

function registryOf(deps: ProfileServiceDeps): StrategyRegistry {
  return deps.registry ?? getStrategyRegistry();
}

async function weaponsOf(deps: ProfileServiceDeps): Promise<WeaponCatalogue> {
  return deps.weapons ?? loadWeaponCatalogue();
}

function pinnedStrategy(profile: Pick<ProfileRow, 'strategyKey' | 'strategyVersion' | 'catalogueKey'>, registry: StrategyRegistry): UpgradeStrategy {
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

function strategyIssue(message: string): CatalogueIssue[] {
  return [{ rule: 'strategy_unknown', message, path: ['strategyKey'] }];
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function uniqueTarget(error: Prisma.PrismaClientKnownRequestError): string {
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.join(',');
  return typeof target === 'string' ? target : JSON.stringify(error.meta ?? {});
}

// ── Stable names ─────────────────────────────────────────────────────

function stableNameTakenError(stableName: string): AutomatonError {
  return new AutomatonError(AutomatonErrorCode.AUTOMATON_STABLE_NAME_TAKEN, `Stable name "${stableName}" is already taken.`, 409);
}

function assertStableNameFormat(stableName: string): void {
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
async function assertStableNameFree(
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

// ── Read models ──────────────────────────────────────────────────────

export interface TurnSummary {
  seasonNumber: number;
  trigger: string;
  slot: number;
  attempt: number;
  status: string;
  reason: string | null;
  creditsSpent: number;
  creditsReceived: number;
  /** Charged steps of the turn. */
  actionCount: number;
  /** The Goal the turn ended Saving on (position, label, target) or null. */
  savingGoal: { goalId: string; position: number | null; label: string | null; target: number | null } | null;
  startedAt: string;
  finishedAt: string | null;
}

type TurnRow = Prisma.AutomatonTurnGetPayload<Record<string, never>>;

function savingGoalOf(goalOutcomes: Prisma.JsonValue): string | null {
  if (!Array.isArray(goalOutcomes)) return null;
  const last = goalOutcomes[goalOutcomes.length - 1] as { kind?: unknown; goalId?: unknown } | null | undefined;
  return last && last.kind === 'saving' && typeof last.goalId === 'string' ? last.goalId : null;
}

function turnSummary(turn: TurnRow, strategy: UpgradeStrategy | undefined, params: StrategyParametersV1 | null): TurnSummary {
  const goalId = turn.status === 'completed' ? savingGoalOf(turn.goalOutcomes) : null;
  const definition = goalId ? strategy?.buildOrder.find((d) => d.id === goalId) : undefined;
  const descriptor = definition ? describeBuildOrder([definition])[0] : undefined;
  return {
    seasonNumber: turn.seasonNumber,
    trigger: turn.trigger,
    slot: turn.slot,
    attempt: turn.attempt,
    status: turn.status,
    reason: turn.reason,
    creditsSpent: turn.creditsSpent,
    creditsReceived: turn.creditsReceived,
    actionCount: Array.isArray(turn.actions) ? turn.actions.length : 0,
    savingGoal: goalId
      ? {
        goalId,
        position: definition?.position ?? null,
        label: descriptor?.label ?? null,
        target: definition ? resolveGoalTarget(definition, params ?? { targets: {} }) : null,
      }
      : null,
    startedAt: turn.startedAt.toISOString(),
    finishedAt: turn.finishedAt?.toISOString() ?? null,
  };
}

/** Highest robots Goal_Target of the stable's Build_Order (the "target" of Robots current / target). */
function robotTarget(strategy: UpgradeStrategy | undefined, params: StrategyParametersV1 | null): number | null {
  if (!strategy) return null;
  return highestRobotsTarget(strategy.buildOrder, params ?? { targets: {} });
}

export interface ProfileListItem {
  catalogueKey: string;
  stableName: string;
  franchise: string;
  status: 'draft' | 'active';
  origin: string;
  strategyKey: string;
  strategyVersion: number;
  strategyDisplayName: string | null;
  blueprintCount: number;
  robots: { current: number; target: number | null };
  credits: number | null;
  prestige: number | null;
  /** Highest current tier over played standings rows only; null when the stable has not played a tiered mode. */
  bestTier: LeagueTier | null;
  /** The mode holding `bestTier`; null exactly when `bestTier` is null. */
  bestTierMode: TieredStandingsMode | null;
  lastTurn: TurnSummary | null;
  activatedAt: string | null;
  /** Need_Attention reasons in the approved order; empty for a draft (R11.12). */
  needAttention: NeedAttentionReason[];
}

export interface ProfileListQuery {
  status?: 'draft' | 'active';
  strategy?: string;
  /** true: only stables that Need_Attention; false: only those that do not (R11.11). */
  attention?: boolean;
  page: number;
  limit: number;
}

export interface ProfileListPage {
  items: ProfileListItem[];
  total: number;
  page: number;
  limit: number;
}

/** Profiles with progress, ordered by Catalogue_Key (R11.2). */
export async function listProfiles(query: ProfileListQuery, deps: ProfileServiceDeps = {}): Promise<ProfileListPage> {
  const registry = registryOf(deps);
  const filters: Prisma.AutomatonProfileWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.strategy ? { strategyKey: query.strategy } : {}),
  };
  let where = filters;
  if (query.attention !== undefined) {
    // Need_Attention is computed, never stored: classify the matching active stables, then filter by id.
    const attention = await loadActiveNeedAttention(filters);
    const flagged = [...attention].flatMap(([id, reasons]) => (reasons.length > 0 ? [id] : []));
    where = query.attention
      ? { AND: [filters, { id: { in: flagged } }] }
      : { AND: [filters, { id: { notIn: flagged } }] };
  }
  const [total, rows] = await Promise.all([
    prisma.automatonProfile.count({ where }),
    prisma.automatonProfile.findMany({
      where,
      orderBy: { catalogueKey: 'asc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        user: { select: { id: true, stableName: true, currency: true, prestige: true, _count: { select: { robots: true } } } },
        _count: { select: { blueprints: true } },
        turns: { orderBy: { startedAt: 'desc' }, take: 1 },
      },
    }),
  ]);
  const userIds = rows.flatMap((row) => (row.userId === null ? [] : [row.userId]));
  const [tiers, attentionByProfile] = await Promise.all([
    bestTiersForUsers(userIds),
    loadNeedAttention(rows.flatMap((row) => (row.status === 'active' ? [{ profileId: row.id, balance: row.user?.currency ?? null }] : []))),
  ]);
  const items = rows.map((row): ProfileListItem => {
    const strategy = registry.getStrategy(row.strategyKey, row.strategyVersion);
    const params = strategy ? storedParameters(strategy, row.strategyParameters) : null;
    const best = row.userId === null ? null : tiers.get(row.userId) ?? null;
    return {
      catalogueKey: row.catalogueKey,
      stableName: profileStableName(row),
      franchise: row.franchise,
      status: row.status,
      origin: row.origin,
      strategyKey: row.strategyKey,
      strategyVersion: row.strategyVersion,
      strategyDisplayName: strategy?.displayName ?? null,
      blueprintCount: row._count.blueprints,
      robots: { current: row.user?._count.robots ?? 0, target: robotTarget(strategy, params) },
      credits: row.user?.currency ?? null,
      prestige: row.user?.prestige ?? null,
      bestTier: best?.tier ?? null,
      bestTierMode: best?.mode ?? null,
      lastTurn: row.turns[0] ? turnSummary(row.turns[0], strategy, params) : null,
      activatedAt: row.activatedAt?.toISOString() ?? null,
      needAttention: attentionByProfile.get(row.id) ?? [],
    };
  });
  return { items, total, page: query.page, limit: query.limit };
}

export interface BlueprintView extends BlueprintRecord {
  id: number;
  imageUrl: string | null;
  /** The live robot built from this blueprint, if any. */
  liveRobot: { id: number; name: string } | null;
}

export interface TeamRowView {
  size: 2 | 3;
  index: number;
  slots: number[];
  name: string | null;
  /** Robot names of the live robots in the team's slots (null for a slot without one). */
  members: (string | null)[];
  state: 'formed' | 'waiting';
  /** The slot whose robot forms the team (its highest slot), when waiting. */
  waitsForSlot: number | null;
}

export interface ProfileDetail {
  catalogueKey: string;
  stableName: string;
  franchise: string;
  backstory: string;
  status: 'draft' | 'active';
  origin: string;
  activatedAt: string | null;
  userId: number | null;
  credits: number | null;
  prestige: number | null;
  strategy: {
    key: string;
    version: number;
    displayName: string | null;
    latestVersion: number | null;
    /** The numbered Build_Order with this stable's Goal_Targets. */
    buildOrder: (BuildOrderDescriptor & { target: number })[];
    parametersValid: boolean;
  };
  teamNames: TeamNames;
  requiredTeamNames: { twoVsTwo: number; threeVsThree: number } | null;
  teams: TeamRowView[];
  eventOrder: string[];
  blueprints: BlueprintView[];
  registeredTeams: { id: number; teamSize: number; teamName: string; robotIds: number[] }[];
  lastTurn: TurnSummary | null;
  /**
   * The Editor's attributes plans, one per attributes Goal (R11.10): the live
   * robots, or the blueprints up to the highest robots target of a stable
   * without robots.
   */
  attributePlans: AttributePlanView[];
  /** Build_Focus presets for the blueprint editor (admin-only text). */
  buildFocusOptions: { key: BuildFocusKey; displayName: string; description: string }[];
}

/** Robots an attributes plan covers: the live robots, else the blueprints up to the robots target. */
function attributePlanSubjects(
  blueprints: readonly { id: number; slotIndex: number; robotName: string; buildFocus: string }[],
  liveBlueprintIds: ReadonlySet<number>,
  robotsTarget: number | null,
): AttributePlanSubject[] {
  const live = blueprints.filter((b) => liveBlueprintIds.has(b.id));
  const chosen = live.length > 0 ? live : blueprints.filter((b) => b.slotIndex <= (robotsTarget ?? 0));
  return chosen.map((b) => ({ slot: b.slotIndex, robotName: b.robotName, buildFocus: b.buildFocus as BuildFocusKey }));
}

/** One profile with blueprints, live robots, teams and the last turn (R11.2). */
export async function getProfileDetail(catalogueKey: string, deps: ProfileServiceDeps = {}): Promise<ProfileDetail> {
  const registry = registryOf(deps);
  const profile = await readProfile(catalogueKey);
  const strategy = registry.getStrategy(profile.strategyKey, profile.strategyVersion);
  const params = strategy ? storedParameters(strategy, profile.strategyParameters) : null;
  const robots = profile.userId === null
    ? []
    : await prisma.robot.findMany({
      where: { userId: profile.userId },
      select: { id: true, name: true, automatonBlueprintId: true, automatonSlotIndex: true },
      orderBy: { id: 'asc' },
    });
  const teams = profile.userId === null
    ? []
    : await prisma.teamBattle.findMany({
      where: { stableId: profile.userId },
      select: { id: true, teamSize: true, teamName: true, members: { select: { robotId: true }, orderBy: { slotIndex: 'asc' } } },
      orderBy: { id: 'asc' },
    });
  const lastTurn = await prisma.automatonTurn.findFirst({ where: { profileId: profile.id }, orderBy: { startedAt: 'desc' } });
  const academyRows = profile.userId === null
    ? []
    : await prisma.facility.findMany({
      where: { userId: profile.userId, facilityType: { in: Object.values(GROUP_ACADEMY) } },
      select: { facilityType: true, level: true },
    });
  const academyLevels = Object.fromEntries(academyRows.map((row) => [row.facilityType, row.level])) as Partial<Record<FacilityType, number>>;
  const liveBlueprintIds = new Set(robots.flatMap((r) => (r.automatonBlueprintId === null ? [] : [r.automatonBlueprintId])));
  const planSubjects = attributePlanSubjects(profile.blueprints, liveBlueprintIds, strategy && params ? highestRobotsTarget(strategy.buildOrder, params) : null);
  const attributePlans = strategy
    ? strategy.buildOrder
      .filter((spec) => spec.type === 'attributes')
      .map((spec) => attributePlanView(
        { goalId: spec.id, target: params?.targets[spec.id] ?? spec.defaultTarget, isMax: spec.isMax },
        planSubjects,
        academyLevels,
        BUILD_FOCUS_WEIGHTS,
      ))
    : [];

  const robotBySlot = new Map<number, { id: number; name: string }>();
  for (const robot of robots) {
    if (robot.automatonSlotIndex !== null) robotBySlot.set(robot.automatonSlotIndex, { id: robot.id, name: robot.name });
  }
  const teamNames = profileTeamNames(profile);
  // The Teams card rows: the Team_Rule over slots 1…min(highest robots bound, buildable blueprints) (design §17.2).
  const buildable = buildableOf(profile.blueprints);
  const maxRobots = strategy ? teamNameMaxRobots(strategy.buildOrder, buildable) : buildable;
  const allSlots = Array.from({ length: maxRobots }, (_, i) => i + 1);
  const teamRows = teamsForSlots(allSlots).map((team): TeamRowView => {
    const members = team.slots.map((slot) => robotBySlot.get(slot)?.name ?? null);
    const formed = members.every((m) => m !== null);
    return {
      size: team.size,
      index: team.index,
      slots: [...team.slots],
      name: (team.size === 2 ? teamNames.twoVsTwo : teamNames.threeVsThree)[team.index] ?? null,
      members,
      state: formed ? 'formed' : 'waiting',
      waitsForSlot: formed ? null : Math.max(...team.slots),
    };
  });

  return {
    catalogueKey: profile.catalogueKey,
    stableName: profileStableName(profile),
    franchise: profile.franchise,
    backstory: profile.backstory,
    status: profile.status,
    origin: profile.origin,
    activatedAt: profile.activatedAt?.toISOString() ?? null,
    userId: profile.userId,
    credits: profile.user?.currency ?? null,
    prestige: profile.user?.prestige ?? null,
    strategy: {
      key: profile.strategyKey,
      version: profile.strategyVersion,
      displayName: strategy?.displayName ?? null,
      latestVersion: registry.latestVersion(profile.strategyKey) ?? null,
      buildOrder: strategy
        ? describeBuildOrder(strategy.buildOrder).map((d) => ({ ...d, target: params?.targets[d.goalId] ?? d.defaultTarget }))
        : [],
      parametersValid: params !== null,
    },
    teamNames,
    requiredTeamNames: strategy ? requiredTeamNameCountsFor(strategy, buildable) : null,
    teams: teamRows,
    eventOrder: profileEventOrder(profile),
    blueprints: profile.blueprints.map((row): BlueprintView => {
      const live = robots.find((r) => r.automatonBlueprintId === row.id);
      return { ...blueprintRecord(row), id: row.id, imageUrl: row.imageUrl, liveRobot: live ? { id: live.id, name: live.name } : null };
    }),
    registeredTeams: teams.map((t) => ({ id: t.id, teamSize: t.teamSize, teamName: t.teamName, robotIds: t.members.map((m) => m.robotId) })),
    lastTurn: lastTurn ? turnSummary(lastTurn, strategy, params) : null,
    attributePlans,
    buildFocusOptions: buildFocusOptions(),
  };
}

export interface TurnRecordPage {
  items: (TurnSummary & { startBalance: number; endBalance: number | null; durationMs: number | null; actions: Prisma.JsonValue; goalOutcomes: Prisma.JsonValue; upkeepIssues: Prisma.JsonValue })[];
  total: number;
  page: number;
  limit: number;
}

/** Turn_Records of one profile, newest first (R11.2). */
export async function listTurnRecords(catalogueKey: string, page: number, limit: number, deps: ProfileServiceDeps = {}): Promise<TurnRecordPage> {
  const profile = await prisma.automatonProfile.findUnique({
    where: { catalogueKey },
    select: { id: true, strategyKey: true, strategyVersion: true, strategyParameters: true },
  });
  if (!profile) throw notFound(catalogueKey);
  const strategy = registryOf(deps).getStrategy(profile.strategyKey, profile.strategyVersion);
  const params = strategy ? storedParameters(strategy, profile.strategyParameters) : null;
  const [total, rows] = await Promise.all([
    prisma.automatonTurn.count({ where: { profileId: profile.id } }),
    prisma.automatonTurn.findMany({
      where: { profileId: profile.id },
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return {
    items: rows.map((row) => ({
      ...turnSummary(row, strategy, params),
      startBalance: row.startBalance,
      endBalance: row.endBalance,
      durationMs: row.durationMs,
      actions: row.actions,
      goalOutcomes: row.goalOutcomes,
      upkeepIssues: row.upkeepIssues,
    })),
    total,
    page,
    limit,
  };
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

