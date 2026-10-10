/**
 * Turn_Preview (Spec #55, R11.4, design §17.1, task 9.4).
 *
 * Evaluates the next Automaton_Turn against current facts with the real
 * planner and the pure `factProjector` (`simulateTurn`), and returns the
 * planned actions with costs and a status for every Goal of the Build_Order:
 *
 * - Done: Satisfied, nothing bought for it this cycle;
 * - Bought: something was bought for it this cycle and it ended Satisfied;
 * - Saving: where the turn stops (needed and available credits);
 * - Blocked: skipped, with the reason (e.g. prestige needed and held);
 * - Waiting: below the stop; `gated` when the Goal will be blocked by a
 *   prestige gate when it is reached (its own steps walked on the projected
 *   end-of-turn facts with unlimited credits; PLAYER_FACING_TEXT §6.6
 *   "will be blocked when reached").
 *
 * Reads only: the facts loader, the blueprint loader, the weapon catalogue
 * and one season query; no database or file write (the integration test
 * counts writes). A Draft_Automaton is previewed as the fresh ₡3,000,000
 * stable it becomes at Activation.
 */
import prisma from '../../lib/prisma';
import { AutomatonError, AutomatonErrorCode } from '../../errors/automatonErrors';
import type { StrategyParametersV1, TeamNames } from '../../types/automaton';
import type { BlockedReason, GoalDetail, PlannedAction } from './goals/goalTypes';
import { simulateTurn, type SimulatedTurn } from './turnPlanner';
import { projectAction, ProjectionError } from './factProjector';
import {
  loadBlueprintFacts,
  loadStableFacts,
  loadWeaponCatalogue,
  type BlueprintFacts,
  type SeasonFacts,
  type StableFacts,
  type WeaponFacts,
} from './stableFacts';
import { freshStableFacts, SCENARIO_STARTING_BALANCE } from './strategies/scenarioProjector';
import { describeBuildOrder, resolveGoalTarget } from './strategies/strategyParameters';
import { getStrategyRegistry } from './strategies/defaultRegistry';
import type { StrategyRegistry } from './strategies/registry';
import type { UpgradeStrategy } from './strategies/strategyTypes';
import { profileTeamNames } from './automatonProfileRules';

export type PreviewGoalStatus = 'done' | 'bought' | 'saving' | 'blocked' | 'waiting';

export interface PreviewGoal {
  goalId: string;
  position: number;
  type: UpgradeStrategy['buildOrder'][number]['type'];
  facilityType?: string;
  label: string;
  target: number;
  isMax: boolean;
  status: PreviewGoalStatus;
  /** Blocked by a prestige gate, or Waiting with a prestige-gated next step. */
  gated: boolean;
  reason?: BlockedReason;
  detail: GoalDetail;
  /** What this cycle bought for the Goal (also on a Saving Goal that bought part of its target first). */
  bought: { steps: number; cost: number };
  /** Saving: credits the next step needs and the balance it has. */
  needed?: number;
  available?: number;
}

export interface PreviewAction {
  goalId: string;
  position: number;
  kind: PlannedAction['kind'];
  cost: number;
  chargedSteps: number;
  detail: Record<string, string | number>;
}

export interface TurnPreviewResult {
  startBalance: number;
  projectedEndBalance: number;
  chargedActions: number;
  stop: SimulatedTurn['stop']['kind'];
  actions: PreviewAction[];
  goals: PreviewGoal[];
}

export interface PreviewContext {
  params: StrategyParametersV1;
  blueprints: readonly BlueprintFacts[];
  weapons: ReadonlyMap<string, WeaponFacts>;
  teamNames: TeamNames | null;
}

function actionDetail(action: PlannedAction): Record<string, string | number> {
  switch (action.kind) {
    case 'robot_chain': {
      const robot = action.steps.find((s) => s.kind === 'robot_purchase');
      return { slot: action.slotIndex, ...(robot && robot.kind === 'robot_purchase' ? { robotName: robot.robotName } : {}) };
    }
    case 'facility_upgrade':
      return { facilityType: action.facilityType, toLevel: action.toLevel };
    case 'attribute_upgrade':
      return { slot: action.robotSlot, levels: Object.values(action.increments).reduce((sum, n) => sum + (n ?? 0), 0) };
    case 'weapon_stage':
      return { slot: action.robotSlot, toStage: action.toStage };
    case 'weapon_refinement':
      return { slot: action.robotSlot, tier: action.step.tier, hand: action.step.hand, workshopLevels: action.chain.length };
  }
}

