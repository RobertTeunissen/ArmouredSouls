import express, { Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getStorageStatus } from '../utils/storageCalculations';
import prisma from '../lib/prisma';
import { EconomyError, EconomyErrorCode } from '../errors';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam, safeName } from '../utils/securityValidation';
import { verifyWeaponOwnership } from '../middleware/ownership';
import { securityMonitor } from '../services/security/securityMonitor';
import { achievementService, type UnlockedAchievement } from '../services/achievement';
import { ROBOT_ATTRIBUTES } from '../shared/utils/robotAttributes';
import { getIdempotencyKey, idempotencyHeadersSchema } from '../utils/idempotency';
import { purchaseWeapon } from '../services/economy/weaponPurchaseService';
import { sellWeapon } from '../services/economy/weaponSaleService';
import { refineWeapon } from '../services/economy/weaponRefinementService';

const router = express.Router();

// --- Zod schemas for weapon inventory routes ---

// The message is user-facing: `validateRequest` builds the response's `error` from
// the failing issues. `z.coerce.number()` turns a missing key into NaN, whose default
// message ('Invalid input: expected number, received NaN') names neither the field
// nor the problem.
const purchaseBodySchema = z.object({
  weaponId: z.coerce
    .number({ message: 'Weapon ID is required and must be a number' })
    .int('Weapon ID must be a whole number')
    .positive('Weapon ID must be a positive number'),
});

const inventoryIdParamsSchema = z.object({
  id: positiveIntParam,
});

/**
 * Body schema for the custom-name endpoint (Spec #34, R10).
 *
 * Accepts either `null` or a non-empty `safeName` (existing 50-char primitive
 * with the project's standard character allowlist). Empty strings sent by the
 * client are rejected by `safeName.min(1)`; clients clear the customName by
 * sending an explicit `null`. The transform normalises any null/empty input
 * to `null` so the route handler does not have to special-case it.
 */
const customNameBodySchema = z.object({
  customName: z
    .union([z.null(), safeName])
    .transform((v) => (v === null || v === '' ? null : v)),
});

/**
 * Per-user rate limiter for weapon resale (Spec #33 R3.10).
 *
 * Resale is a destructive endpoint that deletes a row and emits credits.
 * The general 300 req/min limiter is too lax for this — a determined caller
 * could flood audit_log. 30 sales per 5 minutes is generous for genuine
 * experimentation while capping abuse.
 *
 * Defined at module scope so a single instance is shared across requests
 * (otherwise each request would get its own counter).
 */
const resaleRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return `weapon-resale:${authReq.user?.userId?.toString() || req.ip || 'unknown'}`;
  },
  handler: (req, res) => {
    const authReq = req as AuthRequest;
    if (authReq.user?.userId) {
      securityMonitor.trackRateLimitViolation(authReq.user.userId, req.originalUrl);
    }
    res.status(429).json({
      error: 'Too many resale attempts. Try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 300,
    });
  },
});

/**
 * Per-user rate limiter for weapon refinement (Spec #34 R3.10).
 *
 * Refinement is a deliberate, costly action — 10 attempts per 5 minutes is
 * well above any reasonable manual cadence and well below an abuse threshold.
 * Tracked via `securityMonitor` so violations surface in the admin Security
 * dashboard.
 */
const refineRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return `weapon-refine:${authReq.user?.userId?.toString() || req.ip || 'unknown'}`;
  },
  handler: (req, res) => {
    const authReq = req as AuthRequest;
    if (authReq.user?.userId) {
      securityMonitor.trackRateLimitViolation(authReq.user.userId, req.originalUrl);
    }
    res.status(429).json({
      error: 'Too many refinement attempts. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 300,
    });
  },
});

/**
 * Zod schema for the refinement request body (Spec #34 R3.2).
 *
 * - `tier` is one of the four refinement tiers.
 * - `magnitude` is an int in [1,5].
 * - `targetAttribute` is restricted to the 23 known robot attributes.
 *
 * Cross-field rules enforced via `.refine()`:
 *  - hone / augment require `targetAttribute`.
 *  - sharpen / forge reject `targetAttribute` and require `magnitude === 1`.
 */
