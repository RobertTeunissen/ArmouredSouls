/**
 * EventLogger Service
 * 
 * Implements event sourcing for the cycle-based audit logging system.
 * Captures all game events with sequence numbers, validation, and batch insertion.
 * 
 * Requirements: 1.1-1.8, 2.1-2.10, 9.3
 */

import { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import type { RefinementTier } from '../../shared/utils/weaponRefinement';
import { REPAIR_CHARGED_KEY, REPAIR_PRE_DISCOUNT_KEY } from '../economy/repairPayloadKeys';
import { withAuditSequence } from './auditSequence';

/**
 * Event type enumeration - all event types stored in the audit log
 */
export enum EventType {
  // Battle events
  BATTLE_COMPLETE = 'battle_complete',
  
  // Robot events
  ROBOT_PURCHASE = 'robot_purchase',
  ROBOT_REPAIR = 'robot_repair',
  ROBOT_ATTRIBUTE_UPGRADE = 'attribute_upgrade',
  ROBOT_LEAGUE_CHANGE = 'league_change',
  
  // Stable/User events
  USER_CREATED = 'user_created',
  CREDIT_CHANGE = 'credit_change', // For manual admin adjustments only
  FINANCIAL_TRANSACTION = 'financial_transaction',
  PRESTIGE_CHANGE = 'prestige_change',
  PASSIVE_INCOME = 'passive_income',
  OPERATING_COSTS = 'operating_costs',
  
  // Facility events
  FACILITY_PURCHASE = 'facility_purchase',
  FACILITY_UPGRADE = 'facility_upgrade',
  
  // Weapon events
  WEAPON_PURCHASE = 'weapon_purchase',
  WEAPON_SALE = 'weapon_sale',
  WEAPON_REFINEMENT = 'weapon_refinement',
  
  // Tournament events
  /**
   * @deprecated Use BATTLE_COMPLETE for all battle types. Kept for backward
   * compatibility with old audit log records in the database. New code should
   * never emit this event type.
   */
  TOURNAMENT_MATCH = 'tournament_match',
  TOURNAMENT_COMPLETE = 'tournament_complete',
  
  // Tag team events
  /**
   * @deprecated Use BATTLE_COMPLETE for all battle types. Kept for backward
   * compatibility with old audit log records in the database. New code should
   * never emit this event type.
   */
  TAG_TEAM_BATTLE = 'tag_team_battle',
  
  // Achievement events
  ACHIEVEMENT_UNLOCK = 'achievement_unlock',
  
  // Cycle execution events
  CYCLE_START = 'cycle_start',
  CYCLE_STEP_COMPLETE = 'cycle_step_complete',
  CYCLE_COMPLETE = 'cycle_complete',
  CYCLE_END_BALANCE = 'cycle_end_balance',
}

/**
 * Base interface for all event payloads
 */
interface BaseEventPayload {
  [key: string]: unknown;
}

/**
 * Event metadata for debugging calculations
 */
interface EventMetadata {
  formula?: string;
  inputs?: Record<string, unknown>;
  output?: unknown;
}

/**
 * Event log entry structure
 */
interface EventLogEntry {
  cycleNumber: number;
  eventType: EventType;
  eventTimestamp?: Date;
  sequenceNumber: number;
  userId?: number | null;
  robotId?: number | null;
  battleId?: number | null;
  payload: BaseEventPayload;
  metadata?: EventMetadata | null;
}

/*
 * Spec #51: the module-level `sequenceNumberCache`, `getNextSequenceNumber` and
 * `clearSequenceCache` were removed from here. They implemented check-then-act
 * across an `await` and caused 3,142 unique-constraint collisions in a single
 * integration run, each silently dropping an audit row.
 *
 * Allocation now goes through `withAuditSequence` in `./auditSequence`, which
 * serialises per cycle with `pg_advisory_xact_lock`. See that module for why a
 * Postgres sequence is not an acceptable alternative and for the correction to
 * the old "parallel test runners or multi-process deployments" diagnosis.
 */

/**
 * Validate event payload against schema
 */
function validateEventPayload(eventType: EventType, payload: BaseEventPayload): void {
  // Basic validation - ensure payload is an object
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Invalid payload for event type ${eventType}: must be an object`);
  }
  
  // Type-specific validation can be added here
  // For now, we trust the caller to provide correct payload structure
}

/**
 * EventLogger class - main interface for logging events
 */
export class EventLogger {
  /**
   * Log a single event
   */
  async logEvent(
    cycleNumber: number,
    eventType: EventType,
    payload: BaseEventPayload,
    options?: {
      userId?: number;
      robotId?: number;
      battleId?: number;
      metadata?: EventMetadata;
      timestamp?: Date;
    }
  ): Promise<void> {
    // Validate payload
    validateEventPayload(eventType, payload);

    // Spec #51: the five-attempt unique-violation retry loop that used to wrap
    // this insert existed only to paper over the allocation race. With
    // allocation serialised per cycle, a collision here would mean the
    // Gapless_Invariant is broken and must surface rather than be retried.
    const entry: EventLogEntry = {
      cycleNumber,
      eventType,
      eventTimestamp: options?.timestamp || new Date(),
      sequenceNumber: 0, // assigned under the lock below
      userId: options?.userId || null,
      robotId: options?.robotId || null,
      battleId: options?.battleId || null,
      payload,
      metadata: options?.metadata || null,
    };

    await withAuditSequence(cycleNumber, 1, async (startSequence, tx) => {
      await tx.auditLog.create({
        data: {
          cycleNumber: entry.cycleNumber,
          eventType: entry.eventType,
          eventTimestamp: entry.eventTimestamp,
          sequenceNumber: startSequence,
          userId: entry.userId,
          robotId: entry.robotId,
          battleId: entry.battleId,
          payload: entry.payload as Prisma.JsonObject,
          metadata: entry.metadata ? (entry.metadata as Prisma.JsonObject) : undefined,
        },
      });
    });
  }
  
  /**
   * Log multiple events in a batch (more efficient)
   */
  async logEventBatch(
    cycleNumber: number,
    events: Array<{
      eventType: EventType;
      payload: BaseEventPayload;
      userId?: number;
      robotId?: number;
      metadata?: EventMetadata;
      timestamp?: Date;
    }>
  ): Promise<void> {
    if (events.length === 0) return;
    
    // Validate all payloads first
    for (const event of events) {
      validateEventPayload(event.eventType, event.payload);
    }

    // Spec #51: one contiguous block for the whole batch, allocated once under
    // the lock. Previously each event took its own trip through the racy
    // allocator, so a batch of n events was n chances to collide.
    await withAuditSequence(cycleNumber, events.length, async (startSequence, tx) => {
      const entries: EventLogEntry[] = events.map((event, index) => ({
        cycleNumber,
        eventType: event.eventType,
        eventTimestamp: event.timestamp || new Date(),
        sequenceNumber: startSequence + index,
        userId: event.userId || null,
        robotId: event.robotId || null,
        payload: event.payload,
        metadata: event.metadata || null,
      }));

      await tx.auditLog.createMany({
        data: entries.map((entry) => ({
          cycleNumber: entry.cycleNumber,
          eventType: entry.eventType,
          eventTimestamp: entry.eventTimestamp,
          sequenceNumber: entry.sequenceNumber,
          userId: entry.userId,
          robotId: entry.robotId,
          payload: entry.payload as Prisma.JsonObject,
          metadata: entry.metadata ? (entry.metadata as Prisma.JsonObject) : undefined,
        })),
      });
    });
  }
  
  /**
   * Log cycle start event
   */
  async logCycleStart(
    cycleNumber: number,
    triggerType: 'manual' | 'scheduled'
  ): Promise<void> {
    await this.logEvent(cycleNumber, EventType.CYCLE_START, {
      triggerType,
      timestamp: new Date().toISOString(),
    });
  }
  
  /**
   * Log cycle step completion
   */
  async logCycleStepComplete(
    cycleNumber: number,
    stepName: string,
    stepNumber: number,
    durationMs: number,
    summary?: Record<string, unknown>
  ): Promise<void> {
    await this.logEvent(cycleNumber, EventType.CYCLE_STEP_COMPLETE, {
      stepName,
      stepNumber,
      duration: durationMs,
      summary: summary || {},
    });
  }
  
  /**
   * Log cycle completion
   */
  async logCycleComplete(
    cycleNumber: number,
    totalDurationMs: number
  ): Promise<void> {
    await this.logEvent(cycleNumber, EventType.CYCLE_COMPLETE, {
      totalDuration: totalDurationMs,
      timestamp: new Date().toISOString(),
    });

    // Spec #51: no cache to clear. Allocation reads the current maximum from the
    // database under an advisory lock on every call, so there is no per-cycle
    // state to reset at cycle end.
  }
  
  /**
   * Log facility transaction (purchase or upgrade)
   */
  async logFacilityTransaction(
    cycleNumber: number,
    userId: number,
    facilityType: string,
    oldLevel: number,
    newLevel: number,
    cost: number,
    action: 'purchase' | 'upgrade',
    balanceBefore?: number,
    balanceAfter?: number
  ): Promise<void> {
    await this.logEvent(
      cycleNumber,
      action === 'purchase' ? EventType.FACILITY_PURCHASE : EventType.FACILITY_UPGRADE,
      {
        facilityType,
        oldLevel,
        newLevel,
        cost,
        action,
        ...(balanceBefore !== undefined && { balanceBefore }),
        ...(balanceAfter !== undefined && { balanceAfter }),
      },
      { userId }
    );
  }
  
  /**
   * Log passive income calculation
   */
  async logPassiveIncome(
    cycleNumber: number,
    userId: number,
    merchandising: number,
    streaming: number,
    facilityLevel: number,
    prestige: number,
    totalBattles: number,
    totalFame: number
  ): Promise<void> {
    await this.logEvent(
      cycleNumber,
      EventType.PASSIVE_INCOME,
      {
        merchandising,
        streaming,
        totalIncome: merchandising + streaming,
        facilityLevel,
        prestige,
        totalBattles,
        totalFame,
      },
      { userId }
    );
  }
  
  /**
   * Log operating costs
   */
  async logOperatingCosts(
    cycleNumber: number,
    userId: number,
    costs: Array<{ facilityType: string; level: number; cost: number }>,
    totalCost: number
  ): Promise<void> {
    await this.logEvent(
      cycleNumber,
      EventType.OPERATING_COSTS,
      {
        costs,
        totalCost,
      },
      { userId }
    );
  }

  /**
   * Write the legacy settlement domain row inside the financial transaction.
   *
   * The `financialEventId` is an additive link for new rows. The fallback to a
   * same-cycle legacy row prevents a rerun after cutover from double-counting
   * snapshot inputs that were already written by the pre-pair implementation.
   */
  async logSettlementComponentInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      cycleNumber: number;
      userId: number;
      componentType: 'passive_income' | 'operating_costs';
      financialEventId: string;
      payload: BaseEventPayload;
      timestamp?: Date;
    },
  ): Promise<void> {
    const eventType = input.componentType === 'passive_income'
      ? EventType.PASSIVE_INCOME
      : EventType.OPERATING_COSTS;
    const existing = await tx.auditLog.findFirst({
      where: {
        cycleNumber: input.cycleNumber,
        userId: input.userId,
        eventType,
        OR: [
          { financialEventId: input.financialEventId },
          { financialEventId: null },
        ],
      },
      select: { id: true },
    });
    if (existing) return;

    validateEventPayload(eventType, input.payload);
    await withAuditSequence(input.cycleNumber, 1, async (startSequence, sequenceTx) => {
      await sequenceTx.auditLog.create({
        data: {
          cycleNumber: input.cycleNumber,
          eventType,
          eventTimestamp: input.timestamp ?? new Date(),
          sequenceNumber: startSequence,
          userId: input.userId,
          payload: input.payload as Prisma.JsonObject,
          financialEventId: input.financialEventId,
        },
      });
    }, tx);
  }
  
  /**
   * Log credit change
   */
  async logCreditChange(
    cycleNumber: number,
    userId: number,
    amount: number,
    newBalance: number,
    source: 'battle' | 'passive_income' | 'facility_purchase' | 'repair' | 'weapon_purchase' | 'other',
    referenceEventId?: number
  ): Promise<void> {
    await this.logEvent(
      cycleNumber,
      EventType.CREDIT_CHANGE,
      {
        amount,
        newBalance,
        source,
        referenceEventId,
      },
      { userId }
    );
  }
  
  /**
   * Log prestige change
   */
  async logPrestigeChange(
    cycleNumber: number,
    userId: number,
    amount: number,
    newTotal: number,
    source: string
  ): Promise<void> {
    await this.logEvent(
      cycleNumber,
      EventType.PRESTIGE_CHANGE,
      {
        amount,
        newTotal,
        source,
      },
      { userId }
    );
  }
  
  /**
   * Log weapon purchase
   */
  async logWeaponPurchase(
    cycleNumber: number,
    userId: number,
    weaponId: number,
    cost: number
  ): Promise<void> {
    await this.logEvent(
      cycleNumber,
      EventType.WEAPON_PURCHASE,
      {
        weaponId,
        cost,
      },
      { userId }
    );
  }
  
  /**
   * Log weapon sale
   */
  async logWeaponSale(
    cycleNumber: number,
    userId: number,
    weaponId: number,
    salePrice: number
  ): Promise<void> {
    await this.logEvent(
      cycleNumber,
      EventType.WEAPON_SALE,
      {
        weaponId,
        salePrice,
      },
      { userId }
    );
  }

  /**
   * Log weapon refinement (Spec #34).
   * Mirrors `logWeaponPurchase` / `logWeaponSale`. Audit-only — no schema
   * change to `audit_log`; this just adds a new `event_type` value.
   */
  async logWeaponRefinement(
    cycleNumber: number,
    userId: number,
    payload: {
      weaponInventoryId: number;
      weaponId: number;
      tier: RefinementTier;
      magnitude: number;
      targetAttribute: string | null;
      costPaid: number;
      workshopLevel: number;
    },
  ): Promise<void> {
    await this.logEvent(
      cycleNumber,
      EventType.WEAPON_REFINEMENT,
      payload,
      { userId }
    );
  }
  
  /**
   * Log attribute upgrade
   */
  async logAttributeUpgrade(
    cycleNumber: number,
    robotId: number,
    attributeName: string,
    oldValue: number,
    newValue: number,
    cost: number,
    userId?: number
  ): Promise<void> {
    await this.logEvent(
      cycleNumber,
      EventType.ROBOT_ATTRIBUTE_UPGRADE,
      {
        attributeName,
        oldValue,
        newValue,
        cost,
      },
      { robotId, userId }
    );
  }
  
  /**
   * Log a robot repair — the write side of Repair_Spend_Source.
   *
   * Spec #48 Requirement 17 criteria 4 and 11: the payload carries the RENAMED keys
   * only (`creditsCharged`, `creditsBeforeManualDiscount`), never the old `cost` /
   * `preDiscountCost` alongside them, so a partially migrated row cannot double a
   * repair total. Readers go through `services/economy/repairPayloadKeys.ts`, which
   * falls back to the old names for rows written before this change.
   *
   * `repairType`, `manualRepairDiscount` and `discountPercent` are deliberately NOT
   * renamed: the `payload.repairType` JSON path filter behind
   * `GET /api/admin/audit-log/repairs` must keep matching pre- and post-rename rows.
   *
   * Parameter names changed to say what the two figures mean; parameter ORDER did
   * not, so existing call sites need no positional rework.
   *
   * @param creditsCharged - Credits actually deducted for this robot
   * @param creditsBeforeManualDiscount - The Repair_Quote, i.e. the same repair
   *        priced after the Repair Bay discount and before the manual discount.
   *        Omitted on the automatic path, which applies no manual discount.
   */
  async logRobotRepair(
    userId: number,
    robotId: number,
    creditsCharged: number,
    damageRepaired: number,
    discountPercent: number,
    cycleNumber?: number,
    repairType?: 'manual' | 'automatic',
    manualRepairDiscount?: number,
    creditsBeforeManualDiscount?: number
  ): Promise<void> {
    // Use provided cycle number, or get current cycle number from metadata
    let actualCycleNumber = cycleNumber;
    if (actualCycleNumber === undefined) {
      const cycleMetadata = await prisma.cycleMetadata.findUnique({
        where: { id: 1 },
      });
      actualCycleNumber = cycleMetadata?.totalCycles || 0;
    }
    
    const payload: BaseEventPayload = {
      [REPAIR_CHARGED_KEY]: creditsCharged,
      damageRepaired,
      discountPercent,
    };

    if (repairType !== undefined) {
      payload.repairType = repairType;
    }
    if (manualRepairDiscount !== undefined) {
      payload.manualRepairDiscount = manualRepairDiscount;
    }
    if (creditsBeforeManualDiscount !== undefined) {
      payload[REPAIR_PRE_DISCOUNT_KEY] = creditsBeforeManualDiscount;
    }

    await this.logEvent(
      actualCycleNumber,
      EventType.ROBOT_REPAIR,
      payload,
      { userId, robotId }
    );
  }
  
  /**
   * Log a robot repair inside the caller's transaction.
   *
   * Required repair capture must share the transaction with the balance mutation
   * and robot state update. The source identity makes the domain row retry-safe
   * while keeping it separate from the financial_transaction audit row.
   */
  async logRobotRepairInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      cycleNumber: number;
      userId: number;
      robotId: number;
      creditsCharged: number;
      damageRepaired: number;
      discountPercent: number;
      repairType: 'manual' | 'automatic';
      manualRepairDiscount?: number;
      creditsBeforeManualDiscount?: number;
      sourceEventId: string;
      timestamp?: Date;
    },
  ): Promise<void> {
    const existing = await tx.auditLog.findFirst({
      where: {
        eventType: EventType.ROBOT_REPAIR,
        sourceEventId: input.sourceEventId,
      },
      select: { id: true },
    });
    if (existing) return;

    const payload: BaseEventPayload = {
      [REPAIR_CHARGED_KEY]: input.creditsCharged,
      damageRepaired: input.damageRepaired,
      discountPercent: input.discountPercent,
      repairType: input.repairType,
      sourceEventId: input.sourceEventId,
    };
    if (input.manualRepairDiscount !== undefined) {
      payload.manualRepairDiscount = input.manualRepairDiscount;
    }
    if (input.creditsBeforeManualDiscount !== undefined) {
      payload[REPAIR_PRE_DISCOUNT_KEY] = input.creditsBeforeManualDiscount;
    }

    validateEventPayload(EventType.ROBOT_REPAIR, payload);
    await withAuditSequence(input.cycleNumber, 1, async (startSequence, sequenceTx) => {
      await sequenceTx.auditLog.create({
        data: {
          cycleNumber: input.cycleNumber,
          eventType: EventType.ROBOT_REPAIR,
          eventTimestamp: input.timestamp ?? new Date(),
          sequenceNumber: startSequence,
          userId: input.userId,
          robotId: input.robotId,
          payload: payload as Prisma.JsonObject,
          sourceEventId: input.sourceEventId,
        },
      });
    }, tx);
  }

  /**
   * Log calculation metadata for debugging
   */
  async logCalculation(
    cycleNumber: number,
    calculationType: string,
    formula: string,
    inputs: Record<string, unknown>,
    output: unknown,
    userId?: number,
    robotId?: number
  ): Promise<void> {
    await this.logEvent(
      cycleNumber,
      EventType.CREDIT_CHANGE, // Use appropriate event type
      {
        calculationType,
      },
      {
        userId,
        robotId,
        metadata: {
          formula,
          inputs,
          output,
        },
      }
    );
  }
  
  /**
   * Log user creation
   */
  async logUserCreated(
    cycleNumber: number,
    userId: number,
    username: string,
    startingBalance: number
  ): Promise<void> {
    await this.logEvent(
      cycleNumber,
      EventType.USER_CREATED,
      {
        username,
        startingBalance,
      },
      { userId }
    );
  }
  
  /**
   * Log robot purchase
   */
  async logRobotPurchase(
    cycleNumber: number,
    userId: number,
    robotId: number,
    robotName: string,
    cost: number,
    balanceBefore: number,
    balanceAfter: number
  ): Promise<void> {
    await this.logEvent(
      cycleNumber,
      EventType.ROBOT_PURCHASE,
      {
        robotName,
        cost,
        balanceBefore,
        balanceAfter,
      },
      { userId, robotId }
    );
  }
  
  /**
   * Log end-of-cycle balance
   */
  async logCycleEndBalance(
    cycleNumber: number,
    userId: number,
    username: string,
    stableName: string | null,
    balance: number
  ): Promise<void> {
    await this.logEvent(
      cycleNumber,
      EventType.CYCLE_END_BALANCE,
      {
        username,
        stableName,
        balance,
      },
      { userId }
    );
  }

  /**
   * Log an achievement unlock event with credit and prestige rewards.
   * Called by AchievementService after awarding an achievement.
   */
  async logAchievementUnlock(
    cycleNumber: number,
    userId: number,
    achievementId: string,
    rewardCredits: number,
    rewardPrestige: number,
    robotId?: number,
  ): Promise<void> {
    await this.logEvent(
      cycleNumber,
      EventType.ACHIEVEMENT_UNLOCK,
      {
        achievementId,
        rewardCredits,
        rewardPrestige,
      },
      { userId, robotId }
    );
  }
}

// Export singleton instance
export const eventLogger = new EventLogger();
