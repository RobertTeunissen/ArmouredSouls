import { allocateEvents, subscriptionChanges } from '../upkeep/subscriptionUpkeep';
import { SUBSCRIBABLE_EVENT_TYPES, type SubscribableEventType } from '../../subscription/eventRegistry';
import type { EventOrder } from '../../../types/automaton';
import { facilities, robot, stable, team } from './helpers/automatonFixtures';

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
