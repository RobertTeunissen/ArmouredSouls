import express, { Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import {
  calculateTotalDailyOperatingCosts,
  calculateDailyPassiveIncome,
  getPrestigeMultiplier,
  generatePerRobotFinancialReport,
  getRosterCapacity,
} from '../utils/economyCalculations';
import { getFacilityUpgradeCost } from '../config/facilities';
import { unifiedFacilityROIService } from '../services/economy/unifiedFacilityROIService';
import { AuthError, AuthErrorCode } from '../errors/authErrors';
import { EconomyError, EconomyErrorCode } from '../errors/economyErrors';
import { validateRequest } from '../middleware/schemaValidator';
import { getDailyFinancialReport } from '../services/economy/financialReportService';

const router = express.Router();

// --- Zod schemas for finances routes ---

const roiCalculatorBodySchema = z.object({
  facilityType: z.string().min(1).max(50),
  targetLevel: z.coerce.number().int().positive(),
});

/**
 * GET /api/finances/daily
 * Get comprehensive daily financial report
 */
router.get('/daily', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
    const report = await getDailyFinancialReport(req.user!.userId);
    res.json(report);
});

/**
 * GET /api/finances/summary
 * Get quick financial summary for dashboard
 */
router.get('/summary', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found', 404, { userId });
    }

    const operatingCosts = await calculateTotalDailyOperatingCosts(userId);
    const passiveIncome = await calculateDailyPassiveIncome(userId);

    const netIncome = passiveIncome.total - operatingCosts.total;

    res.json({
      currentBalance: user.currency,
      prestige: user.prestige,
      dailyOperatingCosts: operatingCosts.total,
      dailyPassiveIncome: passiveIncome.total,
      netPassiveIncome: netIncome,
      prestigeMultiplier: getPrestigeMultiplier(user.prestige),
    });
});

/**
 * GET /api/finances/operating-costs
 * Get detailed operating costs breakdown
 */
router.get('/operating-costs', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    const operatingCosts = await calculateTotalDailyOperatingCosts(userId);

    res.json(operatingCosts);
});

/**
 * GET /api/finances/revenue-streams
 * Get detailed revenue streams breakdown
 */
router.get('/revenue-streams', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found', 404, { userId });
    }

    const passiveIncome = await calculateDailyPassiveIncome(userId);

    // Get user's robot count
    const robotCount = await prisma.robot.count({ where: { userId } });

    const prestigeMultiplier = getPrestigeMultiplier(user.prestige);

    res.json({
      passive: {
        merchandising: passiveIncome.merchandising,
        streaming: 0, // Streaming revenue is now awarded per-battle via Streaming Studio
        total: passiveIncome.total,
      },
      battleMultipliers: {
        prestigeMultiplier,
        prestigeBonus: Math.round((prestigeMultiplier - 1) * 100), // Percentage
      },
      robotCount,
      prestige: user.prestige,
    });
});

/**
 * GET /api/finances/projections
 * Get financial projections and recommendations
 */
