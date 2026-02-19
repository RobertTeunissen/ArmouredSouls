/**
 * EventLogger Service
 * 
 * Implements event sourcing for the cycle-based audit logging system.
 * Captures all game events with sequence numbers, validation, and batch insertion.
 * 
 * Requirements: 1.1-1.8, 2.1-2.10, 9.3
 */

import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

/**
 * Event type enumeration - all event types stored in the audit log
 */
export enum EventType {
  // Battle events
  BATTLE_COMPLETE = 'battle_complete',
  
  // Robot events
  ROBOT_REPAIR = 'robot_repair',
  ROBOT_ATTRIBUTE_UPGRADE = 'attribute_upgrade',
  ROBOT_LEAGUE_CHANGE = 'league_change',
  
  // Stable/User events
  CREDIT_CHANGE = 'credit_change',
  PRESTIGE_CHANGE = 'prestige_change',
  PASSIVE_INCOME = 'passive_income',
  OPERATING_COSTS = 'operating_costs',
  
  // Facility events
  FACILITY_PURCHASE = 'facility_purchase',
  FACILITY_UPGRADE = 'facility_upgrade',
  
  // Weapon events
  WEAPON_PURCHASE = 'weapon_purchase',
  WEAPON_SALE = 'weapon_sale',
  
  // Tournament events
  TOURNAMENT_MATCH = 'tournament_match',
  TOURNAMENT_COMPLETE = 'tournament_complete',
  
  // Tag team events
  TAG_TEAM_BATTLE = 'tag_team_battle',
  
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
  [key: string]: any;
}

/**
 * Event metadata for debugging calculations
 */
interface EventMetadata {
  formula?: string;
  inputs?: Record<string, any>;
  output?: any;
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

/**
 * Sequence number cache per cycle
 */
const sequenceNumberCache = new Map<number, number>();

/**
 * Locks for sequence number generation to prevent race conditions
 */
const sequenceLocks = new Map<number, Promise<void>>();

/**
 * Get the next sequence number for a cycle (thread-safe)
 */
async function getNextSequenceNumber(cycleNumber: number): Promise<number> {
  // Wait for any pending lock on this cycle
  while (sequenceLocks.has(cycleNumber)) {
    await sequenceLocks.get(cycleNumber);
  }
  
  // Create a lock for this operation
  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  sequenceLocks.set(cycleNumber, lockPromise);
  
  try {
    // Check cache first
    if (sequenceNumberCache.has(cycleNumber)) {
      const current = sequenceNumberCache.get(cycleNumber)!;
      const next = current + 1;
      sequenceNumberCache.set(cycleNumber, next);
      return next;
    }
    
    // Query database for the highest sequence number in this cycle
    const lastEvent = await prisma.auditLog.findFirst({
      where: { cycleNumber },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });
    
    const nextSequence = lastEvent ? lastEvent.sequenceNumber + 1 : 1;
    sequenceNumberCache.set(cycleNumber, nextSequence);
    return nextSequence;
  } finally {
    // Release the lock
    sequenceLocks.delete(cycleNumber);
    releaseLock!();
  }
}

/**
 * Clear sequence number cache for a cycle (call at cycle end)
 */
export function clearSequenceCache(cycleNumber: number): void {
  sequenceNumberCache.delete(cycleNumber);
}

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
    
    // Get next sequence number
    const sequenceNumber = await getNextSequenceNumber(cycleNumber);
    
    // Create event entry
    const entry: EventLogEntry = {
      cycleNumber,
      eventType,
      eventTimestamp: options?.timestamp || new Date(),
      sequenceNumber,
      userId: options?.userId || null,
      robotId: options?.robotId || null,
      battleId: options?.battleId || null,
      payload,
      metadata: options?.metadata || null,
    };
    
    // Insert into database
    await prisma.auditLog.create({
      data: {
        cycleNumber: entry.cycleNumber,
        eventType: entry.eventType,
        eventTimestamp: entry.eventTimestamp,
        sequenceNumber: entry.sequenceNumber,
        userId: entry.userId,
        robotId: entry.robotId,
        battleId: entry.battleId,
        payload: entry.payload as Prisma.JsonObject,
        metadata: entry.metadata ? (entry.metadata as Prisma.JsonObject) : undefined,
      },
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
    
    // Get sequence numbers for all events
    const entries: EventLogEntry[] = [];
    for (const event of events) {
      const sequenceNumber = await getNextSequenceNumber(cycleNumber);
      entries.push({
        cycleNumber,
        eventType: event.eventType,
        eventTimestamp: event.timestamp || new Date(),
        sequenceNumber,
        userId: event.userId || null,
        robotId: event.robotId || null,
        payload: event.payload,
        metadata: event.metadata || null,
      });
    }
    
    // Batch insert
    await prisma.auditLog.createMany({
      data: entries.map(entry => ({
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
    summary?: Record<string, any>
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
    
    // Clear sequence cache for this cycle
    clearSequenceCache(cycleNumber);
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
   * Log robot repair
   */
  async logRobotRepair(
    userId: number,
    robotId: number,
    cost: number,
    damageRepaired: number,
    discountPercent: number,
    cycleNumber?: number
  ): Promise<void> {
    // Use provided cycle number, or get current cycle number from metadata
    let actualCycleNumber = cycleNumber;
    if (actualCycleNumber === undefined) {
      const cycleMetadata = await prisma.cycleMetadata.findUnique({
        where: { id: 1 },
      });
      actualCycleNumber = cycleMetadata?.totalCycles || 0;
    }
    
    await this.logEvent(
      actualCycleNumber,
      EventType.ROBOT_REPAIR,
      {
        cost,
        damageRepaired,
        discountPercent,
      },
      { userId, robotId }
    );
  }
  
  /**
   * Log calculation metadata for debugging
   */
  async logCalculation(
    cycleNumber: number,
    calculationType: string,
    formula: string,
    inputs: Record<string, any>,
    output: any,
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
}

// Export singleton instance
export const eventLogger = new EventLogger();
