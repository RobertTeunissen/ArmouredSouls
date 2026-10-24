import {
  allocateEvents,
  expectedBattleValue,
  INCUMBENT_BONUS,
  MIN_EVENT_SAMPLE,
  observationsFor,
  subscriptionChanges,
  type AllocationRobot,
} from '../upkeep/subscriptionUpkeep';
import { SUBSCRIBABLE_EVENT_TYPES, type SubscribableEventType } from '../../subscription/eventRegistry';
import type { EventOrder } from '../../../types/automaton';
import type { EventObservation, RobotEventResults } from '../stableHistory';
import { attributesAt, facilities, robot, stable, team } from './helpers/automatonFixtures';

const ORDER: EventOrder = [...SUBSCRIBABLE_EVENT_TYPES];
const SOLO: SubscribableEventType[] = ['league_1v1', 'koth', 'grand_melee', 'tournament_1v1'];
const sorted = (events: SubscribableEventType[]): SubscribableEventType[] =>
  SUBSCRIBABLE_EVENT_TYPES.filter((e) => events.includes(e));

describe('Event_Allocation (R5.8, design §8.7 item 2)', () => {
  it('gives one robot the solo events up to the Booking_Cap', () => {
    const result = allocateEvents({
      robots: [{ robotId: 1, slotIndex: 1, heldEventTypes: [] }], teams: [], bookingCap: 4, eventOrder: ORDER,
    });
    expect(result.get(1)).toEqual(sorted(SOLO));
  });

  it('walks the Event_Order: earlier events win the slots', () => {
    const order: EventOrder = ['koth', 'grand_melee', 'league_1v1', 'tournament_1v1', 'league_2v2', 'league_3v3', 'tag_team', 'tournament_2v2', 'tournament_3v3'];
    const result = allocateEvents({
      robots: [{ robotId: 1, slotIndex: 1, heldEventTypes: [] }], teams: [], bookingCap: 3, eventOrder: order,
    });
    expect(result.get(1)).toEqual(sorted(['koth', 'grand_melee', 'league_1v1']));
  });

  it('lets held event types occupy slots first', () => {
    const result = allocateEvents({
      robots: [{ robotId: 1, slotIndex: 1, heldEventTypes: ['tournament_1v1'] }], teams: [], bookingCap: 3, eventOrder: ORDER,
    });
    expect(result.get(1)).toEqual(sorted(['tournament_1v1', 'league_1v1', 'koth']));
  });

  it('skips a team event when one member has no free slot and keeps the other member’s slot free', () => {
    const order: EventOrder = ['league_1v1', 'league_2v2', 'tag_team', 'koth', 'grand_melee', 'tournament_1v1', 'league_3v3', 'tournament_2v2', 'tournament_3v3'];
    const result = allocateEvents({
      robots: [
        { robotId: 1, slotIndex: 1, heldEventTypes: [] },
        { robotId: 2, slotIndex: 2, heldEventTypes: ['koth', 'grand_melee', 'tournament_1v1'] },
      ],
      teams: [{ size: 2, memberRobotIds: [1, 2] }],
      bookingCap: 4,
      eventOrder: order,
    });
    expect(result.get(2)).toEqual(sorted(['league_1v1', 'koth', 'grand_melee', 'tournament_1v1']));
    // Robot 1 is not entered in league_2v2/tag_team alone; its slots go to later solo events.
    expect(result.get(1)).toEqual(sorted(['league_1v1', 'koth', 'grand_melee', 'tournament_1v1']));
  });

  it('enters a whole team when every member has room', () => {
    const result = allocateEvents({
      robots: [{ robotId: 1, slotIndex: 1, heldEventTypes: [] }, { robotId: 2, slotIndex: 2, heldEventTypes: [] }],
      teams: [{ size: 2, memberRobotIds: [1, 2] }],
      bookingCap: 7,
      eventOrder: ORDER,
    });
    const expected = sorted([...SOLO, 'league_2v2', 'tag_team', 'tournament_2v2']);
    expect(result.get(1)).toEqual(expected);
    expect(result.get(2)).toEqual(expected);
  });

  it('skips team events for robots in no formed team of that size', () => {
    const result = allocateEvents({
      robots: [1, 2, 3].map((slot) => ({ robotId: slot, slotIndex: slot, heldEventTypes: [] })),
      teams: [{ size: 2, memberRobotIds: [1, 2] }, { size: 3, memberRobotIds: [1, 2, 3] }],
      bookingCap: 9,
      eventOrder: ORDER,
    });
    expect(result.get(1)).toEqual([...SUBSCRIBABLE_EVENT_TYPES]);
    expect(result.get(3)).toEqual(sorted([...SOLO, 'league_3v3', 'tournament_3v3']));
  });

  it('serves teams in Team_Rule order when slots run out', () => {
    // Four robots, two 2v2 teams; robot 3 holds two events, so team 2 cannot enter the second team event.
    const result = allocateEvents({
      robots: [
        { robotId: 1, slotIndex: 1, heldEventTypes: [] },
        { robotId: 2, slotIndex: 2, heldEventTypes: [] },
        { robotId: 3, slotIndex: 3, heldEventTypes: ['koth', 'grand_melee'] },
        { robotId: 4, slotIndex: 4, heldEventTypes: [] },
      ],
      teams: [{ size: 2, memberRobotIds: [4, 3] }, { size: 2, memberRobotIds: [1, 2] }],
      bookingCap: 3,
      eventOrder: ['league_2v2', 'tag_team', 'league_1v1', 'koth', 'grand_melee', 'tournament_1v1', 'league_3v3', 'tournament_2v2', 'tournament_3v3'],
    });
    expect(result.get(1)).toEqual(sorted(['league_2v2', 'tag_team', 'league_1v1']));
    expect(result.get(3)).toEqual(sorted(['koth', 'grand_melee', 'league_2v2']));
    expect(result.get(4)).toEqual(sorted(['league_2v2', 'league_1v1', 'koth']));
  });

  it('is deterministic whatever the input order', () => {
    const robots = [1, 2, 3].map((slot) => ({ robotId: slot * 10, slotIndex: slot, heldEventTypes: [] as SubscribableEventType[] }));
    const teams = [{ size: 2 as const, memberRobotIds: [10, 20] }, { size: 3 as const, memberRobotIds: [10, 20, 30] }];
    const a = allocateEvents({ robots, teams, bookingCap: 6, eventOrder: ORDER });
    const b = allocateEvents({ robots: [...robots].reverse(), teams: [...teams].reverse(), bookingCap: 6, eventOrder: ORDER });
    expect([...a].sort()).toEqual([...b].sort());
  });

  it('reports only robots whose desired set differs from their subscriptions', () => {
    const facts = stable({
      facilities: facilities({ booking_office: 1 }),
      robots: [
        robot(1, { subscriptions: ['tournament_1v1', 'grand_melee', 'koth', 'league_1v1'] }),
        robot(2, { subscriptions: ['league_1v1'] }),
      ],
      teams: [],
    });
    expect(subscriptionChanges(facts, ORDER)).toEqual([{ robotId: 1002, desired: sorted(SOLO) }]);
  });

  it('reads the results and Repair Bay level from the facts', () => {
    const destroyed = (income: number): EventObservation[] => [1, 2, 3].map(() => ({ income, hpPercent: 0 }));
    const facts = stable({
      facilities: facilities({ booking_office: 0 }),
      robots: [robot(1, { attributes: attributesAt(5), subscriptions: ['league_1v1', 'grand_melee', 'koth'] })],
      history: {
        economy: null,
        eventResults: [{ robotId: 1001, rangeBand: 'long', byEvent: { grand_melee: destroyed(1_000), koth: destroyed(1_000) } }],
      },
    });
    // 115 attribute points destroyed: ₡23,000 repairs per battle. The untried tournament (neutral) takes a slot;
    // KotH and Grand Melee tie, so the Event_Order gives the last slot to KotH.
    expect(subscriptionChanges(facts, ORDER)).toEqual([{ robotId: 1001, desired: sorted(['league_1v1', 'koth', 'tournament_1v1']) }]);
  });

  it('includes team events once the team is registered', () => {
    const facts = stable({
      facilities: facilities({ booking_office: 4 }),
      robots: [robot(1, { subscriptions: sorted(SOLO) }), robot(2, { subscriptions: sorted(SOLO) })],
      teams: [team(1, 2, [1001, 1002])],
    });
    const changes = subscriptionChanges(facts, ORDER);
    expect(changes.map((c) => c.robotId)).toEqual([1001, 1002]);
    expect(changes[0].desired).toEqual(sorted([...SOLO, 'league_2v2', 'tag_team', 'tournament_2v2']));
  });
});

