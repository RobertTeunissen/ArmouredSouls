/**
 * Subscription upkeep — Event_Allocation (Spec #55, R5.8, design §8.7 item 2;
 * ranked by expected value since the Automaton economy change, see
 * `docs/game-systems/PRD_AUTOMATON_STABLES.md` "Event_Allocation").
 *
 * Pure part: computes every live robot's desired subscriptions from its held
 * event types, the registered teams, the Booking_Cap, the Event_Order and the
 * robot's recent results. The executor (task 5.4) applies only the robots
 * whose desired set differs, via `setSubscriptionsForRobot`.
 *
 * Order in which free Booking Office slots are filled:
 * 1. Held event types (a booked match is still owed) occupy slots first.
 * 2. Pinned: each robot's first league in the Event_Order it can enter (its
 *    promotion path), so it never drifts out of league play.
 * 3. Every other (robot or team, event) by expected value per battle: income
 *    minus the repair that battle's damage would cost the robot now, from
 *    the robot's own last battles in that event, else its stable's robots
 *    with the same main-weapon range band, else all its stable's robots.
 *    An event without enough battles counts as 0 (neutral), so a new stable
 *    tries its events in Event_Order order and keeps the ones that pay. An
 *    event the robot already holds gets INCUMBENT_BONUS, so near-equal
 *    events do not swap every turn.
 * Ties, and every event without results, follow the Event_Order. Every slot
 * is still filled: ranking decides which events get the slots, not whether
 * the robot plays.
 */
import { calculateRepairQuote } from '../../../shared/utils/repairCost';
import { ROBOT_ATTRIBUTES } from '../../../shared/utils/robotAttributes';
import { SUBSCRIBABLE_EVENT_TYPES, type SubscribableEventType } from '../../subscription/eventRegistry';
import { bookingCapOf, type StableFacts } from '../stableFacts';
import type { EventObservation, RobotEventResults } from '../stableHistory';
import type { EventOrder } from '../../../types/automaton';

/** Events each robot enters on its own. */
export const SOLO_EVENT_TYPES: readonly SubscribableEventType[] = ['league_1v1', 'koth', 'grand_melee', 'tournament_1v1'];

/** League events: the promotion paths, one of which is pinned per robot. */
export const LEAGUE_EVENT_TYPES: readonly SubscribableEventType[] = ['league_1v1', 'league_2v2', 'league_3v3', 'tag_team'];

/** Team size of each team event. */
export const TEAM_EVENT_SIZE: Readonly<Partial<Record<SubscribableEventType, 2 | 3>>> = {
  league_2v2: 2,
  tag_team: 2,
  tournament_2v2: 2,
  league_3v3: 3,
  tournament_3v3: 3,
};

/** Battles of an event a robot (or its fallback pool) needs before the event has an expected value. */
export const MIN_EVENT_SAMPLE = 3;

/** Credits per battle added to an event the robot already holds, so near-equal events do not swap each turn. */
export const INCUMBENT_BONUS = 1_000;

export interface AllocationRobot {
  robotId: number;
  slotIndex: number;
  heldEventTypes: readonly SubscribableEventType[];
  /** Current subscriptions (INCUMBENT_BONUS); none when omitted. */
  subscriptions?: readonly SubscribableEventType[];
  /** Sum of the robot's attributes (prices the repair of a past battle's damage); 0 when omitted. */
  attributeTotal?: number;
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
  /** Recent results per robot (`StableHistoryFacts.eventResults`); without them only the Event_Order ranks. */
  results?: readonly RobotEventResults[];
  /** Repair Bay level that prices the repairs; 0 when omitted. */
  repairBayLevel?: number;
}

