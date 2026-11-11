import { describe, it, expect } from 'vitest';
import { defaultEventSelection, planSetupSteps } from '../robotSetupSteps';
import type { SchedulingEligibilityReport } from '@shared/types';

function report(weapon: boolean, events: boolean): SchedulingEligibilityReport {
  return {
    robotId: 1,
    isEligible: weapon && events,
    isFullyConfigured: false,
    gates: [
      { id: 'weapon_equipped', label: 'Equip a weapon', severity: 'hard', met: weapon, detail: null },
      { id: 'event_subscribed', label: 'Enter at least one battle event', severity: 'hard', met: events, detail: null },
      { id: 'tuning_allocated', label: 'Allocate your tuning points', severity: 'soft', met: false, detail: null },
    ],
  };
}

describe('planSetupSteps', () => {
  it('gives a first robot portrait, weapon and events, without a team step', () => {
    expect(planSetupSteps({ report: report(false, false), hasPortrait: false, robotCount: 1 })).toEqual(['portrait', 'weapon', 'events']);
  });

  it('adds the team step once the stable has a second robot', () => {
    expect(planSetupSteps({ report: report(false, false), hasPortrait: false, robotCount: 2 })).toEqual(['portrait', 'weapon', 'team', 'events']);
  });

  it('skips the portrait when the robot already has one', () => {
    expect(planSetupSteps({ report: report(false, false), hasPortrait: true, robotCount: 1 })).toEqual(['weapon', 'events']);
  });

  it('sends a robot back for its missing events straight to that step', () => {
    expect(planSetupSteps({ report: report(true, false), hasPortrait: false, robotCount: 3 })).toEqual(['events']);
  });

  it('sends a robot back for its weapon straight to that step', () => {
    expect(planSetupSteps({ report: report(false, true), hasPortrait: false, robotCount: 3 })).toEqual(['weapon']);
  });

  it('has nothing to do for a robot that can be scheduled (tuning is not a wizard step)', () => {
    expect(planSetupSteps({ report: report(true, true), hasPortrait: false, robotCount: 1 })).toEqual([]);
  });
});

describe('defaultEventSelection', () => {
  const ALL = ['league_1v1', 'tournament_1v1', 'koth', 'grand_melee', 'tag_team'];

  it('ticks the three solo events for a new robot', () => {
    expect(defaultEventSelection(ALL, [], 3)).toEqual(['league_1v1', 'tournament_1v1', 'koth']);
  });

  it('keeps the robot\'s current entries', () => {
    expect(defaultEventSelection(ALL, ['grand_melee'], 3)).toEqual(['grand_melee']);
  });

  it('stays within the slot cap and the eligible events', () => {
    expect(defaultEventSelection(ALL, [], 2)).toEqual(['league_1v1', 'tournament_1v1']);
    expect(defaultEventSelection(['koth'], [], 3)).toEqual(['koth']);
    expect(defaultEventSelection(ALL, [], 0)).toEqual([]);
  });
});
