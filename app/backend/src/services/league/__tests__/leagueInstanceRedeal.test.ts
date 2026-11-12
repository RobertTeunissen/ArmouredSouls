/**
 * `redealLeagueInstances` (issue #599): re-deals every tier of every tiered
 * league mode with the shared instance cap, and isolates a failing mode/tier.
 */
import { redealLeagueInstances } from '../leagueInstanceRedeal';
import { LEAGUE_TIERS, rebalanceInstances } from '../leagueInstanceService';
import { TIERED_LEAGUE_MODES } from '../league-rules';
import { MAX_ENTITIES_PER_INSTANCE } from '../leagueInstancePlacement';

jest.mock('../leagueInstanceService', () => ({
  ...jest.requireActual('../leagueInstanceService'),
  rebalanceInstances: jest.fn(),
}));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockRebalance = rebalanceInstances as jest.MockedFunction<typeof rebalanceInstances>;

beforeEach(() => {
  jest.clearAllMocks();
  mockRebalance.mockResolvedValue(2);
});

describe('redealLeagueInstances', () => {
  it('re-deals every tier of every tiered mode with the shared instance cap', async () => {
    const result = await redealLeagueInstances('test');

    const calls = mockRebalance.mock.calls.map(([tier, options]) => `${options?.mode}/${tier}/${options?.maxPerInstance}`);
    const expected = TIERED_LEAGUE_MODES.flatMap((mode) =>
      LEAGUE_TIERS.map((tier) => `${mode}/${tier}/${MAX_ENTITIES_PER_INSTANCE}`));
    expect(calls).toEqual(expected);
    expect(result).toEqual({ moved: 2 * expected.length, failures: [] });
  });

  it('keeps re-dealing the other tiers when one fails, and reports it', async () => {
    mockRebalance.mockImplementation(async (tier, options) => {
      if (options?.mode === 'league_2v2' && tier === 'bronze') throw new Error('deadlock');
      return 1;
    });

    const result = await redealLeagueInstances('test');

    expect(result.failures).toEqual(['league_2v2/bronze']);
    expect(mockRebalance).toHaveBeenCalledTimes(TIERED_LEAGUE_MODES.length * LEAGUE_TIERS.length);
    expect(result.moved).toBe(TIERED_LEAGUE_MODES.length * LEAGUE_TIERS.length - 1);
  });
});
