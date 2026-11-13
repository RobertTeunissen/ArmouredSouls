/**
 * Which steps the robot setup wizard shows, and which events it pre-selects.
 *
 * The wizard only covers what the Workshop can't: buying and equipping the
 * first weapon, forming a team, and entering battle events. It ends in the
 * Workshop, where stance, yield, tuning and upgrades already sit on one page.
 */
import type { SchedulingEligibilityReport } from '@shared/types';

export type WizardStepId = 'portrait' | 'weapon' | 'team' | 'events';

export const WIZARD_STEP_LABELS: Record<WizardStepId, string> = {
  portrait: 'Portrait',
  weapon: 'Weapon',
  team: 'Team',
  events: 'Events',
};

export interface SetupStepInput {
  report: SchedulingEligibilityReport;
  /** The robot already has a portrait. */
  hasPortrait: boolean;
  /** Robots in the stable, this one included. */
  robotCount: number;
}

function gateUnmet(report: SchedulingEligibilityReport, id: SchedulingEligibilityReport['gates'][number]['id']): boolean {
  return report.gates.some((gate) => gate.id === id && !gate.met);
}

/**
 * Steps still to do, in order. A robot straight from the create page needs a
 * weapon and events, and gets the optional portrait and team steps too. A
 * robot sent back to finish its setup only gets the steps it still needs.
 * Empty when the robot can already be scheduled.
 */
export function planSetupSteps({ report, hasPortrait, robotCount }: SetupStepInput): WizardStepId[] {
  const needsWeapon = gateUnmet(report, 'weapon_equipped');
  const needsEvents = gateUnmet(report, 'event_subscribed');
  const fresh = needsWeapon && needsEvents;

  const steps: WizardStepId[] = [];
  if (fresh && !hasPortrait) steps.push('portrait');
  if (needsWeapon) steps.push('weapon');
  if (fresh && robotCount >= 2) steps.push('team');
  if (needsEvents) steps.push('events');
  return steps;
}

/** One robot can fight in these on its own; team events need a team first. */
const DEFAULT_SOLO_EVENTS: readonly string[] = ['league_1v1', 'tournament_1v1', 'koth'];

/**
 * The events ticked when the step opens: the robot's current entries if it
 * has any, otherwise the solo events it is eligible for, up to the slot cap.
 */
export function defaultEventSelection(eligible: readonly string[], active: readonly string[], cap: number): string[] {
  if (active.length > 0) return [...active];
  return DEFAULT_SOLO_EVENTS.filter((event) => eligible.includes(event)).slice(0, Math.max(0, cap));
}
