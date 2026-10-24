/**
 * Pure helpers of the Strategy_Builder (Spec #55, R6.9–R6.11, task 10.4):
 * Goal labels, new Goals from the Goal_Library, moves and removals that keep
 * positions 1…n, and the issues per Goal and for the whole Build_Order.
 */
import type { FileBuildOrderEntry, FileGoalReference, FileTargetValue, StrategyRuleIssue } from '../../../utils/automatonAdminApi';
import { GOAL_TYPE_LABELS, facilityLabel } from './automatonText';

export function goalLabel(goal: FileGoalReference): string {
  return goal.type === 'facility' ? facilityLabel(goal.facilityType) : GOAL_TYPE_LABELS[goal.type];
}

/** A new Goal with a valid default and bounds for its type. */
export function newGoal(goal: FileGoalReference): Omit<FileBuildOrderEntry, 'position'> {
  switch (goal.type) {
    case 'robots':
      return { goal, defaultTarget: 1, bounds: { min: 1, max: 11 } };
    case 'attributes':
      return { goal, defaultTarget: 5, bounds: { min: 1, max: 50 } };
    case 'weapons':
      return { goal, defaultTarget: 3, bounds: { min: 0, max: 3 } };
    case 'refine':
      return { goal, defaultTarget: 10, bounds: { min: 0, max: 10 } };
    case 'economy':
      return { goal, defaultTarget: 20, bounds: { min: 0, max: 50 } };
    case 'facility':
      return { goal, defaultTarget: 1, bounds: { min: 0, max: goal.facilityType === 'booking_office' ? 6 : 10 } };
  }
}

/** One Goal of the builder list; `id` keeps a row's input state with its Goal across moves. */
export interface BuilderRow {
  id: number;
  entry: FileBuildOrderEntry;
}

/** Positions 1, 2, 3 … in list order. */
export function renumber(rows: readonly BuilderRow[]): BuilderRow[] {
  return rows.map((row, index) => (row.entry.position === index + 1 ? row : { ...row, entry: { ...row.entry, position: index + 1 } }));
}

export function moveGoal(rows: readonly BuilderRow[], index: number, delta: -1 | 1): BuilderRow[] {
  const target = index + delta;
  if (target < 0 || target >= rows.length) return [...rows];
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return renumber(next);
}

export function removeGoal(rows: readonly BuilderRow[], index: number): BuilderRow[] {
  return renumber(rows.filter((_, i) => i !== index));
}

export function addGoal(rows: readonly BuilderRow[], goal: FileGoalReference, id: number): BuilderRow[] {
  return renumber([...rows, { id, entry: { ...newGoal(goal), position: rows.length + 1 } }]);
}

/** Issues of one Goal (by Build_Order position). */
export function issuesAt(issues: readonly StrategyRuleIssue[], position: number): string[] {
  return issues.filter((i) => i.position === position).map((i) => i.message);
}

/** Build_Order-level issues (e.g. a missing required Goal type), shown above the Goal list. */
export function buildOrderIssues(issues: readonly StrategyRuleIssue[]): string[] {
  return issues.filter((i) => i.position === undefined && i.path[0] === 'buildOrder').map((i) => i.message);
}

/** Draft-level issues that belong to neither (key, version, display name). */
export function metadataIssues(issues: readonly StrategyRuleIssue[]): string[] {
  return issues.filter((i) => i.position === undefined && i.path[0] !== 'buildOrder').map((i) => i.message);
}

/** Parse a target field: a whole number, or `max` on an attributes Goal. */
export function parseTarget(raw: string, allowMax: boolean): FileTargetValue | null {
  const value = raw.trim();
  if (allowMax && value.toLowerCase() === 'max') return 'max';
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

export function targetFieldText(value: FileTargetValue): string {
  return value === 'max' ? 'Max' : String(value);
}

/** The Goal_Library choices of "Add goal": Robots · Facility ({facility}) · Attributes · Weapons · Refine · Economy. */
export function goalLibraryChoices(facilityTypes: readonly string[]): { value: string; label: string; goal: FileGoalReference }[] {
  return [
    { value: 'robots', label: 'Robots', goal: { type: 'robots' } },
    ...facilityTypes.map((facilityType) => ({ value: `facility:${facilityType}`, label: `Facility (${facilityLabel(facilityType)})`, goal: { type: 'facility' as const, facilityType } })),
    { value: 'attributes', label: 'Attributes', goal: { type: 'attributes' } },
    { value: 'weapons', label: 'Weapons', goal: { type: 'weapons' } },
    { value: 'refine', label: 'Refine', goal: { type: 'refine' } },
    { value: 'economy', label: 'Economy', goal: { type: 'economy' } },
  ];
}
