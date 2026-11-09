/**
 * Subscription API Routes
 *
 * Exposes endpoints for managing per-robot event subscriptions,
 * stable-level overview and event registry. Admin event-entry analytics are
 * on the Meta page (`GET /api/admin/meta/builds`).
 *
 * @module routes/subscriptions
 */

import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest, validated } from '../middleware/schemaValidator';
import {
  robotIdParamSchema,
  subscribeBodySchema,
  setSubscriptionsBodySchema,
} from './schemas/subscriptionSchemas';
import {
  getSubscriptionsForRobot,
  subscribeRobot,
  unsubscribeRobot,
  setSubscriptionsForRobot,
  getStableOverview,
} from '../services/subscription/subscriptionService';
import { getEligibleEvents } from '../services/subscription/rosterEligibilityFilter';
import { achievementService, type UnlockedAchievement } from '../services/achievement';
import logger from '../config/logger';
import prisma from '../lib/prisma';

const router = express.Router();

/**
 * E35 "Ain't Nobody Got Time for That" after a subscription change. A failed
 * check never fails the change itself, which has already been saved.
 */
async function checkSubscriptionAchievements(userId: number, robotId: number): Promise<UnlockedAchievement[]> {
  try {
    return await achievementService.checkAndAward(userId, robotId, { type: 'subscription_changed', data: { robotId } });
  } catch (error) {
    logger.error(`Achievement check failed after subscription change for robot ${robotId}: ${error}`);
    return [];
  }
}

// --- Routes ---

// GET /api/subscriptions/robot/:robotId — get subscriptions + cap info for a robot
router.get(
  '/robot/:robotId',
  authenticateToken,
  ...validated({ params: robotIdParamSchema }, async (req: AuthRequest, res: Response, { params }) => {
    const robotId = params.robotId;
    const info = await getSubscriptionsForRobot(robotId);
    res.json(info);
  }),
);

// POST /api/subscriptions/robot/:robotId/subscribe — subscribe robot to event
router.post(
  '/robot/:robotId/subscribe',
  authenticateToken,
  ...validated({ params: robotIdParamSchema, body: subscribeBodySchema }, async (req: AuthRequest, res: Response, { params, body }) => {
    const robotId = params.robotId;
    const { eventType } = body;
    const result = await subscribeRobot(robotId, eventType, req.user!.userId);
    const achievementUnlocks = await checkSubscriptionAchievements(req.user!.userId, robotId);
    res.json({ success: true, message: `Subscribed to ${eventType}.`, ...result, achievementUnlocks });
  }),
);

// POST /api/subscriptions/robot/:robotId/unsubscribe — unsubscribe robot from event
router.post(
  '/robot/:robotId/unsubscribe',
  authenticateToken,
  ...validated({ params: robotIdParamSchema, body: subscribeBodySchema }, async (req: AuthRequest, res: Response, { params, body }) => {
    const robotId = params.robotId;
    const { eventType } = body;
    const result = await unsubscribeRobot(robotId, eventType, req.user!.userId);
    res.json({ success: true, message: `Unsubscribed from ${eventType}.`, ...result });
  }),
);

// PUT /api/subscriptions/robot/:robotId — replace a robot's whole subscription set
router.put(
  '/robot/:robotId',
  authenticateToken,
  ...validated({ params: robotIdParamSchema, body: setSubscriptionsBodySchema }, async (req: AuthRequest, res: Response, { params, body }) => {
    const robotId = params.robotId;
    const { eventTypes } = body;
    const result = await setSubscriptionsForRobot(robotId, eventTypes, req.user!.userId);
    const achievementUnlocks = await checkSubscriptionAchievements(req.user!.userId, robotId);
    res.json({ success: true, ...result, achievementUnlocks });
  }),
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

export default router;