router.get('/projections', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found', 404, { userId });
    }

    const operatingCosts = await calculateTotalDailyOperatingCosts(userId);
    const passiveIncome = await calculateDailyPassiveIncome(userId);

    const netPassiveIncome = passiveIncome.total - operatingCosts.total;
    const weeklyProjection = netPassiveIncome * 7;
    const monthlyProjection = netPassiveIncome * 30;

    // Calculate days until bankruptcy if income stops
    const daysToBankruptcy = operatingCosts.total > 0 
      ? Math.floor(user.currency / operatingCosts.total)
      : 999;

    // Recommendations
    const recommendations: string[] = [];

    if (user.currency < 100000) {
      recommendations.push('Low balance warning: Consider reducing operating costs or winning more battles');
    }

    if (netPassiveIncome < 0) {
      recommendations.push('Negative passive cash flow: Your facilities cost more than passive income generates');
    }

    if (daysToBankruptcy < 14) {
      recommendations.push('Critical: Less than 2 weeks of operating costs remaining');
    }

    // Check if Merchandising Hub could help
    const merchandisingHub = await prisma.facility.findUnique({
      where: {
        userId_facilityType: {
          userId,
          facilityType: 'merchandising_hub',
        },
      },
    });

    // Gate the recommendation on the facility's real cost, not a hardcoded
    // guess. The previous heuristic required ₡800,000 and 1,000 prestige, which
    // overstated the ₡150,000 level 1 cost by more than 5× and hid the
    // recommendation from exactly the players it helps most (Spec #46 R2.17).
    const merchandisingEntryCost = getFacilityUpgradeCost('merchandising_hub', 0);
    const rosterExpansion = await prisma.facility.findUnique({
      where: { userId_facilityType: { userId, facilityType: 'roster_expansion' } },
      select: { level: true },
    });
    const rosterCapacity = getRosterCapacity(rosterExpansion?.level ?? 0);
    const prestigePerSlot = user.prestige / rosterCapacity;

    if (!merchandisingHub || merchandisingHub.level === 0) {
      if (user.currency >= merchandisingEntryCost) {
        recommendations.push(
          `Consider purchasing Merchandising Hub (₡${merchandisingEntryCost.toLocaleString()}) to unlock daily passive income`,
        );
      }
    } else if (merchandisingHub.level < 5) {
      const nextUpgradeCost = getFacilityUpgradeCost('merchandising_hub', merchandisingHub.level);
      if (user.currency >= nextUpgradeCost) {
        recommendations.push(
          `Upgrading Merchandising Hub to level ${merchandisingHub.level + 1} (₡${nextUpgradeCost.toLocaleString()}) would raise daily merchandising income`,
        );
      }
      // Merchandising scales with prestige per robot slot, so a wide roster
      // dilutes the multiplier — surface that rather than raw prestige.
      if (rosterCapacity > 1 && prestigePerSlot < 2000) {
        recommendations.push(
          `Merchandising scales with prestige per robot slot — you have ${Math.floor(prestigePerSlot).toLocaleString()} per slot across ${rosterCapacity} slots`,
        );
      }
    }

    res.json({
      current: {
        balance: user.currency,
        dailyNet: netPassiveIncome,
      },
      projections: {
        weekly: weeklyProjection,
        monthly: monthlyProjection,
      },
      metrics: {
        daysToBankruptcy,
        // Days to break even only makes sense if user has negative balance and positive net income
        daysToBreakEven: (user.currency < 0 && netPassiveIncome > 0)
          ? Math.ceil(Math.abs(user.currency) / netPassiveIncome)
          : null,
      },
      recommendations,
    });
});

/**
 * GET /api/finances/per-robot
 * Get per-robot financial breakdown with profitability analysis
 */
router.get('/per-robot', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    const report = await generatePerRobotFinancialReport(userId);

    res.json(report);
});

/**
 * POST /api/finances/roi-calculator
 * Calculate ROI for facility upgrade
 */
router.post('/roi-calculator', authenticateToken, validateRequest({ body: roiCalculatorBodySchema }), async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { facilityType, targetLevel } = req.body;

    if (!facilityType || !targetLevel) {
      throw new EconomyError(
        EconomyErrorCode.INVALID_TRANSACTION,
        'Facility type and target level are required',
        400
      );
    }

    const roiData = await unifiedFacilityROIService.calculateProjectedROI(userId, facilityType, targetLevel);

    res.json(roiData);
});

/**
 * GET /api/finances/ledger
 * Get financial history from the unified financial ledger.
 * Serves pre-aggregated totals grouped by transactionType and cycleNumber.
 * Query params: ?fromCycle=N&toCycle=M (optional)
 */
const ledgerQuerySchema = z.object({
  fromCycle: z.coerce.number().int().positive().optional(),
  toCycle: z.coerce.number().int().positive().optional(),
});

router.get('/ledger', authenticateToken, validateRequest({ query: ledgerQuerySchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { fromCycle, toCycle } = req.query as { fromCycle?: number; toCycle?: number };

  const financialService = (await import('../services/financial/financialService')).default;
  const report = await financialService.getReport(userId, { fromCycle, toCycle });

  res.json(report);
});

export default router;
