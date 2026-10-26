/**
 * Admin battle list (`GET /api/admin/battles`): one SQL query for the page and
 * one for the count, with the same WHERE. Never selects `battle_log` (100 kB to
 * 1 MB per row), which is what made the old page slow.
 */
import prisma from '../../../lib/prisma';
import { Prisma } from '../../../../generated/prisma';
import { BATTLE_MODES, MODE_TIME_LIMIT_SECONDS, type BattleMode } from './battleModes';
import type { BattleOutcomeFilter, BattleRangeFilter, BattleStableFilter } from './battleFilters';
import { loadBattleFacts, outcomeOf, summariseSides, swingOf, type BattleCoreRow } from './battleFacts';
import type { BattleListResponse, BattleListRow, StableKind } from './battleTypes';

export interface BattleListParams {
  page: number;
  limit: number;
  mode: BattleMode | 'all';
  stable: BattleStableFilter;
  outcome: BattleOutcomeFilter;
  range: BattleRangeFilter;
  q?: string;
  /** Injected for tests; defaults to now. */
  now?: Date;
}

const RANGE_MS: Record<Exclude<BattleRangeFilter, 'season'>, number> = {
  '24h': 24 * 3600 * 1000,
  '7d': 7 * 24 * 3600 * 1000,
  '30d': 30 * 24 * 3600 * 1000,
};

/** `#123` or `123` searches by battle id. */
export function parseBattleIdQuery(q: string | undefined): number | null {
  const match = q?.trim().match(/^#?(\d{1,9})$/);
  return match ? Number(match[1]) : null;
}

/** Escape LIKE wildcards so a search for "50%" matches literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const BYE_SQL = Prisma.sql`(
  EXISTS (SELECT 1 FROM scheduled_matches_v2 sm WHERE sm.battle_id = b.id AND sm.is_bye_match)
  OR EXISTS (SELECT 1 FROM tournament_matches tm WHERE tm.battle_id = b.id AND tm.is_bye_match)
)`;

/** Mirrors `classifyForfeit`: two-sided with any forfeiter, placement with only forfeiters, or a forfeit bracket row. */
const FORFEIT_SQL = Prisma.sql`(
  EXISTS (SELECT 1 FROM tournament_matches tm WHERE tm.battle_id = b.id AND tm.status = 'forfeit')
  OR (b.battle_type NOT IN ('koth', 'grand_melee')
      AND EXISTS (SELECT 1 FROM battle_participants p WHERE p.battle_id = b.id AND p.forfeited))
  OR (b.battle_type IN ('koth', 'grand_melee')
      AND EXISTS (SELECT 1 FROM battle_participants p WHERE p.battle_id = b.id AND p.forfeited)
      AND NOT EXISTS (SELECT 1 FROM battle_participants p WHERE p.battle_id = b.id AND NOT p.forfeited))
)`;

const TIME_LIMIT_SQL = Prisma.sql`(CASE b.battle_type ${Prisma.join(
  BATTLE_MODES.map(mode => Prisma.sql`WHEN ${mode} THEN ${MODE_TIME_LIMIT_SECONDS[mode]}::int`),
  ' ',
)} ELSE ${MODE_TIME_LIMIT_SECONDS.league_1v1}::int END)`;

export function buildBattleWhere(params: BattleListParams): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  const battleId = parseBattleIdQuery(params.q);

  if (battleId !== null) {
    // An id lookup ignores the date range: you asked for that battle.
    conditions.push(Prisma.sql`b.id = ${battleId}`);
  } else {
    if (params.range !== 'season') {
      const since = new Date((params.now ?? new Date()).getTime() - RANGE_MS[params.range]);
      conditions.push(Prisma.sql`b.created_at >= ${since}`);
    }
    const q = params.q?.trim();
    if (q) {
      const pattern = `%${escapeLike(q)}%`;
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM battle_participants p
        JOIN robots r ON r.id = p.robot_id
        JOIN users u ON u.id = r.user_id
        WHERE p.battle_id = b.id
          AND (r.name ILIKE ${pattern} OR u.stable_name ILIKE ${pattern} OR u.username ILIKE ${pattern})
      )`);
    }
  }

  if (params.mode !== 'all') conditions.push(Prisma.sql`b.battle_type = ${params.mode}`);

  if (params.stable !== 'all') {
    const kind: StableKind = params.stable;
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM battle_participants p
      JOIN robots r ON r.id = p.robot_id
      JOIN users u ON u.id = r.user_id
      WHERE p.battle_id = b.id AND u.stable_type::text = ${kind}
    )`);
  }

  switch (params.outcome) {
    case 'bye':
      conditions.push(BYE_SQL);
      break;
    case 'forfeit':
      conditions.push(Prisma.sql`NOT ${BYE_SQL} AND ${FORFEIT_SQL}`);
      break;
    case 'draw':
      conditions.push(Prisma.sql`b.winner_id IS NULL AND b.winning_side IS NULL AND NOT ${BYE_SQL} AND NOT ${FORFEIT_SQL}`);
      break;
    case 'time_limit':
      conditions.push(Prisma.sql`b.duration_seconds >= ${TIME_LIMIT_SQL} AND NOT ${BYE_SQL} AND NOT ${FORFEIT_SQL}`);
      break;
    case 'all':
      break;
  }

  return conditions.length === 0 ? Prisma.sql`TRUE` : Prisma.join(conditions, ' AND ');
}

