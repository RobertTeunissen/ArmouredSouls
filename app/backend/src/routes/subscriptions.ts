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
import { validateRequest } from '../middleware/schemaValidator';
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
import prisma from '../lib/prisma';

const router = express.Router();

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
    const result = await subscribeRobot(robotId, eventType, req.user!.userId);
    res.json({ success: true, message: `Subscribed to ${eventType}.`, ...result });
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
    const result = await unsubscribeRobot(robotId, eventType, req.user!.userId);
    res.json({ success: true, message: `Unsubscribed from ${eventType}.`, ...result });
  },
);

// PUT /api/subscriptions/robot/:robotId — replace a robot's whole subscription set
router.put(
  '/robot/:robotId',
  authenticateToken,
  validateRequest({ params: robotIdParamSchema, body: setSubscriptionsBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const robotId = Number(req.params.robotId);
    const { eventTypes } = req.body;
    const result = await setSubscriptionsForRobot(robotId, eventTypes, req.user!.userId);
    res.json({ success: true, ...result });
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

export default router;
