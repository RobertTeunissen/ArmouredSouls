/**
 * Subscription Service
 *
 * Core service for managing per-robot event subscriptions.
 * Two-state model: "active" (matchmaker will schedule) or "pending" (waiting for slot).
 * Handles subscribe, unsubscribe, cap enforcement, activation logic,
 * and stable-level overview queries.
 *
 * @module services/subscription/subscriptionService
 */

import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';
import { getSubscriptionCap } from '../../config/subscriptions';
import {
  isRegisteredEvent,
  getRegisteredEvents,
  getLockingPredicate,
  SubscribableEventType,
} from './eventRegistry';
import { SubscriptionError, SubscriptionErrorCode } from '../../errors/subscriptionErrors';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import logger from '../../config/logger';

// ── Types ────────────────────────────────────────────────────────────

export interface RobotSubscriptionInfo {
  subscriptions: { id: number; robotId: number; eventType: string; status: string; createdAt: Date }[];
  cap: number;
  level: number;
}

export interface StableOverviewRobot {
  robotId: number;
  robotName: string;
  subscriptions: { eventType: string; status: string }[];
  cap: number;
}

export interface StableOverview {
  robots: StableOverviewRobot[];
  registeredEvents: { type: string; label: string }[];
  bookingOfficeLevel: number;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Check if a robot is subscribed to a specific event type AND the subscription is active.
 * Single DB existence check — the core eligibility helper used by all matchmakers.
 * Only returns true for active subscriptions (pending ones are not eligible for matchmaking).
 */
export async function isRobotSubscribedTo(robotId: number, eventType: string): Promise<boolean> {
  const count = await prisma.subscription.count({
    where: { robotId, eventType, status: 'active' },
  });
  return count > 0;
}

/**
 * Check if a robot holds a subscription to a specific event type (active OR pending).
 * Used by team registration — a player who subscribed should be able to form a team
 * immediately, without waiting for the matchmaker to activate the subscription.
 */
export async function hasSubscription(robotId: number, eventType: string): Promise<boolean> {
  const count = await prisma.subscription.count({
    where: { robotId, eventType, status: { in: ['active', 'pending'] } },
  });
  return count > 0;
}

/**
 * Subscribe a robot to an event type.
 * New subscriptions start as 'pending'. The matchmaker activates them when the robot
 * has room under the active subscription cap.
 * Runs inside a Prisma interactive transaction with ownership check,
 * registry validation, duplicate check, cap check, row creation, and audit log.
 */
export async function subscribeRobot(
  robotId: number,
  eventType: string,
  requestingUserId: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. Verify ownership
    const robot = await tx.robot.findUnique({ where: { id: robotId } });
    if (!robot || robot.userId !== requestingUserId) {
      throw new SubscriptionError(SubscriptionErrorCode.ACCESS_DENIED, 'Access denied', 403);
    }

    // 2. Validate event type against registry
    if (!isRegisteredEvent(eventType)) {
      throw new SubscriptionError(
        SubscriptionErrorCode.SUBSCRIPTION_UNKNOWN_EVENT,
        `Unknown event type: ${eventType}`,
      );
    }

    // 3. Check for duplicate subscription
    const existing = await tx.subscription.findUnique({
      where: { subscription_robot_event: { robotId, eventType } },
    });
    if (existing) {
      throw new SubscriptionError(
        SubscriptionErrorCode.SUBSCRIPTION_DUPLICATE,
        `Robot is already subscribed to ${eventType}`,
      );
    }

    // 4. Check cap — counts ALL subscriptions (both active and pending)
    const currentCount = await tx.subscription.count({ where: { robotId } });
    const facility = await tx.facility.findUnique({
      where: { userId_facilityType: { userId: robot.userId, facilityType: 'booking_office' } },
    });
    const level = facility?.level ?? 0;
    const cap = getSubscriptionCap(level);

    if (currentCount >= cap) {
      throw new SubscriptionError(
        SubscriptionErrorCode.SUBSCRIPTION_CAP_EXCEEDED,
        `Robot has ${currentCount}/${cap} subscriptions. Upgrade Booking Office for more.`,
        400,
        { currentCount, cap, level },
      );
    }

    // 5. Create subscription row — active immediately (within cap)
    await tx.subscription.create({ data: { robotId, eventType, status: 'active' } });

    // 6. Recalculate team eligibility for any team this robot is on
    const teamMemberships = await tx.teamBattleMember.findMany({
      where: { robotId },
      include: { team: { include: { members: true } } },
    });
    for (const membership of teamMemberships) {
      const team = membership.team;
      if (team.members.length === team.teamSize) {
        // Check if all members now have the required subscription
        const requiredEvent = team.teamSize === 2 ? 'league_2v2' : 'league_3v3';
        let allSubscribed = true;
        for (const member of team.members) {
          const hasSub = await tx.subscription.count({
            where: { robotId: member.robotId, eventType: requiredEvent, status: { in: ['active', 'pending'] } },
          });
          if (hasSub === 0) { allSubscribed = false; break; }
        }
        if (allSubscribed && team.eligibility === 'INELIGIBLE') {
          await tx.teamBattle.update({ where: { id: team.id }, data: { eligibility: 'ELIGIBLE' } });
        }
      }
    }

    // 6. Audit log — use current cycle number for trend tracking
    const cycleNumber = await getCurrentCycleNumber();
    const lastEntry = await tx.auditLog.findFirst({
      where: { cycleNumber },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });
    const sequenceNumber = lastEntry ? lastEntry.sequenceNumber + 1 : 1;

    await tx.auditLog.create({
      data: {
        cycleNumber,
        eventType: 'subscription_create',
        sequenceNumber,
        userId: requestingUserId,
        robotId,
        payload: {
          eventType,
          status: 'active',
          newCount: currentCount + 1,
          bookingOfficeLevel: level,
        } satisfies Prisma.JsonObject,
      },
    });

    // 7. Structured log
    logger.info('[Subscription] Created (pending)', {
      robotId,
      userId: requestingUserId,
      eventType,
      level,
      newCount: currentCount + 1,
    });
  });
}