/** Credits assumed by the gate look-ahead, so cost never stops it before a gate. */
const LOOK_AHEAD_BALANCE = Number.MAX_SAFE_INTEGER / 4;
/** Upper bound on look-ahead steps of one Goal (an attributes Goal to Max is the longest). */
const LOOK_AHEAD_STEPS = 400;

/**
 * The prestige gate a Waiting Goal will hit when it is reached ("will be
 * blocked when reached", PLAYER_FACING_TEXT §6.6): walk the Goal's own steps
 * on projected facts with unlimited credits until it is Satisfied or Blocked.
 * Returns the gate detail, or null when the Goal reaches its target ungated.
 */
function prestigeGateAhead(
  definition: UpgradeStrategy['buildOrder'][number],
  target: number,
  facts: StableFacts,
  ctx: PreviewContext,
): GoalDetail | null {
  let current: StableFacts = { ...facts, balance: LOOK_AHEAD_BALANCE };
  for (let step = 0; step < LOOK_AHEAD_STEPS; step++) {
    const outcome = definition.goal.evaluate(current, {
      target, params: ctx.params, blueprints: ctx.blueprints, weapons: ctx.weapons, balance: current.balance,
    });
    if (outcome.kind === 'blocked') return outcome.reason === 'prestige_gate' ? outcome.detail : null;
    if (outcome.kind !== 'actionable') return null;
    try {
      const next = projectAction(current, outcome.action, ctx);
      if (JSON.stringify(next) === JSON.stringify(current)) return null;
      current = { ...next, balance: LOOK_AHEAD_BALANCE };
    } catch (error) {
      if (error instanceof ProjectionError) return null;
      throw error;
    }
  }
  return null;
}

/**
 * Pure part of the Turn_Preview: simulate the turn and classify every Goal
 * (shared with the Strategy_Draft preview, task 9.10).
 */
export function buildTurnPreview(facts: StableFacts, strategy: Pick<UpgradeStrategy, 'buildOrder'>, ctx: PreviewContext): TurnPreviewResult {
  const turn = simulateTurn(facts, strategy, ctx);
  const descriptors = describeBuildOrder(strategy.buildOrder);
  const positionOf = new Map(strategy.buildOrder.map((d) => [d.id, d.position]));
  const bought = new Map<string, { steps: number; cost: number }>();
  for (const step of turn.steps) {
    const current = bought.get(step.goalId) ?? { steps: 0, cost: 0 };
    bought.set(step.goalId, { steps: current.steps + 1, cost: current.cost + step.cost });
  }
  const outcomeOf = new Map(turn.lastPlan.outcomes.map((o) => [o.goalId, o]));

  const goals = strategy.buildOrder.map((definition, index): PreviewGoal => {
    const descriptor = descriptors[index];
    const target = resolveGoalTarget(definition, ctx.params);
    const base = {
      goalId: definition.id,
      position: definition.position,
      type: definition.type,
      ...(definition.facilityType ? { facilityType: definition.facilityType } : {}),
      label: descriptor.label,
      target,
      isMax: definition.isMax,
      bought: bought.get(definition.id) ?? { steps: 0, cost: 0 },
    };
    const outcome = outcomeOf.get(definition.id);
    if (outcome) {
      switch (outcome.kind) {
        case 'satisfied':
          return { ...base, status: base.bought.steps > 0 ? 'bought' : 'done', gated: false, detail: {} };
        case 'blocked':
          return { ...base, status: 'blocked', gated: outcome.reason === 'prestige_gate', reason: outcome.reason, detail: outcome.detail };
        case 'saving':
          return { ...base, status: 'saving', gated: false, detail: outcome.detail, needed: outcome.cost, available: turn.facts.balance };
        case 'actionable':
          // Only when the Turn_Budget stopped the turn: the Goal acts next cycle.
          return { ...base, status: base.bought.steps > 0 ? 'bought' : 'waiting', gated: false, detail: { nextCost: outcome.cost } };
      }
    }
    // Below the stop: Waiting; gated when the Goal will be blocked by a prestige gate when reached.
    const gate = prestigeGateAhead(definition, target, turn.facts, ctx);
    if (gate) return { ...base, status: 'waiting', gated: true, reason: 'prestige_gate', detail: gate };
    return { ...base, status: 'waiting', gated: false, detail: {} };
  });

  return {
    startBalance: facts.balance,
    projectedEndBalance: turn.facts.balance,
    chargedActions: turn.chargedActions,
    stop: turn.stop.kind,
    actions: turn.steps.map((step) => ({
      goalId: step.goalId,
      position: positionOf.get(step.goalId) ?? 0,
      kind: step.action.kind,
      cost: step.cost,
      chargedSteps: step.chargedSteps,
      detail: actionDetail(step.action),
    })),
    goals,
  };
}

