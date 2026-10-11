/**
 * Facility upgrade (purchase of the next facility level).
 *
 * Spec #55 Domain_Service_Extraction (task 2.1, design §10): moved unchanged
 * from the `POST /api/facility/upgrade` route handler so the route and
 * Automaton_Turns share one implementation. The route keeps request
 * validation and the achievement check; everything else lives here.
 */
import prisma from '../../lib/prisma';
import { lockUserForSpending } from '../../lib/creditGuard';
import logger from '../../config/logger';
import { getFacilityConfig, getFacilityUpgradeCost } from '../../config/facilities';
import { AuthError, AuthErrorCode } from '../../errors/authErrors';
import { EconomyError, EconomyErrorCode } from '../../errors/economyErrors';
import type { Facility } from '../../../generated/prisma';
import { eventLogger } from '../common/eventLogger';
import { trackSpending } from './spendingTracker';
import { securityMonitor } from '../security/securityMonitor';
import { applyCreditMutationInTransaction } from '../financial/creditMutationService';
import { runFinancialWriteTransaction } from '../cycle/financialWriteTransaction';
import {
  createEconomicRequestIdentity,
  findCompletedEconomicRequest,
  findEconomicRequestReplay,
  buildEconomicAuditMetadata,
} from '../financial/economicRequestReplayService';
import { buildPurchaseBreakdown } from '../financial/financialBreakdowns';
import type { PurchaseServiceOptions } from './purchaseOptions';

const UPGRADE_MESSAGE = 'Facility upgraded successfully';

/** Stored replay response (`coreResponse` of the original request). */
export interface FacilityUpgradeReplayResponse {
  facility: unknown;
  currency: number;
  message: string;
}

export type FacilityUpgradeResult =
  | { replayed: true; response: FacilityUpgradeReplayResponse }
  | {
    replayed: false;
    facility: Facility;
    currency: number;
    message: string;
    facilityType: string;
    previousLevel: number;
    newLevel: number;
    cost: number;
  };

/** Price, prestige gate and maximum level for buying the level after `currentLevel`. */
export interface FacilityUpgradeRequirement {
  /** Credits for the next level; 0 when the facility is at its maximum level. */
  cost: number;
  /** Prestige required for the next level (0 when ungated or at maximum level). */
  prestigeRequired: number;
  maxLevel: number;
}

/**
 * The same price and Prestige_Gate the upgrade enforces, for planners and
 * previews. Throws `INVALID_FACILITY_TYPE` for an unknown facility type.
 */
export function getFacilityUpgradeRequirement(facilityType: string, currentLevel: number): FacilityUpgradeRequirement {
  const config = getFacilityConfig(facilityType);
  if (!config) {
    throw new EconomyError(EconomyErrorCode.INVALID_FACILITY_TYPE, 'Invalid facility type', 400, { facilityType });
  }
  const targetLevel = currentLevel + 1;
  const prestigeRequired = currentLevel < config.maxLevel && config.prestigeRequirements
    ? config.prestigeRequirements[targetLevel - 1] || 0
    : 0;
  return {
    cost: getFacilityUpgradeCost(facilityType, currentLevel),
    prestigeRequired,
    maxLevel: config.maxLevel,
  };
}

/**
 * Buy the next level of `facilityType` for `userId`.
 *
 * Validation order, errors, ledger/audit pair, replay behaviour and post-commit
 * logging are those of the original route handler.
 */