const refineBodySchema = z.object({
  tier: z.enum(['hone', 'augment', 'sharpen', 'forge']),
  magnitude: z.number().int().min(1).max(5),
  targetAttribute: z.enum([...ROBOT_ATTRIBUTES] as [string, ...string[]]).optional(),
}).refine(
  (b) => {
    if (b.tier === 'sharpen' || b.tier === 'forge') {
      return b.magnitude === 1 && b.targetAttribute === undefined;
    }
    // hone / augment
    return b.targetAttribute !== undefined;
  },
  {
    message:
      'targetAttribute is required for hone/augment and forbidden for sharpen/forge; magnitude must be 1 for sharpen/forge',
  },
);

/**
 * Per-user rate limiter for weapon custom-name edits (Spec #34, R10).
 *
 * Custom name is non-economic — no credit movement, no row lock, no combat
 * impact. The limiter exists to bound abuse (e.g., a script renaming the same
 * weapon thousands of times). 30 edits per 10 minutes is generous for genuine
 * iteration on a weapon's name while capping flood traffic.
 *
 * Defined at module scope so a single counter is shared across requests.
 */
const customNameRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return `customName:${authReq.user?.userId?.toString() || req.ip || 'unknown'}`;
  },
  handler: (req, res) => {
    const authReq = req as AuthRequest;
    if (authReq.user?.userId) {
      securityMonitor.trackRateLimitViolation(authReq.user.userId, req.originalUrl);
    }
    res.status(429).json({
      error: 'Too many custom name edits. Try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 600,
    });
  },
});

// Get user's weapon inventory
router.get('/', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  const inventory = await prisma.weaponInventory.findMany({
    where: { userId },
    include: {
      weapon: true,
      robotsMain: { select: { id: true, name: true } },
      robotsOffhand: { select: { id: true, name: true } },
      // Spec #34: include refinements so the My Inventory tab can render the
      // slot bar and rank-prefixed weapon name. Ordered by slotIndex for
      // stable display.
      refinements: { orderBy: { slotIndex: 'asc' } },
    },
    orderBy: { purchasedAt: 'desc' },
  });

  res.json(inventory);
});

// Purchase a weapon into inventory
router.post('/purchase', authenticateToken, validateRequest({ body: purchaseBodySchema, headers: idempotencyHeadersSchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { weaponId } = req.body;
  const requestKey = getIdempotencyKey(req.headers);
  const weaponIdNum = Number(weaponId);

  // Spec #55 task 2.2: the purchase itself lives in weaponPurchaseService.
  const result = await purchaseWeapon(userId, weaponIdNum, requestKey, {
    spendingMonitor: { sourceIp: req.ip || undefined, endpoint: req.originalUrl },
  });

  if (result.replayed) {
    res.status(201).json({ ...result.response, achievementUnlocks: [], replayed: true });
    return;
  }

  res.status(201).json({
    weaponInventory: result.weaponInventory,
    currency: result.currency,
    message: result.message,
    achievementUnlocks: await (async (): Promise<UnlockedAchievement[]> => {
      try {
        return await achievementService.checkAndAward(userId, null, {
          type: 'weapon_purchased',
          data: { weaponId: weaponIdNum, weaponType: result.weapon.weaponType, weaponName: result.weapon.name },
        });
      } catch { return []; }
    })(),
  });
});

// Get available robots for a weapon
router.get('/:id/available', authenticateToken, validateRequest({ params: inventoryIdParamsSchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const inventoryId = parseInt(String(req.params.id));

  await verifyWeaponOwnership(prisma, inventoryId, userId);

  const weaponInv = await prisma.weaponInventory.findUnique({
    where: { id: inventoryId },
    include: { weapon: true },
  });

  if (!weaponInv) {
    throw new EconomyError(EconomyErrorCode.WEAPON_NOT_FOUND, 'Weapon not found in your inventory', 404);
  }

  const robots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true, name: true, mainWeaponId: true, offhandWeaponId: true },
  });

  res.json({
    weapon: weaponInv.weapon,
    robots,
    currentlyEquippedTo: robots.find(r => r.mainWeaponId === inventoryId || r.offhandWeaponId === inventoryId)?.id || null,
  });
});

