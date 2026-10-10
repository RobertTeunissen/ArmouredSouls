/**
 * Strategy_Version upgrades (Spec #55, R3.6, R3.7, R6.6, R6.8, R11.3, R11.8,
 * design §14.0a, decision 37, task 9.9).
 *
 * A deploy that adds `{key}.v{n+1}.json` changes no profile; an
 * administrator upgrades one profile or every profile of a strategy that is
 * on an older version:
 *
 * - dry-run (default): per profile, the old → new Goal_Targets from
 *   `migrateTargets` and whether the migrated targets pass R3.7 and the
 *   Team_Names count of the new bounds. Nothing is written.
 * - `confirm: true`: each profile in its own transaction, re-checked under a
 *   row lock: a passing profile gets the migrated targets and the new
 *   `strategyVersion`; a failing one is left unchanged and reported with
 *   `AUTOMATON_BLUEPRINTS_TOO_FEW` or `AUTOMATON_TEAM_NAMES_MISMATCH`, and
 *   raises one operator alert. The route records one audit entry per profile.
 *
 * `evaluateUpgrade` is pure and also backs the Strategy_Draft upgrade
 * warning (R6.14, task 9.10), with the draft as the target version.
 */
import prisma from '../../../lib/prisma';
import logger from '../../../config/logger';
import { Prisma } from '../../../../generated/prisma';
import { AppError } from '../../../errors/AppError';
import { AutomatonError, AutomatonErrorCode } from '../../../errors/automatonErrors';
import type { StrategyParametersV1, TeamNames } from '../../../types/automaton';
import {
  buildableBlueprintCount,
  requiredTeamNameCountsFor,
  robotsTargetIssues,
  teamNamesIssues,
} from '../automatonCatalogueService';
import { issuesError, profileTeamNames } from '../automatonProfileRules';
import { alertUpgradeRejected } from '../automatonObservability';
import { getStrategyRegistry } from './defaultRegistry';
import { migrateTargets, type TargetChange } from './migrateTargets';
import { facilityLabel } from './strategyDefinitionSchema';
import type { StrategyRegistry } from './registry';
import type { GoalSpec, UpgradeStrategy } from './strategyTypes';

// ── Types ────────────────────────────────────────────────────────────

/** What the upgrade needs to know about one profile. */
export interface UpgradeSubject {
  catalogueKey: string;
  stableName: string;
  status: 'draft' | 'active';
  strategyKey: string;
  strategyVersion: number;
  strategyParameters: unknown;
  teamNames: unknown;
  blueprintSlots: readonly number[];
}

/** The target version: a Strategy_Version of the registry or an interpreted Strategy_Draft. */
export type UpgradeTarget = Pick<UpgradeStrategy, 'key' | 'version' | 'buildOrder' | 'parameterSchema'>;

export interface LabelledTargetChange extends TargetChange {
  /** "Robots", "Booking Office", … */
  label: string;
}

export interface UpgradeRejection {
  code: string;
  /** The approved "Error: too few blueprints" / "Error: team names count" text, or the first issue. */
  reason: string;
}

export interface UpgradeEvaluation {
  catalogueKey: string;
  stableName: string;
  status: 'draft' | 'active';
  fromVersion: number;
  toVersion: number;
  changes: LabelledTargetChange[];
  /** The migrated Goal_Targets. */
  params: StrategyParametersV1;
  requiredTeamNames: { twoVsTwo: number; threeVsThree: number };
  passes: boolean;
  rejection: UpgradeRejection | null;
}

export interface UpgradeRequest {
  toVersion: number;
  /** The profiles to upgrade; absent = every profile of the strategy on an older version. */
  catalogueKeys?: string[];
  confirm?: boolean;
  /** New Team_Names; single-profile upgrades only. */
  teamNames?: TeamNames;
}

export interface UpgradeDryRun {
  strategyKey: string;
  toVersion: number;
  confirm: false;
  profiles: UpgradeEvaluation[];
}

export interface UpgradedProfile {
  catalogueKey: string;
  stableName: string;
  fromVersion: number;
  toVersion: number;
  changedFields: string[];
}

