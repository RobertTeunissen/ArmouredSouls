import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FILTERS,
  displayMessage,
  fieldBreakdown,
  formatBattleDuration,
  formatBattleTime,
  formatEventTime,
  isDefaultFilters,
  modeDetail,
  readBattleFilters,
  scopeParts,
  writeBattleFilters,
} from '../adminBattlesFormat';

describe('adminBattlesFormat', () => {
  it('formats lengths and event times as minutes and seconds', () => {
    expect(formatBattleDuration(48)).toBe('48s');
    expect(formatBattleDuration(112)).toBe('1m 52s');
    expect(formatBattleDuration(300)).toBe('5m 0s');
    expect(formatEventTime(12.4)).toBe('12.4s');
    expect(formatEventTime(64.3)).toBe('1m 4.3s');
  });

  it('formats times in UTC', () => {
    expect(formatBattleTime('2026-10-25T08:26:59.000Z')).toBe('25 Oct 08:26');
  });

  it('describes the mode detail per kind of battle', () => {
    expect(modeDetail({ battleType: 'league_2v2', leagueType: 'gold', leagueInstanceId: 'gold_3', tournament: null, participantCount: 4 })).toBe('Gold · gold_3');
    expect(modeDetail({ battleType: 'tournament_1v1', leagueType: 'tournament', leagueInstanceId: null, tournament: { id: 1, name: 'Autumn Cup', round: 3 }, participantCount: 2 })).toBe('Autumn Cup · Round 3');
    expect(modeDetail({ battleType: 'koth', leagueType: 'koth', leagueInstanceId: null, tournament: null, participantCount: 6 })).toBe('6 robots');
    expect(modeDetail({ battleType: 'grand_melee', leagueType: 'gold', leagueInstanceId: null, tournament: null, participantCount: 20 })).toBe('20 robots · Gold');
  });

  it('summarises the rest of a placement field by stable type', () => {
    expect(fieldBreakdown({ human: 3, generated: 2, automaton: 0 })).toBe('3 Player, 2 Generated');
  });

  it('drops the leading emoji of stored combat messages', () => {
    expect(displayMessage('💥 Ironclad hits')).toBe('Ironclad hits');
    expect(displayMessage('🛡️⚡ Shields regenerate')).toBe('Shields regenerate');
    expect(displayMessage('📏 Combat closes to melee range')).toBe('Combat closes to melee range');
    expect(displayMessage(undefined)).toBe('');
  });

  it('round-trips filters through the URL, leaving defaults out', () => {
    const filters = { ...DEFAULT_FILTERS, mode: 'koth' as const, stable: 'automaton' as const, q: 'Iron', page: 3 };
    const params = writeBattleFilters(new URLSearchParams('battle=12'), filters);
    expect(params.toString()).toBe('battle=12&mode=koth&stable=automaton&q=Iron&page=3');
    expect(readBattleFilters(params)).toEqual(filters);
    expect(writeBattleFilters(params, DEFAULT_FILTERS).toString()).toBe('battle=12');
  });

  it('ignores unknown URL values', () => {
    expect(readBattleFilters(new URLSearchParams('mode=league&stable=real&range=1y&page=-2'))).toEqual(DEFAULT_FILTERS);
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true);
  });

  it('states the scope plainly', () => {
    expect(scopeParts(DEFAULT_FILTERS)).toEqual(['All stables', 'All modes', 'Last 7 days']);
    expect(scopeParts({ ...DEFAULT_FILTERS, stable: 'human', mode: 'tag_team', outcome: 'draw', q: 'Iron' }))
      .toEqual(['With players', 'Tag Team', 'Draws', 'Last 7 days', 'Matching “Iron”']);
    // An id lookup ignores the date range, so the scope doesn't mention it.
    expect(scopeParts({ ...DEFAULT_FILTERS, q: '531203' })).toEqual(['All stables', 'All modes', 'Battle #531203']);
  });
});
