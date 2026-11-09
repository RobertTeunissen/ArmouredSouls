/**
 * Team Battle API utility
 *
 * Provides typed API functions for 2v2 and 3v3 League team management:
 * - Fetch user's teams (with member robot data and lock status)
 * - Register a new team
 * - Swap a team member
 * - Rename a team
 * - Disband a team
 *
 * @module utils/teamBattleApi
 */

import { api } from './api';

// ── Types ────────────────────────────────────────────────────────────

export interface TeamBattleRobot {
  id: number;
  name: string;
  elo: number;
  currentHP: number;
  maxHP: number;
  currentShield: number | null;
  maxShield: number | null;
  loadoutType: string;
  mainWeaponId: number | null;
  offhandWeaponId: number | null;
  subscriptions?: { eventType: string; status: string }[];
}

export interface TeamBattleMember {
  id: number;
  teamId: number;
  robotId: number;
  slotIndex: number;
  robot: TeamBattleRobot;
}

export interface TeamBattle {
  id: number;
  stableId: number;
  teamSize: number;
  teamName: string;
  /** null when the team has no standing in its 2v2/3v3 League yet (Unranked). */
  teamLp: number | null;
  teamLeague: string | null;
  teamLeagueId: string | null;
  cyclesInLeague: number;
  totalLeagueWins: number;
  totalLeagueLosses: number;
  totalLeagueDraws: number;
  // Tag team fields (only populated when teamSize === 2); null when the team
  // has no Tag Team standing yet (Unranked).
  tagTeamLp: number | null;
  tagTeamLeague: string | null;
  tagTeamLeagueId: string | null;
  totalTagTeamWins: number;
  totalTagTeamLosses: number;
  totalTagTeamDraws: number;
  createdAt: string;
  updatedAt: string;
  members: TeamBattleMember[];
  isLockedForBattle: boolean;
}

// ── API Functions ────────────────────────────────────────────────────

/**
 * Fetch all teams for the current user, optionally filtered by team size.
 */
export async function getMyTeamBattles(teamSize?: 2 | 3, signal?: AbortSignal): Promise<TeamBattle[]> {
  const params: Record<string, unknown> = {};
  if (teamSize) {
    params.teamSize = teamSize;
  }
  const data = await api.get<{ teams: TeamBattle[] }>('/api/team-battles', signal ? { params, signal } : { params });
  return data.teams || [];
}

/**
 * Register a new team for 2v2 or 3v3 League.
 */
export async function registerTeamBattle(
  robotIds: number[],
  teamName: string,
  teamSize: 2 | 3,
): Promise<TeamBattle> {
  const data = await api.post<{ team: TeamBattle }>('/api/team-battles', {
    robotIds,
    teamName,
    teamSize,
  });
  return data.team;
}

/**
 * Swap a team member with a new robot.
 */
export async function swapTeamBattleMember(
  teamId: number,
  oldRobotId: number,
  newRobotId: number,
): Promise<void> {
  await api.put(`/api/team-battles/${teamId}/swap`, { oldRobotId, newRobotId });
}

/**
 * Swap Active ↔ Reserve positions on a 2v2 team.
 */
export async function swapTeamBattlePositions(teamId: number): Promise<void> {
  await api.put(`/api/team-battles/${teamId}/swap-positions`);
}

/**
 * Rename a team.
 */
export async function renameTeamBattle(teamId: number, teamName: string): Promise<void> {
  await api.put(`/api/team-battles/${teamId}/rename`, { teamName });
}

/**
 * Disband a team.
 */
export async function disbandTeamBattle(teamId: number): Promise<void> {
  await api.delete(`/api/team-battles/${teamId}`);
}

// ── Shared Helpers ───────────────────────────────────────────────────
