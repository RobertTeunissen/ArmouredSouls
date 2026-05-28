/**
 * Subscription API Routes
 *
 * Exposes endpoints for managing per-robot event subscriptions,
 * stable-level overview, event registry, and admin analytics.
 *
 * @module routes/subscriptions
 */

import express, { Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';
import {
  getSubscriptionsForRobot,
  subscribeRobot,
  unsubscribeRobot,
  getStableOverview,
} from '../services/subscription/subscriptionService';
import { getEligibleEvents } from '../services/subscription/rosterEligibilityFilter';
import prisma from '../lib/prisma';

const router = express.Router();

// --- Zod schemas ---

const robotIdParamSchema = z.object({
  robotId: positiveIntParam,
});

const subscribeBodySchema = z.object({
  eventType: z.string().min(1).max(30),
});

const adminAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
});

// --- Routes ---

// GET /api/subscriptions/robot/:robotId — get subscriptions + cap info for a robot
router.get(
  '/robot/:robotId',
  authenticateToken,
  validateRequest({ params: robotIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    const robotId = Number(req.params.robotId);
    const info = await getSubscriptionsForRobot(robotId);
    res.json(info);
  },
);

// POST /api/subscriptions/robot/:robotId/subscribe — subscribe robot to event
router.post(
  '/robot/:robotId/subscribe',
  authenticateToken,
  validateRequest({ params: robotIdParamSchema, body: subscribeBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const robotId = Number(req.params.robotId);
    const { eventType } = req.body;
    await subscribeRobot(robotId, eventType, req.user!.userId);
    res.json({ success: true, message: `Subscribed to ${eventType}. Takes effect next cycle.` });
  },
);

// POST /api/subscriptions/robot/:robotId/unsubscribe — unsubscribe robot from event
router.post(
  '/robot/:robotId/unsubscribe',
  authenticateToken,
  validateRequest({ params: robotIdParamSchema, body: subscribeBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const robotId = Number(req.params.robotId);
    const { eventType } = req.body;
    await unsubscribeRobot(robotId, eventType, req.user!.userId);
    res.json({ success: true, message: `Unsubscribed from ${eventType}. Takes effect next cycle.` });
  },
);

// GET /api/subscriptions/overview — stable-level matrix (all robots × all events)
router.get(
  '/overview',
  authenticateToken,
  validateRequest({}),
  async (req: AuthRequest, res: Response) => {
    const overview = await getStableOverview(req.user!.userId);
    res.json(overview);
  },
);

// GET /api/subscriptions/registry — list registered events with eligibility
router.get(
  '/registry',
  authenticateToken,
  validateRequest({}),
  async (req: AuthRequest, res: Response) => {
    const robotCount = await prisma.robot.count({ where: { userId: req.user!.userId } });
    const events = getEligibleEvents(robotCount);
    res.json({ events });
  },
);

// GET /api/subscriptions/admin/analytics — admin per-event subscriber counts + trends
router.get(
  '/admin/analytics',
  authenticateToken,
  requireAdmin,
  validateRequest({ query: adminAnalyticsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const days = Number(req.query.days) || 30;

    // Per-event subscriber counts
    const perEvent = await prisma.subscription.groupBy({
      by: ['eventType'],
      _count: { id: true },
    });

    // Trend data from audit logs
    const cycleMetadata = await prisma.cycleMetadata.findFirst({ where: { id: 1 } });
    const currentCycle = cycleMetadata?.totalCycles ?? 0;
    const minCycle = Math.max(0, currentCycle - days);

    const trendLogs = await prisma.auditLog.findMany({
      where: {
        eventType: { in: ['subscription_create', 'subscription_remove'] },
        cycleNumber: { gte: minCycle },
      },
      select: {
        cycleNumber: true,
        eventType: true,
        payload: true,
      },
      orderBy: { cycleNumber: 'asc' },
    });

    // Aggregate trends by cycle and event type
    const trendMap = new Map<number, Record<string, { subscribes: number; unsubscribes: number }>>();
    for (const log of trendLogs) {
      const cycle = log.cycleNumber;
      const payload = log.payload as Record<string, unknown> | null;
      const subEventType = (payload?.eventType as string) || 'unknown';

      if (!trendMap.has(cycle)) trendMap.set(cycle, {});
      const cycleData = trendMap.get(cycle)!;
      if (!cycleData[subEventType]) cycleData[subEventType] = { subscribes: 0, unsubscribes: 0 };

      if (log.eventType === 'subscription_create') {
        cycleData[subEventType].subscribes++;
      } else {
        cycleData[subEventType].unsubscribes++;
      }
    }

    const trends: Array<{ cycleNumber: number; eventType: string; subscribes: number; unsubscribes: number }> = [];
    for (const [cycle, eventData] of trendMap.entries()) {
      for (const [evType, counts] of Object.entries(eventData)) {
        trends.push({
          cycleNumber: cycle,
          eventType: evType,
          subscribes: counts.subscribes,
          unsubscribes: counts.unsubscribes,
        });
      }
    }

    // Per-stable breakdown
    const perStableRaw = await prisma.subscription.findMany({
      select: {
        eventType: true,
        robot: {
          select: {
            userId: true,
            user: { select: { stableName: true } },
          },
        },
      },
    });

    const stableMap = new Map<number, { stableId: number; stableName: string; events: Record<string, number> }>();
    for (const row of perStableRaw) {
      const stableId = row.robot.userId;
      if (!stableMap.has(stableId)) {
        stableMap.set(stableId, {
          stableId,
          stableName: row.robot.user?.stableName || `Stable #${stableId}`,
          events: {},
        });
      }
      const entry = stableMap.get(stableId)!;
      entry.events[row.eventType] = (entry.events[row.eventType] || 0) + 1;
    }

    const perStable = Array.from(stableMap.values())
      .sort((a, b) => {
        const totalA = Object.values(a.events).reduce((s, v) => s + v, 0);
        const totalB = Object.values(b.events).reduce((s, v) => s + v, 0);
        return totalB - totalA;
      })
      .slice(0, 50);

    // Flatten per-stable into rows the frontend expects: { stableId, stableName, eventType, robotCount }
    const stableBreakdown: Array<{ stableId: number; stableName: string; eventType: string; robotCount: number }> = [];
    for (const entry of perStable) {
      for (const [evType, count] of Object.entries(entry.events)) {
        stableBreakdown.push({
          stableId: entry.stableId,
          stableName: entry.stableName,
          eventType: evType,
          robotCount: count,
        });
      }
    }

    // Totals
    const totalSubscriptions = perEvent.reduce((sum, e) => sum + e._count.id, 0);
    const totalRobots = await prisma.robot.count();

    res.json({
      eventCounts: perEvent.map((e) => ({
        eventType: e.eventType,
        subscriberCount: e._count.id,
      })),
      trends,
      stableBreakdown,
      totalSubscriptions,
      totalRobots,
      // Legacy field names for backward compatibility
      perEvent: perEvent.map((e) => ({
        eventType: e.eventType,
        subscriberCount: e._count.id,
      })),
      perStable,
    });
  },
);

export default router;
