/**
 * Free_Upkeep executors (Spec #55, R3.11, R5.7–R5.9, R4.5, design §8.7,
 * task 5.4).
 *
 * Applies the pure upkeep plans through the services the player routes use:
 * 1. Teams: every Team_Rule team that is due (`teamsDue`), registered with
 *    `registerTeam` (as `POST /api/team-battles` does), `robotIds` in
 *    ascending Blueprint_Slot order so the lower slot is
 *    `TeamBattleMember.slotIndex` 0.
 * 2. Subscriptions: Event_Allocation, applied with `setSubscriptionsForRobot`
 *    only for robots whose desired set differs. This is where team standings
 *    appear: Event_Allocation subscribes whole teams, so the last member's
 *    subscription makes the team matchable and the subscription path places
 *    it (robot standings likewise come from the subscriptions).
 * 3. Robot_Blueprint sync: stance and yield via `robotSettingsService`.
 * 4. Tuning: `setTuningAllocation` only where the allocation differs.
 *
 * All parts are free (no Financial_Pair) and never count against the action
 * limit. A failing part is recorded as an issue and retried at the next
 * upkeep; it never fails the turn (design §8.7: "Any registerTeam error is
 * recorded and retried next turn"). The achievement checks the stance and
 * tuning routes make run here too, with the same "failures don't block"
 * wrapper.
 */
import prisma from '../../../lib/prisma';
import logger from '../../../config/logger';
import { AppError } from '../../../errors/AppError';
import { registerTeam } from '../../team-battle/teamBattleService';
import { setSubscriptionsForRobot } from '../../subscription/subscriptionService';
import { setTuningAllocation } from '../../tuning-pool/tuningPoolService';
import { updateStance, updateYieldThreshold } from '../../robot/robotSettingsService';
import { achievementService } from '../../achievement/achievementService';
import type { AchievementEvent } from '../../achievement/achievementTypes';
import { BUILD_FOCUS_WEIGHTS, type BuildFocusWeightTable } from '../buildFocus';
import { loadStableFacts, type BlueprintFacts, type StableFacts } from '../stableFacts';
import { teamsDue } from './teamUpkeep';
import { subscriptionChanges } from './subscriptionUpkeep';
import { blueprintDrift } from './blueprintSync';
import { tuningChanges } from './tuningUpkeep';
import type { EventOrder, TeamNames } from '../../../types/automaton';

/** The four Free_Upkeep parts, in the order R5.7 runs them. */
export const FREE_UPKEEP_PARTS = ['teams', 'subscriptions', 'blueprint_sync', 'tuning'] as const;
export type FreeUpkeepPart = (typeof FREE_UPKEEP_PARTS)[number];

export interface FreeUpkeepContext {
  userId: number;
  /** Ordered by slot. */
  blueprints: readonly BlueprintFacts[];
  teamNames: TeamNames;
  eventOrder: EventOrder;
  /** Build_Focus weight table; the approved presets by default. */
  weightTable?: BuildFocusWeightTable;
}

export interface FreeUpkeepOptions {
  /** Parts to run (always in R5.7 order); all four by default. */
  parts?: readonly FreeUpkeepPart[];
  /** Limit the tuning part to these robots (Robot_Fitout step 7 tunes only the new robot). */
  tuningRobotIds?: readonly number[];
}

/** A part that could not be applied; retried at the next upkeep. */
export interface FreeUpkeepIssue {
  part: FreeUpkeepPart;
  code: string;
  message: string;
  robotId?: number;
  teamSize?: 2 | 3;
  teamIndex?: number;
}

export interface FreeUpkeepResult {
  /** Facts reloaded after the upkeep (unchanged input when nothing was written). */
  facts: StableFacts;
  teamsRegistered: number;
  subscriptionsChanged: number;
  settingsChanged: number;
  tuningChanged: number;
  issues: FreeUpkeepIssue[];
}

function errorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  return 'UNEXPECTED_ERROR';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The achievement check a player route makes after the same change; failures never block. */
export async function awardQuietly(userId: number, robotId: number | null, event: AchievementEvent): Promise<void> {
  try {
    await achievementService.checkAndAward(userId, robotId, event);
  } catch (error) {
    logger.warn(`[Automaton] achievement check ${event.type} failed for user ${userId}: ${errorMessage(error)}`);
  }
}

function reload(facts: StableFacts, blueprints: readonly BlueprintFacts[]): Promise<StableFacts> {
  return loadStableFacts(prisma, facts.profileId, {
    season: { seasonNumber: facts.seasonNumber, phase: facts.phase },
    blueprints,
  });
}