describe('Event_Allocation by expected value', () => {
  const ATTRIBUTE_TOTAL = 127;
  const battles = (income: number, hpPercent: number, n = MIN_EVENT_SAMPLE): EventObservation[] =>
    Array.from({ length: n }, () => ({ income, hpPercent }));
  const soloRobot = (overrides: Partial<AllocationRobot> = {}): AllocationRobot => ({
    robotId: 1, slotIndex: 1, heldEventTypes: [], attributeTotal: ATTRIBUTE_TOTAL, ...overrides,
  });
  const results = (byEvent: RobotEventResults['byEvent'], rangeBand: string | null = 'long', robotId = 1): RobotEventResults =>
    ({ robotId, rangeBand, byEvent });

  it('prices a battle as income minus the repair its damage costs now', () => {
    // 127 points destroyed: 127 × 100 × 2 = ₡25,400; at half HP: ₡6,350; Repair Bay L5 takes 30% off.
    expect(expectedBattleValue(battles(8_000, 0), ATTRIBUTE_TOTAL, 0)).toBe(8_000 - 25_400);
    expect(expectedBattleValue(battles(8_000, 50), ATTRIBUTE_TOTAL, 0)).toBe(8_000 - 6_350);
    expect(expectedBattleValue(battles(8_000, 0), ATTRIBUTE_TOTAL, 5)).toBe(8_000 - 17_780);
  });

  it('drops the event that loses most when the slots run out', () => {
    const result = allocateEvents({
      robots: [soloRobot()],
      teams: [],
      bookingCap: 3,
      eventOrder: ['grand_melee', 'koth', 'tournament_1v1', 'league_1v1', 'league_2v2', 'league_3v3', 'tag_team', 'tournament_2v2', 'tournament_3v3'],
      results: [results({ grand_melee: battles(8_000, 0), koth: battles(8_000, 50) })],
    });
    // League pinned; KotH (+₡1,650) and the untried tournament (neutral) beat Grand Melee (−₡17,400).
    expect(result.get(1)).toEqual(sorted(['league_1v1', 'koth', 'tournament_1v1']));
  });

  it('keeps Grand Melee for a robot that does well in it', () => {
    const result = allocateEvents({
      robots: [soloRobot()],
      teams: [],
      bookingCap: 3,
      eventOrder: ORDER,
      results: [results({ grand_melee: battles(40_000, 0), koth: battles(8_000, 50) })],
    });
    expect(result.get(1)).toEqual(sorted(['league_1v1', 'grand_melee', 'koth']));
  });

  it('always keeps the first league of the Event_Order, however it pays', () => {
    const order: EventOrder = ['koth', 'grand_melee', 'tournament_1v1', 'league_1v1', 'league_2v2', 'league_3v3', 'tag_team', 'tournament_2v2', 'tournament_3v3'];
    const result = allocateEvents({
      robots: [soloRobot()],
      teams: [],
      bookingCap: 3,
      eventOrder: order,
      results: [results({ league_1v1: battles(1_500, 0), koth: battles(30_000, 80), grand_melee: battles(60_000, 0), tournament_1v1: battles(20_000, 90) })],
    });
    expect(result.get(1)).toEqual(sorted(['league_1v1', 'grand_melee', 'koth']));
  });

  it('borrows results from robots with the same range band, then from the whole stable', () => {
    const all = [
      results({ grand_melee: battles(40_000, 0) }, 'long', 1),
      results({}, 'long', 2),
      results({ koth: battles(9_000, 60) }, 'melee', 3),
      results({}, 'melee', 4),
    ];
    expect(observationsFor(all, 2, 'grand_melee')).toHaveLength(MIN_EVENT_SAMPLE);
    expect(observationsFor(all, 4, 'grand_melee')).toHaveLength(MIN_EVENT_SAMPLE);
    expect(observationsFor(all, 4, 'koth')?.[0]).toEqual({ income: 9_000, hpPercent: 60 });
    expect(observationsFor(all, 2, 'tournament_1v1')).toBeNull();
    // Fewer than the sample on its own: the pool decides, not the robot's two battles.
    const thin = [results({ koth: battles(1, 0, 2) }, null, 1), results({ koth: battles(9_000, 60) }, null, 2)];
    expect(observationsFor(thin, 1, 'koth')).toHaveLength(MIN_EVENT_SAMPLE + 2);
  });

  it('keeps a held event unless another beats it by more than the incumbent bonus', () => {
    const base = {
      teams: [],
      bookingCap: 2,
      eventOrder: ORDER,
    };
    const close = [results({ koth: battles(10_000, 100), grand_melee: battles(10_000 + INCUMBENT_BONUS / 2, 100) })];
    expect(allocateEvents({ ...base, robots: [soloRobot({ subscriptions: ['league_1v1', 'koth'] })], results: close }).get(1))
      .toEqual(sorted(['league_1v1', 'koth']));
    const clear = [results({ koth: battles(10_000, 100), grand_melee: battles(10_000 + INCUMBENT_BONUS * 2, 100) })];
    expect(allocateEvents({ ...base, robots: [soloRobot({ subscriptions: ['league_1v1', 'koth'] })], results: clear }).get(1))
      .toEqual(sorted(['league_1v1', 'grand_melee']));
  });

  it('scores a team event by the mean of its members', () => {
    const robots = [soloRobot({ robotId: 1, slotIndex: 1 }), soloRobot({ robotId: 2, slotIndex: 2 })];
    const result = allocateEvents({
      robots,
      teams: [{ size: 2, memberRobotIds: [1, 2] }],
      bookingCap: 3,
      eventOrder: ['league_2v2', 'tag_team', 'tournament_2v2', 'league_1v1', 'koth', 'grand_melee', 'tournament_1v1', 'league_3v3', 'tournament_3v3'],
      results: [
        results({ tag_team: battles(5_000, 0), koth: battles(5_000, 100), grand_melee: battles(5_000, 100), tournament_1v1: battles(5_000, 100), league_1v1: battles(5_000, 100), tournament_2v2: battles(5_000, 100) }, 'long', 1),
        results({ tag_team: battles(5_000, 100), koth: battles(5_000, 100), grand_melee: battles(5_000, 100), tournament_1v1: battles(5_000, 100), league_1v1: battles(5_000, 100), tournament_2v2: battles(5_000, 100) }, 'long', 2),
      ],
    });
    // league_2v2 is pinned (untried); Tag Team averages −₡7,700 for the pair, so ₡5,000 events take the other slots.
    expect(result.get(1)).not.toContain('tag_team');
    expect(result.get(1)).toContain('league_2v2');
    expect(result.get(1)).toEqual(result.get(2));
  });
});
