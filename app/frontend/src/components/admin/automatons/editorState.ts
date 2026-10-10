/**
 * Pure state helpers of the Editor tab (Spec #55, task 10.3): the form a
 * ProfileDetail starts from, the Build_Order the form shows, the Team_Rule
 * size and the save plan (which endpoints a Save changes calls, in order).
 */
import type {
  BlueprintFields,
  BlueprintView,
  LibraryStrategy,
  ProfileDetail,
  TeamNames,
  UpdateProfileInput,
} from '../../../utils/automatonAdminApi';
import { buildableBlueprintCount, MAX_AUTOMATON_BLUEPRINTS, teamNameMaxRobots } from '@shared/utils/automatonTeamRule';
import type { BuildOrderRow } from './BuildOrderPanel';
import type { BlueprintEditorItem } from './blueprintState';
import type { StableCardValues } from './StableCard';
import { sizeTeamNames } from './teamState';

export interface EditorForm extends StableCardValues {
  targets: Record<string, number>;
  teamNames: TeamNames;
  /** Saved blueprints with the Editor's edits, by slot. */
  blueprints: Record<number, BlueprintFields>;
  /** Blueprints added in the Editor and not saved yet. */
  pending: { slot: number; fields: BlueprintFields }[];
}

export function blueprintFields(view: BlueprintView): BlueprintFields {
  return {
    robotName: view.robotName,
    loadoutType: view.loadoutType,
    stance: view.stance,
    yieldThreshold: view.yieldThreshold,
    buildFocus: view.buildFocus,
    weaponPath: view.weaponPath.map((s) => ({ ...s })),
    refinementPlan: view.refinementPlan.map((s) => ({ ...s })),
  };
}

export function formFromDetail(detail: ProfileDetail): EditorForm {
  return {
    stableName: detail.stableName,
    franchise: detail.franchise,
    backstory: detail.backstory,
    strategyKey: detail.strategy.key,
    eventOrder: [...detail.eventOrder],
    targets: Object.fromEntries(detail.strategy.buildOrder.map((g) => [g.goalId, g.target])),
    teamNames: { twoVsTwo: [...detail.teamNames.twoVsTwo], threeVsThree: [...detail.teamNames.threeVsThree] },
    blueprints: Object.fromEntries(detail.blueprints.map((b) => [b.slot, blueprintFields(b)])),
    pending: [],
  };
}

/** The Build_Order the form shows: the pinned version, or the latest version of a newly chosen strategy with its defaults. */
export function buildOrderRows(detail: ProfileDetail, strategyKey: string, strategies: readonly LibraryStrategy[]): BuildOrderRow[] {
  if (strategyKey === detail.strategy.key) return detail.strategy.buildOrder;
  const strategy = strategies.find((s) => s.key === strategyKey);
  const latest = strategy?.versions.find((v) => v.version === strategy.latestVersion);
  return (latest?.buildOrder ?? []).map((d) => ({ ...d, target: d.defaultTarget }));
}

/** Defaults of a newly chosen strategy's latest version. */
export function defaultTargets(rows: readonly BuildOrderRow[]): Record<string, number> {
  return Object.fromEntries(rows.map((r) => [r.goalId, r.defaultTarget]));
}

/** `maxRobots` of the Team_Rule for these slots: the shared `teamNameMaxRobots` rule the backend uses. */
export function teamMaxRobots(rows: readonly BuildOrderRow[], slots: Iterable<number>): number {
  return teamNameMaxRobots(rows, buildableBlueprintCount(slots));
}

/** Lowest free Blueprint_Slot, or null when all 11 are used ("Next free slot, 11 at most"). */
export function nextFreeSlot(used: Iterable<number>): number | null {
  const taken = new Set(used);
  for (let slot = 1; slot <= MAX_AUTOMATON_BLUEPRINTS; slot++) if (!taken.has(slot)) return slot;
  return null;
}

