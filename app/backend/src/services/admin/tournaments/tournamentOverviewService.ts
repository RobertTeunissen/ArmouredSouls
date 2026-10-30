/**
 * Admin Tournaments overview (`GET /api/admin/tournaments/overview`): the
 * running tournament of each type and this season's completed tournaments with
 * their champions. Read-only; three small queries.
 *
 * @module services/admin/tournaments/tournamentOverviewService
 */

import prisma from '../../../lib/prisma';
import { Prisma } from '../../../../generated/prisma';
import { getConfig } from '../../../config/env';
import logger from '../../../config/logger';
import { getCurrentSeason } from '../../season/seasonService';
import { buildTournamentOverview } from './tournamentOverview';
import {
  TOURNAMENT_TYPES,
  type MatchGroupRow,
  type StableType,
  type TournamentOverview,
  type TournamentRow,
  type TournamentType,
} from './tournamentOverviewTypes';

interface RawTournament {
  id: number;
  name: string;
  participant_type: string;
  status: string;
  current_round: number;
  max_rounds: number;
  total_participants: number;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  winner_id: number | null;
  champion_name: string | null;
  stable_id: number | null;
  stable_name: string | null;
  stable_type: string | null;
}

interface RawMatchGroup {
  tournament_id: number;
  round: number;
  status: string;
  is_bye_match: boolean;
  count: number;
  last_completed_at: Date | null;
}

const STABLE_TYPES: ReadonlySet<string> = new Set(['human', 'generated', 'automaton']);

function toRow(raw: RawTournament): TournamentRow {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.participant_type as TournamentType,
    status: raw.status,
    currentRound: raw.current_round,
    maxRounds: raw.max_rounds,
    totalParticipants: raw.total_participants,
    createdAt: raw.created_at,
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
    champion: raw.status === 'completed' && raw.winner_id !== null
      ? {
          id: raw.winner_id,
          name: raw.champion_name,
          stableId: raw.stable_id,
          stableName: raw.stable_name,
          stableType: raw.stable_type && STABLE_TYPES.has(raw.stable_type) ? raw.stable_type as StableType : null,
        }
      : null,
  };
}

async function loadTournaments(): Promise<TournamentRow[]> {
  // The champion is a robot in 1v1 and a team (team_battles) in 2v2 / 3v3;
  // a deleted robot or team leaves the champion's name and stable unknown.
  const rows = await prisma.$queryRaw<RawTournament[]>`
    SELECT t.id, t.name, t.participant_type, t.status, t.current_round, t.max_rounds, t.total_participants,
      t.created_at, t.started_at, t.completed_at, t.winner_id,
      COALESCE(r.name, tb.team_name) AS champion_name,
      COALESCE(ur.id, ut.id) AS stable_id,
      COALESCE(ur.stable_name, ur.username, ut.stable_name, ut.username) AS stable_name,
      COALESCE(ur.stable_type, ut.stable_type)::text AS stable_type
    FROM tournaments t
    LEFT JOIN robots r ON t.participant_type = 'robot' AND r.id = t.winner_id
    LEFT JOIN users ur ON ur.id = r.user_id
    LEFT JOIN team_battles tb ON t.participant_type <> 'robot' AND tb.id = t.winner_id
    LEFT JOIN users ut ON ut.id = tb.stable_id
    WHERE t.participant_type IN (${Prisma.join([...TOURNAMENT_TYPES])})
  `;
  return rows.map(toRow);
}

async function loadMatchGroups(tournamentIds: readonly number[]): Promise<MatchGroupRow[]> {
  if (tournamentIds.length === 0) return [];
  const rows = await prisma.$queryRaw<RawMatchGroup[]>`
    SELECT tournament_id, round, status, is_bye_match, COUNT(*)::int AS count, MAX(completed_at) AS last_completed_at
    FROM tournament_matches
    WHERE tournament_id IN (${Prisma.join([...tournamentIds])})
    GROUP BY tournament_id, round, status, is_bye_match
  `;
  return rows.map((row) => ({
    tournamentId: row.tournament_id,
    round: row.round,
    status: row.status,
    isBye: row.is_bye_match,
    count: Number(row.count),
    lastCompletedAt: row.last_completed_at,
  }));
}

async function loadSeasonPhase(): Promise<string | null> {
  try {
    return (await getCurrentSeason()).phase;
  } catch (error) {
    logger.warn('[AdminTournaments] Could not read the current season', { error });
    return null;
  }
}

/** Read and build the overview. */
export async function getTournamentOverview(now: Date = new Date()): Promise<TournamentOverview> {
  const [tournaments, seasonPhase] = await Promise.all([loadTournaments(), loadSeasonPhase()]);
  const running = tournaments.filter((row) => row.status !== 'completed').map((row) => row.id);
  const matchGroups = await loadMatchGroups(running);
  const config = getConfig();
  return buildTournamentOverview({
    tournaments,
    matchGroups,
    schedules: {
      robot: config.tournamentSchedule,
      team_2v2: config.team2v2TournamentSchedule,
      team_3v3: config.team3v3TournamentSchedule,
    },
    seasonPhase,
    now,
  });
}
