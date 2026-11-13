/**
 * Audit event catalogue: the event types stored in the audit log, the entry
 * shape the EventLogger writes, and payload validation.
 *
 * @module services/common/auditEventTypes
 */

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
export interface BaseEventPayload {
  [key: string]: unknown;
}

/**
 * Event metadata for debugging calculations
 */
export interface EventMetadata {
  formula?: string;
  inputs?: Record<string, unknown>;
  output?: unknown;
}

/**
 * Event log entry structure
 */
export interface EventLogEntry {
  cycleNumber: number;
  eventType: EventType;
  eventTimestamp?: Date;
  sequenceNumber: number;
  userId?: number | null;
  robotId?: number | null;
  battleId?: number | null;
  sourceEventId?: string | null;
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
export function validateEventPayload(eventType: EventType, payload: BaseEventPayload): void {
  // Basic validation - ensure payload is an object
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Invalid payload for event type ${eventType}: must be an object`);
  }
  
  // Type-specific validation can be added here
  // For now, we trust the caller to provide correct payload structure
}

