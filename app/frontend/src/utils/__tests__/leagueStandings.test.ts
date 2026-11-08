import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  bestInstanceIn,
  countBy,
  entriesForMode,
  instanceLabel,
  modeFromParam,
  modeInfo,
  openingView,
  statusText,
  summariseLeagues,
  tierFromParam,
  zoneSummary,
  zoneWarning,
  type MyStandingEntry,
  type StandingStatus,
  type ZoneMeta,
} from '../leagueStandings';

const entry = (over: Partial<MyStandingEntry>): MyStandingEntry => ({
  mode: 'league_1v1', entityType: 'robot', entityId: 1, name: 'R', tier: 'gold', leagueInstanceId: 'gold_1',
  place: 10, instanceSize: 90, leaguePoints: 60, cyclesInTier: 6, minCycles: 5, status: null, ...over,
});

/** ApenRots on ACC (Nov 2026), trimmed: 1v1 spread over four tiers, 2v2 held below the LP minimum. */
const APENROTS: MyStandingEntry[] = [
  entry({ entityId: 1, tier: 'champion', leagueInstanceId: 'champion_1', place: 10, instanceSize: 34 }),
  entry({ entityId: 2, tier: 'champion', leagueInstanceId: 'champion_1', place: 15, instanceSize: 34 }),
  entry({ entityId: 3, tier: 'diamond', leagueInstanceId: 'diamond_1', place: 3, instanceSize: 67, status: { kind: 'held_lp', zone: 'promotion', minLP: 125 } }),
  entry({ entityId: 4, tier: 'diamond', leagueInstanceId: 'diamond_1', place: 52, instanceSize: 67, cyclesInTier: 0 }),
  entry({ entityId: 5, tier: 'platinum', leagueInstanceId: 'platinum_2', place: 3, instanceSize: 81, status: { kind: 'held_lp', zone: 'promotion', minLP: 100 } }),
  entry({ entityId: 6, tier: 'platinum', leagueInstanceId: 'platinum_4', place: 21, instanceSize: 80 }),
  entry({ entityId: 7, tier: 'gold', leagueInstanceId: 'gold_4', place: 53, instanceSize: 98 }),
  entry({ mode: 'league_2v2', entityType: 'team', entityId: 20, tier: 'diamond', leagueInstanceId: 'diamond_1', place: 1, status: { kind: 'held_lp', zone: 'promotion', minLP: 125 } }),
  entry({ mode: 'koth', entityId: 1, tier: 'platinum', leagueInstanceId: 'platinum_7', place: 1, minCycles: 10, status: { kind: 'held_cycles', zone: 'promotion', cyclesToGo: 4 } }),
  entry({ mode: 'grand_melee', entityId: 1, tier: 'silver', leagueInstanceId: 'silver_2', place: 9, status: { kind: 'promotes', zone: 'promotion' } }),
  entry({ mode: 'grand_melee', entityId: 2, tier: 'silver', leagueInstanceId: 'silver_2', place: 88, status: { kind: 'demotes', zone: 'demotion' } }),
];

const meta = (over: Partial<ZoneMeta>): ZoneMeta => ({
  tier: 'diamond', minLP: 125, minCycles: 5, minRobotsRequired: 10, hasEnoughRobots: true, promotionSlots: 6, demotionSlots: 6,
  promotionBlockReason: null, totalEntities: 67, totalInstances: 1, activeInstances: 1, instancesBelowMinimum: 0,
  smallestInstancePopulation: 67, isChampion: false, isBronze: false, ...over,
});

describe('URL params', () => {
  it('keeps the old ?mode= values so existing links land', () => {
    expect(['1v1', '2v2', '3v3', 'tag_team', 'koth', 'grand_melee'].map(modeFromParam)).toEqual(['1v1', '2v2', '3v3', 'tag_team', 'koth', 'grand_melee']);
    expect(modeFromParam('league_1v1')).toBe('1v1');
    expect(modeFromParam(null)).toBe('1v1');
  });

  it('accepts only real tiers', () => {
    expect(tierFromParam('diamond')).toBe('diamond');
    expect(tierFromParam('mythic')).toBeNull();
    expect(tierFromParam(null)).toBeNull();
  });

  it('labels instances', () => {
    expect(instanceLabel('diamond_1')).toBe('Diamond 1');
    expect(instanceLabel('champion_12')).toBe('Champion 12');
  });
});

