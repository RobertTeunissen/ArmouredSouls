/**
 * Subscription Service
 *
 * A subscription is a standing declaration of intent: *this robot wants to be
 * picked up by this event's matchmaker*. One rule governs all nine events, and
 * every change — single toggle or a whole-roster save — runs through the same
 * `applySubscriptionChange` core, so behaviour cannot diverge per event or per
 * entry point:
 *
 * 1. **Subscribing** is allowed while the robot occupies fewer slots than its
 *    Booking Office cap. It takes effect at the event's next scheduling moment.
 * 2. **Unsubscribing** is always allowed and immediate, for every event. Nothing
 *    is ever refused.
 * 3. **A match already on the schedule still runs.** Its slot stays occupied
 *    until it has been fought, so unsubscribing frees the *intent* immediately
 *    but the *slot* only once the obligation clears. A robot eliminated from a
 *    tournament bracket has no obligation left, so its slot frees at once.
 *
 * Rule 3 replaces the nine per-event locking predicates this service used to
 * call. They disagreed with each other — Grand Melee refused unsubscription
 * outright while KotH allowed it — which meant players could not predict what a
 * click would do. The shared "does this robot owe a match?" question now comes
 * from `services/scheduling/eventScheduleScope`, the same module pre-battle
 * repair uses to decide who is fighting next.
 *
 * @module services/subscription/subscriptionService
 */

import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';
import { getSubscriptionCap } from '../../config/subscriptions';
import {
  isRegisteredEvent,
  getRegisteredEvents,
  SubscribableEventType,
} from './eventRegistry';
import {
  resolveOutstandingEventsForRobot,
  resolveOutstandingEventsForRobots,
} from '../scheduling/eventScheduleScope';
import { getNextSchedulingMoments } from '../scheduling/eventCronSchedule';
import { SubscriptionError, SubscriptionErrorCode } from '../../errors/subscriptionErrors';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import logger from '../../config/logger';

// ── Types ────────────────────────────────────────────────────────────

type Tx = Prisma.TransactionClient;

export interface RobotSubscriptionInfo {
  subscriptions: { id: number; robotId: number; eventType: string; status: string; createdAt: Date }[];
  cap: number;
  level: number;
  /** Events whose slot is still occupied by a match that has been booked but not fought. */
  heldSlots: string[];
  /** Next moment each event books matches, ISO-8601 UTC, keyed by event type. */
  nextSchedulingMoments: Record<string, string>;
}

export interface StableOverviewRobot {
  robotId: number;
  robotName: string;
  subscriptions: { eventType: string; status: string }[];
  /** Events this robot still owes a match to — the slot is not free yet. */
  heldSlots: string[];
  cap: number;
}

export interface StableOverview {
  robots: StableOverviewRobot[];
  registeredEvents: { type: string; label: string }[];
  bookingOfficeLevel: number;
  nextSchedulingMoments: Record<string, string>;
}

/** Outcome of a subscription change, single or bulk. */
export interface SubscriptionChangeResult {
  added: string[];
  removed: string[];
  /** Slots still occupied by a booked match after the change. */
  heldSlots: string[];
  /** Slots occupied afterwards: subscriptions plus held slots. */
  occupiedCount: number;
  cap: number;
  level: number;
}

// ── Slot accounting ──────────────────────────────────────────────────

/**
 * Slots a robot occupies: everything it is subscribed to, plus every event it
 * still owes a match to even after unsubscribing.
 *
 * Counting held obligations is what keeps the permissive unsubscribe rule
 * honest. Without it a robot could leave a tournament mid-bracket, spend the
 * freed slot on a league, and still fight out the bracket — more events at once
 * than its Booking Office pays for.
 */
function occupiedSlots(subscribed: Iterable<string>, held: Iterable<string>): Set<string> {
  return new Set<string>([...subscribed, ...held]);
}

async function bookingOfficeLevel(userId: number, tx: Tx): Promise<number> {
  const facility = await tx.facility.findUnique({
    where: { userId_facilityType: { userId, facilityType: 'booking_office' } },
  });
  return facility?.level ?? 0;
}