interface RawBattleRow {
  id: number;
  battle_type: string;
  league_type: string;
  league_instance_id: string | null;
  tournament_id: number | null;
  tournament_round: number | null;
  tournament_name: string | null;
  winner_id: number | null;
  winning_side: number | null;
  duration_seconds: number;
  created_at: Date;
}

export function toCoreRow(r: RawBattleRow): BattleCoreRow {
  return {
    id: r.id,
    battleType: r.battle_type,
    leagueType: r.league_type,
    leagueInstanceId: r.league_instance_id,
    tournamentId: r.tournament_id,
    tournamentRound: r.tournament_round,
    tournamentName: r.tournament_name,
    winnerId: r.winner_id,
    winningSide: r.winning_side,
    durationSeconds: r.duration_seconds,
    createdAt: r.created_at,
  };
}

/** Battle rows (without the log) for the given WHERE, newest first. */
export async function queryBattleRows(where: Prisma.Sql, limit: number, offset: number): Promise<BattleCoreRow[]> {
  const rows = await prisma.$queryRaw<RawBattleRow[]>`
    SELECT b.id, b.battle_type, b.league_type, b.league_instance_id, b.tournament_id,
           b.tournament_round, t.name AS tournament_name, b.winner_id, b.winning_side::int AS winning_side,
           b.duration_seconds, b.created_at
    FROM battles b
    LEFT JOIN tournaments t ON t.id = b.tournament_id
    WHERE ${where}
    ORDER BY b.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map(toCoreRow);
}

export async function getAdminBattleList(params: BattleListParams): Promise<BattleListResponse> {
  const where = buildBattleWhere(params);
  const offset = (params.page - 1) * params.limit;
  const [rows, countRows] = await Promise.all([
    queryBattleRows(where, params.limit, offset),
    prisma.$queryRaw<Array<{ total: bigint }>>`SELECT count(*) AS total FROM battles b WHERE ${where}`,
  ]);
  const total = Number(countRows[0]?.total ?? 0);
  const facts = await loadBattleFacts(rows);

  const battles: BattleListRow[] = rows.map((row) => {
    const f = facts.get(row.id)!;
    const outcome = outcomeOf(row, f);
    const { sides, field } = summariseSides(row, f, outcome);
    return {
      id: row.id,
      battleType: row.battleType,
      leagueType: row.leagueType,
      leagueInstanceId: row.leagueInstanceId,
      tournament: row.tournamentId !== null
        ? { id: row.tournamentId, name: row.tournamentName ?? `Tournament #${row.tournamentId}`, round: row.tournamentRound }
        : null,
      sides,
      field,
      participantCount: f.participants.length,
      result: outcome.result,
      endedBy: outcome.endedBy,
      eloSwing: swingOf(row, f, outcome),
      durationSeconds: row.durationSeconds,
      createdAt: row.createdAt.toISOString(),
    };
  });

  return {
    battles,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}
