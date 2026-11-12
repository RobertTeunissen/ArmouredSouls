/**
 * Wire contracts for the admin Dashboard: `GET /api/admin/dashboard/kpis`,
 * `/dashboard/status` and `/dashboard/battle-activity` (backend
 * `services/admin/adminDashboard*Service.ts`, `adminBattleActivityService.ts`).
 */

export interface BattleActivity {
  rows: BattleActivityRow[];
  totals: Omit<BattleActivityRow, 'mode'>;
  lastCycleWindow: { cycleNumber: number; from: string; to: string } | null;
  timestamp: string;
}

export interface BattleActivityRow {
  mode: string;
  lastCycle: number | null;
  season: number;
  walkovers: number;
  queued: number;
  /** Percentage with one decimal over fought battles; null where draws cannot happen. */
  drawRate: number | null;
  /** Percentage with one decimal over fought battles. */
  killRate: number;
  /** Mean duration of fought battles, one decimal. */
  avgDurationSeconds: number;
}

export interface DashboardCycleHealth {
  /** Scheduler active and the last settlement is missing or older than 26 h. */
  settlementOverdue: boolean;
  failedJobs: string[];
  /** Matches still `scheduled` more than 2 h after their slot. */
  stuckMatches: number;
}

export interface DashboardSchedulerSummary {
  active: boolean;
  runningJob: string | null;
  queueLength: number;
  jobsTotal: number;
  jobsSucceeded: number;
  jobsFailed: string[];
  /** Jobs with no recorded run since the process started. */
  jobsNotYetReported: number;
  processStartedAt: string;
}

export interface DashboardStatus {
  cycle: { number: number; lastSettlementAt: string | null; nextSettlementAt: string | null };
  season: { number: number; phase: string; seasonCycle: number } | null;
  scheduler: DashboardSchedulerSummary;
  queuedMatches: number | null;
  attention: {
    bankruptcyRisk: { count: number; threshold: number } | null;
    /** Last 24 hours: every signal, and the bursts and violations among them. */
    security: { signals: number; alerts: number } | null;
    automatons: { needAttention: number; failed: number } | null;
    /** Server errors (5xx) of the last 24 hours, from the System page's request counts. */
    requests: { failures24h: number; topRoute: string | null; topCode: string | null } | null;
    cycleHealth: DashboardCycleHealth;
  };
  timestamp: string;
}

/** Human-player activity block of the dashboard KPIs (always human stables). */
export interface DashboardHumanPlayers {
  total: number;
  active7d: number;
  new7d: number;
  inactive3d: number;
  /**
   * The same counts about seven days ago. `new7d` is exact (from `createdAt`);
   * `active7d`/`inactive3d` come from the settlement snapshot and are null until
   * one exists for that day.
   */
  previous: { active7d: number | null; new7d: number; inactive3d: number | null };
}

export interface DashboardKpis {
  totalUsers: number;
  newUsersLast7d: number;
  totalRobots: number;
  battlesLast24h: number;
  totalBattles: number;
  /**
   * @deprecated Counts users with a robot updated in 7 days, which battles do
   * for nearly every stable. Use `humanPlayers.active7d` (login-based).
   */
  activeUsersLast7d: number;
  currentCycle: number;
  lastCycleAt: string | null;
  humanPlayers: DashboardHumanPlayers;
  robots: DashboardRobots;
  timestamp: string;
}

/** Robot block of the dashboard KPIs (respects the dashboard filter). */
export interface DashboardRobots {
  total: number;
  battleReady: number;
  /** One decimal. */
  battleReadyPercentage: number;
}
