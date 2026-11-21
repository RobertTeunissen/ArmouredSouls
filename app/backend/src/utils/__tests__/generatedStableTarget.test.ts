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
  it('three-robot (WimpBot) stables: 3v3 events for all, 2v2 for robots 1–2, Grand Melee for robot 3', () => {
    expect(fillerSubscriptionsFor(0, 3)).toEqual(['league_3v3', 'tournament_3v3', 'tournament_1v1', 'tournament_2v2']);
    expect(fillerSubscriptionsFor(1, 3)).toEqual(['league_3v3', 'tournament_3v3', 'tournament_1v1', 'tournament_2v2']);
    expect(fillerSubscriptionsFor(2, 3)).toEqual(['league_3v3', 'tournament_3v3', 'tournament_1v1', 'grand_melee']);
  });

  it('two-robot (AverageBot) stables: no 3v3 events, both in the 2v2 tournament, robot 2 in Grand Melee', () => {
    expect(fillerSubscriptionsFor(0, 2)).toEqual(['tournament_1v1', 'tournament_2v2']);
    expect(fillerSubscriptionsFor(1, 2)).toEqual(['tournament_1v1', 'tournament_2v2', 'grand_melee']);
  });

  it('one-robot (ExpertBot) stables: only the 1v1 tournament and Grand Melee', () => {
    expect(fillerSubscriptionsFor(0, 1)).toEqual(['tournament_1v1', 'grand_melee']);
  });

  it('stays within the Booking Office L1 cap and never enters the leagues Automatons already fill', () => {
    for (const robotCount of [1, 2, 3] as const) {
      for (let slot = 0; slot < robotCount; slot++) {
        const events = fillerSubscriptionsFor(slot, robotCount);
        expect(events.length).toBeLessThanOrEqual(4);
        for (const event of ['league_1v1', 'league_2v2', 'tag_team', 'koth']) {
          expect(events).not.toContain(event);
        }
      }
    }
  });
});
