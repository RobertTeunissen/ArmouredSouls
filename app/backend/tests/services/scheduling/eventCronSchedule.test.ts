/**
 * Unit tests for eventCronSchedule.ts
 *
 * Players need to know when an event next books matches, so they can leave an
 * event and get back in before the next one is scheduled. Every event must
 * therefore resolve to a moment — a mode wired up without a schedule would leave
 * a hole in the UI with no error to notice.
 */

const mockConfig = {
  leagueSchedule: '0 8 * * *',
  team2v2LeagueSchedule: '0 9 * * *',
  team3v3LeagueSchedule: '0 14 * * *',
  tagTeamSchedule: '0 11 * * *',
  kothSchedule: '0 13 * * *',
  grandMeleeSchedule: '0 17 * * *',
  tournamentSchedule: '0 10 * * *',
  team2v2TournamentSchedule: '0 15 * * *',
  team3v3TournamentSchedule: '0 18 * * *',
};

jest.mock('../../../src/config/env', () => ({
  __esModule: true,
  getConfig: () => mockConfig,
}));

import {
  getNextSchedulingMoment,
  getNextSchedulingMoments,
} from '../../../src/services/scheduling/eventCronSchedule';
import { SUBSCRIBABLE_EVENT_TYPES } from '../../../src/services/subscription/eventRegistry';

describe('getNextSchedulingMoment', () => {
  it('should resolve a moment for every subscribable event', () => {
    for (const eventType of SUBSCRIBABLE_EVENT_TYPES) {
      const moment = getNextSchedulingMoment(eventType);
      expect(moment).toBeInstanceOf(Date);
      expect(Number.isNaN(moment.getTime())).toBe(false);
    }
  });

  it('should always return a moment in the future', () => {
    const now = Date.now();
    for (const eventType of SUBSCRIBABLE_EVENT_TYPES) {
      expect(getNextSchedulingMoment(eventType).getTime()).toBeGreaterThan(now);
    }
  });

  it('should use the configured hour for the event slot', () => {
    // Grand Melee runs at 17:00 UTC; whichever day it lands on, the hour holds.
    expect(getNextSchedulingMoment('grand_melee').getUTCHours()).toBe(17);
    expect(getNextSchedulingMoment('league_1v1').getUTCHours()).toBe(8);
  });

  it('should map each event to its own distinct slot', () => {
    const hours = SUBSCRIBABLE_EVENT_TYPES.map((e) => getNextSchedulingMoment(e).getUTCHours());
    expect(new Set(hours).size).toBe(SUBSCRIBABLE_EVENT_TYPES.length);
  });
});

describe('getNextSchedulingMoments', () => {
  it('should return an ISO string for every event', () => {
    const moments = getNextSchedulingMoments();

    expect(Object.keys(moments).sort()).toEqual([...SUBSCRIBABLE_EVENT_TYPES].sort());
    for (const value of Object.values(moments)) {
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
  });
});
