import {
  GENERATED_STABLE_TARGET_DEFAULT,
  fillerSubscriptionsFor,
  getGeneratedStableTarget,
} from '../userGeneration';

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: {} }));

const ORIGINAL = process.env.GENERATED_STABLE_TARGET;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.GENERATED_STABLE_TARGET;
  else process.env.GENERATED_STABLE_TARGET = ORIGINAL;
});

describe('getGeneratedStableTarget', () => {
  it('defaults to 150 when unset or blank', () => {
    expect(GENERATED_STABLE_TARGET_DEFAULT).toBe(150);
    delete process.env.GENERATED_STABLE_TARGET;
    expect(getGeneratedStableTarget()).toBe(150);
    process.env.GENERATED_STABLE_TARGET = '  ';
    expect(getGeneratedStableTarget()).toBe(150);
  });

  it('reads a non-negative integer, 0 turning generation off', () => {
    process.env.GENERATED_STABLE_TARGET = '200';
    expect(getGeneratedStableTarget()).toBe(200);
    process.env.GENERATED_STABLE_TARGET = '0';
    expect(getGeneratedStableTarget()).toBe(0);
  });

  it('falls back to the default for invalid values', () => {
    for (const value of ['-1', '1.5', 'many', '12abc']) {
      process.env.GENERATED_STABLE_TARGET = value;
      expect(getGeneratedStableTarget()).toBe(150);
    }
  });
});

describe('fillerSubscriptionsFor', () => {
  it('gives each robot four events (the Booking Office L1 cap)', () => {
    expect(fillerSubscriptionsFor(0)).toEqual(['league_3v3', 'tournament_3v3', 'tournament_1v1', 'tournament_2v2']);
    expect(fillerSubscriptionsFor(1)).toEqual(['league_3v3', 'tournament_3v3', 'tournament_1v1', 'tournament_2v2']);
    expect(fillerSubscriptionsFor(2)).toEqual(['league_3v3', 'tournament_3v3', 'tournament_1v1', 'grand_melee']);
  });

  it('never enters the leagues Automatons already fill', () => {
    for (const slot of [0, 1, 2]) {
      for (const event of ['league_1v1', 'league_2v2', 'tag_team', 'koth']) {
        expect(fillerSubscriptionsFor(slot)).not.toContain(event);
      }
    }
  });
});