// Get storage capacity status
router.get('/storage-status', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  const storageFacility = await prisma.facility.findUnique({
    where: {
      userId_facilityType: { userId, facilityType: 'storage_facility' },
    },
  });

  const storageFacilityLevel = storageFacility?.level || 0;
  const currentWeaponCount = await prisma.weaponInventory.count({ where: { userId } });
  const storageStatus = getStorageStatus(currentWeaponCount, storageFacilityLevel);

  res.json(storageStatus);
});

/**
 * Sell a weapon from inventory (Spec #33).
 *
 * Resale price = pricePaid × resaleRate(workshopLevel) where pricePaid is the
 * actual credits the player paid (not catalog price — anti-exploit anchor)
 * and resaleRate scales 0%/L0 → 100%/L10.
 *
 * Two-tier locking:
 *   1. lockUserForSpending — serializes against any concurrent currency mutation
 *      for this user (purchase, resale, repair, etc.).
 *   2. SELECT ... FOR UPDATE on weapon_inventory — serializes against concurrent
 *      resale of the same weapon AND concurrent equip of the same weapon (the
 *      equip handler in robotWeaponService.ts acquires the same lock).
 *
 * The FK Robot.main_weapon_id uses ON DELETE SET NULL, so the lock is the sole
 * authoritative guard against silent corruption (selling an equipped weapon
 * would otherwise just null the robot's mainWeaponId with no error).
 */
router.delete(
  '/:id',
  authenticateToken,
  resaleRateLimiter, // After authenticateToken so req.user is populated for keyGenerator
  validateRequest({ params: inventoryIdParamsSchema, headers: idempotencyHeadersSchema }),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const inventoryId = parseInt(String(req.params.id));
    const requestKey = getIdempotencyKey(req.headers);

    // Spec #55 task 2.3: the sale itself lives in weaponSaleService.
    const result = await sellWeapon(userId, inventoryId, requestKey);

    if (result.replayed) {
      res.json({ ...result.response, achievementUnlocks: [], replayed: true });
      return;
    }
    const completedSale = result;

    // Achievement check (Spec #33 R7.10–R7.11)
    const achievementUnlocks = await (async (): Promise<UnlockedAchievement[]> => {
      try {
        return await achievementService.checkAndAward(userId, null, {
          type: 'weapon_sold',
          data: {
            weaponId: completedSale.weaponId,
            salePrice: completedSale.salePrice,
            pricePaid: completedSale.pricePaid,
            workshopLevel: completedSale.workshopLevel,
          },
        });
      } catch {
        return [];
      }
    })();

    res.json({
      salePrice: completedSale.salePrice,
      currency: completedSale.currency,
      weaponName: completedSale.weaponName,
      message: completedSale.message,
      achievementUnlocks,
    });
  },
);

/**
 * Refine a weapon (Spec #34, R3).
 *
 * Permanently improves a single `WeaponInventory` row by inserting a
 * `WeaponRefinement` slot, decrementing the user's currency by the cost,
 * and incrementing `weapon_inventory.price_paid` by the same amount so
 * resale at any future Workshop level recovers a fraction of the spend.
 *
 * Tier gating (Workshop level): hone L1, augment L3, sharpen L5, forge L8.
 * The Workshop's existing prestige requirements implicitly gate higher
 * tiers — no separate prestige check is needed here.
 *
 * ## Two-tier locking (matches Spec #33 lock acquisition order)
 *
 *  1. `lockUserForSpending(tx, userId)` — serialises against any concurrent
 *     currency mutation for this user (purchase, resale, repair, etc.).
 *  2. `SELECT ... FOR UPDATE` on `weapon_inventory` — serialises against
 *     concurrent refinement, resale, and equip on the same weapon row.
 *
 * Acquiring the user lock FIRST and the weapon lock SECOND matches the
 * resale handler's order; mismatched orders would create deadlock potential.
 *
 * ## Validation chain (each step throws an `EconomyError` on failure)
 *
 *  - Tier locked vs Workshop level → WEAPON_REFINEMENT_TIER_LOCKED
 *  - Slot cap (≥ 5) / per-tier cap (Sharpen, Forge ≥ 2) → SLOT_/TIER_CAP_EXCEEDED
 *  - Shield + Sharpen/Forge → SHIELD_CANNOT_TAKE_DPS_TIER
 *  - (hone/augment) target attribute on/off the weapon → ATTRIBUTE_NOT_/ALREADY_ON_WEAPON
 *  - (hone/augment) per-attribute stack cap (catalog + prior refinements + this one ≤ +10) → ATTRIBUTE_STACK_CAP_EXCEEDED
 *  - User currency < cost → INSUFFICIENT_CREDITS (HTTP 402)
 *
 * Refinement IS spending — `securityMonitor.trackSpending` is called after
 * the transaction commits (resale skips this; purchase calls it).
 */