export async function upgradeFacility(
  userId: number,
  facilityType: string,
  requestKey: string,
  options: PurchaseServiceOptions = {},
): Promise<FacilityUpgradeResult> {
  const identity = createEconomicRequestIdentity(userId, 'facility_upgrade', requestKey, { facilityType });
  const replay = await findCompletedEconomicRequest<FacilityUpgradeReplayResponse>(userId, 'facility_upgrade', requestKey, { facilityType });
  if (replay) {
    return { replayed: true, response: replay.response };
  }

  if (!facilityType) {
    throw new EconomyError(EconomyErrorCode.INVALID_FACILITY_TYPE, 'Facility type is required', 400);
  }

  const config = getFacilityConfig(facilityType);
  if (!config) {
    throw new EconomyError(EconomyErrorCode.INVALID_FACILITY_TYPE, 'Invalid facility type', 400, { facilityType });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found', 404, { userId });
  }

  const facility = await prisma.facility.findUnique({
    where: {
      userId_facilityType: {
        userId,
        facilityType,
      },
    },
  });

  const currentLevel = facility?.level || 0;
  const targetLevel = currentLevel + 1;

  if (currentLevel >= config.maxLevel) {
    throw new EconomyError(
      EconomyErrorCode.FACILITY_MAX_LEVEL,
      'Facility is already at maximum level',
      400,
      { facilityType, currentLevel, maxLevel: config.maxLevel }
    );
  }

  // Validate prestige requirement (unified curve, raw prestige).
  // A facility already owned above its current gate keeps its level — no downgrade path.
  if (config.prestigeRequirements && config.prestigeRequirements[targetLevel - 1]) {
    const requiredPrestige = config.prestigeRequirements[targetLevel - 1];

    if (user.prestige < requiredPrestige) {
      throw new AuthError(
        AuthErrorCode.FORBIDDEN,
        `${config.name} Level ${targetLevel} requires ${requiredPrestige.toLocaleString()} prestige`,
        403,
        { required: requiredPrestige, current: Math.floor(user.prestige) }
      );
    }
  }

  const upgradeCost = getFacilityUpgradeCost(facilityType, currentLevel);

  if (upgradeCost === 0) {
    throw new EconomyError(
      EconomyErrorCode.FACILITY_MAX_LEVEL,
      'Facility is already at maximum level',
      400,
      { facilityType, currentLevel }
    );
  }

  if (user.currency < upgradeCost) {
    throw new EconomyError(
      EconomyErrorCode.INSUFFICIENT_CREDITS,
      'Insufficient credits',
      400,
      { required: upgradeCost, current: user.currency }
    );
  }

  // Perform upgrade in a transaction with row-level locking
  const result = await runFinancialWriteTransaction(async (tx, financialCycleNumber) => {
    // Acquire exclusive row lock — blocks concurrent purchases for this user
    const lockedUser = await lockUserForSpending(tx, userId);
    const replayInTransaction = await findEconomicRequestReplay<FacilityUpgradeReplayResponse>(tx, identity);
    if (replayInTransaction) {
      return { replayed: true as const, response: replayInTransaction.response };
    }

    if (lockedUser.currency < upgradeCost) {
      throw new EconomyError(
        EconomyErrorCode.INSUFFICIENT_CREDITS,
        'Insufficient credits',
        400,
        { required: upgradeCost, current: lockedUser.currency }
      );
    }

    // Re-read facility inside transaction to prevent concurrent level bumps
    const freshFacility = await tx.facility.findUnique({
      where: {
        userId_facilityType: {
          userId,
          facilityType,
        },
      },
    });

    const freshLevel = freshFacility?.level || 0;

    if (freshLevel !== currentLevel) {
      throw new EconomyError(
        EconomyErrorCode.FACILITY_MAX_LEVEL,
        'Facility level changed, please retry',
        409,
        { expected: currentLevel, actual: freshLevel }
      );
    }

    let updatedFacility: Facility;
    if (freshFacility) {
      updatedFacility = await tx.facility.update({
        where: { id: freshFacility.id },
        data: { level: freshLevel + 1 },
      });
    } else {
      updatedFacility = await tx.facility.create({
        data: {
          userId,
          facilityType,
          level: 1,
        },
      });
    }

    const financialEventId = identity.financialEventId;
    const coreResponse = {
      facility: updatedFacility,
      currency: lockedUser.currency - upgradeCost,
      message: UPGRADE_MESSAGE,
    };
    const financialResult = await applyCreditMutationInTransaction(tx, {
      cycleNumber: financialCycleNumber,
      userId,
      transactionType: 'facility_upgrade',
      amount: -upgradeCost,
      description: `Upgraded ${facilityType} to level ${targetLevel}`,
      financialEventId,
      breakdown: buildPurchaseBreakdown({
        transactionType: 'facility_upgrade',
        sourceEventId: financialEventId,
        amount: -upgradeCost,
        operation: currentLevel === 0 ? 'facility_purchase' : 'facility_upgrade',
        facilityType,
        previousLevel: currentLevel,
        newLevel: targetLevel,
        basePrice: upgradeCost,
        discountAmount: 0,
      }),
      auditContext: buildEconomicAuditMetadata(identity, coreResponse, options.auditContext),
    });

    return { replayed: false as const, facility: updatedFacility, currency: financialResult.balanceAfter };
  });

  if (result.replayed) {
    // The in-transaction replay answered with the stored facility and balance and the fixed message.
    return {
      replayed: true,
      response: { facility: result.response.facility, currency: result.response.currency, message: UPGRADE_MESSAGE },
    };
  }

  // Log facility transaction event (non-blocking)
  try {
    const cycleMetadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
    });
    const currentCycle = (cycleMetadata?.totalCycles || 0) + 1;

    await eventLogger.logFacilityTransaction(
      currentCycle,
      userId,
      facilityType,
      currentLevel,
      targetLevel,
      upgradeCost,
      currentLevel === 0 ? 'purchase' : 'upgrade',
      user.currency,
      result.currency
    );

    const action = currentLevel === 0 ? 'Purchased' : 'Upgraded';
    logger.info(`[Facility] User ${userId} | ${action}: ${config.name} | Level: ${targetLevel} | Cost: ₡${upgradeCost.toLocaleString()} | Balance: ₡${user.currency.toLocaleString()} → ₡${result.currency.toLocaleString()}`);

    // Track spending for onboarding budget comparison
    await trackSpending(userId, 'facilities', upgradeCost);

    if (options.spendingMonitor) {
      securityMonitor.trackSpending(userId, upgradeCost, options.spendingMonitor);
    }
  } catch (logError) {
    logger.error('Failed to log facility transaction event:', logError);
    // Don't fail the request if logging fails
  }

  return {
    replayed: false,
    facility: result.facility,
    currency: result.currency,
    message: UPGRADE_MESSAGE,
    facilityType,
    previousLevel: currentLevel,
    newLevel: targetLevel,
    cost: upgradeCost,
  };
}
