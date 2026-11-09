/**
 * League Standings API (`/league-standings`): the viewer's entries, one page of
 * a tier or instance, and a tier's instances, for all six tiered leagues.
 *
 * The robot modes (1v1, KotH, Grand Melee) and team modes (2v2, 3v3, Tag Team)
 * answer in different shapes; both are normalised to `StandingsRow` here so the
 * page renders every league the same way.
 */
import { api } from './api';
import type { StableType } from '../types/stable';
import { modeInfo, type LeagueModeKey, type MyStandingEntry, type StandingStatus, type ZoneMeta } from './leagueStandings';

export interface StandingsRowMember {
  robotId: number;
  name: string;
}

export interface StandingsRow {
  rank: number;
  entityId: number;
  name: string;
  /** Robot rows link to the robot; team rows have no page of their own. */
  robotId: number | null;
  stable: { userId: number; name: string; stableType: StableType };
  members: StandingsRowMember[];
  leaguePoints: number;
  wins: number;
  draws: number;
  losses: number;
  /** Placement modes: matches played. */
  matches: number;
  /** 1v1 only (robot ELO). */
  elo: number | null;
  cyclesInTier: number;
  isSubscribed: boolean;
  status: StandingStatus | null;
}

export interface StandingsPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface StandingsPage {
  rows: StandingsRow[];
  pagination: StandingsPagination;
  zoneMeta: ZoneMeta;
}

export interface LeagueInstanceSummary {
  id: string;
  size: number;
}

// ─── Raw response shapes ────────────────────────────────────────────

interface RobotRowResponse {
  rank: number;
  id: number;
  name: string;
  elo: number;
  leaguePoints: number;
  wins: number;
  draws: number;
  losses: number;
  totalBattles: number;
  userId: number;
  cyclesInCurrentLeague: number;
  isSubscribed: boolean;
  user: { username: string; stableName: string | null; stableType: StableType };
  status: StandingStatus | null;
}

interface TeamRowResponse {
  rank: number;
  teamId: number;
  teamName: string;
  stableId: number;
  stableName: string;
  stableType: StableType;
  teamLp: number;
  wins: number;
  losses: number;
  draws: number;
  cyclesInLeague: number;
  isSubscribed: boolean;
  status: StandingStatus | null;
  members: Array<{ robotId: number; robotName: string }>;
}

interface TagTeamRowResponse {
  rank: number;
  teamId: number;
  teamName: string;
  stableId: number;
  stableName: string;
  stableType: StableType;
  tagTeamLp: number;
  totalTagTeamWins: number;
  totalTagTeamLosses: number;
  totalTagTeamDraws: number;
  cyclesInTagTeamLeague: number;
  isSubscribed: boolean;
  status: StandingStatus | null;
  members: Array<{ id: number; name: string }>;
}

interface Paged<T> {
  pagination: StandingsPagination;
  zoneMeta: ZoneMeta;
  data?: T[];
  standings?: T[];
}

// ─── Normalisers ────────────────────────────────────────────────────

function fromRobotRow(row: RobotRowResponse, withElo: boolean): StandingsRow {
  return {
    rank: row.rank,
    entityId: row.id,
    name: row.name,
    robotId: row.id,
    stable: { userId: row.userId, name: row.user.stableName || row.user.username, stableType: row.user.stableType },
    members: [],
    leaguePoints: row.leaguePoints,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    matches: row.totalBattles,
    elo: withElo ? row.elo : null,
    cyclesInTier: row.cyclesInCurrentLeague,
    isSubscribed: row.isSubscribed,
    status: row.status ?? null,
  };
}

