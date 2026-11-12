/**
 * Wire contracts for the admin Players page: `GET /api/admin/players`,
 * `/players/:userId` and the stable search (backend
 * `services/admin/adminPlayersService.ts`, `stableCashflow.ts`).
 */
import type { StableType } from './stable';

export interface AdminStableSearchResult {
  id: number;
  username: string;
  stableName: string | null;
  stableKind: StableType;
}

export interface PlayerDetail {
  id: number;
  username: string;
  stableName: string | null;
  stableKind: StableType;
  /** Automaton catalogue key (opens its Editor), else null. */
  automatonKey: string | null;
  role: string;
  currency: number;
  createdAt: string;
  lastLoginAt: string | null;
  segment: PlayerSegment | null;
  onboarding: { completed: boolean; skipped: boolean; currentStep: number };
  battles: number;
  wins: number;
  winRate: number | null;
  issues: PlayerIssue[];
  /** Last 10 cycles with ledger rows, oldest first, and the window totals. */
  cashflow: StableCashflow;
  robots: PlayerDetailRobot[];
  teams: PlayerDetailTeam[];
  facilities: { type: string; level: number }[];
}

export interface PlayerDetailRobot {
  id: number;
  name: string;
  elo: number;
  hpPercent: number;
  battleReady: boolean;
  mainWeapon: string | null;
  offhandWeapon: string | null;
  loadout: string;
  stance: string;
  wins: number;
  losses: number;
  draws: number;
  /** Robot-mode tiers (1v1 League, KotH, Grand Melee); absent = no row. */
  tiers: Partial<Record<RobotTierMode, string>>;
  subscriptions: string[];
}

export interface PlayerDetailTeam {
  id: number;
  name: string;
  size: number;
  /** Team-mode tiers (2v2/3v3 League, Tag Team). */
  tiers: Partial<Record<TeamTierMode, string>>;
}

export interface PlayerIssue {
  code: PlayerIssueCode;
  label: string;
}

export type PlayerIssueCode =
  | 'onboarding_stuck'
  | 'no_robots'
  | 'no_battle_ready_robots'
  | 'no_weapons'
  | 'no_battles'
  | 'low_balance';

export interface PlayerRow {
  userId: number;
  username: string;
  stableName: string | null;
  robots: number;
  /** This season (robots are rebuilt every season), each battle once per stable. */
  battles: number;
  wins: number;
  /** Whole percent; null without battles. */
  winRate: number | null;
  currency: number;
  lastLoginAt: string | null;
  createdAt: string;
  segment: PlayerSegment;
  issues: PlayerIssue[];
}

export type PlayerSegment = 'active' | 'inactive' | 'dormant';

export interface PlayersOverview {
  seasonNumber: number;
  seasonStartedAt: string | null;
  thresholds: { lowBalance: number; inactiveAfterDays: number };
  counts: { all: number; active: number; inactive: number; dormant: number; onboardingStuck: number; lowBalance: number };
  players: PlayerRow[];
  timestamp: string;
}

/** Standings modes a robot has its own tier in. */
export type RobotTierMode = 'league_1v1' | 'koth' | 'grand_melee';

/** Standings modes a team has a tier in. */
export type TeamTierMode = 'league_2v2' | 'league_3v3' | 'tag_team';

export interface StableCashflow {
  /** Cycles with ledger rows, oldest first. */
  points: StableCashflowCycle[];
  earned: number;
  runningCosts: number;
  bought: number;
  /** Cycles that ended below the low-balance threshold. */
  lowBalanceCycles: number;
}

export interface StableCashflowCycle {
  cycle: number;
  /** Balance after the cycle's last ledger row. */
  balance: number;
  earned: number;
  runningCosts: number;
  bought: number;
}
