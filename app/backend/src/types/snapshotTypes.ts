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
  totalRepairCosts: number;
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
  repairCost?: number;
  cost?: number;
  merchandising?: number;
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
