/**
 * Automaton profile read models of the admin page (Spec #55): the profile
 * list, the profile detail and the Automaton_Turn records.
 *
 * @module services/automaton/automatonProfileQueries
 */
import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';
import type { StrategyParametersV1 } from '../../types/automaton';
import {
  requiredTeamNameCountsFor,
} from './automatonCatalogueService';
import {
  profileEventOrder,
  profileTeamNames,
  storedParameters,
} from './automatonProfileRules';
import { describeBuildOrder, highestRobotsTarget, resolveGoalTarget } from './strategies/strategyParameters';
import type { UpgradeStrategy } from './strategies/strategyTypes';
import { bestTiersForUsers } from './standingsTier';
import { loadActiveNeedAttention, loadNeedAttention } from './needAttention';
import { teamNameMaxRobots, teamsForSlots } from './teamRule';
import { BUILD_FOCUS_WEIGHTS, GROUP_ACADEMY } from './buildFocus';
import { attributePlanView, buildFocusOptions, type AttributePlanSubject } from './attributePlanView';
import type { FacilityType } from './stableFacts';
import type {
  BlueprintView,
  BuildFocusKey,
  ProfileDetail,
  ProfileListItem,
  ProfileListPage,
  ProfileListQuery,
  TeamRowView,
  TurnRecordPage,
  TurnSummary,
} from '../../shared/types';
import {
  type ProfileServiceDeps,
  notFound,
  buildableOf,
  readProfile,
  blueprintRecord,
  profileStableName,
  registryOf,
} from './automatonProfileStore';

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

/** Profiles with progress, ordered by Catalogue_Key (R11.2). */
/**
 * Each profile's most recent Turn_Record. One DISTINCT ON read of the ids on
 * the `(profile_id, started_at)` index, then the rows: a nested `take: 1`
 * include would load every turn of the season for every listed profile.
 */
async function readLatestTurns(profileIds: readonly number[]): Promise<Map<number, TurnRow>> {
  if (profileIds.length === 0) return new Map();
  const latest = await prisma.$queryRaw<{ id: number }[]>`
    SELECT DISTINCT ON ("profile_id") "id"
    FROM "automaton_turns"
    WHERE "profile_id" IN (${Prisma.join([...profileIds])})
    ORDER BY "profile_id", "started_at" DESC, "id" DESC`;
  if (latest.length === 0) return new Map();
  const turns = await prisma.automatonTurn.findMany({ where: { id: { in: latest.map((row) => row.id) } } });
  return new Map(turns.map((turn) => [turn.profileId, turn]));
}

export async function listProfiles(query: ProfileListQuery & { page: number; limit: number }, deps: ProfileServiceDeps = {}): Promise<ProfileListPage> {
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
      },
    }),
  ]);
  const userIds = rows.flatMap((row) => (row.userId === null ? [] : [row.userId]));
  const [tiers, latestTurns, attentionByProfile] = await Promise.all([
    bestTiersForUsers(userIds),
    readLatestTurns(rows.map((row) => row.id)),
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
      lastTurn: latestTurns.has(row.id) ? turnSummary(latestTurns.get(row.id) as TurnRow, strategy, params) : null,
      activatedAt: row.activatedAt?.toISOString() ?? null,
      needAttention: attentionByProfile.get(row.id) ?? [],
    };
  });
  return { items, total, page: query.page, limit: query.limit };
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