export interface RejectedProfile extends UpgradeRejection {
  catalogueKey: string;
  stableName: string;
  fromVersion: number;
}

export interface UpgradeConfirmation {
  strategyKey: string;
  toVersion: number;
  confirm: true;
  upgraded: UpgradedProfile[];
  rejected: RejectedProfile[];
}

export interface StrategyUpgradeDeps {
  registry?: StrategyRegistry;
}

// ── Pure evaluation ──────────────────────────────────────────────────

function changeLabel(change: Pick<TargetChange, 'type' | 'facilityType'>): string {
  return change.type === 'facility' && change.facilityType
    ? facilityLabel(change.facilityType)
    : change.type.charAt(0).toUpperCase() + change.type.slice(1);
}

/** Stored Goal_Targets read leniently: numbers only (migration clamps them to the new bounds). */
function storedTargets(raw: unknown): StrategyParametersV1 {
  const targets = (raw as { targets?: unknown } | null)?.targets;
  if (targets === null || typeof targets !== 'object' || Array.isArray(targets)) return { targets: {} };
  return {
    targets: Object.fromEntries(Object.entries(targets as Record<string, unknown>).filter((entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isInteger(entry[1]))),
  };
}

/**
 * Migrate one profile's Goal_Targets to `to` and check R3.7 and the
 * Team_Names count of the new bounds against its buildable blueprints
 * (slots 1…k without a gap). `from` is the profile's pinned version; when its
 * file is missing every Goal starts at its default.
 */
export function evaluateUpgrade(
  subject: UpgradeSubject,
  from: Pick<UpgradeStrategy, 'buildOrder'> | undefined,
  to: UpgradeTarget,
  teamNames?: TeamNames,
): UpgradeEvaluation {
  const fromOrder: readonly GoalSpec[] = from?.buildOrder ?? [];
  const migration = migrateTargets(fromOrder, to.buildOrder, storedTargets(subject.strategyParameters));
  const buildable = buildableBlueprintCount(subject.blueprintSlots);
  const required = requiredTeamNameCountsFor(to, buildable);
  const names = teamNames ?? profileTeamNames(subject);
  const issues = [
    ...robotsTargetIssues(to, migration.params, buildable),
    ...teamNamesIssues(names, required),
  ];
  const parsed = to.parameterSchema.safeParse(migration.params);
  if (!parsed.success) {
    issues.push({ rule: 'target_out_of_bounds', message: parsed.error.issues[0]?.message ?? 'Goal_Targets do not fit the new version.', path: ['targets'] });
  }
  let rejection: UpgradeRejection | null = null;
  if (issues.length > 0) {
    const error = issuesError(issues);
    rejection = { code: error.code, reason: error.message };
  }
  return {
    catalogueKey: subject.catalogueKey,
    stableName: subject.stableName,
    status: subject.status,
    fromVersion: subject.strategyVersion,
    toVersion: to.version,
    changes: migration.changes.map((change) => ({ ...change, label: changeLabel(change) })),
    params: migration.params,
    requiredTeamNames: required,
    passes: rejection === null,
    rejection,
  };
}

// ── Loading ──────────────────────────────────────────────────────────

const SUBJECT_SELECT = {
  id: true,
  catalogueKey: true,
  status: true,
  plannedStableName: true,
  strategyKey: true,
  strategyVersion: true,
  strategyParameters: true,
  teamNames: true,
  user: { select: { stableName: true } },
  blueprints: { select: { slotIndex: true } },
} satisfies Prisma.AutomatonProfileSelect;

type SubjectRow = Prisma.AutomatonProfileGetPayload<{ select: typeof SUBJECT_SELECT }>;

function toSubject(row: SubjectRow): UpgradeSubject & { id: number } {
  return {
    id: row.id,
    catalogueKey: row.catalogueKey,
    stableName: (row.status === 'active' ? row.user?.stableName : row.plannedStableName) ?? '',
    status: row.status,
    strategyKey: row.strategyKey,
    strategyVersion: row.strategyVersion,
    strategyParameters: row.strategyParameters,
    teamNames: row.teamNames,
    blueprintSlots: row.blueprints.map((b) => b.slotIndex),
  };
}

/** Every profile of a strategy (any version, drafts included), ordered by Catalogue_Key. */
export async function loadStrategySubjects(strategyKey: string): Promise<(UpgradeSubject & { id: number })[]> {
  const rows = await prisma.automatonProfile.findMany({ where: { strategyKey }, select: SUBJECT_SELECT, orderBy: { catalogueKey: 'asc' } });
  return rows.map(toSubject);
}

function notApplicable(catalogueKey: string, strategyKey: string, toVersion: number): AutomatonError {
  return new AutomatonError(
    AutomatonErrorCode.AUTOMATON_UPGRADE_NOT_APPLICABLE,
    `${catalogueKey} is not on an older version of ${strategyKey} than v${toVersion}.`,
    409,
  );
}

function resolveTarget(registry: StrategyRegistry, strategyKey: string, toVersion: number): UpgradeStrategy {
  const to = registry.getStrategy(strategyKey, toVersion);
  if (!to) {
    throw new AutomatonError(AutomatonErrorCode.AUTOMATON_STRATEGY_NOT_FOUND, `Strategy ${strategyKey} v${toVersion} does not exist.`, 404);
  }
  return to;
}

/** The selected profiles: the listed ones (each must be on an older version) or every older profile. */
async function selectSubjects(strategyKey: string, request: UpgradeRequest): Promise<(UpgradeSubject & { id: number })[]> {
  if (!request.catalogueKeys) {
    const rows = await prisma.automatonProfile.findMany({
      where: { strategyKey, strategyVersion: { lt: request.toVersion } },
      select: SUBJECT_SELECT,
      orderBy: { catalogueKey: 'asc' },
    });
    return rows.map(toSubject);
  }
  const keys = [...new Set(request.catalogueKeys)].sort();
  const rows = await prisma.automatonProfile.findMany({ where: { catalogueKey: { in: keys } }, select: SUBJECT_SELECT, orderBy: { catalogueKey: 'asc' } });
  for (const catalogueKey of keys) {
    const row = rows.find((r) => r.catalogueKey === catalogueKey);
    if (!row) throw new AutomatonError(AutomatonErrorCode.AUTOMATON_NOT_FOUND, `No Automaton stable ${catalogueKey}`, 404);
    if (row.strategyKey !== strategyKey || row.strategyVersion >= request.toVersion) throw notApplicable(catalogueKey, strategyKey, request.toVersion);
  }
  return rows.map(toSubject);
}

// ── Entry points ─────────────────────────────────────────────────────

/** Dry-run: old → new Goal_Targets and the R3.6/R3.7 check per profile; writes nothing. */
export async function dryRunUpgrade(strategyKey: string, request: UpgradeRequest, deps: StrategyUpgradeDeps = {}): Promise<UpgradeDryRun> {
  const registry = deps.registry ?? getStrategyRegistry();
  const to = resolveTarget(registry, strategyKey, request.toVersion);
  const subjects = await selectSubjects(strategyKey, request);
  return {
    strategyKey,
    toVersion: to.version,
    confirm: false,
    profiles: subjects.map((s) => evaluateUpgrade(s, registry.getStrategy(s.strategyKey, s.strategyVersion), to, request.teamNames)),
  };
}

type ProfileOutcome =
  | { outcome: 'upgraded'; profile: UpgradedProfile }
  | { outcome: 'rejected'; profile: RejectedProfile };

/** Upgrade one profile in its own transaction, re-checked under a row lock. */
async function upgradeOne(
  subject: UpgradeSubject & { id: number },
  to: UpgradeStrategy,
  registry: StrategyRegistry,
  teamNames: TeamNames | undefined,
): Promise<ProfileOutcome> {
  return prisma.$transaction(async (tx): Promise<ProfileOutcome> => {
    await tx.$queryRaw`SELECT "id" FROM "automaton_profiles" WHERE "id" = ${subject.id} FOR UPDATE`;
    const row = await tx.automatonProfile.findUnique({ where: { id: subject.id }, select: SUBJECT_SELECT });
    if (!row) {
      return { outcome: 'rejected', profile: { catalogueKey: subject.catalogueKey, stableName: subject.stableName, fromVersion: subject.strategyVersion, code: AutomatonErrorCode.AUTOMATON_NOT_FOUND, reason: `No Automaton stable ${subject.catalogueKey}` } };
    }
    const current = toSubject(row);
    if (current.strategyKey !== to.key || current.strategyVersion >= to.version) {
      const error = notApplicable(current.catalogueKey, to.key, to.version);
      return { outcome: 'rejected', profile: { catalogueKey: current.catalogueKey, stableName: current.stableName, fromVersion: current.strategyVersion, code: error.code, reason: error.message } };
    }
    const evaluation = evaluateUpgrade(current, registry.getStrategy(current.strategyKey, current.strategyVersion), to, teamNames);
    if (evaluation.rejection) {
      return { outcome: 'rejected', profile: { catalogueKey: current.catalogueKey, stableName: current.stableName, fromVersion: current.strategyVersion, ...evaluation.rejection } };
    }
    const changedFields = ['strategyVersion', 'strategyParameters'];
    await tx.automatonProfile.update({
      where: { id: current.id },
      data: {
        strategyVersion: to.version,
        strategyParameters: evaluation.params as unknown as Prisma.InputJsonValue,
        ...(teamNames ? { teamNames: teamNames as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    if (teamNames) changedFields.push('teamNames');
    return {
      outcome: 'upgraded',
      profile: { catalogueKey: current.catalogueKey, stableName: current.stableName, fromVersion: current.strategyVersion, toVersion: to.version, changedFields },
    };
  });
}

/**
 * Confirm: upgrade each selected profile on its own (decision 37). A failing
 * profile is left on its version and raises one operator alert.
 */
export async function confirmUpgrade(strategyKey: string, request: UpgradeRequest, deps: StrategyUpgradeDeps = {}): Promise<UpgradeConfirmation> {
  const registry = deps.registry ?? getStrategyRegistry();
  const to = resolveTarget(registry, strategyKey, request.toVersion);
  const subjects = await selectSubjects(strategyKey, request);
  const upgraded: UpgradedProfile[] = [];
  const rejected: RejectedProfile[] = [];
  for (const subject of subjects) {
    try {
      const result = await upgradeOne(subject, to, registry, request.teamNames);
      if (result.outcome === 'upgraded') upgraded.push(result.profile);
      else rejected.push(result.profile);
    } catch (error) {
      // Isolation: one profile's failure never stops the others.
      logger.error(`[automaton-upgrade] ${subject.catalogueKey}: ${error instanceof Error ? error.message : String(error)}`);
      rejected.push({
        catalogueKey: subject.catalogueKey,
        stableName: subject.stableName,
        fromVersion: subject.strategyVersion,
        code: error instanceof AppError ? error.code : 'UNEXPECTED_ERROR',
        reason: error instanceof AppError ? error.message : 'The upgrade failed unexpectedly.',
      });
    }
  }
  await alertUpgradeRejected(rejected.map((r) => ({
    catalogueKey: r.catalogueKey,
    stableName: r.stableName,
    strategyKey,
    fromVersion: r.fromVersion,
    toVersion: to.version,
    reason: `${r.code}: ${r.reason}`,
  })));
  return { strategyKey, toVersion: to.version, confirm: true, upgraded, rejected };
}

export interface UpgradeWarningEntry {
  catalogueKey: string;
  stableName: string;
  fromVersion: number;
  code: string;
  reason: string;
}

/**
 * The upgrade warning of a new-version Strategy_Draft (R6.14, decision 37):
 * every profile of the strategy (on this environment) whose Goal_Targets,
 * migrated from its pinned version to the draft, would be rejected. Read-only.
 */
export async function upgradeWarningFor(draft: UpgradeTarget, registry: StrategyRegistry): Promise<UpgradeWarningEntry[]> {
  const subjects = await loadStrategySubjects(draft.key);
  return subjects.flatMap((subject) => {
    const evaluation = evaluateUpgrade(subject, registry.getStrategy(subject.strategyKey, subject.strategyVersion), draft);
    return evaluation.rejection
      ? [{ catalogueKey: subject.catalogueKey, stableName: subject.stableName, fromVersion: subject.strategyVersion, ...evaluation.rejection }]
      : [];
  });
}
