/** Unit tests for the admin Tournaments labels, links and sentences. */
import { describe, expect, it } from 'vitest';
import {
  averageDaysText,
  bracketHref,
  currentRoundText,
  dominanceNote,
  firstRoundByesText,
  formatShare,
  participantNoun,
  shortDate,
  stableHref,
  statusText,
  tournamentBattlesHref,
} from '../adminTournamentsFormat';
import { current, overview } from '../../pages/admin/__tests__/tournamentsFixture';

describe('adminTournamentsFormat', () => {
  it('formats dates, shares, nouns and averages', () => {
    expect(shortDate('2026-10-31')).toBe('Oct 31');
    expect(shortDate('2026-10-19T23:30:00Z')).toBe('Oct 19');
    expect(shortDate(null)).toBe('—');
    expect(formatShare(936, 2048)).toBe('46%');
    expect(formatShare(1, 256)).toBe('<1%');
    expect(participantNoun('robot')).toBe('robots');
    expect(participantNoun('team_3v3', 1)).toBe('team');
    expect(averageDaysText(9.9)).toBe('9.9');
    expect(averageDaysText(7)).toBe('7');
    expect(averageDaysText(null)).toBe('—');
  });

  it('builds links', () => {
    expect(bracketHref(62)).toBe('/tournaments/62');
    expect(tournamentBattlesHref('team_3v3')).toBe('/admin/battles?mode=tournament_3v3&range=30d');
    expect(stableHref(7)).toBe('/admin/players?user=7');
  });

  it('words the current round and the byes', () => {
    expect(currentRoundText(current(), '10:00')).toBe('Round 11: 0 of 2 matches · runs 10:00 UTC');
    expect(currentRoundText(current({ currentRound: { matches: 1, done: 1 } }), null)).toBe('Round 11: 1 of 1 match');
    expect(firstRoundByesText(current())).toBe('936 of 2,048 (46%)');
  });

  it('words each status', () => {
    expect(statusText(current(), 26)).toEqual({ label: 'On schedule', details: [] });
    expect(statusText(current({ status: { level: 'warning', reasons: ['left_behind'] }, leftBehind: 1 }), 26))
      .toEqual({ label: 'Matches left behind', details: ['1 match of an earlier round never finished.'] });
    expect(statusText(current({ status: { level: 'warning', reasons: ['stalled'] } }), 26).label).toBe('Not advancing');
    expect(statusText(current({ status: { level: 'info', reasons: ['paused'] } }), 26).label).toBe('Paused');
  });

  it('builds the dominance note from the dominant stable of each type', () => {
    expect(dominanceNote(overview().types)).toEqual({
      stables: [{ stableName: 'Hit Machine', stableId: 7, parts: ['7 of 8 1v1', '10 of 12 2v2'] }],
      playersOnly: true,
    });
    const two = overview();
    two.types[2].season = { ...two.types[2].season, completed: 15, dominantStable: { stableId: 11, stableName: 'LortGob Industries', titles: 9 } };
    expect(dominanceNote(two.types)?.stables.map((s) => [s.stableName, s.parts])).toEqual([
      ['Hit Machine', ['7 of 8 1v1', '10 of 12 2v2']],
      ['LortGob Industries', ['9 of 15 3v3']],
    ]);
    const none = overview();
    none.types.forEach((entry) => { entry.season.dominantStable = null; });
    expect(dominanceNote(none.types)).toBeNull();
  });
});
