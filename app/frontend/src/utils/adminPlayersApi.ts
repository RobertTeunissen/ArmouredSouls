/**
 * Typed API of the admin Players page (`/admin/players`) and its stable
 * detail panel. Mirrors `app/backend/src/services/admin/adminPlayersService.ts`
 * and `stableCashflow.ts`.
 */
import { api } from './api';

export type PlayerSegment = 'active' | 'inactive' | 'dormant';
export type PlayerIssueCode =
  | 'onboarding_stuck'
  | 'no_robots'
  | 'no_battle_ready_robots'
  | 'no_weapons'
  | 'no_battles'
  | 'low_balance';
export type StableKind = 'human' | 'automaton' | 'generated';

export interface PlayerIssue {
  code: PlayerIssueCode;
  label: string;
}

export interface PlayerRow {
  userId: number;
  username: string;
  stableName: string | null;
  robots: number;
  battles: number;
  wins: number;
  winRate: number | null;
  currency: number;
  lastLoginAt: string | null;
  createdAt: string;
  segment: PlayerSegment;
  issues: PlayerIssue[];
}

export interface PlayersOverview {
  seasonNumber: number;
  seasonStartedAt: string | null;
  thresholds: { lowBalance: number; inactiveAfterDays: number };
  counts: { all: number; active: number; inactive: number; dormant: number; onboardingStuck: number; lowBalance: number };
  players: PlayerRow[];
  timestamp: string;
}

export interface StableCashflowCycle {
  cycle: number;
  balance: number;
  earned: number;
  runningCosts: number;
  bought: number;
}

export interface StableCashflow {
  points: StableCashflowCycle[];
  earned: number;
  runningCosts: number;
  bought: number;
  lowBalanceCycles: number;
}

export type RobotTierMode = 'league_1v1' | 'koth' | 'grand_melee';
export type TeamTierMode = 'league_2v2' | 'league_3v3' | 'tag_team';

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
  tiers: Partial<Record<RobotTierMode, string>>;
  subscriptions: string[];
}

export interface PlayerDetailTeam {
  id: number;
  name: string;
  size: number;
  tiers: Partial<Record<TeamTierMode, string>>;
}

export interface PlayerDetail {
  id: number;
  username: string;
  stableName: string | null;
  stableKind: StableKind;
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
  cashflow: StableCashflow;
  robots: PlayerDetailRobot[];
  teams: PlayerDetailTeam[];
  facilities: { type: string; level: number }[];
}

export interface StableSearchResult {
  id: number;
  username: string;
  stableName: string | null;
  stableKind: StableKind;
}

export const getPlayersOverview = (signal?: AbortSignal): Promise<PlayersOverview> =>
  api.get<PlayersOverview>('/api/admin/players', { signal });

export const getPlayerDetail = (userId: number, signal?: AbortSignal): Promise<PlayerDetail> =>
  api.get<PlayerDetail>(`/api/admin/users/${userId}`, { signal });

export const searchStables = async (q: string, signal?: AbortSignal): Promise<StableSearchResult[]> =>
  (await api.get<{ users: StableSearchResult[] }>('/api/admin/users/search', { params: { q }, signal })).users;

export const resetPlayerPassword = (userId: number, password: string): Promise<{ success: boolean; username: string }> =>
  api.post<{ success: boolean; username: string }>(`/api/admin/users/${userId}/reset-password`, { password });