/**
 * Unsubscribe a robot from an event type.
 * No lock check except for tournament (robot alive in bracket).
 * Runs inside a Prisma interactive transaction with ownership check,
 * existence check, optional tournament lock, row deletion, and audit log.
 */
export async function unsubscribeRobot(
  robotId: number,
  eventType: string,
  requestingUserId: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. Verify ownership
    const robot = await tx.robot.findUnique({ where: { id: robotId } });
    if (!robot || robot.userId !== requestingUserId) {
      throw new SubscriptionError(SubscriptionErrorCode.ACCESS_DENIED, 'Access denied', 403);
    }

    // 2. Check subscription exists
    const existing = await tx.subscription.findUnique({
      where: { subscription_robot_event: { robotId, eventType } },
    });
    if (!existing) {
      throw new SubscriptionError(
        SubscriptionErrorCode.SUBSCRIPTION_NOT_FOUND,
        `Robot is not subscribed to ${eventType}`,
        404,
      );
    }

    // 3. Check locking predicate from the event registry
    const lockingPredicate = getLockingPredicate(eventType as SubscribableEventType);
    const isLocked = await lockingPredicate(robotId);
    if (isLocked) {
      throw new SubscriptionError(
        SubscriptionErrorCode.EVENT_SUBSCRIPTION_LOCKED,
        `Cannot unsubscribe from ${eventType} while locked by an active obligation`,
        409,
      );
    }

    // 4. Delete subscription row
    await tx.subscription.delete({
      where: { subscription_robot_event: { robotId, eventType } },
    });

    // 5. Audit log — use current cycle number for trend tracking
    const currentCount = await tx.subscription.count({ where: { robotId } });
    const cycleNumber = await getCurrentCycleNumber();
    const lastEntry = await tx.auditLog.findFirst({
      where: { cycleNumber },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });
    const sequenceNumber = lastEntry ? lastEntry.sequenceNumber + 1 : 1;

    await tx.auditLog.create({
      data: {
        cycleNumber,
        eventType: 'subscription_remove',
        sequenceNumber,
        userId: requestingUserId,
        robotId,
        payload: {
          eventType,
          newCount: currentCount,
        } satisfies Prisma.JsonObject,
      },
    });

    // 6. Structured log
    logger.info('[Subscription] Removed', {
      robotId,
      userId: requestingUserId,
      eventType,
      newCount: currentCount,
    });
  });
}

/**
 * Check all pending subscriptions for a robot and activate them if the robot's
 * total active subscription count is below the cap.
 * Called by each matchmaker at the start of its run.
 */
