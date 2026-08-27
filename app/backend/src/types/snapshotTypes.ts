/**
 * Shared type definitions for CycleSnapshot JSON payloads.
 *
 * These interfaces describe the JSON structures stored in the Prisma `Json`
 * fields of the `CycleSnapshot` model (`stableMetrics`, `robotMetrics`,
 * `stepDurations`). They are hand-written to match the runtime shapes
 * produced by `CycleSnapshotService.aggregateStableMetrics()`,
 * `aggregateRobotMetrics()`, and `getStepDurations()`.
 *
 * Requirements: 1.1, 2.1, 5.1
 */

/** Per-user financial summary stored in `CycleSnapshot.stableMetrics`. */
export interface StableMetric {
  userId: number;
  battlesParticipated: number;
  totalCreditsEarned: number;
  totalPrestigeEarned: number;
  /**
   * Credits charged for repairs for this stable during THIS ONE CYCLE.
   *
   * Renamed from `totalRepairCosts` by Spec #48 Requirement 17 criterion 3: the old
   * name sat on a per-cycle metric but read as a lifetime figure. There is no
   * database migration because this lives inside a `Json` column, so rows written
   * before the rename keep the old key — read it through `readCycleRepairSpend` in
   * `services/economy/repairPayloadKeys.ts`, never directly.
   */
  cycleRepairCreditsPaid: number;
  merchandisingIncome: number;
  streamingIncome: number;
  operatingCosts: number;
  weaponPurchases: number;
  facilityPurchases: number;
  robotPurchases: number;
  attributeUpgrades: number;
  totalPurchases: number;
  achievementRewards: number;
  netProfit: number;
  balance: number;
}

/** Per-robot combat summary stored in `CycleSnapshot.robotMetrics`. */
export interface RobotMetric {
  robotId: number;
  battlesParticipated: number;
  wins: number;
  losses: number;
  draws: number;
  damageDealt: number;
  damageReceived: number;
  creditsEarned: number;
  repairCosts: number;
  kills: number;
  destructions: number;
  eloChange: number;
  fameChange: number;
}

/** Individual cycle step timing stored in `CycleSnapshot.stepDurations`. */
export interface StepDuration {
  stepName: string;
  duration: number;
}

/**
 * Shape of `AuditLog.payload` when accessed during cycle snapshot aggregation.
 *
 * Different event types populate different subsets of these fields.
 * The index signature allows forward-compatible access to new fields.
 */
export interface CycleEventPayload {
  triggerType?: string;
  cycleNumber?: number;
  credits?: number;
  prestige?: number;
  fame?: number;
  streamingRevenue?: number;
  // An optional repair-cost member was removed here by Spec #48 Requirement 9 criterion 3. It was
  // declared but never written by any orchestrator, and its only effect was to let
  // two dead reads type-check: one in `cycleSnapshotService.aggregateStableMetrics`
  // (a latent double-count) and one in `cycleCsvExportService` (a CSV column that
  // always exported 0). Removing the declaration is what stops either coming back.
  //
  // Repair spend is read from Repair_Spend_Source — `audit_logs` rows with
  // `eventType: 'robot_repair'` — and from nowhere else.
  cost?: number;
  merchandising?: number;
  /**
   * Roster_Capacity and Prestige_Per_Slot recorded on PASSIVE_INCOME events so
   * merchandising income can be reconciled after the fact without re-deriving
   * capacity from historical facility state (Spec #46 R2.9).
   */
  rosterCapacity?: number;
  prestigePerSlot?: number;
  streaming?: number;
  totalCost?: number;
  balance?: number;
  result?: 'win' | 'loss' | 'draw';
  damageDealt?: number;
  eloChange?: number;
  destroyed?: boolean;
  stepName?: string;
  duration?: number;
  opponentId?: number;
  isByeMatch?: boolean;
  totalDuration?: number;
  achievementId?: string;
  rewardCredits?: number;
  rewardPrestige?: number;
  [key: string]: unknown;
}
