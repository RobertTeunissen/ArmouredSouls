/**
 * Subscription upkeep — Event_Allocation (Spec #55, R5.8, design §8.7 item 2).
 *
 * Pure part: computes every live robot's desired subscriptions from its held
 * event types, the registered teams, the Booking_Cap and the Event_Order. The
 * executor (task 5.4) applies only the robots whose desired set differs, via
 * `setSubscriptionsForRobot`.
 */
import { SUBSCRIBABLE_EVENT_TYPES, type SubscribableEventType } from '../../subscription/eventRegistry';
import { bookingCapOf, type StableFacts } from '../stableFacts';
import type { EventOrder } from '../../../types/automaton';

/** Events each robot enters on its own. */
export const SOLO_EVENT_TYPES: readonly SubscribableEventType[] = ['league_1v1', 'koth', 'grand_melee', 'tournament_1v1'];

/** Team size of each team event. */
export const TEAM_EVENT_SIZE: Readonly<Partial<Record<SubscribableEventType, 2 | 3>>> = {
  league_2v2: 2,
  tag_team: 2,
  tournament_2v2: 2,
  league_3v3: 3,
  tournament_3v3: 3,
};

export interface AllocationRobot {
  robotId: number;
  slotIndex: number;
  heldEventTypes: readonly SubscribableEventType[];
}

export interface AllocationTeam {
  size: 2 | 3;
  memberRobotIds: readonly number[];
}

export interface EventAllocationInput {
  /** Live robots; allocated in Blueprint_Slot order whatever the input order. */
  robots: readonly AllocationRobot[];
  /** Registered teams; each size is walked in Team_Rule order (lowest member slot first). */
  teams: readonly AllocationTeam[];
  bookingCap: number;
  eventOrder: EventOrder;
}

function sortBySubscribableOrder(events: Iterable<SubscribableEventType>): SubscribableEventType[] {
  const set = new Set(events);
  return SUBSCRIBABLE_EVENT_TYPES.filter((e) => set.has(e));
}

/**
 * Event_Allocation. Held event types occupy slots first; the Event_Order is
 * walked in order; a solo event goes to every robot with a free slot; a team
 * event goes to a whole formed team only if every member has a free slot
 * (or already holds it), otherwise to none of them. Robots in no formed team
 * of that size skip the event.
 *
 * @returns desired event types per robot id, in `SUBSCRIBABLE_EVENT_TYPES` order.
 */
export function allocateEvents(input: EventAllocationInput): Map<number, SubscribableEventType[]> {
  const robots = [...input.robots].sort((a, b) => a.slotIndex - b.slotIndex);
  const slotOf = new Map(robots.map((r) => [r.robotId, r.slotIndex]));
  const desired = new Map<number, Set<SubscribableEventType>>(robots.map((r) => [r.robotId, new Set(r.heldEventTypes)]));
  const free = (robotId: number): number => input.bookingCap - (desired.get(robotId)?.size ?? input.bookingCap);

  const formedTeams = (size: 2 | 3): AllocationTeam[] => input.teams
    .filter((team) => team.size === size && team.memberRobotIds.every((id) => desired.has(id)))
    .sort((a, b) => Math.min(...a.memberRobotIds.map((id) => slotOf.get(id) ?? 0))
      - Math.min(...b.memberRobotIds.map((id) => slotOf.get(id) ?? 0)));

  for (const event of input.eventOrder) {
    const teamSize = TEAM_EVENT_SIZE[event];
    if (teamSize === undefined) {
      for (const robot of robots) {
        const set = desired.get(robot.robotId);
        if (set && !set.has(event) && free(robot.robotId) > 0) set.add(event);
      }
      continue;
    }
    for (const team of formedTeams(teamSize)) {
      const allFit = team.memberRobotIds.every((id) => desired.get(id)?.has(event) || free(id) > 0);
      if (!allFit) continue;
      for (const id of team.memberRobotIds) desired.get(id)?.add(event);
    }
  }

  return new Map([...desired].map(([robotId, set]) => [robotId, sortBySubscribableOrder(set)]));
}

export interface SubscriptionChange {
  robotId: number;
  desired: SubscribableEventType[];
}

/** Robots (slot order) whose desired subscriptions differ from their current ones. */
export function subscriptionChanges(facts: StableFacts, eventOrder: EventOrder): SubscriptionChange[] {
  const desired = allocateEvents({
    robots: facts.robots,
    teams: facts.teams,
    bookingCap: bookingCapOf(facts),
    eventOrder,
  });
  const changes: SubscriptionChange[] = [];
  for (const robot of [...facts.robots].sort((a, b) => a.slotIndex - b.slotIndex)) {
    const want = desired.get(robot.robotId) ?? [];
    const have = sortBySubscribableOrder(robot.subscriptions);
    if (want.length !== have.length || want.some((event, i) => event !== have[i])) {
      changes.push({ robotId: robot.robotId, desired: want });
    }
  }
  return changes;
}