router.post(
  '/:id/refine',
  authenticateToken,
  refineRateLimiter, // After authenticateToken so req.user is populated for keyGenerator
  validateRequest({ params: inventoryIdParamsSchema, body: refineBodySchema, headers: idempotencyHeadersSchema }),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const inventoryId = parseInt(String(req.params.id));
    const { tier, magnitude, targetAttribute } = req.body as z.infer<typeof refineBodySchema>;
    const requestKey = getIdempotencyKey(req.headers);

    // Spec #55 task 2.4: the refinement itself lives in weaponRefinementService.
    const result = await refineWeapon(userId, inventoryId, { tier, magnitude, targetAttribute }, requestKey, {
      spendingMonitor: { sourceIp: req.ip || undefined, endpoint: req.originalUrl },
    });

    if (result.replayed) {
      res.json({ ...result.response, achievementUnlocks: [], replayed: true });
      return;
    }
    const completedRefinement = result;
    const magnitudeForStorage = completedRefinement.magnitude;

    // Achievement check (wired in Task 14; the trigger map already includes
    // 'weapon_refined'). Failures must NOT block the response.
    const achievementUnlocks = await (async (): Promise<UnlockedAchievement[]> => {
      try {
        return await achievementService.checkAndAward(userId, null, {
          type: 'weapon_refined',
          data: {
            weaponInventoryId: completedRefinement.weaponInventory.id,
            weaponId: completedRefinement.weapon.id,
            tier,
            magnitude: magnitudeForStorage,
            targetAttribute: targetAttribute ?? null,
            costPaid: completedRefinement.cost,
            workshopLevel: completedRefinement.workshopLevel,
          },
        });
      } catch {
        return [];
      }
    })();

    res.json({
      weaponInventory: completedRefinement.weaponInventory,
      currency: completedRefinement.currency,
      cost: completedRefinement.cost,
      message: completedRefinement.message,
      achievementUnlocks,
    });
  },
);

/**
 * Edit the custom (player-set) name on a weapon (Spec #34, R10).
 *
 * `customName` is a non-economic, well-bounded display field on the
 * `WeaponInventory` row. No credit movement, no combat impact, no `pricePaid`
 * change — so this endpoint deliberately runs without a row lock. The
 * per-user `customNameRateLimiter` (30 req / 10 min) is the only contention
 * guard, which is sufficient for a field whose only mutator is the player
 * themselves.
 *
 * The body schema accepts `null` to clear the name or a non-empty `safeName`
 * (50-char allowlist primitive). Empty strings are normalised to `null` by
 * the schema's transform so the database stores either a real name or NULL.
 */
router.patch(
  '/:id/custom-name',
  authenticateToken,
  customNameRateLimiter, // After authenticateToken so req.user is populated for keyGenerator
  validateRequest({ params: inventoryIdParamsSchema, body: customNameBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const inventoryId = parseInt(String(req.params.id));
    const { customName } = req.body as z.infer<typeof customNameBodySchema>;

    await verifyWeaponOwnership(prisma, inventoryId, userId);

    const updated = await prisma.weaponInventory.update({
      where: { id: inventoryId },
      data: { customName },
      include: {
        weapon: true,
        refinements: { orderBy: { slotIndex: 'asc' } },
      },
    });

    res.json({ weaponInventory: updated });
  },
);

export default router;