function sortBySubscribableOrder(events: Iterable<SubscribableEventType>): SubscribableEventType[] {
  const set = new Set(events);
  return SUBSCRIBABLE_EVENT_TYPES.filter((e) => set.has(e));
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Expected value per battle of `observations` for a robot of `attributeTotal` at `repairBayLevel`. */
export function expectedBattleValue(
  observations: readonly EventObservation[],
  attributeTotal: number,
  repairBayLevel: number,
): number {
  return mean(observations.map((o) => o.income - calculateRepairQuote(
    { attributeTotal, damagePercent: 100 - o.hpPercent, hpPercent: o.hpPercent },
    repairBayLevel,
  )));
}

/**
 * The battles that stand for `robotId` in `event`: its own when it has
 * MIN_EVENT_SAMPLE, else the stable's robots with the same range band, else
 * every robot of the stable; null when none of them has enough.
 */
export function observationsFor(
  results: readonly RobotEventResults[],
  robotId: number,
  event: SubscribableEventType,
): readonly EventObservation[] | null {
  const own = results.find((r) => r.robotId === robotId);
  const ownObservations = own?.byEvent[event] ?? [];
  if (ownObservations.length >= MIN_EVENT_SAMPLE) return ownObservations;
  const pool = (entries: readonly RobotEventResults[]): EventObservation[] => entries.flatMap((r) => r.byEvent[event] ?? []);
  if (own?.rangeBand) {
    const sameBand = pool(results.filter((r) => r.rangeBand === own.rangeBand));
    if (sameBand.length >= MIN_EVENT_SAMPLE) return sameBand;
  }
  const all = pool(results);
  return all.length >= MIN_EVENT_SAMPLE ? all : null;
}

interface Candidate {
  event: SubscribableEventType;
  memberRobotIds: readonly number[];
  pinned: boolean;
  score: number;
  orderIndex: number;
  lowestSlot: number;
}

/**
 * Event_Allocation (see the file comment for the order).
 *
 * @returns desired event types per robot id, in `SUBSCRIBABLE_EVENT_TYPES` order.
 */
export function allocateEvents(input: EventAllocationInput): Map<number, SubscribableEventType[]> {
  const robots = [...input.robots].sort((a, b) => a.slotIndex - b.slotIndex);
  const robotById = new Map(robots.map((r) => [r.robotId, r]));
  const desired = new Map<number, Set<SubscribableEventType>>(robots.map((r) => [r.robotId, new Set(r.heldEventTypes)]));
  const free = (robotId: number): number => input.bookingCap - (desired.get(robotId)?.size ?? input.bookingCap);
  const orderIndex = (event: SubscribableEventType): number => {
    const index = input.eventOrder.indexOf(event);
    return index === -1 ? input.eventOrder.length : index;
  };
  const results = input.results ?? [];
  const repairBayLevel = input.repairBayLevel ?? 0;

  const formedTeams = input.teams.filter((team) => team.memberRobotIds.every((id) => desired.has(id)));
  const inTeamOf = (robotId: number, size: 2 | 3): boolean =>
    formedTeams.some((team) => team.size === size && team.memberRobotIds.includes(robotId));
  const canEnter = (robotId: number, event: SubscribableEventType): boolean => {
    const size = TEAM_EVENT_SIZE[event];
    return size === undefined || inTeamOf(robotId, size);
  };

  // 2. Each robot's first enterable league in Event_Order order.
  const pinOf = new Map<number, SubscribableEventType | undefined>(robots.map((r) => [
    r.robotId,
    input.eventOrder.find((event) => LEAGUE_EVENT_TYPES.includes(event) && canEnter(r.robotId, event)),
  ]));

  const robotScore = (robotId: number, event: SubscribableEventType): number | null => {
    const observations = observationsFor(results, robotId, event);
    if (observations === null) return null;
    return expectedBattleValue(observations, robotById.get(robotId)?.attributeTotal ?? 0, repairBayLevel);
  };

  const candidateOf = (event: SubscribableEventType, memberRobotIds: readonly number[]): Candidate => {
    const scores = memberRobotIds.map((id) => robotScore(id, event));
    const known = scores.every((s): s is number => s !== null);
    const incumbent = memberRobotIds.every((id) => robotById.get(id)?.subscriptions?.includes(event) ?? false);
    return {
      event,
      memberRobotIds,
      pinned: memberRobotIds.some((id) => pinOf.get(id) === event),
      // Unknown counts as neutral (0); the incumbent bonus only applies to measured events.
      score: known ? mean(scores) + (incumbent ? INCUMBENT_BONUS : 0) : 0,
      orderIndex: orderIndex(event),
      lowestSlot: Math.min(...memberRobotIds.map((id) => robotById.get(id)?.slotIndex ?? 0)),
    };
  };

  const candidates: Candidate[] = [];
  for (const event of SUBSCRIBABLE_EVENT_TYPES) {
    const size = TEAM_EVENT_SIZE[event];
    if (size === undefined) {
      for (const robot of robots) candidates.push(candidateOf(event, [robot.robotId]));
      continue;
    }
    for (const team of formedTeams) {
      if (team.size === size) candidates.push(candidateOf(event, team.memberRobotIds));
    }
  }

  candidates.sort((a, b) => Number(b.pinned) - Number(a.pinned)
    || (a.pinned ? 0 : b.score - a.score)
    || a.orderIndex - b.orderIndex
    || a.lowestSlot - b.lowestSlot);

  for (const candidate of candidates) {
    const allFit = candidate.memberRobotIds.every((id) => desired.get(id)?.has(candidate.event) || free(id) > 0);
    if (!allFit) continue;
    for (const id of candidate.memberRobotIds) desired.get(id)?.add(candidate.event);
  }

  return new Map([...desired].map(([robotId, set]) => [robotId, sortBySubscribableOrder(set)]));
}

export interface SubscriptionChange {
  robotId: number;
  desired: SubscribableEventType[];
}

function attributeTotalOf(attributes: Readonly<Record<string, number>>): number {
  return ROBOT_ATTRIBUTES.reduce((sum, attribute) => sum + (attributes[attribute] ?? 0), 0);
}

/** Robots (slot order) whose desired subscriptions differ from their current ones. */
export function subscriptionChanges(facts: StableFacts, eventOrder: EventOrder): SubscriptionChange[] {
  const desired = allocateEvents({
    robots: facts.robots.map((robot) => ({
      robotId: robot.robotId,
      slotIndex: robot.slotIndex,
      heldEventTypes: robot.heldEventTypes,
      subscriptions: robot.subscriptions,
      attributeTotal: attributeTotalOf(robot.attributes),
    })),
    teams: facts.teams,
    bookingCap: bookingCapOf(facts),
    eventOrder,
    results: facts.history?.eventResults ?? [],
    repairBayLevel: facts.facilities.repair_bay,
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
