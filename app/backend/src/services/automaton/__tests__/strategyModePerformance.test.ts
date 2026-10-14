/**
 * Per-mode strategy performance (admin Automatons page, Strategy_Comparison
 * `modes`): zero-filled six-mode block in fixed order, placement vs
 * head-to-head arithmetic, low-sample rule and strategy-key selection.
 */
import { buildModePerformance, winPercentage, type ModeAggregate } from '../strategyModePerformance';
import { TIERED_STANDINGS_MODES } from '../../../shared/utils/automatonStandingsTier';

const aggregate = (overrides: Partial<ModeAggregate> & Pick<ModeAggregate, 'mode'>): ModeAggregate => ({
  strategyKey: 'swarm',
  stables: 0,
  entities: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  placementMatches: 0,
  bestPlacement: null,
  ...overrides,
});

describe('winPercentage', () => {
  it('rounds to one decimal and is null with no matches', () => {
    expect(winPercentage(5, 6)).toBe(83.3);
    expect(winPercentage(1, 5)).toBe(20);
    expect(winPercentage(0, 0)).toBeNull();
  });
});

describe('buildModePerformance', () => {
  it('returns six zero-filled entries in fixed order with kind and entity type per mode', () => {
    const modes = buildModePerformance([], 'swarm');
    expect(modes.map((m) => m.mode)).toEqual([...TIERED_STANDINGS_MODES]);
    expect(modes.map((m) => [m.kind, m.entityType])).toEqual([
      ['head_to_head', 'robot'],
      ['head_to_head', 'team'],
      ['head_to_head', 'team'],
      ['head_to_head', 'team'],
      ['placement', 'robot'],
      ['placement', 'robot'],
    ]);
    for (const entry of modes) {
      expect(entry).toMatchObject({ stablesPlayed: 0, entitiesPlayed: 0, wins: 0, losses: 0, draws: 0, matches: 0, winPercentage: null, bestPlacement: null, lowSample: true });
    }
  });

  it('counts head-to-head matches as W+L+D and never exposes a best placement', () => {
    const [oneVsOne] = buildModePerformance(
      [aggregate({ mode: 'league_1v1', stables: 2, entities: 3, wins: 5, losses: 1, draws: 0, placementMatches: 99, bestPlacement: 1 })],
      'swarm',
    );
    expect(oneVsOne).toEqual({
      mode: 'league_1v1',
      kind: 'head_to_head',
      entityType: 'robot',
      stablesPlayed: 2,
      entitiesPlayed: 3,
      wins: 5,
      losses: 1,
      draws: 0,
      matches: 6,
      winPercentage: 83.3,
      bestPlacement: null,
      lowSample: true,
    });
  });

  it('uses placement matches for KotH / Grand Melee and keeps the best placement', () => {
    const modes = buildModePerformance(
      [
        aggregate({ mode: 'koth', stables: 1, entities: 1, wins: 1, placementMatches: 5, bestPlacement: 1 }),
        aggregate({ mode: 'grand_melee', stables: 1, entities: 1, wins: 0, placementMatches: 4, bestPlacement: 3 }),
      ],
      'swarm',
    );
    expect(modes[4]).toMatchObject({ mode: 'koth', kind: 'placement', wins: 1, losses: 0, draws: 0, matches: 5, winPercentage: 20, bestPlacement: 1 });
    expect(modes[5]).toMatchObject({ mode: 'grand_melee', wins: 0, matches: 4, winPercentage: 0, bestPlacement: 3 });
  });

  it('flags a low sample below 5 stables or 20 matches', () => {
    const lowSample = (stables: number, wins: number): boolean =>
      buildModePerformance([aggregate({ mode: 'league_1v1', stables, wins })], 'swarm')[0].lowSample;
    expect(lowSample(4, 100)).toBe(true);
    expect(lowSample(5, 19)).toBe(true);
    expect(lowSample(5, 20)).toBe(false);
  });

  it('selects the reference row (key null) separately from strategy keys', () => {
    const aggregates = [
      aggregate({ strategyKey: 'swarm', mode: 'tag_team', stables: 1, entities: 1, wins: 3 }),
      aggregate({ strategyKey: null, mode: 'tag_team', stables: 1, entities: 1, draws: 1 }),
    ];
    expect(buildModePerformance(aggregates, null)[3]).toMatchObject({ entityType: 'team', entitiesPlayed: 1, wins: 0, draws: 1, matches: 1, winPercentage: 0 });
    expect(buildModePerformance(aggregates, 'swarm')[3]).toMatchObject({ wins: 3, draws: 0, matches: 3, winPercentage: 100 });
    expect(buildModePerformance(aggregates, 'paragon')[3]).toMatchObject({ matches: 0, winPercentage: null });
  });
});