/** Current season, read without the lazy creation `getCurrentSeason` performs. */
export async function readSeasonFacts(): Promise<SeasonFacts> {
  const season = await prisma.season.findFirst({
    where: { phase: { not: 'completed' } },
    orderBy: { seasonNumber: 'desc' },
    select: { seasonNumber: true, phase: true },
  });
  return { seasonNumber: season?.seasonNumber ?? 0, phase: season?.phase === 'preparation' ? 'preparation' : 'competitive' };
}

export interface ProfileTurnPreview extends TurnPreviewResult {
  catalogueKey: string;
  status: 'draft' | 'active';
  strategyKey: string;
  strategyVersion: number;
  seasonNumber: number;
  phase: StableFacts['phase'];
}

export interface TurnPreviewDeps {
  registry?: StrategyRegistry;
}

/** Load one profile read-only and resolve its pinned strategy and Goal_Targets. */
export async function loadPreviewSubject(catalogueKey: string, registry: StrategyRegistry): Promise<{
  profile: { id: number; status: 'draft' | 'active'; strategyKey: string; strategyVersion: number };
  facts: StableFacts;
  blueprints: BlueprintFacts[];
  weapons: Map<string, WeaponFacts>;
  teamNames: TeamNames;
  season: SeasonFacts;
  strategy: UpgradeStrategy | undefined;
  storedParams: unknown;
}> {
  const profile = await prisma.automatonProfile.findUnique({
    where: { catalogueKey },
    select: { id: true, status: true, userId: true, strategyKey: true, strategyVersion: true, strategyParameters: true, teamNames: true },
  });
  if (!profile) throw new AutomatonError(AutomatonErrorCode.AUTOMATON_NOT_FOUND, `No Automaton stable ${catalogueKey}`, 404);
  const season = await readSeasonFacts();
  const blueprints = await loadBlueprintFacts(prisma, profile.id);
  const weapons = await loadWeaponCatalogue();
  const facts = profile.status === 'active' && profile.userId !== null
    ? await loadStableFacts(prisma, profile.id, { season, blueprints })
    : { ...freshStableFacts(SCENARIO_STARTING_BALANCE), profileId: profile.id, catalogueKey, seasonNumber: season.seasonNumber, phase: season.phase };
  return {
    profile: { id: profile.id, status: profile.status, strategyKey: profile.strategyKey, strategyVersion: profile.strategyVersion },
    facts,
    blueprints,
    weapons,
    teamNames: profileTeamNames(profile),
    season,
    strategy: registry.getStrategy(profile.strategyKey, profile.strategyVersion),
    storedParams: profile.strategyParameters,
  };
}

/** Turn_Preview of one profile on its pinned Strategy_Version (R11.4). */
export async function previewProfileTurn(catalogueKey: string, deps: TurnPreviewDeps = {}): Promise<ProfileTurnPreview> {
  const registry = deps.registry ?? getStrategyRegistry();
  const subject = await loadPreviewSubject(catalogueKey, registry);
  const { profile, strategy } = subject;
  if (!strategy) {
    throw new AutomatonError(
      AutomatonErrorCode.AUTOMATON_PROFILE_INVALID,
      `Strategy ${profile.strategyKey} v${profile.strategyVersion} has no Strategy_Definition_File`,
      409,
    );
  }
  const parsed = strategy.parameterSchema.safeParse(subject.storedParams);
  if (!parsed.success) {
    throw new AutomatonError(
      AutomatonErrorCode.AUTOMATON_PROFILE_INVALID,
      `Stored Goal_Targets do not fit ${strategy.key} v${strategy.version}`,
      409,
      { issues: parsed.error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message })) },
    );
  }
  const preview = buildTurnPreview(subject.facts, strategy, {
    params: parsed.data,
    blueprints: subject.blueprints,
    weapons: subject.weapons,
    teamNames: subject.teamNames,
  });
  return {
    ...preview,
    catalogueKey,
    status: profile.status,
    strategyKey: strategy.key,
    strategyVersion: strategy.version,
    seasonNumber: subject.season.seasonNumber,
    phase: subject.season.phase,
  };
}