function fromTeamRow(row: TeamRowResponse): StandingsRow {
  return {
    rank: row.rank,
    entityId: row.teamId,
    name: row.teamName,
    robotId: null,
    stable: { userId: row.stableId, name: row.stableName, stableType: row.stableType },
    members: row.members.map((m) => ({ robotId: m.robotId, name: m.robotName })),
    leaguePoints: row.teamLp,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    matches: row.wins + row.draws + row.losses,
    elo: null,
    cyclesInTier: row.cyclesInLeague,
    isSubscribed: row.isSubscribed,
    status: row.status ?? null,
  };
}

function fromTagTeamRow(row: TagTeamRowResponse): StandingsRow {
  const wins = row.totalTagTeamWins;
  const draws = row.totalTagTeamDraws;
  const losses = row.totalTagTeamLosses;
  return {
    rank: row.rank,
    entityId: row.teamId,
    name: row.teamName,
    robotId: null,
    stable: { userId: row.stableId, name: row.stableName, stableType: row.stableType },
    members: row.members.map((m) => ({ robotId: m.id, name: m.name })),
    leaguePoints: row.tagTeamLp,
    wins,
    draws,
    losses,
    matches: wins + draws + losses,
    elo: null,
    cyclesInTier: row.cyclesInTagTeamLeague,
    isSubscribed: row.isSubscribed,
    status: row.status ?? null,
  };
}

// ─── Requests ───────────────────────────────────────────────────────

export interface StandingsPageRequest {
  mode: LeagueModeKey;
  tier: string;
  instance: string | null;
  page: number;
  perPage: number;
}

export async function fetchStandingsPage({ mode, tier, instance, page, perPage }: StandingsPageRequest): Promise<StandingsPage> {
  const params = { page, perPage, ...(instance ? { instance } : {}) };
  const info = modeInfo(mode);

  if (info.entity === 'robot') {
    const res = await api.get<Paged<RobotRowResponse>>(`/api/leagues/${tier}/standings`, { params: { ...params, mode: info.apiMode } });
    return { rows: (res.data ?? []).map((row) => fromRobotRow(row, mode === '1v1')), pagination: res.pagination, zoneMeta: res.zoneMeta };
  }
  if (mode === 'tag_team') {
    const res = await api.get<Paged<TagTeamRowResponse>>(`/api/team-battles/leagues/2/${tier}/tag-team-standings`, { params });
    return { rows: (res.standings ?? []).map(fromTagTeamRow), pagination: res.pagination, zoneMeta: res.zoneMeta };
  }
  const size = mode === '2v2' ? 2 : 3;
  const res = await api.get<Paged<TeamRowResponse>>(`/api/team-battles/leagues/${size}/${tier}/standings`, { params });
  return { rows: (res.standings ?? []).map(fromTeamRow), pagination: res.pagination, zoneMeta: res.zoneMeta };
}

export async function fetchInstances(mode: LeagueModeKey, tier: string): Promise<LeagueInstanceSummary[]> {
  const info = modeInfo(mode);
  const instanceNumber = (id: string): number => parseInt(id.split('_')[1] ?? '0', 10);
  let list: LeagueInstanceSummary[];
  if (info.entity === 'robot') {
    const res = await api.get<Array<{ leagueId: string; currentRobots: number }>>(`/api/leagues/${tier}/instances`, { params: { mode: info.apiMode } });
    list = res.map((i) => ({ id: i.leagueId, size: i.currentRobots }));
  } else {
    const path = mode === 'tag_team'
      ? `/api/team-battles/leagues/2/${tier}/tag-team-instances`
      : `/api/team-battles/leagues/${mode === '2v2' ? 2 : 3}/${tier}/instances`;
    const res = await api.get<Array<{ leagueId: string; currentTeams: number }>>(path);
    list = res.map((i) => ({ id: i.leagueId, size: i.currentTeams }));
  }
  return list.sort((a, b) => instanceNumber(a.id) - instanceNumber(b.id));
}

export async function fetchMyStandings(): Promise<MyStandingEntry[]> {
  const res = await api.get<{ entries: MyStandingEntry[] }>('/api/leagues/my-standings');
  return res.entries ?? [];
}
