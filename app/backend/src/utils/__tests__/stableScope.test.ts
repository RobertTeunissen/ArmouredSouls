/**
 * The admin portal's one stable-type filter: Players reuse the human-player
 * rule, Generated is every generated stable (the seeded test stables too).
 */
import { realUserFilter } from '../realUserFilter';
import { buildStableScopeFilter, STABLE_SCOPES } from '../stableScope';

describe('buildStableScopeFilter', () => {
  it('maps every scope', () => {
    expect(STABLE_SCOPES).toEqual(['players', 'automatons', 'generated', 'all']);
    expect(buildStableScopeFilter('players')).toEqual(realUserFilter());
    expect(buildStableScopeFilter('automatons')).toEqual({ stableType: 'automaton' });
    expect(buildStableScopeFilter('generated')).toEqual({ stableType: 'generated' });
    expect(buildStableScopeFilter('all')).toEqual({});
  });
});
