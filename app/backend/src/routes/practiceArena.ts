/**
 * @module routes/practiceArena
 *
 * Express router for the Practice Arena — a 1v1 sandbox battle simulator.
 * Validates input via Zod, enforces per-user rate limiting, guards against
 * cycle execution overlap, and delegates to the practice arena service.
 *
 * @see services/practice-arena/practiceArenaService
 * @see Requirements 8.6, 8.7, 9.1–9.6, 10.1–10.6
 */

import express, { Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveInt } from '../utils/securityValidation';
import { securityMonitor } from '../services/security/securityMonitor';
import { practiceArenaMetrics } from '../services/practice-arena';
import {
  executePracticeBattle,
  executePracticeBatch,
  getSparringPartnerDefinitions,
} from '../services/practice-arena';
import { getSchedulerState } from '../services/cycle/cycleScheduler';

const router = express.Router();

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const sparringPartnerConfigSchema = z.object({
  botTier: z.enum(['WimpBot', 'AverageBot', 'ExpertBot', 'UltimateBot']),
  loadoutType: z.enum(['single', 'weapon_shield', 'two_handed', 'dual_wield']),
  rangeBand: z.enum(['melee', 'short', 'mid', 'long']),
  stance: z.enum(['offensive', 'defensive', 'balanced']),
  yieldThreshold: z.number().int().min(0).max(50),
});

const attributeOverridesSchema = z.object({
  combatPower: z.number().int().min(1).max(50).optional(),
  targetingSystems: z.number().int().min(1).max(50).optional(),
  criticalSystems: z.number().int().min(1).max(50).optional(),
  penetration: z.number().int().min(1).max(50).optional(),
  weaponControl: z.number().int().min(1).max(50).optional(),
  attackSpeed: z.number().int().min(1).max(50).optional(),
  armorPlating: z.number().int().min(1).max(50).optional(),
  shieldCapacity: z.number().int().min(1).max(50).optional(),
  evasionThrusters: z.number().int().min(1).max(50).optional(),
  damageDampeners: z.number().int().min(1).max(50).optional(),
  counterProtocols: z.number().int().min(1).max(50).optional(),
  hullIntegrity: z.number().int().min(1).max(50).optional(),
  servoMotors: z.number().int().min(1).max(50).optional(),
  gyroStabilizers: z.number().int().min(1).max(50).optional(),
  hydraulicSystems: z.number().int().min(1).max(50).optional(),
  powerCore: z.number().int().min(1).max(50).optional(),
  combatAlgorithms: z.number().int().min(1).max(50).optional(),
  threatAnalysis: z.number().int().min(1).max(50).optional(),
  adaptiveAI: z.number().int().min(1).max(50).optional(),
  logicCores: z.number().int().min(1).max(50).optional(),
  syncProtocols: z.number().int().min(1).max(50).optional(),
  supportSystems: z.number().int().min(1).max(50).optional(),
  formationTactics: z.number().int().min(1).max(50).optional(),
});

const tuningBonusesSchema = z.record(
  z.string(),
  z.number().min(0).max(55),
).optional();

const whatIfOverridesSchema = z.object({
  attributes: attributeOverridesSchema.optional(),
  mainWeaponId: positiveInt.optional(),
  offhandWeaponId: positiveInt.optional(),
  loadoutType: z.enum(['single', 'weapon_shield', 'two_handed', 'dual_wield']).optional(),
  stance: z.enum(['offensive', 'defensive', 'balanced']).optional(),
  yieldThreshold: z.number().int().min(0).max(50).optional(),
  tuningBonuses: tuningBonusesSchema,
});

const ownedSlotSchema = z.object({
  type: z.literal('owned'),
  robotId: positiveInt,
  overrides: whatIfOverridesSchema.optional(),
});

const sparringSlotSchema = z.object({
  type: z.literal('sparring'),
  config: sparringPartnerConfigSchema,
});

const battleSlotSchema = z.discriminatedUnion('type', [ownedSlotSchema, sparringSlotSchema]);

const practiceBattleRequestSchema = z.object({
  robot1: battleSlotSchema,
  robot2: battleSlotSchema,
  count: z.number().int().min(1).max(10).default(1),
});

// ---------------------------------------------------------------------------
// Middleware: Cycle Execution Guard
// ---------------------------------------------------------------------------

/**
 * Rejects practice battle requests while a cycle job is running.
 * Applied to POST /battle before the rate limiter to avoid consuming
 * rate limit tokens during unavailability.
 */
function rejectDuringCycleExecution(req: express.Request, res: Response, next: NextFunction): void {
  const state = getSchedulerState();
  if (state.runningJob !== null) {
    res.status(503).json({
      error: 'Practice Arena is temporarily unavailable while battles are being processed',
      code: 'CYCLE_IN_PROGRESS',
      runningJob: state.runningJob,
    });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Rate Limiter: 30 battles per 15 minutes per user (counts individual battles, not requests)
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_BATTLES = 30;

/** Per-user battle count tracker */
const battleCounts = new Map<number, { count: number; windowStart: number }>();

/**
 * Custom rate limiter that counts individual battles (including batch count).
 * express-rate-limit only counts HTTP requests, so a batch of 10 = 1 request.
 * This middleware counts the actual number of battles requested.
 */
function practiceRateLimiter(req: express.Request, res: Response, next: NextFunction): void {
  const authReq = req as AuthRequest;
  const userId = authReq.user?.userId;
  if (!userId) {
    next();
    return;
  }

  const now = Date.now();
  const requestedCount = req.body?.count ?? 1;

  let entry = battleCounts.get(userId);
  if (!entry || (now - entry.windowStart) > RATE_LIMIT_WINDOW_MS) {
    // Window expired or first request — start fresh
    entry = { count: 0, windowStart: now };
    battleCounts.set(userId, entry);
  }

  const remaining = RATE_LIMIT_MAX_BATTLES - entry.count;

  if (requestedCount > remaining) {
    practiceArenaMetrics.recordRateLimitHit();
    securityMonitor.trackRateLimitViolation(userId, req.originalUrl);
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    res.status(429).json({
      error: `Rate limit exceeded. ${remaining} battles remaining in this window.`,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: retryAfterSeconds,
      remaining,
    });
    return;
  }

  // Deduct the count BEFORE executing (prevents race conditions)
  entry.count += requestedCount;
  next();
}

// Clean up expired entries periodically (every 5 minutes)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of battleCounts) {
    if ((now - entry.windowStart) > RATE_LIMIT_WINDOW_MS) {
      battleCounts.delete(userId);
    }
  }
}, 5 * 60 * 1000);
cleanupInterval.unref(); // Don't prevent process exit in tests

// ---------------------------------------------------------------------------
// POST /battle
// ---------------------------------------------------------------------------

router.post(
  '/battle',
  authenticateToken,
  rejectDuringCycleExecution,
  validateRequest({ body: practiceBattleRequestSchema }),
  practiceRateLimiter,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { robot1, robot2, count } = req.body;

    const request = { robot1, robot2 };

    if (count === 1) {
      const result = await executePracticeBattle(userId, request);
      res.json(result);
    } else {
      const result = await executePracticeBatch(userId, request, count);
      res.json(result);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /sparring-partners
// ---------------------------------------------------------------------------

router.get(
  '/sparring-partners',
  authenticateToken,
  validateRequest({}),
  async (_req: AuthRequest, res: Response) => {
    const definitions = getSparringPartnerDefinitions();
    res.json({ sparringPartners: definitions });
  },
);

export default router;
