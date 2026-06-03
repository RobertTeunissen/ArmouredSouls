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
  teamLp: number;
  teamLeague: string;
  teamLeagueId: string;
  cyclesInLeague: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  eligibility: string;
  ineligibilityReason: string | null;
  ineligibilityDetail: string | null;
  createdAt: string;
  updatedAt: string;
  members: TeamBattleMember[];
  isLockedForBattle: boolean;
}

// ── API Functions ────────────────────────────────────────────────────

/**
 * Fetch all teams for the current user, optionally filtered by team size.
 */
export async function getMyTeamBattles(teamSize?: 2 | 3): Promise<TeamBattle[]> {
  const params: Record<string, unknown> = {};
  if (teamSize) {
    params.teamSize = teamSize;
  }
  const data = await api.get<{ teams: TeamBattle[] }>('/api/team-battles', { params });
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

// ── Standings Types ──────────────────────────────────────────────────

export interface TeamBattleStandingMember {
  robotId: number;
  robotName: string;
  robotElo: number;
  slotIndex: number;
}

export interface TeamBattleStanding {
  rank: number;
  teamId: number;
  teamName: string;
  stableId: number;
  stableName: string;
  teamSize: number;
  teamLp: number;
  teamELO: number;
  teamLeague: string;
  teamLeagueId: string;
  wins: number;
  losses: number;
  draws: number;
  totalMatches: number;
  eligibility: string;
  cyclesInLeague: number;
  isSubscribed?: boolean;
  members: TeamBattleStandingMember[];
}

export interface TeamBattleStandingsResponse {
  standings: TeamBattleStanding[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  tier: string;
  teamSize: number;
}

export interface TeamBattleLeagueInstance {
  leagueId: string;
  leagueTier: string;
  currentTeams: number;
  maxTeams: number;
}

// ── Standings API Functions ──────────────────────────────────────────

/**
 * Fetch team battle league standings for a specific tier and team size.
 */
export async function getTeamBattleStandings(
  teamSize: 2 | 3,
  tier: string,
  page: number = 1,
  perPage: number = 50,
  instance?: string,
): Promise<TeamBattleStandingsResponse> {
  return api.get<TeamBattleStandingsResponse>(
    `/api/team-battles/leagues/${teamSize}/${tier}/standings`,
    {
      params: {
        page,
        perPage,
        ...(instance && { instance }),
      },
    },
  );
}

/**
 * Fetch league instances for a specific tier and team size.
 */
export async function getTeamBattleLeagueInstances(
  teamSize: 2 | 3,
  tier: string,
): Promise<TeamBattleLeagueInstance[]> {
  return api.get<TeamBattleLeagueInstance[]>(
    `/api/team-battles/leagues/${teamSize}/${tier}/instances`,
  );
}