async function registerDueTeams(facts: StableFacts, ctx: FreeUpkeepContext, issues: FreeUpkeepIssue[]): Promise<number> {
  let registered = 0;
  for (const due of teamsDue(facts, ctx.teamNames)) {
    if (due.name === null) {
      issues.push({
        part: 'teams',
        code: 'AUTOMATON_TEAM_NAME_MISSING',
        message: `No Team_Names entry for ${due.size}v${due.size} team ${due.index + 1}`,
        teamSize: due.size,
        teamIndex: due.index,
      });
      continue;
    }
    try {
      await registerTeam(ctx.userId, [...due.robotIds], due.name, due.size, ctx.userId);
      registered++;
    } catch (error) {
      issues.push({ part: 'teams', code: errorCode(error), message: errorMessage(error), teamSize: due.size, teamIndex: due.index });
    }
  }
  return registered;
}

async function applySubscriptions(facts: StableFacts, ctx: FreeUpkeepContext, issues: FreeUpkeepIssue[]): Promise<number> {
  let changed = 0;
  for (const change of subscriptionChanges(facts, ctx.eventOrder)) {
    try {
      await setSubscriptionsForRobot(change.robotId, change.desired, ctx.userId);
      changed++;
    } catch (error) {
      issues.push({ part: 'subscriptions', code: errorCode(error), message: errorMessage(error), robotId: change.robotId });
    }
  }
  return changed;
}

async function syncBlueprintSettings(facts: StableFacts, ctx: FreeUpkeepContext, issues: FreeUpkeepIssue[]): Promise<number> {
  let changed = 0;
  for (const drift of blueprintDrift(facts, ctx.blueprints)) {
    try {
      if (drift.stance !== undefined) {
        const result = await updateStance(ctx.userId, drift.robotId, drift.stance);
        await awardQuietly(ctx.userId, drift.robotId, {
          type: 'stance_changed',
          data: { robotId: drift.robotId, stance: result.stance },
        });
      }
      if (drift.yieldThreshold !== undefined) {
        await updateYieldThreshold(ctx.userId, drift.robotId, drift.yieldThreshold);
      }
      changed++;
    } catch (error) {
      issues.push({ part: 'blueprint_sync', code: errorCode(error), message: errorMessage(error), robotId: drift.robotId });
    }
  }
  return changed;
}

async function applyTuning(
  facts: StableFacts,
  ctx: FreeUpkeepContext,
  issues: FreeUpkeepIssue[],
  onlyRobotIds: readonly number[] | undefined,
): Promise<number> {
  let changed = 0;
  const only = onlyRobotIds ? new Set(onlyRobotIds) : null;
  for (const change of tuningChanges(facts, ctx.blueprints, ctx.weightTable ?? BUILD_FOCUS_WEIGHTS)) {
    if (only && !only.has(change.robotId)) continue;
    try {
      await setTuningAllocation(change.robotId, ctx.userId, change.allocation);
      await awardQuietly(ctx.userId, change.robotId, {
        type: 'tuning_allocated',
        data: { robotId: change.robotId, allocations: change.allocation },
      });
      changed++;
    } catch (error) {
      issues.push({ part: 'tuning', code: errorCode(error), message: errorMessage(error), robotId: change.robotId });
    }
  }
  return changed;
}

/**
 * Run Free_Upkeep for one stable (design §8.7). Facts are reloaded after team
 * registration (Event_Allocation needs the new teams) and once at the end
 * when anything was written.
 */
export async function runFreeUpkeep(
  facts: StableFacts,
  ctx: FreeUpkeepContext,
  options: FreeUpkeepOptions = {},
): Promise<FreeUpkeepResult> {
  const parts = new Set<FreeUpkeepPart>(options.parts ?? FREE_UPKEEP_PARTS);
  const issues: FreeUpkeepIssue[] = [];
  let current = facts;

  let teamsRegistered = 0;
  if (parts.has('teams')) {
    teamsRegistered = await registerDueTeams(current, ctx, issues);
    if (teamsRegistered > 0) current = await reload(current, ctx.blueprints);
  }
  const subscriptionsChanged = parts.has('subscriptions') ? await applySubscriptions(current, ctx, issues) : 0;
  const settingsChanged = parts.has('blueprint_sync') ? await syncBlueprintSettings(current, ctx, issues) : 0;
  const tuningChanged = parts.has('tuning') ? await applyTuning(current, ctx, issues, options.tuningRobotIds) : 0;
  const dirty = subscriptionsChanged + settingsChanged + tuningChanged > 0;

  for (const issue of issues) {
    logger.warn(`[Automaton] ${facts.catalogueKey} upkeep ${issue.part} issue ${issue.code}: ${issue.message}`);
  }

  return {
    facts: dirty ? await reload(current, ctx.blueprints) : current,
    teamsRegistered,
    subscriptionsChanged,
    settingsChanged,
    tuningChanged,
    issues,
  };
}