export async function activatePendingSubscriptions(robotId: number): Promise<void> {
  const robot = await prisma.robot.findUnique({ where: { id: robotId }, select: { userId: true } });
  if (!robot) return;

  const facility = await prisma.facility.findUnique({
    where: { userId_facilityType: { userId: robot.userId, facilityType: 'booking_office' } },
  });
  const level = facility?.level ?? 0;
  const cap = getSubscriptionCap(level);

  // Count currently active subscriptions
  const activeCount = await prisma.subscription.count({
    where: { robotId, status: 'active' },
  });

  if (activeCount >= cap) return; // Already at cap, can't activate more

  // Get pending subscriptions ordered by creation time (FIFO)
  const pendingSubs = await prisma.subscription.findMany({
    where: { robotId, status: 'pending' },
    orderBy: { createdAt: 'asc' },
  });

  const slotsAvailable = cap - activeCount;
  const toActivate = pendingSubs.slice(0, slotsAvailable);

  if (toActivate.length > 0) {
    await prisma.subscription.updateMany({
      where: { id: { in: toActivate.map(s => s.id) } },
      data: { status: 'active' },
    });

    logger.info('[Subscription] Activated pending subscriptions', {
      robotId,
      activated: toActivate.length,
      eventTypes: toActivate.map(s => s.eventType),
    });

    // Recalculate team eligibility for any team this robot is on
    const teamMemberships = await prisma.teamBattleMember.findMany({
      where: { robotId },
      include: { team: { include: { members: true } } },
    });
    for (const membership of teamMemberships) {
      const team = membership.team;
      if (team.members.length === team.teamSize && team.eligibility === 'INELIGIBLE') {
        const requiredEvent = team.teamSize === 2 ? 'league_2v2' : 'league_3v3';
        let allSubscribed = true;
        for (const member of team.members) {
          const hasSub = await prisma.subscription.count({
            where: { robotId: member.robotId, eventType: requiredEvent, status: { in: ['active', 'pending'] } },
          });
          if (hasSub === 0) { allSubscribed = false; break; }
        }
        if (allSubscribed) {
          await prisma.teamBattle.update({ where: { id: team.id }, data: { eligibility: 'ELIGIBLE' } });
          logger.info('[Subscription] Team eligibility restored', { teamId: team.id, teamName: team.teamName });
        }
      }
    }
  }
}

/**
 * Batch-activate pending subscriptions for multiple robots.
 * Called once per matchmaker run before pairing.
 * Only processes robots that have a pending subscription for the given event type.
 */
export async function batchActivatePendingSubscriptions(robotIds: number[], eventType: string): Promise<void> {
  // Find robots that have a pending subscription for this event type
  const pendingForEvent = await prisma.subscription.findMany({
    where: {
      robotId: { in: robotIds },
      eventType,
      status: 'pending',
    },
    select: { robotId: true },
  });

  // Activate pending subscriptions for each robot that has one pending for this event
  for (const { robotId } of pendingForEvent) {
    await activatePendingSubscriptions(robotId);
  }
}

/**
 * Get all subscriptions for a robot, plus cap info derived from the owning Stable's
 * Booking Office facility level.
 */
export async function getSubscriptionsForRobot(robotId: number): Promise<RobotSubscriptionInfo> {
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: { userId: true },
  });

  if (!robot) {
    return { subscriptions: [], cap: 3, level: 0 };
  }

  const [subscriptions, facility] = await Promise.all([
    prisma.subscription.findMany({
      where: { robotId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.facility.findUnique({
      where: { userId_facilityType: { userId: robot.userId, facilityType: 'booking_office' } },
    }),
  ]);

  const level = facility?.level ?? 0;
  const cap = getSubscriptionCap(level);

  return { subscriptions, cap, level };
}

/**
 * Get the stable-level overview: a matrix of all robots × all registered events.
 * Used by the Booking Office overview page.
 */
export async function getStableOverview(userId: number): Promise<StableOverview> {
  // Get Booking Office facility level
  const facility = await prisma.facility.findUnique({
    where: { userId_facilityType: { userId, facilityType: 'booking_office' } },
  });
  const level = facility?.level ?? 0;
  const cap = getSubscriptionCap(level);

  // Get all robots for this user with their subscriptions
  const robots = await prisma.robot.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      subscriptions: {
        select: { eventType: true, status: true },
      },
    },
    orderBy: { id: 'asc' },
  });

  // Get all registered events for column headers
  const registeredEvents = getRegisteredEvents().map((e) => ({
    type: e.type,
    label: e.label,
  }));

  const overviewRobots: StableOverviewRobot[] = robots.map((robot) => ({
    robotId: robot.id,
    robotName: robot.name,
    subscriptions: robot.subscriptions.map((s) => ({ eventType: s.eventType, status: s.status })),
    cap,
  }));

  return {
    robots: overviewRobots,
    registeredEvents,
    bookingOfficeLevel: level,
  };
}