describe('the viewer\'s entries', () => {
  it('sorts a league best first: highest tier, then place', () => {
    expect(entriesForMode(APENROTS, '1v1').map((e) => e.entityId)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('opens on the best instance, or all of Bronze without entries', () => {
    expect(openingView(APENROTS, '1v1')).toEqual({ tier: 'champion', instance: 'champion_1' });
    expect(openingView(APENROTS, 'koth')).toEqual({ tier: 'platinum', instance: 'platinum_7' });
    expect(openingView(APENROTS, '3v3')).toEqual({ tier: 'bronze', instance: null });
    expect(openingView([], '1v1')).toEqual({ tier: 'bronze', instance: null });
  });

  it('picks the best instance within a tier, if any', () => {
    expect(bestInstanceIn(APENROTS, '1v1', 'platinum')).toBe('platinum_2');
    expect(bestInstanceIn(APENROTS, '1v1', 'bronze')).toBeNull();
  });

  it('counts entries per tier and per instance', () => {
    expect([...countBy(APENROTS, '1v1', 'tier')]).toEqual([['champion', 2], ['diamond', 2], ['platinum', 2], ['gold', 1]]);
    expect(countBy(APENROTS, '1v1', 'leagueInstanceId').get('diamond_1')).toBe(2);
  });

  it('summarises each league with what moves', () => {
    const cards = summariseLeagues(APENROTS);
    expect(cards.map((c) => c.mode.key)).toEqual(['1v1', '2v2', 'koth', 'grand_melee']);
    const [solo, duo, koth, melee] = cards;
    expect(solo).toMatchObject({ count: 7, tierCount: 4, best: { entityId: 1 }, movement: { text: '2 held below the LP minimum', tone: 'warning' } });
    expect(duo.movement?.text).toBe('1 held below the LP minimum');
    expect(koth.movement).toEqual({ text: '1 in a promotion place', tone: 'success' });
    expect(melee.movement).toEqual({ text: '1 promotes · 1 demotes', tone: 'success' });
    expect(summariseLeagues([entry({ status: null })])[0].movement).toEqual({ text: 'Nobody in a zone', tone: 'neutral' });
  });
});

describe('statusText', () => {
  it('says what each status means', () => {
    expect(statusText({ kind: 'promotes', zone: 'promotion' }, 'platinum').label).toBe('Promotes');
    expect(statusText({ kind: 'demotes', zone: 'demotion' }, null).label).toBe('Demotes');
    expect(statusText({ kind: 'held_lp', zone: 'promotion', minLP: 125 }, 'champion')).toMatchObject({ label: 'Needs 125 LP', tone: 'warning' });
    expect(statusText({ kind: 'held_cycles', zone: 'demotion', cyclesToGo: 1 }, null).label).toBe('1 cycle to go');
    expect(statusText({ kind: 'held_cycles', zone: 'promotion', cyclesToGo: 4 }, null).label).toBe('4 cycles to go');
    expect(statusText({ kind: 'held_cohort', zone: 'promotion' }, 'champion').label).toBe('Held: Champion is empty');
  });

  it('has a label and a description for every status (property)', () => {
    const status = fc.record({
      kind: fc.constantFrom('promotes', 'demotes', 'held_lp', 'held_cycles', 'held_cohort'),
      zone: fc.constantFrom('promotion', 'demotion'),
      cyclesToGo: fc.integer({ min: 1, max: 10 }),
      minLP: fc.integer({ min: 25, max: 125 }),
    }) as fc.Arbitrary<StandingStatus>;
    fc.assert(fc.property(status, fc.constantFrom('silver', 'champion', null), (s, above) => {
      const text = statusText(s, above);
      expect(text.label.length).toBeGreaterThan(0);
      expect(text.label.length).toBeLessThanOrEqual(24);
      expect(text.description).toMatch(/\.$/);
    }));
  });
});

describe('zoneSummary / zoneWarning', () => {
  it('describes an instance (ACC 1v1 Diamond 1)', () => {
    expect(zoneSummary(meta({}), modeInfo('1v1'), false).join(' · '))
      .toBe('67 robots · top 6 go up to Champion, bottom 6 down to Platinum · moving needs 5 cycles in Diamond; going up also needs 125 LP');
  });

  it('describes Champion (no promotion, no LP minimum) and Bronze (no demotion)', () => {
    expect(zoneSummary(meta({ tier: 'champion', minLP: null, isChampion: true, promotionSlots: 0, demotionSlots: 3, totalEntities: 34 }), modeInfo('1v1'), false).join(' · '))
      .toBe('34 robots · bottom 3 down to Diamond · moving needs 5 cycles in Champion');
    expect(zoneSummary(meta({ tier: 'bronze', minLP: 25, isBronze: true, demotionSlots: 0, totalEntities: 100 }), modeInfo('1v1'), false).join(' · '))
      .toBe('100 robots · top 6 go up to Silver · moving needs 5 cycles in Bronze; going up also needs 25 LP');
  });

  it('describes a whole tier per instance, and placement modes without an LP gate', () => {
    expect(zoneSummary(meta({ tier: 'platinum', minLP: 0, minCycles: 10, totalEntities: 603, totalInstances: 7, activeInstances: 7 }), modeInfo('koth'), true).join(' · '))
      .toBe('603 robots in 7 instances · top 10% of each instance go up to Diamond, bottom 10% down to Gold · moving needs 10 cycles in Platinum');
  });

  it('says when nobody can move', () => {
    const paused = meta({ hasEnoughRobots: false, totalEntities: 6, activeInstances: 0, instancesBelowMinimum: 1, promotionSlots: 0, demotionSlots: 0 });
    expect(zoneSummary(paused, modeInfo('2v2'), false).join(' · ')).toBe('6 teams · nobody moves until an instance has 10');
    expect(zoneWarning(paused, modeInfo('2v2'))).toBe('Fewer than 10 teams here: nobody moves until it fills up.');
    expect(zoneWarning(meta({ promotionBlockReason: 'destination_cohort_too_small' }), modeInfo('3v3'))).toMatch(/^Promotion is held: Champion is empty/);
    expect(zoneWarning(meta({ totalInstances: 3, activeInstances: 2, instancesBelowMinimum: 1 }), modeInfo('1v1'))).toBe('1 instance has fewer than 10 robots: nobody moves there yet.');
    expect(zoneWarning(meta({}), modeInfo('1v1'))).toBeNull();
  });
});
