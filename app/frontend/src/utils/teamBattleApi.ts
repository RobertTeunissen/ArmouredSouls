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
  totalLeagueWins: number;
  totalLeagueLosses: number;
  totalLeagueDraws: number;
  // Tag team fields (only populated when teamSize === 2)
  tagTeamLp: number;
  tagTeamLeague: string;
  tagTeamLeagueId: string;
  totalTagTeamWins: number;
  totalTagTeamLosses: number;
  totalTagTeamDraws: number;
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
  zone?: 'promotion' | 'demotion' | null;
  eligible?: boolean;
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
  zoneMeta?: {
    minLP: number;
    minCycles: number;
    hasEnoughRobots: boolean;
    minRobotsRequired: number;
    eligibleCount: number;
    isChampion: boolean;
    isBronze: boolean;
    promotionSlots: number;
    demotionSlots: number;
  };
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

// ── Tag Team Standings Types ─────────────────────────────────────────

export interface TagTeamStandingMember {
  id: number;
  name: string;
  elo: number;
  slotIndex: number;
}

export interface TagTeamStandingEntry {
  rank: number;
  teamId: number;
  teamName: string;
  stableId: number;
  stableName: string;
  tagTeamLp: number;
  tagTeamLeague: string;
  tagTeamLeagueId: string;
  totalTagTeamWins: number;
  totalTagTeamLosses: number;
  totalTagTeamDraws: number;
  combinedELO: number;
  cyclesInTagTeamLeague?: number;
  zone?: 'promotion' | 'demotion' | null;
  eligible?: boolean;
  members: TagTeamStandingMember[];
}

export interface TagTeamStandingsResponse {
  standings: TagTeamStandingEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  tier: string;
  zoneMeta?: {
    minLP: number;
    minCycles: number;
    hasEnoughRobots: boolean;
    minRobotsRequired: number;
    eligibleCount: number;
    isChampion: boolean;
    isBronze: boolean;
    promotionSlots: number;
    demotionSlots: number;
  };
}

// ── Tag Team Standings API Functions ─────────────────────────────────

/**
 * Fetch tag team standings for a specific tier, sorted by tagTeamLp descending.
 */
export async function getTagTeamStandingsNew(
  tier: string,
  page: number = 1,
  perPage: number = 50,
  instance?: string,
): Promise<TagTeamStandingsResponse> {
  return api.get<TagTeamStandingsResponse>(
    `/api/team-battles/leagues/2/${tier}/tag-team-standings`,
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
 * Fetch tag team league instances for a specific tier.
 */
export async function getTagTeamLeagueInstances(
  tier: string,
): Promise<TeamBattleLeagueInstance[]> {
  return api.get<TeamBattleLeagueInstance[]>(
    `/api/team-battles/leagues/2/${tier}/tag-team-instances`,
  );
}

// ── Shared Helpers ───────────────────────────────────────────────────

/**
 * Generate a team name from match team data.
 * Used for upcoming/recent matches where we have team info but not full TeamBattle object.
 */
export function getTeamNameFromMatch(teamId: number, stableName: string | null): string {
  if (stableName) {
    return stableName;
  }
  return `Team ${teamId}`;
}