async function assertOwnership(robotId: number, requestingUserId: number, tx: Tx): Promise<number> {
  const robot = await tx.robot.findUnique({ where: { id: robotId }, select: { userId: true } });
  if (!robot || robot.userId !== requestingUserId) {
    throw new SubscriptionError(SubscriptionErrorCode.ACCESS_DENIED, 'Access denied', 403);
  }
  return robot.userId;
}

async function currentEventTypes(robotId: number, tx: Tx): Promise<string[]> {
  const rows = await tx.subscription.findMany({
    where: { robotId },
    select: { eventType: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => r.eventType);
}

// ── Eligibility helpers used by the matchmakers ───────────────────────

/**
 * Check whether a robot is subscribed to a specific event type.
 * Single DB existence check — the core eligibility helper used by all matchmakers.
 */
export async function isRobotSubscribedTo(robotId: number, eventType: string): Promise<boolean> {
  const count = await prisma.subscription.count({
    where: { robotId, eventType, status: 'active' },
  });
  return count > 0;
}

/**
 * Alias of `isRobotSubscribedTo`, kept for the team-registration call sites.
 *
 * Subscriptions used to have a two-state model where a freshly created row sat
 * in `pending` until a matchmaker promoted it, and team registration had to
 * accept both states. Nothing ever wrote `pending`, so the distinction only ever
 * confused readers; the two helpers now ask exactly the same question.
 */
export async function hasSubscription(robotId: number, eventType: string): Promise<boolean> {
  return isRobotSubscribedTo(robotId, eventType);
}

// ── The one write path ───────────────────────────────────────────────

/**
 * Bring a robot's subscriptions to exactly `desiredEventTypes`.
 *
 * Every entry point funnels through here, so a single toggle and a roster-wide
 * save behave identically. Rejection is all-or-nothing: if the requested set
 * would exceed the cap, nothing is written and the error carries the numbers the
 * UI needs to explain why.
 */
async function applySubscriptionChange(
  robotId: number,
  desiredEventTypes: string[],
  requestingUserId: number,
  tx: Tx,
): Promise<SubscriptionChangeResult> {
  const userId = await assertOwnership(robotId, requestingUserId, tx);

  const desired = [...new Set(desiredEventTypes)];
  for (const eventType of desired) {
    if (!isRegisteredEvent(eventType)) {
      throw new SubscriptionError(
        SubscriptionErrorCode.SUBSCRIPTION_UNKNOWN_EVENT,
        `Unknown event type: ${eventType}`,
      );
    }
  }

  const current = await currentEventTypes(robotId, tx);
  const desiredSet = new Set(desired);
  const currentSet = new Set(current);

  const toAdd = desired.filter((e) => !currentSet.has(e));
  const toRemove = current.filter((e) => !desiredSet.has(e));

  const held = await resolveOutstandingEventsForRobot(robotId, tx);
  const occupied = occupiedSlots(desired, held);

  const level = await bookingOfficeLevel(userId, tx);
  const cap = getSubscriptionCap(level);

  if (occupied.size > cap) {
    const heldWithoutSubscription = held.filter((e) => !desiredSet.has(e));
    throw new SubscriptionError(
      SubscriptionErrorCode.SUBSCRIPTION_CAP_EXCEEDED,
      `That would put the robot at ${occupied.size}/${cap} event slots. Upgrade the Booking Office for more.`,
      400,
      {
        currentCount: occupied.size,
        requestedCount: desired.length,
        cap,
        level,
        heldSlots: heldWithoutSubscription,
      },
    );
  }

  if (toAdd.length === 0 && toRemove.length === 0) {
    return { added: [], removed: [], heldSlots: held, occupiedCount: occupied.size, cap, level };
  }

  if (toRemove.length > 0) {
    await tx.subscription.deleteMany({ where: { robotId, eventType: { in: toRemove } } });
  }

  if (toAdd.length > 0) {
    await tx.subscription.createMany({
      data: toAdd.map((eventType) => ({ robotId, eventType, status: 'active' })),
    });
    await ensurePlacementStandings(robotId, toAdd, tx);
  }

  await recalculateTeamEligibility(robotId, tx);
  await writeAuditEntries(robotId, requestingUserId, toAdd, toRemove, occupied.size, level, tx);

  logger.info('[Subscription] Changed', {
    robotId,
    userId: requestingUserId,
    added: toAdd,
    removed: toRemove,
    heldSlots: held,
    occupied: occupied.size,
    cap,
  });

  return { added: toAdd, removed: toRemove, heldSlots: held, occupiedCount: occupied.size, cap, level };
}

/**
 * Placement-based modes rank from a Standing row, so one has to exist before the
 * matchmaker can see the robot at all. (Spec #44: R6.5)
 */
async function ensurePlacementStandings(robotId: number, added: string[], tx: Tx): Promise<void> {
  const placementModes = added.filter((e) => e === 'koth' || e === 'grand_melee');

  for (const mode of placementModes as ('koth' | 'grand_melee')[]) {
    const existing = await tx.standing.findUnique({
      where: { entityType_entityId_mode: { entityType: 'robot', entityId: robotId, mode } },
    });
    if (existing) continue;

    await tx.standing.create({
      data: {
        entityType: 'robot',
        entityId: robotId,
        mode,
        tier: 'bronze',
        leagueInstanceId: 'bronze_1',
        leaguePoints: 0,
        cyclesInTier: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        currentWinStreak: 0,
        bestWinStreak: 0,
      },
    });
  }
}

/**
 * A team only fights when every member is subscribed to its mode, so any change
 * to a member's subscriptions can flip the team either way.
 */
async function recalculateTeamEligibility(robotId: number, tx: Tx): Promise<void> {
  const memberships = await tx.teamBattleMember.findMany({
    where: { robotId },
    include: { team: { include: { members: true } } },
  });

  for (const membership of memberships) {
    const team = membership.team;
    if (team.members.length !== team.teamSize) continue;

    const requiredEvent = team.teamSize === 2 ? 'league_2v2' : 'league_3v3';
    const subscribedMembers = await tx.subscription.count({
      where: {
        eventType: requiredEvent,
        robotId: { in: team.members.map((m) => m.robotId) },
      },
    });
    const allSubscribed = subscribedMembers === team.members.length;
    const eligibility = allSubscribed ? 'ELIGIBLE' : 'INELIGIBLE';

    if (team.eligibility !== eligibility) {
      await tx.teamBattle.update({ where: { id: team.id }, data: { eligibility } });
      logger.info('[Subscription] Team eligibility updated', {
        teamId: team.id,
        teamName: team.teamName,
        eligibility,
      });
    }
  }
}

/** One audit row per event added or removed, so admin trend charts stay per-event. */
async function writeAuditEntries(
  robotId: number,
  userId: number,
  added: string[],
  removed: string[],
  occupiedCount: number,
  level: number,
  tx: Tx,
): Promise<void> {
  const cycleNumber = await getCurrentCycleNumber();
  const lastEntry = await tx.auditLog.findFirst({
    where: { cycleNumber },
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  });
  let sequenceNumber = lastEntry ? lastEntry.sequenceNumber + 1 : 1;

  const entries = [
    ...added.map((eventType) => ({ eventType, type: 'subscription_create' as const })),
    ...removed.map((eventType) => ({ eventType, type: 'subscription_remove' as const })),
  ];

  for (const entry of entries) {
    await tx.auditLog.create({
      data: {
        cycleNumber,
        eventType: entry.type,
        sequenceNumber: sequenceNumber++,
        userId,
        robotId,
        payload: {
          eventType: entry.eventType,
          occupiedCount,
          bookingOfficeLevel: level,
        } satisfies Prisma.JsonObject,
      },
    });
  }
}

// ── Public write API ─────────────────────────────────────────────────

/**
 * Replace a robot's subscriptions with the given set — the bulk save behind the
 * Booking Office matrix.
 *
 * One request per robot instead of one per toggled cell: a full roster used to
 * cost upwards of a hundred requests and routinely tripped the rate limiter.
 */
export async function setSubscriptionsForRobot(
  robotId: number,
  eventTypes: string[],
  requestingUserId: number,
): Promise<SubscriptionChangeResult> {
  return prisma.$transaction((tx) =>
    applySubscriptionChange(robotId, eventTypes, requestingUserId, tx),
  );
}

/** Subscribe a robot to one event. Thin wrapper over the shared write path. */
export async function subscribeRobot(
  robotId: number,
  eventType: string,
  requestingUserId: number,
): Promise<SubscriptionChangeResult> {
  return prisma.$transaction(async (tx) => {
    await assertOwnership(robotId, requestingUserId, tx);

    if (!isRegisteredEvent(eventType)) {
      throw new SubscriptionError(
        SubscriptionErrorCode.SUBSCRIPTION_UNKNOWN_EVENT,
        `Unknown event type: ${eventType}`,
      );
    }

    const current = await currentEventTypes(robotId, tx);
    if (current.includes(eventType)) {
      throw new SubscriptionError(
        SubscriptionErrorCode.SUBSCRIPTION_DUPLICATE,
        `Robot is already subscribed to ${eventType}`,
      );
    }

    return applySubscriptionChange(robotId, [...current, eventType], requestingUserId, tx);
  });
}

/**
 * Unsubscribe a robot from one event. Thin wrapper over the shared write path.
 *
 * Never refused. If a match for the event is already booked it still runs, and
 * the slot it occupies frees up once it has been fought.
 */
export async function unsubscribeRobot(
  robotId: number,
  eventType: string,
  requestingUserId: number,
): Promise<SubscriptionChangeResult> {
  return prisma.$transaction(async (tx) => {
    await assertOwnership(robotId, requestingUserId, tx);

    const current = await currentEventTypes(robotId, tx);
    if (!current.includes(eventType)) {
      throw new SubscriptionError(
        SubscriptionErrorCode.SUBSCRIPTION_NOT_FOUND,
        `Robot is not subscribed to ${eventType}`,
        404,
      );
    }

    return applySubscriptionChange(
      robotId,
      current.filter((e) => e !== eventType),
      requestingUserId,
      tx,
    );
  });
}

// ── Read API ─────────────────────────────────────────────────────────

/**
 * Get all subscriptions for a robot, its slot cap, the slots still held by
 * booked matches, and when each event next books matches.
 */
export async function getSubscriptionsForRobot(robotId: number): Promise<RobotSubscriptionInfo> {
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: { userId: true },
  });

  if (!robot) {
    return {
      subscriptions: [],
      cap: getSubscriptionCap(0),
      level: 0,
      heldSlots: [],
      nextSchedulingMoments: getNextSchedulingMoments(),
    };
  }

  const [subscriptions, facility, heldSlots] = await Promise.all([
    prisma.subscription.findMany({ where: { robotId }, orderBy: { createdAt: 'asc' } }),
    prisma.facility.findUnique({
      where: { userId_facilityType: { userId: robot.userId, facilityType: 'booking_office' } },
    }),
    resolveOutstandingEventsForRobot(robotId),
  ]);

  const level = facility?.level ?? 0;

  return {
    subscriptions,
    cap: getSubscriptionCap(level),
    level,
    heldSlots,
    nextSchedulingMoments: getNextSchedulingMoments(),
  };
}