export const NEW_BLUEPRINT: BlueprintFields = {
  robotName: '',
  loadoutType: 'single',
  stance: 'balanced',
  yieldThreshold: 10,
  buildFocus: 'versatile',
  weaponPath: [{ main: '' }],
  refinementPlan: [],
};

/** The blueprint cards: saved ones (with edits) and pending ones, by slot. */
export function editorItems(detail: ProfileDetail, form: EditorForm): BlueprintEditorItem[] {
  const saved = detail.blueprints.map((b): BlueprintEditorItem => ({
    slot: b.slot,
    fields: form.blueprints[b.slot] ?? blueprintFields(b),
    imageUrl: b.imageUrl,
    liveRobot: b.liveRobot,
    pending: false,
  }));
  const pending = form.pending.map((p): BlueprintEditorItem => ({ slot: p.slot, fields: p.fields, imageUrl: null, liveRobot: null, pending: true }));
  return [...saved, ...pending].sort((a, b) => a.slot - b.slot);
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export type SaveStep =
  | { kind: 'update_blueprint'; slot: number; fields: BlueprintFields }
  | { kind: 'add_blueprint'; slot: number; fields: BlueprintFields; teamNames: TeamNames }
  | { kind: 'update_strategy'; strategyKey: string; targets: Record<string, number>; teamNames: TeamNames }
  | { kind: 'update_profile'; patch: UpdateProfileInput };

/**
 * The calls one Save changes makes, in order: blueprint edits, blueprint
 * additions (each with Team_Names sized for the count after it), the strategy
 * (key and targets), then the profile fields. Team_Names travel with the first
 * call that can change their count, so the profile never holds a wrong count.
 * Additions run before the strategy step, so the backend checks their
 * Team_Names against the pinned strategy: they are sized with the pinned
 * Build_Order, and only the strategy step uses `rows` (the form's strategy).
 */
export function savePlan(detail: ProfileDetail, form: EditorForm, rows: readonly BuildOrderRow[]): SaveStep[] {
  const steps: SaveStep[] = [];
  for (const b of detail.blueprints) {
    const edited = form.blueprints[b.slot];
    if (edited && !same(edited, blueprintFields(b))) steps.push({ kind: 'update_blueprint', slot: b.slot, fields: edited });
  }
  const pinnedRows = detail.strategy.buildOrder;
  const slots = detail.blueprints.map((b) => b.slot);
  let namesSent = false;
  for (const p of [...form.pending].sort((a, b) => a.slot - b.slot)) {
    slots.push(p.slot);
    steps.push({ kind: 'add_blueprint', slot: p.slot, fields: p.fields, teamNames: sizeTeamNames(form.teamNames, teamMaxRobots(pinnedRows, slots)) });
    namesSent = true;
  }
  const finalNames = sizeTeamNames(form.teamNames, teamMaxRobots(rows, slots));
  const strategyChanged = form.strategyKey !== detail.strategy.key;
  const targetsChanged = rows.some((r) => !r.isMax && (form.targets[r.goalId] ?? r.target) !== r.target);
  if (strategyChanged || targetsChanged) {
    steps.push({ kind: 'update_strategy', strategyKey: form.strategyKey, targets: form.targets, teamNames: finalNames });
    namesSent = true;
  }
  const patch: UpdateProfileInput = {};
  if (form.stableName !== detail.stableName) patch.stableName = form.stableName;
  if (form.franchise !== detail.franchise) patch.franchise = form.franchise;
  if (form.backstory !== detail.backstory) patch.backstory = form.backstory;
  if (!same(form.eventOrder, detail.eventOrder)) patch.eventOrder = form.eventOrder;
  if (!namesSent && !same(finalNames, detail.teamNames)) patch.teamNames = finalNames;
  if (Object.keys(patch).length > 0) steps.push({ kind: 'update_profile', patch });
  return steps;
}
