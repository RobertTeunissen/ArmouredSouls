jest.mock('../../../../lib/prisma', () => ({ __esModule: true, default: {} }));

import { buildBattleWhere, escapeLike, parseBattleIdQuery, type BattleListParams } from '../battleListService';
import { combatLogStatus, logRemovalDate } from '../battleLogAccess';

const params = (overrides: Partial<BattleListParams> = {}): BattleListParams => ({
  page: 1, limit: 25, mode: 'all', stable: 'all', outcome: 'all', range: '7d', now: new Date('2026-10-25T12:00:00Z'), ...overrides,
});

describe('battle list filters → SQL', () => {
  it('defaults to the last 7 days only', () => {
    const where = buildBattleWhere(params());
    expect(where.sql).toBe('b.created_at >= ?');
    expect(where.values).toEqual([new Date('2026-10-18T12:00:00Z')]);
  });

  it('an id search ignores the date range', () => {
    const where = buildBattleWhere(params({ q: '#531203' }));
    expect(where.sql).toBe('b.id = ?');
    expect(where.values).toEqual([531203]);
  });

  it('season range adds no date condition', () => {
    expect(buildBattleWhere(params({ range: 'season' })).sql).toBe('TRUE');
  });

  it('filters by mode, stable type and a robot / stable name pattern, all parameterized', () => {
    const where = buildBattleWhere(params({ range: 'season', mode: 'koth', stable: 'automaton', q: '50%_off' }));
    expect(where.values).toEqual(expect.arrayContaining(['%50\\%\\_off%', 'koth', 'automaton']));
    expect(where.sql).toContain('u.stable_type::text = ?');
    expect(where.sql).toContain('r.name ILIKE ?');
    expect(where.sql).not.toContain('50%');
  });

  it('outcome filters exclude byes and forfeits from draws and the time limit', () => {
    const draw = buildBattleWhere(params({ range: 'season', outcome: 'draw' })).sql;
    expect(draw).toContain('b.winner_id IS NULL AND b.winning_side IS NULL AND NOT');
    expect(draw).toContain('is_bye_match');
    const limit = buildBattleWhere(params({ range: 'season', outcome: 'time_limit' }));
    expect(limit.sql).toContain('b.duration_seconds >= (CASE b.battle_type WHEN');
    expect(limit.values).toEqual(expect.arrayContaining(['league_1v1', 120, 'league_2v2', 300, 'koth', 150]));
  });
});

describe('parseBattleIdQuery / escapeLike', () => {
  it('reads #123 and 123 as ids, anything else as text', () => {
    expect(parseBattleIdQuery('#123')).toBe(123);
    expect(parseBattleIdQuery(' 77 ')).toBe(77);
    expect(parseBattleIdQuery('Iron 7')).toBeNull();
    expect(parseBattleIdQuery(undefined)).toBeNull();
  });

  it('escapes LIKE wildcards', () => {
    expect(escapeLike('a%b_c\\')).toBe('a\\%b\\_c\\\\');
  });
});

describe('combat log status', () => {
  it('the log goes at the first 01:30 UTC run after the retention window', () => {
    expect(logRemovalDate(new Date('2026-10-25T08:24:00Z'), 7).toISOString()).toBe('2026-11-02T01:30:00.000Z');
    expect(logRemovalDate(new Date('2026-10-25T01:00:00Z'), 7).toISOString()).toBe('2026-11-01T01:30:00.000Z');
  });

  it('two-sided modes always have formulas; placement logs need the storage marker', () => {
    const at = new Date('2026-10-25T08:00:00Z');
    expect(combatLogStatus('league_1v1', at, true, null)).toMatchObject({ hasFormulas: true, movementSampled: false });
    expect(combatLogStatus('koth', at, true, null)).toMatchObject({ hasFormulas: false, movementSampled: true });
    expect(combatLogStatus('grand_melee', at, true, { formulas: true, sampled: true })).toMatchObject({ hasFormulas: true, movementSampled: true });
    expect(combatLogStatus('grand_melee', at, false, { formulas: true, sampled: false }).available).toBe(false);
  });
});