/**
 * Stable-level overview: every robot × every registered event, with held slots
 * and scheduling moments so the matrix can explain itself without extra calls.
 */
export async function getStableOverview(userId: number): Promise<StableOverview> {
  const facility = await prisma.facility.findUnique({
    where: { userId_facilityType: { userId, facilityType: 'booking_office' } },
  });
  const level = facility?.level ?? 0;
  const cap = getSubscriptionCap(level);

  const robots = await prisma.robot.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      subscriptions: { select: { eventType: true, status: true } },
    },
    orderBy: { id: 'asc' },
  });

  const heldByRobot = await resolveOutstandingEventsForRobots(robots.map((r) => r.id));

  const registeredEvents = getRegisteredEvents().map((e) => ({ type: e.type, label: e.label }));

  return {
    robots: robots.map((robot) => ({
      robotId: robot.id,
      robotName: robot.name,
      subscriptions: robot.subscriptions.map((s) => ({ eventType: s.eventType, status: s.status })),
      heldSlots: heldByRobot.get(robot.id) ?? [],
      cap,
    })),
    registeredEvents,
    bookingOfficeLevel: level,
    nextSchedulingMoments: getNextSchedulingMoments(),
  };
}

/** Re-exported so callers can type against the registry union without a second import. */
export type { SubscribableEventType };
