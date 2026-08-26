/**
 * Cycle_Progress_Summary — the response of `GET /api/dashboard/current-cycle`.
 *
 * Spec #48 Requirement 8. One authenticated read supplying every changing figure on
 * the Dashboard's Overview_Row, so three tiles do not each fetch and re-derive the
 * same window.
 *
 * Mirrored on the frontend in `app/frontend/src/utils/dashboardApi.ts`.
 *
 * @module types/dashboardTypes
 */

/** Repair_Spend split by `repairType`. */
export interface RepairSpendByType {
  manual: number;
  automatic: number;
}

/**
 * Best_Placement and the field size of the battle that produced it.
 *
 * Absent as a whole rather than as zero: Requirement 8 criterion 10 and
 * Requirement 10 criterion 9 are satisfied structurally, because there is no field
 * here that could carry a misleading `0`.
 */
export interface BestPlacement {
  /** 1-based finishing position, >= 1. */
  position: number;
  /** Count of `battle_participants` rows for that battle. */
  fieldSize: number;
}

/** Win_Loss_Mode outcome counts, one per `(battleId, team)` pair the player holds. */
export interface WinLossDraw {
  wins: number;
  losses: number;
  draws: number;
}

/** The Current_Cycle window edges. Requirement 2 criterion 1. */
export interface CycleWindow {
  /** Most recent midnight UTC settlement boundary, inclusive. ISO-8601. */
  start: string;
  /** The request timestamp, exclusive. ISO-8601. */
  end: string;
  /** The cycle number the window belongs to. */
  cycleNumber: number;
}

/** Last_Completed_Cycle totals, rendered as Comparison_Figures. */
export interface CycleComparison {
  /**
   * The cycle actually covered, which may not be `currentCycle - 1` when the
   * Settlement_Job has not yet written the immediately preceding snapshot.
   * Requirement 2 criterion 8.
   */
  cycleNumber: number;
  prestigeEarned: number;
  battleEarnings: number;
  /**
   * Null when Repair_Spend_Source rows for that window are absent — for example
   * after a Season_Rollover purged `audit_logs`. Requirement 10 criterion 6: the
   * repair comparison is omitted INDEPENDENTLY of the other two.
   */
  repairSpend: RepairSpendByType | null;
}

export interface CycleProgressSummary {
  window: CycleWindow;

  // ── Todays_Battles_Tile ──
  /** Distinct battles the player's robots fought in the window. */
  battlesFought: number;
  /**
   * Distinct matches scheduled for the window, counted once per stable, across BOTH
   * Match_Schedule_Sources — `scheduled_matches_v2` for the six unified modes and
   * `scheduled_tournament_matches` for the three tournament modes. Requirement 4
   * criterion 9: counting only the first would omit the 10:00, 15:00 and 18:00
   * Battle_Slots while the fought count still included their battles.
   */
  matchesScheduled: number;
  winLossDraw: WinLossDraw;
  bestPlacement: BestPlacement | null;
  /**
   * Distinct Battle_Slot times, ascending, at which the player has a match scheduled
   * and not yet fought in the window. Drawn from both Match_Schedule_Sources.
   * Length 0–9, since Battle_Slot defines nine daily times.
   */
  remainingSlotsUtc: string[];
  /** Next midnight UTC settlement boundary. ISO-8601. Requirement 10 criterion 3. */
  nextSettlementAt: string;

  // ── Prestige_Tile and Credits_Tile ──
  prestigeEarned: number;
  /** Battle credit awards plus streaming revenue. Excludes passive facility income. */
  battleEarnings: number;
  repairSpend: RepairSpendByType;

  /**
   * Null when no `cycle_snapshots` row exists at all — a new stable, or competitive
   * cycle 1 — or when reading the Last_Completed_Cycle sources failed.
   * Requirement 2 criterion 9, Requirement 10 criterion 5.
   */
  comparison: CycleComparison | null;
}
